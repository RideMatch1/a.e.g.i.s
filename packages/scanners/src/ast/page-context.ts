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
  _pageFile: string,
  _projectPath: string,
): string[] {
  // TODO v0.11.x FP #4 Day 2: implement directory walk.
  return [];
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
export function parseMiddlewareMatchers(_middlewarePath: string): string[] | null {
  // TODO v0.11.x FP #4 Day 2: AST parse `export const config = { matcher: [...] }`.
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
export function matcherCoversPath(_matcher: string, _pagePath: string): boolean {
  // TODO v0.11.x FP #4 Day 2: implement Next.js matcher semantics.
  return false;
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
export function hasLayoutAuthGuard(_layoutContent: string): boolean {
  // TODO v0.11.x FP #4 Day 2-3: implement 3-condition check.
  return false;
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
export function isClientDirective(_content: string): boolean {
  // TODO v0.11.x FP #4 Day 2: AST-parse first-statement directive.
  return false;
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
  _pageFile: string,
  _projectPath: string,
): boolean {
  // TODO v0.11.x FP #4 Day 2-3: compose collectAncestorLayouts +
  // hasLayoutAuthGuard + middleware matcher check.
  return false;
}

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
export function stripComments(_content: string): string {
  // TODO v0.11.x FP #4 (Bug A): preserve-length comment stripper.
  return _content;
}

// Placeholder: the TypeScript import is retained for v0.11.x FP #4
// Day 2-3 implementation (AST helpers). Removing it here keeps the
// skeleton's unused-import warnings quiet.
void ts;
