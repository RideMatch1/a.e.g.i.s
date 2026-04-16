import chalk from 'chalk';
import ora from 'ora';
import { loadConfig, Orchestrator, exec } from '@aegis-scan/core';
import { getAllScanners } from '@aegis-scan/scanners';
import { selectReporter, writeStdout } from '../utils.js';
import type { Finding, ScanCategory, AuditResult } from '@aegis-scan/core';

const FAST_CATEGORIES: ScanCategory[] = [
  'security',
  'dependencies',
  'quality',
  'compliance',
  'i18n',
];

export interface HistoryOptions {
  commit?: string;
  range?: string;
  blame?: boolean;
  format?: string;
}

/** A Finding enriched with git-blame metadata. */
export interface BlameFinding extends Finding {
  introduced_by?: string;   // commit hash
  introduced_date?: string; // ISO date string
  author?: string;          // author name
}

/** A score snapshot for a specific commit. */
interface CommitScore {
  commit: string;
  message: string;
  score: number;
  grade: string;
  findingCount: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function runScanAtCwd(projectPath: string): Promise<AuditResult> {
  const config = await loadConfig(projectPath, 'scan');
  const orchestrator = new Orchestrator();
  const allScanners = getAllScanners();
  const fastScanners = allScanners.filter((s) => FAST_CATEGORIES.includes(s.category));
  for (const scanner of fastScanners) {
    orchestrator.register(scanner);
  }
  return orchestrator.run(config);
}

/**
 * Returns current git HEAD ref (branch or commit hash) so we can restore later.
 */
async function getCurrentRef(cwd: string): Promise<string> {
  // Try branch name first
  const branchResult = await exec('git', ['symbolic-ref', '--short', 'HEAD'], { cwd });
  if (branchResult.exitCode === 0) {
    return branchResult.stdout.trim();
  }
  // Detached HEAD — use commit hash
  const hashResult = await exec('git', ['rev-parse', 'HEAD'], { cwd });
  return hashResult.stdout.trim();
}

/**
 * Stashes any uncommitted changes. Returns true if a stash was actually created.
 */
async function stashChanges(cwd: string): Promise<boolean> {
  const result = await exec('git', ['stash', '--include-untracked'], { cwd });
  // "No local changes to save" means nothing was stashed
  return result.exitCode === 0 && !result.stdout.includes('No local changes to save');
}

/**
 * Checks out a commit or ref.
 */
async function gitCheckout(ref: string, cwd: string): Promise<void> {
  const result = await exec('git', ['checkout', ref], { cwd });
  if (result.exitCode !== 0) {
    throw new Error(`git checkout ${ref} failed: ${result.stderr}`);
  }
}

/**
 * Pops the top stash entry.
 */
async function stashPop(cwd: string): Promise<void> {
  await exec('git', ['stash', 'pop'], { cwd });
}

// ---------------------------------------------------------------------------
// Mode 1: scan a specific commit
// ---------------------------------------------------------------------------

async function runCommitScan(
  resolvedPath: string,
  commitRef: string,
  options: HistoryOptions,
): Promise<number> {
  const spinner = ora(`Preparing to scan commit ${commitRef}...`).start();

  let originalRef: string | null = null;
  let stashed = false;

  try {
    originalRef = await getCurrentRef(resolvedPath);
    stashed = await stashChanges(resolvedPath);

    spinner.text = `Checking out ${commitRef}...`;
    await gitCheckout(commitRef, resolvedPath);

    spinner.text = `Scanning commit ${commitRef}...`;
    const result = await runScanAtCwd(resolvedPath);

    spinner.stop();

    const reporter = selectReporter(options.format);
    const output = reporter.format(result);
    await writeStdout(output + '\n');

    return result.blocked ? 1 : 0;
  } catch (err) {
    spinner.fail(`Failed to scan commit ${commitRef}`);
    console.error(err instanceof Error ? err.message : String(err));
    return 1;
  } finally {
    // Always restore original state (only if we successfully got the ref)
    if (originalRef) {
      try {
        await gitCheckout(originalRef, resolvedPath);
        if (stashed) {
          await stashPop(resolvedPath);
        }
      } catch (restoreErr) {
        console.error(
          chalk.red(
            `Warning: could not restore original state. Run 'git checkout ${originalRef}' and 'git stash pop' manually.`,
          ),
        );
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Mode 2: blame — enrich findings with git blame
// ---------------------------------------------------------------------------

/**
 * Parses a single git blame --porcelain line group and extracts relevant fields.
 * Returns { commitHash, author, date } or null if the line doesn't look right.
 */
function parseBlameBlock(block: string): { commitHash: string; author: string; date: string } | null {
  const lines = block.split('\n');
  if (!lines[0]) return null;

  const commitHash = lines[0].split(' ')[0] ?? '';
  if (!/^[0-9a-f]{40}/.test(commitHash)) return null;

  let author = '';
  let timestamp = '';

  for (const line of lines) {
    if (line.startsWith('author ')) {
      author = line.slice('author '.length).trim();
    } else if (line.startsWith('author-time ')) {
      timestamp = line.slice('author-time '.length).trim();
    }
  }

  const date = timestamp
    ? new Date(parseInt(timestamp, 10) * 1000).toISOString().slice(0, 10)
    : '';

  return { commitHash: commitHash.slice(0, 8), author, date };
}

async function runBlameScan(
  resolvedPath: string,
  options: HistoryOptions,
): Promise<number> {
  const spinner = ora('Scanning for findings...').start();

  let result: AuditResult;
  try {
    result = await runScanAtCwd(resolvedPath);
  } catch (err) {
    spinner.fail('Scan failed');
    console.error(err instanceof Error ? err.message : String(err));
    return 1;
  }

  spinner.stop();

  const fileLineFindings = result.findings.filter((f) => f.file && f.line);

  if (fileLineFindings.length === 0) {
    console.log(chalk.yellow('No findings with file+line information available for blame.'));
    return 0;
  }

  const spinner2 = ora(`Enriching ${fileLineFindings.length} finding(s) with git blame...`).start();

  const enriched: BlameFinding[] = [];

  for (const finding of fileLineFindings) {
    const filePath = finding.file!;
    const lineNum = finding.line!;

    const blameResult = await exec(
      'git',
      ['blame', '--porcelain', `-L${lineNum},${lineNum}`, filePath],
      { cwd: resolvedPath },
    );

    const blameFinding: BlameFinding = { ...finding };

    if (blameResult.exitCode === 0 && blameResult.stdout) {
      const parsed = parseBlameBlock(blameResult.stdout);
      if (parsed) {
        blameFinding.introduced_by = parsed.commitHash;
        blameFinding.author = parsed.author;
        blameFinding.introduced_date = parsed.date;
      }
    }

    enriched.push(blameFinding);
  }

  spinner2.stop();

  // Sort: oldest unfixed first (those without a date go to the end)
  enriched.sort((a, b) => {
    if (!a.introduced_date && !b.introduced_date) return 0;
    if (!a.introduced_date) return 1;
    if (!b.introduced_date) return -1;
    return a.introduced_date.localeCompare(b.introduced_date);
  });

  if (options.format === 'json') {
    await writeStdout(JSON.stringify(enriched, null, 2) + '\n');
    return 0;
  }

  // Terminal output
  console.log(chalk.bold(`\nBlame report — ${enriched.length} finding(s) with location\n`));

  for (const f of enriched) {
    const loc = `${f.file}:${f.line}`;
    const blame = f.introduced_by
      ? `${f.introduced_by} by ${f.author ?? 'unknown'} on ${f.introduced_date ?? '?'}`
      : chalk.dim('blame unavailable');

    const severityColor =
      f.severity === 'blocker' || f.severity === 'critical'
        ? chalk.red
        : f.severity === 'high'
          ? chalk.yellow
          : chalk.white;

    console.log(
      `${severityColor(`[${f.severity.toUpperCase()}]`)} ${chalk.bold(f.title)}`,
    );
    console.log(`  File:      ${chalk.dim(loc)}`);
    console.log(`  Introduced: ${blame}`);
    console.log(`  Scanner:   ${chalk.cyan(f.scanner)}`);
    if (f.fix) {
      console.log(`  Fix hint:  ${chalk.green(f.fix)}`);
    }
    console.log('');
  }

  return 0;
}

// ---------------------------------------------------------------------------
// Mode 3: score trend across a range of commits
// ---------------------------------------------------------------------------

async function runRangeScan(
  resolvedPath: string,
  range: string,
  options: HistoryOptions,
): Promise<number> {
  const spinner = ora(`Getting commit list for range ${range}...`).start();

  // Get list of commits in the range
  const logResult = await exec(
    'git',
    ['log', '--oneline', '--no-merges', range],
    { cwd: resolvedPath },
  );

  if (logResult.exitCode !== 0) {
    spinner.fail(`git log failed for range '${range}'`);
    console.error(logResult.stderr);
    return 1;
  }

  const commits = logResult.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const spaceIdx = line.indexOf(' ');
      return {
        hash: line.slice(0, spaceIdx).trim(),
        message: line.slice(spaceIdx + 1).trim(),
      };
    });

  if (commits.length === 0) {
    spinner.fail('No commits found in range');
    return 1;
  }

  spinner.text = `Found ${commits.length} commits. Scanning each...`;

  let originalRef: string | null = null;
  let stashed = false;

  const scores: CommitScore[] = [];

  try {
    originalRef = await getCurrentRef(resolvedPath);
    stashed = await stashChanges(resolvedPath);

    const orderedCommits = [...commits].reverse();

    for (let i = 0; i < orderedCommits.length; i++) {
      const { hash, message } = orderedCommits[i];
      spinner.text = `[${i + 1}/${orderedCommits.length}] Scanning ${hash}...`;

      try {
        await gitCheckout(hash, resolvedPath);
        const result = await runScanAtCwd(resolvedPath);
        scores.push({
          commit: hash,
          message,
          score: result.score,
          grade: result.grade,
          findingCount: result.findings.length,
        });
      } catch {
        scores.push({
          commit: hash,
          message,
          score: -1,
          grade: '?',
          findingCount: -1,
        });
      }
    }
  } finally {
    if (originalRef) {
      try {
        await gitCheckout(originalRef, resolvedPath);
        if (stashed) {
          await stashPop(resolvedPath);
        }
      } catch {
        console.error(
          chalk.red(
            `Warning: could not restore original state. Run 'git checkout ${originalRef}' and 'git stash pop' manually.`,
          ),
        );
      }
    }
  }

  spinner.stop();

  if (options.format === 'json') {
    await writeStdout(JSON.stringify(scores, null, 2) + '\n');
    return 0;
  }

  // Terminal output — score trend table
  console.log(chalk.bold(`\nScore trend for range: ${range}\n`));

  const maxBarWidth = 40;
  const maxScore = 1000;

  for (const entry of scores) {
    if (entry.score === -1) {
      console.log(`${chalk.dim(entry.commit)} ${chalk.red('SCAN FAILED')} ${chalk.dim(entry.message.slice(0, 50))}`);
      continue;
    }

    const barLen = Math.round((entry.score / maxScore) * maxBarWidth);
    const bar = '█'.repeat(barLen) + '░'.repeat(maxBarWidth - barLen);
    const scoreColor = entry.score >= 850 ? chalk.green : entry.score >= 700 ? chalk.yellow : chalk.red;

    console.log(
      `${chalk.dim(entry.commit)} ${scoreColor(bar)} ${scoreColor(String(entry.score).padStart(4))} [${entry.grade}] ${chalk.dim(entry.message.slice(0, 40))}`,
    );
  }

  console.log('');

  // Summary
  const validScores = scores.filter((s) => s.score !== -1);
  if (validScores.length >= 2) {
    const first = validScores[0];
    const last = validScores[validScores.length - 1];
    const delta = last.score - first.score;
    const commitWord = commits.length === 1 ? 'commit' : 'commits';

    if (delta > 0) {
      console.log(
        chalk.green(
          `Score improved from ${first.score} to ${last.score} (+${delta}) over ${commits.length} ${commitWord}`,
        ),
      );
    } else if (delta < 0) {
      console.log(
        chalk.red(
          `Score declined from ${first.score} to ${last.score} (${delta}) over ${commits.length} ${commitWord}`,
        ),
      );
    } else {
      console.log(chalk.dim(`Score unchanged at ${first.score} over ${commits.length} ${commitWord}`));
    }
  }

  return 0;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export async function runHistory(
  projectPath: string,
  options: HistoryOptions,
): Promise<number> {
  const resolvedPath = projectPath || process.cwd();

  // Validate options
  const modeCount = [options.commit, options.range, options.blame].filter(Boolean).length;
  if (modeCount === 0) {
    console.error(chalk.red('Error: specify one of --commit <hash>, --range <range>, or --blame'));
    console.error(chalk.dim('Examples:'));
    console.error(chalk.dim('  aegis history --commit abc123'));
    console.error(chalk.dim('  aegis history --blame'));
    console.error(chalk.dim('  aegis history --range main~10..HEAD'));
    return 1;
  }
  if (modeCount > 1) {
    console.error(chalk.red('Error: --commit, --range, and --blame are mutually exclusive'));
    return 1;
  }

  if (options.commit) {
    return runCommitScan(resolvedPath, options.commit, options);
  }

  if (options.blame) {
    return runBlameScan(resolvedPath, options);
  }

  // range
  return runRangeScan(resolvedPath, options.range!, options);
}
