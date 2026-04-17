/**
 * Control-flow-domination helpers for recognising boolean-returning guards
 * that gate a subsequent sink call.
 *
 * Extracted from function-summary.ts so both the cross-file summary builder
 * (exporter-side guard recognition, v0.9.1) and the per-file taint tracker
 * (consumer-side guard recognition, v0.11 Cluster B + Z3) can share a
 * single source of truth. Behavior is preserved byte-for-byte during
 * extraction — no semantic change lands here.
 *
 * The module is scoped narrowly to the "does a condition dominate this
 * sink call on a specific parameter identifier?" question. It knows
 * nothing about taint, sinks, or summaries — callers provide the
 * CallExpression and the parameter name, get back a boolean.
 *
 * Pure ts-node operations. No file I/O, no module-graph lookups, no
 * TypeChecker.
 */
import ts from 'typescript';

/**
 * Node kinds that {@link detectGuard} can analyse. Mirrors the
 * SummarizableFn union in function-summary.ts; duplicated here to keep
 * this module free of a back-import that would cycle.
 */
type GuardAnalyzableFn =
  | ts.FunctionDeclaration
  | ts.MethodDeclaration
  | ts.ArrowFunction
  | ts.FunctionExpression;

/**
 * Does the function body recognise as a boolean-returning guard that
 * narrows its first parameter for one of the recognised sink CWEs?
 *
 * Returns the CWE numbers this function guards. Empty means "not a
 * recognised guard". Initial v0.11 scope: CWE-918 (SSRF) only; further
 * classes expand as canary data demands — do not preemptively widen.
 *
 * Recognition rules:
 *
 *   - At least ONE return (or arrow expression body) must contain a
 *     recognised narrowing expression on `firstParamName`.
 *   - Every OTHER return must be a boolean literal (`true` / `false`).
 *     Safe-default fallbacks in catch/else branches remain a guard;
 *     arbitrary non-boolean, non-narrowing returns defeat recognition.
 *   - Returns inside NESTED functions belong to that nested function,
 *     not this one — the walk does not descend into inner function
 *     bodies.
 *
 * Narrowing shapes recognised (v0.11 initial):
 *   - `<firstParamName>.startsWith('<literal>')` — D5 canary shape
 *   - `<regex-expr>.test(<firstParamName>)` — v0.9.1 sanctioned shape
 *
 * ABSTRACTION BOUNDARY: this helper is FUNCTION-INTRINSIC. It asks
 * "is this fn a guard?" — never "is this sink dominated by a guard?"
 * The caller-side twin is {@link isCallGuardedByRegexTest} (and, in
 * Step 3, a new consumer-side helper). Keep the two layers separate;
 * detectGuard MUST NOT call isCallGuardedByRegexTest.
 */
export function detectGuard(
  fn: GuardAnalyzableFn,
  firstParamName: string | undefined,
): number[] {
  if (firstParamName === undefined) return [];
  const body = fn.body;
  if (body === undefined) return [];

  const returnExprs: ts.Expression[] = [];

  // Arrow with expression body: the body IS the return expression.
  if (ts.isArrowFunction(fn) && !ts.isBlock(body)) {
    returnExprs.push(body);
  } else if (ts.isBlock(body)) {
    const visit = (n: ts.Node): void => {
      if (ts.isReturnStatement(n) && n.expression !== undefined) {
        returnExprs.push(n.expression);
      }
      // Do not descend into nested function-like nodes — their returns
      // target them, not this function.
      if (
        ts.isFunctionDeclaration(n) ||
        ts.isFunctionExpression(n) ||
        ts.isArrowFunction(n) ||
        ts.isMethodDeclaration(n)
      ) {
        return;
      }
      ts.forEachChild(n, visit);
    };
    visit(body);
  }

  if (returnExprs.length === 0) return [];

  let guardFound = false;
  for (const expr of returnExprs) {
    if (isBoolLiteral(expr)) continue;
    if (narrowsOnParam(expr, firstParamName)) {
      guardFound = true;
      continue;
    }
    // Arbitrary (neither bool-literal nor recognised narrow) → not a
    // clean guard. Conservative: drop the whole recognition.
    return [];
  }

  if (!guardFound) return [];
  return [918];
}

/** `true` / `false` literal keyword. */
function isBoolLiteral(expr: ts.Expression): boolean {
  return (
    expr.kind === ts.SyntaxKind.TrueKeyword ||
    expr.kind === ts.SyntaxKind.FalseKeyword
  );
}

/**
 * Does `expr` structurally narrow taint on `paramName`? Shape-intrinsic
 * AST-match — no regex-bleeding, no symbol resolution. Parenthesised
 * wrappers are transparent.
 */
function narrowsOnParam(expr: ts.Expression, paramName: string): boolean {
  let e = expr;
  while (ts.isParenthesizedExpression(e)) e = e.expression;

  // Shape 1: `<paramName>.startsWith('<literal>')`
  if (
    ts.isCallExpression(e) &&
    ts.isPropertyAccessExpression(e.expression) &&
    ts.isIdentifier(e.expression.name) &&
    e.expression.name.text === 'startsWith' &&
    ts.isIdentifier(e.expression.expression) &&
    e.expression.expression.text === paramName &&
    e.arguments.length > 0 &&
    ts.isStringLiteral(e.arguments[0])
  ) {
    return true;
  }

  // Shape 2: `<anything>.test(<paramName>)`
  if (
    ts.isCallExpression(e) &&
    ts.isPropertyAccessExpression(e.expression) &&
    ts.isIdentifier(e.expression.name) &&
    e.expression.name.text === 'test' &&
    e.arguments.length > 0 &&
    ts.isIdentifier(e.arguments[0]) &&
    e.arguments[0].text === paramName
  ) {
    return true;
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
export function isCallGuardedByRegexTest(
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
