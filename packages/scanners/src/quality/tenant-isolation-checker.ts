import ts from 'typescript';
import { walkFiles, readFileSafe } from '@aegis-scan/core';
import type { Scanner, ScanResult, Finding, AegisConfig } from '@aegis-scan/core';
import { parseFile, getLineNumber, walkAst } from '../ast/parser.js';

/**
 * Tenant Isolation Checker — detects multi-tenant database queries
 * missing a tenant-boundary filter, risking cross-tenant data leaks.
 *
 * v0.10 rewrite (Cluster C + Z2):
 *   - AST-based detection. Closes Z2 (`.from(` regex matching inside
 *     comments / docstrings produced spurious CWE-639 findings).
 *   - Prisma query-method support. Closes D8 (Prisma codebases had
 *     0% coverage — the prior regex matched Supabase `.from(` only).
 *   - Expanded discriminant list: tenant_id, tenantId, workspaceId,
 *     teamId, orgId, organizationId. Closes D6 / D7 FPs that would
 *     have arisen as soon as Prisma support was added.
 *   - Activation gate widened: scan if ANY discriminant literal OR
 *     Prisma / Supabase client usage is present in the project.
 *
 * OWASP A01:2021 — Broken Access Control
 * CWE-639 — Authorization Bypass Through User-Controlled Key
 */

/** Tenant-boundary discriminant column / property names recognised.
 *  Each entry is treated as an equivalent multi-tenancy marker. */
const TENANT_DISCRIMINANTS: readonly string[] = [
  'tenant_id',
  'tenantId',
  'workspaceId',
  'teamId',
  'orgId',
  'organizationId',
];

const DISCRIMINANT_RE = new RegExp(
  TENANT_DISCRIMINANTS.map((d) => `\\b${d}\\b`).join('|'),
);

/** Prisma client usage signal — import or method-call chain. */
const PRISMA_SIGNAL = /\bfrom\s+['"]@prisma\/client['"]|prisma\s*\.\s*\w+\s*\.\s*(?:find|create|update|delete|upsert)/;

/** Supabase client usage signal. */
const SUPABASE_SIGNAL = /\bfrom\s+['"]@supabase\/|createClient\s*\(|supabase\s*\.\s*(?:from|rpc)\s*\(/;

function shouldSkipFile(filePath: string): boolean {
  return (
    /\.(test|spec)\.(ts|js|tsx|jsx)$/.test(filePath) ||
    filePath.includes('__tests__/') ||
    filePath.includes('__mocks__/') ||
    filePath.includes('/test/') ||
    filePath.includes('/tests/') ||
    filePath.includes('/vendor/') ||
    filePath.includes('.min.js') ||
    filePath.includes('/generated/') ||
    filePath.includes('/scripts/') ||
    filePath.includes('/cron/') ||
    filePath.includes('/webhooks/')
  );
}

/** Prisma method calls that read or mutate records. */
const PRISMA_METHODS = new Set([
  'findFirst',
  'findUnique',
  'findMany',
  'create',
  'createMany',
  'update',
  'updateMany',
  'upsert',
  'delete',
  'deleteMany',
  'count',
  'aggregate',
  'groupBy',
]);

/** Does an AST node look like `prisma.<model>.<method>(...)` ? */
function asPrismaCall(node: ts.CallExpression): {
  method: string;
  firstArg: ts.Expression | undefined;
} | null {
  if (!ts.isPropertyAccessExpression(node.expression)) return null;
  const method = node.expression.name.text;
  if (!PRISMA_METHODS.has(method)) return null;
  // expression shape: prisma.<model>.<method>
  const modelExpr = node.expression.expression;
  if (!ts.isPropertyAccessExpression(modelExpr)) return null;
  const root = modelExpr.expression;
  if (!ts.isIdentifier(root)) return null;
  // Accept prisma, db, ctx.prisma, tx — common aliases. Conservative:
  // require the root identifier to resemble a prisma client.
  const rootName = root.text;
  if (!/^(?:prisma|db|tx)$/i.test(rootName)) return null;
  return { method, firstArg: node.arguments[0] };
}

/** Does an AST node look like a Supabase `.from('table')` call, and if so,
 *  return the CallExpression that starts the chain so we can inspect the
 *  `.eq(...)` / `.filter(...)` / `.match(...)` that follows on its parents. */
function asSupabaseFromCall(node: ts.CallExpression): ts.CallExpression | null {
  if (!ts.isPropertyAccessExpression(node.expression)) return null;
  if (node.expression.name.text !== 'from') return null;
  // Accept supabase.from(...) / client.from(...) / ctx.supabase.from(...)
  // — any property-access whose property is `from`. Conservative: require
  // the node's first argument to be a string literal (table name).
  const firstArg = node.arguments[0];
  if (!firstArg) return null;
  if (
    !ts.isStringLiteral(firstArg) &&
    !ts.isNoSubstitutionTemplateLiteral(firstArg)
  ) {
    return null;
  }
  return node;
}

/** Walk up the call-chain from a Supabase `.from('x')` call. Returns true
 *  if any `.eq('<discriminant>', ...)` / `.filter('<discriminant>', ...)` /
 *  `.match({ <discriminant>: ... })` appears upstream. */
function supabaseChainHasDiscriminant(fromCall: ts.CallExpression): boolean {
  let cursor: ts.Node = fromCall;
  // Walk up through chained property-access + call expressions.
  while (cursor.parent) {
    const parent: ts.Node = cursor.parent;
    if (ts.isPropertyAccessExpression(parent) && parent.expression === cursor) {
      // e.g. `cursor.name`, continue upward.
      cursor = parent;
      continue;
    }
    if (ts.isCallExpression(parent) && parent.expression === cursor) {
      // cursor is a PropertyAccess like `.eq` etc.; parent is the call site.
      if (ts.isPropertyAccessExpression(cursor)) {
        const methodName = cursor.name.text;
        if (methodName === 'eq' || methodName === 'filter') {
          const arg0 = parent.arguments[0];
          if (
            (ts.isStringLiteral(arg0) ||
              ts.isNoSubstitutionTemplateLiteral(arg0)) &&
            TENANT_DISCRIMINANTS.includes(arg0.text)
          ) {
            return true;
          }
        }
        if (methodName === 'match') {
          const arg0 = parent.arguments[0];
          if (
            arg0 &&
            ts.isObjectLiteralExpression(arg0) &&
            objectLiteralHasDiscriminant(arg0)
          ) {
            return true;
          }
        }
      }
      cursor = parent;
      continue;
    }
    // Any other parent kind ends the chain walk.
    break;
  }
  return false;
}

/** Return true if the object-literal has a property whose key name matches
 *  any TENANT_DISCRIMINANT. Supports both identifier and string-literal keys. */
function objectLiteralHasDiscriminant(obj: ts.ObjectLiteralExpression): boolean {
  for (const prop of obj.properties) {
    if (ts.isPropertyAssignment(prop) || ts.isShorthandPropertyAssignment(prop)) {
      const name = prop.name;
      const key =
        ts.isIdentifier(name) ? name.text :
        ts.isStringLiteral(name) || ts.isNoSubstitutionTemplateLiteral(name) ? name.text :
        null;
      if (key && TENANT_DISCRIMINANTS.includes(key)) {
        return true;
      }
    }
  }
  return false;
}

/** Prisma: find the `where: { ... }` property inside the first-argument
 *  object and check its keys for a discriminant. If there is no first arg
 *  or no where-clause, treat as NO discriminant (emit). */
function prismaCallHasDiscriminant(firstArg: ts.Expression | undefined): boolean {
  if (!firstArg) return false;
  if (!ts.isObjectLiteralExpression(firstArg)) return false;
  for (const prop of firstArg.properties) {
    if (!ts.isPropertyAssignment(prop)) continue;
    const name = prop.name;
    const key =
      ts.isIdentifier(name) ? name.text :
      ts.isStringLiteral(name) || ts.isNoSubstitutionTemplateLiteral(name) ? name.text :
      null;
    // `where: { discriminant: ... }` is the canonical multi-tenant filter.
    if ((key === 'where' || key === 'data') && ts.isObjectLiteralExpression(prop.initializer)) {
      if (objectLiteralHasDiscriminant(prop.initializer)) return true;
    }
  }
  return false;
}

export const tenantIsolationCheckerScanner: Scanner = {
  name: 'tenant-isolation-checker',
  description:
    'Detects Supabase AND Prisma queries in API routes missing a tenant-boundary filter (tenant_id / workspaceId / teamId / orgId / organizationId / tenantId) — cross-tenant data leak risk',
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

    const allFiles = walkFiles(projectPath, ignore, ['ts', 'js']);

    // v0.10: widened activation gate. Scan if ANY tenant discriminant
    // literal appears in the project OR a Prisma / Supabase client is in
    // use. Skip if the project shows no multi-tenant / DB-client signal
    // to avoid bothering single-tenant utilities and CLIs.
    let activate = false;
    for (const f of allFiles) {
      const c = readFileSafe(f);
      if (c === null) continue;
      if (DISCRIMINANT_RE.test(c) || PRISMA_SIGNAL.test(c) || SUPABASE_SIGNAL.test(c)) {
        activate = true;
        break;
      }
    }
    if (!activate) {
      return {
        scanner: 'tenant-isolation-checker',
        category: 'security',
        findings,
        duration: Date.now() - start,
        available: true,
      };
    }

    for (const file of allFiles) {
      if (shouldSkipFile(file)) continue;

      const isRouteFile = /route\.(ts|js)$/.test(file);
      if (!isRouteFile) continue;

      const content = readFileSafe(file);
      if (content === null) continue;

      // Explicit opt-out — the Spa-App / Sonnenhof family of helpers own
      // tenant filtering internally.
      if (/secureApiRouteWithTenant/.test(content)) continue;

      // AST parse once per file — ~5ms on typical route sizes.
      let sf: ts.SourceFile;
      try {
        sf = parseFile(file, content);
      } catch {
        // Malformed source — skip rather than crash the scan.
        continue;
      }

      // service_role usage (scanner still catches it here as a companion
      // to rls-bypass-checker; case-insensitive to catch env-var names).
      const serviceRoleRe = /service_role/gi;
      let srMatch: RegExpExecArray | null;
      while ((srMatch = serviceRoleRe.exec(content)) !== null) {
        const id = `TENANT-${String(idCounter++).padStart(3, '0')}`;
        findings.push({
          id,
          scanner: 'tenant-isolation-checker',
          severity: 'critical',
          title: 'Service role key used in route — bypasses all RLS policies',
          description:
            'The service_role key bypasses Row Level Security entirely. If used in an API route without extremely careful manual filtering, any user can access data from any tenant. Use the anon/user key with RLS policies, or add explicit tenant_id filtering with secureApiRouteWithTenant.',
          file,
          line: getLineNumber(sf, srMatch.index),
          category: 'security',
          owasp: 'A01:2021',
          cwe: 639,
        });
      }

      // AST walk: find every Supabase `.from(<literal>)` and every
      // recognised Prisma method call. For each, check whether a tenant
      // discriminant is present in the chain / where-clause.
      walkAst(sf, (node) => {
        if (!ts.isCallExpression(node)) return;

        const fromCall = asSupabaseFromCall(node);
        if (fromCall) {
          if (supabaseChainHasDiscriminant(fromCall)) return;
          const id = `TENANT-${String(idCounter++).padStart(3, '0')}`;
          findings.push({
            id,
            scanner: 'tenant-isolation-checker',
            severity: 'high',
            title:
              'Supabase query missing tenant-boundary filter — cross-tenant data leak possible',
            description:
              'A Supabase .from() query in an API route has no .eq/.filter/.match on any known tenant-boundary discriminant (tenant_id / tenantId / workspaceId / teamId / orgId / organizationId). In a multi-tenant application every database query must filter by the tenant boundary to prevent cross-tenant leaks. Add .eq(\'tenant_id\', context.tenantId), use secureApiRouteWithTenant, or pick the convention matching the codebase.',
            file,
            line: getLineNumber(sf, fromCall.getStart(sf)),
            category: 'security',
            owasp: 'A01:2021',
            cwe: 639,
          });
          return;
        }

        const prisma = asPrismaCall(node);
        if (prisma) {
          if (prismaCallHasDiscriminant(prisma.firstArg)) return;
          const id = `TENANT-${String(idCounter++).padStart(3, '0')}`;
          findings.push({
            id,
            scanner: 'tenant-isolation-checker',
            severity: 'high',
            title:
              'Prisma query missing tenant-boundary filter — cross-tenant data leak possible',
            description:
              `A Prisma ${prisma.method}() call in an API route has no tenant discriminant in its where clause. Add workspaceId / teamId / orgId / organizationId / tenantId / tenant_id matching the project's multi-tenancy convention, or scope the query to the caller's tenant at the DB layer via row-level security. This emission is AST-based, so prose mentions of the terms in comments do not false-trigger.`,
            file,
            line: getLineNumber(sf, node.getStart(sf)),
            category: 'security',
            owasp: 'A01:2021',
            cwe: 639,
          });
        }
      });
    }

    return {
      scanner: 'tenant-isolation-checker',
      category: 'security',
      findings,
      duration: Date.now() - start,
      available: true,
    };
  },
};
