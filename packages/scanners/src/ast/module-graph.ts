/**
 * Program-wide module dependency graph for cross-file symbol resolution.
 *
 * Foundation for v0.7's Cross-File Taint Propagation. Walks every source file
 * in a ts.Program, extracts import/export declarations, and builds a directed
 * graph. Provides symbol-resolution that follows re-exports transitively and
 * detects circular dependencies.
 *
 * Edge-case handling matches docs/plans/v07-cross-file-taint-policy.md:
 *   - Type-only imports/exports excluded from runtime graph
 *   - Default exports represented as export name "default"
 *   - Namespace imports (`import * as X`) → X binds to entire module
 *   - Re-exports (`export { x } from './y'`) followed transitively, max 5 hops
 *   - Star exports (`export * from './y'`) supported, conservative
 *   - Side-effect imports (`import './x'`) recorded but don't contribute edges
 *   - Circular deps detected via Tarjan's SCC algorithm
 */
import ts from 'typescript';
import { normalizePath } from './program.js';

/** How an import declaration brings a name into scope. */
export type ImportKind = 'named' | 'default' | 'namespace' | 'sideEffect';

/** How an export declaration exposes a name from a module. */
export type ExportKind = 'named' | 'default' | 'reexport' | 'star';

/** A single import in a module. */
export interface ModuleImport {
  /** The local name bound in the importing module (may be renamed via `as`). */
  localName: string;
  /** The name as exported by the source module (same as localName unless `as` used). */
  originalName: string;
  /** Absolute path of the source module file. Null for node_modules / unresolvable. */
  fromFile: string | null;
  /** Raw module specifier (e.g., './utils', 'next/server'). */
  moduleSpecifier: string;
  kind: ImportKind;
  /** True for `import type { X } from '...'` — no runtime value, skip for taint. */
  isTypeOnly: boolean;
}

/** A single export from a module. */
export interface ModuleExport {
  /** The name under which this export is visible to importers. */
  exportedName: string;
  kind: ExportKind;
  /** For re-exports: absolute path of origin file. */
  originFile?: string | null;
  /** For re-exports: name under which origin exports it. */
  originName?: string;
  /** For named exports: the local identifier this export refers to. */
  localName?: string;
  isTypeOnly: boolean;
}

/** One file's position in the graph. */
export interface ModuleNode {
  file: string;
  imports: ModuleImport[];
  exports: ModuleExport[];
}

export interface ResolvedOrigin {
  /** Absolute path of the file that ORIGINALLY declares the symbol. */
  file: string;
  /** Name in the originating file (may differ from caller's local name). */
  exportName: string;
  /** How many re-export hops were traversed. */
  hops: number;
}

const MAX_REEXPORT_HOPS = 5;

/**
 * Resolve a module specifier to an absolute file path. Only resolves
 * intra-project modules; returns null for node_modules / externals.
 */
function resolveModuleSpecifier(
  specifier: string,
  containingFile: string,
  program: ts.Program,
): string | null {
  const compilerOptions = program.getCompilerOptions();
  const moduleResolutionHost: ts.ModuleResolutionHost = {
    fileExists: (f) => ts.sys.fileExists(f),
    readFile: (f) => ts.sys.readFile(f),
  };
  const result = ts.resolveModuleName(
    specifier,
    containingFile,
    compilerOptions,
    moduleResolutionHost,
  );
  const resolved = result.resolvedModule;
  if (!resolved) return null;
  // Skip externals — we only graph intra-project code
  if (resolved.isExternalLibraryImport) return null;
  return normalizePath(resolved.resolvedFileName);
}

/**
 * Extract imports from one source file.
 */
function extractImports(
  sf: ts.SourceFile,
  program: ts.Program,
): ModuleImport[] {
  const imports: ModuleImport[] = [];

  for (const statement of sf.statements) {
    if (!ts.isImportDeclaration(statement)) continue;

    const moduleSpecifier = (statement.moduleSpecifier as ts.StringLiteral).text;
    const fromFile = resolveModuleSpecifier(moduleSpecifier, sf.fileName, program);
    const statementIsTypeOnly = statement.importClause?.isTypeOnly === true;

    const importClause = statement.importClause;

    // Side-effect only: `import './x'`
    if (!importClause) {
      imports.push({
        localName: '',
        originalName: '',
        fromFile,
        moduleSpecifier,
        kind: 'sideEffect',
        isTypeOnly: false,
      });
      continue;
    }

    // Default import: `import foo from './x'`
    if (importClause.name) {
      imports.push({
        localName: importClause.name.text,
        originalName: 'default',
        fromFile,
        moduleSpecifier,
        kind: 'default',
        isTypeOnly: statementIsTypeOnly,
      });
    }

    // Namespace: `import * as ns from './x'`
    // Named: `import { a, b as c } from './x'`
    if (importClause.namedBindings) {
      if (ts.isNamespaceImport(importClause.namedBindings)) {
        imports.push({
          localName: importClause.namedBindings.name.text,
          originalName: '*',
          fromFile,
          moduleSpecifier,
          kind: 'namespace',
          isTypeOnly: statementIsTypeOnly,
        });
      } else if (ts.isNamedImports(importClause.namedBindings)) {
        for (const element of importClause.namedBindings.elements) {
          // `element.isTypeOnly` covers per-specifier type-only: `import { type X }`
          const elementTypeOnly = statementIsTypeOnly || element.isTypeOnly === true;
          imports.push({
            localName: element.name.text,
            originalName: (element.propertyName ?? element.name).text,
            fromFile,
            moduleSpecifier,
            kind: 'named',
            isTypeOnly: elementTypeOnly,
          });
        }
      }
    }
  }

  return imports;
}

/**
 * Extract exports from one source file.
 */
function extractExports(
  sf: ts.SourceFile,
  program: ts.Program,
): ModuleExport[] {
  const exports: ModuleExport[] = [];

  for (const statement of sf.statements) {
    // `export default <expr>`  OR  `export default function name() { ... }`
    if (ts.isExportAssignment(statement)) {
      exports.push({
        exportedName: 'default',
        kind: 'default',
        isTypeOnly: false,
      });
      continue;
    }

    // `export { x } from './y'`   /   `export { x }`   /   `export * from './y'`
    if (ts.isExportDeclaration(statement)) {
      const statementIsTypeOnly = statement.isTypeOnly === true;
      const moduleSpec = statement.moduleSpecifier
        ? (statement.moduleSpecifier as ts.StringLiteral).text
        : null;
      const fromFile = moduleSpec
        ? resolveModuleSpecifier(moduleSpec, sf.fileName, program)
        : undefined;

      // `export * from './y'`
      if (!statement.exportClause && moduleSpec) {
        exports.push({
          exportedName: '*',
          kind: 'star',
          originFile: fromFile,
          isTypeOnly: statementIsTypeOnly,
        });
        continue;
      }

      // `export { a, b as c } [from './y']`
      if (statement.exportClause && ts.isNamedExports(statement.exportClause)) {
        for (const element of statement.exportClause.elements) {
          const elementTypeOnly = statementIsTypeOnly || element.isTypeOnly === true;
          const exportedName = element.name.text;
          const originalName = (element.propertyName ?? element.name).text;

          if (moduleSpec) {
            // Re-export
            exports.push({
              exportedName,
              kind: 'reexport',
              originFile: fromFile,
              originName: originalName,
              isTypeOnly: elementTypeOnly,
            });
          } else {
            // Local export with alias
            exports.push({
              exportedName,
              kind: 'named',
              localName: originalName,
              isTypeOnly: elementTypeOnly,
            });
          }
        }
      }
      continue;
    }

    // `export function foo() {}` / `export const foo = ...` / `export class Foo {}`
    if (
      (ts.isFunctionDeclaration(statement) ||
        ts.isClassDeclaration(statement) ||
        ts.isVariableStatement(statement) ||
        ts.isEnumDeclaration(statement) ||
        ts.isInterfaceDeclaration(statement) ||
        ts.isTypeAliasDeclaration(statement))
    ) {
      const modifiers = ts.canHaveModifiers(statement) ? ts.getModifiers(statement) : undefined;
      const hasExport = modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
      const hasDefault = modifiers?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword);
      if (!hasExport) continue;

      // Type-only kinds (interface, type alias) are type-only imports on the other side
      const isTypeOnlyKind =
        ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement);

      if (hasDefault) {
        exports.push({
          exportedName: 'default',
          kind: 'default',
          isTypeOnly: isTypeOnlyKind,
        });
      } else if (
        ts.isFunctionDeclaration(statement) ||
        ts.isClassDeclaration(statement) ||
        ts.isEnumDeclaration(statement) ||
        ts.isInterfaceDeclaration(statement) ||
        ts.isTypeAliasDeclaration(statement)
      ) {
        if (statement.name) {
          exports.push({
            exportedName: statement.name.text,
            kind: 'named',
            localName: statement.name.text,
            isTypeOnly: isTypeOnlyKind,
          });
        }
      } else if (ts.isVariableStatement(statement)) {
        for (const decl of statement.declarationList.declarations) {
          if (ts.isIdentifier(decl.name)) {
            exports.push({
              exportedName: decl.name.text,
              kind: 'named',
              localName: decl.name.text,
              isTypeOnly: false,
            });
          }
        }
      }
    }
  }

  return exports;
}

export class ModuleGraph {
  readonly nodes: Map<string, ModuleNode> = new Map();
  readonly program: ts.Program;

  constructor(program: ts.Program) {
    this.program = program;
    for (const sf of program.getSourceFiles()) {
      if (sf.isDeclarationFile) continue; // Skip .d.ts
      const file = normalizePath(sf.fileName);
      this.nodes.set(file, {
        file,
        imports: extractImports(sf, program),
        exports: extractExports(sf, program),
      });
    }
  }

  /**
   * Resolve a local name in a module to its original declaration file+name.
   * Follows re-exports transitively (max 5 hops — cycle/depth protection).
   *
   * Returns null if:
   *   - The file is not in the graph
   *   - The local name is not imported (caller should check locally first)
   *   - The chain terminates in an external module
   *   - The re-export chain exceeds MAX_REEXPORT_HOPS
   */
  resolveSymbolOrigin(file: string, localName: string): ResolvedOrigin | null {
    const normFile = normalizePath(file);
    const node = this.nodes.get(normFile);
    if (!node) return null;

    const imp = node.imports.find(
      (i) => i.localName === localName && !i.isTypeOnly && i.kind !== 'sideEffect',
    );
    if (!imp) return null;
    if (!imp.fromFile) return null; // external module

    return this.followExport(imp.fromFile, imp.originalName, 0);
  }

  /**
   * Given an export name in a specific file, follow re-export chains until
   * the origin is reached or the chain exceeds MAX_REEXPORT_HOPS.
   */
  private followExport(
    file: string,
    exportName: string,
    hops: number,
  ): ResolvedOrigin | null {
    if (hops > MAX_REEXPORT_HOPS) return null;

    const node = this.nodes.get(file);
    if (!node) return null;

    // Handle namespace import (`*`) — binds to whole module. Treat as origin.
    if (exportName === '*') {
      return { file, exportName: '*', hops };
    }

    // Explicit named/default export in this file?
    const direct = node.exports.find(
      (e) => e.exportedName === exportName && !e.isTypeOnly,
    );
    if (direct) {
      if (direct.kind === 'reexport' && direct.originFile) {
        return this.followExport(
          direct.originFile,
          direct.originName ?? exportName,
          hops + 1,
        );
      }
      // 'named' or 'default' = origin
      return { file, exportName, hops };
    }

    // Star-export (`export * from './y'`) — scan all star-exports transitively
    for (const exp of node.exports) {
      if (exp.kind === 'star' && exp.originFile && !exp.isTypeOnly) {
        const deep = this.followExport(exp.originFile, exportName, hops + 1);
        if (deep) return deep;
      }
    }

    return null;
  }

  /**
   * Strongly-connected components via Tarjan's algorithm.
   * Each SCC with >1 node is a circular dependency (useful for debugging /
   * FP-analysis in v0.7). Returns array of SCCs; each SCC is array of files.
   */
  cycles(): string[][] {
    // Adjacency: file → [files it depends on]
    const adj = new Map<string, string[]>();
    for (const [file, node] of this.nodes) {
      const deps = new Set<string>();
      for (const imp of node.imports) {
        if (imp.fromFile && this.nodes.has(imp.fromFile)) deps.add(imp.fromFile);
      }
      for (const exp of node.exports) {
        if (
          (exp.kind === 'reexport' || exp.kind === 'star') &&
          exp.originFile &&
          this.nodes.has(exp.originFile)
        ) {
          deps.add(exp.originFile);
        }
      }
      adj.set(file, [...deps]);
    }

    // Tarjan's SCC
    let index = 0;
    const indices = new Map<string, number>();
    const lowlink = new Map<string, number>();
    const onStack = new Set<string>();
    const stack: string[] = [];
    const sccs: string[][] = [];

    const strongconnect = (v: string): void => {
      indices.set(v, index);
      lowlink.set(v, index);
      index++;
      stack.push(v);
      onStack.add(v);

      for (const w of adj.get(v) ?? []) {
        if (!indices.has(w)) {
          strongconnect(w);
          lowlink.set(v, Math.min(lowlink.get(v)!, lowlink.get(w)!));
        } else if (onStack.has(w)) {
          lowlink.set(v, Math.min(lowlink.get(v)!, indices.get(w)!));
        }
      }

      if (lowlink.get(v) === indices.get(v)) {
        const scc: string[] = [];
        let w: string;
        do {
          w = stack.pop()!;
          onStack.delete(w);
          scc.push(w);
        } while (w !== v);
        // Only non-trivial SCCs (actual cycles)
        if (scc.length > 1) sccs.push(scc);
      }
    };

    for (const file of this.nodes.keys()) {
      if (!indices.has(file)) strongconnect(file);
    }

    return sccs;
  }

  /** Convenience: how many files are in the graph. */
  size(): number {
    return this.nodes.size;
  }
}

/**
 * Build a ModuleGraph from a TypeScript program. Returns null if the program
 * is null (e.g., when buildProgram preflight bailed on >5000 files).
 */
export function buildModuleGraph(program: ts.Program | null): ModuleGraph | null {
  if (!program) return null;
  return new ModuleGraph(program);
}
