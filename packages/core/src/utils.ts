import * as childProcess from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import picomatch from 'picomatch';

export interface ExecOptions {
  cwd?: string;
  timeout?: number;
  env?: NodeJS.ProcessEnv;
}

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Safe child_process.execFile wrapper.
 * ALWAYS resolves — even on non-zero exit codes — so callers can read stdout/stderr
 * from tools that exit 1 when findings exist (gitleaks, semgrep, npm audit, etc.).
 * Only rejects on timeout or signal kill.
 */
export function exec(
  command: string,
  args: string[] = [],
  options: ExecOptions = {},
): Promise<ExecResult> {
  const { cwd, timeout = 120_000, env } = options;

  return new Promise((resolve, reject) => {
    childProcess.execFile(
      command,
      args,
      {
        cwd,
        timeout,
        maxBuffer: 50 * 1024 * 1024, // 50 MB
        env: env ?? process.env,
      },
      (error, stdout, stderr) => {
        if (error && (error as Error & { killed?: boolean }).killed) {
          reject(new Error(`Command timed out: ${command} ${args.join(' ')}`));
          return;
        }
        // Always resolve — non-zero exit is normal for many security tools
        resolve({
          stdout: stdout ?? '',
          stderr: stderr ?? '',
          exitCode: error ? (error as Error & { code?: number }).code ?? 1 : 0,
        });
      },
    );
  });
}

/**
 * Checks if a command exists on PATH.
 */
export async function commandExists(command: string): Promise<boolean> {
  try {
    const whichCmd = process.platform === 'win32' ? 'where.exe' : 'which';
    const result = await exec(whichCmd, [command], { timeout: 5000 });
    return result.exitCode === 0;
  } catch {
    return false;
  }
}

/**
 * v0.15.4 D-N-004 — file-size cap for walkFiles. Files larger than this
 * are skipped at the walker level so scanners never read them into
 * memory and never pay regex-scan time on multi-megabyte bundles. The
 * default of 2 MiB excludes essentially all hand-written source files
 * (typical < 100 KiB) and standard minified bundles (typical 100 KiB
 * to ~1 MiB) while catching vendored mega-bundles that slipped past
 * DEFAULT_IGNORE (e.g. a 50 MB concatenated CDN dump with a `.js`
 * extension that would otherwise take >15 s to scan a single file).
 * Round-4 audit-finding 🟡 D-N-004.
 */
export const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024;

/** Module-level cache for walkFiles results — avoids redundant directory traversals
 *  when multiple scanners walk the same directories in a single audit run. */
const _walkFilesCache = new Map<string, string[]>();

/**
 * Clears the walkFiles result cache. Useful in tests or between audit runs.
 */
export function clearWalkFilesCache(): void {
  _walkFilesCache.clear();
}

/**
 * Recursive file walker returning ABSOLUTE paths.
 * Filters by ignored directory names and optional file extensions (without dot).
 * Results are memoized by (dir, ignore, extensions) key for the lifetime of the process
 * or until clearWalkFilesCache() is called.
 */
/**
 * Walk a directory tree, returning file paths with the given extensions,
 * skipping directories whose names appear in the `ignore` list.
 *
 * Ignore-list encoding:
 *   - `"node_modules"`  — bare name matches a directory at ANY depth.
 *   - `"/public"`       — leading slash means match only at the
 *                         project root (`dir`'s direct children).
 *
 * Root-only entries were introduced in v0.10 (Z9): the v0.9.5
 * DEFAULT_IGNORE additions `public` / `static` / `assets` were aimed
 * at the Next.js project-root `public/` directory (Monaco vendor
 * bundles etc.), but without a root-only distinction they silently
 * skipped any nested directory of that name too — e.g. a legitimate
 * route path `app/api/public/foo/route.ts` was dropped entirely.
 */
/**
 * v0.15.4 D-C-001 — detect whether a pattern contains glob-wildcards.
 * Used to decide whether a pattern participates in file-level filtering
 * (glob-patterns do) vs dir-only-filtering (literal strings stay dir-only
 * for backward-compat — pre-v0.15.4 Set.has never matched files).
 */
function isGlobPattern(pattern: string): boolean {
  return /[*?[{]/.test(pattern);
}

export function walkFiles(
  dir: string,
  ignore: string[] = [],
  extensions: string[] = [],
): string[] {
  const resolvedDir = path.resolve(dir);
  const cacheKey = `${resolvedDir}:${ignore.join(',')}:${extensions.join(',')}`;

  const cached = _walkFilesCache.get(cacheKey);
  if (cached) return cached;

  // Split ignore entries into any-depth (bare) and root-only (leading `/`).
  // v0.15.4 D-C-001 — each bucket compiles its patterns via picomatch so
  // literal strings stay exact-match while wildcards (Templates*,
  // **/*.min.js, etc.) match per glob semantics. File-level matching is
  // applied ONLY for glob-patterns to preserve backward-compat with
  // literal-only configs (pre-v0.15.4 Set.has never matched files against
  // any ignore entry; literal-filename entries would have been silent
  // no-ops on files and remain so here).
  const anyDepthPatterns = ignore.filter((e) => !e.startsWith('/'));
  const rootOnlyPatterns = ignore.filter((e) => e.startsWith('/')).map((e) => e.slice(1));
  const anyDepthGlobs = anyDepthPatterns.filter(isGlobPattern);
  const rootOnlyGlobs = rootOnlyPatterns.filter(isGlobPattern);

  const matchDirAnyDepth = anyDepthPatterns.length
    ? picomatch(anyDepthPatterns, { dot: true })
    : () => false;
  const matchDirRootOnly = rootOnlyPatterns.length
    ? picomatch(rootOnlyPatterns, { dot: true })
    : () => false;
  const matchFileAnyDepth = anyDepthGlobs.length
    ? picomatch(anyDepthGlobs, { dot: true })
    : () => false;
  const matchFileRootOnly = rootOnlyGlobs.length
    ? picomatch(rootOnlyGlobs, { dot: true })
    : () => false;

  const results: string[] = [];
  const visited = new Set<string>();

  function walk(current: string, atRoot: boolean): void {
    // Resolve symlinks to detect cycles
    let realPath: string;
    try {
      realPath = fs.realpathSync(current);
    } catch {
      return;
    }
    if (visited.has(realPath)) return;
    visited.add(realPath);

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      const relPath = path.relative(resolvedDir, fullPath);

      if (entry.isDirectory()) {
        // Dir-level filter — both literal and glob patterns apply to dirs.
        if (matchDirAnyDepth(entry.name) || matchDirAnyDepth(relPath)) continue;
        if (atRoot && (matchDirRootOnly(entry.name) || matchDirRootOnly(relPath))) continue;
        walk(fullPath, false);
      } else if (entry.isFile()) {
        // File-level filter — only glob-patterns apply, preserving
        // backward-compat for literal-string ignore entries.
        if (matchFileAnyDepth(entry.name) || matchFileAnyDepth(relPath)) continue;
        if (atRoot && (matchFileRootOnly(entry.name) || matchFileRootOnly(relPath))) continue;

        if (extensions.length > 0) {
          // Fix: path.extname returns '.ts' — slice(1) removes the dot to match ['ts', 'js']
          const ext = path.extname(entry.name).slice(1);
          if (!extensions.includes(ext)) continue;
        }

        // v0.15.4 D-N-004 — size cap. Stat each candidate file and skip
        // anything above MAX_FILE_SIZE_BYTES. Stat failure treated as
        // skip, matching readFileSafe's any-error-returns-null contract.
        try {
          if (fs.statSync(fullPath).size > MAX_FILE_SIZE_BYTES) continue;
        } catch {
          continue;
        }

        results.push(fullPath);
      }
    }
  }

  walk(resolvedDir, true);
  _walkFilesCache.set(cacheKey, results);
  return results;
}

/**
 * Reads a file, returning null on any failure (file not found, permission denied, etc.).
 */
export function readFileSafe(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}

/**
 * Get files changed between a base ref and HEAD using `git diff --name-only`.
 * Returns absolute paths. Throws if git is not available or the ref is invalid.
 */
export function getChangedFiles(projectPath: string, baseRef: string): string[] {
  const resolvedPath = path.resolve(projectPath);
  const result = childProcess.execSync(
    `git diff --name-only --diff-filter=ACMRT ${baseRef}...HEAD`,
    { cwd: resolvedPath, encoding: 'utf-8', timeout: 10_000 },
  );
  return result
    .trim()
    .split('\n')
    .filter((line) => line.length > 0)
    .map((relativePath) => path.resolve(resolvedPath, relativePath));
}
