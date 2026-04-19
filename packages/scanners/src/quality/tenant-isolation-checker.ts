import ts from 'typescript';
import { walkFiles, readFileSafe } from '@aegis-scan/core';
import type { Scanner, ScanResult, Finding, AegisConfig } from '@aegis-scan/core';
import { parseFile, getLineNumber, walkAst } from '../ast/parser.js';
import { stripComments } from '../ast/page-context.js';

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

/** Tenant-boundary discriminant column / property names recognised by
 *  default. Each entry is treated as an equivalent multi-tenancy marker.
 *
 *  v0.14 DO-3: projects using an alternative multi-tenancy model
 *  (e.g. user-scoped with `user_id`, or custom names like `account_id`)
 *  can extend this list via `aegis.config.json`:
 *
 *    "scanners": {
 *      "tenantIsolation": {
 *        "additionalBoundaryColumns": ["user_id", "account_id"]
 *      }
 *    }
 *
 *  Default semantics is MERGE — the provided columns are ADDED to this
 *  built-in list. Set `replaceBoundaryColumns: true` to use only the
 *  provided list (opt-in; useful for projects that genuinely have no
 *  tenant_id-style column and want to suppress spurious matches on
 *  FK names like `organization_id` in an unrelated table).
 */
const DEFAULT_TENANT_DISCRIMINANTS: readonly string[] = [
  'tenant_id',
  'tenantId',
  'workspaceId',
  'teamId',
  'orgId',
  'organizationId',
];

/** Strict SQL-identifier shape for user-provided column names. */
const VALID_BOUNDARY_COL_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

interface TenantIsolationConfig {
  additionalBoundaryColumns?: readonly string[];
  replaceBoundaryColumns?: boolean;
}

function readTenantConfig(config: AegisConfig): TenantIsolationConfig {
  const raw = config.scanners?.tenantIsolation;
  if (!raw || typeof raw !== 'object') return {};
  const rec = raw as Record<string, unknown>;
  const out: TenantIsolationConfig = {};
  if (Array.isArray(rec.additionalBoundaryColumns)) {
    out.additionalBoundaryColumns = rec.additionalBoundaryColumns.filter(
      (s): s is string => typeof s === 'string',
    );
  }
  if (typeof rec.replaceBoundaryColumns === 'boolean') {
    out.replaceBoundaryColumns = rec.replaceBoundaryColumns;
  }
  return out;
}

/** Resolve the effective discriminant list from config (merged by default,
 *  replaced when `replaceBoundaryColumns: true`). Invalid column names
 *  (non-identifier shape) are warn-logged and dropped, not silent-dropped
 *  — silent-drop turns config typos into mysterious FPs.
 */
function effectiveDiscriminants(config: AegisConfig): readonly string[] {
  const cfg = readTenantConfig(config);
  const additional = (cfg.additionalBoundaryColumns ?? []).filter((col) => {
    if (!VALID_BOUNDARY_COL_RE.test(col)) {
      // eslint-disable-next-line no-console
      console.warn(
        `[tenant-isolation] invalid boundary column "${col}"; dropped. ` +
          `Column names must match /^[a-zA-Z_][a-zA-Z0-9_]*$/.`,
      );
      return false;
    }
    return true;
  });
  if (cfg.replaceBoundaryColumns === true && additional.length > 0) {
    return additional;
  }
  return [...DEFAULT_TENANT_DISCRIMINANTS, ...additional];
}

function buildDiscriminantRe(cols: readonly string[]): RegExp {
  return new RegExp(cols.map((d) => `\\b${d}\\b`).join('|'));
}

/** Prisma client usage signal — import or method-call chain. */
const PRISMA_SIGNAL = /\bfrom\s+['"]@prisma\/client['"]|prisma\s*\.\s*\w+\s*\.\s*(?:find|create|update|delete|upsert)/;

/** Supabase client usage signal.
 *  v0.11.2 Part B: widened to recognise common admin-helper wrappers
 *  (createAdminSupabaseClient, createServiceRoleClient, …) so projects
 *  that only use the helper — without importing @supabase/* directly —
 *  still activate the scanner. Without this, a route file that uses
 *  `import { createAdminSupabaseClient } from '@/lib/supabase/admin'`
 *  would be silently ignored by activation. */
const SUPABASE_SIGNAL = /\bfrom\s+['"]@supabase\/|createClient\s*\(|supabase\s*\.\s*(?:from|rpc)\s*\(|\bcreate(?:Admin|ServiceRole|ServerService)(?:Supabase)?Client\b/;

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
    filePath.includes('/webhooks/') ||
    // v0.10 (dub-corpus delta): admin routes are by-design cross-tenant.
    // `requireRole('admin')` on the auth-enforcer side is the right
    // gate for those; tenant-isolation-checker would produce redundant
    // FPs on every prisma call inside them.
    filePath.includes('/admin/') ||
    filePath.includes('/_admin/')
  );
}

/** Opt-out content annotations. A route that deliberately handles
 *  cross-tenant access (support / ops tooling, admin panels implemented
 *  via content rather than URL convention) can declare intent with a
 *  JSDoc or line comment tag. */
const CROSS_TENANT_CONTENT_PATTERNS: readonly RegExp[] = [
  // Inside a block comment (`/** … @cross-tenant … */`). Prose between
  // `/**` and the tag is allowed — \s* couldn't cross non-whitespace.
  /\/\*[\s\S]*?@cross-tenant\b[\s\S]*?\*\//,
  /\/\*[\s\S]*?@admin-only\b[\s\S]*?\*\//,
  // On a single-line comment.
  /\/\/[^\n]*@cross-tenant\b/,
  /\/\/[^\n]*@admin-only\b/,
];

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
function supabaseChainHasDiscriminant(
  fromCall: ts.CallExpression,
  discriminants: readonly string[],
): boolean {
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
            discriminants.includes(arg0.text)
          ) {
            return true;
          }
        }
        if (methodName === 'match') {
          const arg0 = parent.arguments[0];
          if (
            arg0 &&
            ts.isObjectLiteralExpression(arg0) &&
            objectLiteralHasDiscriminant(arg0, discriminants)
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
 *  any discriminant in the supplied list. Supports both identifier and
 *  string-literal keys. */
function objectLiteralHasDiscriminant(
  obj: ts.ObjectLiteralExpression,
  discriminants: readonly string[],
): boolean {
  for (const prop of obj.properties) {
    if (ts.isPropertyAssignment(prop) || ts.isShorthandPropertyAssignment(prop)) {
      const name = prop.name;
      const key =
        ts.isIdentifier(name) ? name.text :
        ts.isStringLiteral(name) || ts.isNoSubstitutionTemplateLiteral(name) ? name.text :
        null;
      if (key && discriminants.includes(key)) {
        return true;
      }
    }
  }
  return false;
}

/** Prisma: find the `where: { ... }` property inside the first-argument
 *  object and check its keys for a discriminant. If there is no first arg
 *  or no where-clause, treat as NO discriminant (emit). */
function prismaCallHasDiscriminant(
  firstArg: ts.Expression | undefined,
  discriminants: readonly string[],
): boolean {
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
      if (objectLiteralHasDiscriminant(prop.initializer, discriminants)) return true;
    }
  }
  return false;
}

// ============================================================================
// v0.11.2 Part C — Scope-aware service_role suppression
//
// Flag-1 JSDoc pattern: security-critical invariants encoded in code so
// future maintainers see the pinned edge cases before touching the
// suppression logic.
// ============================================================================

/** Supabase / Prisma query methods that mutate the database. Presence of
 *  ANY such call in a route handler defeats the Part-C scoped-read
 *  suppression — a write can escape the URL-scope even when an earlier
 *  read is scoped (matrix case N-C-5, canary T13). */
const WRITE_METHODS: ReadonlySet<string> = new Set([
  'insert',
  'update',
  'delete',
  'upsert',
]);

/** Next.js App-Router route-handler export names. Each route file exports
 *  zero or more of these as async functions; Part-C analysis treats each
 *  as an independent entry point into the file and requires ALL of them
 *  to be safe-scoped before it suppresses file-level service_role findings. */
const HANDLER_EXPORT_NAMES: ReadonlySet<string> = new Set([
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'HEAD',
  'OPTIONS',
]);

/**
 * Per-handler URL-parameter binding analysis.
 *
 *   paramBindings — Declaration nodes whose runtime value IS a URL-param
 *                   string (e.g. `slug` in `const { slug } = await params`).
 *                   An `.eq(<col>, <Identifier>)` whose Identifier resolves
 *                   (by lexical scope) to one of these nodes counts as
 *                   URL-param-scoped.
 *   paramSources  — Declaration nodes whose runtime value is the `params`
 *                   object (or a projection thereof). Used as propagation
 *                   sources during fixed-point analysis: a destructure of
 *                   a source yields new paramBindings.
 */
interface UrlParamAnalysis {
  paramBindings: Set<ts.Node>;
  paramSources: Set<ts.Node>;
}

/**
 * File-level aggregate. `fileIsScoped` is the Part-C suppression gate for
 * the service_role pattern-emission loop; `handlerAnalyses` feeds the AST
 * walk for per-`.from()` URL-param recognition.
 */
interface FileScopeAnalysis {
  fileIsScoped: boolean;
  handlerAnalyses: Map<ts.FunctionLikeDeclaration, UrlParamAnalysis>;
}

/**
 * Part-C main entry — decide whether this route file qualifies for
 * service_role suppression AND build the per-handler analyses the
 * `.from()` emission path needs.
 *
 * A file qualifies iff ALL of:
 *   (1) it exports ≥1 async handler function (GET/POST/…);
 *   (2) ≥1 handler contains ≥1 `supabase.from('…')` call (evidence that
 *       the service_role usage actually flows through a scoped query —
 *       helper-only files like canary T4 keep emitting);
 *   (3) EVERY handler in the file is individually "safe-scoped":
 *         (a) every `.from(...)` chain has ≥1 `.eq(<col>, <arg>)` where
 *             <arg> is an Identifier whose nearest-scope declaration is
 *             in paramBindings (URL-param binding-origin check, NOT
 *             lexical name-match — T17 body-shadow depends on this);
 *         (b) the handler body has no write calls
 *             (.insert/.update/.delete/.upsert on a `.from(…)` chain).
 *
 * Matrix canary coverage — each negative case pinned explicitly under
 * `packages/benchmark/canary-fixtures/phase3-v011x-dogfood/`:
 *   - N-C-1 (T9):  service_role + no .eq()              → emit
 *   - N-C-2 (T10): .eq arg from req.body (body.slug)    → emit
 *   - N-C-3 (T11): .eq arg via helper (normalize(slug)) → emit
 *   - N-C-4 (T12): .eq arg is hardcoded literal         → emit
 *   - N-C-5 (T13): chained writes after scoped read     → emit
 *   - N-C-6 (T14): multiple .from(), second unscoped    → emit
 *   - N-C-10(T17): body-shadow same-name (binding-origin
 *                  rejects `slug` whose init is await req.json()) → emit
 *
 * Out-of-scope (conservative emit, deferred to v0.12):
 *   - N-C-7: RLS-permissive table policy (migration-file scan)
 *   - N-C-8: compound-route strict all-segments matching
 *   - N-C-9: query-builder variable with mid-chain conditional scoping
 *   - ctx-style signature `(req, ctx: { params: ... })` — current impl
 *     only recognises `{ params }` / `{ params: { … } }` destructure in
 *     the 2nd parameter. Ctx-style routes see conservative emit.
 */
function analyzeFileForUrlScope(sf: ts.SourceFile): FileScopeAnalysis {
  const handlers = findRouteHandlers(sf);
  const handlerAnalyses = new Map<ts.FunctionLikeDeclaration, UrlParamAnalysis>();
  if (handlers.length === 0) {
    return { fileIsScoped: false, handlerAnalyses };
  }

  let anyHandlerHasFrom = false;
  let allHandlersScoped = true;

  for (const fn of handlers) {
    const analysis = collectUrlParamBindings(fn);
    handlerAnalyses.set(fn, analysis);

    const fromCalls = collectFromCallsInFunction(fn);
    const hasWrites = functionHasWriteCalls(fn);

    if (fromCalls.length > 0) anyHandlerHasFrom = true;
    if (hasWrites) {
      allHandlersScoped = false;
      continue;
    }
    // A handler with no .from() and no writes is neutral: doesn't
    // prove scoping but doesn't defeat it either.
    for (const fromCall of fromCalls) {
      if (!fromChainHasUrlParamEq(fromCall, analysis, fn)) {
        allHandlersScoped = false;
        break;
      }
    }
  }

  const fileIsScoped = anyHandlerHasFrom && allHandlersScoped;
  return { fileIsScoped, handlerAnalyses };
}

/** Collect top-level exported async functions whose name is a recognised
 *  Next.js route-handler verb. Supports both `export async function GET()`
 *  and `export const GET = async (…) => {}`. */
function findRouteHandlers(sf: ts.SourceFile): ts.FunctionLikeDeclaration[] {
  const out: ts.FunctionLikeDeclaration[] = [];
  for (const stmt of sf.statements) {
    if (ts.isFunctionDeclaration(stmt)) {
      const mods = ts.canHaveModifiers(stmt) ? ts.getModifiers(stmt) : undefined;
      const isExported = mods?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ?? false;
      if (
        isExported &&
        stmt.name !== undefined &&
        HANDLER_EXPORT_NAMES.has(stmt.name.text) &&
        stmt.body !== undefined
      ) {
        out.push(stmt);
      }
      continue;
    }
    if (ts.isVariableStatement(stmt)) {
      const mods = ts.canHaveModifiers(stmt) ? ts.getModifiers(stmt) : undefined;
      const isExported = mods?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ?? false;
      if (!isExported) continue;
      for (const decl of stmt.declarationList.declarations) {
        if (!ts.isIdentifier(decl.name)) continue;
        if (!HANDLER_EXPORT_NAMES.has(decl.name.text)) continue;
        if (decl.initializer === undefined) continue;
        if (ts.isArrowFunction(decl.initializer) || ts.isFunctionExpression(decl.initializer)) {
          out.push(decl.initializer);
        }
      }
    }
  }
  return out;
}

/** Fixed-point analysis: starting from the signature's `params` binding,
 *  propagate through variable declarations until no new URL-param
 *  bindings or sources are discovered. */
function collectUrlParamBindings(fn: ts.FunctionLikeDeclaration): UrlParamAnalysis {
  const paramBindings = new Set<ts.Node>();
  const paramSources = new Set<ts.Node>();

  // --- Signature seed: only `{ params }` / `{ params: { … } }` forms ---
  const secondParam = fn.parameters[1];
  if (secondParam !== undefined && ts.isObjectBindingPattern(secondParam.name)) {
    for (const elem of secondParam.name.elements) {
      if (!ts.isBindingElement(elem)) continue;
      const propName = elem.propertyName !== undefined
        ? (ts.isIdentifier(elem.propertyName) ? elem.propertyName.text : null)
        : (ts.isIdentifier(elem.name) ? elem.name.text : null);
      if (propName !== 'params') continue;
      if (ts.isIdentifier(elem.name)) {
        // `{ params }` — elem binds the params object as a source
        paramSources.add(elem);
      } else if (ts.isObjectBindingPattern(elem.name)) {
        // `{ params: { slug, … } }` — each inner leaf is a URL-param binding
        addBindingPatternLeaves(elem.name, paramBindings);
      }
    }
  }

  // --- Body propagation: iterate VariableDeclarations until fixed point ---
  const varDecls = collectVariableDeclarations(fn);
  const maxIter = varDecls.length + 1;
  let changed = true;
  let iter = 0;
  while (changed && iter < maxIter) {
    changed = false;
    iter++;
    for (const decl of varDecls) {
      if (paramBindings.has(decl) || paramSources.has(decl)) continue;
      if (decl.initializer === undefined) continue;
      const cls = classifyInitializer(decl.initializer, paramSources, fn);
      if (cls === 'none') continue;

      if (ts.isIdentifier(decl.name)) {
        if (cls === 'source' || cls === 'await-source') {
          paramSources.add(decl);
          changed = true;
        } else if (cls === 'binding') {
          paramBindings.add(decl);
          changed = true;
        }
      } else if (
        ts.isObjectBindingPattern(decl.name) ||
        ts.isArrayBindingPattern(decl.name)
      ) {
        if (cls === 'source' || cls === 'await-source') {
          addBindingPatternLeaves(decl.name, paramBindings);
          changed = true;
        }
      }
    }
  }

  return { paramBindings, paramSources };
}

type InitClass = 'source' | 'await-source' | 'binding' | 'none';

/** Classify the initializer expression of a VariableDeclaration relative
 *  to the current set of URL-param sources.
 *
 *   'source'       — expr IS a source (e.g. `p` where p is already source)
 *   'await-source' — expr is `await <source>` or `await <source>.prop`
 *                    yielding a source object
 *   'binding'      — expr is `<source>.<key>` yielding a primitive value
 *   'none'         — no URL-param origin
 */
function classifyInitializer(
  expr: ts.Expression,
  sources: Set<ts.Node>,
  fn: ts.FunctionLikeDeclaration,
): InitClass {
  const unwrapped = unwrapExpressionWrappers(expr);

  if (ts.isAwaitExpression(unwrapped)) {
    const inner = unwrapExpressionWrappers(unwrapped.expression);
    if (ts.isIdentifier(inner) && identifierResolvesToDecl(inner, sources, fn)) {
      return 'await-source';
    }
    if (ts.isPropertyAccessExpression(inner) && propertyAccessRootResolvesToSource(inner, sources, fn)) {
      return 'await-source';
    }
    return 'none';
  }

  if (ts.isIdentifier(unwrapped)) {
    if (identifierResolvesToDecl(unwrapped, sources, fn)) return 'source';
    return 'none';
  }

  if (ts.isPropertyAccessExpression(unwrapped)) {
    if (propertyAccessRootResolvesToSource(unwrapped, sources, fn)) return 'binding';
  }

  return 'none';
}

/** Strip parens, `as`-assertions, `<T>`-assertions, and `!` non-null
 *  assertions so the core expression is visible to AST shape checks. */
function unwrapExpressionWrappers(expr: ts.Expression): ts.Expression {
  let current: ts.Expression = expr;
  // Bounded loop — pathological chains would already trip the TS parser.
  for (let i = 0; i < 16; i++) {
    if (ts.isParenthesizedExpression(current)) { current = current.expression; continue; }
    if (ts.isAsExpression(current)) { current = current.expression; continue; }
    if (ts.isTypeAssertionExpression(current)) { current = current.expression; continue; }
    if (ts.isNonNullExpression(current)) { current = current.expression; continue; }
    break;
  }
  return current;
}

/** Walk a PropertyAccess chain down to its root identifier / await expr,
 *  then check whether that root resolves (by lexical scope) to a declaration
 *  in the given target set. */
function propertyAccessRootResolvesToSource(
  node: ts.PropertyAccessExpression,
  sources: Set<ts.Node>,
  fn: ts.FunctionLikeDeclaration,
): boolean {
  let cursor: ts.Expression = node.expression;
  for (let i = 0; i < 16; i++) {
    cursor = unwrapExpressionWrappers(cursor);
    if (ts.isPropertyAccessExpression(cursor)) {
      cursor = cursor.expression;
      continue;
    }
    break;
  }
  if (ts.isIdentifier(cursor)) {
    return identifierResolvesToDecl(cursor, sources, fn);
  }
  if (ts.isAwaitExpression(cursor)) {
    const inner = unwrapExpressionWrappers(cursor.expression);
    if (ts.isIdentifier(inner)) {
      return identifierResolvesToDecl(inner, sources, fn);
    }
  }
  return false;
}

/** Lexical scope resolution: walk from `id` up through enclosing Blocks
 *  / control-flow scopes / the containing function, return true iff the
 *  nearest declaration of this name is in the target set.
 *
 *  Innermost-scope wins: a body `const { slug } = await req.json()` that
 *  shadows a signature-level URL-param binding resolves to the body
 *  declaration, NOT the signature — which correctly drops the scoping
 *  claim (T17 body-shadow). */
function identifierResolvesToDecl(
  id: ts.Identifier,
  target: Set<ts.Node>,
  fn: ts.FunctionLikeDeclaration,
): boolean {
  const name = id.text;
  const usagePos = id.getStart();

  // Collect enclosing scopes, innermost first, stopping at fn.
  const scopes: ts.Node[] = [];
  let cursor: ts.Node = id;
  while (cursor.parent !== undefined && cursor !== fn) {
    const parent = cursor.parent;
    if (
      ts.isBlock(parent) ||
      ts.isForStatement(parent) ||
      ts.isForOfStatement(parent) ||
      ts.isForInStatement(parent) ||
      ts.isCaseClause(parent) ||
      ts.isDefaultClause(parent)
    ) {
      scopes.push(parent);
    }
    if (parent === fn) break;
    cursor = parent;
  }
  scopes.push(fn);

  for (const scope of scopes) {
    const match = findDeclarationInScope(scope, name, usagePos);
    if (match !== null) return target.has(match);
  }
  return false;
}

/** Within `scope`, find the declaration of `name` that appears before
 *  `beforePos`. Returns the VariableDeclaration (for simple binds), a
 *  BindingElement (for destructures), or a ParameterDeclaration. */
function findDeclarationInScope(
  scope: ts.Node,
  name: string,
  beforePos: number,
): ts.Node | null {
  let best: ts.Node | null = null;
  let bestPos = -1;

  const considerDeclNode = (
    declNode: ts.Node,
    nameNode: ts.BindingName,
    pos: number,
    posCheck: boolean,
  ): void => {
    if (posCheck && pos >= beforePos) return;
    if (pos <= bestPos) return;
    if (ts.isIdentifier(nameNode)) {
      if (nameNode.text === name) {
        best = declNode;
        bestPos = pos;
      }
      return;
    }
    if (ts.isObjectBindingPattern(nameNode) || ts.isArrayBindingPattern(nameNode)) {
      const el = findBindingElementByName(nameNode, name);
      if (el !== null) {
        best = el;
        bestPos = pos;
      }
    }
  };

  const visit = (node: ts.Node): void => {
    // Don't descend into nested functions (they own their own scope).
    if (
      node !== scope &&
      (ts.isFunctionDeclaration(node) ||
        ts.isFunctionExpression(node) ||
        ts.isArrowFunction(node) ||
        ts.isMethodDeclaration(node) ||
        ts.isConstructorDeclaration(node))
    ) {
      return;
    }
    if (ts.isVariableDeclaration(node)) {
      considerDeclNode(node, node.name, node.getStart(), /*posCheck*/ true);
    }
    if (ts.isParameter(node)) {
      // Parameters are in-scope for the whole function body; no lexical-
      // order constraint within their own declaration.
      considerDeclNode(node, node.name, node.getStart(), /*posCheck*/ false);
    }
    ts.forEachChild(node, visit);
  };

  if (
    ts.isFunctionDeclaration(scope) ||
    ts.isFunctionExpression(scope) ||
    ts.isArrowFunction(scope) ||
    ts.isMethodDeclaration(scope) ||
    ts.isConstructorDeclaration(scope)
  ) {
    for (const p of (scope as ts.FunctionLikeDeclaration).parameters) {
      visit(p);
    }
    const body = (scope as ts.FunctionLikeDeclaration).body;
    if (body !== undefined) {
      ts.forEachChild(body, visit);
    }
  } else {
    ts.forEachChild(scope, visit);
  }

  return best;
}

/** Find the binding-element leaf whose identifier text matches `name`,
 *  recursing through nested destructure patterns. Returns that leaf's
 *  BindingElement node (so callers can use node identity in a Set). */
function findBindingElementByName(
  pattern: ts.ObjectBindingPattern | ts.ArrayBindingPattern,
  name: string,
): ts.Node | null {
  for (const el of pattern.elements) {
    if (!ts.isBindingElement(el)) continue;
    if (ts.isIdentifier(el.name)) {
      if (el.name.text === name) return el;
      continue;
    }
    if (ts.isObjectBindingPattern(el.name) || ts.isArrayBindingPattern(el.name)) {
      const nested = findBindingElementByName(el.name, name);
      if (nested !== null) return nested;
    }
  }
  return null;
}

/** Add every leaf identifier in a (possibly-nested) binding pattern to
 *  the target set. Each leaf becomes a URL-param binding. */
function addBindingPatternLeaves(
  pattern: ts.ObjectBindingPattern | ts.ArrayBindingPattern,
  out: Set<ts.Node>,
): void {
  for (const el of pattern.elements) {
    if (!ts.isBindingElement(el)) continue;
    if (ts.isIdentifier(el.name)) {
      out.add(el);
      continue;
    }
    if (ts.isObjectBindingPattern(el.name) || ts.isArrayBindingPattern(el.name)) {
      addBindingPatternLeaves(el.name, out);
    }
  }
}

/** Collect every VariableDeclaration in the handler body, skipping
 *  nested function scopes. */
function collectVariableDeclarations(fn: ts.FunctionLikeDeclaration): ts.VariableDeclaration[] {
  const out: ts.VariableDeclaration[] = [];
  const visit = (node: ts.Node): void => {
    if (
      node !== fn &&
      (ts.isFunctionDeclaration(node) ||
        ts.isFunctionExpression(node) ||
        ts.isArrowFunction(node) ||
        ts.isMethodDeclaration(node) ||
        ts.isConstructorDeclaration(node))
    ) {
      return;
    }
    if (ts.isVariableDeclaration(node)) out.push(node);
    ts.forEachChild(node, visit);
  };
  if (fn.body !== undefined) ts.forEachChild(fn.body, visit);
  return out;
}

/** Walk the call-chain up from a `.from('x')` call; return true iff any
 *  `.eq(<col>, <arg>)` or `.filter(<col>, <arg>)` arg resolves to a
 *  URL-param binding, OR `.match({ <key>: <url-param> })` object literal
 *  carries a URL-param value. Conservative: any non-Identifier arg fails. */
function fromChainHasUrlParamEq(
  fromCall: ts.CallExpression,
  analysis: UrlParamAnalysis,
  fn: ts.FunctionLikeDeclaration,
): boolean {
  let cursor: ts.Node = fromCall;
  while (cursor.parent !== undefined) {
    const parent: ts.Node = cursor.parent;
    if (ts.isPropertyAccessExpression(parent) && parent.expression === cursor) {
      cursor = parent;
      continue;
    }
    if (ts.isCallExpression(parent) && parent.expression === cursor) {
      if (ts.isPropertyAccessExpression(cursor)) {
        const method = cursor.name.text;
        if (method === 'eq' || method === 'filter') {
          const arg1 = parent.arguments[1];
          if (arg1 !== undefined && argIsUrlParamValue(arg1, analysis, fn)) return true;
        }
        if (method === 'match') {
          const arg0 = parent.arguments[0];
          if (
            arg0 !== undefined &&
            ts.isObjectLiteralExpression(arg0) &&
            matchObjectHasUrlParamValue(arg0, analysis, fn)
          ) {
            return true;
          }
        }
      }
      cursor = parent;
      continue;
    }
    break;
  }
  return false;
}

function argIsUrlParamValue(
  arg: ts.Expression,
  analysis: UrlParamAnalysis,
  fn: ts.FunctionLikeDeclaration,
): boolean {
  const unwrapped = unwrapExpressionWrappers(arg);
  if (ts.isIdentifier(unwrapped)) {
    return identifierResolvesToDecl(unwrapped, analysis.paramBindings, fn);
  }
  if (ts.isPropertyAccessExpression(unwrapped)) {
    return propertyAccessRootResolvesToSource(unwrapped, analysis.paramSources, fn);
  }
  return false;
}

function matchObjectHasUrlParamValue(
  obj: ts.ObjectLiteralExpression,
  analysis: UrlParamAnalysis,
  fn: ts.FunctionLikeDeclaration,
): boolean {
  for (const prop of obj.properties) {
    if (ts.isPropertyAssignment(prop)) {
      if (argIsUrlParamValue(prop.initializer, analysis, fn)) return true;
    } else if (ts.isShorthandPropertyAssignment(prop)) {
      if (identifierResolvesToDecl(prop.name, analysis.paramBindings, fn)) return true;
    }
  }
  return false;
}

/** All `supabase.from('…')` call-expressions inside the handler body,
 *  skipping nested functions. */
function collectFromCallsInFunction(fn: ts.FunctionLikeDeclaration): ts.CallExpression[] {
  const out: ts.CallExpression[] = [];
  const visit = (node: ts.Node): void => {
    if (
      node !== fn &&
      (ts.isFunctionDeclaration(node) ||
        ts.isFunctionExpression(node) ||
        ts.isArrowFunction(node) ||
        ts.isMethodDeclaration(node) ||
        ts.isConstructorDeclaration(node))
    ) {
      return;
    }
    if (ts.isCallExpression(node) && asSupabaseFromCall(node) !== null) {
      out.push(node);
    }
    ts.forEachChild(node, visit);
  };
  if (fn.body !== undefined) ts.forEachChild(fn.body, visit);
  return out;
}

/** Returns true iff the handler body contains a write call
 *  (`.insert/.update/.delete/.upsert`) whose chain includes a
 *  `supabase.from(<literal>)` ancestor. Narrowing prevents false positives
 *  from unrelated method names (e.g. `map.delete(key)`, `set.delete(x)`). */
function functionHasWriteCalls(fn: ts.FunctionLikeDeclaration): boolean {
  let found = false;
  const visit = (node: ts.Node): void => {
    if (found) return;
    if (
      node !== fn &&
      (ts.isFunctionDeclaration(node) ||
        ts.isFunctionExpression(node) ||
        ts.isArrowFunction(node) ||
        ts.isMethodDeclaration(node) ||
        ts.isConstructorDeclaration(node))
    ) {
      return;
    }
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const method = node.expression.name.text;
      if (WRITE_METHODS.has(method) && chainHasFromAncestor(node.expression.expression)) {
        found = true;
        return;
      }
    }
    ts.forEachChild(node, visit);
  };
  if (fn.body !== undefined) ts.forEachChild(fn.body, visit);
  return found;
}

/** Walk DOWN a property-access / call chain from `expr` looking for a
 *  `supabase.from(<literal>)` CallExpression anywhere in the chain. */
function chainHasFromAncestor(expr: ts.Expression): boolean {
  let cursor: ts.Expression = expr;
  for (let i = 0; i < 32; i++) {
    cursor = unwrapExpressionWrappers(cursor);
    if (ts.isCallExpression(cursor)) {
      if (asSupabaseFromCall(cursor) !== null) return true;
      cursor = cursor.expression;
      continue;
    }
    if (ts.isPropertyAccessExpression(cursor)) {
      cursor = cursor.expression;
      continue;
    }
    break;
  }
  return false;
}

/** Walk UP from `node` to find the nearest enclosing handler (one of the
 *  functions in the analysis map). Returns null when `node` is outside
 *  every handler (top-level / import statements / etc.). */
function findEnclosingHandler(
  node: ts.Node,
  handlerAnalyses: Map<ts.FunctionLikeDeclaration, UrlParamAnalysis>,
): ts.FunctionLikeDeclaration | null {
  let current: ts.Node | undefined = node.parent;
  while (current !== undefined) {
    if (
      (ts.isFunctionDeclaration(current) ||
        ts.isFunctionExpression(current) ||
        ts.isArrowFunction(current) ||
        ts.isMethodDeclaration(current)) &&
      handlerAnalyses.has(current as ts.FunctionLikeDeclaration)
    ) {
      return current as ts.FunctionLikeDeclaration;
    }
    current = current.parent;
  }
  return null;
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

    // v0.14 DO-3: resolve the effective discriminant list once per scan
    // (built-ins + any `additionalBoundaryColumns` from config, or the
    // replacement list when `replaceBoundaryColumns: true`). Threaded
    // through all AST helpers in place of the old module-level
    // TENANT_DISCRIMINANTS / DISCRIMINANT_RE. Default behavior without
    // config is identical to v0.13.0 (built-ins only).
    const discriminants = effectiveDiscriminants(config);
    const discriminantRe = buildDiscriminantRe(discriminants);

    const allFiles = walkFiles(projectPath, ignore, ['ts', 'js']);

    // v0.10: widened activation gate. Scan if ANY tenant discriminant
    // literal appears in the project OR a Prisma / Supabase client is in
    // use. Skip if the project shows no multi-tenant / DB-client signal
    // to avoid bothering single-tenant utilities and CLIs.
    let activate = false;
    for (const f of allFiles) {
      const c = readFileSafe(f);
      if (c === null) continue;
      if (discriminantRe.test(c) || PRISMA_SIGNAL.test(c) || SUPABASE_SIGNAL.test(c)) {
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

      // Explicit opt-out — dedicated helper family owns tenant filtering.
      if (/secureApiRouteWithTenant/.test(content)) continue;

      // Explicit opt-out via JSDoc / line-comment annotation. Routes
      // that deliberately serve cross-tenant data (support tooling,
      // admin endpoints that live outside `/admin/` by convention)
      // declare intent with `@cross-tenant` or `@admin-only`.
      if (CROSS_TENANT_CONTENT_PATTERNS.some((p) => p.test(content))) continue;

      // AST parse once per file — ~5ms on typical route sizes.
      let sf: ts.SourceFile;
      try {
        sf = parseFile(file, content);
      } catch {
        // Malformed source — skip rather than crash the scan.
        continue;
      }

      // v0.11.2 Part C: file-level URL-param scope analysis. Computed
      // once per file so both the service_role regex-emission loop and
      // the AST `.from()` walk can consult the per-handler bindings
      // without re-traversing the tree. `fileIsScoped` gates the
      // file-wide service_role suppression; `handlerAnalyses` feeds the
      // per-`.from()` URL-param recognition.
      const fileScope = analyzeFileForUrlScope(sf);

      // service_role usage detection. Scanner runs as companion to
      // rls-bypass-checker; case-insensitive to catch env-var names.
      //
      // v0.11.2 Part A (Bug X): comments describing WHY the helper is
      // used are not code usage. The original `/service_role/gi` fired
      // on prose like `// service_role required: tenants-RLS blocks anon`,
      // producing high-severity noise on every route that documented
      // its architecture decisions. `stripComments` removes line and
      // block comments while preserving line numbers and string-literal
      // content, so literal string references like `'service_role'` and
      // real env-var names like `SUPABASE_SERVICE_ROLE_KEY` still fire.
      const sanitized = stripComments(content);
      // v0.11.2 Part B (Bug Y — recall widening): the original single
      // regex `/service_role/gi` caught env-var references and literal
      // strings but NOT the dominant real-world shape where devs wrap
      // the admin-client creation in a named helper (e.g.
      // `createAdminSupabaseClient()` in the project's `lib/` tree).
      // Files using the helper with no local "service_role" mention
      // were silent-missed entirely — incentivising devs to remove
      // descriptive comments to reduce noise (signal-inversion).
      //
      // Fix: detect both shapes via a pattern set. Each pattern fires
      // independently; a file mixing helper-call AND env-var reference
      // emits twice by design (high-confidence signal).
      const SERVICE_ROLE_PATTERNS: readonly RegExp[] = [
        /service_role/gi,                                           // literal + env-var names
        /\bcreate(?:Admin|ServiceRole|ServerService)(?:Supabase)?Client\b/g, // common helper wrappers
        /\bgetServiceClient\b/g,                                    // alt helper convention
        /\bgetAdminClient\b/g,                                      // alt helper convention
      ];
      const emittedLines = new Set<number>();
      for (const pattern of SERVICE_ROLE_PATTERNS) {
        const re = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g');
        let srMatch: RegExpExecArray | null;
        while ((srMatch = re.exec(sanitized)) !== null) {
          const lineNum = getLineNumber(sf, srMatch.index);
          // Per-line dedup — avoids double-emit when helper-call and
          // env-var sit on adjacent tokens of the same line.
          if (emittedLines.has(lineNum)) continue;
          // v0.11.2 Part C: file-level scope-aware suppression. When
          // every handler in the file drives all its `.from()` chains
          // through a URL-param `.eq()` AND has no write calls, the
          // service_role usage is narrowed to the per-request URL-
          // scope and the finding is suppressed (matrix canaries
          // T7/T8/T15/T16 prove positive; T9-T14/T17 prove negatives
          // stay emitting).
          if (fileScope.fileIsScoped) continue;
          emittedLines.add(lineNum);
          const id = `TENANT-${String(idCounter++).padStart(3, '0')}`;
          findings.push({
            id,
            scanner: 'tenant-isolation-checker',
            severity: 'critical',
            title: 'Service role key used in route — bypasses all RLS policies',
            description:
              'The service_role key bypasses Row Level Security entirely. If used in an API route without extremely careful manual filtering, any user can access data from any tenant. Use the anon/user key with RLS policies, or add explicit tenant_id filtering with secureApiRouteWithTenant.',
            file,
            line: lineNum,
            category: 'security',
            owasp: 'A01:2021',
            cwe: 639,
          });
        }
      }

      // AST walk: find every Supabase `.from(<literal>)` and every
      // recognised Prisma method call. For each, check whether a tenant
      // discriminant is present in the chain / where-clause.
      walkAst(sf, (node) => {
        if (!ts.isCallExpression(node)) return;

        const fromCall = asSupabaseFromCall(node);
        if (fromCall) {
          if (supabaseChainHasDiscriminant(fromCall, discriminants)) return;
          // v0.11.2 Part C: per-`.from()` URL-param scope check. When
          // the chain's `.eq()` arg resolves (by binding-origin, not
          // lexical name) to a URL-param declaration in the enclosing
          // handler, the query IS scoped — just not via a column on
          // TENANT_DISCRIMINANTS. Emits are suppressed even when the
          // file as a whole isn't Part-C-scoped (e.g. T13's `tenants`
          // read stays suppressed while the `audit_log` write-chain
          // stays emitted).
          const handler = findEnclosingHandler(fromCall, fileScope.handlerAnalyses);
          if (handler !== null) {
            const analysis = fileScope.handlerAnalyses.get(handler);
            if (analysis !== undefined && fromChainHasUrlParamEq(fromCall, analysis, handler)) {
              return;
            }
          }
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
          if (prismaCallHasDiscriminant(prisma.firstArg, discriminants)) return;
          const id = `TENANT-${String(idCounter++).padStart(3, '0')}`;
          findings.push({
            id,
            scanner: 'tenant-isolation-checker',
            // v0.10 dub-corpus delta: Prisma ORM findings emit at MEDIUM
            // (audit required) rather than HIGH (IDOR). Many legitimate
            // Prisma queries are scoped by primary key or FK-relationship
            // chain rather than by an explicit discriminant column —
            // without taint/relationship analysis the scanner cannot
            // distinguish those from true gaps. Supabase `.from(` remains
            // HIGH because those are direct SQL queries without implicit
            // ORM scoping. Users can opt a whole file out via the
            // `@cross-tenant` / `@admin-only` annotations.
            severity: 'medium',
            title:
              'Prisma query missing tenant-boundary filter — audit for cross-tenant exposure',
            description:
              `A Prisma ${prisma.method}() call in an API route has no tenant discriminant in its where clause (workspaceId / teamId / orgId / organizationId / tenantId / tenant_id). This MAY be safe if the query is scoped by primary key on a resource that already belongs to the caller's tenant via FK relationship — OR it may be a cross-tenant leak. AST-based emission (no regex-in-comment FPs). Suppress an intentionally cross-tenant file with the JSDoc \`@cross-tenant\` or \`@admin-only\` annotation.`,
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
