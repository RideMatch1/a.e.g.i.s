#!/usr/bin/env node
/**
 * `aegis-skills` CLI entry point.
 *
 * Three subcommands: `list` (browse the catalog), `info <name>`
 * (inspect a single skill), `install [--to <dir>] [--force]` (copy
 * the catalog into a Claude-Code-compatible skill directory).
 *
 * No third-party CLI parser — the surface is small enough that a
 * hand-rolled argv walk keeps the runtime dependency footprint at
 * zero, which matches the markdown-only structural invariant of the
 * whole package: consumers installing `@aegis-scan/skills` pull in
 * zero runtime code that executes on their machine beyond this bin.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runList, type ListOptions } from './commands/list.js';
import { runInfo, type InfoOptions } from './commands/info.js';
import { runInstall, type InstallOptions } from './commands/install.js';

const HELP_TEXT = `aegis-skills — opt-in skill library for Claude Code and compatible AI agents

Usage:
  aegis-skills list [--category <cat>] [--source <src>] [--json]
  aegis-skills info <skill-name> [--json]
  aegis-skills install [--to <dir>] [--force] [--dry-run]
  aegis-skills --version
  aegis-skills --help

Commands:
  list      Print the skill catalog grouped by category and source.
  info      Render one skill's metadata and upstream source URL.
  install   Copy every SKILL.md into a Claude-compatible skill directory.
            Default target: ~/.claude/skills/user/aegis-skills/

List options:
  --category <cat>   Filter to offensive / defensive / mitre-mapped / ops / all
  --source <src>     Filter to one source-namespace (e.g. snailsploit-fork)
  --json             Machine-readable output

Info options:
  --json             Machine-readable output

Install options:
  --to <dir>         Target directory (overrides default)
  --force            Overwrite existing files at the target
  --dry-run          Print what would be copied without writing
`;

function readVersion(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const pkgPath = join(here, '..', 'package.json');
  const parsed = JSON.parse(readFileSync(pkgPath, 'utf-8')) as { version: string };
  return parsed.version;
}

function main(argv: readonly string[]): number {
  if (argv.length === 0 || argv[0] === '--help' || argv[0] === '-h') {
    console.log(HELP_TEXT);
    return 0;
  }
  if (argv[0] === '--version' || argv[0] === '-v') {
    console.log(readVersion());
    return 0;
  }

  const [command, ...rest] = argv;
  switch (command) {
    case 'list':
      return runList(parseListOptions(rest));
    case 'info':
      return runInfo(rest[0] ?? '', parseInfoOptions(rest.slice(1)));
    case 'install':
      return runInstall(parseInstallOptions(rest));
    default:
      console.error(`Error: unknown command "${command}"`);
      console.error('Run `aegis-skills --help` for usage.');
      return 1;
  }
}

function parseListOptions(argv: readonly string[]): ListOptions {
  const out: ListOptions = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--category' && i + 1 < argv.length) {
      out.category = argv[i + 1];
      i += 1;
    } else if (arg === '--source' && i + 1 < argv.length) {
      out.source = argv[i + 1];
      i += 1;
    } else if (arg === '--json') {
      out.json = true;
    }
  }
  return out;
}

function parseInfoOptions(argv: readonly string[]): InfoOptions {
  const out: InfoOptions = {};
  for (const arg of argv) {
    if (arg === '--json') out.json = true;
  }
  return out;
}

function parseInstallOptions(argv: readonly string[]): InstallOptions {
  const out: InstallOptions = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--to' && i + 1 < argv.length) {
      out.to = argv[i + 1];
      i += 1;
    } else if (arg === '--force' || arg === '-f') {
      out.force = true;
    } else if (arg === '--dry-run') {
      out.dryRun = true;
    }
  }
  return out;
}

process.exit(main(process.argv.slice(2)));
