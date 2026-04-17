/**
 * Function Summary Cache — foundation for v0.7 Cross-File Taint Propagation.
 *
 * A {@link FunctionSummary} records an exported function's taint-propagation
 * behavior: which parameters flow to the return value, which parameters
 * reach a sink inside the function, and which CWEs (if any) the function
 * sanitizes. Consumers (the taint-tracker, added in Phase 2) look up summaries
 * at cross-module call sites to decide whether to emit a finding without
 * re-analyzing the callee every time.
 *
 * Cycle policy (v0.7 Phase 1 design, validator-surfaced):
 *   - The cache distinguishes "resolved", "in-progress", and "absent".
 *   - If `buildSummary` is re-entered for a key that is already "in-progress",
 *     a conservative {@link conservativeSummary} is returned — every param is
 *     treated as tainting the return and reaching a broad CWE set. This is
 *     FAIL-OPEN: potential FP beats infinite recursion.
 *   - A secondary recursion-depth cap (50 frames) exists as a belt-and-
 *     suspenders guard in case the in-progress mechanism is bypassed.
 *
 * Cache identity: (file-content SHA-256, function-name) — mirrors the v0.6.1
 * fingerprint philosophy. Any edit to the file invalidates summaries for
 * functions in that file.
 *
 * Scope boundary: this module BUILDS summaries. It does NOT consume them —
 * that's Phase 2's taint-tracker extension. Phase 1 ships a tested, cycle-
 * safe cache that Phase 2 plugs into.
 *
 * See docs/plans/v07-foundation.md §4 Phase 1 + docs/plans/v07-cross-file-
 * taint-policy.md for the edge-case policy that governs this code.
 */
import ts from 'typescript';
import * as fs from 'node:fs';
import * as crypto from 'node:crypto';
import type { ModuleGraph } from './module-graph.js';
import {
  TAINT_SINKS,
  CONSTRUCTOR_SINKS,
  PROPERTY_SINKS,
  JSX_ATTRIBUTE_SINKS,
} from './sinks.js';
import { TAINT_SANITIZER_DEFS, PARSE_NOT_SANITIZER } from './sanitizers.js';

/**
 * All CWEs recognized by the sink registry. Used by the conservative
 * fail-open summary so cycle/depth fallback reports every sink class AEGIS
 * actually tracks, not a hand-curated subset. Computed once at module load.
 */
const CONSERVATIVE_SINK_CWES: readonly number[] = Array.from(
  new Set([
    ...Object.values(TAINT_SINKS).map((m) => m.cwe),
    ...Object.values(CONSTRUCTOR_SINKS).map((m) => m.cwe),
    ...Object.values(PROPERTY_SINKS).map((m) => m.cwe),
    ...Object.values(JSX_ATTRIBUTE_SINKS).map((m) => m.cwe),
  ]),
).sort((a, b) => a - b);

/**
 * Per-parameter taint-propagation rule.
 * Populated by {@link buildSummary} for each declared parameter of a function.
 */
export interface ParamTaintRule {
  /** Zero-based parameter position. */
  paramIndex: number;
  /** If taint enters on this param, does the return value become tainted? */
  returnsTainted: boolean;
  /**
   * CWEs that fire inside the function body when this param is tainted.
   * Empty means this param reaches no recognized sink inside the function.
   */
  sinkCwes: number[];
}

/**
 * Captured behavior of an exported function, from a taint perspective.
 * Cross-file taint decisions consult this rather than re-analyzing the
 * callee at every call site.
 */
export interface FunctionSummary {
  /** How many parameters the function declares (excluding `this`). */
  paramCount: number;
  /** Per-parameter propagation rules. Length === `paramCount`. */
  params: ParamTaintRule[];
  /**
   * Sanitizer hint: CWEs neutralized when the function is called. An empty
   * list means the function is NOT a sanitizer. Populated only when the
   * function obviously wraps its first argument through a known sanitizer
   * like `parseInt`, `DOMPurify.sanitize`, `encodeURIComponent`, or Zod's
   * `.parse` / `.safeParse` — matches taint-tracker's sanitizer registry.
   */
  sanitizesCwes: number[];
  /**
   * True when the function RETURNS a function whose invocation calls a sink
   * with its own argument — HOCs, curried wrappers, etc. (policy §9).
   * Phase 2 emits at the binding site if such a function is called with a
   * sink argument.
   */
  returnsFunctionThatCallsSink: boolean;
  /** Absolute path of the file the summary was built from. */
  originFile: string;
  /**
   * Short SHA-256 of the normalized file content. Any source edit produces a
   * different hash, so cached summaries naturally invalidate on content
   * changes without timestamp dependency.
   */
  originHash: string;
  /**
   * Marker set on summaries produced via {@link conservativeSummary}.
   * Consumers may want to log a diagnostic or lower confidence when a
   * conservative summary is in effect.
   */
  conservative?: 'cycle-detected' | 'max-depth' | 'parse-failure';
}

/** Sentinel placed in the cache while a summary is being built. */
const IN_PROGRESS = Symbol('aegis.function-summary.in-progress');
type InProgressMarker = typeof IN_PROGRESS;

/** Cap on concurrent `buildSummary` recursion frames. */
export const MAX_SUMMARY_RECURSION_DEPTH = 50;

type CacheValue = FunctionSummary | InProgressMarker;

/**
 * In-memory function-summary cache with cycle detection and depth guard.
 *
 * Thread-unsafe by design — one cache per scanner run. Callers that mix
 * analyses across scans should construct a fresh instance per scan.
 */
export class SummaryCache {
  private readonly store = new Map<string, CacheValue>();
  private depth = 0;

  /** Compose a cache key from the building blocks of a summary's identity. */
  static key(fileHash: string, fnName: string): string {
    return `${fileHash}|${fnName}`;
  }

  /** Retrieve a resolved summary. Returns undefined for absent or in-progress. */
  get(fileHash: string, fnName: string): FunctionSummary | undefined {
    const v = this.store.get(SummaryCache.key(fileHash, fnName));
    if (v === undefined || v === IN_PROGRESS) return undefined;
    return v;
  }

  /** True if a summary for this key is currently under construction. */
  isInProgress(fileHash: string, fnName: string): boolean {
    return this.store.get(SummaryCache.key(fileHash, fnName)) === IN_PROGRESS;
  }

  /** Mark a key as "being built" so recursive calls can short-circuit. */
  markInProgress(fileHash: string, fnName: string): void {
    this.store.set(SummaryCache.key(fileHash, fnName), IN_PROGRESS);
  }

  /** Store the final summary, replacing the in-progress marker. */
  set(fileHash: string, fnName: string, summary: FunctionSummary): void {
    this.store.set(SummaryCache.key(fileHash, fnName), summary);
  }

  /** Remove a key (used primarily in tests or after a parse failure). */
  delete(fileHash: string, fnName: string): void {
    this.store.delete(SummaryCache.key(fileHash, fnName));
  }

  /** Drop every cached entry. */
  clear(): void {
    this.store.clear();
    this.depth = 0;
  }

  /** Current number of live recursion frames. Exposed for tests + diagnostics. */
  get recursionDepth(): number {
    return this.depth;
  }

  /** Entry count — useful for diagnostics and tests. */
  get size(): number {
    return this.store.size;
  }

  /**
   * Push a new recursion frame. Returns `false` when the cap is hit so the
   * caller can fall back to a conservative summary without blowing the stack.
   */
  enterFrame(): boolean {
    if (this.depth >= MAX_SUMMARY_RECURSION_DEPTH) return false;
    this.depth++;
    return true;
  }

  /** Pop one recursion frame. Mirrors {@link enterFrame}. */
  exitFrame(): void {
    if (this.depth > 0) this.depth--;
  }
}

/**
 * Hash a file's normalized content into a short SHA-256 prefix.
 *
 * Normalization: whitespace runs collapsed to single spaces and outer
 * whitespace trimmed — prevents cosmetic-only cache misses (re-formatted
 * but semantically identical code re-uses the summary).
 *
 * Returns null when the file can't be read (deleted, permissions, etc.).
 */
export function hashFile(filePath: string): string | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const normalized = content.replace(/\s+/g, ' ').trim();
    return crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 16);
  } catch {
    return null;
  }
}

/** Node kinds that {@link buildSummary} can analyze. */
export type SummarizableFn =
  | ts.FunctionDeclaration
  | ts.MethodDeclaration
  | ts.ArrowFunction
  | ts.FunctionExpression;

/** Type guard for {@link SummarizableFn}. */
export function isSummarizable(node: ts.Node): node is SummarizableFn {
  return (
    ts.isFunctionDeclaration(node) ||
    ts.isMethodDeclaration(node) ||
    ts.isArrowFunction(node) ||
    ts.isFunctionExpression(node)
  );
}

/**
 * Build a {@link FunctionSummary} for a single function declaration.
 *
 * Returns:
 *   - A concrete summary on success (cached on exit).
 *   - A {@link conservativeSummary} if the target is already being built
 *     (cycle) or if the recursion cap is hit.
 *   - `null` when the inputs don't permit analysis (missing program, parse
 *     failure, unreadable file) — callers must handle null as a "fall back
 *     to per-file behavior" signal.
 *
 * The function IS side-effecting on the cache — it marks the key in-progress
 * on entry and stores the finished summary on exit. This is required for
 * cycle detection to work under recursive callers.
 *
 * @param fn  Function-like node to summarize
 * @param fnName  The exported name under which the function is visible
 * @param program  Shared ts.Program for type resolution — null when
 *                 PROGRAM_MODE_MAX_FILES preflight bailed
 * @param moduleGraph  Module graph for cross-file symbol lookups — may be
 *                     null, in which case cross-module heuristics are skipped
 * @param cache  The summary cache; mutated during the call
 */
export function buildSummary(
  fn: SummarizableFn,
  fnName: string,
  program: ts.Program | null,
  moduleGraph: ModuleGraph | null,
  cache: SummaryCache,
): FunctionSummary | null {
  if (program === null) return null;

  const sf = fn.getSourceFile();
  const fileHash = hashFile(sf.fileName);
  if (fileHash === null) return null;

  // Cache hit → return immediately.
  const existing = cache.get(fileHash, fnName);
  if (existing !== undefined) return existing;

  // Cycle: someone is already building this key higher on the stack.
  if (cache.isInProgress(fileHash, fnName)) {
    return conservativeSummary(fn, sf.fileName, fileHash, 'cycle-detected');
  }

  // Recursion-depth belt-and-suspenders guard.
  if (!cache.enterFrame()) {
    return conservativeSummary(fn, sf.fileName, fileHash, 'max-depth');
  }

  cache.markInProgress(fileHash, fnName);
  try {
    const paramCount = fn.parameters.length;
    const paramNames = fn.parameters.map((p) => p.name.getText(sf));

    const params: ParamTaintRule[] = paramNames.map((name, i) => ({
      paramIndex: i,
      returnsTainted: paramReachesReturn(fn, name),
      sinkCwes: paramReachesSink(fn, name),
    }));

    const sanitizesCwes = detectSanitizer(fn, paramNames[0]);
    const returnsFunctionThatCallsSink = detectHocSinkPropagation(fn);

    const summary: FunctionSummary = {
      paramCount,
      params,
      sanitizesCwes,
      returnsFunctionThatCallsSink,
      originFile: sf.fileName,
      originHash: fileHash,
    };

    cache.set(fileHash, fnName, summary);
    return summary;
  } catch {
    // Parse-time failure (unexpected AST shape, type-text extraction error).
    // Drop the in-progress marker so a later call can retry — we don't want
    // to poison the cache with a non-result.
    cache.delete(fileHash, fnName);
    return conservativeSummary(fn, sf.fileName, fileHash, 'parse-failure');
  } finally {
    cache.exitFrame();
  }
}

/**
 * Fallback summary used on cycle or depth-cap hits. Treats every parameter
 * as tainting the return and reaching every sink class we know about —
 * fail-open bias over potentially missed findings.
 */
export function conservativeSummary(
  fn: SummarizableFn,
  originFile: string,
  originHash: string,
  reason: NonNullable<FunctionSummary['conservative']>,
): FunctionSummary {
  const paramCount = fn.parameters.length;
  const params: ParamTaintRule[] = Array.from({ length: paramCount }, (_, i) => ({
    paramIndex: i,
    returnsTainted: true,
    sinkCwes: [...CONSERVATIVE_SINK_CWES],
  }));
  return {
    paramCount,
    params,
    sanitizesCwes: [],
    returnsFunctionThatCallsSink: false,
    originFile,
    originHash,
    conservative: reason,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Local analysis helpers — intentionally simple, regex/syntax-level.
//
// v0.7 Phase 1 uses source-text matching against the function body. A later
// phase could replace these with symbol-resolved checks via the TypeChecker,
// but that's not required for the summary shape to be correct — it only
// affects precision of the summary contents.
// ─────────────────────────────────────────────────────────────────────────

/** Does the given parameter name appear inside a return expression? */
function paramReachesReturn(fn: SummarizableFn, paramName: string): boolean {
  const body = fn.body;
  if (body === undefined) return false;

  let reaches = false;
  const ident = identRegex(paramName);

  // Arrow function with expression body: the body IS the return expression.
  if (ts.isArrowFunction(fn) && !ts.isBlock(body)) {
    return ident.test(body.getText());
  }

  const visit = (node: ts.Node): void => {
    if (reaches) return;
    if (ts.isReturnStatement(node) && node.expression !== undefined) {
      if (ident.test(node.expression.getText())) {
        reaches = true;
        return;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(body);
  return reaches;
}

/**
 * Which sink CWEs does the param reach inside the function body?
 *
 * Consults the shared sink registry (`./sinks.ts`) rather than a hand-
 * maintained regex list, so any sink the taint-tracker knows about is
 * also a candidate here. Four sink kinds are checked:
 *
 *   - Call sinks ({@link TAINT_SINKS}): `exec(tainted)`, `db.query(tainted)`,
 *     `res.redirect(tainted)`, `Object.assign({}, tainted)`, …
 *   - Constructor sinks ({@link CONSTRUCTOR_SINKS}): `new Response(tainted)`,
 *     `new NextResponse(tainted)`, `new Function(tainted)`.
 *   - Property sinks ({@link PROPERTY_SINKS}): `elem.innerHTML = tainted`.
 *   - JSX attribute sinks ({@link JSX_ATTRIBUTE_SINKS}):
 *     `dangerouslySetInnerHTML={{ __html: tainted }}`.
 *
 * This is syntax-level detection — same fidelity as Phase 1's other helpers.
 * A later phase may replace this with AST-based symbol resolution for
 * better precision on shadowed names, but the SHAPE of the summary is the
 * same either way.
 */
function paramReachesSink(fn: SummarizableFn, paramName: string): number[] {
  const body = fn.body;
  if (body === undefined) return [];

  const text = body.getText();
  const ident = identRegex(paramName);
  const cwes = new Set<number>();

  // ── Call sinks: <name>(...) where name comes from TAINT_SINKS keys ──
  for (const [sinkName, meta] of Object.entries(TAINT_SINKS)) {
    const callPrefix = new RegExp(`\\b${escapeRegExp(sinkName)}\\s*\\(`, 'g');
    if (matchesCall(text, callPrefix, ident)) {
      cwes.add(meta.cwe);
    }
  }

  // ── Constructor sinks: `new <Name>(...)` ──
  for (const [ctorName, meta] of Object.entries(CONSTRUCTOR_SINKS)) {
    const callPrefix = new RegExp(`\\bnew\\s+${escapeRegExp(ctorName)}\\s*\\(`, 'g');
    if (matchesCall(text, callPrefix, ident)) {
      cwes.add(meta.cwe);
    }
  }

  // ── Property-assignment sinks: `.<prop> = <expr>` where expr contains param ──
  // We approximate by scanning the text for `\.<prop>\s*=\s*` and checking if
  // the RHS (up to the line end or semicolon) contains the identifier.
  for (const [propName, meta] of Object.entries(PROPERTY_SINKS)) {
    const assignRe = new RegExp(`\\.${escapeRegExp(propName)}\\s*=\\s*([^;\\n]+)`, 'g');
    let match: RegExpExecArray | null;
    while ((match = assignRe.exec(text)) !== null) {
      if (ident.test(match[1])) {
        cwes.add(meta.cwe);
        break;
      }
    }
  }

  // ── JSX attribute sinks: `<attr>={{ __html: <expr> }}` with tainted expr ──
  // Scan for the attribute + opening brace + balanced braces; look for
  // the identifier inside.
  for (const [attrName, meta] of Object.entries(JSX_ATTRIBUTE_SINKS)) {
    const attrRe = new RegExp(`\\b${escapeRegExp(attrName)}\\s*=\\s*\\{`, 'g');
    let match: RegExpExecArray | null;
    while ((match = attrRe.exec(text)) !== null) {
      const openBraceIdx = match.index + match[0].length - 1;
      const inside = extractBalancedBraces(text, openBraceIdx);
      if (inside !== null && ident.test(inside)) {
        cwes.add(meta.cwe);
        break;
      }
    }
  }

  // v0.9.1 polish: regex-guard cross-file — if the function contains
  // SSRF-class sink calls on this param AND every such call is guarded
  // by a `<regex>.test(paramName)` check (either as an enclosing if-
  // then-branch or as a preceding `if (!regex.test(param)) return/throw`
  // early-exit), drop CWE_SSRF from the summary. Closes the v0.8-corpus
  // cal-com isValidCalURL FP: `if (!regex.test(url)) return; fetch(url)`.
  if (cwes.has(918) && allSsrfSinkCallsGuardedByRegex(body, paramName)) {
    cwes.delete(918);
  }

  return [...cwes].sort((a, b) => a - b);
}

/**
 * v0.9.1 regex-guard helper. Returns true when the function body
 * contains at least one SSRF-class sink call on `paramName` AND
 * every such call is protected by a `<regex>.test(paramName)` guard.
 * Conservative: any single unguarded SSRF sink call defeats the check
 * and the CWE stays. No sink calls found → returns false (nothing to
 * suppress; shouldn't be reached because the text-match already
 * confirmed at least one before this helper fires).
 */
function allSsrfSinkCallsGuardedByRegex(body: ts.Node, paramName: string): boolean {
  const ssrfCallNames = new Set(
    Object.entries(TAINT_SINKS)
      .filter(([, meta]) => meta.cwe === 918)
      .map(([name]) => name),
  );

  const sinkCalls: ts.CallExpression[] = [];
  const collect = (n: ts.Node): void => {
    if (ts.isCallExpression(n)) {
      const calleeText = n.expression.getText();
      if (ssrfCallNames.has(calleeText) && callPassesIdentifier(n, paramName)) {
        sinkCalls.push(n);
      }
    }
    ts.forEachChild(n, collect);
  };
  collect(body);

  if (sinkCalls.length === 0) return false;
  for (const call of sinkCalls) {
    if (!isCallGuardedByRegexTest(call, body, paramName)) return false;
  }
  return true;
}

/** Does the call pass `paramName` as any argument (direct identifier or mentioned in a template literal)? */
function callPassesIdentifier(call: ts.CallExpression, paramName: string): boolean {
  for (const arg of call.arguments) {
    if (ts.isIdentifier(arg) && arg.text === paramName) return true;
    // Template literals / concatenations / property access that mentions the identifier:
    if (identRegex(paramName).test(arg.getText())) return true;
  }
  return false;
}

/**
 * Is the given sink CallExpression guarded by `<regex>.test(paramName)`?
 * Two shapes qualify:
 *
 *   1. Inside an if-statement's then-branch whose condition contains
 *      `<something>.test(paramName)` (positive guard).
 *   2. Preceded in the same enclosing block by
 *      `if (!<something>.test(paramName)) return ...;` or
 *      `if (!<something>.test(paramName)) throw ...;`
 *      (negated-early-exit guard).
 */
function isCallGuardedByRegexTest(
  call: ts.CallExpression,
  fnBody: ts.Node,
  paramName: string,
): boolean {
  // Case 1: ancestor IfStatement with positive .test(param) and call is in then-branch.
  let anc: ts.Node | undefined = call.parent;
  while (anc !== undefined && anc !== fnBody.parent) {
    if (ts.isIfStatement(anc)) {
      if (exprHasRegexTestOn(anc.expression, paramName, false)) {
        if (isNodeContained(call, anc.thenStatement)) return true;
      }
    }
    anc = anc.parent;
  }

  // Case 2: preceding early-exit in the same block.
  const block = enclosingBlock(call);
  if (block === null) return false;
  const sinkStmt = statementContaining(block, call);
  if (sinkStmt === null) return false;
  const idx = block.statements.indexOf(sinkStmt);
  for (let i = 0; i < idx; i++) {
    const stmt = block.statements[i];
    if (!ts.isIfStatement(stmt)) continue;
    if (!exprHasRegexTestOn(stmt.expression, paramName, true)) continue;
    if (thenTerminates(stmt.thenStatement)) return true;
  }
  return false;
}

/**
 * Does the expression contain `<anything>.test(<paramName>)` with the
 * requested negation status? `wantNegated: true` means the .test(...)
 * must be the operand of a `!` PrefixUnaryExpression; `false` means
 * it must NOT be negated.
 */
function exprHasRegexTestOn(expr: ts.Node, paramName: string, wantNegated: boolean): boolean {
  let found = false;
  const visit = (n: ts.Node): void => {
    if (found) return;
    if (
      ts.isCallExpression(n) &&
      ts.isPropertyAccessExpression(n.expression) &&
      ts.isIdentifier(n.expression.name) &&
      n.expression.name.text === 'test' &&
      n.arguments.length > 0 &&
      ts.isIdentifier(n.arguments[0]) &&
      n.arguments[0].text === paramName
    ) {
      const negated =
        n.parent !== undefined &&
        ts.isPrefixUnaryExpression(n.parent) &&
        n.parent.operator === ts.SyntaxKind.ExclamationToken;
      if (negated === wantNegated) {
        found = true;
        return;
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(expr);
  return found;
}

/** Does the then-statement unconditionally exit (return or throw)? */
function thenTerminates(stmt: ts.Statement): boolean {
  if (ts.isReturnStatement(stmt) || ts.isThrowStatement(stmt)) return true;
  if (ts.isBlock(stmt)) {
    return stmt.statements.some(
      (s) => ts.isReturnStatement(s) || ts.isThrowStatement(s),
    );
  }
  return false;
}

function enclosingBlock(node: ts.Node): ts.Block | null {
  let p: ts.Node | undefined = node.parent;
  while (p !== undefined) {
    if (ts.isBlock(p)) return p;
    p = p.parent;
  }
  return null;
}

function statementContaining(block: ts.Block, target: ts.Node): ts.Statement | null {
  for (const stmt of block.statements) {
    let hit = false;
    const visit = (n: ts.Node): void => {
      if (hit) return;
      if (n === target) {
        hit = true;
        return;
      }
      ts.forEachChild(n, visit);
    };
    visit(stmt);
    if (hit) return stmt;
  }
  return null;
}

function isNodeContained(target: ts.Node, container: ts.Node): boolean {
  let p: ts.Node | undefined = target;
  while (p !== undefined) {
    if (p === container) return true;
    p = p.parent;
  }
  return false;
}

/**
 * Does the function wrap its first argument in a recognized sanitizer and
 * return that value? Returns the list of CWEs neutralized.
 *
 * Consults the shared sanitizer registry (`./sanitizers.ts`) rather than
 * a hand-maintained regex list:
 *
 *   - Each entry of {@link TAINT_SANITIZER_DEFS} is tested by building a
 *     call-prefix regex from its `name`. A match means "this sanitizer
 *     is applied to firstParamName in the function body."
 *   - {@link PARSE_NOT_SANITIZER} is consulted BEFORE crediting `.parse`
 *     or `.safeParse` matches. Known non-sanitizers (`JSON.parse`,
 *     `Date.parse`, `qs.parse`, `URL.parse`, `cookie.parse`, …) never
 *     count — they deserialize but do not validate, so taint survives.
 *
 * The .parse-negative case is load-bearing: earlier drafts credited
 * every `.parse(x)` call as a full-spectrum sanitizer, which would have
 * caused Phase 2 to silently drop real findings whenever a cross-module
 * call went through `JSON.parse`.
 */
function detectSanitizer(fn: SummarizableFn, firstParamName: string | undefined): number[] {
  if (firstParamName === undefined) return [];
  const body = fn.body;
  if (body === undefined) return [];

  const text = body.getText();
  const ident = identRegex(firstParamName);
  const cwes = new Set<number>();

  for (const def of TAINT_SANITIZER_DEFS) {
    const name = def.name;

    if (name.includes('.')) {
      // Dotted name — `DOMPurify.sanitize`, `Prisma.sql`, `path.normalize`, etc.
      // Match ONLY the exact qualifier; don't widen the regex.
      const re = new RegExp(`\\b${escapeRegExp(name)}\\s*\\(`, 'g');
      if (matchesCall(text, re, ident)) {
        for (const cwe of def.neutralizes) cwes.add(cwe);
      }
    } else {
      // Simple name — may be a FREE call (`parseInt(x)`) OR a METHOD call
      // on any object (`zodSchema.parse(x)`, `z.string().parse(x)`,
      // `JSON.parse(x)` — the problematic case).
      //
      // freeCall uses a negative lookbehind `(?<!\.)` to reject matches
      // where the identifier is preceded by a dot. Without this, `\bparse`
      // would match the `parse` in `JSON.parse(` (`\b` fires between `.`
      // and `parse`) and credit JSON.parse as a free-call sanitizer —
      // the exact validator-flagged regression.
      const freeCall = new RegExp(`(?<!\\.)\\b${escapeRegExp(name)}\\s*\\(`, 'g');
      const methodCall = new RegExp(
        `([A-Za-z_$][\\w$]*(?:\\s*\\([^)]*\\))?(?:\\.[A-Za-z_$][\\w$]*)*)\\.${escapeRegExp(name)}\\s*\\(`,
        'g',
      );

      if (matchesCall(text, freeCall, ident)) {
        for (const cwe of def.neutralizes) cwes.add(cwe);
      }

      // For method calls (`<qualifier>.parse(x)`), consult
      // PARSE_NOT_SANITIZER to reject known deserializers (JSON.parse,
      // Date.parse, qs.parse, URL.parse, cookie.parse, …). Anything else
      // (zodSchema, yupSchema, anonymous validators) is credited.
      let m: RegExpExecArray | null;
      while ((m = methodCall.exec(text)) !== null) {
        const qualifier = m[1].trim();
        const fullName = `${qualifier}.${name}`;
        if (PARSE_NOT_SANITIZER.has(fullName)) continue;
        const openIdx = m.index + m[0].length - 1;
        const args = extractBalancedParens(text, openIdx);
        if (args !== null && ident.test(args)) {
          for (const cwe of def.neutralizes) cwes.add(cwe);
          break;
        }
      }
    }
  }

  return [...cwes].sort((a, b) => a - b);
}

/**
 * HOC / curry detection (policy §9): does the function return a function
 * whose body calls a sink using the inner function's parameter? Example:
 *
 *   export function withLogger(fn) {
 *     return (...args) => { log(args); return fn(...args); };
 *   }
 *
 * Here the OUTER fn returns a function that calls `fn(...args)`. If the
 * outer call passes a sink as `fn` and the inner call passes tainted
 * args, taint reaches the sink. Phase 2 uses this flag to emit at the
 * binding site.
 */
function detectHocSinkPropagation(fn: SummarizableFn): boolean {
  const body = fn.body;
  if (body === undefined) return false;

  // Only block-bodied fns with an explicit `return <ArrowOrFunction>` qualify
  // for HOC semantics. Arrow functions with expression-body can too: `() => fn`.
  let found = false;
  const visit = (node: ts.Node): void => {
    if (found) return;
    const isReturnOfFn =
      ts.isReturnStatement(node) &&
      node.expression !== undefined &&
      (ts.isArrowFunction(node.expression) || ts.isFunctionExpression(node.expression));
    if (isReturnOfFn) {
      const inner = node.expression as ts.ArrowFunction | ts.FunctionExpression;
      // The inner function calls an identifier that is ONE OF the outer's
      // params and passes args through. We approximate by checking if any
      // of the outer params' names appears as a callee in the inner body.
      const outerParams = fn.parameters.map((p) => p.name.getText());
      const innerText = inner.getText();
      for (const name of outerParams) {
        const call = new RegExp(`\\b${escapeRegExp(name)}\\s*\\(`);
        if (call.test(innerText)) {
          found = true;
          return;
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(body);
  return found;
}

/** Build an identifier-boundary-safe regex for a given parameter name. */
function identRegex(name: string): RegExp {
  return new RegExp(`\\b${escapeRegExp(name)}\\b`);
}

/** Escape regex-metacharacters in a literal string. */
function escapeRegExp(raw: string): string {
  return raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Given source text and a call-prefix pattern (e.g. `/\bexec\s*\(/g`), find
 * each match and return true if any match's call-argument block contains
 * the supplied identifier-boundary pattern. Uses a conservative-scan approach
 * (expands one pair of parens after the match) — adequate for Phase 1
 * syntactic recognition.
 */
function matchesCall(text: string, prefix: RegExp, ident: RegExp): boolean {
  const re = new RegExp(prefix.source, prefix.flags.includes('g') ? prefix.flags : prefix.flags + 'g');
  re.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const start = m.index + m[0].length;
    const args = extractBalancedParens(text, start - 1);
    if (args !== null && ident.test(args)) return true;
  }
  return false;
}

/**
 * Given text and the index of an opening `(`, return the text inside the
 * balanced parens (excluding the outer parens). Returns null on unbalanced
 * input. Handles `{}` and `[]` nesting but NOT string/template literals —
 * the caller must pass a plausible starting position.
 */
function extractBalancedParens(text: string, openIdx: number): string | null {
  if (text[openIdx] !== '(') {
    // Scan forward a few chars for an opening paren (handles whitespace).
    let i = openIdx;
    while (i < text.length && i - openIdx < 5 && text[i] !== '(') i++;
    if (text[i] !== '(') return null;
    openIdx = i;
  }
  let depth = 1;
  let i = openIdx + 1;
  const startOfContent = i;
  while (i < text.length && depth > 0) {
    const c = text[i];
    if (c === '(' || c === '{' || c === '[') depth++;
    else if (c === ')' || c === '}' || c === ']') depth--;
    if (depth === 0) break;
    i++;
  }
  if (depth !== 0) return null;
  return text.slice(startOfContent, i);
}

/**
 * Sibling of {@link extractBalancedParens} that expects a `{` at openIdx
 * and returns the brace-balanced content. Used for JSX attribute payloads
 * like `dangerouslySetInnerHTML={{ __html: x }}` where the attribute value
 * is an object literal.
 */
function extractBalancedBraces(text: string, openIdx: number): string | null {
  if (text[openIdx] !== '{') return null;
  let depth = 1;
  let i = openIdx + 1;
  const startOfContent = i;
  while (i < text.length && depth > 0) {
    const c = text[i];
    if (c === '{' || c === '(' || c === '[') depth++;
    else if (c === '}' || c === ')' || c === ']') depth--;
    if (depth === 0) break;
    i++;
  }
  if (depth !== 0) return null;
  return text.slice(startOfContent, i);
}
