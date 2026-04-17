/**
 * Next.js App-Router page context — shared primitives for cross-file
 * page-level analysis.
 *
 * v0.11.x FP #4 scaffold (Day 1 skeleton). The module centralizes the
 * cross-file information a page-level scanner needs to answer
 * "is this page.tsx dominated by a FAIL-CLOSED auth guard somewhere
 * in its layout chain or by a path-covering middleware?" — the
 * systemic gap surfaced by post-v0.11.0 real-world dogfood scans.
 *
 * Mirror role to `guard-flow.ts` (v0.11) — one module, shared by
 * auth-enforcer (consumer) and potentially middleware-auth-checker
 * (Flag 2 reuse question open). Signatures + JSDoc are stable; bodies
 * are intentionally stub (Day 1 analysis-phase). Implementation lands
 * in v0.11.x FP #4 Day 2-3 once the canary red-baseline is locked in.
 *
 * ABSTRACTION BOUNDARY: this module knows about Next.js filesystem
 * conventions (layout.tsx, middleware.ts, app-router root) and
 * App-Router runtime semantics (fail-closed redirect-on-negative,
 * 'use client' boundary). It does NOT know about CWE classes, sink
 * types, or taint. Scanners consume it at their emission sites.
 */
import ts from 'typescript';
import * as fs from 'node:fs';
import * as path from 'node:path';

// ─────────────────────────────────────────────────────────────────────────
// Q1: Ancestor-layout discovery
// ─────────────────────────────────────────────────────────────────────────

/**
 * Walk from `pageFile` upward toward `projectPath` (or the nearest
 * `/src/app` / `/app` root, whichever is closer), collecting every
 * `layout.tsx` or `layout.ts` encountered at each directory level.
 *
 * Order: innermost (nearest the page) first. Empty array when the
 * chain has no layouts. Returns absolute paths.
 *
 * Example (typical App-Router shape):
 *   pageFile = /project/src/app/admin/reports/[id]/page.tsx
 *   returns  = [
 *     /project/src/app/admin/reports/[id]/layout.tsx,  // if exists
 *     /project/src/app/admin/reports/layout.tsx,        // if exists
 *     /project/src/app/admin/layout.tsx,                // common admin-guard point
 *     /project/src/app/layout.tsx,                      // root layout
 *   ]
 *
 * Monorepo out-of-scope: one app-root per scan call (matches
 * existing `detectServerComponentDirs` assumption).
 */
export function collectAncestorLayouts(
  pageFile: string,
  projectPath: string,
): string[] {
  const layouts: string[] = [];

  // Resolve app-root boundary. Next.js supports `src/app` OR `app`.
  // We stop walking at whichever root contains the pageFile.
  const appRoots = [
    path.join(projectPath, 'src', 'app'),
    path.join(projectPath, 'app'),
  ];
  const appRoot = appRoots.find((r) => pageFile.startsWith(r + path.sep));
  if (appRoot === undefined) return [];

  // Start one level up from the page file's directory, stop at appRoot.
  // The page's own directory is included — a page.tsx and a sibling
  // layout.tsx in the same folder both render; the layout still wraps.
  let dir = path.dirname(pageFile);
  while (true) {
    for (const name of ['layout.tsx', 'layout.ts']) {
      const candidate = path.join(dir, name);
      if (fs.existsSync(candidate)) {
        layouts.push(candidate);
        break;
      }
    }
    if (dir === appRoot) break;
    const parent = path.dirname(dir);
    if (parent === dir) break; // filesystem root guard — should never hit
    dir = parent;
  }

  return layouts;
}

// ─────────────────────────────────────────────────────────────────────────
// Q2: Middleware matcher parsing
// ─────────────────────────────────────────────────────────────────────────

/**
 * Parse the `matcher` field of a Next.js middleware `export const config`
 * statement. Returns the raw matcher strings. Returns `null` when:
 *   - No `config` export exists (Next.js default: middleware runs on all
 *     paths — caller interprets null as "covers everything").
 *   - The matcher value is dynamic / non-static (env-based conditional,
 *     variable reference) — caller should interpret as "ambiguous;
 *     do NOT suppress" (conservative fail-closed).
 *
 * AST-based extraction (precision over regex per v0.11 direction).
 * Accepts both string-literal matchers (`'/admin/:path*'`) and their
 * array form.
 */
export function parseMiddlewareMatchers(middlewarePath: string): string[] | null {
  let content: string;
  try {
    content = fs.readFileSync(middlewarePath, 'utf-8');
  } catch {
    return null;
  }

  const sf = ts.createSourceFile(
    middlewarePath,
    content,
    ts.ScriptTarget.Latest,
    /*setParentNodes*/ true,
    ts.ScriptKind.TS,
  );

  for (const stmt of sf.statements) {
    if (!ts.isVariableStatement(stmt)) continue;
    const mods = ts.canHaveModifiers(stmt) ? ts.getModifiers(stmt) : undefined;
    const exported = mods?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ?? false;
    if (!exported) continue;

    for (const decl of stmt.declarationList.declarations) {
      if (!ts.isIdentifier(decl.name) || decl.name.text !== 'config') continue;
      if (decl.initializer === undefined || !ts.isObjectLiteralExpression(decl.initializer)) continue;

      for (const prop of decl.initializer.properties) {
        if (!ts.isPropertyAssignment(prop)) continue;
        if (!ts.isIdentifier(prop.name) || prop.name.text !== 'matcher') continue;

        // String-literal shorthand: matcher: '/admin/:path*'
        if (ts.isStringLiteral(prop.initializer)) {
          return [prop.initializer.text];
        }

        // Array form: matcher: ['/admin/:path*', '/api/:path*']
        if (ts.isArrayLiteralExpression(prop.initializer)) {
          const out: string[] = [];
          for (const el of prop.initializer.elements) {
            if (ts.isStringLiteral(el)) out.push(el.text);
            else return null; // dynamic / non-static element → ambiguous, caller gets null
          }
          return out;
        }

        // Variable reference / template literal / conditional — ambiguous.
        return null;
      }
    }
  }

  // No `export const config` at all → Next.js default (middleware runs on all routes).
  // Conservative interpretation for the scanner: caller treats null as
  // "ambiguous" (no suppression). A separate helper could return a sentinel
  // `'*'` for "everything" but we do not special-case it here — the
  // `middlewareProtects` composite handles the "no config → covers all" case
  // by checking whether ANY middleware file exists + has auth pattern.
  return null;
}

/**
 * Does the given `matcher` entry cover `pagePath`? Semantics per Next.js
 * middleware matcher rules:
 *   - `'/admin/:path*'` matches `/admin`, `/admin/x`, `/admin/x/y` — prefix with wildcard.
 *   - `'/admin/:slug'`  matches exactly one segment after `/admin/`.
 *   - `'/((?!public).*)'` — regex-style, AEGIS treats complex patterns
 *     as ambiguous (returns `false` to force conservative emit).
 *   - `'/'` exact — matches only the root.
 *
 * Returns `true` only when we're confident the matcher covers pagePath;
 * `false` for exclusions AND for ambiguous patterns. Caller gates
 * suppression on this.
 */
export function matcherCoversPath(matcher: string, pagePath: string): boolean {
  // Ambiguous patterns that the scanner can't confidently evaluate —
  // regex features (lookahead / lookbehind / alternation / grouping)
  // and character classes fall through as fail-closed (return false →
  // no suppression).
  if (/[()|\[\]\\]/.test(matcher)) return false;

  // Normalize: strip trailing slash for comparison, except when matcher
  // is exactly '/' (root-only).
  const m = matcher;
  const p = pagePath;

  // Exact root '/' — matches only the root, not sub-paths.
  if (m === '/') return p === '/';

  // `:path*` trailing → prefix match (with or without the leading slash after prefix).
  // Shapes: `/admin/:path*`, `/admin/:path+`, `/:path*`
  const prefixStarMatch = m.match(/^(.+?)\/:[A-Za-z_][\w]*[*+]$/);
  if (prefixStarMatch !== null) {
    const prefix = prefixStarMatch[1];
    return p === prefix || p.startsWith(prefix + '/');
  }

  // Bare `/:path*` → all paths.
  if (/^\/:[A-Za-z_][\w]*[*+]$/.test(m)) return true;

  // Single-segment `:slug` → matches EXACTLY one segment after prefix.
  // `/admin/:slug` matches `/admin/x` but NOT `/admin` or `/admin/x/y`.
  const singleSegmentMatch = m.match(/^(.+?)\/:[A-Za-z_][\w]*$/);
  if (singleSegmentMatch !== null) {
    const prefix = singleSegmentMatch[1];
    if (!p.startsWith(prefix + '/')) return false;
    const tail = p.slice(prefix.length + 1);
    return tail.length > 0 && !tail.includes('/');
  }

  // Plain literal — exact match only.
  return p === m;
}

// ─────────────────────────────────────────────────────────────────────────
// Q3: Layout auth-guard recognition
// ─────────────────────────────────────────────────────────────────────────

/**
 * Does the content of a layout.tsx file constitute a FAIL-CLOSED auth
 * guard for pages rendered beneath it? Three conditions all required:
 *
 *   1. File is NOT a client component (`'use client'` directive absent).
 *      Client-component layouts run in the browser and cannot gate
 *      server-side data access — a client auth-check is cosmetic from
 *      a security standpoint.
 *   2. Contains an AUTH_GUARD_PATTERNS call (getServerSession, auth(),
 *      currentUser, requireAuth, hasAccessToPath, etc. — matches the
 *      auth-enforcer catalog).
 *   3. Contains a `redirect(...)`, `throw`, or `notFound()` invocation
 *      that is reached on the NEGATIVE branch (when the auth-helper
 *      says "no user"). FAIL-CLOSED semantic. A log-only layout or a
 *      wrong-direction check (`if (user) redirect`) does NOT qualify.
 *
 * Parallel to `isSinkDominatedByNarrowingCondition` in `guard-flow.ts`
 * but with different semantics: this is a file-level existence-plus-
 * fail-closed check, not the positional sink/guard relationship that
 * the taint-tracker's consumer-side helper performs. The two helpers
 * share a conceptual shape ("something dominates something else under
 * a negative-branch guard") but operate on different scopes — layout
 * body vs sink-call position inside a function.
 *
 * If a third consumer of dominator logic emerges (e.g. a future
 * middleware-body dominator check), consider unifying into a shared
 * `ast/dominator.ts` module. For now, semantic consistency is
 * canary-guaranteed via the L5-L12 edge-case fixtures.
 */
export function hasLayoutAuthGuard(layoutContent: string): boolean {
  if (isClientDirective(layoutContent)) return false;

  const sf = ts.createSourceFile(
    'layout.tsx',
    layoutContent,
    ts.ScriptTarget.Latest,
    /*setParentNodes*/ true,
    ts.ScriptKind.TSX,
  );

  const layoutBody = findDefaultExportFnBody(sf);
  if (layoutBody === null || !ts.isBlock(layoutBody)) return false;

  // Step 1: collect identifier bindings that capture an `await <call>` result
  // at TOP LEVEL of the layout body. Nested scopes (inside IfStatement,
  // TryStatement, etc.) are intentionally NOT walked — they represent
  // conditional / exception-swallowing guards which do not dominate the
  // subsequent render path (see variant matrix for L11 / L12 rationale).
  const awaitBindings = new Set<string>();
  for (const stmt of layoutBody.statements) {
    collectAwaitBindings(stmt, awaitBindings);
  }
  if (awaitBindings.size === 0) return false;

  // Step 2: find a top-level IfStatement negating any of the bindings
  // AND whose then-branch contains a fail-closed action.
  for (const stmt of layoutBody.statements) {
    if (!ts.isIfStatement(stmt)) continue;
    if (!ifNegatesAnyBinding(stmt.expression, awaitBindings)) continue;
    if (thenContainsFailClosed(stmt.thenStatement)) return true;
  }
  return false;
}

/** Locate the body of the default-export function in a layout / page file. */
function findDefaultExportFnBody(sf: ts.SourceFile): ts.Node | null {
  for (const stmt of sf.statements) {
    if (ts.isFunctionDeclaration(stmt)) {
      const mods = ts.canHaveModifiers(stmt) ? ts.getModifiers(stmt) : undefined;
      const hasDefault = mods?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword) ?? false;
      if (hasDefault && stmt.body !== undefined) return stmt.body;
    }
    if (ts.isExportAssignment(stmt)) {
      const expr = stmt.expression;
      if (ts.isArrowFunction(expr) || ts.isFunctionExpression(expr)) {
        return expr.body;
      }
    }
  }
  return null;
}

/**
 * From a top-level statement, collect identifiers that bind to an
 * await-expression result. Handles plain assign, destructure, and
 * nested destructure. Non-await initializers are ignored.
 */
function collectAwaitBindings(stmt: ts.Statement, out: Set<string>): void {
  if (!ts.isVariableStatement(stmt)) return;
  for (const decl of stmt.declarationList.declarations) {
    if (decl.initializer === undefined) continue;
    if (!awaitExpressionContains(decl.initializer)) continue;

    if (ts.isIdentifier(decl.name)) {
      out.add(decl.name.text);
    } else if (ts.isObjectBindingPattern(decl.name) || ts.isArrayBindingPattern(decl.name)) {
      collectBindingNames(decl.name, out);
    }
  }
}

/** Does the expression (or its property-access chain / call chain) contain an AwaitExpression? */
function awaitExpressionContains(expr: ts.Expression): boolean {
  if (ts.isAwaitExpression(expr)) return true;
  if (ts.isParenthesizedExpression(expr)) return awaitExpressionContains(expr.expression);
  if (ts.isPropertyAccessExpression(expr)) return awaitExpressionContains(expr.expression);
  if (ts.isCallExpression(expr)) return awaitExpressionContains(expr.expression);
  return false;
}

/** Recursive walk of binding-patterns to extract every leaf identifier. */
function collectBindingNames(
  pattern: ts.ObjectBindingPattern | ts.ArrayBindingPattern,
  out: Set<string>,
): void {
  for (const el of pattern.elements) {
    if (!ts.isBindingElement(el)) continue;
    if (ts.isIdentifier(el.name)) {
      out.add(el.name.text);
    } else if (ts.isObjectBindingPattern(el.name) || ts.isArrayBindingPattern(el.name)) {
      collectBindingNames(el.name, out);
    }
  }
}

/** Does the if-condition negate any of the tracked bindings? Supports
 *  !x, x === null, x == null, x === undefined, and optional-chain negation. */
function ifNegatesAnyBinding(expr: ts.Expression, bindings: Set<string>): boolean {
  if (ts.isPrefixUnaryExpression(expr) && expr.operator === ts.SyntaxKind.ExclamationToken) {
    const inner = expr.operand;
    if (ts.isIdentifier(inner)) return bindings.has(inner.text);
    // !x?.user / !x.user — walk to root identifier.
    let e: ts.Expression = inner;
    while (ts.isPropertyAccessExpression(e) || ts.isCallExpression(e)) {
      e = (e as ts.PropertyAccessExpression | ts.CallExpression).expression;
    }
    if (ts.isIdentifier(e)) return bindings.has(e.text);
    return false;
  }

  if (ts.isBinaryExpression(expr)) {
    const op = expr.operatorToken.kind;
    if (op !== ts.SyntaxKind.EqualsEqualsEqualsToken && op !== ts.SyntaxKind.EqualsEqualsToken) {
      return false;
    }
    const isNullish = (e: ts.Expression): boolean => (
      e.kind === ts.SyntaxKind.NullKeyword ||
      (ts.isIdentifier(e) && e.text === 'undefined')
    );
    const identSide = isNullish(expr.right) ? expr.left : isNullish(expr.left) ? expr.right : null;
    if (identSide !== null && ts.isIdentifier(identSide)) {
      return bindings.has(identSide.text);
    }
  }
  return false;
}

/**
 * Does the then-branch of an if-statement unconditionally exit via a
 * recognised fail-closed primitive? `redirect(...)` / `notFound()` /
 * `throw ...`. Supports both a bare statement and a block-wrapped body.
 * A trailing plain `return` does NOT count — the render path continues.
 */
function thenContainsFailClosed(stmt: ts.Statement): boolean {
  const check = (s: ts.Statement): boolean => {
    if (ts.isThrowStatement(s)) return true;
    if (ts.isExpressionStatement(s)) {
      const e = s.expression;
      if (ts.isCallExpression(e) && ts.isIdentifier(e.expression)) {
        const name = e.expression.text;
        return name === 'redirect' || name === 'notFound';
      }
    }
    if (ts.isReturnStatement(s) && s.expression !== undefined) {
      // `return redirect(...)` is also a fail-closed primitive.
      const e = s.expression;
      if (ts.isCallExpression(e) && ts.isIdentifier(e.expression)) {
        const name = e.expression.text;
        return name === 'redirect' || name === 'notFound';
      }
    }
    return false;
  };
  if (ts.isBlock(stmt)) {
    return stmt.statements.some(check);
  }
  return check(stmt);
}

// ─────────────────────────────────────────────────────────────────────────
// Q4: 'use client' directive detection
// ─────────────────────────────────────────────────────────────────────────

/**
 * Does the file's first statement declare the 'use client' directive?
 * Per Next.js rules, the directive must be the FIRST statement of the
 * file — leading comments and whitespace are tolerated, but once any
 * other statement appears, subsequent 'use client' strings are no-ops.
 *
 * AST-based detection: check that the first `ts.ExpressionStatement`
 * is a `ts.StringLiteral` with value 'use client' (either quote style).
 */
export function isClientDirective(content: string): boolean {
  const sf = ts.createSourceFile(
    'check.tsx',
    content,
    ts.ScriptTarget.Latest,
    /*setParentNodes*/ false,
    ts.ScriptKind.TSX,
  );
  const first = sf.statements[0];
  if (first === undefined || !ts.isExpressionStatement(first)) return false;
  const expr = first.expression;
  if (!ts.isStringLiteral(expr)) return false;
  return expr.text === 'use client';
}

// ─────────────────────────────────────────────────────────────────────────
// Q5: Composite suppression check
// ─────────────────────────────────────────────────────────────────────────

/**
 * Is the given page guarded via its ancestor layout chain OR via a
 * path-covering middleware? Composite OR-gate across both sources.
 *
 * Suppression semantic: returns `true` when the caller (auth-enforcer)
 * SHOULD suppress the page-level finding. Returns `false` (conservative
 * default) when neither source confidently protects the page.
 *
 * Any single FAIL-CLOSED layout in the chain OR matching middleware
 * with MIDDLEWARE_AUTH_PATTERNS is sufficient. Q5 edge: a deeper
 * client-component layout does NOT defeat an outer server-layout guard
 * — the outermost protection still applies.
 */
export function pageIsGuardedByContext(
  pageFile: string,
  projectPath: string,
): boolean {
  // Edge runtime bypass: page explicitly opts into Edge runtime, which
  // can change the layout/middleware application semantics. Conservative
  // fail-closed — do NOT suppress without deeper runtime analysis.
  let pageContent: string;
  try {
    pageContent = fs.readFileSync(pageFile, 'utf-8');
  } catch {
    return false;
  }
  if (/export\s+const\s+runtime\s*=\s*['"]edge['"]/.test(pageContent)) {
    return false;
  }

  // Check ancestor layout chain first — cheaper than middleware matcher
  // parsing because layouts are filesystem-adjacent to the page.
  const layouts = collectAncestorLayouts(pageFile, projectPath);
  for (const layoutPath of layouts) {
    let content: string;
    try {
      content = fs.readFileSync(layoutPath, 'utf-8');
    } catch {
      continue;
    }
    if (hasLayoutAuthGuard(content)) return true;
  }

  // Check middleware.ts for matcher-covering + auth-pattern protection.
  const middlewareCandidates = [
    path.join(projectPath, 'middleware.ts'),
    path.join(projectPath, 'middleware.js'),
    path.join(projectPath, 'src', 'middleware.ts'),
    path.join(projectPath, 'src', 'middleware.js'),
  ];
  for (const mwPath of middlewareCandidates) {
    if (!fs.existsSync(mwPath)) continue;
    if (middlewareProtects(mwPath, pageFile, projectPath)) return true;
  }

  return false;
}

/**
 * Known-limitations reminder (v0.12 TODO canaries):
 *   - Nested-function auth helpers (`async function checkAuth() { … }; await checkAuth()`)
 *     are NOT recognised — the guard statements live outside the layout body.
 *   - try/catch with a no-op catch that swallows a throw-based auth failure
 *     is excluded naturally because the structural walk only inspects
 *     top-level statements; the `if (!user) redirect` pattern inside a
 *     try-block is out of top-level scope → correctly classified as
 *     "no guard detected" → scanner emits.
 */

/**
 * Middleware-level protection check: does the middleware file both
 * contain a recognised auth pattern AND have a matcher that covers
 * the page's URL path?
 *
 * Uses a local copy of MIDDLEWARE_AUTH_PATTERNS kept in sync with
 * auth-enforcer.ts. If the list diverges (unintentional drift), the
 * canary fixtures M1 / M2 / L3 / L9 catch the regression.
 */
function middlewareProtects(
  middlewarePath: string,
  pageFile: string,
  projectPath: string,
): boolean {
  let content: string;
  try {
    content = fs.readFileSync(middlewarePath, 'utf-8');
  } catch {
    return false;
  }

  // Must have a recognised auth pattern. Strip comments first so prose
  // mentions of "auth" / "session" don't falsely qualify.
  const sanitized = stripComments(content);
  if (!MIDDLEWARE_AUTH_PATTERNS_LOCAL.some((p) => p.test(sanitized))) return false;

  const matchers = parseMiddlewareMatchers(middlewarePath);
  if (matchers === null) {
    // No `export const config` at all → Next.js default runs middleware
    // on every path. Protection is universal. Return true.
    const hasConfigExport = /export\s+const\s+config\s*=/.test(sanitized);
    if (!hasConfigExport) return true;
    // Config export exists but matcher was dynamic / non-static →
    // ambiguous. Fail-closed (don't suppress).
    return false;
  }

  const urlPath = pagePathToUrlPath(pageFile, projectPath);
  if (urlPath === null) return false;

  return matchers.some((m) => matcherCoversPath(m, urlPath));
}

/**
 * Convert an absolute page file path to its routed URL path.
 *   /project/src/app/admin/reports/page.tsx  →  /admin/reports
 *   /project/app/admin/reports/[id]/page.tsx →  /admin/reports/[id]
 *   /project/app/layout.tsx                  →  null (not a page)
 *
 * Dynamic segments (`[slug]`, `[...rest]`) are preserved literally —
 * matcher-coverage handles them on prefix-match semantics.
 */
function pagePathToUrlPath(pageFile: string, projectPath: string): string | null {
  const appRoots = [
    path.join(projectPath, 'src', 'app'),
    path.join(projectPath, 'app'),
  ];
  const appRoot = appRoots.find((r) => pageFile.startsWith(r + path.sep));
  if (appRoot === undefined) return null;

  const rel = pageFile.slice(appRoot.length);
  const dir = path.dirname(rel).replace(/\\/g, '/');
  if (dir === '/' || dir === '') return '/';
  return dir;
}

/**
 * Middleware auth-pattern catalog — kept in sync with
 * auth-enforcer.ts's MIDDLEWARE_AUTH_PATTERNS. Local copy to avoid a
 * cross-scanner import cycle. If this list ever diverges, the canary
 * harness (M1, M2, L3, L9) catches the regression.
 */
const MIDDLEWARE_AUTH_PATTERNS_LOCAL: readonly RegExp[] = [
  /getToken/,
  /withAuth/,
  /\bauth\(\)/,
  /NextAuth/,
  /clerkMiddleware/,
  /authMiddleware/,
  /\bgetServerSession\s*\(/,
  /\bgetServerAuthSession\s*\(/,
  /\.auth\.(?:getUser|getSession)\s*\(/,
  /\bcurrentUser\s*\(/,
];

// ─────────────────────────────────────────────────────────────────────────
// Bug A: Comment-prose suppression on regex-based content scanners
// ─────────────────────────────────────────────────────────────────────────

/**
 * Strip line comments (`// …`) and block comments (`/* … * /`) from
 * source content before applying regex-based pattern checks. Addresses
 * the Z2-comment-leak class: natural-language prose inside comments
 * accidentally matching scanner patterns (e.g. a real-world `// Stats
 * query (separat, …)` triggering DB_ACCESS_PATTERNS `\bquery\s*\(`).
 *
 * Preserves line structure (comments replaced with whitespace of same
 * length) so downstream line-number reporting stays accurate.
 *
 * This is a general-purpose utility — not strictly page-context —
 * but co-located here because Bug A and Bug B ship together in FP #4.
 * Will migrate to a dedicated `content-sanitize.ts` if v0.12 grows
 * more regex-scanner users.
 */
export function stripComments(content: string): string {
  const out: string[] = [];
  let i = 0;
  const n = content.length;
  while (i < n) {
    const c = content[i];
    const next = content[i + 1];

    // Line comment // … — replace through newline (keeps newline).
    if (c === '/' && next === '/') {
      out.push('  ');
      i += 2;
      while (i < n && content[i] !== '\n') {
        out.push(content[i] === '\t' ? '\t' : ' ');
        i++;
      }
      continue;
    }

    // Block comment /* … */ — replace whole span with spaces preserving
    // newlines so line numbers downstream stay accurate.
    if (c === '/' && next === '*') {
      out.push('  ');
      i += 2;
      while (i < n) {
        if (content[i] === '*' && content[i + 1] === '/') {
          out.push('  ');
          i += 2;
          break;
        }
        out.push(content[i] === '\n' ? '\n' : content[i] === '\t' ? '\t' : ' ');
        i++;
      }
      continue;
    }

    // String / template literals — skip so comment-like tokens inside
    // strings (e.g., SQL `SELECT /* hint */ ...`) are preserved. Three
    // quote styles covered with minimal escape handling. Sufficient for
    // the `stripComments-before-regex-scan` use case where the caller
    // is a lexical SAST pass.
    if (c === '"' || c === "'" || c === '`') {
      const quote = c;
      out.push(c);
      i++;
      while (i < n) {
        const ch = content[i];
        out.push(ch);
        if (ch === '\\' && i + 1 < n) {
          out.push(content[i + 1]);
          i += 2;
          continue;
        }
        if (ch === quote) {
          i++;
          break;
        }
        i++;
      }
      continue;
    }

    out.push(c);
    i++;
  }
  return out.join('');
}

