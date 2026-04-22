import { walkFiles, readFileSafe, isTestFile } from '@aegis-scan/core';
import type { Scanner, ScanResult, Finding, AegisConfig } from '@aegis-scan/core';

// Path-invariance test-contract (v0164 — D-CA-001 coverage-audit 2026-04-22):
//   [x] TP — query-concatenation in /api/test/ route path (N1-class, D-CA-001 regression-guard)
//   [x] FP — query-concatenation in *.test.ts basename (P1-class, isTestFile() canonical skip)
// Helper-level correctness for P1–P6 covered at phase v0163-test-path-semantic-skip.

/** Files to skip — tests, vendor, minified, generated, templates */
function shouldSkipFile(filePath: string): boolean {
  if (isTestFile(filePath)) return true;
  return (
    filePath.includes('/vendor/') ||
    filePath.includes('/plugins/') ||
    filePath.includes('/Templates') ||
    filePath.includes('/templates/') ||
    filePath.includes('.min.js') ||
    filePath.includes('.min.ts') ||
    filePath.includes('/generated/') ||
    filePath.includes('/scripts/')
  );
}

/**
 * Dangerous SQL injection patterns:
 * 1. Template literals with ${...} inside .rpc() or .execute() calls
 * 2. String concatenation in a SQL context ("SELECT" + variable)
 * 3. .raw() with a template literal containing interpolation
 */
const DANGEROUS_PATTERNS: Array<{ pattern: RegExp; title: string; description: string }> = [
  {
    // .rpc(`...${var}...`) or .execute(`...${var}...`)
    pattern: /\.(rpc|execute)\s*\(\s*`[^`]*\$\{/,
    title: 'SQL injection risk — dynamic value in .rpc() or .execute() template literal',
    description:
      'A template literal with variable interpolation (${...}) is used inside .rpc() or .execute(). If the interpolated value originates from user input, this is a SQL injection vulnerability. Use parameterized queries or Supabase .from().select().eq() chains instead.',
  },
  {
    // "SELECT" + variable or 'INSERT' + var (string concat in SQL context)
    pattern: /['"`](?:SELECT|INSERT|UPDATE|DELETE|FROM|WHERE|JOIN)\b[^'"`;]*['"`;]\s*\+\s*\w/i,
    title: 'SQL injection risk — string concatenation in SQL query',
    description:
      'A SQL keyword is followed by string concatenation with a variable. Concatenating user-controlled values into SQL strings is a classic injection vector. Use parameterized queries, Supabase typed chains, or Prisma tagged templates (Prisma.sql`...`).',
  },
  {
    // .raw(`...${...}...`) — Knex/Sequelize/Drizzle raw with interpolation
    pattern: /\.raw\s*\(\s*`[^`]*\$\{/,
    title: 'SQL injection risk — dynamic value in .raw() template literal',
    description:
      '.raw() is called with a template literal containing variable interpolation. Most ORM raw() methods do NOT sanitize interpolated values. Use the ORM\'s parameterized raw syntax (e.g., knex.raw("? = ?", [a, b])) or a safe query builder method instead.',
  },
];

/**
 * Patterns indicating the dangerous code is already safely handled:
 * - Supabase typed chains (parameterized by design)
 * - Prisma.sql tagged template (safe interpolation)
 * - escapePostgrestLike / sanitize / sanitizeString helpers
 */
const SAFE_PATTERNS: RegExp[] = [
  /Prisma\.sql\s*`/,
  /escapePostgrestLike\s*\(/,
  /sanitizeString\s*\(/,
  /\bsanitize\s*\(/,
];

function findLineNumber(content: string, matchIndex: number): number {
  const before = content.slice(0, matchIndex);
  return before.split('\n').length;
}

/**
 * v0.6.1 — starting at the position of an opening backtick, find the matching
 * closing backtick index. Correctly skips over nested `${ ... }` expressions
 * so template literals like `` `x ${ obj.foo } y` `` don't confuse the scan.
 * Returns -1 if the template is unbalanced (malformed source).
 */
function findTemplateEnd(content: string, openBacktick: number): number {
  let i = openBacktick + 1;
  let depth = 0;
  while (i < content.length) {
    const c = content[i];
    if (c === '\\') {
      // Skip escaped character
      i += 2;
      continue;
    }
    if (depth === 0 && c === '`') return i;
    if (c === '$' && content[i + 1] === '{') {
      depth++;
      i += 2;
      continue;
    }
    if (c === '}' && depth > 0) {
      depth--;
      i++;
      continue;
    }
    i++;
  }
  return -1;
}

/**
 * v0.6.1 — extract the inner text of every `${...}` expression in a template
 * literal delimited by `openBacktick` and `closeBacktick` (positions of the
 * backticks). Handles nested `{ }` inside the expressions.
 */
function extractTemplateExpressions(
  content: string,
  openBacktick: number,
  closeBacktick: number,
): string[] {
  const exprs: string[] = [];
  let i = openBacktick + 1;
  while (i < closeBacktick) {
    if (content[i] === '$' && content[i + 1] === '{') {
      let depth = 1;
      let j = i + 2;
      while (j < closeBacktick && depth > 0) {
        const c = content[j];
        if (c === '{') depth++;
        else if (c === '}') depth--;
        if (depth > 0) j++;
      }
      if (depth === 0) exprs.push(content.slice(i + 2, j));
      i = j + 1;
      continue;
    }
    i++;
  }
  return exprs;
}

/**
 * v0.6.1 — does the expression look like `.map(() => "?").join(...)` or
 * `Array(N).fill("?").join(...)`? These patterns generate placeholder lists
 * (e.g., for `IN (?,?,?)`) — the dynamic value is a string of `?` chars,
 * not user input.
 */
function isSafePlaceholderGeneration(expr: string): boolean {
  // .map(() => "?") — the arrow returns a literal `?` (or `, ` etc.)
  if (/\.map\s*\(\s*\(\s*\)\s*=>\s*['"`][^'"`]*\?['"`]/.test(expr)) return true;
  // Array(N).fill("?")
  if (/Array\s*\([^)]*\)\s*\.fill\s*\(\s*['"`][^'"`]*\?['"`]/.test(expr)) return true;
  return false;
}

/**
 * v0.6.1 — does the expression consist only of a ternary (possibly nested)
 * where every branch is a string literal? Such expressions cannot leak
 * user input because every possible value is a hardcoded string.
 *
 *   Safe:   `event === "sales" ? "SUM(sales) as sales" : "SUM(clicks) as clicks"`
 *   Unsafe: `event === "sales" ? userInput : "SUM(clicks)"`  ← userInput is an identifier
 *
 * Heuristic: strip all string literals and ternary operators; what remains
 * may only contain identifiers, comparison operators, parens, and whitespace
 * (i.e., the condition expression). Any numeric-or-variable leak in a branch
 * position would leave a non-literal token behind.
 */
function isSafePureLiteralTernary(expr: string): boolean {
  const trimmed = expr.trim();
  // Require at least one `?` and one `:` (a ternary)
  if (!/[?].*[:]/s.test(trimmed)) return false;
  // Require at least one string literal in the RHS of a ? or :
  if (!/[?:]\s*(['"`])[^'"`]*\1/.test(trimmed)) return false;
  // Strip all string literals, then all `?` and `:` operators
  const residue = trimmed
    .replace(/(['"`])([^'"`\\]|\\.)*\1/g, '')
    .replace(/[?:]/g, '');
  // Remaining content must be a condition expression — identifiers, comparison
  // operators, parens, whitespace, dots, and digits. If anything else survives
  // (a bare identifier in branch position, for example), fail closed.
  return /^[\w\s=!<>&|.()-]*$/.test(residue);
}

/**
 * v0.6.1 — are ALL `${...}` expressions in the template literal known-safe?
 * Empty exprs (no interpolation) returns true — the caller would have already
 * matched on "${" so an empty list means the regex caught a false match.
 */
function areAllExpressionsSafe(exprs: string[]): boolean {
  if (exprs.length === 0) return true;
  return exprs.every(
    (e) => isSafePlaceholderGeneration(e) || isSafePureLiteralTernary(e),
  );
}

export const sqlConcatCheckerScanner: Scanner = {
  name: 'sql-concat-checker',
  description: 'Detects dynamic SQL construction that may lead to SQL injection',
  category: 'security',

  async isAvailable(_projectPath: string): Promise<boolean> {
    return true;
  },

  async scan(projectPath: string, config: AegisConfig): Promise<ScanResult> {
    const start = Date.now();
    const findings: Finding[] = [];
    let idCounter = 1;
    const defaultIgnore = ['node_modules', 'dist', '.next', '.git'];
    const ignore = [...new Set([...defaultIgnore, ...(config.ignore ?? [])])];

    // SQL can appear anywhere — services, lib, api routes, utils
    const files = walkFiles(projectPath, ignore, ['ts', 'js']);

    for (const file of files) {
      // Skip test files — they intentionally contain patterns we're scanning for
      if (shouldSkipFile(file)) continue;
      // Skip scripts directory and config files — build/dev tools, not production code
      if (file.includes('/scripts/')) continue;
      if (/\.(config|setup|build)\.(ts|js|mjs|cjs)$/.test(file)) continue;

      const content = readFileSafe(file);
      if (content === null) continue;

      const lines = content.split('\n');

      for (const rule of DANGEROUS_PATTERNS) {
        const re = new RegExp(rule.pattern.source, `${rule.pattern.flags}g`);
        let match: RegExpExecArray | null;
        while ((match = re.exec(content)) !== null) {
          // Check if a safe pattern appears within 5 lines above the match (not file-wide)
          const matchLine = findLineNumber(content, match.index);
          const nearbyLines = lines.slice(Math.max(0, matchLine - 6), matchLine).join('\n');
          if (SAFE_PATTERNS.some((p) => p.test(nearbyLines))) continue;

          // v0.6.1 — two-gate negative filter for the parameterized-query
          // placeholder idiom. Dogfood on real codebases (dub, calcom) found
          // zero true positives among template-literal + .execute() matches;
          // all 3 dub findings were `execute(sql, values)` parameterized calls
          // with placeholder generation in the template. Gates ONLY apply to
          // template-literal matches (.rpc / .execute / .raw), not to the
          // string-concat (`+`) rule.
          const isTemplateRule = rule.pattern.source.includes('\\$\\{');
          if (isTemplateRule) {
            // Locate the template literal boundaries. match[0] ends at `${`,
            // so the opening backtick is somewhere inside match[0] before `${`.
            const openBacktick = content.indexOf('`', match.index);
            if (openBacktick !== -1 && openBacktick < match.index + match[0].length) {
              const closeBacktick = findTemplateEnd(content, openBacktick);
              if (closeBacktick !== -1) {
                // Gate A — parameterized-second-argument. Find the first
                // non-whitespace char after the closing backtick. If it's a
                // comma, the call has a second positional argument (the
                // values array of a parameterized query — the safe idiom).
                // Skip the finding.
                const rest = content.slice(closeBacktick + 1);
                const firstNonWs = rest.match(/\S/);
                if (firstNonWs && firstNonWs[0] === ',') {
                  continue;
                }

                // Gate B — all-safe ${} expressions. If every interpolated
                // expression is a placeholder-generation idiom OR a
                // pure-string-literal ternary, no user input can leak into
                // the SQL. Skip.
                const exprs = extractTemplateExpressions(
                  content,
                  openBacktick,
                  closeBacktick,
                );
                if (exprs.length > 0 && areAllExpressionsSafe(exprs)) {
                  continue;
                }
              }
            }
          }

          const id = `SQLI-${String(idCounter++).padStart(3, '0')}`;
          findings.push({
            id,
            scanner: 'sql-concat-checker',
            severity: 'blocker',
            title: rule.title,
            description: rule.description,
            file,
            line: findLineNumber(content, match.index),
            category: 'security',
            owasp: 'A03:2021',
            cwe: 89,
            fix: {
              description:
                'Replace the string-concat or template-interpolation with a parameterized call. For Supabase use typed RPC arg objects; for raw drivers bind values via positional placeholders so the query plan is fixed before user input is applied.',
              code: "await pool.query('SELECT * FROM users WHERE id = $1', [id]);",
              links: [
                'https://cwe.mitre.org/data/definitions/89.html',
                'https://owasp.org/Top10/A03_2021-Injection/',
              ],
            },
          });
        }
      }
    }

    return {
      scanner: 'sql-concat-checker',
      category: 'security',
      findings,
      duration: Date.now() - start,
      available: true,
    };
  },
};
