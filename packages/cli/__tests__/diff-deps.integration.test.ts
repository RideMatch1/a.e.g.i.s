/**
 * v0.15 — `aegis diff-deps` integration tests.
 *
 * Each test initialises a throw-away git repo in a temp directory,
 * commits a before-state lockfile, modifies the working-tree to the
 * after-state, and invokes `runDiffDeps` against `--since=HEAD`
 * (which compares current working-tree to the HEAD commit).
 *
 * Covers the 10 fixture-matrix scenarios from the v0.15 Item-#3
 * brief: major-bump-critical / non-critical, minor, patch, add,
 * remove, no-change, no-lockfile, invalid-ref, pnpm-lockfile.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { exec } from '@aegis-scan/core';
import { runDiffDeps } from '../src/commands/diff-deps.js';

// Capture stdout during runDiffDeps invocations so assertions can
// inspect formatted output. Chalk-escape codes stay in the string
// (tests match on substrings, not exact bytes).
function capture(): { logs: string[]; errors: string[]; restore: () => void } {
  const logs: string[] = [];
  const errors: string[] = [];
  const logSpy = vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
    logs.push(args.map(String).join(' '));
  });
  const errSpy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    errors.push(args.map(String).join(' '));
  });
  return {
    logs,
    errors,
    restore: () => {
      logSpy.mockRestore();
      errSpy.mockRestore();
    },
  };
}

async function git(cwd: string, ...args: string[]): Promise<void> {
  await exec('git', args, { cwd });
}

async function initRepo(cwd: string): Promise<void> {
  await git(cwd, 'init', '--quiet', '-b', 'main');
  await git(cwd, 'config', 'user.email', 'test@example.com');
  await git(cwd, 'config', 'user.name', 'Test');
  await git(cwd, 'config', 'commit.gpgsign', 'false');
}

async function commitAll(cwd: string, message: string): Promise<void> {
  await git(cwd, 'add', '.');
  await git(cwd, 'commit', '-m', message, '--quiet', '--no-gpg-sign');
}

function writeLockfile(cwd: string, deps: Record<string, string>): void {
  const packages: Record<string, { version: string }> = { '': { version: '0.0.1' } };
  for (const [name, version] of Object.entries(deps)) {
    packages[`node_modules/${name}`] = { version };
  }
  writeFileSync(
    join(cwd, 'package-lock.json'),
    JSON.stringify({ name: 'test', version: '0.0.1', lockfileVersion: 3, packages }, null, 2),
  );
}

function writeConfig(cwd: string, criticalDeps: string[]): void {
  writeFileSync(
    join(cwd, 'aegis.config.json'),
    JSON.stringify({ scanners: { supplyChain: { criticalDeps } } }, null, 2),
  );
}

describe('runDiffDeps — integration (real git-sandbox)', () => {
  let tempDir: string;
  let cap: ReturnType<typeof capture>;

  beforeEach(async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'aegis-diff-deps-int-'));
    await initRepo(tempDir);
    cap = capture();
  });

  afterEach(() => {
    cap.restore();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('major-bump-critical: exit 1, risky MAJOR on critical dep', async () => {
    writeLockfile(tempDir, { next: '15.2.1' });
    writeConfig(tempDir, ['next']);
    await commitAll(tempDir, 'v1');

    writeLockfile(tempDir, { next: '16.0.0' });

    const exitCode = await runDiffDeps(tempDir, { since: 'HEAD', format: 'json' });
    expect(exitCode).toBe(1);

    const parsed = JSON.parse(cap.logs.join('\n'));
    expect(parsed.exitCode).toBe(1);
    expect(parsed.diffs[0].risky).toHaveLength(1);
    expect(parsed.diffs[0].risky[0].dep).toBe('next');
    expect(parsed.diffs[0].risky[0].reason).toContain('major-bump');
  });

  it('major-bump-non-critical: exit 0, change reported but not risky', async () => {
    writeLockfile(tempDir, { lodash: '4.17.21' });
    writeConfig(tempDir, ['next']); // next critical, lodash not
    await commitAll(tempDir, 'v1');

    writeLockfile(tempDir, { lodash: '5.0.0' });

    const exitCode = await runDiffDeps(tempDir, { since: 'HEAD', format: 'json' });
    expect(exitCode).toBe(0);

    const parsed = JSON.parse(cap.logs.join('\n'));
    expect(parsed.exitCode).toBe(0);
    expect(parsed.diffs[0].risky).toHaveLength(0);
    const change = parsed.diffs[0].changes.find((c: { name: string }) => c.name === 'lodash');
    expect(change.kind).toBe('major');
  });

  it('minor-bump-only: exit 0, change reported as minor', async () => {
    writeLockfile(tempDir, { next: '16.0.0' });
    writeConfig(tempDir, ['next']);
    await commitAll(tempDir, 'v1');

    writeLockfile(tempDir, { next: '16.1.0' });

    const exitCode = await runDiffDeps(tempDir, { since: 'HEAD', format: 'json' });
    expect(exitCode).toBe(0);

    const parsed = JSON.parse(cap.logs.join('\n'));
    expect(parsed.diffs[0].risky).toHaveLength(0);
    expect(parsed.diffs[0].changes[0].kind).toBe('minor');
  });

  it('patch-bump-only: exit 0, change reported as patch', async () => {
    writeLockfile(tempDir, { next: '16.0.0' });
    await commitAll(tempDir, 'v1');

    writeLockfile(tempDir, { next: '16.0.1' });

    const exitCode = await runDiffDeps(tempDir, { since: 'HEAD', format: 'json' });
    expect(exitCode).toBe(0);

    const parsed = JSON.parse(cap.logs.join('\n'));
    expect(parsed.diffs[0].changes[0].kind).toBe('patch');
  });

  it('new-dep-added: exit 0, change reported as added', async () => {
    writeLockfile(tempDir, { next: '16.0.0' });
    await commitAll(tempDir, 'v1');

    writeLockfile(tempDir, { next: '16.0.0', chalk: '5.4.0' });

    const exitCode = await runDiffDeps(tempDir, { since: 'HEAD', format: 'json' });
    expect(exitCode).toBe(0);

    const parsed = JSON.parse(cap.logs.join('\n'));
    const added = parsed.diffs[0].changes.find((c: { name: string }) => c.name === 'chalk');
    expect(added.kind).toBe('added');
  });

  it('dep-removed: exit 0, change reported as removed', async () => {
    writeLockfile(tempDir, { next: '16.0.0', 'ansi-colors': '4.1.3' });
    await commitAll(tempDir, 'v1');

    writeLockfile(tempDir, { next: '16.0.0' });

    const exitCode = await runDiffDeps(tempDir, { since: 'HEAD', format: 'json' });
    expect(exitCode).toBe(0);

    const parsed = JSON.parse(cap.logs.join('\n'));
    const removed = parsed.diffs[0].changes.find((c: { name: string }) => c.name === 'ansi-colors');
    expect(removed.kind).toBe('removed');
  });

  it('no-change: exit 0, changes array empty', async () => {
    writeLockfile(tempDir, { next: '16.0.0' });
    await commitAll(tempDir, 'v1');
    // No working-tree modification

    const exitCode = await runDiffDeps(tempDir, { since: 'HEAD', format: 'json' });
    expect(exitCode).toBe(0);

    const parsed = JSON.parse(cap.logs.join('\n'));
    expect(parsed.diffs[0].changes).toEqual([]);
  });

  it('no-lockfile: exit 2, user-error message', async () => {
    // Commit only aegis.config.json, no lockfile
    writeConfig(tempDir, ['next']);
    await commitAll(tempDir, 'v1');

    const exitCode = await runDiffDeps(tempDir, { since: 'HEAD', format: 'text' });
    expect(exitCode).toBe(2);

    const combined = [...cap.logs, ...cap.errors].join('\n');
    expect(combined.toLowerCase()).toContain('no lockfile');
  });

  it('invalid-ref: exit 2, user-error message', async () => {
    writeLockfile(tempDir, { next: '16.0.0' });
    await commitAll(tempDir, 'v1');

    const exitCode = await runDiffDeps(tempDir, {
      since: 'nonexistent-ref-xxx',
      format: 'text',
    });
    expect(exitCode).toBe(2);

    const combined = [...cap.logs, ...cap.errors].join('\n');
    expect(combined.toLowerCase()).toMatch(/ref|reference|invalid|nonexistent/);
  });

  it('pnpm-lockfile: parses pnpm-lock.yaml and reports diff', async () => {
    const pnpmV1 = `lockfileVersion: '9.0'\n\npackages:\n\n  next@15.2.1:\n    resolution: {integrity: sha512-x}\n`;
    const pnpmV2 = `lockfileVersion: '9.0'\n\npackages:\n\n  next@16.0.0:\n    resolution: {integrity: sha512-y}\n`;

    writeFileSync(join(tempDir, 'pnpm-lock.yaml'), pnpmV1);
    writeConfig(tempDir, ['next']);
    await commitAll(tempDir, 'v1');

    writeFileSync(join(tempDir, 'pnpm-lock.yaml'), pnpmV2);

    const exitCode = await runDiffDeps(tempDir, { since: 'HEAD', format: 'json' });
    expect(exitCode).toBe(1); // major-bump on critical

    const parsed = JSON.parse(cap.logs.join('\n'));
    expect(parsed.diffs[0].lockfile).toBe('pnpm-lock.yaml');
    expect(parsed.diffs[0].risky).toHaveLength(1);
    expect(parsed.diffs[0].risky[0].dep).toBe('next');
  });

  it('defaults: --since=HEAD~1, --format=text when no options given', async () => {
    writeLockfile(tempDir, { next: '15.2.1' });
    writeConfig(tempDir, ['next']);
    await commitAll(tempDir, 'v1');

    writeLockfile(tempDir, { next: '16.0.0' });
    await commitAll(tempDir, 'v2');

    // No since (defaults to HEAD~1 = v1), no format (defaults to text)
    const exitCode = await runDiffDeps(tempDir, {});
    expect(exitCode).toBe(1);

    const combined = cap.logs.join('\n');
    expect(combined).toContain('next');
    expect(combined).toContain('MAJOR');
  });
});
