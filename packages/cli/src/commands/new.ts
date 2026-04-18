/**
 * `aegis new <name>` — template-aware scaffold generator.
 *
 * Creates a new project directory from a declarative template (manifest in
 * `template.json`, payload under `files/`). Applies `{{PLACEHOLDER}}`
 * substitution, strips `.tpl` suffixes, and optionally runs `npm install` +
 * `aegis scan` as a post-install step (opt-out via flags).
 *
 * Design notes:
 *   - Resolver is a pure function over a candidate-paths array so tests can
 *     inject fixture locations without touching the filesystem layout.
 *   - Mid-scaffold failure cleans up ONLY paths we wrote (plus the target-dir
 *     if we created it); an empty pre-existing dir is left intact.
 *   - Post-install errors are soft-fails — the scaffold itself stays on disk
 *     and the user gets a warning, never a non-zero exit.
 */
import { readFile, writeFile, mkdir, access, readdir, rm, rmdir, unlink } from 'node:fs/promises';
import { existsSync, statSync, readFileSync } from 'node:fs';
import { dirname, join, resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import chalk from 'chalk';
import { loadTemplate, type LoadedTemplate } from '../template/loader.js';
import { substitute } from '../template/substitute.js';

// ─────────────────────────────────────────────────────────────────────────────
// Public types

export interface NewOptions {
  template?: string;
  target?: string;
  skipInstall?: boolean;
  skipScan?: boolean;
  /**
   * Internal — integration-test injection point. When set, overrides the
   * default template-root candidate chain. Never populated by the CLI.
   */
  _templateSearchPaths?: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Name validation

const NAME_REGEX = /^[a-z][a-z0-9-]*$/;
const MAX_NAME_LENGTH = 64;
const RESERVED_NAMES = new Set(['test', 'admin', 'node_modules']);

export function validateProjectName(name: string): { ok: true } | { ok: false; reason: string } {
  if (!name || typeof name !== 'string') {
    return { ok: false, reason: 'name is required' };
  }
  if (name.length > MAX_NAME_LENGTH) {
    return { ok: false, reason: `name too long (max ${MAX_NAME_LENGTH} chars)` };
  }
  if (!NAME_REGEX.test(name)) {
    return {
      ok: false,
      reason: `name must match ${NAME_REGEX} (lowercase letter, then lowercase/digit/hyphen)`,
    };
  }
  if (RESERVED_NAMES.has(name)) {
    return { ok: false, reason: `"${name}" is a reserved name` };
  }
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Template-root resolver

/**
 * Resolve a template root by name against a list of candidate base directories.
 * Returns the first candidate that contains a readable `template.json`.
 */
export function resolveTemplateRoot(
  templateName: string,
  candidates: readonly string[],
): { ok: true; root: string } | { ok: false; tried: string[] } {
  const tried: string[] = [];
  for (const base of candidates) {
    const root = join(base, templateName);
    tried.push(root);
    try {
      const manifest = join(root, 'template.json');
      if (existsSync(manifest) && statSync(manifest).isFile()) {
        return { ok: true, root };
      }
    } catch {
      // keep trying
    }
  }
  return { ok: false, tried };
}

/**
 * Default candidate-chain for template roots. Order:
 *   1. Published-package: `<cli-root>/templates/`
 *      (published tarball will need `templates/` in `files` — v0.13 packaging task)
 *   2. Dev-monorepo: `<repo-root>/templates/` — up 4 levels from
 *      `dist/commands/` (or `src/commands/` when running via tsx).
 */
export function defaultTemplateSearchPaths(commandDir: string): string[] {
  // `commandDir` is the directory of the compiled `new.js` (dist/commands/)
  // or `new.ts` under ts-node / vitest (src/commands/).
  const cliRoot = resolve(commandDir, '..', '..'); // dist/ or src/ -> cli package root
  const repoRoot = resolve(commandDir, '..', '..', '..', '..'); // up to repo root
  return [
    join(cliRoot, 'templates'),
    join(repoRoot, 'templates'),
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// Target-dir validation

async function isDirEmpty(path: string): Promise<boolean> {
  try {
    const entries = await readdir(path);
    return entries.length === 0;
  } catch {
    return false;
  }
}

async function isWritableDir(path: string): Promise<boolean> {
  try {
    // fs.constants.W_OK = 2
    await access(path, 2);
    return true;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// File-mode helper

function modeFor(relPath: string): number {
  return relPath.endsWith('.sh') ? 0o755 : 0o644;
}

function stripTplSuffix(relPath: string): string {
  return relPath.endsWith('.tpl') ? relPath.slice(0, -'.tpl'.length) : relPath;
}

// ─────────────────────────────────────────────────────────────────────────────
// Self-version read (for AEGIS_VERSION placeholder)

function readSelfVersion(commandDir: string): string {
  // commandDir is dist/commands/ or src/commands/, pkg.json is 2 levels up.
  const pkgPath = resolve(commandDir, '..', '..', 'package.json');
  try {
    const raw = readFileSync(pkgPath, 'utf-8');
    const parsed = JSON.parse(raw) as { version?: string };
    if (typeof parsed.version !== 'string') {
      throw new Error('package.json missing version');
    }
    return parsed.version;
  } catch (err) {
    throw new Error(`Could not read AEGIS CLI version from ${pkgPath}: ${(err as Error).message}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Core scaffold

interface ScaffoldContext {
  templateRoot: string;
  loaded: LoadedTemplate;
  targetDir: string;
  substitutions: Record<string, string>;
}

async function writeScaffold(
  ctx: ScaffoldContext & { written: string[] },
): Promise<void> {
  // Caller supplies `written` so mid-loop failures can read the partial list
  // in their catch-block and clean up — see runNew step 6 cleanup path.
  for (const rel of ctx.loaded.files) {
    const sourcePath = join(ctx.templateRoot, 'files', rel);
    const targetRel = stripTplSuffix(rel);
    const targetPath = join(ctx.targetDir, targetRel);

    const raw = await readFile(sourcePath, 'utf-8');
    const content = substitute(raw, ctx.substitutions);

    await mkdir(dirname(targetPath), { recursive: true });
    await writeFile(targetPath, content, { mode: modeFor(targetRel) });
    ctx.written.push(targetPath);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Post-install (npm install + aegis scan)

async function runPostInstall(args: {
  targetDir: string;
  skipInstall: boolean;
  skipScan: boolean;
  loaded: LoadedTemplate;
}): Promise<{ scanScore?: number; scanWarning?: string } | { error: string }> {
  const { targetDir, skipInstall, skipScan, loaded } = args;

  if (skipInstall) return {};
  if (!loaded.manifest.postInstall.scan) return {};

  // 1. npm install
  const installExit = await new Promise<number>((resolveExit) => {
    const child = spawn('npm', ['install'], {
      cwd: targetDir,
      stdio: 'inherit',
    });
    child.on('exit', (code) => resolveExit(code ?? 1));
    child.on('error', () => resolveExit(1));
  });
  if (installExit !== 0) {
    return { error: `npm install exited with code ${installExit}` };
  }

  // 2. aegis scan . --format json (parse score)
  if (skipScan) return {};

  // Spawn the CLI itself by re-invoking node on our own entry point. The
  // current process's argv[1] points at the CLI bin when installed as `aegis`.
  const cliEntry = process.argv[1];
  if (!cliEntry) {
    return { scanWarning: 'could not locate AEGIS CLI entry for post-install scan' };
  }

  const scanResult = await new Promise<{ exit: number; stdout: string }>((resolveScan) => {
    let stdout = '';
    const child = spawn(process.execPath, [cliEntry, 'scan', '.', '--format', 'json', '--no-color'], {
      cwd: targetDir,
      stdio: ['ignore', 'pipe', 'inherit'],
    });
    child.stdout?.on('data', (buf: Buffer) => {
      stdout += buf.toString('utf-8');
    });
    child.on('exit', (code) => resolveScan({ exit: code ?? 1, stdout }));
    child.on('error', () => resolveScan({ exit: 1, stdout }));
  });

  if (scanResult.exit !== 0 && scanResult.exit !== 1) {
    // Scanners returning 1 just means blocking findings — still a valid run
    return { scanWarning: `aegis scan exited with code ${scanResult.exit}` };
  }

  const score = extractScore(scanResult.stdout);
  if (score === null) {
    return { scanWarning: 'could not parse score from scan output' };
  }

  const expected = loaded.manifest.postInstall.scanExpectedScore;
  if (score < expected) {
    return {
      scanScore: score,
      scanWarning: `scan score ${score} < expected baseline ${expected} (not a failure — scanner baseline may have shifted)`,
    };
  }
  return { scanScore: score };
}

function extractScore(jsonStdout: string): number | null {
  try {
    const parsed = JSON.parse(jsonStdout) as { score?: number };
    if (typeof parsed.score === 'number') return parsed.score;
    return null;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Exit-code contract

export const EXIT_OK = 0;
export const EXIT_USER_ERROR = 1; // bad name / existing dir / missing template
export const EXIT_WRITE_FAILURE = 2;
export const EXIT_SUBSTITUTION_ERROR = 3;

// ─────────────────────────────────────────────────────────────────────────────
// Main entry

export async function runNew(name: string, options: NewOptions = {}): Promise<number> {
  // 1. Validate name
  const nameCheck = validateProjectName(name);
  if (!nameCheck.ok) {
    console.error(chalk.red(`Error: ${nameCheck.reason}`));
    return EXIT_USER_ERROR;
  }

  // 2. Resolve template root
  const templateName = options.template ?? 'nextjs-supabase';
  const commandDir = dirname(fileURLToPath(import.meta.url));
  const searchPaths = options._templateSearchPaths ?? defaultTemplateSearchPaths(commandDir);
  const resolved = resolveTemplateRoot(templateName, searchPaths);
  if (!resolved.ok) {
    console.error(chalk.red(`Error: template "${templateName}" not found.`));
    console.error(chalk.dim('Tried:'));
    for (const p of resolved.tried) {
      console.error(chalk.dim(`  ${p}`));
    }
    return EXIT_USER_ERROR;
  }
  const templateRoot = resolved.root;

  // 3. Resolve + validate target dir
  const targetDirRaw = options.target ?? `./${name}`;
  const targetDir = isAbsolute(targetDirRaw) ? targetDirRaw : resolve(process.cwd(), targetDirRaw);

  let createdTargetDir = false;
  if (existsSync(targetDir)) {
    const empty = await isDirEmpty(targetDir);
    if (!empty) {
      console.error(chalk.red(`Error: target directory "${targetDir}" exists and is not empty.`));
      console.error(chalk.dim('Hint: choose a different name or use --target <dir> pointing at an empty path.'));
      return EXIT_USER_ERROR;
    }
    // empty existing dir — we use it, but we do NOT rm it on failure
  } else {
    const parent = dirname(targetDir);
    if (!existsSync(parent)) {
      console.error(chalk.red(`Error: parent directory "${parent}" does not exist.`));
      return EXIT_USER_ERROR;
    }
    if (!(await isWritableDir(parent))) {
      console.error(chalk.red(`Error: parent directory "${parent}" is not writable.`));
      return EXIT_USER_ERROR;
    }
    await mkdir(targetDir, { recursive: true });
    createdTargetDir = true;
  }

  // 4. Load template manifest + enumerate files
  let loaded: LoadedTemplate;
  try {
    loaded = await loadTemplate(templateRoot);
  } catch (err) {
    console.error(chalk.red(`Error: failed to load template at ${templateRoot}`));
    console.error(chalk.dim((err as Error).message));
    if (createdTargetDir) {
      await rm(targetDir, { recursive: true, force: true });
    }
    return EXIT_USER_ERROR;
  }

  // 5. Build substitutions + fail-fast on unsupported placeholders
  const selfVersion = readSelfVersion(commandDir);
  const substitutions: Record<string, string> = {
    PROJECT_NAME: name,
    AEGIS_VERSION: selfVersion,
  };
  const declared = new Set(loaded.manifest.placeholders);
  const supported = new Set(Object.keys(substitutions));
  const unsupported: string[] = [];
  for (const p of declared) {
    if (!supported.has(p)) unsupported.push(p);
  }
  if (unsupported.length > 0) {
    console.error(chalk.red(`Error: template declares placeholders we cannot fill: ${unsupported.join(', ')}`));
    if (createdTargetDir) {
      await rm(targetDir, { recursive: true, force: true });
    }
    return EXIT_SUBSTITUTION_ERROR;
  }

  // 6. Write pipeline — `writtenPaths` is populated incrementally by
  // writeScaffold so the catch-block sees the partial list on mid-write
  // failure (fixes a cleanup no-op when target dir pre-existed empty).
  const writtenPaths: string[] = [];
  try {
    await writeScaffold({
      templateRoot,
      loaded,
      targetDir,
      substitutions,
      written: writtenPaths,
    });
  } catch (err) {
    console.error(chalk.red(`Error: scaffold write failed.`));
    console.error(chalk.dim((err as Error).message));
    if (createdTargetDir) {
      await rm(targetDir, { recursive: true, force: true });
    } else {
      // Remove the files we wrote, leave the user's empty dir intact.
      for (const p of writtenPaths) {
        try {
          await unlink(p);
        } catch {
          /* best-effort cleanup */
        }
      }
      // Remove empty subdirs we created (deepest-first). Skip targetDir
      // itself — user owned it before we arrived.
      const subDirs = [...new Set(writtenPaths.map((p) => dirname(p)))].filter(
        (d) => d !== targetDir,
      );
      for (const d of subDirs.sort((a, b) => b.length - a.length)) {
        try {
          await rmdir(d);
        } catch {
          /* non-empty or already gone — skip */
        }
      }
    }
    return EXIT_WRITE_FAILURE;
  }

  // 7. Success banner + next-steps (pre-postinstall so user sees it even if install stalls)
  const relTarget = relative(process.cwd(), targetDir) || '.';
  console.log('');
  console.log(chalk.green(`Created ${loaded.files.length} files in ${targetDir}`));
  console.log('');
  console.log(chalk.bold('Next steps:'));
  console.log(`  cd ${relTarget}`);
  console.log('  cp .env.local.example .env.local   # set up environment');
  console.log('  npm run dev                         # start Next.js dev server');
  console.log('');

  // 8. Post-install (soft-fail — errors do NOT produce a non-zero exit)
  try {
    const post = await runPostInstall({
      targetDir,
      skipInstall: options.skipInstall ?? false,
      skipScan: options.skipScan ?? false,
      loaded,
    });
    if ('error' in post) {
      console.warn(chalk.yellow(`Warning: post-install step failed — ${post.error}`));
      console.warn(chalk.dim('Scaffold is intact; you can retry manually inside the project dir.'));
    } else {
      if (post.scanScore !== undefined) {
        console.log(chalk.green(`aegis scan score: ${post.scanScore}`));
      }
      if (post.scanWarning) {
        console.warn(chalk.yellow(`Warning: ${post.scanWarning}`));
      }
    }
  } catch (err) {
    console.warn(chalk.yellow(`Warning: post-install step threw — ${(err as Error).message}`));
  }

  return EXIT_OK;
}
