/**
 * Multi-file fixture helpers shared by AST tests.
 *
 * Writes temporary source files under the vulnerable-app fixture tree,
 * builds a ts.Program + ModuleGraph for them, and cleans up between tests.
 *
 * Extracted from module-graph.test.ts during v0.7 Phase 1 so
 * function-summary.test.ts and (in Phase 2) taint-tracker.test.ts can
 * share one setup path — see docs/plans/v07-foundation.md §4 Phase 1.
 *
 * Usage:
 *
 * ```ts
 * import {
 *   writeFixtures,
 *   buildGraphFor,
 *   cleanup,
 * } from '../__helpers__/multi-file-fixtures.js';
 *
 * afterEach(cleanup);
 *
 * it('does something with a two-file fixture', () => {
 *   const { graph, paths, program } = buildGraphFor({
 *     'lib.ts': 'export function foo() { return 1; }',
 *     'api.ts': "import { foo } from './lib'; foo();",
 *   });
 *   // ... assert on `graph` / `program` / fs.readFileSync(paths[…])
 * });
 * ```
 *
 * The fixture directory is a stable path inside the vulnerable-app package
 * (`src/__aegis_mod_graph__`) so tsconfig-based compilation finds the files
 * during buildProgram. cleanup() recursively removes the entire directory —
 * safe to call unconditionally in afterEach.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import ts from 'typescript';
import { ModuleGraph } from '../../src/ast/module-graph.js';
import { buildProgram } from '../../src/ast/program.js';

/**
 * Root of the package's vulnerable-app benchmark fixture — resolved
 * relative to this file. Tests write into a reserved subdirectory so
 * they don't collide with the checked-in benchmark sources.
 */
export const VULN_APP = path.resolve(
  import.meta.dirname,
  '../../../benchmark/vulnerable-app',
);

/**
 * Root subdirectory for programmatically-written test fixtures.
 * Each test file should pass its own `namespace` string to the helpers
 * below so fixtures don't collide when Vitest runs files in parallel
 * workers — see {@link fixtureDir}.
 */
export const FIXTURE_ROOT = path.join(VULN_APP, 'src', '__aegis_mod_graph__');

/** Back-compat alias for callers that pass no namespace (legacy path). */
export const FIXTURE_DIR = FIXTURE_ROOT;

/**
 * Resolve the fixture directory for a namespace. Namespaces carve
 * per-test-file subdirectories out of {@link FIXTURE_ROOT} so concurrent
 * Vitest workers on different test files don't overwrite each other's
 * fixtures.
 */
export function fixtureDir(namespace: string): string {
  if (namespace === '') return FIXTURE_ROOT;
  return path.join(FIXTURE_ROOT, namespace);
}

/**
 * Write a set of files into the fixture tree for `namespace`. Keys are
 * paths relative to the namespaced directory; values are file contents.
 * Returns the absolute paths in the order provided.
 *
 * Pass an empty string (the default) to keep legacy behavior — but any
 * test file with its own `afterEach(cleanup(''))` SHOULD supply a unique
 * namespace, otherwise parallel test files can clobber each other.
 */
export function writeFixtures(files: Record<string, string>, namespace = ''): string[] {
  const dir = fixtureDir(namespace);
  fs.mkdirSync(dir, { recursive: true });
  const paths: string[] = [];
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(dir, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
    paths.push(full);
  }
  return paths;
}

/**
 * Build a ts.Program for the given fixture set, rooted at {@link VULN_APP}
 * so tsconfig-based module resolution works. Returns null if buildProgram
 * bailed out (usually due to PROGRAM_MODE_MAX_FILES — impossible with
 * small fixtures, but the contract is the same as production code).
 */
export function buildProgramFor(
  files: Record<string, string>,
  namespace = '',
): {
  program: ts.Program | null;
  paths: string[];
} {
  const paths = writeFixtures(files, namespace);
  const program = buildProgram(VULN_APP, paths);
  if (program !== null) {
    // Force binding: ts.createProgram does NOT set node.parent pointers until
    // something triggers binding (typically getTypeChecker() or
    // getSemanticDiagnostics). Many AST helpers (node.getSourceFile(),
    // node.getText()) walk the parent chain and return undefined on
    // unbound nodes. Binding eagerly here keeps tests simple — production
    // call paths already touch the type checker in taint-tracker.
    program.getTypeChecker();
  }
  return { program, paths };
}

/**
 * Convenience wrapper combining {@link buildProgramFor} and a ModuleGraph
 * construction. Non-null assertions are used because the fixtures are
 * expected to be small and well-formed — tests that want to exercise the
 * null-program fallback should call buildProgramFor directly and handle
 * the null case explicitly.
 */
export function buildGraphFor(
  files: Record<string, string>,
  namespace = '',
): {
  graph: ModuleGraph;
  program: ts.Program;
  paths: string[];
} {
  const { program, paths } = buildProgramFor(files, namespace);
  if (program === null) {
    throw new Error(
      'buildGraphFor: buildProgram returned null for a small fixture set — this is unexpected',
    );
  }
  return { graph: new ModuleGraph(program), program, paths };
}

/**
 * Remove the fixture directory for `namespace`. Safe to call even when it
 * doesn't exist. Prefer calling from `afterEach` so fixtures never leak
 * across tests.
 *
 * Pass an empty string (the default) to clear the whole fixture ROOT —
 * handy for legacy callers but dangerous in parallel tests: one file's
 * cleanup can then wipe another file's in-flight fixtures. Always pass a
 * matching namespace in concurrent test contexts.
 */
export function cleanup(namespace = ''): void {
  try {
    fs.rmSync(fixtureDir(namespace), { recursive: true, force: true });
  } catch {
    // ignore — nothing to clean up
  }
}
