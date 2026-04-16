import ts from 'typescript';
import { parseFile, getLineNumber, walkAst } from './parser.js';
import { isSourceExpression } from './sources.js';
import {
  TAINT_SINKS,
  getSinkMeta,
  CONSTRUCTOR_SINKS,
  RPC_SINK_META,
  PROPERTY_SINKS,
  JSX_ATTRIBUTE_SINKS,
  isAmbientSinkCandidate,
  type SinkMeta,
} from './sinks.js';
import { isSanitizer, sanitizesForCwe } from './sanitizers.js';
import { resolveSinkSymbol } from './type-resolve.js';
import { ModuleGraph } from './module-graph.js';
import {
  buildSummary,
  SummaryCache,
  isSummarizable,
  type SummarizableFn,
} from './function-summary.js';
import type { Confidence, Severity } from '@aegis-scan/core';

export interface TaintFinding {
  sourceExpr: string;
  sourceLine: number;
  sinkName: string;
  sinkLine: number;
  cwe: number;
  owasp: string;
  severity: Severity;
  category: string;
  taintPath: string[];
  /**
   * v0.7 Phase 2: true when the finding spans a cross-module call — the
   * source is in the caller's file, the sink is reached via a summary of
   * an exported function declared in another file. Consumers (SARIF
   * reporter, precision CLI) treat this as a signal to emit
   * `relatedLocations` and downgrade confidence if configured.
   */
  crossFile?: boolean;
  /**
   * v0.7 Phase 2: absolute path of the origin file containing the
   * cross-file function whose summary triggered this finding. Present
   * only when `crossFile: true`. SARIF emission uses this to populate
   * the `relatedLocations` list.
   */
  crossFileOrigin?: string;
  /**
   * v0.7 Phase 5 calibration lever: per-finding confidence tier. Mirrors
   * {@link import('@aegis-scan/core').Finding.confidence}. Cross-file
   * findings emit with `'medium'` pending the n≥20 dogfood measurement
   * that v0.8 targets — pre-tag dogfood n=2 is below the plan §3 TBD-3
   * threshold, so FP-rate zone is unmeasurable (not failed). Single-
   * file findings retain the scanner's default (undefined / absent
   * means "default high").
   */
  confidence?: Confidence;
}

interface TaintEntry {
  sourceExpr: string;
  sourceLine: number;
  path: string[];
  /** Sanitizer names applied on this taint path (for per-CWE check at sink) */
  sanitizers: string[];
}

/**
 * Per-scan state threaded through all taint-tracker functions.
 * Consolidates parameters so adding new facilities (e.g., ts.Program,
 * ts.TypeChecker in Phase 3, function-summary cache in v0.7 Phase 2)
 * doesn't balloon every signature.
 */
export interface TaintContext {
  sf: ts.SourceFile;
  taintMap: ScopedTaintMap;
  functionReturns: Map<string, TaintEntry | null>;
  findings: TaintFinding[];
  /** Set when the scanner built a shared Program (type-aware mode). */
  program?: ts.Program;
  /** Type checker from `program` — enables resolveSinkSymbol filtering. */
  checker?: ts.TypeChecker;
  /**
   * v0.7 Phase 2 (not yet consumed in Phase 1): program-wide module graph
   * for cross-file symbol lookups. When set alongside `summaries`,
   * cross-module call sites resolve via function-summary lookup.
   */
  moduleGraph?: import('./module-graph.js').ModuleGraph;
  /**
   * v0.7 Phase 2 (not yet consumed in Phase 1): function-summary cache.
   * Pre-populated or lazily filled by the scanner driver; consulted at
   * cross-module Call nodes to decide taint propagation without
   * re-analyzing the callee.
   */
  summaries?: import('./function-summary.js').SummaryCache;
  /**
   * v0.8 Phase 5 (policy §4): identifier names whose value was produced
   * by a conditional dynamic-import expression
   * (`cond ? await import('./a') : await import('./b')`). Sinks whose
   * callee object is in this set emit with confidence='medium' because
   * the scanner can't prove which branch is taken at runtime. Populated
   * per-file in trackTaintCore via handleVariableDeclaration.
   */
  conditionalImports: Set<string>;
}

/**
 * Scoped taint map — supports nested function scopes.
 * Variables in inner scopes shadow outer scopes but don't overwrite them.
 * Lookup traverses the scope chain (current → parent → ... → global).
 */
/** Sentinel value: variable exists in this scope but is NOT tainted */
const CLEAN_SENTINEL = Symbol('CLEAN');

class ScopedTaintMap {
  private scopes: Map<string, TaintEntry | typeof CLEAN_SENTINEL>[] = [new Map()];

  push(): void {
    this.scopes.push(new Map());
  }

  pop(): void {
    if (this.scopes.length > 1) this.scopes.pop();
  }

  /** Set a tainted entry in the current scope */
  set(name: string, entry: TaintEntry): void {
    this.scopes[this.scopes.length - 1].set(name, entry);
  }

  /** Mark a variable as explicitly clean in the current scope (shadows outer taint) */
  markClean(name: string): void {
    this.scopes[this.scopes.length - 1].set(name, CLEAN_SENTINEL);
  }

  get(name: string): TaintEntry | undefined {
    for (let i = this.scopes.length - 1; i >= 0; i--) {
      const entry = this.scopes[i].get(name);
      if (entry === CLEAN_SENTINEL) return undefined; // explicitly clean — stop lookup
      if (entry) return entry;
    }
    return undefined;
  }

  has(name: string): boolean {
    return this.get(name) !== undefined;
  }
}

/** Supabase chained methods that are parameterized — NOT sinks */
const SAFE_CHAIN_METHODS = new Set([
  'from', 'select', 'eq', 'neq', 'gt', 'gte', 'lt', 'lte',
  'like', 'ilike', 'is', 'in', 'contains', 'containedBy',
  'filter', 'match', 'not', 'or', 'and', 'order', 'limit',
  'range', 'single', 'maybeSingle', 'insert', 'update', 'upsert', 'delete',
]);

/**
 * Extract taint from return statements inside a function body.
 * Builds a local taint map for the function scope to track
 * variables assigned from taint sources, then checks returns.
 */
function extractReturnTaint(
  sf: ts.SourceFile,
  body: ts.Block,
  fnName: string,
): TaintEntry | null {
  // Build a local taint map for this function's scope
  const localTaint = new Map<string, TaintEntry>();
  let returnTaint: TaintEntry | null = null;

  walkAst(body, (inner) => {
    // Track local variable assignments from sources or other tainted locals
    if (ts.isVariableDeclaration(inner) && inner.initializer) {
      const initText = inner.initializer.getText(sf);
      const sourceTaint: TaintEntry | null = isSourceExpression(initText)
        ? { sourceExpr: initText, sourceLine: getLineNumber(sf, inner.initializer.getStart(sf)), path: [initText], sanitizers: [] }
        : (ts.isIdentifier(inner.initializer) && localTaint.has(inner.initializer.text))
          ? localTaint.get(inner.initializer.text)!
          : null;

      if (sourceTaint) {
        // Simple identifier: const x = source / const x = taintedVar
        if (ts.isIdentifier(inner.name)) {
          localTaint.set(inner.name.text, { ...sourceTaint, path: [...sourceTaint.path, inner.name.text] });
        }
        // Object destructuring: const { id, name } = req.body
        if (ts.isObjectBindingPattern(inner.name)) {
          for (const el of inner.name.elements) {
            if (ts.isBindingElement(el) && ts.isIdentifier(el.name)) {
              localTaint.set(el.name.text, { ...sourceTaint, path: [...sourceTaint.path, el.name.text] });
            }
          }
        }
        // Array destructuring: const [a, b] = req.body
        if (ts.isArrayBindingPattern(inner.name)) {
          for (const el of inner.name.elements) {
            if (ts.isBindingElement(el) && ts.isIdentifier(el.name)) {
              localTaint.set(el.name.text, { ...sourceTaint, path: [...sourceTaint.path, el.name.text] });
            }
          }
        }
      }
    }

    // Check return statements for direct sources OR tainted local variables
    if (ts.isReturnStatement(inner) && inner.expression) {
      const retText = inner.expression.getText(sf);
      if (isSourceExpression(retText)) {
        returnTaint = {
          sourceExpr: retText,
          sourceLine: getLineNumber(sf, inner.expression.getStart(sf)),
          path: [retText, `${fnName}()`],
          sanitizers: [],
        };
      } else if (ts.isIdentifier(inner.expression) && localTaint.has(inner.expression.text)) {
        const local = localTaint.get(inner.expression.text)!;
        returnTaint = { ...local, path: [...local.path, `${fnName}()`] };
      } else if (ts.isPropertyAccessExpression(inner.expression)) {
        // return x.id — check if x is a tainted local
        const objName = ts.isIdentifier(inner.expression.expression) ? inner.expression.expression.text : null;
        if (objName && localTaint.has(objName)) {
          const local = localTaint.get(objName)!;
          returnTaint = { ...local, path: [...local.path, inner.expression.getText(sf), `${fnName}()`] };
        }
      }
    }
  });
  return returnTaint;
}

/**
 * Collect same-file function return taint (Phase-1 pre-analysis).
 * Extracted so both public entry points can reuse without duplication.
 */
function collectFunctionReturns(sf: ts.SourceFile): Map<string, TaintEntry | null> {
  const functionReturns = new Map<string, TaintEntry | null>();
  walkAst(sf, (node) => {
    // Named function declarations: function getBody() { return req.body; }
    if (ts.isFunctionDeclaration(node) && node.name && node.body) {
      const fnName = node.name.text;
      const returnTaint = extractReturnTaint(sf, node.body, fnName);
      functionReturns.set(fnName, returnTaint);
    }

    // Arrow/function expressions assigned to const: const getBody = () => req.body
    if (ts.isVariableDeclaration(node) && node.initializer && ts.isIdentifier(node.name)) {
      const init = node.initializer;
      if (ts.isArrowFunction(init) || ts.isFunctionExpression(init)) {
        const fnName = node.name.text;
        if (init.body) {
          if (ts.isBlock(init.body)) {
            // Block body: const fn = () => { return req.body; }
            const returnTaint = extractReturnTaint(sf, init.body, fnName);
            functionReturns.set(fnName, returnTaint);
          } else {
            // Expression body: const fn = () => req.body
            const retText = init.body.getText(sf);
            if (isSourceExpression(retText)) {
              functionReturns.set(fnName, {
                sourceExpr: retText,
                sourceLine: getLineNumber(sf, init.body.getStart(sf)),
                path: [retText, `${fnName}()`],
                sanitizers: [],
              });
            }
          }
        }
      }
    }
  });
  return functionReturns;
}

/**
 * Shared analysis core used by all public entry points.
 *
 * When `program` is provided, the checker enables type-aware sink filtering
 * (shadowed local functions suppressed); otherwise falls back to pure
 * string-match (the pre-Phase-3 behavior).
 *
 * When `moduleGraph` + `summaries` are BOTH provided alongside `program`,
 * cross-file taint propagation activates: Call expressions whose callee
 * resolves to an imported symbol are checked against the callee's function
 * summary, and cross-module sinks produce findings tagged `crossFile: true`.
 * This is the v0.7 capability; all three knobs must align.
 */
function trackTaintCore(
  sf: ts.SourceFile,
  program?: ts.Program,
  moduleGraph?: ModuleGraph,
  summaries?: SummaryCache,
): TaintFinding[] {
  const findings: TaintFinding[] = [];
  const taintMap = new ScopedTaintMap();
  const functionReturns = collectFunctionReturns(sf);

  const ctx: TaintContext = {
    sf,
    taintMap,
    functionReturns,
    findings,
    program,
    checker: program?.getTypeChecker(),
    moduleGraph,
    summaries,
    conditionalImports: new Set<string>(),
  };

  // Phase 2: Walk statements with scope tracking, check sinks
  function walkWithScopes(node: ts.Node): void {
    // Push scope at function and block boundaries (const/let are block-scoped)
    const isScope = ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) ||
      ts.isArrowFunction(node) || ts.isMethodDeclaration(node) || ts.isBlock(node);
    if (isScope) taintMap.push();

    handleVariableDeclaration(ctx, node);
    handleAssignment(ctx, node);
    handlePromiseCallback(ctx, node);
    checkCallSink(ctx, node);
    checkCrossFileCallSink(ctx, node);
    checkCrossFileMethodCall(ctx, node);
    checkNewExpressionSink(ctx, node);
    checkRpcSink(ctx, node);
    checkPropertySink(ctx, node);
    checkJsxSink(ctx, node);

    ts.forEachChild(node, walkWithScopes);

    if (isScope) taintMap.pop();
  }
  ts.forEachChild(sf, walkWithScopes);

  return findings;
}

/**
 * Analyze a single file in isolation (no shared Program — no type-aware filter).
 * Convenience wrapper for unit tests and the pre-Phase-3 code path.
 */
export function trackTaint(fileName: string, content: string): TaintFinding[] {
  return trackTaintCore(parseFile(fileName, content));
}

/**
 * Analyze a file within a shared ts.Program — enables type-aware sink
 * filtering (resolveSinkSymbol). The caller is responsible for obtaining
 * `sf` via `program.getSourceFile(file)` and passing the same Program each
 * call so the TypeChecker is reusable across files.
 */
export function trackTaintInProgram(
  sf: ts.SourceFile,
  program: ts.Program,
): TaintFinding[] {
  return trackTaintCore(sf, program);
}

/**
 * v0.7 Phase 2 entry point: whole-program taint propagation.
 *
 * Enables cross-module taint flows by consulting the function-summary
 * cache at every cross-module call site. Falls back transparently to
 * single-file behavior when the module-graph is null (e.g., when
 * buildProgram preflight-bailed on PROGRAM_MODE_MAX_FILES).
 *
 * The caller owns the lifetimes of `moduleGraph` and `summaries` — both
 * should be constructed once per scan and reused across every file so the
 * cache actually accumulates. Passing a fresh SummaryCache per file would
 * defeat the purpose (every cross-module callee gets re-analyzed).
 */
export function trackTaintInProgramWithGraph(
  sf: ts.SourceFile,
  program: ts.Program,
  moduleGraph: ModuleGraph | null,
  summaries: SummaryCache,
): TaintFinding[] {
  return trackTaintCore(sf, program, moduleGraph ?? undefined, summaries);
}

function handleVariableDeclaration(ctx: TaintContext, node: ts.Node): void {
  if (!ts.isVariableDeclaration(node) || !node.initializer || !node.name) return;

  // v0.8 Phase 5 (policy §4): detect conditional dynamic import and
  // record the binding name so downstream sinks downgrade confidence.
  if (ts.isIdentifier(node.name) && isConditionalDynamicImport(node.initializer)) {
    ctx.conditionalImports.add(node.name.text);
  }

  // Simple identifier: const x = <expr>
  if (ts.isIdentifier(node.name)) {
    const taint = resolveTaint(ctx, node.initializer);
    if (taint) {
      ctx.taintMap.set(node.name.text, { ...taint, path: [...taint.path, node.name.text] });
    } else {
      // Explicitly clean — shadows any outer tainted entry with the same name
      ctx.taintMap.markClean(node.name.text);
    }
  }

  // Object destructuring: const { a, b } = req.body / await request.json()
  if (ts.isObjectBindingPattern(node.name)) {
    const sourceEntry = resolveTaint(ctx, node.initializer);

    if (sourceEntry) {
      for (const element of node.name.elements) {
        if (ts.isBindingElement(element) && ts.isIdentifier(element.name)) {
          ctx.taintMap.set(element.name.text, {
            ...sourceEntry,
            path: [...sourceEntry.path, element.name.text],
          });
        }
      }
    }
  }

  // Array destructuring: const [id, name] = req.body
  if (ts.isArrayBindingPattern(node.name)) {
    const sourceEntry = resolveTaint(ctx, node.initializer);

    if (sourceEntry) {
      for (const element of node.name.elements) {
        if (ts.isBindingElement(element) && ts.isIdentifier(element.name)) {
          ctx.taintMap.set(element.name.text, {
            ...sourceEntry,
            path: [...sourceEntry.path, element.name.text],
          });
        }
      }
    }
  }
}

function handleAssignment(ctx: TaintContext, node: ts.Node): void {
  if (!ts.isBinaryExpression(node) || node.operatorToken.kind !== ts.SyntaxKind.EqualsToken) return;
  if (!ts.isIdentifier(node.left)) return;

  const taint = resolveTaint(ctx, node.right);
  if (taint) {
    ctx.taintMap.set(node.left.text, { ...taint, path: [...taint.path, node.left.text] });
  } else {
    // Re-assignment to safe value clears taint
    ctx.taintMap.markClean(node.left.text);
  }
}

/**
 * Handle .then()/.catch() on tainted promises — callback parameter inherits taint.
 * Pattern: taintedPromise.then((data) => { exec(data); })
 */
function handlePromiseCallback(ctx: TaintContext, node: ts.Node): void {
  if (!ts.isCallExpression(node)) return;
  if (!ts.isPropertyAccessExpression(node.expression)) return;

  const methodName = node.expression.name.text;
  if (methodName !== 'then' && methodName !== 'catch') return;
  if (node.arguments.length === 0) return;

  // Check if the object is tainted
  const objExpr = node.expression.expression;
  const objTaint = ts.isIdentifier(objExpr) ? ctx.taintMap.get(objExpr.text) : null;
  if (!objTaint) return;

  // First argument should be a callback — mark its first parameter as tainted
  const callback = node.arguments[0];
  if ((ts.isArrowFunction(callback) || ts.isFunctionExpression(callback)) && callback.parameters.length > 0) {
    const param = callback.parameters[0];
    if (ts.isIdentifier(param.name)) {
      ctx.taintMap.set(param.name.text, { ...objTaint, path: [...objTaint.path, `.${methodName}()`, param.name.text] });
    }
  }
}

function checkCallSink(ctx: TaintContext, node: ts.Node): void {
  if (!ts.isCallExpression(node)) return;

  const callText = node.expression.getText(ctx.sf);

  // Skip safe chained methods (Supabase .from().eq() etc.)
  if (ts.isPropertyAccessExpression(node.expression)) {
    if (SAFE_CHAIN_METHODS.has(node.expression.name.text)) return;
  }

  const sinkMeta = getSinkMeta(callText);
  if (!sinkMeta) return;

  // Type-aware filter (Phase 3c): for ambient-module sink names (exec,
  // spawn, …), confirm the identifier actually resolves to @types/node.
  // If it resolves to a locally-shadowed function, this is a FP — suppress.
  // `null` resolution = bail to string-match (fail-open — don't drop TPs).
  if (ctx.checker && isAmbientSinkCandidate(callText)) {
    const resolved = resolveSinkSymbol(node, ctx.checker);
    if (resolved && resolved.isSink === false) {
      return; // confirmed shadowed local — not a real sink
    }
  }

  for (const arg of node.arguments) {
    const taint = findTaintInExpr(ctx, arg);
    if (taint) {
      // Per-CWE check: does any sanitizer on the path neutralize this sink's CWE?
      const neutralized = taint.sanitizers.some((s) => sanitizesForCwe(s, sinkMeta.cwe));
      if (neutralized) continue; // sanitized for this specific vulnerability class

      // v0.8 Phase 6: URL-regex-whitelist — suppress CWE-918 when the
      // sink is nested inside an if-guard / conditional whose condition
      // tests the same identifier via `<regex>.test(<id>)`. Common in
      // webhook allow-list handlers (cal-com intercom pattern from v0.7
      // dogfood). Only suppresses the SSRF class — path-traversal /
      // open-redirect / other flows through the same var keep firing.
      if (sinkMeta.cwe === 918 && isInsideUrlRegexGuard(node, arg)) continue;

      // v0.8 Phase 5: if the callee's object is a conditionally-imported
      // var (cond ? await import(...) : await import(...)), downgrade
      // the single-file finding to confidence: 'medium' — the scanner
      // can't prove the branch taken at runtime.
      const conditionalObj =
        ts.isPropertyAccessExpression(node.expression) &&
        ts.isIdentifier(node.expression.expression) &&
        ctx.conditionalImports.has(node.expression.expression.text);
      ctx.findings.push({
        sourceExpr: taint.sourceExpr,
        sourceLine: taint.sourceLine,
        sinkName: callText,
        sinkLine: getLineNumber(ctx.sf, node.getStart(ctx.sf)),
        cwe: sinkMeta.cwe,
        owasp: sinkMeta.owasp,
        severity: sinkMeta.severity,
        category: sinkMeta.category,
        taintPath: [...taint.path, callText + '()'],
        ...(conditionalObj ? { confidence: 'medium' as const } : {}),
      });
      break; // one finding per sink call
    }
  }
}

/**
 * v0.7 Phase 2: cross-file taint sink detection.
 *
 * Activates only when `ctx.moduleGraph`, `ctx.summaries`, and `ctx.program`
 * are all present. Handles the canonical pattern:
 *
 *   // lib/utils.ts
 *   export function runCmd(cmd: string) { exec(cmd); }
 *
 *   // api/admin.ts
 *   import { runCmd } from '../lib/utils';
 *   runCmd(req.body.command);   // ← cross-file sink
 *
 * For each CallExpression whose callee is a simple Identifier:
 *   1. Skip if it's already a local sink (existing `checkCallSink` emits).
 *   2. Resolve the local name to its origin file + exportName via the
 *      module-graph (`resolveSymbolOrigin` follows re-exports up to
 *      MAX_REEXPORT_HOPS = 5).
 *   3. Find the exported function node in the origin file.
 *   4. Get (or build) the function summary.
 *   5. For each tainted argument whose position is a sink-reaching
 *      parameter per the summary, emit a cross-file finding — unless the
 *      summary's `sanitizesCwes` neutralizes the specific CWE, or an
 *      explicit sanitizer on the taint path handles it.
 *
 * Non-goals here:
 *   - Method calls (`obj.foo(x)`) — Phase 2 handles only bare identifiers.
 *     Property-access callees need symbol resolution we haven't wired up.
 *   - Taint returned across modules (the policy §2 generic pass-through
 *     case) — this would require the taint-tracker to consume summary
 *     `returnsTainted` when a call result is assigned to a variable. Phase
 *     2 only handles sink-reaching direction; return-taint is a later
 *     refinement.
 *   - Global-state mutation (policy §6) — intentionally not tracked. A
 *     regression test pins this (`globalThis.x = tainted` in one file +
 *     `exec(globalThis.x)` in another must NOT emit a cross-file finding).
 */
function checkCrossFileCallSink(ctx: TaintContext, node: ts.Node): void {
  if (!ts.isCallExpression(node)) return;
  if (!ctx.moduleGraph || !ctx.summaries || !ctx.program) return;

  // Only simple `foo(...)` callees in this pass. `obj.foo(...)` and
  // computed callees are out of scope for Phase 2.
  if (!ts.isIdentifier(node.expression)) return;
  const calleeName = node.expression.text;

  // Resolve via module-graph FIRST. null = locally-defined, not imported,
  // OR terminates in an external module, OR re-export chain > 5 hops.
  // Any of those means "nothing cross-file to do here."
  //
  // We do NOT pre-filter on `getSinkMeta(calleeName)` — Hunter Finding 2:
  // custom wrappers that shadow a TAINT_SINKS key (e.g. an auth-injecting
  // `fetch` imported from './my-fetch', a logging-wrapped `exec` imported
  // from './command-runner') are extremely common in Next.js codebases.
  // Filtering here bailed out on the cross-file path entirely, losing
  // crossFileOrigin metadata or (in the benign-wrapper case) leaving a
  // single-file FP unsuppressable. Reporter-side dedup on
  // (file, line, cwe) handles the overlap when checkCallSink and
  // checkCrossFileCallSink both fire on the same import.
  const origin = ctx.moduleGraph.resolveSymbolOrigin(ctx.sf.fileName, calleeName);
  if (origin === null) return;

  // Locate the exported function in the origin file and summarize it.
  const originSf = ctx.program.getSourceFile(origin.file);
  if (originSf === undefined) return;

  const fnNode = findExportedFunction(originSf, origin.exportName);
  if (fnNode === null) return;

  const summary = buildSummary(
    fnNode,
    origin.exportName,
    ctx.program,
    ctx.moduleGraph,
    ctx.summaries,
  );
  if (summary === null) return;

  // v0.8 Phase 2: HOC binding detection (policy §9).
  // If the outer fn returns a function that internally invokes one of
  // its own params, AND any binding-site argument is an inline function
  // whose body calls a sink, emit at the binding site. The composed
  // proxy will funnel any later invocation into the sink; flagging the
  // binding is a static structural signal (no tainted value required at
  // this line). Confidence stays 'medium' pending the v0.8 Phase 7
  // precision measurement that validates cross-file emissions.
  if (summary.returnsFunctionThatCallsSink) {
    for (const arg of node.arguments) {
      if (!ts.isArrowFunction(arg) && !ts.isFunctionExpression(arg)) continue;
      const innerSinkCwes = collectSinkCwesInFunction(arg, ctx.checker);
      if (innerSinkCwes.size === 0) continue;
      for (const cwe of innerSinkCwes) {
        const sinkMeta = findSinkMetaByCwe(cwe);
        if (sinkMeta === null) continue;
        ctx.findings.push({
          sourceExpr: `HOC-wrapped sink-fn via ${calleeName}(…)`,
          sourceLine: getLineNumber(ctx.sf, arg.getStart(ctx.sf)),
          sinkName: calleeName,
          sinkLine: getLineNumber(ctx.sf, node.getStart(ctx.sf)),
          cwe,
          owasp: sinkMeta.owasp,
          severity: sinkMeta.severity,
          category: sinkMeta.category,
          taintPath: [
            `HOC binding: inner fn calls sink (CWE-${cwe})`,
            `${calleeName}() [cross-file → ${origin.exportName} in ${origin.file}]`,
          ],
          crossFile: true,
          crossFileOrigin: origin.file,
          confidence: 'medium',
        });
      }
    }
  }

  // For each argument position, check if it's tainted AND summary says it
  // reaches a sink AND the sanitizer panel doesn't neutralize.
  for (let i = 0; i < node.arguments.length; i++) {
    const rule = summary.params[i];
    if (rule === undefined) break; // more args passed than declared — var-args etc.
    if (rule.sinkCwes.length === 0) continue;

    const taint = findTaintInExpr(ctx, node.arguments[i]);
    if (taint === null) continue;

    // Summary-level sanitizer (e.g. cross-file fn wraps arg in Zod parse)
    // trumps CWE-specific propagation.
    for (const cwe of rule.sinkCwes) {
      if (summary.sanitizesCwes.includes(cwe)) continue;
      // Per-taint-path sanitizers (applied upstream in the caller's file).
      const neutralized = taint.sanitizers.some((s) => sanitizesForCwe(s, cwe));
      if (neutralized) continue;

      const sinkMeta = findSinkMetaByCwe(cwe);
      if (sinkMeta === null) continue; // shouldn't happen — registry-derived CWE

      ctx.findings.push({
        sourceExpr: taint.sourceExpr,
        sourceLine: taint.sourceLine,
        sinkName: calleeName,
        sinkLine: getLineNumber(ctx.sf, node.getStart(ctx.sf)),
        cwe,
        owasp: sinkMeta.owasp,
        severity: sinkMeta.severity,
        category: sinkMeta.category,
        taintPath: [
          ...taint.path,
          `${calleeName}() [cross-file → ${origin.exportName} in ${origin.file}]`,
        ],
        crossFile: true,
        crossFileOrigin: origin.file,
        // v0.7 calibration hedge: cross-file findings ship at
        // confidence='medium' pending a larger-sample precision
        // measurement. Sample size on the initial 4-corpus dogfood
        // (n=2) was below the n>=20 statistical-validity threshold;
        // 'medium' is a conservative hedge against measurement
        // uncertainty, not a validated reclassification. Single-file
        // findings retain their scanner-default confidence.
        confidence: 'medium',
      });
      // Hunter Finding 3: no `break` — when a single param reaches
      // multiple sink classes (e.g. db.query AND exec inside the same
      // imported function), each CWE gets its own finding with the
      // correct severity/owasp metadata. Matches checkCallSink's
      // per-CWE emit. Reporter-side dedup handles the rare case where
      // two CWEs map to identical file+line and the consumer wants
      // just one.
    }
  }
}

/**
 * v0.8 Phase 4: method-call cross-file via TypeChecker.
 *
 * Complements `checkCrossFileCallSink` which handles only bare-identifier
 * callees. For `obj.method(x)` where `obj` is an imported namespace /
 * object and `.method`'s declaration lives in another user-land file
 * (not node_modules, not lib.*.d.ts), resolve the method symbol via the
 * TypeChecker, locate its function-like node (PropertyAssignment
 * initializer or MethodDeclaration shorthand), summarize it, and apply
 * the standard per-argument sink-CWE propagation.
 *
 * Confidence is fixed at 'medium' per gap #4 policy: method-call
 * resolution relies on the checker finding a single clean declaration,
 * which can be brittle under overloads, type-widening, or
 * conditional-import patterns.
 *
 * Declaration declined (→ return) when:
 *   - Object / method is not a bare identifier (computed callees OOS)
 *   - method name is in SAFE_CHAIN_METHODS (Supabase .from()/.eq() etc.)
 *   - Symbol can't be resolved or aliased
 *   - All declarations live in node_modules / @types / lib.*.d.ts / same
 *     file (not cross-file)
 *   - Declaration doesn't point to a summarizable function node
 */
function checkCrossFileMethodCall(ctx: TaintContext, node: ts.Node): void {
  if (!ts.isCallExpression(node)) return;
  if (!ctx.moduleGraph || !ctx.summaries || !ctx.program || !ctx.checker) return;
  if (!ts.isPropertyAccessExpression(node.expression)) return;
  const methodAccess = node.expression;
  if (!ts.isIdentifier(methodAccess.expression)) return;
  if (!ts.isIdentifier(methodAccess.name)) return;

  const objIdent = methodAccess.expression;
  const methodIdent = methodAccess.name;
  const objName = objIdent.text;
  const methodName = methodIdent.text;
  const fullCalleeName = `${objName}.${methodName}`;

  if (SAFE_CHAIN_METHODS.has(methodName)) return;

  let methodSymbol = ctx.checker.getSymbolAtLocation(methodIdent);
  if (!methodSymbol) return;
  if (methodSymbol.flags & ts.SymbolFlags.Alias) {
    try {
      methodSymbol = ctx.checker.getAliasedSymbol(methodSymbol);
    } catch {
      return;
    }
  }

  const decls = methodSymbol.getDeclarations() ?? [];
  if (decls.length === 0) return;

  let fnNode: SummarizableFn | null = null;
  let originFile: string | null = null;
  for (const decl of decls) {
    const declFile = decl.getSourceFile().fileName;
    if (declFile.includes('/node_modules/')) continue;
    if (declFile.includes('/@types/')) continue;
    if (/\/lib\.[^/]+\.d\.ts$/.test(declFile)) continue;
    if (declFile === ctx.sf.fileName) continue;

    if (ts.isPropertyAssignment(decl) && isSummarizable(decl.initializer)) {
      fnNode = decl.initializer;
      originFile = declFile;
      break;
    }
    if (ts.isMethodDeclaration(decl)) {
      fnNode = decl;
      originFile = declFile;
      break;
    }
  }
  if (fnNode === null || originFile === null) return;

  const summary = buildSummary(
    fnNode,
    methodName,
    ctx.program,
    ctx.moduleGraph,
    ctx.summaries,
  );
  if (summary === null) return;

  for (let i = 0; i < node.arguments.length; i++) {
    const rule = summary.params[i];
    if (rule === undefined) break;
    if (rule.sinkCwes.length === 0) continue;

    const taint = findTaintInExpr(ctx, node.arguments[i]);
    if (taint === null) continue;

    for (const cwe of rule.sinkCwes) {
      if (summary.sanitizesCwes.includes(cwe)) continue;
      const neutralized = taint.sanitizers.some((s) => sanitizesForCwe(s, cwe));
      if (neutralized) continue;

      const sinkMeta = findSinkMetaByCwe(cwe);
      if (sinkMeta === null) continue;

      ctx.findings.push({
        sourceExpr: taint.sourceExpr,
        sourceLine: taint.sourceLine,
        sinkName: fullCalleeName,
        sinkLine: getLineNumber(ctx.sf, node.getStart(ctx.sf)),
        cwe,
        owasp: sinkMeta.owasp,
        severity: sinkMeta.severity,
        category: sinkMeta.category,
        taintPath: [
          ...taint.path,
          `${fullCalleeName}() [cross-file method → ${methodName} in ${originFile}]`,
        ],
        crossFile: true,
        crossFileOrigin: originFile,
        confidence: 'medium',
      });
    }
  }
}

/**
 * v0.8 Phase 6 helper: is the sink nested inside an if-guard or
 * conditional-expression whose condition contains `<anything>.test(arg)`
 * where `arg` is the tainted argument identifier? Used to suppress the
 * CWE-918 (SSRF) finding on common allow-list patterns:
 *
 *   if (REGEX.test(url)) await fetch(url);
 *
 * Walks ancestors up to the source file. Matches either a bare call
 * `.test(...)` or one nested inside a logical binary (`&& / ||`) so
 * patterns like `typeof url === 'string' && ALLOW.test(url)` work.
 */
function isInsideUrlRegexGuard(sinkNode: ts.Node, taintedArg: ts.Node): boolean {
  if (!ts.isIdentifier(taintedArg)) return false;
  const varName = taintedArg.text;

  const containsRegexTestOn = (expr: ts.Expression): boolean => {
    let result = false;
    const visit = (n: ts.Node): void => {
      if (result) return;
      if (
        ts.isCallExpression(n) &&
        ts.isPropertyAccessExpression(n.expression) &&
        ts.isIdentifier(n.expression.name) &&
        n.expression.name.text === 'test' &&
        n.arguments.length > 0 &&
        ts.isIdentifier(n.arguments[0]) &&
        n.arguments[0].text === varName
      ) {
        result = true;
        return;
      }
      ts.forEachChild(n, visit);
    };
    visit(expr);
    return result;
  };

  let parent: ts.Node | undefined = sinkNode.parent;
  while (parent !== undefined) {
    if (ts.isIfStatement(parent)) {
      if (containsRegexTestOn(parent.expression)) return true;
    } else if (ts.isConditionalExpression(parent)) {
      if (containsRegexTestOn(parent.condition)) return true;
    }
    parent = parent.parent;
  }
  return false;
}

/**
 * v0.8 Phase 5 helper: does the given expression look like a conditional
 * dynamic-import pattern? Matches
 *   cond ? await import('./a') : await import('./b')
 * and its variants (either branch, with or without the await, with
 * parentheses). A match means the scanner can't statically determine
 * which module was loaded, so downstream sinks should downgrade
 * confidence.
 */
function isConditionalDynamicImport(expr: ts.Expression): boolean {
  const unwrap = (e: ts.Expression): ts.Expression => {
    if (ts.isAwaitExpression(e)) return unwrap(e.expression);
    if (ts.isParenthesizedExpression(e)) return unwrap(e.expression);
    return e;
  };
  const u = unwrap(expr);
  if (!ts.isConditionalExpression(u)) return false;
  const isDynamicImportCall = (e: ts.Expression): boolean => {
    const inner = unwrap(e);
    return ts.isCallExpression(inner) && inner.expression.kind === ts.SyntaxKind.ImportKeyword;
  };
  return isDynamicImportCall(u.whenTrue) || isDynamicImportCall(u.whenFalse);
}

/**
 * v0.8 Phase 2 helper: collect distinct sink CWEs found inside the body
 * of an inline arrow / function-expression argument passed to an HOC
 * binding site. Uses the same registry + type-aware shadow check as the
 * single-file sink path, so a locally-shadowed `exec` inside the arrow
 * does NOT contribute.
 */
function collectSinkCwesInFunction(
  fn: ts.ArrowFunction | ts.FunctionExpression,
  checker: ts.TypeChecker | undefined,
): Set<number> {
  const cwes = new Set<number>();
  const visit = (n: ts.Node): void => {
    if (ts.isCallExpression(n)) {
      const callText = n.expression.getText();
      const meta = getSinkMeta(callText);
      if (meta !== undefined) {
        let shadowed = false;
        if (checker && isAmbientSinkCandidate(callText)) {
          const resolved = resolveSinkSymbol(n, checker);
          if (resolved && resolved.isSink === false) shadowed = true;
        }
        if (!shadowed) cwes.add(meta.cwe);
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(fn.body);
  return cwes;
}

/**
 * Reverse-lookup: given a CWE number, return a SinkMeta that represents
 * it. The registries keep multiple entries per CWE (e.g., `db.query`,
 * `pool.query`, `$queryRaw` all share CWE-89), and their SinkMeta is
 * consistent per-CWE in the current registry — the first match wins.
 */
function findSinkMetaByCwe(cwe: number): SinkMeta | null {
  for (const reg of [TAINT_SINKS, CONSTRUCTOR_SINKS, PROPERTY_SINKS, JSX_ATTRIBUTE_SINKS]) {
    for (const meta of Object.values(reg)) {
      if (meta.cwe === cwe) return meta;
    }
  }
  return null;
}

/**
 * Find the function declaration or expression associated with an exported
 * name in a source file. Covers:
 *   - `export function foo() {}`          → FunctionDeclaration
 *   - `export default function foo() {}`  → FunctionDeclaration
 *   - `export default function() {}`      → FunctionDeclaration (anonymous)
 *   - `export const foo = () => {}`        → ArrowFunction
 *   - `export const foo = function() {}`   → FunctionExpression
 *   - `export default (x) => x`            → ArrowFunction (via ExportAssignment)
 *   - `export { foo };` / `export { foo as bar };` — declaration-style
 *     named export (Hunter-surfaced): the export statement is separate
 *     from the function declaration. Resolves the exported name (or its
 *     alias source) back to a local FunctionDeclaration or
 *     VariableDeclaration in the same file.
 */
function findExportedFunction(
  sf: ts.SourceFile,
  exportedName: string,
): SummarizableFn | null {
  for (const stmt of sf.statements) {
    if (ts.isFunctionDeclaration(stmt)) {
      const mods = ts.canHaveModifiers(stmt) ? ts.getModifiers(stmt) : undefined;
      const hasExport = mods?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ?? false;
      const hasDefault = mods?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword) ?? false;
      if (!hasExport) continue;
      if (hasDefault && exportedName === 'default') return stmt;
      if (!hasDefault && stmt.name?.text === exportedName) return stmt;
    }

    if (ts.isVariableStatement(stmt)) {
      const mods = ts.canHaveModifiers(stmt) ? ts.getModifiers(stmt) : undefined;
      const hasExport = mods?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ?? false;
      if (!hasExport) continue;
      for (const decl of stmt.declarationList.declarations) {
        if (
          ts.isIdentifier(decl.name) &&
          decl.name.text === exportedName &&
          decl.initializer !== undefined &&
          isSummarizable(decl.initializer)
        ) {
          return decl.initializer;
        }
      }
    }

    if (ts.isExportAssignment(stmt) && exportedName === 'default') {
      const expr = stmt.expression;
      if (isSummarizable(expr)) return expr;
    }

    // `export { foo };` / `export { foo as bar };` — no moduleSpecifier
    // means this is a LOCAL named re-export. module-graph resolves the
    // exported name to this file; we need to trace `exportedName` back
    // through the alias (if any) to the local function / variable.
    //
    // Cross-module re-exports (`export { foo } from './other';`) have a
    // moduleSpecifier and are fully resolved by module-graph before they
    // reach this function — so we skip them here.
    if (
      ts.isExportDeclaration(stmt) &&
      stmt.moduleSpecifier === undefined &&
      stmt.exportClause !== undefined &&
      ts.isNamedExports(stmt.exportClause)
    ) {
      for (const spec of stmt.exportClause.elements) {
        if (spec.name.text !== exportedName) continue;
        const sourceName = (spec.propertyName ?? spec.name).text;
        for (const inner of sf.statements) {
          if (ts.isFunctionDeclaration(inner) && inner.name?.text === sourceName) {
            return inner;
          }
          if (ts.isVariableStatement(inner)) {
            for (const decl of inner.declarationList.declarations) {
              if (
                ts.isIdentifier(decl.name) &&
                decl.name.text === sourceName &&
                decl.initializer !== undefined &&
                isSummarizable(decl.initializer)
              ) {
                return decl.initializer;
              }
            }
          }
        }
      }
    }
  }
  return null;
}

function checkNewExpressionSink(ctx: TaintContext, node: ts.Node): void {
  if (!ts.isNewExpression(node)) return;

  const ctorName = node.expression.getText(ctx.sf);
  const sinkMeta = CONSTRUCTOR_SINKS[ctorName];
  if (!sinkMeta) return;

  for (const arg of node.arguments ?? []) {
    const taint = findTaintInExpr(ctx, arg);
    if (taint) {
      const neutralized = taint.sanitizers.some((s) => sanitizesForCwe(s, sinkMeta.cwe));
      if (neutralized) continue;

      ctx.findings.push({
        sourceExpr: taint.sourceExpr,
        sourceLine: taint.sourceLine,
        sinkName: `new ${ctorName}`,
        sinkLine: getLineNumber(ctx.sf, node.getStart(ctx.sf)),
        cwe: sinkMeta.cwe,
        owasp: sinkMeta.owasp,
        severity: sinkMeta.severity,
        category: sinkMeta.category,
        taintPath: [...taint.path, `new ${ctorName}()`],
      });
      break;
    }
  }
}

/**
 * Special sink: Supabase .rpc() — safe when function name is a static string,
 * SQL injection when the first argument (function name) contains tainted data.
 * Pattern: `supabase.rpc(\`search_${tableName}\`, { ... })`
 */
function checkRpcSink(ctx: TaintContext, node: ts.Node): void {
  if (!ts.isCallExpression(node)) return;
  if (!ts.isPropertyAccessExpression(node.expression)) return;
  if (node.expression.name.text !== 'rpc') return;
  if (node.arguments.length === 0) return;

  const firstArg = node.arguments[0];

  // Only flag if the function name argument is tainted
  const taint = findTaintInExpr(ctx, firstArg);
  if (!taint) return;

  // Per-CWE check
  const neutralized = taint.sanitizers.some((s) => sanitizesForCwe(s, RPC_SINK_META.cwe));
  if (neutralized) return;

  ctx.findings.push({
    sourceExpr: taint.sourceExpr,
    sourceLine: taint.sourceLine,
    sinkName: '.rpc()',
    sinkLine: getLineNumber(ctx.sf, node.getStart(ctx.sf)),
    cwe: RPC_SINK_META.cwe,
    owasp: RPC_SINK_META.owasp,
    severity: RPC_SINK_META.severity,
    category: RPC_SINK_META.category,
    taintPath: [...taint.path, '.rpc()'],
  });
}

function checkPropertySink(ctx: TaintContext, node: ts.Node): void {
  if (!ts.isBinaryExpression(node) || node.operatorToken.kind !== ts.SyntaxKind.EqualsToken) return;
  if (!ts.isPropertyAccessExpression(node.left)) return;

  const propName = node.left.name.text;
  // Check both function-call sinks and property-assignment sinks
  const sinkMeta = getSinkMeta(propName) ?? PROPERTY_SINKS[propName];
  if (!sinkMeta) return;

  const taint = findTaintInExpr(ctx, node.right);
  if (taint) {
    // Per-CWE check: does any sanitizer on the path neutralize this sink's CWE?
    const neutralized = taint.sanitizers.some((s) => sanitizesForCwe(s, sinkMeta.cwe));
    if (neutralized) return; // sanitized for this specific vulnerability class

    ctx.findings.push({
      sourceExpr: taint.sourceExpr,
      sourceLine: taint.sourceLine,
      sinkName: propName,
      sinkLine: getLineNumber(ctx.sf, node.getStart(ctx.sf)),
      cwe: sinkMeta.cwe,
      owasp: sinkMeta.owasp,
      severity: sinkMeta.severity,
      category: sinkMeta.category,
      taintPath: [...taint.path, propName + ' ='],
    });
  }
}

/**
 * Check JSX attributes for taint sinks — React's dangerouslySetInnerHTML.
 * Pattern: <div dangerouslySetInnerHTML={{ __html: taintedVar }} />
 */
function checkJsxSink(ctx: TaintContext, node: ts.Node): void {
  if (!ts.isJsxAttribute(node)) return;
  if (!ts.isIdentifier(node.name)) return;

  const attrName = node.name.text;
  const sinkMeta = JSX_ATTRIBUTE_SINKS[attrName];
  if (!sinkMeta) return;

  // The value is {{ __html: expr }}, which in the AST is a JsxExpression
  // containing an ObjectLiteralExpression with a property assignment
  if (!node.initializer || !ts.isJsxExpression(node.initializer)) return;
  const expr = node.initializer.expression;
  if (!expr) return;

  // Case 1: dangerouslySetInnerHTML={{ __html: taintedVar }}
  if (ts.isObjectLiteralExpression(expr)) {
    for (const prop of expr.properties) {
      if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name) && prop.name.text === '__html') {
        const taint = findTaintInExpr(ctx, prop.initializer);
        if (taint) {
          const neutralized = taint.sanitizers.some((s) => sanitizesForCwe(s, sinkMeta.cwe));
          if (neutralized) return;

          ctx.findings.push({
            sourceExpr: taint.sourceExpr,
            sourceLine: taint.sourceLine,
            sinkName: 'dangerouslySetInnerHTML',
            sinkLine: getLineNumber(ctx.sf, node.getStart(ctx.sf)),
            cwe: sinkMeta.cwe,
            owasp: sinkMeta.owasp,
            severity: sinkMeta.severity,
            category: sinkMeta.category,
            taintPath: [...taint.path, 'dangerouslySetInnerHTML'],
          });
        }
      }
    }
  }

  // Case 2: dangerouslySetInnerHTML={taintedVar} (variable containing the object)
  if (ts.isIdentifier(expr)) {
    const taint = ctx.taintMap.get(expr.text);
    if (taint) {
      const neutralized = taint.sanitizers.some((s) => sanitizesForCwe(s, sinkMeta.cwe));
      if (neutralized) return;

      ctx.findings.push({
        sourceExpr: taint.sourceExpr,
        sourceLine: taint.sourceLine,
        sinkName: 'dangerouslySetInnerHTML',
        sinkLine: getLineNumber(ctx.sf, node.getStart(ctx.sf)),
        cwe: sinkMeta.cwe,
        owasp: sinkMeta.owasp,
        severity: sinkMeta.severity,
        category: sinkMeta.category,
        taintPath: [...taint.path, 'dangerouslySetInnerHTML'],
      });
    }
  }
}

/**
 * Resolve taint for an expression node.
 */
function resolveTaint(ctx: TaintContext, node: ts.Node): TaintEntry | null {
  // Unwrap AwaitExpression: `await request.json()` → `request.json()`
  if (ts.isAwaitExpression(node)) {
    return resolveTaint(ctx, node.expression);
  }

  // Unwrap NonNullExpression: `expr!` → `expr`
  if (ts.isNonNullExpression(node)) {
    return resolveTaint(ctx, node.expression);
  }

  // Unwrap TypeAssertion: `expr as Type` → `expr`
  if (ts.isAsExpression(node)) {
    return resolveTaint(ctx, node.expression);
  }

  // Unwrap ParenthesizedExpression: `(expr)` → `expr`
  if (ts.isParenthesizedExpression(node)) {
    return resolveTaint(ctx, node.expression);
  }

  const text = node.getText(ctx.sf);
  const line = getLineNumber(ctx.sf, node.getStart(ctx.sf));

  // Direct source
  if (isSourceExpression(text)) {
    return { sourceExpr: text, sourceLine: line, path: [text], sanitizers: [] };
  }

  // Tainted variable
  if (ts.isIdentifier(node) && ctx.taintMap.has(node.text)) {
    return ctx.taintMap.get(node.text)!;
  }

  // Property access: taintedObj.prop or source.prop
  if (ts.isPropertyAccessExpression(node)) {
    const objText = node.expression.getText(ctx.sf);
    if (isSourceExpression(objText)) {
      return { sourceExpr: objText, sourceLine: line, path: [objText, text], sanitizers: [] };
    }
    const objTaint = ts.isIdentifier(node.expression) ? ctx.taintMap.get(node.expression.text) : null;
    if (objTaint) return { ...objTaint, path: [...objTaint.path, text] };
  }

  // Element access (bracket notation): taintedObj[key] or obj[taintedKey]
  if (ts.isElementAccessExpression(node)) {
    // Case 1: accessing a tainted object with any key
    const objTaint = ts.isIdentifier(node.expression) ? ctx.taintMap.get(node.expression.text) : null;
    if (objTaint) return { ...objTaint, path: [...objTaint.path, text] };
    // Case 2: accessing any object with a tainted key (prototype pollution risk)
    const keyTaint = findTaintInExpr(ctx, node.argumentExpression);
    if (keyTaint) return { ...keyTaint, path: [...keyTaint.path, `[${node.argumentExpression.getText(ctx.sf)}]`] };
  }

  // Call expression
  if (ts.isCallExpression(node)) {
    const callName = node.expression.getText(ctx.sf);

    // Record sanitizer but propagate taint — checked at sink
    if (isSanitizer(callName)) {
      for (const arg of node.arguments) {
        const t = findTaintInExpr(ctx, arg);
        if (t) {
          return { ...t, sanitizers: [...t.sanitizers, callName], path: [...t.path, callName + '()'] };
        }
      }
      return null;
    }

    // JSON.parse propagates taint
    if (callName === 'JSON.parse') {
      for (const arg of node.arguments) {
        const t = findTaintInExpr(ctx, arg);
        if (t) return { ...t, path: [...t.path, 'JSON.parse()'] };
      }
    }

    // Same-file function return
    const fnName = ts.isIdentifier(node.expression) ? node.expression.text : null;
    if (fnName && ctx.functionReturns.has(fnName)) {
      return ctx.functionReturns.get(fnName) ?? null;
    }

    // v0.8 Phase 3: cross-file aware pass-through (policy §2).
    // Consult the exported-fn summary when available:
    //   (a) sanitizesCwes > 0 → suppress propagation entirely — the
    //       wrapper neutralizes taint through a known sanitizer, so the
    //       return is not a credible taint carrier (CLEAN-07-shaped
    //       FP prevention when the result is assigned to a variable).
    //   (b) any arg is tainted AND the matching param has
    //       returnsTainted=true → propagate with origin-annotated path.
    // When no summary is available, fall through to the optimistic
    // fallback below. Wires the v0.7-populated summary.params[i].
    // returnsTainted field into cross-file analysis.
    if (fnName && ctx.moduleGraph && ctx.summaries && ctx.program) {
      const origin = ctx.moduleGraph.resolveSymbolOrigin(ctx.sf.fileName, fnName);
      if (origin !== null) {
        const originSf = ctx.program.getSourceFile(origin.file);
        if (originSf !== undefined) {
          const fnNode = findExportedFunction(originSf, origin.exportName);
          if (fnNode !== null) {
            const summary = buildSummary(
              fnNode,
              origin.exportName,
              ctx.program,
              ctx.moduleGraph,
              ctx.summaries,
            );
            if (summary !== null) {
              if (summary.sanitizesCwes.length > 0) return null;
              for (let i = 0; i < node.arguments.length; i++) {
                const rule = summary.params[i];
                if (rule === undefined) break;
                if (!rule.returnsTainted) continue;
                const t = findTaintInExpr(ctx, node.arguments[i]);
                if (t !== null) {
                  return {
                    ...t,
                    path: [
                      ...t.path,
                      `${fnName}()[→ ${origin.exportName} in ${origin.file}]`,
                    ],
                  };
                }
              }
            }
          }
        }
      }
    }

    // Method call with .safeParse / .parse (Zod)
    if (ts.isPropertyAccessExpression(node.expression)) {
      const methodName = node.expression.name.text;
      // Use full qualified name (e.g. "URL.parse") for blocklist check
      if (isSanitizer(callName)) {
        for (const arg of node.arguments) {
          const t = findTaintInExpr(ctx, arg);
          if (t) {
            return { ...t, sanitizers: [...t.sanitizers, methodName], path: [...t.path, methodName + '()'] };
          }
        }
        return null;
      }

      // Method call on tainted object: taintedVar.trim(), .slice(), .toLowerCase()
      // Taint propagates through non-sanitizer methods
      const objExpr = node.expression.expression;
      const objTaint = ts.isIdentifier(objExpr) ? ctx.taintMap.get(objExpr.text) : null;
      if (objTaint) {
        return { ...objTaint, path: [...objTaint.path, `${objExpr.getText(ctx.sf)}.${methodName}()`] };
      }
    }

    // Function call with tainted argument (non-sanitizer, non-sink)
    // e.g. buildQuery(taintedVar) → result carries taint
    for (const arg of node.arguments) {
      const argTaint = findTaintInExpr(ctx, arg);
      if (argTaint) {
        return { ...argTaint, path: [...argTaint.path, callName + '()'] };
      }
    }
  }

  // Template literal
  if (ts.isTemplateExpression(node)) {
    for (const span of node.templateSpans) {
      const t = findTaintInExpr(ctx, span.expression);
      if (t) return { ...t, path: [...t.path, 'template`...`'] };
    }
  }

  // String concatenation
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const lt = findTaintInExpr(ctx, node.left);
    if (lt) return { ...lt, path: [...lt.path, 'concat'] };
    const rt = findTaintInExpr(ctx, node.right);
    if (rt) return { ...rt, path: [...rt.path, 'concat'] };
  }

  // Spread
  if (ts.isSpreadElement(node) || ts.isSpreadAssignment(node)) {
    const t = findTaintInExpr(ctx, node.expression);
    if (t) return { ...t, path: [...t.path, '...spread'] };
  }

  // Nullish coalesce (??), logical OR (||), logical AND (&&)
  // Either side can be the result, so check both
  if (ts.isBinaryExpression(node) && (
    node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken ||
    node.operatorToken.kind === ts.SyntaxKind.BarBarToken ||
    node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken
  )) {
    const lt = findTaintInExpr(ctx, node.left);
    if (lt) return lt;
    return findTaintInExpr(ctx, node.right);
  }

  // Ternary: cond ? tainted : safe
  if (ts.isConditionalExpression(node)) {
    const tt = findTaintInExpr(ctx, node.whenTrue);
    if (tt) return tt;
    return findTaintInExpr(ctx, node.whenFalse);
  }

  return null;
}

/**
 * Check if an expression node references any tainted variable.
 */
function findTaintInExpr(ctx: TaintContext, node: ts.Node): TaintEntry | null {
  // Unwrap NonNullExpression: `expr!` → `expr`
  if (ts.isNonNullExpression(node)) {
    return findTaintInExpr(ctx, node.expression);
  }

  // Unwrap TypeAssertion: `expr as Type` → `expr`
  if (ts.isAsExpression(node)) {
    return findTaintInExpr(ctx, node.expression);
  }

  const text = node.getText(ctx.sf);

  if (ts.isIdentifier(node) && ctx.taintMap.has(node.text)) {
    return ctx.taintMap.get(node.text)!;
  }

  if (isSourceExpression(text)) {
    return { sourceExpr: text, sourceLine: getLineNumber(ctx.sf, node.getStart(ctx.sf)), path: [text], sanitizers: [] };
  }

  if (ts.isPropertyAccessExpression(node)) {
    const objName = ts.isIdentifier(node.expression) ? node.expression.text : node.expression.getText(ctx.sf);
    if (ctx.taintMap.has(objName)) return ctx.taintMap.get(objName)!;
  }

  if (ts.isElementAccessExpression(node)) {
    const objName = ts.isIdentifier(node.expression) ? node.expression.text : null;
    if (objName && ctx.taintMap.has(objName)) return ctx.taintMap.get(objName)!;
    const keyTaint = findTaintInExpr(ctx, node.argumentExpression);
    if (keyTaint) return keyTaint;
  }

  if (ts.isTemplateExpression(node)) {
    for (const span of node.templateSpans) {
      const t = findTaintInExpr(ctx, span.expression);
      if (t) return t;
    }
  }

  if (ts.isBinaryExpression(node)) {
    const lt = findTaintInExpr(ctx, node.left);
    if (lt) return lt;
    return findTaintInExpr(ctx, node.right);
  }

  return null;
}
