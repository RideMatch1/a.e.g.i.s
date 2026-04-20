/**
 * v0.15 — `aegis diff-deps [--since=<git-ref>]`
 *
 * Compares the current working-tree lockfile (package-lock.json
 * and/or pnpm-lock.yaml) against the version recorded at a git ref
 * (default HEAD~1). Reports added / removed deps and classifies
 * version-bumps as major / minor / patch / other. Major bumps on
 * packages listed in `scanners.supplyChain.criticalDeps`
 * (aegis.config.json) are flagged risky and drive exit code 1.
 *
 * Scope bounds for v0.15 P1 (deferred to v0.15.1 / v0.16):
 *  - No network-calls. No npm-registry crossref, no age-detection,
 *    no GHSA advisory-lookup, no postinstall-script sniffing.
 *  - Lockfile support: package-lock.json (JSON) and pnpm-lock.yaml
 *    (regex-parsed, v6 + v9 formats). bun.lockb (binary) and yarn
 *    v2+ Berry lockfiles out-of-scope — no dogfood signal yet.
 *  - Aliased-deps, git-URL-deps, file-URL-deps fall through as
 *    kind="other" with dim rendering; full classification deferred.
 *
 * Exit codes:
 *   0 — no-risky changes (may still include non-critical bumps)
 *   1 — ≥1 risky change detected (major bump on criticalDep)
 *   2 — user-error (no lockfile, invalid ref, read failure)
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import chalk from 'chalk';
import { exec } from '@aegis-scan/core';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DepChange {
  name: string;
  before: string | null;
  after: string | null;
  kind: 'major' | 'minor' | 'patch' | 'other' | 'added' | 'removed';
}

export interface RiskyFlag {
  dep: string;
  reason: string;
}

export interface LockfileDiff {
  lockfile: string;
  since: string;
  changes: DepChange[];
  risky: RiskyFlag[];
  error?: string;
}

export interface DiffDepsOptions {
  since?: string;
  format?: 'text' | 'json';
  lockfile?: string;
}

const LOCKFILE_NAMES = ['package-lock.json', 'pnpm-lock.yaml'] as const;

// ---------------------------------------------------------------------------
// Parsers
// ---------------------------------------------------------------------------

export function parsePackageLock(content: string): Record<string, string> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return {};
  }
  const out: Record<string, string> = {};
  const root = parsed as { packages?: Record<string, { version?: string }>; dependencies?: Record<string, { version?: string }> };

  // npm v7+ "packages" format — preferred when present.
  if (root.packages && typeof root.packages === 'object') {
    for (const [key, entry] of Object.entries(root.packages)) {
      if (!key.startsWith('node_modules/')) continue;
      const name = key.slice('node_modules/'.length);
      // Skip transitive nesting node_modules/a/node_modules/b — only top-level.
      if (name.includes('/node_modules/')) continue;
      if (entry && typeof entry.version === 'string') {
        out[name] = entry.version;
      }
    }
  }

  // Legacy "dependencies" format (lockfileVersion 1 / 2 fallback).
  if (Object.keys(out).length === 0 && root.dependencies && typeof root.dependencies === 'object') {
    for (const [name, entry] of Object.entries(root.dependencies)) {
      if (entry && typeof entry.version === 'string') {
        out[name] = entry.version;
      }
    }
  }

  return out;
}

export function parsePnpmLock(content: string): Record<string, string> {
  const out: Record<string, string> = {};
  // Match entries like:
  //   v9:   "  next@16.0.0:"           or  "  '@supabase/ssr@0.5.0':"
  //   v6:   "  /next@16.0.0:"          or  "  '/@supabase/ssr@0.5.0':"
  // Capture: (name) (version). Version = semver-like, terminated by
  // a quote, colon, or whitespace.
  const regex = /^\s*'?\/?(@?[a-z0-9][a-z0-9._-]*(?:\/[a-z0-9._-]+)?)@([0-9]+\.[0-9]+\.[0-9]+[^':\s]*)'?:\s*$/gim;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    const name = match[1];
    const version = match[2];
    // pnpm-lock can list multiple resolutions of the same package
    // (peer-dep variants). Keep the first — deterministic for diffing.
    if (!(name in out)) out[name] = version;
  }
  return out;
}

function parseLockfile(content: string, lockfileName: string): Record<string, string> {
  if (lockfileName.endsWith('package-lock.json')) return parsePackageLock(content);
  if (lockfileName.endsWith('pnpm-lock.yaml')) return parsePnpmLock(content);
  return {};
}

// ---------------------------------------------------------------------------
// Diff logic
// ---------------------------------------------------------------------------

export function classifyVersionBump(before: string, after: string): DepChange['kind'] {
  const bm = before.match(/^(\d+)\.(\d+)\.(\d+)/);
  const am = after.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!bm || !am) return 'other';
  if (bm[1] !== am[1]) return 'major';
  if (bm[2] !== am[2]) return 'minor';
  if (bm[3] !== am[3]) return 'patch';
  return 'other';
}

export function computeDiff(
  before: Record<string, string>,
  after: Record<string, string>,
): DepChange[] {
  const names = Array.from(new Set([...Object.keys(before), ...Object.keys(after)])).sort();
  const out: DepChange[] = [];
  for (const name of names) {
    const b = before[name];
    const a = after[name];
    if (b === a) continue;
    if (!b && a) out.push({ name, before: null, after: a, kind: 'added' });
    else if (b && !a) out.push({ name, before: b, after: null, kind: 'removed' });
    else out.push({ name, before: b, after: a, kind: classifyVersionBump(b, a) });
  }
  return out;
}

export function classifyRiskyChanges(
  changes: DepChange[],
  criticalDeps: string[],
): RiskyFlag[] {
  const set = new Set(criticalDeps);
  const risky: RiskyFlag[] = [];
  for (const c of changes) {
    if (c.kind === 'major' && set.has(c.name)) {
      risky.push({
        dep: c.name,
        reason: `major-bump on criticalDep: ${c.name} ${c.before} → ${c.after}`,
      });
    }
  }
  return risky;
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

export function formatText(diff: LockfileDiff): string {
  const lines: string[] = [];
  lines.push(chalk.bold(`AEGIS diff-deps — ${diff.lockfile} (${diff.since} → current)`));
  lines.push('');
  if (diff.error) {
    lines.push(chalk.yellow(`⚠ ${diff.error}`));
    return lines.join('\n');
  }
  if (diff.changes.length === 0) {
    lines.push(chalk.dim('No changes detected.'));
    return lines.join('\n');
  }
  const riskySet = new Set(diff.risky.map((r) => r.dep));
  lines.push('Changes:');
  for (const change of diff.changes) {
    const isRisky = riskySet.has(change.name);
    const mark = isRisky ? chalk.red('(!)') : '   ';
    lines.push(formatChangeLine(change, mark, isRisky));
  }
  if (diff.risky.length > 0) {
    lines.push('');
    lines.push(chalk.bold.red(`Risky (${diff.risky.length}):`));
    for (const r of diff.risky) lines.push(`  ${r.reason}`);
  }
  return lines.join('\n');
}

function formatChangeLine(change: DepChange, mark: string, isRisky: boolean): string {
  const name = change.name.padEnd(24);
  switch (change.kind) {
    case 'added':
      return `  ${mark}  ${chalk.green('+')}  ${name} ${chalk.green(change.after ?? '')} ${chalk.dim('NEW')}`;
    case 'removed':
      return `  ${mark}  ${chalk.red('-')}  ${name} ${chalk.red('removed')}`;
    case 'major':
      return `  ${mark}  ${chalk.red('↑')}  ${name} ${chalk.dim(change.before ?? '')} → ${change.after}   ${chalk.red.bold('MAJOR')}${isRisky ? chalk.red(' critical') : ''}`;
    case 'minor':
      return `  ${mark}  ${chalk.yellow('→')}  ${name} ${chalk.dim(change.before ?? '')} → ${change.after}   ${chalk.yellow('minor')}`;
    case 'patch':
      return `  ${mark}  ${chalk.cyan('→')}  ${name} ${chalk.dim(change.before ?? '')} → ${change.after}   ${chalk.dim('patch')}`;
    default:
      return `  ${mark}  ·  ${name} ${chalk.dim(change.before ?? '')} → ${chalk.dim(change.after ?? '')}   ${chalk.dim('other')}`;
  }
}

export function formatJson(diffs: LockfileDiff[], exitCode: number): string {
  return JSON.stringify({ exitCode, diffs }, null, 2);
}

// ---------------------------------------------------------------------------
// Git helpers
// ---------------------------------------------------------------------------

async function validateGitRef(projectPath: string, ref: string): Promise<boolean> {
  try {
    const result = await exec('git', ['rev-parse', '--verify', '--quiet', ref], {
      cwd: projectPath,
    });
    return result.exitCode === 0;
  } catch {
    return false;
  }
}

async function loadLockfileAtRef(
  projectPath: string,
  lockfileName: string,
  ref: string,
): Promise<string | null> {
  try {
    const result = await exec('git', ['show', `${ref}:${lockfileName}`], {
      cwd: projectPath,
    });
    if (result.exitCode !== 0) return null;
    return result.stdout;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Config + detection
// ---------------------------------------------------------------------------

function detectLockfiles(projectPath: string): string[] {
  return LOCKFILE_NAMES.filter((n) => existsSync(join(projectPath, n)));
}

function readCriticalDeps(projectPath: string): string[] {
  const p = join(projectPath, 'aegis.config.json');
  if (!existsSync(p)) return [];
  try {
    const config = JSON.parse(readFileSync(p, 'utf-8')) as {
      scanners?: { supplyChain?: { criticalDeps?: unknown } };
    };
    const raw = config.scanners?.supplyChain?.criticalDeps;
    if (!Array.isArray(raw)) return [];
    return raw.filter((d: unknown): d is string => typeof d === 'string' && d.length > 0);
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export async function runDiffDeps(
  projectPath: string,
  options: DiffDepsOptions,
): Promise<number> {
  const since = options.since ?? 'HEAD~1';
  const format = options.format ?? 'text';

  const refOk = await validateGitRef(projectPath, since);
  if (!refOk) {
    const msg = `Invalid git-ref: "${since}" does not exist in this repository. Run "git fetch --all" or verify the ref name.`;
    if (format === 'json') {
      console.log(JSON.stringify({ exitCode: 2, error: msg, diffs: [] }, null, 2));
    } else {
      console.error(chalk.red(`Error: ${msg}`));
    }
    return 2;
  }

  const lockfiles = options.lockfile
    ? [options.lockfile]
    : detectLockfiles(projectPath);

  if (lockfiles.length === 0) {
    const msg = `No lockfile found. Expected package-lock.json or pnpm-lock.yaml in ${projectPath}. Run "npm install" or "pnpm install" first, or specify --lockfile=<path>.`;
    if (format === 'json') {
      console.log(JSON.stringify({ exitCode: 2, error: msg, diffs: [] }, null, 2));
    } else {
      console.error(chalk.red(`Error: ${msg}`));
    }
    return 2;
  }

  const criticalDeps = readCriticalDeps(projectPath);

  const diffs: LockfileDiff[] = [];
  for (const lockfile of lockfiles) {
    const currentPath = join(projectPath, lockfile);
    if (!existsSync(currentPath)) {
      diffs.push({
        lockfile,
        since,
        changes: [],
        risky: [],
        error: `Lockfile ${lockfile} not found in working tree.`,
      });
      continue;
    }
    const currentContent = readFileSync(currentPath, 'utf-8');
    const beforeContent = await loadLockfileAtRef(projectPath, lockfile, since);
    const afterMap = parseLockfile(currentContent, lockfile);
    const beforeMap = beforeContent !== null ? parseLockfile(beforeContent, lockfile) : {};
    const changes = computeDiff(beforeMap, afterMap);
    const risky = classifyRiskyChanges(changes, criticalDeps);
    diffs.push({ lockfile, since, changes, risky });
  }

  const anyError = diffs.some((d) => d.error);
  const anyRisky = diffs.some((d) => d.risky.length > 0);
  const exitCode: 0 | 1 | 2 = anyError ? 2 : anyRisky ? 1 : 0;

  if (format === 'json') {
    console.log(formatJson(diffs, exitCode));
  } else {
    for (const diff of diffs) {
      console.log(formatText(diff));
    }
    if (exitCode === 1) {
      const total = diffs.reduce((n, d) => n + d.risky.length, 0);
      console.log(chalk.red(`\nExit 1 (${total} risky)`));
    } else if (exitCode === 2) {
      console.log(chalk.red('\nExit 2 (user-error)'));
    } else {
      console.log(chalk.green('\nExit 0 (no risky changes)'));
    }
  }

  return exitCode;
}
