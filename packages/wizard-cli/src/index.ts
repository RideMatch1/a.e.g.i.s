#!/usr/bin/env node
/**
 * `aegis-wizard` CLI entry-point.
 *
 * Separate product from `@aegis-scan/cli` (the SAST scanner). This is the
 * scaffold/wizard/brief-generator tool — asks the user ~15-80 thorough
 * questions, then emits an agent-consumable Markdown brief that an AI
 * coding-agent executes to build an institutional-grade Next.js + Supabase +
 * shadcn SaaS in one day.
 *
 * Day-1 surface: `new <project-name> --interactive` runs Tier-1 15 questions,
 * validates via Zod, and writes `aegis.config.json`. Brief-generation lands
 * Day-2; `--verbose-brief` + `--lang=de` land Day-3.
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
  .description('Run the Tier-1 wizard and emit aegis.config.json for a new SaaS project')
  .option('-i, --interactive', 'Run the interactive wizard (default)', true)
  .option('-n, --non-interactive', 'Skip the wizard and read --config instead')
  .option('-c, --config <file>', 'Path to a pre-filled aegis.config.json (for --non-interactive)')
  .option('-o, --output-dir <dir>', 'Where to write aegis.config.json (default: ./<project-name>)')
  .action(
    async (
      name: string,
      options: {
        interactive?: boolean;
        nonInteractive?: boolean;
        config?: string;
        outputDir?: string;
      },
    ) => {
      process.exit(await runNew(name, options));
    },
  );

program.parse(process.argv);
