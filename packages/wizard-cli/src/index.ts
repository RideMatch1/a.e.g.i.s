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

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgVersion = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8')).version as string;

const program = new Command();

program
  .name('aegis-wizard')
  .description('AEGIS Wizard — scaffold + knowledge-base + brief-generator for institutional-grade Next.js + Supabase SaaS')
  .version(pkgVersion, '--version', 'Show version');

program.parse(process.argv);
