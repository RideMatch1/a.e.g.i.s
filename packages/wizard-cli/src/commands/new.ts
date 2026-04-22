/**
 * `aegis-wizard new <project-name>` — Day-1 surface.
 *
 * Flags:
 *   --interactive           (default) run the Tier-1 wizard
 *   --non-interactive       read config from --config path (Day-2)
 *   --config <file>         path to pre-filled aegis.config.json
 *   --output-dir <dir>      where to write (default: ./<project-name>)
 *
 * Exit codes:
 *   0 — config written OK
 *   1 — user error (bad name, missing config file, cancelled)
 *   2 — write failure (permissions, mid-run-abort)
 *   3 — schema-validation failure (impossible for wizard output; non-interactive path)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import chalk from 'chalk';
import { AegisConfigSchema } from '../wizard/schema.js';
import { runWizard } from '../wizard/flow.js';

export const EXIT_OK = 0;
export const EXIT_USER_ERROR = 1;
export const EXIT_WRITE_FAILURE = 2;
export const EXIT_SCHEMA_ERROR = 3;

export interface NewOptions {
  interactive?: boolean;
  nonInteractive?: boolean;
  config?: string;
  outputDir?: string;
}

const NAME_REGEX = /^[a-z][a-z0-9-]*$/;
const MAX_NAME_LENGTH = 64;

function validateProjectName(name: string): string | null {
  if (!name) return 'project name is required';
  if (name.length > MAX_NAME_LENGTH) return `name too long (max ${MAX_NAME_LENGTH})`;
  if (!NAME_REGEX.test(name)) {
    return 'name must match ^[a-z][a-z0-9-]*$ (lowercase, digits, hyphens; starts with letter)';
  }
  return null;
}

/** Read own version out of package.json at runtime (same trick as index.ts). */
function readSelfVersion(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const pkgPath = join(here, '..', '..', 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as { version: string };
  return pkg.version;
}

export async function runNew(name: string, options: NewOptions = {}): Promise<number> {
  // 1. Validate name
  const nameError = validateProjectName(name);
  if (nameError) {
    console.error(chalk.red(`Error: ${nameError}`));
    return EXIT_USER_ERROR;
  }

  // 2. Non-interactive: read + validate pre-filled config (Day-2 will expand this path)
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
    let parsed;
    try {
      const raw = await readFile(cfgPath, 'utf-8');
      parsed = AegisConfigSchema.parse(JSON.parse(raw));
    } catch (err) {
      console.error(chalk.red('Error: config failed Zod validation.'));
      console.error(chalk.dim((err as Error).message));
      return EXIT_SCHEMA_ERROR;
    }
    return writeConfig(name, options, parsed);
  }

  // 3. Interactive wizard (default)
  const version = readSelfVersion();
  const { config } = await runWizard({
    projectName: name,
    aegisVersion: version,
  });

  return writeConfig(name, options, config);
}

function writeConfig(
  name: string,
  options: NewOptions,
  config: unknown,
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
  try {
    writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
  } catch (err) {
    console.error(chalk.red(`Error: could not write ${configPath}`));
    console.error(chalk.dim((err as Error).message));
    return EXIT_WRITE_FAILURE;
  }

  console.log('');
  console.log(chalk.green(`Wrote ${configPath}`));
  console.log('');
  console.log(chalk.bold('Next steps (Day-1 surface):'));
  console.log(`  cat ${configPath}         # review your answers`);
  console.log('  # brief-generation lands in v0.17 Day-2 (aegis-wizard build-brief)');
  console.log('');
  return EXIT_OK;
}
