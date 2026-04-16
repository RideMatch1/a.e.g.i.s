import ts from 'typescript';

/**
 * Parse a TypeScript/JavaScript source string into an AST.
 * Uses ts.createSourceFile — fast (~5ms), no type resolution, no program needed.
 */
export function parseFile(fileName: string, content: string): ts.SourceFile {
  const scriptKind = fileName.endsWith('.tsx') || fileName.endsWith('.jsx')
    ? ts.ScriptKind.TSX
    : ts.ScriptKind.TS;

  return ts.createSourceFile(
    fileName,
    content,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    scriptKind,
  );
}

/**
 * Get 1-based line number for a position in the source file.
 */
export function getLineNumber(sf: ts.SourceFile, pos: number): number {
  return sf.getLineAndCharacterOfPosition(pos).line + 1;
}

/**
 * Get the full text of an AST node.
 */
export function getNodeText(sf: ts.SourceFile, node: ts.Node): string {
  return node.getText(sf);
}

/**
 * Walk all descendant nodes depth-first, calling visitor on each.
 */
export function walkAst(node: ts.Node, visitor: (node: ts.Node) => void): void {
  visitor(node);
  ts.forEachChild(node, (child) => walkAst(child, visitor));
}
