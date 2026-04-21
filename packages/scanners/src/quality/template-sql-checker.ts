import { walkFiles, readFileSafe } from '@aegis-scan/core';
import type { Scanner, ScanResult, Finding, AegisConfig } from '@aegis-scan/core';
import { stripComments } from '../ast/page-context.js';

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

function isTestFile(filePath: string): boolean {
  return /\.(test|spec)\.(ts|js|tsx|jsx|mjs|cjs)$/.test(filePath)
    || filePath.includes('__tests__/')
    || filePath.includes('__mocks__/')
    || filePath.includes('/test/')
    || filePath.includes('/tests/');
}

function findLineNumber(content: string, matchIndex: number): number {
  return content.slice(0, matchIndex).split('\n').length;
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
      if (hasInterp) found = true;
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
