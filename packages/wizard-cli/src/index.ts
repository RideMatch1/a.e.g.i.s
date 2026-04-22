#!/usr/bin/env node
/**
 * `aegis-wizard` CLI entry-point.
 *
 * Separate product from `@aegis-scan/cli` (the SAST scanner). This is the
 * scaffold/wizard/brief-generator tool — it asks the user Tier-1
 * essentials, validates the answers with Zod, and emits both an
 * aegis.config.json and an agent-consumable Markdown brief that an AI
 * coding-agent executes to build an institutional-grade Next.js +
 * Supabase + shadcn SaaS.
 *
 * Commands: `new <project-name>` runs the 21 Tier-1 questions in
 * interactive mode or consumes a pre-filled config file in
 * non-interactive mode, then emits the config plus the brief in either
 * terse (default) or `--verbose-brief` shape and in either `en`
 * (default) or `--lang=de` output.
 */
import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { runNew } from './commands/new.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgVersion = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8')).version as string;

const program = new Command();

program
  .name('aegis-wizard')
  .description('AEGIS Wizard — scaffold + knowledge-base + brief-generator for institutional-grade Next.js + Supabase SaaS')
  .version(pkgVersion, '--version', 'Show version');

program
  .command('new <project-name>')
  .description('Run the Tier-1 wizard, emit aegis.config.json, and render the agent-brief')
  .option('-i, --interactive', 'Run the interactive wizard (default)', true)
  .option('-n, --non-interactive', 'Skip the wizard and read --config instead')
  .option('-c, --config <file>', 'Path to a pre-filled aegis.config.json (for --non-interactive)')
  .option('-o, --output-dir <dir>', 'Where to write emitted files (default: ./<project-name>)')
  .option('-m, --output-mode <mode>', 'brief | scaffold | both (default: both)', 'both')
  .option('-v, --verbose-brief', 'Emit a verbose brief with prose + rationale (default: terse)')
  .option('-l, --lang <lang>', 'Brief language: en (default) | de', 'en')
  .option('-f, --force', 'Overwrite existing output files without prompting')
  .action(
    async (
      name: string,
      options: {
        interactive?: boolean;
        nonInteractive?: boolean;
        config?: string;
        outputDir?: string;
        outputMode?: string;
        verboseBrief?: boolean;
        lang?: string;
        force?: boolean;
      },
    ) => {
      process.exit(await runNew(name, options));
    },
  );

program.parse(process.argv);
