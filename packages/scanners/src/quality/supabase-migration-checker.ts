import { walkFiles, readFileSafe, isTestFile } from '@aegis-scan/core';
import type { Scanner, ScanResult, Finding, AegisConfig } from '@aegis-scan/core';

/**
 * Supabase Migration Checker — static analysis of `*.sql` migration files.
 *
 * Audits the SQL layer that AEGIS's TypeScript-oriented scanners cannot see.
 * Closes the class of vulnerability surfaced by the Hundementor 2026-04-29
 * audit (21 SECURITY DEFINER RPCs accepting `p_user_id` without an internal
 * `auth.uid()` check; CWE-863 IDOR exploitable via /rest/v1/rpc/<name> by
 * any authenticated user).
 *
 * Mirrors the rule-set of upstream Supabase Splinter (specifically the
 * `0028_anon_security_definer_function_executable` and
 * `0029_authenticated_security_definer_function_executable` family) plus
 * AEGIS-specific extensions for argument-shape patterns Splinter does not
 * inspect (Splinter is privilege-graph-aware but argument-blind).
 *
 * Rules:
 *   - SBM-001 definer-userid-no-guard       — CWE-863, OWASP A01
 *   - SBM-002 definer-resource-no-guard     — CWE-639, OWASP A01
 *   - SBM-003 definer-no-search-path        — CWE-426, OWASP A01
 *   - SBM-004 definer-dynamic-sql           — CWE-89,  OWASP A03
 *   - SBM-005 rls-policy-always-true        — CWE-285, OWASP A01
 *
 * Reference: ../../../../docs/security/supabase-migration-rules.md (vendored
 * Splinter mapping at packages/rules/supabase/RULES.md once v2 lands).
 */

const MIGRATION_PATH_PATTERNS = [
  '/supabase/migrations/',
  '/db/migrations/',
  '/migrations/sql/',
];

function isMigrationFile(filePath: string): boolean {
  if (!filePath.endsWith('.sql')) return false;
  if (isTestFile(filePath)) return false;
  return MIGRATION_PATH_PATTERNS.some((p) => filePath.includes(p));
}

/** Strip line comments (-- …) and block comments (/* … *\/) for parsing.
 *  Comments inside dollar-quoted bodies are preserved (they're code, not SQL comments). */
function stripSqlComments(source: string): string {
  let out = '';
  let i = 0;
  const n = source.length;
  while (i < n) {
    const c = source[i];
    const c2 = source[i + 1];

    // dollar-quoted string — copy through verbatim, comments inside are code
    if (c === '$') {
      const tagMatch = /^\$(\w*)\$/.exec(source.slice(i));
      if (tagMatch) {
        const tag = tagMatch[0];
        const close = source.indexOf(tag, i + tag.length);
        if (close !== -1) {
          out += source.slice(i, close + tag.length);
          i = close + tag.length;
          continue;
        }
      }
    }

    // line comment
    if (c === '-' && c2 === '-') {
      const eol = source.indexOf('\n', i);
      out += eol === -1 ? '' : '\n';
      i = eol === -1 ? n : eol + 1;
      continue;
    }

    // block comment
    if (c === '/' && c2 === '*') {
      const close = source.indexOf('*/', i + 2);
      i = close === -1 ? n : close + 2;
      continue;
    }

    // single-quoted string — copy through (avoid mistaking `--` inside)
    if (c === "'") {
      out += c;
      i++;
      while (i < n && source[i] !== "'") {
        if (source[i] === '\\' && i + 1 < n) { out += source[i] + source[i + 1]; i += 2; continue; }
        out += source[i];
        i++;
      }
      if (i < n) { out += source[i]; i++; }
      continue;
    }

    out += c;
    i++;
  }
  return out;
}

interface ParsedFunction {
  name: string;            // schema.fn or fn
  signature: string;       // raw signature including args
  args: string;            // arg list raw
  modifiers: string;       // text between signature `)` and body `$tag$`
  body: string;            // between $tag$...$tag$
  startOffset: number;     // index of CREATE in original (un-stripped) source
}

/** Locate every `CREATE [OR REPLACE] FUNCTION ... AS $tag$ ... $tag$` block.
 *  Returns offsets into the ORIGINAL source so line-number lookups stay accurate. */
function parseCreateFunctions(originalSource: string, strippedSource: string): ParsedFunction[] {
  const out: ParsedFunction[] = [];
  const headRe = /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+([\w.]+(?:\.\w+)?)\s*\(/gi;

  let m: RegExpExecArray | null;
  while ((m = headRe.exec(strippedSource)) !== null) {
    const fnName = m[1];
    const argStart = m.index + m[0].length;

    // walk balanced parens to find arg-list end
    let depth = 1;
    let i = argStart;
    while (i < strippedSource.length && depth > 0) {
      const c = strippedSource[i];
      if (c === '(') depth++;
      else if (c === ')') depth--;
      else if (c === "'") {
        i++;
        while (i < strippedSource.length && strippedSource[i] !== "'") i++;
      }
      i++;
    }
    if (depth !== 0) continue;
    const argEnd = i - 1;
    const args = strippedSource.slice(argStart, argEnd);

    // find body via $tag$
    const tail = strippedSource.slice(i);
    const tagMatch = /\bAS\s+(\$\w*\$)/i.exec(tail);
    if (!tagMatch) continue;
    const tag = tagMatch[1];
    const bodyStart = i + tagMatch.index + tagMatch[0].length;
    const bodyEnd = strippedSource.indexOf(tag, bodyStart);
    if (bodyEnd === -1) continue;

    const modifiers = strippedSource.slice(i + 1, i + tagMatch.index);
    const body = strippedSource.slice(bodyStart, bodyEnd);

    // map back to original source offset for accurate line numbers
    out.push({
      name: fnName,
      signature: strippedSource.slice(m.index, argEnd + 1),
      args,
      modifiers,
      body,
      startOffset: m.index,
    });

    headRe.lastIndex = bodyEnd + tag.length;
  }

  return out;
}

function lineFromOffset(source: string, offset: number): number {
  return source.slice(0, offset).split('\n').length;
}

const USERID_ARG_PATTERN = /\bp_user_id\b|\buser_id_param\b|\b_user_id\s+uuid\b|\bcaller_id\b/i;
const RESOURCE_ARG_PATTERN = /\bp_(?:dog|post|event|comment|message|doc|document|folder|badge|reward|item|order|invoice|file|task)_id\b/i;
const SECURITY_DEFINER_PATTERN = /\bSECURITY\s+DEFINER\b/i;
const SET_SEARCH_PATH_PATTERN = /\bSET\s+search_path\b/i;
const AUTH_UID_REFERENCE = /\bauth\.uid\(\)/i;
const AEGIS_GUARD_REFERENCE = /\b_aegis_authorize_user\b/i;
const OWNERSHIP_CHECK_PATTERN = /\b(?:user_id|owner_id)\s*=\s*(?:auth\.uid\(\)|p_user_id|v_caller)/i;
const DYNAMIC_SQL_PATTERN = /\bEXECUTE\s+(?:format\s*\(|['"`]?[^;]*\|\|)/i;
const RAW_TABLE_NAME_FORMAT = /\bformat\s*\(\s*['"][^'"]*%I[^'"]*['"]/i;

interface MigrationCheck {
  id: string;
  title: string;
  description: string;
  severity: Finding['severity'];
  cwe: number;
  owasp?: string;
  fix: string;
}

const RULES: Record<string, MigrationCheck> = {
  'SBM-001': {
    id: 'SBM-001',
    title: 'SECURITY DEFINER function with p_user_id parameter lacks auth.uid() guard',
    description:
      'A SECURITY DEFINER function in a Supabase migration accepts a `p_user_id` (or equivalent) parameter and is reachable via /rest/v1/rpc/<name>, but its body does not verify that p_user_id matches auth.uid(). Any authenticated user can call this RPC with a different user_id and act on that user\'s data — this is CWE-863 (Incorrect Authorization) / IDOR.',
    severity: 'critical',
    cwe: 863,
    owasp: 'A01:2021 — Broken Access Control',
    fix:
      'Add the canonical AEGIS guard as the first statement in the function body:\n' +
      '  PERFORM public._aegis_authorize_user(p_user_id);\n' +
      'Then `REVOKE ALL ON FUNCTION public.<name>(<args>) FROM PUBLIC, anon` and `GRANT EXECUTE ... TO authenticated, service_role`. The helper definition lives at packages/rules/supabase/aegis-rls-helpers.sql.',
  },
  'SBM-002': {
    id: 'SBM-002',
    title: 'SECURITY DEFINER function with resource-id parameter lacks ownership check',
    description:
      'A SECURITY DEFINER function accepts a resource-ID parameter (p_dog_id, p_post_id, etc.) but its body does not verify the caller owns the resource (no WHERE … user_id = auth.uid() check, no _aegis_authorize_user call). This is CWE-639 (Authorization Bypass Through User-Controlled Key) / IDOR.',
    severity: 'high',
    cwe: 639,
    owasp: 'A01:2021 — Broken Access Control',
    fix:
      'Either (a) switch the function to SECURITY INVOKER so RLS on the underlying tables filters out non-owned rows automatically, or (b) add an explicit ownership check at the top of the body, e.g.:\n' +
      '  IF NOT EXISTS (SELECT 1 FROM public.dogs WHERE id = p_dog_id AND user_id = auth.uid()) THEN\n' +
      '    RAISE EXCEPTION \'AEGIS-AUTHZ: caller does not own dog %\', p_dog_id USING ERRCODE = \'42501\';\n' +
      '  END IF;',
  },
  'SBM-003': {
    id: 'SBM-003',
    title: 'SECURITY DEFINER function without SET search_path is search-path-injection-vulnerable',
    description:
      'A SECURITY DEFINER function does not declare SET search_path. The function inherits the caller\'s search_path; an attacker who can prepend their own schema to the search_path can shadow built-in tables/functions used inside the body and hijack execution. CWE-426 (Untrusted Search Path).',
    severity: 'medium',
    cwe: 426,
    owasp: 'A01:2021 — Broken Access Control',
    fix:
      'Declare an explicit search_path immediately after SECURITY DEFINER:\n' +
      '  SET search_path = public, pg_temp\n' +
      'For functions that should resolve nothing implicitly, use `SET search_path = \'\'` and qualify every reference (public.profiles, etc.).',
  },
  'SBM-004': {
    id: 'SBM-004',
    title: 'SECURITY DEFINER function uses dynamic SQL with parameter interpolation',
    description:
      'A SECURITY DEFINER function builds SQL via EXECUTE format() / concatenation that includes a function parameter. Combined with SECURITY DEFINER\'s elevated privileges, this is CWE-89 (SQL Injection) and the impact is the function-owner\'s full privilege set. The Hundementor 2026-04-29 audit found a `restore_deleted(p_table_name text, p_id uuid)` of exactly this shape.',
    severity: 'critical',
    cwe: 89,
    owasp: 'A03:2021 — Injection',
    fix:
      'Either (a) eliminate the dynamic SQL by enumerating accepted table/column names with a CASE/IF dispatch and hard-coded EXECUTE branches, or (b) use format() with %I (identifier-quoted, safe for table/column names) AND restrict the function to service_role only via REVOKE FROM anon, authenticated. Never accept a user-controlled table name as input from a client-callable function.',
  },
  'SBM-005': {
    id: 'SBM-005',
    title: 'RLS policy with WITH CHECK (true) for non-SELECT command bypasses row-level security',
    description:
      'An RLS policy allows INSERT/UPDATE/DELETE for the anon or authenticated role with WITH CHECK (true). The expression evaluates true for every row, which is functionally equivalent to disabled RLS for that command. CWE-285 (Improper Authorization).',
    severity: 'high',
    cwe: 285,
    owasp: 'A01:2021 — Broken Access Control',
    fix:
      'Replace `WITH CHECK (true)` with a predicate that bounds inserts/updates to the calling user, e.g. `WITH CHECK (auth.uid() = user_id)`. For genuinely public sign-up forms (newsletter), tighten to a shape check: `WITH CHECK (email IS NOT NULL AND length(email) BETWEEN 5 AND 254 AND email ~ \'^[^@]+@[^@]+\\.[^@]+$\')`.',
  },
};

function buildFinding(
  rule: MigrationCheck,
  file: string,
  line: number,
  detail: string,
  idCounter: number,
): Finding {
  return {
    id: `${rule.id}-${idCounter}`,
    scanner: 'supabase-migration-checker',
    category: 'security',
    severity: rule.severity,
    title: rule.title,
    description: `${detail}\n\n${rule.description}`,
    file,
    line,
    cwe: rule.cwe,
    owasp: rule.owasp,
    fix: { description: rule.fix },
    reference:
      'https://supabase.com/docs/guides/database/database-linter and packages/skills/skills/defensive/aegis-native/rls-defense/SKILL.md (Section 4a)',
  };
}

function checkFunction(
  fn: ParsedFunction,
  originalSource: string,
  file: string,
  emit: (rule: MigrationCheck, line: number, detail: string) => void,
): void {
  const isDefiner = SECURITY_DEFINER_PATTERN.test(fn.modifiers);
  if (!isDefiner) return;

  const startLine = lineFromOffset(originalSource, fn.startOffset);
  const hasGuard = AUTH_UID_REFERENCE.test(fn.body) || AEGIS_GUARD_REFERENCE.test(fn.body);
  const hasOwnership = OWNERSHIP_CHECK_PATTERN.test(fn.body);

  // SBM-001 — p_user_id without auth.uid() guard
  if (USERID_ARG_PATTERN.test(fn.args) && !hasGuard) {
    emit(
      RULES['SBM-001'],
      startLine,
      `Function \`${fn.name}\` is SECURITY DEFINER, accepts a user-id parameter (\`${fn.args.match(USERID_ARG_PATTERN)?.[0] ?? 'user-id'}\`), and the body does not call \`auth.uid()\` or \`_aegis_authorize_user\`.`,
    );
  }

  // SBM-002 — resource-id without ownership check  (only fires when no userid-guard issue, to avoid double-emit)
  if (
    RESOURCE_ARG_PATTERN.test(fn.args) &&
    !USERID_ARG_PATTERN.test(fn.args) &&
    !hasGuard &&
    !hasOwnership
  ) {
    emit(
      RULES['SBM-002'],
      startLine,
      `Function \`${fn.name}\` is SECURITY DEFINER, accepts a resource-id parameter (\`${fn.args.match(RESOURCE_ARG_PATTERN)?.[0] ?? 'resource-id'}\`), and the body neither calls \`auth.uid()\` nor verifies ownership against \`user_id = auth.uid()\`.`,
    );
  }

  // SBM-003 — no SET search_path
  if (!SET_SEARCH_PATH_PATTERN.test(fn.modifiers)) {
    emit(
      RULES['SBM-003'],
      startLine,
      `Function \`${fn.name}\` is SECURITY DEFINER but does not declare \`SET search_path\` in its modifier list.`,
    );
  }

  // SBM-004 — dynamic SQL with parameter interpolation. Catches both
  //   direct:   EXECUTE format('...', p_table_name, ...)
  //   indirect: v_sql := format(...); EXECUTE v_sql;
  //   concat:   EXECUTE 'UPDATE ' || p_table_name || ' ...'
  const hasExecute = /\bEXECUTE\b/i.test(fn.body);
  if (hasExecute) {
    const argNames = (fn.args.match(/\bp_\w+/gi) ?? []).map((s) => s.toLowerCase());
    if (argNames.length > 0) {
      // collect every format(...) call body in the function
      const formatCallBodies: string[] = [];
      const formatRe = /\bformat\s*\(/gi;
      let fm: RegExpExecArray | null;
      while ((fm = formatRe.exec(fn.body)) !== null) {
        let depth = 1;
        let i = fm.index + fm[0].length;
        while (i < fn.body.length && depth > 0) {
          const ch = fn.body[i];
          if (ch === '(') depth++;
          else if (ch === ')') depth--;
          else if (ch === "'") {
            i++;
            while (i < fn.body.length && fn.body[i] !== "'") i++;
          }
          i++;
        }
        formatCallBodies.push(fn.body.slice(fm.index, i));
      }

      const formatBlob = formatCallBodies.join('\n').toLowerCase();
      const concatRegion =
        fn.body.match(/EXECUTE[\s\S]{0,500}?;/i)?.[0]?.toLowerCase() ?? '';

      const paramInFormat = argNames.some((p) => formatBlob.includes(p));
      const paramInConcat =
        concatRegion.includes('||') && argNames.some((p) => concatRegion.includes(p));
      const formatHasIdentifier = formatCallBodies.some((b) => /%I\b/.test(b));

      if (paramInFormat || paramInConcat || (formatCallBodies.length > 0 && formatHasIdentifier)) {
        emit(
          RULES['SBM-004'],
          startLine,
          `Function \`${fn.name}\` is SECURITY DEFINER and constructs dynamic SQL via EXECUTE / format(); at least one input parameter is interpolated.`,
        );
      }
    }
  }
}

/** RLS policy parser — finds `CREATE POLICY ... FOR (INSERT|UPDATE|DELETE) ... TO (anon|authenticated)
 *  ... WITH CHECK (true)`. Single-statement scope; we don't track ALTER POLICY. */
const POLICY_PATTERN =
  /CREATE\s+POLICY\s+["']?[^"']+["']?\s+ON\s+[\w."]+\s+(?:AS\s+(?:PERMISSIVE|RESTRICTIVE)\s+)?FOR\s+(INSERT|UPDATE|DELETE|ALL)\s+(?:TO\s+([\w,\s]+?)\s+)?(?:USING[\s\S]+?)?WITH\s+CHECK\s*\(\s*true\s*\)/gi;

function checkPolicies(
  strippedSource: string,
  originalSource: string,
  file: string,
  emit: (rule: MigrationCheck, line: number, detail: string) => void,
): void {
  let m: RegExpExecArray | null;
  while ((m = POLICY_PATTERN.exec(strippedSource)) !== null) {
    const cmd = m[1].toUpperCase();
    const roles = (m[2] ?? '').toLowerCase();
    if (cmd === 'SELECT') continue; // explicitly excluded by Splinter rule 0024

    // require at least one client role
    const hasClientRole = /\b(anon|authenticated|public)\b/.test(roles) || roles.trim() === '';
    if (!hasClientRole) continue;

    const line = lineFromOffset(originalSource, m.index);
    emit(
      RULES['SBM-005'],
      line,
      `Policy on ${m[0].match(/ON\s+([\w."]+)/i)?.[1] ?? 'table'} for ${cmd} grants \`WITH CHECK (true)\` to ${roles || 'PUBLIC'}.`,
    );
  }
}

const DEFAULT_IGNORE = ['node_modules', 'dist', '.next', '.git', 'coverage', 'build', 'out', '.turbo'];

export const supabaseMigrationCheckerScanner: Scanner = {
  name: 'supabase-migration-checker',
  description:
    'Static analysis of Supabase SQL migration files. Catches SECURITY DEFINER + p_user_id IDOR (CWE-863), missing search_path (CWE-426), dynamic-SQL with parameter interpolation (CWE-89), and permissive RLS WITH CHECK (true) policies (CWE-285).',
  category: 'security',

  async isAvailable(_projectPath: string): Promise<boolean> {
    return true;
  },

  async scan(projectPath: string, config: AegisConfig): Promise<ScanResult> {
    const start = Date.now();
    const findings: Finding[] = [];
    let idCounter = 1;

    const ignore = [...new Set([...DEFAULT_IGNORE, ...(config.ignore ?? [])])];
    const files = walkFiles(projectPath, ignore, ['sql']).filter(isMigrationFile);

    for (const file of files) {
      const original = readFileSafe(file);
      if (original === null) continue;

      const stripped = stripSqlComments(original);
      const fns = parseCreateFunctions(original, stripped);

      const emit = (rule: MigrationCheck, line: number, detail: string) => {
        findings.push(buildFinding(rule, file, line, detail, idCounter++));
      };

      for (const fn of fns) {
        checkFunction(fn, original, file, emit);
      }
      checkPolicies(stripped, original, file, emit);
    }

    return {
      scanner: 'supabase-migration-checker',
      category: 'security',
      findings,
      duration: Date.now() - start,
      available: true,
    };
  },
};
