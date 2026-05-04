import { walkFiles, readFileSafe, isTestFile } from '@aegis-scan/core';
import type { Scanner, ScanResult, Finding, AegisConfig } from '@aegis-scan/core';
import { basename } from 'node:path';

/**
 * Persistence-pattern checker — detects code that runs automatically when a
 * module is imported (without explicit operator action). Closes the
 * red-team-blueprint Phase 5 gap.
 *
 * Defining trait: "executes at module load." Patterns flagged:
 *   - Top-level `child_process.spawn` / `exec` / `execFile` / `execSync`
 *   - Top-level dynamic `require(varName)` / `import(varName)` / IIFE-wrapped
 *   - Top-level `eval(varName)` / `new Function(varName)`
 *   - Top-level `fs` writes to user-config persistence targets
 *     (`.bashrc`, `.zshrc`, `.profile`, `.ssh/authorized_keys`, launchd
 *     plists, systemd units, crontab)
 *   - Top-level `cron.schedule(fn)` / `setInterval(fn)` (registers callback
 *     at startup; review-flag, not a hard fail)
 *
 * Implementation: regex + bracket-nesting state machine. "Top-level" means
 * brace-depth 0 ignoring class/object-literal blocks. IIFE patterns count
 * as top-level because the wrapping function executes immediately on
 * module load. Comments are stripped before pattern matching so commented-
 * out persistence patterns do not produce false positives. The matchers
 * require `\s*\(` after the keyword, so `import { spawn } from
 * 'child_process'` is NOT misclassified as a call (no parentheses follow).
 *
 * Out of scope (deliberate framing):
 *   - `setTimeout` at top-level — too FP-heavy (every dev hot-reload
 *     helper). Persistence here is the registered callback, not the
 *     setTimeout itself; address via call-site review.
 *   - Multi-line `require(` / `eval(` calls split across lines — single-
 *     line regex misses these. Real attackers might split; follow-up
 *     F-target if first-application surfaces examples.
 *   - String-concat eval obfuscation that resolves to `eval` only at
 *     runtime — different vuln class (general CWE-94 dynamic-code).
 *
 * Path exclusions: test files, `scripts/`, `migrations/`, build-time
 * config files (`*.config.{ts,js,mjs,cjs}`) — these legitimately do
 * top-level work.
 */

interface PersistenceFinding {
  line: number;
  rule: PersistenceRule;
}

interface PersistenceRule {
  id: string;
  cwe: number;
  severity: Finding['severity'];
  title: string;
  description: string;
  fix: { description: string; code: string };
}

const RULE_SPAWN_TOP_LEVEL: PersistenceRule = {
  id: 'spawn-top-level',
  cwe: 506,
  severity: 'high',
  title: 'child_process spawn/exec at module top-level (persistence pattern)',
  description:
    'A child_process call (spawn / exec / execFile / execSync) was found at module top-level — it executes on every `import` of this file with no operator gate. This is the canonical supply-chain malware shape: a benign-looking module that spawns an attacker binary on load. If this is legitimate build-time work, move it into an exported function the operator explicitly invokes, OR rename the file to `*.config.{ts,js,mjs,cjs}` if it is a build-config file.',
  fix: {
    description:
      'Wrap the call in an exported function so the side-effect is opt-in. The operator (build pipeline, test harness, CLI) then explicitly invokes it — turning module-load persistence into a normal function call.',
    code: "import { spawn } from 'child_process';\n\nexport function runBuild() {\n  // Operator explicitly invokes this — not on every import\n  return spawn('tsc', ['--build']);\n}",
  },
};

const RULE_DYNAMIC_REQUIRE_OR_IMPORT: PersistenceRule = {
  id: 'dynamic-require-or-import',
  cwe: 829,
  severity: 'high',
  title: 'Dynamic require()/import() at module top-level (persistence pattern)',
  description:
    'A `require()` or dynamic `import()` call at module top-level uses an attacker-controllable string (process.env, function call, template literal). On every load this fetches and runs whatever module the string resolves to — the cleanest supply-chain trojan shape. Static `require("./local-module")` is fine; this pattern is dangerous because the loaded code is decided at runtime.',
  fix: {
    description:
      'Replace with a static module import so the loaded code is auditable + lockable via package-lock. If the dynamic shape is truly required (plugin loader, etc.), gate it behind explicit operator action and validate the resolved name against an allowlist.',
    code: "// Static import — lockable, auditable\nimport { plugin } from './plugins/known';\n\n// OR if truly dynamic: gated + allowlisted\nconst ALLOWED = new Set(['plugin-a', 'plugin-b']);\nexport function loadPlugin(name: string) {\n  if (!ALLOWED.has(name)) throw new Error('plugin not allowed');\n  return import(`./plugins/${name}`);\n}",
  },
};

const RULE_EVAL_TOP_LEVEL: PersistenceRule = {
  id: 'eval-top-level',
  cwe: 94,
  severity: 'high',
  title: 'eval() / new Function() at module top-level (persistence pattern)',
  description:
    'A top-level `eval()` or `new Function()` call evaluates an attacker-controllable string on module load. Classic obfuscated-payload trojan shape. eval of a literal string ("1+1") is bad-practice but not flagged here (different vuln class); flagged only when the eval input is dynamic (variable, template, function-call result, env-var).',
  fix: {
    description:
      'Remove the eval. If you genuinely need to evaluate user-supplied logic, use a sandboxed expression evaluator (vm2 has CVE history — prefer isolated-vm or a domain-specific parser). Never call eval on env-var contents at module load.',
    code: "// Replace eval with a domain-specific parser\nimport { evaluate } from '@app/expression-parser';\n\nexport function compute(formula: string) {\n  return evaluate(formula); // sandboxed, AST-walked, no arbitrary code\n}",
  },
};

const RULE_FS_USER_CONFIG: PersistenceRule = {
  id: 'fs-user-config-write',
  cwe: 506,
  severity: 'high',
  title: 'fs write to user-config persistence target at module top-level',
  description:
    'A top-level `fs.writeFile` / `fs.appendFile` targets a user-shell or service-init file (~/.bashrc, ~/.zshrc, ~/.profile, ~/.ssh/authorized_keys, launchd plist, systemd unit, crontab). These survive uninstall of the original package and can grant attacker persistence beyond the lifetime of the original process. Project-relative writes (./logs/, ./tmp/) are NOT flagged.',
  fix: {
    description:
      'Never modify user-shell or auth-config files from a library. If installation absolutely requires it (a CLI installer), gate it behind an explicit `--install-shell-hook` flag with operator opt-in + a printed audit summary of what is being modified.',
    code: '// Wrong: silent top-level mutation of user config\n// fs.appendFileSync(`${homedir()}/.bashrc`, ...)\n\n// Right: explicit opt-in CLI command with audit-print\nexport async function installShellHook(opts: { confirm: boolean }) {\n  if (!opts.confirm) {\n    console.error("Refusing: pass --confirm to modify ~/.bashrc");\n    process.exit(1);\n  }\n  console.log("About to append to ~/.bashrc:\\n  " + LINE);\n  // ... audit-write ...\n}',
  },
};

const RULE_BACKGROUND_REGISTRATION: PersistenceRule = {
  id: 'background-registration-top-level',
  cwe: 912,
  severity: 'medium',
  title: 'Background-task registration at module top-level (cron/setInterval)',
  description:
    '`cron.schedule()`, `setInterval()`, or `node-schedule` registration at module top-level. Once imported, this background task fires on its own schedule for the lifetime of the process — a hidden side-effect that survives the original caller. Lower severity than the other persistence patterns because the target is bound to the process lifetime, but worth review: the operator may not realize the import alone schedules work.',
  fix: {
    description:
      'Move the schedule registration into a function the operator explicitly invokes. If the import-on-load behavior is intentional (e.g. job-runner package), document it loudly in the module docstring and ensure the consumer is aware of the implicit subscription.',
    code: "import cron from 'node-cron';\n\nexport function startScheduler() {\n  // Operator opts-in by calling this — not on every import\n  cron.schedule('0 * * * *', runHourlyCleanup);\n}",
  },
};

/** All quoted-string types: '...' "..." `...` (template literals without ${} are also literal) */
const STATIC_STRING_RE = /^(['"])[^'"]*\1$|^`[^`${}]*`$/;

/** True when the argument is statically-resolvable (literal string, no interpolation) */
function isStaticArg(arg: string): boolean {
  const trimmed = arg.trim();
  return STATIC_STRING_RE.test(trimmed);
}

/**
 * Walk the file line-by-line tracking brace depth. Returns top-level
 * findings only. Brace depth at the START of the line is what counts —
 * a function declared on a top-level line still has depth 0 at its
 * opening brace. IIFE patterns: depth bumps on `(async () => {` but the
 * body still executes on load, so we use a separate flag that captures
 * "inside a top-level IIFE."
 *
 * Heuristics:
 *   - Strings ('...' "..." `...`) ignored for brace counting (rough)
 *   - Single-line // and multi-line block comments stripped
 *   - Class / object-literal blocks count as nested (since their body
 *     is declarative, not runtime-execution at load)
 *   - "Top-level" includes inside an IIFE because IIFE fires on load
 */
function findTopLevelMatches(
  content: string,
  matchers: { rule: PersistenceRule; pattern: RegExp }[],
): PersistenceFinding[] {
  const findings: PersistenceFinding[] = [];
  const { topLevelLines, codeByLine } = analyzeTopLevel(content);

  for (const lineNo of topLevelLines) {
    const code = codeByLine[lineNo - 1];
    for (const { rule, pattern } of matchers) {
      if (pattern.test(code)) {
        findings.push({ line: lineNo, rule });
      }
    }
  }

  return findings;
}

/**
 * Strip string-literal contents + comments from a line so brace-counting
 * is not confused by `{` inside a regex or string. Imperfect for
 * pathological cases (strings spanning multiple lines, regex with
 * escaped quotes); good enough for the persistence-detection use case.
 */
function stripStringsAndComments(
  line: string,
  inBlockComment: boolean,
): { text: string; endsInBlockComment: boolean } {
  let result = '';
  let i = 0;
  let inLineComment = false;
  let stringDelim: string | null = null;
  let blockComment = inBlockComment;

  while (i < line.length) {
    if (blockComment) {
      if (line[i] === '*' && line[i + 1] === '/') {
        blockComment = false;
        i += 2;
        continue;
      }
      i++;
      continue;
    }
    if (inLineComment) {
      i++;
      continue;
    }
    if (stringDelim) {
      if (line[i] === '\\') {
        i += 2;
        continue;
      }
      if (line[i] === stringDelim) {
        stringDelim = null;
      }
      i++;
      continue;
    }
    if (line[i] === '/' && line[i + 1] === '/') {
      inLineComment = true;
      continue;
    }
    if (line[i] === '/' && line[i + 1] === '*') {
      blockComment = true;
      i += 2;
      continue;
    }
    if (line[i] === '"' || line[i] === "'" || line[i] === '`') {
      stringDelim = line[i];
      i++;
      continue;
    }
    result += line[i];
    i++;
  }

  return { text: result, endsInBlockComment: blockComment };
}

/** Argument-extractor for a known function name. Returns the inside of the
 *  outermost parens of the FIRST call to `name(...)` on the line, or null.
 *  Pathological cases (calls split across multiple lines, deeply nested
 *  template literals) fall through to null — the rule then doesn't fire on
 *  that line, which is the safe default. */
function extractFirstArg(line: string, name: string): string | null {
  const idx = line.indexOf(name + '(');
  if (idx === -1) return null;
  const start = idx + name.length + 1;
  let depth = 1;
  let i = start;
  while (i < line.length && depth > 0) {
    if (line[i] === '(') depth++;
    else if (line[i] === ')') depth--;
    if (depth === 0) break;
    i++;
  }
  if (depth !== 0) return null;
  // Take only the FIRST argument up to the first top-level comma
  const inside = line.slice(start, i);
  let firstArg = '';
  let argDepth = 0;
  for (const ch of inside) {
    if (ch === '(' || ch === '[' || ch === '{') argDepth++;
    else if (ch === ')' || ch === ']' || ch === '}') argDepth--;
    else if (ch === ',' && argDepth === 0) break;
    firstArg += ch;
  }
  return firstArg;
}

/**
 * High-signal persistence-target tokens. Some appear as full path
 * fragments (`.ssh/authorized_keys` joined), others as separate
 * `path.join` arguments (`.ssh`, `authorized_keys`). The proximity
 * matcher below catches the split case across a 3-line window.
 */
const USER_CONFIG_PATH_RE =
  /\.(?:bashrc|zshrc|profile|bash_profile|zprofile|cshrc|tcshrc|kshrc|crontab)\b|\.ssh\/authorized_keys|\.config\/autostart\/|LaunchAgents\/|LaunchDaemons\/|\.plist\b|systemd\/|\/cron\.[dh]ourly\/|\/etc\/cron|\/etc\/rc\.local|\/etc\/profile|init\.d\//;

/** Standalone tokens — no legitimate reason for a library to write to these. */
const STANDALONE_PERSISTENCE_TOKENS = /\bauthorized_keys\b|\bknown_hosts\b/;

/**
 * Returns true if the path string literal or template-with-homedir
 * resolves to a user-config persistence target. Handles both the
 * concatenated (`~/.ssh/authorized_keys` as one string) and the split
 * (`path.join(homedir(), '.ssh', 'authorized_keys')`) shapes — real
 * attackers can use either, fixtures cover the split case.
 */
function isUserConfigPath(arg: string): boolean {
  return (
    USER_CONFIG_PATH_RE.test(arg) ||
    STANDALONE_PERSISTENCE_TOKENS.test(arg) ||
    /homedir\(\)[^,)]*\.(?:bashrc|zshrc|profile|ssh)/i.test(arg) ||
    /process\.env\.HOME[^,)]*\.(?:bashrc|zshrc|profile|ssh)/i.test(arg)
  );
}

/** Files that legitimately do top-level work — skip persistence detection */
function isExcludedPath(file: string): boolean {
  const base = basename(file).toLowerCase();
  if (/\.config\.(ts|tsx|js|jsx|mjs|cjs)$/.test(base)) return true;
  if (/^(next|vite|webpack|rollup|esbuild|jest|vitest|playwright|cypress|tailwind|postcss|eslint|prettier|tsup|rspack|biome)\.config\.(ts|tsx|js|jsx|mjs|cjs)$/.test(base))
    return true;
  if (/^(setup|teardown)\.(ts|tsx|js|jsx|mjs|cjs)$/.test(base)) return true;
  // Migration files often top-level by design
  if (/\/migrations\//.test(file)) return true;
  if (/\/scripts\//.test(file)) return true;
  return false;
}

export const persistencePatternCheckerScanner: Scanner = {
  name: 'persistence-pattern-checker',
  description:
    'Detects code that runs automatically on module import: top-level child_process spawn/exec, dynamic require/import, eval, fs writes to user-config files, background-task registration. Closes the red-team-blueprint Phase 5 (Persistence) detection gap.',
  category: 'quality',

  async isAvailable(_projectPath: string): Promise<boolean> {
    return true;
  },

  async scan(projectPath: string, config: AegisConfig): Promise<ScanResult> {
    const start = Date.now();
    const findings: Finding[] = [];
    let idCounter = 1;
    const defaultIgnore = ['node_modules', 'dist', '.next', '.git'];
    const ignore = [...new Set([...defaultIgnore, ...(config.ignore ?? [])])];
    const files = walkFiles(projectPath, ignore, ['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs']);

    for (const file of files) {
      if (isTestFile(file)) continue;
      if (isExcludedPath(file)) continue;

      const content = readFileSafe(file);
      if (content === null) continue;

      // FP classes caught during v0181 first-application battle-test:
      //  - `export function exec(` is a function DEFINITION, not a call.
      //    Negative-lookbehind `(?<!function\s)` excludes the definition site.
      //  - `dataRe.exec(args)` is RegExp.prototype.exec, not child_process.
      //    Negative-lookbehind `(?<!\.)` excludes method calls; explicit
      //    `child_process.NAME` is allowed via the second alternation.
      //  - Bare `exec(` is too ambiguous (RegExp/iterators/test-frameworks
      //    all use the name). Detected only via the explicit `child_process.`
      //    namespace; bare-name detection keeps the unambiguous 5
      //    (spawn, spawnSync, execSync, execFile, execFileSync).
      const spawnRe =
        /(?<!function\s)(?<!\.)\b(?:spawn|spawnSync|execSync|execFile|execFileSync)\s*\(|\bchild_process\.(?:spawn|spawnSync|exec|execSync|execFile|execFileSync)\s*\(/;

      // Pass 2: dynamic require / import (variable or template-with-interp).
      // Same lookbehinds: skip `function require(` definitions + `obj.require(` methods.
      const requireRe = /(?<!function\s)(?<!\.)\brequire\s*\(/;
      const importCallRe = /(?<!function\s)(?<!\.)\bimport\s*\(/;

      // Pass 3: eval / new Function. Bare `eval(` excluding `obj.eval(` and
      // `function eval(`. `new Function` is unambiguous (constructor call).
      const evalRe = /(?<!function\s)(?<!\.)\beval\s*\(/;
      const newFunctionRe = /\bnew\s+Function\s*\(/;

      // Pass 4: fs writes to user-config paths. fs-method names are stable
      // enough that the bare-form is safe (writeFile/appendFile have no
      // common collision with stdlib methods at this severity threshold).
      const fsWriteRe = /(?<!function\s)\b(?:fs\.)?(?:appendFile(?:Sync)?|writeFile(?:Sync)?)\s*\(/;

      // Pass 5: cron.schedule / setInterval at top-level.
      const cronRe =
        /(?<!function\s)(?<!\.)\b(?:setInterval)\s*\(|\b(?:cron\.schedule|nodeSchedule\.scheduleJob)\s*\(/;

      const matchers: { rule: PersistenceRule; pattern: RegExp }[] = [
        { rule: RULE_SPAWN_TOP_LEVEL, pattern: spawnRe },
        { rule: RULE_BACKGROUND_REGISTRATION, pattern: cronRe },
      ];

      const baseFindings = findTopLevelMatches(content, matchers);

      // For dynamic-require / dynamic-import / eval / fs-write rules, we
      // need to inspect the argument. analyzeTopLevel already gave us
      // both the top-level line set AND comment-stripped code per line —
      // reuse those to keep arg-aware matchers aligned with the
      // top-level matchers above (single source of truth for
      // depth-tracking).
      const { topLevelLines, codeByLine } = analyzeTopLevel(content);
      const lines = content.split('\n');

      for (const lineNo of topLevelLines) {
        const code = codeByLine[lineNo - 1];

        if (requireRe.test(code)) {
          // Use original line for arg-extraction so string-literal
          // contents are preserved (we just stripped them in `code` for
          // boolean-pattern testing).
          const arg = extractFirstArg(lines[lineNo - 1], 'require');
          if (arg !== null && !isStaticArg(arg)) {
            baseFindings.push({ line: lineNo, rule: RULE_DYNAMIC_REQUIRE_OR_IMPORT });
          }
        }
        if (importCallRe.test(code) && !/\bimport\s+[^(]/.test(code)) {
          const arg = extractFirstArg(lines[lineNo - 1], 'import');
          if (arg !== null && !isStaticArg(arg)) {
            baseFindings.push({ line: lineNo, rule: RULE_DYNAMIC_REQUIRE_OR_IMPORT });
          }
        }
        if (evalRe.test(code)) {
          const arg = extractFirstArg(lines[lineNo - 1], 'eval');
          if (arg !== null && !isStaticArg(arg)) {
            baseFindings.push({ line: lineNo, rule: RULE_EVAL_TOP_LEVEL });
          }
        }
        if (newFunctionRe.test(code)) {
          baseFindings.push({ line: lineNo, rule: RULE_EVAL_TOP_LEVEL });
        }
        if (fsWriteRe.test(code)) {
          // Path string + filename may live across multiple lines —
          // inspect a 3-line window starting at the call. Use raw lines
          // so the path literal is preserved.
          const window = lines.slice(lineNo - 1, lineNo + 2).join('\n');
          if (isUserConfigPath(window)) {
            baseFindings.push({ line: lineNo, rule: RULE_FS_USER_CONFIG });
          }
        }
      }

      // De-dup by (line, rule.id)
      const seen = new Set<string>();
      const dedup = baseFindings.filter((f) => {
        const k = `${f.line}::${f.rule.id}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });

      for (const { line, rule } of dedup) {
        const id = `PERSIST-${String(idCounter++).padStart(3, '0')}`;
        findings.push({
          id,
          scanner: 'persistence-pattern-checker',
          severity: rule.severity,
          title: rule.title,
          description: rule.description,
          file,
          line,
          category: 'quality',
          cwe: rule.cwe,
          owasp: 'A08:2021',
          fix: rule.fix,
        });
      }
    }

    return {
      scanner: 'persistence-pattern-checker',
      category: 'quality',
      available: true,
      findings,
      duration: Date.now() - start,
    };
  },
};

/**
 * Single-pass analyzer: walks the file once, returns (1) the 1-indexed
 * line numbers that count as "top-level" (brace-depth 0 or inside a
 * top-level IIFE body) and (2) the per-line code-after-comment-strip so
 * pattern-matchers do not match against comment text. Comments inside a
 * top-level line containing `spawn()` would otherwise produce false
 * positives — see v0.18 F-PHASE5 first-canary-run lesson.
 */
function analyzeTopLevel(content: string): {
  topLevelLines: number[];
  codeByLine: string[];
} {
  const lines = content.split('\n');
  const topLevelLines: number[] = [];
  const codeByLine: string[] = [];
  let braceDepth = 0;
  let inBlockComment = false;
  const iifeStackDepth: number[] = [];

  for (let i = 0; i < lines.length; i++) {
    const insideTopLevelIife =
      iifeStackDepth.length > 0 && iifeStackDepth[0] === 0;
    if (braceDepth === 0 || insideTopLevelIife) {
      topLevelLines.push(i + 1);
    }

    const stripped = stripStringsAndComments(lines[i], inBlockComment);
    inBlockComment = stripped.endsInBlockComment;
    const code = stripped.text;
    codeByLine.push(code);

    // True IIFE: the opening `(` is at expression-statement start (line
    // begins with optional `!`/`;`/`void `/`await `/whitespace, then `(`).
    // Anchored at line start to avoid false-positives on function-call-
    // with-callback patterns like `getRequestConfig(async () => {})` or
    // `app.use(async (req, res) => {})` — those execute the callback only
    // when the host invokes it, not on module load. v0181-battle-test
    // surfaced this on a real-world next-intl request-config callback.
    const iifeOpenRe =
      /^\s*(?:[!;]|void\s+|await\s+)?\(\s*(?:async\s*)?\(?[^)]*\)?\s*=>\s*\{|^\s*(?:[!;]|void\s+|await\s+)?\(\s*(?:async\s+)?function\s*[^{]*\{/;
    if (iifeOpenRe.test(code) && braceDepth === 0) {
      iifeStackDepth.push(braceDepth);
    }

    for (const ch of code) {
      if (ch === '{') braceDepth++;
      else if (ch === '}') {
        braceDepth--;
        if (
          iifeStackDepth.length > 0 &&
          braceDepth === iifeStackDepth[iifeStackDepth.length - 1]
        ) {
          iifeStackDepth.pop();
        }
      }
    }
  }

  return { topLevelLines, codeByLine };
}
