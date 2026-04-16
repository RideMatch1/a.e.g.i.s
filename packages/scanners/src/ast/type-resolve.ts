/**
 * Type-aware sink-symbol resolution (Phase 3c).
 *
 * Given a CallExpression and a TypeChecker, decide whether the called
 * identifier is a real built-in sink (e.g., child_process.exec) or a
 * locally-shadowed function of the same name.
 *
 * This is a PURE FILTER on top of string-match detection:
 *   - Returns `{ isSink: false }` → caller suppresses the finding
 *     (confirmed shadowed local — string-match would FP here)
 *   - Returns `{ isSink: true }` OR `null` → caller proceeds with
 *     string-match behavior (can't downgrade a TP)
 *
 * The `null` return is important for graceful degradation: if the checker
 * can't resolve the symbol (transient errors, synthetic compiler options,
 * module resolution failures), we fail OPEN — keep the existing flag
 * rather than silently dropping it.
 */
import ts from 'typescript';
import { normalizePath } from './program.js';
import { isAmbientSinkCandidate } from './sinks.js';

/**
 * Extract the identifier node that names the callee.
 * Handles common unwrappings: `exec!(x)`, `(exec as any)(x)`, `(exec)(x)`.
 * For property access (`cp.exec(x)`) returns the property name identifier.
 */
function getCallIdentifier(callee: ts.Expression): ts.Identifier | null {
  let node: ts.Expression = callee;
  while (
    ts.isNonNullExpression(node) ||
    ts.isAsExpression(node) ||
    ts.isParenthesizedExpression(node)
  ) {
    node = node.expression;
  }
  if (ts.isIdentifier(node)) return node;
  if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.name)) {
    return node.name;
  }
  return null;
}

/**
 * Resolve a CallExpression's target against the TypeChecker.
 *
 * @returns `{ isSink: true }`  if the symbol's declaration lives in `/@types/node/`
 *          `{ isSink: false }` if the declaration is LOCAL (shadowed) or another non-@types source
 *          `null`              if symbol resolution fails — caller keeps string-match behavior
 */
export function resolveSinkSymbol(
  call: ts.CallExpression,
  checker: ts.TypeChecker,
): { isSink: boolean } | null {
  const ident = getCallIdentifier(call.expression);
  if (!ident) return null;

  let symbol = checker.getSymbolAtLocation(ident);
  if (!symbol) return null;

  // Follow import aliases — `import { exec } from 'child_process'`'s identifier
  // symbol's declaration is the ImportSpecifier, not child_process.d.ts. Must
  // follow to get the real ambient declaration.
  if (symbol.flags & ts.SymbolFlags.Alias) {
    try {
      symbol = checker.getAliasedSymbol(symbol);
    } catch {
      return null;
    }
  }

  const decls = symbol.getDeclarations() ?? [];
  if (decls.length === 0) return null;

  const name = symbol.getName();

  // Scan all declarations. If ANY declaration is in @types/node AND the name
  // matches our known ambient sink list → confirmed real sink.
  // This handles the common case where TS.Symbol has multiple overload decls.
  for (const decl of decls) {
    const declPath = normalizePath(decl.getSourceFile().fileName);
    if (declPath.includes('/@types/node/')) {
      return { isSink: isAmbientSinkCandidate(name) };
    }
  }

  // Declarations come only from TypeScript's standard lib (lib.es5.d.ts etc.)
  // — not a Node.js sink.
  for (const decl of decls) {
    const declPath = normalizePath(decl.getSourceFile().fileName);
    if (/\/typescript\/lib\/lib\.[^/]+\.d\.ts$/.test(declPath)) {
      return { isSink: false };
    }
  }

  // All declarations are from user code — shadowed local function.
  return { isSink: false };
}
