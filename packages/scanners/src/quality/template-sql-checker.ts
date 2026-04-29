import { walkFiles, readFileSafe, isTestFile } from '@aegis-scan/core';
import type { Scanner, ScanResult, Finding, AegisConfig } from '@aegis-scan/core';
import { stripComments } from '../ast/page-context.js';

// Path-invariance test-contract (v0164 — D-CA-001 coverage-audit 2026-04-22):
//   [x] TP — template-interpolated query in /api/test/ route path (N1-class, D-CA-001 regression-guard)
//   [x] FP — template-interpolated query in *.test.ts basename (P1-class, isTestFile() canonical skip)
// Helper-level correctness for P1–P6 covered at phase v0163-test-path-semantic-skip.

/**
 * Detects SQL-injection-prone template-literal calls to database entry
 * methods. Fires when a backtick template-literal containing `${...}`
 * interpolation is passed to `.rpc()`, `.execute()`, `.query()`,
 * `.$queryRawUnsafe()`, `.$executeRawUnsafe()`, or `.raw()` — the
 * canonical Supabase, Prisma-raw, and knex/mysql2/mongoose/sequelize
 * shape that splices user input directly into SQL text, bypassing
 * parameterization.
 *
 * Emits a CRITICAL finding per match with rule-id `SQLI-TMPL-NNN`,
 * OWASP A03:2021 mapping, and CWE-89 (SQL Injection). Introduced in
 * v0.15.2 Item-2 after the Round-2 external review. Extended in
 * v0.15.3 (C-001 + M-001) to close the Prisma-blind-spot surfaced
 * by Round-3: the sink-list now covers Prisma's `$queryRawUnsafe` /
 * `$executeRawUnsafe` and the shared `.raw()` method across knex,
 * mysql2, mongoose, sequelize. The safe Prisma sibling `$queryRaw`
 * (tagged-template shape) is deliberately NOT in the sink-list —
 * the Unsafe-vs-Safe distinction is load-bearing for trust and
 * firing on the safe variant would be a credibility-breaking
 * false-positive class.
 *
 * Comment-aware via `stripComments`
 * (`packages/scanners/src/ast/page-context.ts`) — the same reuse-path
 * Item-1 established. Database calls appearing inside line- or
 * block-comments are correctly skipped.
 *
 * Detection strategy is a regex-forward plus balanced-paren scan with
 * string-aware skipping:
 *   1. `/\.(rpc|execute|query|\$queryRawUnsafe|\$executeRawUnsafe|raw)\s*\(/g` locates candidate call-sites
 *   2. from the opening `(`, a depth-tracking scan walks forward until
 *      the balanced closing `)`, stepping over double/single-quoted
 *      strings and nested template-literals without letting their
 *      parens affect the depth count
 *   3. while walking, any template-literal carrying at least one
 *      `${...}` interpolation flips the TP flag — that is the emit
 *      condition
 *
 * Known limitations:
 *   - Plain string-concat SQL (`db.query("SELECT … " + id)`) is handled
 *     by the existing `sql-concat-checker` scanner, not this one. The
 *     Edge-static-literal-concat canary confirms no double-emission.
 *   - Non-SQL `.query()` / `.execute()` call-sites (rare in modern JS
 *     ecosystems outside DB drivers) fire on template-interpolation
 *     regardless. Acceptable tradeoff — the critical-severity signal
 *     is information-rich even when the DB-context is implicit.
 */

const CALL_SITE_REGEX = /\.(rpc|execute|query|\$queryRawUnsafe|\$executeRawUnsafe|raw)\s*\(/g;

const DEFAULT_IGNORE = ['node_modules', 'dist', '.next', '.git', 'coverage', 'build', 'out', '.turbo'];

function findLineNumber(content: string, matchIndex: number): number {
  return content.slice(0, matchIndex).split('\n').length;
}

/**
 * v0.17.5 F1.1 — detect when the first argument to a `.rpc()` /
 * `.query()` / `.execute()` call site is a function expression
 * (handler shape). When true, the entire arg span is a function body
 * and any template-literals nested inside it are NOT SQL — they are
 * URLs, log strings, formatted messages, etc. inside an unrelated
 * handler.
 *
 * The dominant FP class observed in the 2026-04-29 dogfood-scan was
 * tRPC procedure builders:
 *
 *   protectedProcedure
 *     .input(z.object({ ... }))
 *     .query(async (opts) => {
 *       const data = await fetch(`https://api.../${opts.input.x}`)  // template inside handler!
 *     })
 *
 * The scanner saw `.query(` then walked the WHOLE arg span (the entire
 * handler body) and found the fetch-URL template-literal — emitting a
 * spurious CRITICAL CWE-89. With this filter the scanner short-circuits
 * before scanning the handler body.
 *
 * Returns true if the first argument is one of:
 *   - `async (...)` / `async function ...`
 *   - `function ...` / `function* ...`
 *   - arrow function: `(...)`-balanced followed by `=>` (with optional
 *     `: TypeAnnotation` between close-paren and `=>`)
 */
function firstArgIsFunctionExpression(content: string, openIdx: number): boolean {
  let i = openIdx + 1;
  const n = content.length;
  while (i < n && /\s/.test(content[i])) i++;
  if (i >= n) return false;

  // 1) `async` keyword (covers `async (...)`, `async function`, `async ()=>`)
  if (content.slice(i, i + 5) === 'async' && /[\s(]/.test(content[i + 5] ?? '')) {
    return true;
  }

  // 2) `function` keyword (covers `function ...` and generator `function*`)
  if (content.slice(i, i + 8) === 'function' && /[\s(*]/.test(content[i + 8] ?? '')) {
    return true;
  }

  // 3) Arrow function with parameter list: `(...)` followed by `=>`
  //    (optionally with `: ReturnType` between close-paren and `=>`).
  if (content[i] === '(') {
    let j = i;
    let depth = 0;
    const limit = Math.min(n, i + 500);
    while (j < limit) {
      const ch = content[j];

      // Skip strings inside the param list (default-value strings).
      if (ch === '"' || ch === "'" || ch === '`') {
        const quote = ch;
        j++;
        while (j < limit && content[j] !== quote) {
          if (content[j] === '\\') { j += 2; continue; }
          j++;
        }
        j++;
        continue;
      }

      if (ch === '(') depth++;
      else if (ch === ')') {
        depth--;
        if (depth === 0) {
          // Found the matching close-paren. Check for `=>`, optionally
          // preceded by a `: ReturnType` annotation.
          let k = j + 1;
          while (k < limit && /\s/.test(content[k])) k++;
          if (content[k] === '=' && content[k + 1] === '>') return true;
          if (content[k] === ':') {
            // Skip type annotation up to the arrow or a body-start char.
            let m = k + 1;
            while (m < limit && m < k + 200) {
              if (content[m] === '=' && content[m + 1] === '>') return true;
              if (content[m] === '{' || content[m] === ';') return false;
              m++;
            }
          }
          return false;
        }
      }
      j++;
    }
  }

  return false;
}

/**
 * Walk forward from the opening `(` (position `openIdx`) to the
 * balanced closing `)`, skipping over quoted strings and template
 * literals. While walking, note whether any template-literal carried
 * at least one `${...}` interpolation. Returns `{ found, endIdx }`.
 */
function scanArgSpanForTemplateInterp(
  content: string,
  openIdx: number,
): { found: boolean; endIdx: number } {
  const n = content.length;
  let i = openIdx + 1;
  let depth = 1;
  let found = false;

  while (i < n && depth > 0) {
    const c = content[i];

    if (c === '"' || c === "'") {
      const quote = c;
      i++;
      while (i < n && content[i] !== quote) {
        if (content[i] === '\\') { i += 2; continue; }
        i++;
      }
      i++;
      continue;
    }

    if (c === '`') {
      // v0.17.5 F1.2 — tagged-template detection. A tag function preceding
      // the backtick (`sql\`...\``, `Prisma.sql\`...\``, `String.raw\`...\``,
      // `db.sql\`...\``, etc.) handles parameterization in its tag callback,
      // so the template is NOT raw SQL. The grammar for a tagged template
      // requires the tag identifier to be IMMEDIATELY adjacent to the
      // backtick (no whitespace), so a single look-back at content[i-1]
      // reliably distinguishes:
      //   - `db.execute(\`...\${x}\`)`   → prevChar `(` → UNTAGGED → SQLi candidate
      //   - `db.execute(sql\`...\${x}\`)` → prevChar `l` → tagged → safe, skip
      //   - `someFunc()\`tagged\``        → prevChar `)` → tagged → safe, skip
      const prevChar = i > 0 ? content[i - 1] : '';
      const isTagged = /[A-Za-z0-9_$)\]]/.test(prevChar);
      i++;
      let hasInterp = false;
      while (i < n && content[i] !== '`') {
        if (content[i] === '\\') { i += 2; continue; }
        if (content[i] === '$' && content[i + 1] === '{') {
          hasInterp = true;
          i += 2;
          let braceDepth = 1;
          while (i < n && braceDepth > 0) {
            if (content[i] === '{') braceDepth++;
            else if (content[i] === '}') braceDepth--;
            i++;
          }
          continue;
        }
        i++;
      }
      i++;
      if (hasInterp && !isTagged) found = true;
      continue;
    }

    if (c === '(') depth++;
    else if (c === ')') {
      depth--;
      if (depth === 0) return { found, endIdx: i };
    }
    i++;
  }
  return { found, endIdx: i };
}

export const templateSqlCheckerScanner: Scanner = {
  name: 'template-sql-checker',
  description: 'Detects template-literal SQL passed to rpc/execute/query/$queryRawUnsafe/$executeRawUnsafe/raw calls (CWE-89). Comment-aware via stripComments.',
  category: 'security',

  async isAvailable(_projectPath: string): Promise<boolean> {
    return true;
  },

  async scan(projectPath: string, config: AegisConfig): Promise<ScanResult> {
    const start = Date.now();
    const findings: Finding[] = [];
    let idCounter = 1;

    const ignore = [...new Set([...DEFAULT_IGNORE, ...(config.ignore ?? [])])];
    const files = walkFiles(projectPath, ignore, ['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs']);

    for (const file of files) {
      if (isTestFile(file)) continue;

      const raw = readFileSafe(file);
      if (!raw) continue;

      const sanitized = stripComments(raw);
      const re = new RegExp(CALL_SITE_REGEX.source, CALL_SITE_REGEX.flags);
      let match: RegExpExecArray | null;
      while ((match = re.exec(sanitized)) !== null) {
        const openIdx = match.index + match[0].length - 1;

        // v0.17.5 F1.1 — handler-shape filter. When the first argument
        // is a function expression (async / function / arrow), the
        // entire arg-span is a handler body — any template-literal
        // inside it is NOT SQL but rather URL strings, log messages,
        // or other unrelated formatting. Closes the dominant FP class
        // surfaced by the 2026-04-29 dogfood-scan (tRPC procedure
        // builders triggered CRITICAL on every `.query(async (opts) =>
        // {...})` call). The scanner still fires on `.rpc('name',
        // { q: \`...\${x}\` })` and other non-handler shapes — only
        // function-expression first-args are short-circuited.
        if (firstArgIsFunctionExpression(sanitized, openIdx)) {
          const { endIdx: skipEnd } = scanArgSpanForTemplateInterp(sanitized, openIdx);
          re.lastIndex = skipEnd + 1;
          continue;
        }

        const { found, endIdx } = scanArgSpanForTemplateInterp(sanitized, openIdx);
        if (!found) {
          re.lastIndex = endIdx + 1;
          continue;
        }

        const methodName = match[1];
        findings.push({
          id: `SQLI-TMPL-${String(idCounter++).padStart(3, '0')}`,
          scanner: 'template-sql-checker',
          severity: 'critical',
          category: 'security',
          title: `Template-literal SQL with interpolation passed to .${methodName}()`,
          description:
            `A backtick template-literal carrying a \${} interpolation is passed `
            + `to .${methodName}(), which splices untrusted values directly into the `
            + `SQL text. This is the canonical SQL-injection shape — an attacker `
            + `who controls the interpolated expression can alter query structure, `
            + `exfiltrate data, or perform destructive writes. Parameterized queries `
            + `bind values after the query plan is fixed and are safe.`,
          file,
          line: findLineNumber(sanitized, match.index),
          owasp: 'A03:2021',
          cwe: 89,
          fix: {
            description:
              `Replace the template-literal with a parameterized call. For Supabase, `
              + `pass a typed-RPC argument object so the server binds values; for raw `
              + `drivers, use the driver's parameter-binding API ($1, $2 for pg; ? for `
              + `mysql2). Never build SQL strings via template interpolation or concat.`,
            code: `// Safe (Supabase):\nawait supabase.rpc('get_user_by_id', { user_id: id });\n\n// Safe (pg):\nawait pool.query('SELECT * FROM users WHERE id = $1', [id]);`,
            links: [
              'https://cwe.mitre.org/data/definitions/89.html',
              'https://owasp.org/Top10/A03_2021-Injection/',
            ],
          },
        });
        re.lastIndex = endIdx + 1;
      }
    }

    return {
      scanner: 'template-sql-checker',
      category: 'security',
      findings,
      duration: Date.now() - start,
      available: true,
    };
  },
};
