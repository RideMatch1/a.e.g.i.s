import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import ts from 'typescript';
import {
  PROGRAM_MODE_MAX_FILES,
  normalizePath,
  findTsconfig,
  parseTsconfig,
  syntheticOptions,
  buildProgram,
} from '../../src/ast/program.js';

// packages/benchmark/vulnerable-app — reused because it's the only workspace
// member with @types/node installed, which is load-bearing for the
// integration tests below.
const VULN_APP = path.resolve(
  import.meta.dirname,
  '../../../benchmark/vulnerable-app',
);

describe('normalizePath', () => {
  it('converts backslashes to forward slashes', () => {
    expect(normalizePath('C:\\users\\test\\@types\\node\\fs.d.ts')).toBe(
      'C:/users/test/@types/node/fs.d.ts',
    );
  });

  it('leaves already-normalized paths unchanged', () => {
    expect(normalizePath('/users/test/@types/node/fs.d.ts')).toBe(
      '/users/test/@types/node/fs.d.ts',
    );
  });

  it('normalizes mixed separators', () => {
    expect(normalizePath('/a\\b/c\\d')).toBe('/a/b/c/d');
  });

  it('handles empty input', () => {
    expect(normalizePath('')).toBe('');
  });
});

describe('findTsconfig', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aegis-prog-'));
  });
  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns the absolute path when tsconfig.json exists', () => {
    const cfg = path.join(tmpDir, 'tsconfig.json');
    fs.writeFileSync(cfg, '{}');
    expect(findTsconfig(tmpDir)).toBe(cfg);
  });

  it('returns null when no tsconfig.json exists', () => {
    expect(findTsconfig(tmpDir)).toBeNull();
  });
});

describe('parseTsconfig', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aegis-prog-'));
  });
  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('parses a valid tsconfig with compilerOptions', () => {
    const cfg = path.join(tmpDir, 'tsconfig.json');
    fs.writeFileSync(
      cfg,
      JSON.stringify({
        compilerOptions: { target: 'ES2020', strict: true },
      }),
    );
    const opts = parseTsconfig(cfg);
    expect(opts).not.toBeNull();
    expect(opts?.target).toBe(ts.ScriptTarget.ES2020);
    expect(opts?.strict).toBe(true);
  });

  it('resolves path aliases into the compilerOptions.paths map', () => {
    const cfg = path.join(tmpDir, 'tsconfig.json');
    fs.writeFileSync(
      cfg,
      JSON.stringify({ compilerOptions: { paths: { '@/*': ['./src/*'] } } }),
    );
    expect(parseTsconfig(cfg)?.paths).toEqual({ '@/*': ['./src/*'] });
  });

  it('returns null on malformed JSON', () => {
    const cfg = path.join(tmpDir, 'tsconfig.json');
    fs.writeFileSync(cfg, '{ this is not json');
    expect(parseTsconfig(cfg)).toBeNull();
  });
});

describe('syntheticOptions', () => {
  it('enables JSX preserve for Next.js/React projects', () => {
    expect(syntheticOptions().jsx).toBe(ts.JsxEmit.Preserve);
  });

  it('includes node types so ambient modules resolve', () => {
    expect(syntheticOptions().types).toContain('node');
  });

  it('enables skipLibCheck to tolerate messy project lib types', () => {
    expect(syntheticOptions().skipLibCheck).toBe(true);
  });

  it('enables allowJs so .js/.mjs files are analyzed', () => {
    expect(syntheticOptions().allowJs).toBe(true);
  });

  it('uses Bundler module resolution (matches Next.js/Vite convention)', () => {
    expect(syntheticOptions().moduleResolution).toBe(
      ts.ModuleResolutionKind.Bundler,
    );
  });
});

describe('buildProgram — preflight', () => {
  it('returns null when files exceed PROGRAM_MODE_MAX_FILES', () => {
    const files = Array.from(
      { length: PROGRAM_MODE_MAX_FILES + 1 },
      (_, i) => `/tmp/nonexistent/file${i}.ts`,
    );
    expect(buildProgram('/tmp/nonexistent', files)).toBeNull();
  });

  it('returns null when exactly PROGRAM_MODE_MAX_FILES + 1', () => {
    const files = Array.from(
      { length: PROGRAM_MODE_MAX_FILES + 1 },
      (_, i) => `/tmp/x/${i}.ts`,
    );
    expect(buildProgram('/tmp/x', files)).toBeNull();
  });

  it('builds a Program when files are within threshold', () => {
    const entry = path.join(VULN_APP, 'src/app/api/vuln-05-cmdi/route.ts');
    const program = buildProgram(VULN_APP, [entry]);
    expect(program).not.toBeNull();
    expect(program?.getSourceFile(entry)).toBeDefined();
  });
});

// Integration test — proves the WHOLE type-resolution pipeline works.
// Replaces the earlier scripts/smoke-types-phase3.mjs (kept as a standalone
// diagnostic) by making this a first-class CI gate. Breaks immediately if
// pnpm/tsconfig/@types-resolution silently regress.
describe('buildProgram — type resolution (integration)', () => {
  const fixtureDir = path.join(VULN_APP, 'src', '__aegis_type_test__');
  const testFile = path.join(fixtureDir, 'smoke.ts');

  beforeEach(() => {
    fs.mkdirSync(fixtureDir, { recursive: true });
    fs.writeFileSync(
      testFile,
      [
        "import { exec, execSync } from 'child_process';",
        'function myLocalExec(cmd: string): string { return cmd; }',
        "exec('ls');",
        "execSync('ls');",
        "myLocalExec('ls');",
      ].join('\n'),
    );
  });

  afterEach(() => {
    // Defensive cleanup — if a test crashes, the next run's beforeEach still works
    try {
      fs.rmSync(fixtureDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('imported child_process.exec resolves to @types/node via alias follow', () => {
    const program = buildProgram(VULN_APP, [testFile]);
    expect(program).not.toBeNull();
    const checker = program!.getTypeChecker();
    const sf = program!.getSourceFile(testFile);
    expect(sf).toBeDefined();

    // Collect { callName → origin } for every call expression in the file
    interface Observation {
      name: string;
      origin: 'NODE_TYPES' | 'LOCAL' | 'OTHER';
    }
    const observations: Observation[] = [];

    function visit(n: ts.Node): void {
      if (ts.isCallExpression(n) && ts.isIdentifier(n.expression)) {
        const name = n.expression.text;
        let sym = checker.getSymbolAtLocation(n.expression);
        // Follow import aliases — `import { exec }` symbol's own declaration
        // is the ImportSpecifier, not child_process.d.ts. Must getAliasedSymbol.
        if (sym && sym.flags & ts.SymbolFlags.Alias) {
          sym = checker.getAliasedSymbol(sym);
        }
        for (const decl of sym?.getDeclarations() ?? []) {
          const declPath = normalizePath(decl.getSourceFile().fileName);
          const origin: Observation['origin'] = declPath.includes('/@types/node/')
            ? 'NODE_TYPES'
            : declPath === normalizePath(testFile)
              ? 'LOCAL'
              : 'OTHER';
          observations.push({ name, origin });
        }
      }
      ts.forEachChild(n, visit);
    }
    visit(sf!);

    // `exec` (imported) must resolve to @types/node
    expect(
      observations.some((o) => o.name === 'exec' && o.origin === 'NODE_TYPES'),
    ).toBe(true);

    // `execSync` (imported) must resolve to @types/node
    expect(
      observations.some(
        (o) => o.name === 'execSync' && o.origin === 'NODE_TYPES',
      ),
    ).toBe(true);

    // `myLocalExec` must NEVER appear as NODE_TYPES (that would be a false positive)
    expect(
      observations.some(
        (o) => o.name === 'myLocalExec' && o.origin === 'NODE_TYPES',
      ),
    ).toBe(false);

    // `myLocalExec` must appear as LOCAL (if not, symbol resolution is broken)
    expect(
      observations.some((o) => o.name === 'myLocalExec' && o.origin === 'LOCAL'),
    ).toBe(true);
  });

  it('uses the vulnerable-app tsconfig (path aliases resolved)', () => {
    // Write a file that imports via @/ alias — proves the tsconfig is picked up.
    const libFile = path.join(fixtureDir, 'lib.ts');
    fs.writeFileSync(libFile, 'export const greet = (s: string) => "hi " + s;');
    const importerFile = path.join(fixtureDir, 'importer.ts');
    fs.writeFileSync(
      importerFile,
      [
        "import { greet } from '@/__aegis_type_test__/lib';",
        "greet('x');",
      ].join('\n'),
    );

    const program = buildProgram(VULN_APP, [importerFile]);
    expect(program).not.toBeNull();
    const checker = program!.getTypeChecker();
    const sf = program!.getSourceFile(importerFile);
    expect(sf).toBeDefined();

    // Find the call expression and check that greet resolves to lib.ts
    let greetOrigin: string | null = null;
    function visit(n: ts.Node): void {
      if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'greet') {
        let sym = checker.getSymbolAtLocation(n.expression);
        if (sym && sym.flags & ts.SymbolFlags.Alias) {
          sym = checker.getAliasedSymbol(sym);
        }
        const decl = sym?.getDeclarations()?.[0];
        if (decl) greetOrigin = normalizePath(decl.getSourceFile().fileName);
      }
      ts.forEachChild(n, visit);
    }
    visit(sf!);

    // Alias resolution worked → greet's declaration points to lib.ts (not undefined)
    expect(greetOrigin).toContain('/__aegis_type_test__/lib.ts');
  });
});
