/**
 * `aegis init` — bootstrap AEGIS configuration + CI wiring into a project.
 *
 * Behavior (v0.12 extension):
 *   1. Detect the stack and write `aegis.config.json` at the target root
 *      (pre-existing behavior, unchanged — the config is regenerable so it
 *      overwrites without a prompt).
 *   2. Write three additional onboarding files, copied from the
 *      `nextjs-supabase` template:
 *        - `.github/workflows/aegis.yml`  (pinned to the current CLI version)
 *        - `CLAUDE.md`                    (AI-assistant project instructions)
 *        - `.husky/pre-push`              (runs `aegis scan --fail-on-blocker`)
 *
 * Each of the three extension files respects skip-if-exists by default — we
 * never clobber user files silently. Pass `--force` to overwrite, or an
 * individual `--skip-ci` / `--skip-claude` / `--skip-husky` to opt a single
 * file out entirely. Non-interactive by design (CI-friendly).
 *
 * Partial-write policy: `aegis init` modifies the USER'S project, so we do
 * NOT roll back on partial failure. If file 3 of 3 fails to write, files
 * 1 + 2 stay on disk, we log every outcome, and exit non-zero with an
 * actionable hint. Rollback on a user-owned path = destroying user files.
 */
import { detectStack } from '@aegis-scan/core';
import { mkdirSync, existsSync } from 'node:fs';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { basename, dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import chalk from 'chalk';
import { substitute } from '../template/substitute.js';
import {
  resolveTemplateRoot,
  defaultTemplateSearchPaths,
  readSelfVersion,
} from '../template/paths.js';

// ─────────────────────────────────────────────────────────────────────────────
// Public types

export interface InitOptions {
  force?: boolean;
  skipCi?: boolean;
  skipClaude?: boolean;
  skipHusky?: boolean;
  /**
   * Internal — integration-test injection point. When set, overrides the
   * default template-root candidate chain. Never populated by the CLI.
   */
  _templateSearchPaths?: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Exit-code contract

export const EXIT_OK = 0;
export const EXIT_WRITE_FAILURE = 1;

// ─────────────────────────────────────────────────────────────────────────────
// File-spec: what init writes beyond `aegis.config.json`.
//
// The `kind` discriminator lets v0.14 add multi-template-aware init by
// swapping the list based on detected stack. Today we have one source
// (the `nextjs-supabase` template) for the template-backed files and one
// inline payload (husky hook).

type InitOptionSkipFlag = 'skipCi' | 'skipClaude' | 'skipHusky';

type InitFileSpec =
  | {
      kind: 'template';
      templatePath: string;    // path under <template-root>/files/
      target: string;          // path relative to project root
      placeholders: readonly string[]; // documentation-only; substitute() is conservative
      skipFlag: InitOptionSkipFlag;
      label: string;           // human-friendly log label
    }
  | {
      kind: 'inline';
      content: string;
      target: string;
      mode: number;            // octal mode (e.g. 0o755)
      skipFlag: InitOptionSkipFlag;
      label: string;
    };

const INIT_FILE_SPECS: readonly InitFileSpec[] = [
  {
    kind: 'template',
    templatePath: '.github/workflows/aegis.yml',
    target: '.github/workflows/aegis.yml',
    placeholders: ['AEGIS_VERSION'],
    skipFlag: 'skipCi',
    label: 'GitHub Actions workflow',
  },
  {
    kind: 'template',
    templatePath: 'CLAUDE.md',
    target: 'CLAUDE.md',
    // Primary source has both `{{PROJECT_NAME}}` + `{{AEGIS_VERSION}}` (init
    // supplies PROJECT_NAME from basename(targetDir)).
    placeholders: ['PROJECT_NAME', 'AEGIS_VERSION'],
    skipFlag: 'skipClaude',
    label: 'CLAUDE.md (AI project instructions)',
  },
  {
    kind: 'inline',
    content: '#!/bin/sh\nnpx aegis scan --fail-on-blocker\n',
    target: '.husky/pre-push',
    mode: 0o755,
    skipFlag: 'skipHusky',
    label: 'Husky pre-push hook',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Per-file write-outcome

type WriteOutcome =
  | { status: 'written'; target: string; label: string }
  | { status: 'overwritten'; target: string; label: string }
  | { status: 'skipped-exists'; target: string; label: string }
  | { status: 'skipped-flag'; target: string; label: string }
  | { status: 'failed'; target: string; label: string; error: string };

// ─────────────────────────────────────────────────────────────────────────────
// Core: apply a single InitFileSpec

async function applyFileSpec(args: {
  spec: InitFileSpec;
  resolvedPath: string;
  options: InitOptions;
  templateRoot: string | null; // null when no template specs remain OR resolver failed
  substitutions: Record<string, string>;
}): Promise<WriteOutcome> {
  const { spec, resolvedPath, options, templateRoot, substitutions } = args;
  const target = join(resolvedPath, spec.target);

  if (options[spec.skipFlag]) {
    return { status: 'skipped-flag', target, label: spec.label };
  }

  const fileExists = existsSync(target);
  if (fileExists && !options.force) {
    return { status: 'skipped-exists', target, label: spec.label };
  }

  try {
    let content: string;
    let mode: number;
    if (spec.kind === 'template') {
      if (!templateRoot) {
        throw new Error('template root unavailable — cannot write template-backed file');
      }
      const source = join(templateRoot, 'files', spec.templatePath);
      const raw = await readFile(source, 'utf-8');
      content = substitute(raw, substitutions);
      mode = 0o644;
    } else {
      content = spec.content;
      mode = spec.mode;
    }

    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content, { mode });

    return fileExists
      ? { status: 'overwritten', target, label: spec.label }
      : { status: 'written', target, label: spec.label };
  } catch (err) {
    return {
      status: 'failed',
      target,
      label: spec.label,
      error: (err as Error).message,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main entry

export async function runInit(path: string, options: InitOptions = {}): Promise<number> {
  const resolvedPath = resolve(path || process.cwd());

  // Create directory if it doesn't exist (pre-existing behavior)
  if (!existsSync(resolvedPath)) {
    mkdirSync(resolvedPath, { recursive: true });
  }

  console.log(chalk.bold('AEGIS — Initializing configuration...'));
  console.log(chalk.dim(`Project path: ${resolvedPath}`));

  const stack = await detectStack(resolvedPath);

  console.log('');
  console.log(chalk.bold('Detected stack:'));
  console.log(`  Framework:  ${chalk.cyan(stack.framework)}`);
  console.log(`  Database:   ${chalk.cyan(stack.database)}`);
  console.log(`  Auth:       ${chalk.cyan(stack.auth)}`);
  console.log(`  Language:   ${chalk.cyan(stack.language)}`);
  console.log(`  AI:         ${chalk.cyan(stack.ai)}`);
  console.log(`  Payment:    ${chalk.cyan(stack.payment)}`);
  console.log(`  Deploy:     ${chalk.cyan(stack.deploy)}`);
  console.log(`  i18n:       ${chalk.cyan(String(stack.hasI18n))}`);
  console.log(`  Tests:      ${chalk.cyan(String(stack.hasTests))}`);
  console.log('');

  // ── Step 1 — write aegis.config.json (pre-existing, regenerable)
  const configContent = generateConfig(stack);
  const configPath = join(resolvedPath, 'aegis.config.json');

  await writeFile(configPath, configContent, 'utf8');
  console.log(chalk.green(`✓ Created ${configPath}`));

  // ── Step 2 — write extension files (workflow + CLAUDE.md + husky hook)
  //
  // Only resolve template root + self-version if at least one template spec
  // will actually be written (not --skip'd). Keeps init snappy when the
  // user opts out of everything template-backed.
  const needsTemplateRoot = INIT_FILE_SPECS.some(
    (s) => s.kind === 'template' && !options[s.skipFlag],
  );

  let templateRoot: string | null = null;
  let substitutions: Record<string, string> = {};

  if (needsTemplateRoot) {
    const commandDir = dirname(fileURLToPath(import.meta.url));
    const searchPaths = options._templateSearchPaths ?? defaultTemplateSearchPaths(commandDir);
    const resolved = resolveTemplateRoot('nextjs-supabase', searchPaths);
    if (!resolved.ok) {
      console.error(chalk.red(`Error: template "nextjs-supabase" not found — cannot write extension files.`));
      console.error(chalk.dim('Tried:'));
      for (const p of resolved.tried) {
        console.error(chalk.dim(`  ${p}`));
      }
      console.error(chalk.dim('Hint: re-run with --skip-ci --skip-claude to skip template-backed files, or reinstall the AEGIS CLI.'));
      return EXIT_WRITE_FAILURE;
    }
    templateRoot = resolved.root;

    let selfVersion: string;
    try {
      selfVersion = readSelfVersion(commandDir);
    } catch (err) {
      console.error(chalk.red(`Error: could not read AEGIS CLI version.`));
      console.error(chalk.dim((err as Error).message));
      return EXIT_WRITE_FAILURE;
    }

    // PROJECT_NAME derives from basename(resolvedPath) — same convention as
    // `npm init`. Guard against edge case of a root-like path (e.g. `/`)
    // where basename() is empty; fall back to a neutral placeholder.
    const pathBase = basename(resolvedPath);
    const projectName = pathBase.length > 0 ? pathBase : 'project';
    substitutions = {
      PROJECT_NAME: projectName,
      AEGIS_VERSION: selfVersion,
    };
  }

  const outcomes: WriteOutcome[] = [];
  for (const spec of INIT_FILE_SPECS) {
    const outcome = await applyFileSpec({
      spec,
      resolvedPath,
      options,
      templateRoot,
      substitutions,
    });
    outcomes.push(outcome);

    // Log per-outcome immediately so the user sees progress in order.
    switch (outcome.status) {
      case 'written':
        console.log(chalk.green(`✓ Created ${outcome.target}`));
        break;
      case 'overwritten':
        console.log(
          chalk.yellow(`⚠ Overwrote existing ${outcome.target} (--force)`),
        );
        break;
      case 'skipped-exists':
        console.log(
          chalk.dim(
            `  Skipping ${outcome.target} (exists, use --force to overwrite)`,
          ),
        );
        break;
      case 'skipped-flag':
        // Silent — user explicitly asked to skip.
        break;
      case 'failed':
        console.error(chalk.red(`✗ Failed to write ${outcome.target}: ${outcome.error}`));
        break;
    }
  }

  const failures = outcomes.filter((o) => o.status === 'failed');

  console.log('');
  if (failures.length > 0) {
    // Partial-write policy: we do NOT roll back successful writes. Report
    // what succeeded, what failed, exit non-zero with a pointer to --force.
    console.error(
      chalk.red(
        `init partially failed: ${failures.length}/${INIT_FILE_SPECS.length} extension files could not be written.`,
      ),
    );
    console.error(
      chalk.dim(
        'Successfully-written files have been left on disk — re-run `aegis init` after fixing the underlying issue (e.g. permissions).',
      ),
    );
    return EXIT_WRITE_FAILURE;
  }

  console.log('Next steps:');
  console.log(`  ${chalk.bold('aegis scan .')}   — Quick scan (security, dependencies, quality, compliance, i18n)`);
  console.log(`  ${chalk.bold('aegis audit .')}  — Full audit (all scanners)`);
  return EXIT_OK;
}

// ─────────────────────────────────────────────────────────────────────────────
// aegis.config.json generator

function generateConfig(
  stack: Awaited<ReturnType<typeof detectStack>>,
): string {
  const config = {
    stack: {
      framework: stack.framework,
      database: stack.database,
      auth: stack.auth,
      ai: stack.ai,
      payment: stack.payment,
      deploy: stack.deploy,
      language: stack.language,
      hasI18n: stack.hasI18n,
      hasTests: stack.hasTests,
    },
    locale: 'en',
    compliance: [],
    ignore: [
      'node_modules/**',
      'dist/**',
      '.next/**',
      'coverage/**',
    ],
    scanners: {},
    rules: {},
  };
  return JSON.stringify(config, null, 2) + '\n';
}
