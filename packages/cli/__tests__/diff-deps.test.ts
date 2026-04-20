/**
 * v0.15 — `aegis diff-deps` unit tests.
 *
 * Covers: parsePackageLock, parsePnpmLock, computeDiff,
 * classifyVersionBump, classifyRiskyChanges, formatText, formatJson.
 * Integration (real git-sandbox) lives in
 * `diff-deps.integration.test.ts`.
 */
import { describe, it, expect } from 'vitest';
import {
  parsePackageLock,
  parsePnpmLock,
  computeDiff,
  classifyVersionBump,
  classifyRiskyChanges,
  formatText,
  formatJson,
  type DepChange,
  type LockfileDiff,
} from '../src/commands/diff-deps.js';

// ---------------------------------------------------------------------------
// parsePackageLock
// ---------------------------------------------------------------------------

describe('parsePackageLock', () => {
  it('extracts top-level deps from npm v7+ "packages" format', () => {
    const content = JSON.stringify({
      name: 'test',
      lockfileVersion: 3,
      packages: {
        '': { name: 'test', version: '0.0.1' },
        'node_modules/next': { version: '16.0.0' },
        'node_modules/@supabase/ssr': { version: '0.5.0' },
        'node_modules/react': { version: '18.3.1' },
      },
    });
    const out = parsePackageLock(content);
    expect(out).toEqual({
      next: '16.0.0',
      '@supabase/ssr': '0.5.0',
      react: '18.3.1',
    });
  });

  it('skips nested node_modules (transitive depth > 1)', () => {
    const content = JSON.stringify({
      packages: {
        'node_modules/next': { version: '16.0.0' },
        'node_modules/next/node_modules/shared-lib': { version: '1.0.0' },
      },
    });
    const out = parsePackageLock(content);
    expect(out).toEqual({ next: '16.0.0' });
    expect(out['shared-lib']).toBeUndefined();
  });

  it('falls back to legacy "dependencies" format when "packages" absent', () => {
    const content = JSON.stringify({
      name: 'test',
      lockfileVersion: 1,
      dependencies: {
        next: { version: '16.0.0' },
        react: { version: '18.3.1' },
      },
    });
    const out = parsePackageLock(content);
    expect(out).toEqual({ next: '16.0.0', react: '18.3.1' });
  });

  it('returns empty object on malformed JSON', () => {
    expect(parsePackageLock('not json {')).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// parsePnpmLock
// ---------------------------------------------------------------------------

describe('parsePnpmLock', () => {
  it('extracts <name>@<version> entries from pnpm v9 format', () => {
    const content = `lockfileVersion: '9.0'

settings:
  autoInstallPeers: true

packages:

  next@16.0.0:
    resolution: {integrity: sha512-...}
  '@supabase/ssr@0.5.0':
    resolution: {integrity: sha512-...}
  react@18.3.1:
    resolution: {integrity: sha512-...}
`;
    const out = parsePnpmLock(content);
    expect(out.next).toBe('16.0.0');
    expect(out['@supabase/ssr']).toBe('0.5.0');
    expect(out.react).toBe('18.3.1');
  });

  it('extracts /name@version entries from pnpm v6 format', () => {
    const content = `lockfileVersion: '6.0'

packages:

  /next@16.0.0:
    resolution: {integrity: sha512-...}
  /react@18.3.1:
    resolution: {integrity: sha512-...}
`;
    const out = parsePnpmLock(content);
    expect(out.next).toBe('16.0.0');
    expect(out.react).toBe('18.3.1');
  });

  it('returns empty object on malformed content', () => {
    expect(parsePnpmLock('random: garbage')).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// computeDiff
// ---------------------------------------------------------------------------

describe('computeDiff', () => {
  it('returns empty array when maps are identical', () => {
    const before = { next: '16.0.0', react: '18.3.1' };
    const after = { next: '16.0.0', react: '18.3.1' };
    expect(computeDiff(before, after)).toEqual([]);
  });

  it('reports added deps', () => {
    const before = { next: '16.0.0' };
    const after = { next: '16.0.0', chalk: '5.4.0' };
    const diff = computeDiff(before, after);
    expect(diff).toHaveLength(1);
    expect(diff[0]).toMatchObject({ name: 'chalk', before: null, after: '5.4.0', kind: 'added' });
  });

  it('reports removed deps', () => {
    const before = { next: '16.0.0', 'ansi-colors': '4.1.3' };
    const after = { next: '16.0.0' };
    const diff = computeDiff(before, after);
    expect(diff).toHaveLength(1);
    expect(diff[0]).toMatchObject({ name: 'ansi-colors', before: '4.1.3', after: null, kind: 'removed' });
  });

  it('classifies major / minor / patch bumps', () => {
    const before = { a: '15.2.1', b: '16.0.0', c: '16.0.0' };
    const after = { a: '16.0.0', b: '16.1.0', c: '16.0.1' };
    const diff = computeDiff(before, after);
    expect(diff.find((d) => d.name === 'a')?.kind).toBe('major');
    expect(diff.find((d) => d.name === 'b')?.kind).toBe('minor');
    expect(diff.find((d) => d.name === 'c')?.kind).toBe('patch');
  });

  it('sorts by name ascending', () => {
    const before = {};
    const after = { zebra: '1.0.0', apple: '1.0.0', mango: '1.0.0' };
    const diff = computeDiff(before, after);
    expect(diff.map((d) => d.name)).toEqual(['apple', 'mango', 'zebra']);
  });
});

// ---------------------------------------------------------------------------
// classifyVersionBump
// ---------------------------------------------------------------------------

describe('classifyVersionBump', () => {
  it('detects major when first segment changes', () => {
    expect(classifyVersionBump('15.2.1', '16.0.0')).toBe('major');
  });
  it('detects minor when second segment changes', () => {
    expect(classifyVersionBump('16.0.0', '16.1.0')).toBe('minor');
  });
  it('detects patch when only third segment changes', () => {
    expect(classifyVersionBump('16.0.0', '16.0.1')).toBe('patch');
  });
  it('returns "other" for non-semver strings', () => {
    expect(classifyVersionBump('latest', '1.0.0')).toBe('other');
    expect(classifyVersionBump('1.0.0', 'git+ssh://...')).toBe('other');
  });
});

// ---------------------------------------------------------------------------
// classifyRiskyChanges
// ---------------------------------------------------------------------------

describe('classifyRiskyChanges', () => {
  it('flags major-bump on criticalDep', () => {
    const changes: DepChange[] = [
      { name: 'next', before: '15.2.1', after: '16.0.0', kind: 'major' },
    ];
    const risky = classifyRiskyChanges(changes, ['next']);
    expect(risky).toHaveLength(1);
    expect(risky[0].dep).toBe('next');
    expect(risky[0].reason).toContain('major-bump');
    expect(risky[0].reason).toContain('next');
  });

  it('does NOT flag major-bump on non-critical dep', () => {
    const changes: DepChange[] = [
      { name: 'lodash', before: '4.17.21', after: '5.0.0', kind: 'major' },
    ];
    const risky = classifyRiskyChanges(changes, ['next']);
    expect(risky).toHaveLength(0);
  });

  it('does NOT flag minor/patch bump even on criticalDep', () => {
    const changes: DepChange[] = [
      { name: 'next', before: '16.0.0', after: '16.1.0', kind: 'minor' },
      { name: 'next', before: '16.0.0', after: '16.0.1', kind: 'patch' },
    ];
    const risky = classifyRiskyChanges(changes, ['next']);
    expect(risky).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// formatText / formatJson
// ---------------------------------------------------------------------------

describe('formatText', () => {
  it('renders no-change summary when changes=[]', () => {
    const diff: LockfileDiff = {
      lockfile: 'package-lock.json',
      since: 'HEAD~1',
      changes: [],
      risky: [],
    };
    const out = formatText(diff);
    expect(out).toContain('package-lock.json');
    expect(out).toContain('No changes');
  });

  it('renders risky-section when risky items present', () => {
    const diff: LockfileDiff = {
      lockfile: 'package-lock.json',
      since: 'HEAD~1',
      changes: [{ name: 'next', before: '15.2.1', after: '16.0.0', kind: 'major' }],
      risky: [{ dep: 'next', reason: 'major-bump on criticalDep: next 15.2.1 → 16.0.0' }],
    };
    const out = formatText(diff);
    expect(out).toContain('next');
    expect(out).toContain('MAJOR');
    expect(out).toContain('critical');
    expect(out).toContain('Risky (1)');
  });
});

describe('formatJson', () => {
  it('emits valid JSON with diffs + exitCode shape', () => {
    const diff: LockfileDiff = {
      lockfile: 'package-lock.json',
      since: 'HEAD~1',
      changes: [{ name: 'next', before: '15.2.1', after: '16.0.0', kind: 'major' }],
      risky: [{ dep: 'next', reason: 'major-bump on criticalDep: next 15.2.1 → 16.0.0' }],
    };
    const out = formatJson([diff], 1);
    const parsed = JSON.parse(out);
    expect(parsed.exitCode).toBe(1);
    expect(parsed.diffs).toHaveLength(1);
    expect(parsed.diffs[0].lockfile).toBe('package-lock.json');
    expect(parsed.diffs[0].risky).toHaveLength(1);
  });
});
