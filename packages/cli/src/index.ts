#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import { runScan } from './commands/scan.js';
import { runAudit } from './commands/audit.js';
import { runPentest } from './commands/pentest.js';
import { runSiege } from './commands/siege.js';
import { runAuditVerify } from './commands/audit-verify.js';
import { runFix } from './commands/fix.js';
import { runHistory } from './commands/history.js';
import { runInit } from './commands/init.js';
import { runNew } from './commands/new.js';
import { runPrecisionAnnotate, runPrecisionReport } from './commands/precision.js';
import { runDiffDeps } from './commands/diff-deps.js';
import { showVersion } from './commands/version.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgVersion = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8')).version as string;

/**
 * Commander accumulator for repeatable string options.
 * Usage: .option('--foo <val>', 'desc', collectMulti, [])
 * Each occurrence of the flag pushes its value onto the previous array.
 */
const collectMulti = (value: string, previous: string[]): string[] => [...previous, value];

const program = new Command();

program
  .name('aegis')
  .description('AEGIS — Automated Enterprise-Grade Inspection Suite')
  .version(pkgVersion, '--version', 'Show version')
  .action(async () => {
    // Default: delegate to scan on current directory
    process.exit(await runScan('.', { format: 'terminal' }));
  });

program
  .command('scan [path]')
  .description('Quick scan — security, dependencies, quality, compliance, i18n')
  .option('-f, --format <format>', 'Output format: terminal (default), json, sarif, markdown', 'terminal')
  .option('-d, --diff <base>', 'Only report findings for files changed vs a git ref (e.g. main, HEAD~5)')
  .option('-v, --verbose', 'Include info-severity findings in output (hidden by default in terminal/markdown/html)')
  .option('--no-color', 'Disable colored output')
  .action(async (path: string | undefined, options: { format: string; diff?: string; color: boolean; verbose?: boolean }) => {
    if (!options.color) {
      chalk.level = 0;
    }
    process.exit(await runScan(path ?? '.', options));
  });

program
  .command('audit [path]')
  .description('Full audit — all scanners including DAST, accessibility, performance')
  .option('-f, --format <format>', 'Output format: terminal (default), json, sarif, markdown', 'terminal')
  .option('-t, --target <url>', 'Target URL for DAST scanners')
  .option('-d, --diff <base>', 'Only report findings for files changed vs a git ref (e.g. main, HEAD~5)')
  .option('-v, --verbose', 'Include info-severity findings in output (hidden by default in terminal/markdown/html)')
  .option('--no-color', 'Disable colored output')
  .action(
    async (
      path: string | undefined,
      options: { format: string; target?: string; diff?: string; color: boolean; verbose?: boolean },
    ) => {
      if (!options.color) {
        chalk.level = 0;
      }
      process.exit(await runAudit(path ?? '.', options));
    },
  );

program
  .command('pentest [path]')
  .description(
    'ACTIVE MODE — full pentest including DAST scanners (ZAP, Nuclei, Strix, ' +
      'PTAI, Pentest-Swarm) against a live target. Sends LIVE HTTP traffic. ' +
      'Requires --target and --confirm. Only run against systems you are ' +
      'authorized to test (CFAA / §202a-c StGB / Computer Misuse Act).',
  )
  .requiredOption('-t, --target <url>', 'Target URL to pentest (required)')
  .option('--confirm', 'Acknowledge authorization to send live DAST/probe traffic to the target')
  .option('-f, --format <format>', 'Output format: terminal (default), json, sarif, html, markdown', 'terminal')
  .option('--no-color', 'Disable colored output')
  .action(
    async (
      path: string | undefined,
      options: { target: string; format: string; color: boolean; confirm: boolean },
    ) => {
      if (!options.color) {
        chalk.level = 0;
      }
      process.exit(await runPentest(path ?? '.', options));
    },
  );

program
  .command('siege [path]')
  .description(
    'ACTIVE MODE — multi-phase adversary simulation against a live target. ' +
      'Sends LIVE HTTP traffic including fake-JWT auth probes, concurrent ' +
      'POST race probes, header-tampering probes, and external LLM-pentest ' +
      'frameworks. Requires --target (or --roe with target in scope) and ' +
      '--confirm. Only run against systems you are authorized to test (CFAA / ' +
      '§202a-c StGB / Computer Misuse Act).',
  )
  .requiredOption('-t, --target <url>', 'Target URL for siege (required)')
  .option('--roe <path>', 'Rules of Engagement JSON file (APTS-SE-001 conformant). Validates target scope + temporal envelope before engagement start.')
  .option('--state-file <path>', 'JSONL event-stream + state snapshot file (APTS-HO-002/006/008 — enables resume + signal-based pause/kill).')
  .option('--resume <path>', 'Resume from a prior --state-file. Skips already-completed phases and continues from the next.')
  .option('--notify-webhook <url>', 'Webhook URL to POST high-signal events (engagement-start, critical-finding, halt, kill, completion). Repeatable.', collectMulti, [])
  .option('--sandbox-mode <mode>', 'Wrap LLM-pentest invocations through a sandboxer (APTS-MR-018). Values: docker | firejail | none (default).', 'none')
  .option('--heartbeat-url <url>', 'Operator dead-man-switch heartbeat endpoint (APTS-SC-009). HTTPS URL POSTed at the configured interval; consecutive missed responses halt the engagement.')
  .option('--phase-timeout-minutes <n>', 'Per-phase decision timeout (APTS-HO-003). Falls back to RoE.stop_conditions.phase_timeout_minutes or max_duration_minutes/4.', (v: string) => Number.parseInt(v, 10))
  .option('--allow-loopback', 'Operator opt-in to allow safeFetch against loopback IPs (127.x.x.x, ::1) for legitimate local-pentest workflows. Emits a prominent warning and a "operator-acknowledged-loopback" audit event. NEVER enable in production engagements.')
  .option('-f, --format <format>', 'Output format: terminal (default), json, sarif, html, markdown', 'terminal')
  .option('--confirm', 'Acknowledge authorization to send live attack traffic')
  .option('--no-color', 'Disable colored output')
  .action(
    async (
      path: string | undefined,
      options: { target: string; roe?: string; stateFile?: string; resume?: string; notifyWebhook: string[]; sandboxMode?: string; heartbeatUrl?: string; phaseTimeoutMinutes?: number; allowLoopback?: boolean; format: string; confirm: boolean; color: boolean },
    ) => {
      if (!options.color) {
        chalk.level = 0;
      }
      process.exit(await runSiege(path ?? '.', options));
    },
  );

program
  .command('audit-verify <state-file>')
  .description('Verify the SHA-256 hash-chain on a siege --state-file JSONL audit log (APTS-AR-012). Detects post-hoc tampering at the line where the chain breaks.')
  .option('-f, --format <format>', 'Output format: terminal (default), json', 'terminal')
  .option('--no-color', 'Disable colored output')
  .action(
    async (
      stateFile: string,
      options: { format: 'terminal' | 'json'; color: boolean },
    ) => {
      if (!options.color) {
        chalk.level = 0;
      }
      process.exit(await runAuditVerify(stateFile, options));
    },
  );

program
  .command('siege-kill <state-file>')
  .description('Request a halt on a running siege engagement (APTS-SC-009). Writes a kill-request marker the running process detects on its next poll tick.')
  .option('--reason <text>', 'Reason recorded in the kill-request marker for audit', 'operator-requested')
  .action(async (stateFile: string, options: { reason: string }) => {
    const { requestKill } = await import('@aegis-scan/core');
    const markerPath = requestKill(stateFile, options.reason);
    console.log(chalk.green(`Kill request written: ${markerPath}`));
    console.log(chalk.dim('The running siege process will halt on its next poll tick (default 2 s).'));
    process.exit(0);
  });

program
  .command('fix [path]')
  .description('AI-powered auto-fix for findings — template (default) or LLM-assisted (claude, openai, ollama)')
  .option('--finding <id>', 'Fix a specific finding by ID')
  .option('--severity <level>', 'Fix all findings of a given severity (e.g. high)')
  .option('--dry-run', 'Show what would be changed without writing files')
  .option('--provider <name>', 'Fix provider: template (default), claude, openai, ollama', 'template')
  .option('--model <model>', 'Model name for LLM provider (default depends on provider)')
  .option('-f, --format <format>', 'Output format: terminal (default), json, sarif, markdown', 'terminal')
  .action(
    async (
      path: string | undefined,
      options: { finding?: string; severity?: string; dryRun?: boolean; provider?: string; model?: string; format: string },
    ) => {
      process.exit(await runFix(path ?? '.', options));
    },
  );

program
  .command('history [path]')
  .description('Time-travel auditing — scan any Git commit or show blame for findings')
  .option('--commit <hash>', 'Scan a specific commit hash or ref')
  .option('--range <range>', 'Scan all commits in a git range (e.g. main~10..HEAD)')
  .option('--blame', 'Enrich current findings with git blame metadata')
  .option('-f, --format <format>', 'Output format: terminal (default), json, markdown', 'terminal')
  .action(
    async (
      path: string | undefined,
      options: { commit?: string; range?: string; blame?: boolean; format: string },
    ) => {
      process.exit(await runHistory(path ?? '.', options));
    },
  );

program
  .command('init [path]')
  .description('Create aegis.config.json + CI workflow + CLAUDE.md + husky pre-push hook')
  .option('--force', 'Destructive — overwrite existing workflow + CLAUDE.md + husky hook (replaces user content)')
  .option('--skip-ci', 'Do not write .github/workflows/aegis.yml')
  .option('--skip-claude', 'Do not write CLAUDE.md')
  .option('--skip-husky', 'Do not write .husky/pre-push')
  .action(
    async (
      path: string | undefined,
      options: { force?: boolean; skipCi?: boolean; skipClaude?: boolean; skipHusky?: boolean },
    ) => {
      process.exit(await runInit(path ?? '.', options));
    },
  );

program
  .command('new <name>')
  .description('Scaffold a new project from a template (default: nextjs-supabase)')
  .option('-t, --template <name>', 'Template to use', 'nextjs-supabase')
  .option('--target <dir>', 'Target directory (default: ./<name>)')
  .option('--skip-install', 'Skip npm install after scaffold')
  .option('--skip-scan', 'Skip aegis scan after npm install')
  .action(
    async (
      name: string,
      options: { template: string; target?: string; skipInstall?: boolean; skipScan?: boolean },
    ) => {
      process.exit(await runNew(name, options));
    },
  );

program
  .command('version')
  .description('Show AEGIS version')
  .action(() => {
    showVersion();
  });

// `aegis precision` — measure scanner precision against an annotated corpus
const precision = program
  .command('precision')
  .description('Measure scanner precision against annotated findings (corpus-based)');

precision
  .command('annotate [path]')
  .description('Generate or refresh an annotation template for measuring precision')
  .requiredOption('--init', 'Generate template (only mode supported in v0.6)')
  .option('--from <file>', 'Use existing scan JSON instead of running a fresh scan')
  .option('--corpus <name>', 'Corpus identifier (defaults to project basename)')
  .action(
    async (
      path: string | undefined,
      options: { init?: boolean; from?: string; corpus?: string },
    ) => {
      process.exit(await runPrecisionAnnotate(path ?? '.', options));
    },
  );

precision
  .command('report [path]')
  .description('Compute precision per scanner against tier-gates from annotated corpus')
  .option('--corpus <name...>', 'Corpus name(s) — repeatable; default: all in aegis-precision/')
  .action(
    async (
      path: string | undefined,
      options: { corpus?: string[] },
    ) => {
      process.exit(await runPrecisionReport(path ?? '.', options));
    },
  );

program
  .command('diff-deps')
  .description('Diff lockfile deps against a git ref; flag risky changes on criticalDeps')
  .option('-s, --since <ref>', 'Git ref to diff against', 'HEAD~1')
  .option('-f, --format <format>', 'Output format: text (default) or json', 'text')
  .option('-l, --lockfile <path>', 'Explicit lockfile path (auto-detect if omitted)')
  .option('--no-color', 'Disable colored output')
  .action(
    async (options: { since: string; format: string; lockfile?: string; color: boolean }) => {
      if (!options.color) {
        chalk.level = 0;
      }
      const format = options.format === 'json' ? 'json' : 'text';
      process.exit(
        await runDiffDeps('.', {
          since: options.since,
          format,
          lockfile: options.lockfile,
        }),
      );
    },
  );

program.parse(process.argv);
