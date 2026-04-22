/**
 * `aegis-wizard new <project-name>` — main CLI entry for scaffold
 * emission. Runs the Tier-1 wizard (or reads a pre-filled config in
 * non-interactive mode) and writes the resulting aegis.config.json and
 * agent-brief into the output directory.
 *
 * Flags:
 *   --interactive             (default) run the Tier-1 wizard
 *   --non-interactive         read config from --config path
 *   --config <file>           path to pre-filled aegis.config.json
 *   --output-dir <dir>        where to write (default: ./<project-name>)
 *   --output-mode <mode>      brief | scaffold | both (default: both)
 *   --verbose-brief           emit verbose brief with prose + rationale
 *   --lang <lang>             en (default) | de — brief output language
 *
 * Exit codes:
 *   0 - config (and/or brief) written OK
 *   1 - user error (bad name, missing config file, unknown output-mode, cancelled)
 *   2 - write failure (permissions, mid-run-abort, brief-generation threw)
 *   3 - schema-validation failure (impossible for wizard output; non-interactive path)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import chalk from 'chalk';
import { confirm, isCancel } from '@clack/prompts';
import { AegisConfigSchema, type AegisConfig } from '../wizard/schema.js';
import { runWizard } from '../wizard/flow.js';
import { loadAllPatterns } from '../patterns/loader.js';
import { derivePatterns, resolvePatterns } from '../brief/pattern-selector.js';
import { generateBrief } from '../brief/generator.js';

export const EXIT_OK = 0;
export const EXIT_USER_ERROR = 1;
export const EXIT_WRITE_FAILURE = 2;
export const EXIT_SCHEMA_ERROR = 3;

export type OutputMode = 'brief' | 'scaffold' | 'both';
export type BriefLang = 'en' | 'de';

export interface NewOptions {
  interactive?: boolean;
  nonInteractive?: boolean;
  config?: string;
  outputDir?: string;
  outputMode?: string;
  verboseBrief?: boolean;
  lang?: string;
  /** Optional override for pattern-directory root, used by tests and cross-install setups. */
  patternsDir?: string;
  /** Skip the clobber-check on existing output files and overwrite unconditionally. */
  force?: boolean;
}

const NAME_REGEX = /^[a-z][a-z0-9-]*$/;
const MAX_NAME_LENGTH = 64;
const VALID_OUTPUT_MODES: readonly OutputMode[] = ['brief', 'scaffold', 'both'];
const VALID_LANGS: readonly BriefLang[] = ['en', 'de'];

function validateProjectName(name: string): string | null {
  if (!name) return 'project name is required';
  if (name.length > MAX_NAME_LENGTH) return `name too long (max ${MAX_NAME_LENGTH})`;
  if (!NAME_REGEX.test(name)) {
    return 'name must match ^[a-z][a-z0-9-]*$ (lowercase, digits, hyphens; starts with letter)';
  }
  return null;
}

function normalizeOutputMode(value: string | undefined): OutputMode | null {
  if (!value) return 'both';
  if (VALID_OUTPUT_MODES.includes(value as OutputMode)) return value as OutputMode;
  return null;
}

function normalizeLang(value: string | undefined): BriefLang | null {
  if (!value) return 'en';
  if (VALID_LANGS.includes(value as BriefLang)) return value as BriefLang;
  return null;
}

/** Read own version out of package.json at runtime (same trick as index.ts). */
function readSelfVersion(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const pkgPath = join(here, '..', '..', 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as { version: string };
  return pkg.version;
}

/**
 * Resolve the patterns directory relative to a given anchor directory.
 * Two layouts are supported:
 *
 *   1. Installed-package layout — after the post-build copy-step lands
 *      pattern .md files into dist/docs/patterns/, the shipped tarball
 *      contains them at that path. From dist/commands/ that resolves
 *      with one `..` step into dist/, then into docs/patterns/.
 *
 *   2. Monorepo-dev layout — when running from a local checkout the
 *      patterns live at the repo root. From dist/commands/ (or from
 *      src/commands/ under vitest) that is four `..` steps up to the
 *      repo root, then into docs/patterns/.
 *
 * The installed-layout is tried first because it is the production path;
 * the monorepo-dev path is the dev-loop fallback. Throws a descriptive
 * error if neither exists. Exported (together with the anchor-less
 * convenience wrapper below) to make the resolution logic directly
 * unit-testable against fixture directories.
 */
export function resolvePatternsDirFrom(here: string): string {
  const installedPath = resolve(here, '..', 'docs', 'patterns');
  if (existsSync(installedPath)) return installedPath;
  const monorepoPath = resolve(here, '..', '..', '..', '..', 'docs', 'patterns');
  if (existsSync(monorepoPath)) return monorepoPath;
  throw new Error(
    `Pattern directory not found. Searched:\n  ${installedPath}\n  ${monorepoPath}\n` +
      `This is a packaging bug in @aegis-wizard/cli — please file an issue.`,
  );
}

export function resolvePatternsDir(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return resolvePatternsDirFrom(here);
}

export async function runNew(name: string, options: NewOptions = {}): Promise<number> {
  // 1. Validate name
  const nameError = validateProjectName(name);
  if (nameError) {
    console.error(chalk.red(`Error: ${nameError}`));
    return EXIT_USER_ERROR;
  }

  // 2. Validate output-mode early so bad flag short-circuits
  const mode = normalizeOutputMode(options.outputMode);
  if (!mode) {
    console.error(
      chalk.red(
        `Error: --output-mode must be one of ${VALID_OUTPUT_MODES.join(', ')}; got "${options.outputMode}"`,
      ),
    );
    return EXIT_USER_ERROR;
  }

  // 2b. Validate lang
  const lang = normalizeLang(options.lang);
  if (!lang) {
    console.error(
      chalk.red(
        `Error: --lang must be one of ${VALID_LANGS.join(', ')}; got "${options.lang}"`,
      ),
    );
    return EXIT_USER_ERROR;
  }

  // 3. Non-interactive: read + validate pre-filled config
  let config: AegisConfig;
  if (options.nonInteractive) {
    if (!options.config) {
      console.error(chalk.red('Error: --non-interactive requires --config <file>'));
      return EXIT_USER_ERROR;
    }
    const cfgPath = isAbsolute(options.config)
      ? options.config
      : resolve(process.cwd(), options.config);
    if (!existsSync(cfgPath)) {
      console.error(chalk.red(`Error: config file not found: ${cfgPath}`));
      return EXIT_USER_ERROR;
    }
    try {
      const raw = await readFile(cfgPath, 'utf-8');
      config = AegisConfigSchema.parse(JSON.parse(raw));
    } catch (err) {
      console.error(chalk.red('Error: config failed Zod validation.'));
      console.error(chalk.dim((err as Error).message));
      return EXIT_SCHEMA_ERROR;
    }
  } else {
    // 4. Interactive wizard
    const version = readSelfVersion();
    const wizardResult = await runWizard({ projectName: name, aegisVersion: version });
    config = wizardResult.config;
  }

  // 5. Load patterns + derive selection (needed for brief AND for scaffold
  //    because we persist selected_patterns into the emitted config).
  const patternsRoot = options.patternsDir ?? resolvePatternsDir();
  let allPatterns;
  try {
    allPatterns = await loadAllPatterns(patternsRoot);
  } catch (err) {
    console.error(chalk.red(`Error: failed to load patterns from ${patternsRoot}`));
    console.error(chalk.dim((err as Error).message));
    return EXIT_WRITE_FAILURE;
  }

  const selectedRefs = derivePatterns(config);
  let selectedPatterns;
  try {
    selectedPatterns = resolvePatterns(selectedRefs, allPatterns);
  } catch (err) {
    console.error(chalk.red('Error: pattern-resolution failed.'));
    console.error(chalk.dim((err as Error).message));
    return EXIT_WRITE_FAILURE;
  }

  config.selected_patterns = selectedRefs.map((ref) => ({
    category: ref.category,
    name: ref.name,
    version: 1,
  }));

  // 6. Emit outputs per mode
  const verbose = options.verboseBrief === true;
  return writeOutputs(name, options, config, selectedPatterns, mode, lang, verbose);
}

async function writeOutputs(
  name: string,
  options: NewOptions,
  config: AegisConfig,
  patterns: readonly import('../patterns/loader.js').LoadedPattern[],
  mode: OutputMode,
  lang: BriefLang,
  verbose: boolean,
): Promise<number> {
  const outDirRaw = options.outputDir ?? `./${name}`;
  const outDir = isAbsolute(outDirRaw) ? outDirRaw : resolve(process.cwd(), outDirRaw);

  try {
    if (!existsSync(outDir)) {
      mkdirSync(outDir, { recursive: true });
    }
  } catch (err) {
    console.error(chalk.red(`Error: could not create output directory ${outDir}`));
    console.error(chalk.dim((err as Error).message));
    return EXIT_WRITE_FAILURE;
  }

  const configPath = join(outDir, 'aegis.config.json');
  const briefPath = join(outDir, `${config.identity.project_name}-brief.md`);

  const wouldWrite: string[] = [];
  if (mode === 'both' || mode === 'scaffold') wouldWrite.push(configPath);
  if (mode === 'both' || mode === 'brief') wouldWrite.push(briefPath);

  const clobberResult = await resolveOverwritePolicy(options, wouldWrite);
  if (clobberResult === 'abort') {
    return EXIT_USER_ERROR;
  }

  if (mode === 'both' || mode === 'scaffold') {
    try {
      writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
    } catch (err) {
      console.error(chalk.red(`Error: could not write ${configPath}`));
      console.error(chalk.dim((err as Error).message));
      return EXIT_WRITE_FAILURE;
    }
  }

  if (mode === 'both' || mode === 'brief') {
    let briefMd: string;
    try {
      briefMd = generateBrief(config, patterns, {
        tone: verbose ? 'verbose' : 'terse',
        lang,
      });
    } catch (err) {
      console.error(chalk.red('Error: brief-generation failed.'));
      console.error(chalk.dim((err as Error).message));
      return EXIT_WRITE_FAILURE;
    }
    try {
      writeFileSync(briefPath, briefMd + '\n', 'utf-8');
    } catch (err) {
      console.error(chalk.red(`Error: could not write ${briefPath}`));
      console.error(chalk.dim((err as Error).message));
      return EXIT_WRITE_FAILURE;
    }
  }

  console.log('');
  if (mode === 'both' || mode === 'scaffold') {
    console.log(chalk.green(`Wrote ${configPath}`));
  }
  if (mode === 'both' || mode === 'brief') {
    console.log(chalk.green(`Wrote ${briefPath}`));
  }
  console.log('');
  console.log(chalk.bold('Next steps:'));
  if (mode === 'both' || mode === 'scaffold') {
    console.log(`  cat ${configPath}       # review your configuration`);
  }
  if (mode === 'both' || mode === 'brief') {
    console.log(`  less ${briefPath}       # review the agent-brief`);
    console.log(`  # hand the brief to an AI coding-agent (Claude Code, Codex, Cursor)`);
  }
  console.log('');
  return EXIT_OK;
}

/**
 * Decide how the output writer handles already-existing target files.
 *
 * Four outcomes, in decreasing preference order:
 *   1. No existing files intersect the write-set → proceed.
 *   2. options.force is set → proceed, overwriting unconditionally.
 *   3. Non-interactive caller without --force → abort with a pointer
 *      to --force so CI scripts fail loudly rather than silently
 *      clobbering a user's work.
 *   4. Interactive caller → prompt via @clack/prompts; confirm-yes
 *      proceeds, confirm-no or Ctrl-C aborts.
 *
 * Returns a discriminated value rather than a boolean so the caller
 * can map 'abort' onto EXIT_USER_ERROR without re-guessing why we
 * stopped.
 */
async function resolveOverwritePolicy(
  options: NewOptions,
  paths: readonly string[],
): Promise<'proceed' | 'abort'> {
  const existing = paths.filter((p) => existsSync(p));
  if (existing.length === 0) return 'proceed';
  if (options.force === true) return 'proceed';

  if (options.nonInteractive === true) {
    console.error(chalk.red('Error: refusing to overwrite existing output files:'));
    for (const p of existing) console.error(chalk.red(`  ${p}`));
    console.error(
      chalk.dim('Pass --force to override, or choose a different --output-dir.'),
    );
    return 'abort';
  }

  const response = await confirm({
    message: `Overwrite existing file(s)?\n  ${existing.join('\n  ')}`,
    initialValue: false,
  });
  if (isCancel(response) || response === false) {
    console.error(chalk.red('Aborted: existing output files left intact.'));
    return 'abort';
  }
  return 'proceed';
}
