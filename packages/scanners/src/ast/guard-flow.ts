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
