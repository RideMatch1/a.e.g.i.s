import { describe, it, expect } from 'vitest';
import { parseFile, getNodeText, getLineNumber } from '../../src/ast/parser.js';
import ts from 'typescript';

describe('parseFile', () => {
  it('parses TypeScript source into an AST', () => {
    const source = 'const x = 1;';
    const sf = parseFile('test.ts', source);
    expect(sf).toBeDefined();
    expect(sf.statements.length).toBe(1);
    expect(sf.statements[0].kind).toBe(ts.SyntaxKind.VariableStatement);
  });

  it('parses JSX without errors', () => {
    const source = 'const el = <div>Hello</div>;';
    const sf = parseFile('test.tsx', source);
    expect(sf.statements.length).toBe(1);
  });

  it('handles empty file', () => {
    const sf = parseFile('test.ts', '');
    expect(sf.statements.length).toBe(0);
  });

  it('handles syntax errors gracefully (partial parse)', () => {
    const source = 'const x = ;';
    const sf = parseFile('test.ts', source);
    expect(sf).toBeDefined();
  });
});

describe('getLineNumber', () => {
  it('returns 1-based line number for a node position', () => {
    const source = 'const a = 1;\nconst b = 2;\nconst c = 3;';
    const sf = parseFile('test.ts', source);
    const thirdStmt = sf.statements[2];
    expect(getLineNumber(sf, thirdStmt.getStart(sf))).toBe(3);
  });
});

describe('getNodeText', () => {
  it('extracts text of a node', () => {
    const source = 'const x = req.body.id;';
    const sf = parseFile('test.ts', source);
    const decl = sf.statements[0];
    expect(getNodeText(sf, decl)).toBe('const x = req.body.id;');
  });
});
