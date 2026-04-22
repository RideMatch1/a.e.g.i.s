/**
 * Direct unit-tests for the patterns-directory resolver.
 *
 * Uses fixture-dirs to exercise both layouts the published binary can
 * encounter: installed-from-tarball (dist/docs/patterns adjacent to
 * dist/commands) and monorepo-dev (packages/wizard-cli/dist/commands
 * with docs/patterns four `..` steps up at the repo root). The third
 * case — neither layout present — must throw with both searched paths
 * surfaced in the message so a packaging regression is diagnosable.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolvePatternsDir, resolvePatternsDirFrom } from '../src/commands/new.js';

describe('resolvePatternsDirFrom — installed-package layout', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'aegis-resolver-installed-'));
    mkdirSync(join(root, 'dist', 'commands'), { recursive: true });
    mkdirSync(join(root, 'dist', 'docs', 'patterns', 'foundation'), {
      recursive: true,
    });
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('resolves to <pkg>/dist/docs/patterns when anchored at dist/commands', () => {
    const anchor = join(root, 'dist', 'commands');
    const resolved = resolvePatternsDirFrom(anchor);
    expect(resolved).toBe(join(root, 'dist', 'docs', 'patterns'));
    expect(existsSync(resolved)).toBe(true);
  });
});

describe('resolvePatternsDirFrom — monorepo-dev layout', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'aegis-resolver-monorepo-'));
    mkdirSync(
      join(root, 'packages', 'wizard-cli', 'dist', 'commands'),
      { recursive: true },
    );
    mkdirSync(join(root, 'docs', 'patterns', 'foundation'), { recursive: true });
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('falls back to repo-root docs/patterns when installed-layout is absent', () => {
    const anchor = join(root, 'packages', 'wizard-cli', 'dist', 'commands');
    const resolved = resolvePatternsDirFrom(anchor);
    expect(resolved).toBe(join(root, 'docs', 'patterns'));
    expect(existsSync(resolved)).toBe(true);
  });
});

describe('resolvePatternsDirFrom — neither layout present', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'aegis-resolver-none-'));
    mkdirSync(join(root, 'isolated'), { recursive: true });
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('throws an error that surfaces both searched paths', () => {
    const anchor = join(root, 'isolated');
    let thrown: Error | null = null;
    try {
      resolvePatternsDirFrom(anchor);
    } catch (err) {
      thrown = err as Error;
    }
    expect(thrown).not.toBeNull();
    expect(thrown?.message).toMatch(/Pattern directory not found/);
    expect(thrown?.message).toContain('docs/patterns');
    expect(thrown?.message.split('\n').length).toBeGreaterThanOrEqual(3);
  });
});

describe('resolvePatternsDir — live current layout', () => {
  it('returns an existing docs/patterns directory for the running process', () => {
    const resolved = resolvePatternsDir();
    expect(existsSync(resolved)).toBe(true);
    expect(resolved).toMatch(/docs[\\/]patterns$/);
  });
});
