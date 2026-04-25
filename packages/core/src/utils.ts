import * as childProcess from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import ignoreLib from 'ignore';
import picomatch from 'picomatch';

// ignore@7's default export is the factory; destructure for consistent call-shape.
const createIgnore = ignoreLib as unknown as () => {
  add(patterns: string | readonly string[]): ReturnType<typeof createIgnore>;
  ignores(pathname: string): boolean;
};

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

/**
 * v0.17.3 SC-1 — gitignore-aware walking via the `ignore` npm package
 * (gitignore(5)-spec compliant, ~900k weekly downloads, battle-tested).
 *
 * Default ON: closes the v0.17.2 dogfood-paradox where parallel-session
 * operator-local work in `aegis-precision/` polluted self-scan output
 * and required a workaround path-filter at the §6 gate-check. With this
 * on, the scanner honors the repo's `.gitignore` at project-root and
 * any composed child `.gitignore` files encountered during the walk.
 *
 * Opt-out via `opts.respectGitignore = false` for scanner-internal
 * test-fixtures that need a full walk regardless of ignore-state.
 */
export interface WalkFilesOptions {
  respectGitignore?: boolean;
}

/** Load a `.gitignore` file's patterns; returns [] when absent/unreadable. */
function readGitignorePatterns(gitignorePath: string): string[] {
  try {
    const raw = fs.readFileSync(gitignorePath, 'utf-8');
    return raw
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith('#'));
  } catch {
    return [];
  }
}

export function walkFiles(
  dir: string,
  ignore: string[] = [],
  extensions: string[] = [],
  opts: WalkFilesOptions = {},
): string[] {
  const respectGitignore = opts.respectGitignore ?? true;
  const resolvedDir = path.resolve(dir);
  const cacheKey = `${resolvedDir}:${ignore.join(',')}:${extensions.join(',')}:gi=${respectGitignore ? '1' : '0'}`;

  const cached = _walkFilesCache.get(cacheKey);
  if (cached) return cached;

  // Pre-load root `.gitignore` when enabled. Child `.gitignore` files
  // encountered during walk compose via their own `ignore` instance keyed
  // by containing-dir relative to resolvedDir. Composition order: a file
  // is filtered if the ROOT matcher OR any ANCESTOR matcher between root
  // and the file's containing dir ignores it. Negation (`!pattern`) is
  // handled by the `ignore` library per gitignore(5) spec.
  const rootGitignoreMatcher = respectGitignore
    ? (() => {
        const rootPatterns = readGitignorePatterns(path.join(resolvedDir, '.gitignore'));
        if (rootPatterns.length === 0) return null;
        return createIgnore().add(rootPatterns);
      })()
    : null;
  /** dirRelative (from resolvedDir) → ignore-matcher for that subdir's .gitignore */
  const childMatchers = new Map<string, ReturnType<typeof createIgnore>>();

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

  /**
   * gitignore-check: path is considered ignored iff the root matcher OR any
   * ancestor child-matcher (up the chain to resolvedDir) reports ignored.
   * The `ignore` library interprets paths relative to the matcher's base.
   * Returns false if respectGitignore is off or no matchers exist.
   */
  function isGitignored(fullPath: string, isDir: boolean): boolean {
    if (!respectGitignore) return false;
    const rel = path.relative(resolvedDir, fullPath);
    if (rel.length === 0) return false;
    // `ignore` treats trailing-slash as directory; pass explicit relPath.
    const relForCheck = isDir ? `${rel}/` : rel;
    if (rootGitignoreMatcher && rootGitignoreMatcher.ignores(relForCheck)) return true;
    // Walk ancestor child-matchers: for a file at a/b/c.ts, check matchers
    // attached to 'a/b', 'a', root (root already checked).
    let cursor = path.dirname(rel);
    while (cursor && cursor !== '.') {
      const matcher = childMatchers.get(cursor);
      if (matcher) {
        const relFromCursor = path.relative(cursor, rel);
        const cursorRel = isDir ? `${relFromCursor}/` : relFromCursor;
        if (matcher.ignores(cursorRel)) return true;
      }
      const parent = path.dirname(cursor);
      if (parent === cursor) break;
      cursor = parent;
    }
    return false;
  }

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

    // If this subdir has its own .gitignore, attach a child-matcher keyed
    // by its path relative to resolvedDir. Root .gitignore already loaded.
    if (respectGitignore && current !== resolvedDir) {
      const subGitignore = path.join(current, '.gitignore');
      if (fs.existsSync(subGitignore)) {
        const subPatterns = readGitignorePatterns(subGitignore);
        if (subPatterns.length > 0) {
          const key = path.relative(resolvedDir, current);
          childMatchers.set(key, createIgnore().add(subPatterns));
        }
      }
    }

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
        // SC-1: honor .gitignore for directories (prunes the walk early)
        if (isGitignored(fullPath, true)) continue;
        walk(fullPath, false);
      } else if (entry.isFile()) {
        // File-level filter — only glob-patterns apply, preserving
        // backward-compat for literal-string ignore entries.
        if (matchFileAnyDepth(entry.name) || matchFileAnyDepth(relPath)) continue;
        if (atRoot && (matchFileRootOnly(entry.name) || matchFileRootOnly(relPath))) continue;
        // SC-1: honor .gitignore for files
        if (isGitignored(fullPath, false)) continue;

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
 * Validate a git ref-name to reject shell-metacharacters + git-invalid syntax.
 * Defense-in-depth on top of execFile (which doesn't invoke a shell). Belt-
 * and-suspenders: even if execFile semantics regress, the validator catches
 * the attack before reaching git.
 *
 * Closes AUDIT-AEGIS-SCAN-V0165 §1 C1 (CWE-78).
 */
function isValidGitRef(ref: string): boolean {
  // git check-ref-format permits some shell-metas (&, |, >, <, `) so we
  // pre-filter MORE strictly: ref must match a conservative subset of git's
  // grammar that excludes ALL shell-actively-parsed characters.
  if (typeof ref !== 'string' || ref.length === 0 || ref.length > 256) return false;
  // Reject: whitespace, all shell-metachars, .., leading -.
  if (/[\s&|><`;$(){}[\]!*?\\'"#]/.test(ref)) return false;
  if (ref.includes('..')) return false;
  if (ref.startsWith('-')) return false;
  return true;
}

/**
 * Get files changed between a base ref and HEAD using `git diff --name-only`.
 * Returns absolute paths. Throws if git is not available or the ref is invalid.
 *
 * Uses execFile (NOT execSync with shell-string) to prevent CWE-78 OS command
 * injection through baseRef (CLI arg). Closes AUDIT-AEGIS-SCAN-V0165 §1 C1.
 */
export async function getChangedFiles(
  projectPath: string,
  baseRef: string,
): Promise<string[]> {
  if (!isValidGitRef(baseRef)) {
    throw new Error(`Invalid git ref (rejected by isValidGitRef): ${JSON.stringify(baseRef)}`);
  }
  const resolvedPath = path.resolve(projectPath);
  const { stdout, exitCode, stderr } = await exec(
    'git',
    ['diff', '--name-only', '--diff-filter=ACMRT', `${baseRef}...HEAD`],
    { cwd: resolvedPath, timeout: 10_000 },
  );
  if (exitCode !== 0) {
    throw new Error(`git diff failed (exit ${exitCode}): ${stderr.trim()}`);
  }
  return stdout
    .trim()
    .split('\n')
    .filter((line) => line.length > 0)
    .map((relativePath) => path.resolve(resolvedPath, relativePath));
}
