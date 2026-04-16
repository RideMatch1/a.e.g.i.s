/**
 * ts.Program builder — foundation for type-aware taint analysis (Phase 3).
 *
 * Why a shared Program:
 *   Per-file `ts.createSourceFile` (the pre-Phase-3 approach) has no type
 *   checker — it produces AST only. To decide "is this `exec` really
 *   child_process.exec or a locally-shadowed function?" we need the
 *   declaration graph across the whole project, which requires a
 *   fully-constructed ts.Program with its TypeChecker.
 *
 * Why a preflight bail-out:
 *   `ts.createProgram` is synchronous and scales super-linearly with file
 *   count (declaration resolution, lib types, module resolution). On huge
 *   monorepos (> 5000 files) it can hang for minutes. We short-circuit
 *   above a threshold and fall back to per-file string-match — the pre-3a
 *   behavior, which is still correct (type-aware is a PURE FILTER on top
 *   of string-match, never a replacement).
 */
import ts from 'typescript';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Hard upper bound on files for program-mode analysis.
 * Above this, `buildProgram` returns null and callers fall back to
 * per-file string-match analysis.
 */
export const PROGRAM_MODE_MAX_FILES = 5_000;

/**
 * Normalize a filesystem path to forward-slash form for cross-platform
 * pattern matching.
 *
 * Why this exists: downstream consumers (e.g., `resolveSinkSymbol`) compare
 * declaration-source-file paths to patterns like `/@types/node/`. On
 * Windows, user-provided paths may use backslashes (`C:\project\node_modules\@types\node\fs.d.ts`)
 * which would never match. TypeScript's own `sourceFile.fileName` is
 * already forward-slash-normalized, but any path we construct ourselves
 * (e.g., from `path.join`) needs explicit normalization.
 */
export function normalizePath(p: string): string {
  return p.replace(/\\/g, '/');
}

/**
 * Return the absolute path of tsconfig.json in the project root, or null
 * if none exists. Does NOT walk up — the scanner's project root is
 * authoritative (scanning a subdirectory shouldn't inherit a grand-parent
 * tsconfig).
 */
export function findTsconfig(projectPath: string): string | null {
  const candidate = path.join(projectPath, 'tsconfig.json');
  return fs.existsSync(candidate) ? candidate : null;
}

/**
 * Parse a tsconfig.json file into resolved CompilerOptions.
 * Honors `extends`, `paths`, `types`, `include`, `exclude` via
 * `ts.parseJsonConfigFileContent`. Returns null on JSON parse failure —
 * callers should fall back to `syntheticOptions()`.
 *
 * Non-fatal config issues (unresolvable paths, unknown options) are
 * tolerated: we return whatever options were parseable.
 */
export function parseTsconfig(configPath: string): ts.CompilerOptions | null {
  try {
    const text = fs.readFileSync(configPath, 'utf-8');
    const parsed = ts.parseConfigFileTextToJson(configPath, text);
    if (parsed.error) return null;
    const root = path.dirname(configPath);
    const resolved = ts.parseJsonConfigFileContent(parsed.config, ts.sys, root);
    return resolved.options;
  } catch {
    return null;
  }
}

/**
 * Fallback CompilerOptions used when no tsconfig.json is present.
 * Intentionally permissive so the checker resolves as much as possible
 * without tripping on user code.
 *
 * KNOWN LIMITATION: Path aliases (e.g., `@/*`) are NOT resolved in
 * synthetic mode — projects must ship a tsconfig.json for alias-heavy
 * imports to type-check. This is documented in docs/ and the scanner
 * gracefully degrades to string-match for unresolvable imports.
 */
export function syntheticOptions(): ts.CompilerOptions {
  return {
    allowJs: true,
    checkJs: false,
    jsx: ts.JsxEmit.Preserve,
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    skipLibCheck: true,
    strict: false,
    noEmit: true,
    esModuleInterop: true,
    isolatedModules: true,
    resolveJsonModule: true,
    types: ['node'],
  };
}

/**
 * Build a TypeScript Program for type-aware taint analysis.
 *
 * Returns null when:
 *   - File count exceeds {@link PROGRAM_MODE_MAX_FILES} (preflight)
 *   - `ts.createProgram` throws (malformed sources, unresolvable libs)
 *
 * Callers MUST handle null by falling back to per-file string-match
 * analysis. This is the graceful-degradation contract of the type-aware
 * subsystem.
 */
export function buildProgram(
  projectPath: string,
  files: string[],
): ts.Program | null {
  if (files.length > PROGRAM_MODE_MAX_FILES) {
    return null;
  }

  const configPath = findTsconfig(projectPath);
  const opts = (configPath ? parseTsconfig(configPath) : null) ?? syntheticOptions();

  try {
    return ts.createProgram({
      rootNames: files,
      options: opts,
    });
  } catch {
    return null;
  }
}
