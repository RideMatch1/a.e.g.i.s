import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import ts from 'typescript';
import { ModuleGraph, buildModuleGraph } from '../../src/ast/module-graph.js';
import { buildProgram, normalizePath } from '../../src/ast/program.js';
// v0.7 Phase 1: fixture helpers extracted into __helpers__ so
// function-summary.test.ts (and later taint-tracker cross-file tests)
// can share the same setup path. Each test file must use its own
// namespace so parallel-worker runs don't clobber each other's
// fixtures.
import {
  VULN_APP,
  FIXTURE_DIR,
  writeFixtures as _writeFixtures,
  buildGraphFor as _buildGraphFor,
  cleanup as _cleanup,
} from '../__helpers__/multi-file-fixtures.js';

const NS = 'module-graph';
const writeFixtures = (files: Record<string, string>): string[] =>
  _writeFixtures(files, NS);
const buildGraphFor = (files: Record<string, string>) => _buildGraphFor(files, NS);
const cleanup = (): void => _cleanup(NS);

describe('ModuleGraph — basic import/export extraction', () => {
  afterEach(cleanup);

  it('extracts named imports correctly', () => {
    const { graph, paths } = buildGraphFor({
      'lib.ts': 'export function foo() { return 1; }',
      'api.ts': "import { foo } from './lib';\nconsole.log(foo());",
    });
    const api = graph.nodes.get(normalizePath(paths[1]))!;
    expect(api.imports).toHaveLength(1);
    expect(api.imports[0].localName).toBe('foo');
    expect(api.imports[0].originalName).toBe('foo');
    expect(api.imports[0].kind).toBe('named');
    expect(api.imports[0].isTypeOnly).toBe(false);
  });

  it('extracts default imports correctly', () => {
    const { graph, paths } = buildGraphFor({
      'lib.ts': 'export default function getX() { return 1; }',
      'api.ts': "import getX from './lib';\nconsole.log(getX());",
    });
    const api = graph.nodes.get(normalizePath(paths[1]))!;
    expect(api.imports[0].kind).toBe('default');
    expect(api.imports[0].localName).toBe('getX');
    expect(api.imports[0].originalName).toBe('default');
  });

  it('extracts namespace imports correctly', () => {
    const { graph, paths } = buildGraphFor({
      'lib.ts': 'export const a = 1; export const b = 2;',
      'api.ts': "import * as utils from './lib';\nconsole.log(utils.a);",
    });
    const api = graph.nodes.get(normalizePath(paths[1]))!;
    expect(api.imports[0].kind).toBe('namespace');
    expect(api.imports[0].localName).toBe('utils');
    expect(api.imports[0].originalName).toBe('*');
  });

  it('extracts renamed imports with propertyName', () => {
    const { graph, paths } = buildGraphFor({
      'lib.ts': 'export function foo() {}',
      'api.ts': "import { foo as bar } from './lib';\nbar();",
    });
    const api = graph.nodes.get(normalizePath(paths[1]))!;
    expect(api.imports[0].localName).toBe('bar');
    expect(api.imports[0].originalName).toBe('foo');
  });

  it('flags type-only imports', () => {
    const { graph, paths } = buildGraphFor({
      'types.ts': 'export interface UserInput { id: string; }',
      'api.ts': "import type { UserInput } from './types';\nlet x: UserInput;",
    });
    const api = graph.nodes.get(normalizePath(paths[1]))!;
    expect(api.imports[0].isTypeOnly).toBe(true);
  });

  it('flags per-specifier type-only imports', () => {
    const { graph, paths } = buildGraphFor({
      'lib.ts': 'export const val = 1; export interface T { a: string; }',
      'api.ts': "import { val, type T } from './lib';",
    });
    const api = graph.nodes.get(normalizePath(paths[1]))!;
    const valImp = api.imports.find((i) => i.localName === 'val')!;
    const tImp = api.imports.find((i) => i.localName === 'T')!;
    expect(valImp.isTypeOnly).toBe(false);
    expect(tImp.isTypeOnly).toBe(true);
  });

  it('records side-effect-only imports', () => {
    const { graph, paths } = buildGraphFor({
      'setup.ts': 'globalThis.__ready = true;',
      'api.ts': "import './setup';\nconsole.log('started');",
    });
    const api = graph.nodes.get(normalizePath(paths[1]))!;
    expect(api.imports[0].kind).toBe('sideEffect');
  });

  it('resolves fromFile to absolute normalized path for intra-project imports', () => {
    const { graph, paths } = buildGraphFor({
      'lib.ts': 'export const x = 1;',
      'api.ts': "import { x } from './lib';",
    });
    const api = graph.nodes.get(normalizePath(paths[1]))!;
    expect(api.imports[0].fromFile).toBeTruthy();
    expect(api.imports[0].fromFile).toBe(normalizePath(paths[0]));
  });

  it('returns null fromFile for node_modules / external imports', () => {
    const { graph, paths } = buildGraphFor({
      'api.ts': "import { NextRequest } from 'next/server';\nconsole.log(NextRequest);",
    });
    const api = graph.nodes.get(normalizePath(paths[0]))!;
    expect(api.imports[0].fromFile).toBeNull();
  });
});

describe('ModuleGraph — exports', () => {
  afterEach(cleanup);

  it('extracts named function exports', () => {
    const { graph, paths } = buildGraphFor({
      'lib.ts': 'export function foo() {} export const x = 1; export class C {}',
    });
    const lib = graph.nodes.get(normalizePath(paths[0]))!;
    const names = lib.exports.map((e) => e.exportedName).sort();
    expect(names).toEqual(['C', 'foo', 'x']);
  });

  it('extracts default exports via `export default`', () => {
    const { graph, paths } = buildGraphFor({
      'lib.ts': 'export default function () { return 1; }',
    });
    const lib = graph.nodes.get(normalizePath(paths[0]))!;
    const def = lib.exports.find((e) => e.exportedName === 'default');
    expect(def).toBeDefined();
    expect(def!.kind).toBe('default');
  });

  it('extracts re-exports with origin file', () => {
    const { graph, paths } = buildGraphFor({
      'raw.ts': 'export const input = "data";',
      'index.ts': "export { input } from './raw';",
    });
    const idx = graph.nodes.get(normalizePath(paths[1]))!;
    const reexport = idx.exports[0];
    expect(reexport.kind).toBe('reexport');
    expect(reexport.exportedName).toBe('input');
    expect(reexport.originFile).toBe(normalizePath(paths[0]));
    expect(reexport.originName).toBe('input');
  });

  it('extracts star-exports', () => {
    const { graph, paths } = buildGraphFor({
      'raw.ts': 'export const a = 1; export const b = 2;',
      'index.ts': "export * from './raw';",
    });
    const idx = graph.nodes.get(normalizePath(paths[1]))!;
    expect(idx.exports[0].kind).toBe('star');
    expect(idx.exports[0].exportedName).toBe('*');
    expect(idx.exports[0].originFile).toBe(normalizePath(paths[0]));
  });

  it('marks type/interface exports as typeOnly', () => {
    const { graph, paths } = buildGraphFor({
      'lib.ts': 'export interface T { a: string; } export type U = string; export const v = 1;',
    });
    const lib = graph.nodes.get(normalizePath(paths[0]))!;
    const tExp = lib.exports.find((e) => e.exportedName === 'T')!;
    const uExp = lib.exports.find((e) => e.exportedName === 'U')!;
    const vExp = lib.exports.find((e) => e.exportedName === 'v')!;
    expect(tExp.isTypeOnly).toBe(true);
    expect(uExp.isTypeOnly).toBe(true);
    expect(vExp.isTypeOnly).toBe(false);
  });
});

describe('ModuleGraph — resolveSymbolOrigin', () => {
  afterEach(cleanup);

  it('resolves a direct named import to its origin', () => {
    const { graph, paths } = buildGraphFor({
      'lib.ts': 'export function foo() { return 1; }',
      'api.ts': "import { foo } from './lib';",
    });
    const origin = graph.resolveSymbolOrigin(paths[1], 'foo');
    expect(origin).not.toBeNull();
    expect(origin!.file).toBe(normalizePath(paths[0]));
    expect(origin!.exportName).toBe('foo');
    expect(origin!.hops).toBe(0);
  });

  it('follows re-export chain transitively', () => {
    const { graph, paths } = buildGraphFor({
      'raw.ts': 'export const input = "tainted";',
      'index.ts': "export { input } from './raw';",
      'api.ts': "import { input } from './index';",
    });
    const origin = graph.resolveSymbolOrigin(paths[2], 'input');
    expect(origin).not.toBeNull();
    expect(origin!.file).toBe(normalizePath(paths[0]));
    expect(origin!.exportName).toBe('input');
    expect(origin!.hops).toBe(1);
  });

  it('resolves through renaming re-exports', () => {
    const { graph, paths } = buildGraphFor({
      'raw.ts': 'export function originalName() {}',
      'barrel.ts': "export { originalName as renamedName } from './raw';",
      'api.ts': "import { renamedName } from './barrel';",
    });
    const origin = graph.resolveSymbolOrigin(paths[2], 'renamedName');
    expect(origin).not.toBeNull();
    expect(origin!.file).toBe(normalizePath(paths[0]));
    expect(origin!.exportName).toBe('originalName');
    expect(origin!.hops).toBe(1);
  });

  it('resolves via star-export (export * from)', () => {
    const { graph, paths } = buildGraphFor({
      'raw.ts': 'export function hidden() {}',
      'index.ts': "export * from './raw';",
      'api.ts': "import { hidden } from './index';",
    });
    const origin = graph.resolveSymbolOrigin(paths[2], 'hidden');
    expect(origin).not.toBeNull();
    expect(origin!.file).toBe(normalizePath(paths[0]));
    expect(origin!.exportName).toBe('hidden');
  });

  it('returns null for type-only imports', () => {
    const { graph, paths } = buildGraphFor({
      'types.ts': 'export interface U { id: string; }',
      'api.ts': "import type { U } from './types';",
    });
    const origin = graph.resolveSymbolOrigin(paths[1], 'U');
    expect(origin).toBeNull();
  });

  it('returns null for external (node_modules) imports', () => {
    const { graph, paths } = buildGraphFor({
      'api.ts': "import { NextRequest } from 'next/server';",
    });
    const origin = graph.resolveSymbolOrigin(paths[0], 'NextRequest');
    expect(origin).toBeNull();
  });

  it('returns null for unknown local names', () => {
    const { graph, paths } = buildGraphFor({
      'api.ts': 'const x = 1;',
    });
    expect(graph.resolveSymbolOrigin(paths[0], 'neverImported')).toBeNull();
  });

  it('handles default import resolution', () => {
    const { graph, paths } = buildGraphFor({
      'lib.ts': 'export default function original() {}',
      'api.ts': "import renamed from './lib';",
    });
    const origin = graph.resolveSymbolOrigin(paths[1], 'renamed');
    expect(origin).not.toBeNull();
    expect(origin!.file).toBe(normalizePath(paths[0]));
    expect(origin!.exportName).toBe('default');
  });

  it('terminates re-export chain at max hops (cycle protection)', () => {
    // Create a silly cycle: a re-exports from b, b re-exports from a
    const { graph, paths } = buildGraphFor({
      'a.ts': "export { x } from './b';",
      'b.ts': "export { x } from './a';",
      'api.ts': "import { x } from './a';",
    });
    // MAX_REEXPORT_HOPS = 5, after which we bail
    const origin = graph.resolveSymbolOrigin(paths[2], 'x');
    expect(origin).toBeNull();
  });
});

describe('ModuleGraph — cycle detection (SCC)', () => {
  afterEach(cleanup);

  it('detects no cycles in a linear dep chain', () => {
    const { graph } = buildGraphFor({
      'a.ts': 'export const x = 1;',
      'b.ts': "import { x } from './a'; export const y = x;",
      'c.ts': "import { y } from './b'; export const z = y;",
    });
    expect(graph.cycles()).toEqual([]);
  });

  it('detects a simple 2-file cycle', () => {
    const { graph, paths } = buildGraphFor({
      'a.ts': "import { b } from './b'; export const a = b;",
      'b.ts': "import { a } from './a'; export const b = a;",
    });
    const cycles = graph.cycles();
    expect(cycles).toHaveLength(1);
    expect(cycles[0].sort()).toEqual(
      [normalizePath(paths[0]), normalizePath(paths[1])].sort(),
    );
  });

  it('detects 3-file cycle via re-exports', () => {
    const { graph } = buildGraphFor({
      'a.ts': "export * from './b';",
      'b.ts': "export * from './c';",
      'c.ts': "export * from './a';",
    });
    const cycles = graph.cycles();
    expect(cycles).toHaveLength(1);
    expect(cycles[0]).toHaveLength(3);
  });
});

describe('ModuleGraph — buildModuleGraph helper', () => {
  it('returns null when program is null (preflight bail-out)', () => {
    expect(buildModuleGraph(null)).toBeNull();
  });

  it('returns ModuleGraph with correct size for non-null program', () => {
    const paths = writeFixtures({
      'a.ts': 'export const x = 1;',
      'b.ts': 'export const y = 2;',
    });
    try {
      const program = buildProgram(VULN_APP, paths)!;
      const graph = buildModuleGraph(program)!;
      expect(graph).not.toBeNull();
      // Graph includes at least the 2 fixture files + possibly some lib files
      expect(graph.size()).toBeGreaterThanOrEqual(2);
    } finally {
      cleanup();
    }
  });

  it('skips .d.ts declaration files', () => {
    const paths = writeFixtures({
      'lib.ts': 'export const x = 1;',
    });
    try {
      const program = buildProgram(VULN_APP, paths)!;
      const graph = buildModuleGraph(program)!;
      for (const file of graph.nodes.keys()) {
        expect(file.endsWith('.d.ts')).toBe(false);
      }
    } finally {
      cleanup();
    }
  });
});
