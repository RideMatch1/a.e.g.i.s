/**
 * `aegis-wizard new <project-name>` - Day-2 surface.
 *
 * Flags:
 *   --interactive             (default) run the Tier-1 wizard
 *   --non-interactive         read config from --config path
 *   --config <file>           path to pre-filled aegis.config.json
 *   --output-dir <dir>        where to write (default: ./<project-name>)
 *   --output-mode <mode>      brief | scaffold | both (default: both)
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

export interface NewOptions {
  interactive?: boolean;
  nonInteractive?: boolean;
  config?: string;
  outputDir?: string;
  outputMode?: string;
  /** Optional override for pattern-directory root, used by tests and cross-install setups. */
  patternsDir?: string;
}

const NAME_REGEX = /^[a-z][a-z0-9-]*$/;
const MAX_NAME_LENGTH = 64;
const VALID_OUTPUT_MODES: readonly OutputMode[] = ['brief', 'scaffold', 'both'];

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

/** Read own version out of package.json at runtime (same trick as index.ts). */
function readSelfVersion(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const pkgPath = join(here, '..', '..', 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as { version: string };
  return pkg.version;
}

/**
 * Resolve the patterns directory at runtime. In the monorepo dev-mode
 * (current Day-2 shape) the CLI runs from packages/wizard-cli/dist/commands
 * and docs/patterns lives at the monorepo root, so four `..`-steps get us
 * there. Day-3 publish-flow copies patterns into the tarball and this
 * resolver gains an additional branch.
 */
function resolvePatternsDir(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, '..', '..', '..', '..', 'docs', 'patterns');
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
  return writeOutputs(name, options, config, selectedPatterns, mode);
}

function writeOutputs(
  name: string,
  options: NewOptions,
  config: AegisConfig,
  patterns: readonly import('../patterns/loader.js').LoadedPattern[],
  mode: OutputMode,
): number {
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
      briefMd = generateBrief(config, patterns, { tone: 'terse', lang: 'en' });
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
