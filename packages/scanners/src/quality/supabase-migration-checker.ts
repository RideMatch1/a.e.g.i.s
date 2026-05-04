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
  // ── F-SUPABASE-MIGRATION-EXT-1 — global SQL-line-level rules ───────
  'SBM-006': {
    id: 'SBM-006',
    title: 'CREATE TABLE in public schema without ENABLE ROW LEVEL SECURITY',
    description:
      'A migration creates a table in the public schema but does not follow it with `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` in the same file. Supabase exposes the public schema via PostgREST/REST API, and an authenticated user can read every row of an RLS-less table. CWE-285 (Improper Authorization).',
    severity: 'high',
    cwe: 285,
    owasp: 'A01:2021 — Broken Access Control',
    fix:
      'Immediately after the CREATE TABLE statement, add `ALTER TABLE public.<name> ENABLE ROW LEVEL SECURITY;` and at least one CREATE POLICY scoped to the calling user (`USING (user_id = auth.uid())` or equivalent). When RLS is enabled but no policy applies, every read/write is denied — that is the safer default.',
  },
  'SBM-007': {
    id: 'SBM-007',
    title: 'ENABLE ROW LEVEL SECURITY without any matching CREATE POLICY (silent deny-all)',
    description:
      'A migration enables RLS on a table but defines no policies for that table in the same file. The result is silent deny-all (every read/write fails with an empty result). The operator typically panic-fixes with `WITH CHECK (true)` or by disabling RLS — both downgrade security. CWE-285 (Improper Authorization).',
    severity: 'medium',
    cwe: 285,
    owasp: 'A01:2021 — Broken Access Control',
    fix:
      'Add at least one CREATE POLICY for the table in the same migration. For owner-scoped data: `CREATE POLICY "owner_select" ON public.<name> FOR SELECT TO authenticated USING (user_id = auth.uid());` and a matching mutation policy. For tenant-scoped data: include a tenant-id predicate joined to the JWT claim.',
  },
  'SBM-008': {
    id: 'SBM-008',
    title: 'SECURITY DEFINER function granted EXECUTE to PUBLIC/anon without prior REVOKE',
    description:
      'A SECURITY DEFINER function is granted EXECUTE to PUBLIC or anon without a preceding `REVOKE EXECUTE ... FROM PUBLIC`. The function inherits the definer\'s elevated privileges (often supabase_admin), and any anonymous request to `/rest/v1/rpc/<name>` triggers the body. CWE-269 (Improper Privilege Management).',
    severity: 'high',
    cwe: 269,
    owasp: 'A01:2021 — Broken Access Control',
    fix:
      'Use the canonical safe pattern: `REVOKE ALL ON FUNCTION public.<name>(<args>) FROM PUBLIC, anon;` and `GRANT EXECUTE ON FUNCTION public.<name>(<args>) TO authenticated, service_role;`. If the function legitimately must accept anonymous callers (sign-up flow, public-availability check), keep it but limit the body to authorized side effects only.',
  },
  'SBM-009': {
    id: 'SBM-009',
    title: 'Custom role granted SUPERUSER or BYPASSRLS — every RLS policy bypassed',
    description:
      'A migration creates or alters a role with `SUPERUSER` or `BYPASSRLS`. Either attribute on a non-managed role lets that role skip every RLS policy on every table — RLS becomes advisory rather than enforced. In Supabase, the only role that should carry BYPASSRLS is the platform-managed `service_role`; SUPERUSER should never appear in app migrations. CWE-269 (Improper Privilege Management).',
    severity: 'critical',
    cwe: 269,
    owasp: 'A01:2021 — Broken Access Control',
    fix:
      'Remove the SUPERUSER / BYPASSRLS attribute. If the role legitimately needs cross-row access for a specific operation, route that operation through a SECURITY DEFINER function that performs the access with its own privileges and is callable only by `service_role` (`REVOKE FROM authenticated; GRANT EXECUTE TO service_role`).',
  },
  'SBM-010': {
    id: 'SBM-010',
    title: 'Anonymous role granted SELECT/INSERT/UPDATE/DELETE on table without RLS',
    description:
      'A migration grants a CRUD privilege to the anon role on a public-schema table that has no `ENABLE ROW LEVEL SECURITY`. Every anonymous request to `/rest/v1/<table>` reads or writes every row in the table. CWE-285 (Improper Authorization).',
    severity: 'high',
    cwe: 285,
    owasp: 'A01:2021 — Broken Access Control',
    fix:
      'Either revoke the grant (`REVOKE SELECT ON public.<name> FROM anon;`) or enable RLS on the table and add a CREATE POLICY for the anon role that scopes reads/writes appropriately (typically empty for SELECT, or a public-safety filter for write — e.g., a contact-form sign-up).',
  },
  'SBM-011': {
    id: 'SBM-011',
    title: 'CREATE TABLE in public schema without REVOKE CREATE ON SCHEMA public FROM PUBLIC',
    description:
      'A migration creates objects in the public schema but does not REVOKE CREATE on that schema from PUBLIC. The default Postgres behaviour grants schema-level CREATE to PUBLIC, which means any role can create tables, views, and functions in the public schema — including objects that shadow built-in names and hijack `search_path`-driven resolution. CWE-732 (Incorrect Permission Assignment for Critical Resource).',
    severity: 'medium',
    cwe: 732,
    owasp: 'A05:2021 — Security Misconfiguration',
    fix:
      'Add `REVOKE CREATE ON SCHEMA public FROM PUBLIC;` once in the project (typically the first migration). Subsequent migrations remain free to CREATE objects under whichever owning role they run as. This single REVOKE prevents the most common search-path-injection footgun.',
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

// ── F-SUPABASE-MIGRATION-EXT-1 — global SQL-line-level patterns ───────

/** CREATE TABLE [IF NOT EXISTS] [public.]<name> — captures the table
 *  identifier (group 1) and is line-anchorable via index/lineFromOffset. */
const CREATE_TABLE_RE = /\bCREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?["']?(\w+)["']?\s*\(/gi;

const ENABLE_RLS_RE = /\bALTER\s+TABLE\s+(?:public\.)?["']?(\w+)["']?\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY\b/gi;

const CREATE_POLICY_FOR_TABLE_RE = /\bCREATE\s+POLICY\s+["']?[^"']+["']?\s+ON\s+(?:public\.)?["']?(\w+)["']?\b/gi;

/** GRANT EXECUTE ON FUNCTION <ident-with-args-or-not> TO PUBLIC|anon. */
const GRANT_EXEC_PUBLIC_ANON_RE =
  /\bGRANT\s+EXECUTE\s+ON\s+FUNCTION\s+([\w."]+(?:\s*\([^)]*\))?)\s+TO\s+(public|anon)\b/gi;

/** REVOKE [ALL|EXECUTE] ON FUNCTION <ident> FROM PUBLIC|anon. */
const REVOKE_FUNCTION_FROM_PUBLIC_ANON_RE =
  /\bREVOKE\s+(?:ALL|EXECUTE)\s+ON\s+FUNCTION\s+([\w."]+(?:\s*\([^)]*\))?)\s+FROM\s+[^;]*\b(public|anon)\b/gi;

const SUPERUSER_RE = /\bSUPERUSER\b/g;
const BYPASSRLS_RE = /\bBYPASSRLS\b/g;

/** GRANT <SELECT|INSERT|UPDATE|DELETE> [, ...] ON [public.]<table> TO anon. */
const GRANT_DML_TO_ANON_RE =
  /\bGRANT\s+(?:[A-Z]+\s*,\s*)*?(?:SELECT|INSERT|UPDATE|DELETE|ALL)(?:\s*,\s*[A-Z]+)*\s+ON\s+(?:TABLE\s+)?(?:public\.)?["']?(\w+)["']?\s+TO\s+(?:[\w,\s]*\b)?anon\b/gi;

const REVOKE_CREATE_SCHEMA_PUBLIC_RE = /\bREVOKE\s+CREATE\s+ON\s+SCHEMA\s+public\s+FROM\s+public\b/i;

/**
 * F-SUPABASE-MIGRATION-EXT-1 global checks (SBM-006 to SBM-011).
 *
 * Operates on the stripped-of-comments source of a single migration file,
 * with one accumulated cross-file flag (any-file-has-REVOKE-CREATE-ON-
 * SCHEMA-public) supplied by the caller.
 *
 * Per-file rule-set:
 *   SBM-006 — CREATE TABLE public.x without ENABLE ROW LEVEL SECURITY
 *   SBM-007 — ENABLE RLS without any CREATE POLICY for that table
 *   SBM-008 — SECURITY DEFINER + GRANT EXECUTE TO PUBLIC|anon without
 *             a REVOKE on the same function
 *   SBM-009 — SUPERUSER / BYPASSRLS keyword present
 *   SBM-010 — GRANT (SELECT|INSERT|UPDATE|DELETE|ALL) ON public.x TO
 *             anon without ENABLE ROW LEVEL SECURITY for that table
 *   SBM-011 — file has CREATE TABLE public.x but no REVOKE CREATE ON
 *             SCHEMA public FROM PUBLIC anywhere in the project
 */
function checkGlobalSql(
  strippedSource: string,
  originalSource: string,
  file: string,
  projectHasRevokeCreateSchema: boolean,
  emit: (rule: MigrationCheck, line: number, detail: string) => void,
): void {
  // Build per-file maps.
  const tablesCreated = new Map<string, number>(); // name -> first-line
  const tablesWithRls = new Set<string>();
  const tablesWithPolicy = new Set<string>();

  resetGlobal(CREATE_TABLE_RE);
  for (let m: RegExpExecArray | null; (m = CREATE_TABLE_RE.exec(strippedSource)) !== null; ) {
    const name = m[1].toLowerCase();
    if (!tablesCreated.has(name)) {
      tablesCreated.set(name, lineFromOffset(originalSource, m.index));
    }
  }

  resetGlobal(ENABLE_RLS_RE);
  for (let m: RegExpExecArray | null; (m = ENABLE_RLS_RE.exec(strippedSource)) !== null; ) {
    tablesWithRls.add(m[1].toLowerCase());
  }

  resetGlobal(CREATE_POLICY_FOR_TABLE_RE);
  for (let m: RegExpExecArray | null; (m = CREATE_POLICY_FOR_TABLE_RE.exec(strippedSource)) !== null; ) {
    tablesWithPolicy.add(m[1].toLowerCase());
  }

  // SBM-006 — CREATE TABLE without ENABLE RLS in same file.
  for (const [name, line] of tablesCreated) {
    if (tablesWithRls.has(name)) continue;
    emit(
      RULES['SBM-006'],
      line,
      `CREATE TABLE public.${name} has no ALTER TABLE ... ENABLE ROW LEVEL SECURITY in this migration. PostgREST exposes the public schema; without RLS every authenticated user can SELECT every row.`,
    );
  }

  // SBM-007 — ENABLE RLS without any CREATE POLICY.
  for (const name of tablesWithRls) {
    if (tablesWithPolicy.has(name)) continue;
    // Find the line of the ENABLE RLS for the per-table emit.
    resetGlobal(ENABLE_RLS_RE);
    let line = 1;
    for (let m: RegExpExecArray | null; (m = ENABLE_RLS_RE.exec(strippedSource)) !== null; ) {
      if (m[1].toLowerCase() === name) {
        line = lineFromOffset(originalSource, m.index);
        break;
      }
    }
    emit(
      RULES['SBM-007'],
      line,
      `ALTER TABLE public.${name} ENABLE ROW LEVEL SECURITY has no matching CREATE POLICY in this migration — silent deny-all.`,
    );
  }

  // SBM-008 — SECURITY DEFINER + GRANT EXECUTE TO PUBLIC/anon without REVOKE.
  // Build (function-ident-no-args -> seen-revoke) map.
  const fnsRevoked = new Set<string>();
  resetGlobal(REVOKE_FUNCTION_FROM_PUBLIC_ANON_RE);
  for (
    let m: RegExpExecArray | null;
    (m = REVOKE_FUNCTION_FROM_PUBLIC_ANON_RE.exec(strippedSource)) !== null;
  ) {
    const fn = m[1].split('(')[0].toLowerCase();
    fnsRevoked.add(fn);
  }
  if (SECURITY_DEFINER_PATTERN.test(strippedSource)) {
    resetGlobal(GRANT_EXEC_PUBLIC_ANON_RE);
    for (
      let m: RegExpExecArray | null;
      (m = GRANT_EXEC_PUBLIC_ANON_RE.exec(strippedSource)) !== null;
    ) {
      const fn = m[1].split('(')[0].toLowerCase();
      if (fnsRevoked.has(fn)) continue;
      emit(
        RULES['SBM-008'],
        lineFromOffset(originalSource, m.index),
        `Function ${m[1]} granted EXECUTE to ${m[2]} without prior REVOKE FROM PUBLIC, anon. Combined with the SECURITY DEFINER body in this migration, anonymous callers gain definer-level access.`,
      );
    }
  }

  // SBM-009 — SUPERUSER / BYPASSRLS keyword.
  for (const re of [SUPERUSER_RE, BYPASSRLS_RE]) {
    resetGlobal(re);
    let m = re.exec(strippedSource);
    if (m) {
      emit(
        RULES['SBM-009'],
        lineFromOffset(originalSource, m.index),
        `Migration declares ${m[0]} on a custom role. RLS is bypassed for this role on every table.`,
      );
    }
  }

  // SBM-010 — GRANT DML TO anon without RLS.
  resetGlobal(GRANT_DML_TO_ANON_RE);
  for (let m: RegExpExecArray | null; (m = GRANT_DML_TO_ANON_RE.exec(strippedSource)) !== null; ) {
    const tableName = m[1].toLowerCase();
    if (tablesWithRls.has(tableName)) continue;
    emit(
      RULES['SBM-010'],
      lineFromOffset(originalSource, m.index),
      `GRANT to anon on public.${tableName} without ENABLE ROW LEVEL SECURITY — anonymous requests act on every row.`,
    );
  }

  // SBM-011 — CREATE TABLE public + no REVOKE CREATE ON SCHEMA public FROM PUBLIC anywhere.
  if (tablesCreated.size > 0 && !projectHasRevokeCreateSchema) {
    const firstTable = tablesCreated.entries().next().value;
    if (firstTable) {
      emit(
        RULES['SBM-011'],
        firstTable[1],
        `Project creates public-schema tables but no migration revokes CREATE on schema public from PUBLIC. Default Postgres grants schema-level CREATE to PUBLIC, allowing search-path-injection setups.`,
      );
    }
  }
}

function resetGlobal(re: RegExp): void {
  re.lastIndex = 0;
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

    // F-SUPABASE-MIGRATION-EXT-1 cross-file pre-pass: a single
    // REVOKE CREATE ON SCHEMA public FROM PUBLIC anywhere in the
    // project suppresses SBM-011 across all files. Without this
    // pre-pass, every migration after the one carrying the REVOKE
    // would falsely emit SBM-011.
    let projectHasRevokeCreateSchema = false;
    for (const file of files) {
      const raw = readFileSafe(file);
      if (raw === null) continue;
      if (REVOKE_CREATE_SCHEMA_PUBLIC_RE.test(stripSqlComments(raw))) {
        projectHasRevokeCreateSchema = true;
        break;
      }
    }

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
      checkGlobalSql(stripped, original, file, projectHasRevokeCreateSchema, emit);
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
