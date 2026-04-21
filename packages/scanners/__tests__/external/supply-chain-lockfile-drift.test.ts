/**
 * v0.15 — supplyChainScanner lockfile-drift detection.
 *
 * Tests the (upcoming) Check 8 emit-path which compares the current
 * sha256 of each known lockfile (package-lock.json, pnpm-lock.yaml)
 * against the baseline stored at .aegis/lockfile-hash.
 *
 * Severities:
 *  - MEDIUM / CWE-353 on hash-mismatch (drift detected)
 *  - INFO   / CWE-353 on baseline-missing + lockfile-present
 *    (recommend seeding)
 *  - MEDIUM / CWE-353 on malformed baseline-entry
 *
 * No-op when neither a lockfile nor a baseline exist (projects that
 * don't use npm-lockfile workflows).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';

const { mockReadFileSafe, mockWalkFiles, mockClearWalkFilesCache } = vi.hoisted(() => ({
  mockReadFileSafe: vi.fn(),
  mockWalkFiles: vi.fn(),
  mockClearWalkFilesCache: vi.fn(),
}));

vi.mock('@aegis-scan/core', () => ({
  commandExists: vi.fn().mockResolvedValue(true),
  exec: vi.fn(),
  readFileSafe: mockReadFileSafe,
  walkFiles: mockWalkFiles,
  clearWalkFilesCache: mockClearWalkFilesCache,
  isTestFile: (filePath) => /\.(test|spec|e2e)\.(ts|tsx|js|jsx|mjs|cjs)$/.test(filePath) || /[\/\\]__tests__[\/\\]/.test(filePath) || /[\/\\]__mocks__[\/\\]/.test(filePath) || /[\/\\](playwright|cypress|e2e)[\/\\]/.test(filePath),
}));

import { supplyChainScanner } from '../../src/dependencies/supply-chain.js';
import type { AegisConfig } from '@aegis-scan/core';

const MOCK_CONFIG = {} as AegisConfig;

function sha256hex(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

/** Route suffix-matched filePaths to mocked contents. Unmatched → null. */
function mockFiles(files: Record<string, string>) {
  mockReadFileSafe.mockImplementation((filePath: string) => {
    for (const [suffix, content] of Object.entries(files)) {
      if (filePath.endsWith(suffix)) return content;
    }
    return null;
  });
}

describe('supplyChainScanner — lockfile-drift (v0.15)', () => {
  const pkgLockContent = '{"name":"test-a","lockfileVersion":3,"packages":{"":{}}}\n';
  const pnpmLockContent = "lockfileVersion: '9.0'\nsettings:\n  autoInstallPeers: true\n";
  const pkgLockHash = sha256hex(pkgLockContent);
  const pnpmLockHash = sha256hex(pnpmLockContent);

  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'aegis-lockfile-drift-'));
    vi.clearAllMocks();
    mockWalkFiles.mockReturnValue([]);
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('emits MEDIUM/CWE-353 when lockfile hash mismatches baseline', async () => {
    mockFiles({
      'package-lock.json': pkgLockContent,
      '.aegis/lockfile-hash': `sha256:${'0'.repeat(64)}  package-lock.json\n`,
    });
    const result = await supplyChainScanner.scan(tempDir, MOCK_CONFIG);
    const drift = result.findings.filter((f) => f.cwe === 353 && f.severity === 'medium');
    expect(drift).toHaveLength(1);
    expect(drift[0].scanner).toBe('supply-chain');
    expect(drift[0].title).toContain('drift');
    expect(drift[0].title).toContain('package-lock.json');
  });

  it('emits INFO when lockfile present but baseline missing', async () => {
    mockFiles({
      'package-lock.json': pkgLockContent,
      // no .aegis/lockfile-hash
    });
    const result = await supplyChainScanner.scan(tempDir, MOCK_CONFIG);
    const drift = result.findings.filter((f) => f.cwe === 353 && f.severity === 'info');
    expect(drift).toHaveLength(1);
    expect(drift[0].title.toLowerCase()).toContain('not seeded');
  });

  it('does NOT emit when lockfile hash matches baseline', async () => {
    mockFiles({
      'package-lock.json': pkgLockContent,
      '.aegis/lockfile-hash': `sha256:${pkgLockHash}  package-lock.json\n`,
    });
    const result = await supplyChainScanner.scan(tempDir, MOCK_CONFIG);
    const drift = result.findings.filter((f) => f.cwe === 353);
    expect(drift).toHaveLength(0);
  });

  it('does NOT emit when no lockfile and no baseline exist (no-op)', async () => {
    mockFiles({});
    const result = await supplyChainScanner.scan(tempDir, MOCK_CONFIG);
    const drift = result.findings.filter((f) => f.cwe === 353);
    expect(drift).toHaveLength(0);
  });

  it('scans both lockfiles when both present (per-file drift report)', async () => {
    mockFiles({
      'package-lock.json': pkgLockContent,
      'pnpm-lock.yaml': pnpmLockContent,
      '.aegis/lockfile-hash':
        `sha256:${'0'.repeat(64)}  package-lock.json\n` +
        `sha256:${pnpmLockHash}  pnpm-lock.yaml\n`,
    });
    const result = await supplyChainScanner.scan(tempDir, MOCK_CONFIG);
    const drift = result.findings.filter((f) => f.cwe === 353 && f.severity === 'medium');
    expect(drift).toHaveLength(1); // only package-lock drifts; pnpm-lock matches
    expect(drift[0].title).toContain('package-lock.json');
    expect(drift[0].title).not.toContain('pnpm-lock.yaml');
  });

  it('emits MEDIUM when baseline contains malformed entries', async () => {
    mockFiles({
      'package-lock.json': pkgLockContent,
      '.aegis/lockfile-hash': 'this-is-not-a-valid-baseline-line\n',
    });
    const result = await supplyChainScanner.scan(tempDir, MOCK_CONFIG);
    const malformed = result.findings.filter(
      (f) => f.cwe === 353 && f.title.toLowerCase().includes('malformed'),
    );
    expect(malformed.length).toBeGreaterThanOrEqual(1);
    expect(malformed[0].severity).toBe('medium');
  });

  it('skips blank lines and # comments in baseline', async () => {
    mockFiles({
      'package-lock.json': pkgLockContent,
      '.aegis/lockfile-hash':
        `# Baseline seeded by advisor 2026-04-20 — re-seed after every merged dep-update\n` +
        `\n` +
        `sha256:${pkgLockHash}  package-lock.json\n` +
        `\n`,
    });
    const result = await supplyChainScanner.scan(tempDir, MOCK_CONFIG);
    const drift = result.findings.filter((f) => f.cwe === 353);
    expect(drift).toHaveLength(0);
  });
});
