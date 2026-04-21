/**
 * v0.15 — supplyChainScanner.criticalDeps emit-matrix.
 *
 * Tests the (upcoming) criticalDeps emit-path which fires when a
 * package listed in `scanners.supplyChain.criticalDeps` appears in
 * package.json with a non-exact version. HIGH severity, CWE-494
 * (Download of Code Without Integrity Check).
 *
 * CWE-494 is distinct from the existing wildcard-version check
 * (CWE-829) so the two can coexist on versions like "latest" without
 * colliding in canary-RED-baselines.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

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

function setupPkg(
  deps: Record<string, string>,
  devDeps: Record<string, string> = {},
) {
  mockReadFileSafe.mockImplementation((filePath: string) => {
    if (filePath.endsWith('package.json') && !filePath.includes('node_modules')) {
      return JSON.stringify({
        dependencies: deps,
        ...(Object.keys(devDeps).length > 0 ? { devDependencies: devDeps } : {}),
      });
    }
    return null;
  });
}

function cfg(criticalDeps?: string[] | undefined): AegisConfig {
  if (criticalDeps === undefined) {
    return {} as AegisConfig;
  }
  return {
    scanners: { supplyChain: { criticalDeps } },
  } as unknown as AegisConfig;
}

describe('supplyChainScanner — scanners.supplyChain.criticalDeps (v0.15)', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'aegis-supply-chain-critical-'));
    vi.clearAllMocks();
    mockWalkFiles.mockReturnValue([]);
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('TP emit — non-exact version on critical dep', () => {
    const nonExactVersions: Array<[string, string]> = [
      ['caret', '^16.0.0'],
      ['tilde', '~16.0.0'],
      ['gte', '>=16.0.0'],
      ['lt', '<17'],
      ['hyphen-range', '1.0.0 - 2.0.0'],
      ['x-range', '16.x'],
      ['latest', 'latest'],
      ['star', '*'],
      ['empty', ''],
    ];

    for (const [label, ver] of nonExactVersions) {
      it(`emits HIGH/CWE-494 on ${label} (${ver})`, async () => {
        setupPkg({ next: ver });
        const result = await supplyChainScanner.scan(tempDir, cfg(['next']));
        const crit = result.findings.filter((f) => f.cwe === 494);
        expect(crit.length).toBeGreaterThanOrEqual(1);
        const f = crit[0];
        expect(f.scanner).toBe('supply-chain');
        expect(f.severity).toBe('high');
        expect(f.cwe).toBe(494);
        expect(f.title).toContain('next');
      });
    }
  });

  describe('FP abstain — exact-pinned or no-config', () => {
    it('does NOT emit when critical dep is exact-pinned (16.0.0)', async () => {
      setupPkg({ next: '16.0.0' });
      const result = await supplyChainScanner.scan(tempDir, cfg(['next']));
      const crit = result.findings.filter((f) => f.cwe === 494);
      expect(crit).toHaveLength(0);
    });

    it('does NOT emit when criticalDeps is empty array', async () => {
      setupPkg({ next: '^16.0.0' });
      const result = await supplyChainScanner.scan(tempDir, cfg([]));
      const crit = result.findings.filter((f) => f.cwe === 494);
      expect(crit).toHaveLength(0);
    });

    it('does NOT emit when scanners.supplyChain is undefined (backward-compat)', async () => {
      setupPkg({ next: '^16.0.0' });
      const result = await supplyChainScanner.scan(tempDir, cfg(undefined));
      const crit = result.findings.filter((f) => f.cwe === 494);
      expect(crit).toHaveLength(0);
    });

    it('does NOT emit when configured dep is not in package.json', async () => {
      setupPkg({ react: '18.0.0' });
      const result = await supplyChainScanner.scan(tempDir, cfg(['next']));
      const crit = result.findings.filter((f) => f.cwe === 494);
      expect(crit).toHaveLength(0);
    });
  });

  describe('alias edge — npm:alias@X.Y.Z', () => {
    it('does NOT emit when aliased version is exact (npm:other@16.0.0)', async () => {
      setupPkg({ next: 'npm:something-else@16.0.0' });
      const result = await supplyChainScanner.scan(tempDir, cfg(['next']));
      const crit = result.findings.filter((f) => f.cwe === 494);
      expect(crit).toHaveLength(0);
    });

    it('emits when aliased version is non-exact (npm:other@^16.0.0)', async () => {
      setupPkg({ next: 'npm:something-else@^16.0.0' });
      const result = await supplyChainScanner.scan(tempDir, cfg(['next']));
      const crit = result.findings.filter((f) => f.cwe === 494);
      expect(crit.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('devDependencies coverage', () => {
    it('emits on non-exact critical dev-dep', async () => {
      setupPkg({}, { next: '^16.0.0' });
      const result = await supplyChainScanner.scan(tempDir, cfg(['next']));
      const crit = result.findings.filter((f) => f.cwe === 494);
      expect(crit.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('multi-dep config', () => {
    it('emits only for non-exact entries in a mixed-pin project', async () => {
      setupPkg({
        next: '^16.0.0',
        '@supabase/ssr': '1.0.0',
      });
      const result = await supplyChainScanner.scan(
        tempDir,
        cfg(['next', '@supabase/ssr']),
      );
      const crit = result.findings.filter((f) => f.cwe === 494);
      expect(crit).toHaveLength(1);
      expect(crit[0].title).toContain('next');
    });
  });

  describe('coexistence with existing wildcard-check', () => {
    it('"latest" triggers BOTH existing CWE-829 wildcard AND new CWE-494 critical-deps', async () => {
      setupPkg({ next: 'latest' });
      const result = await supplyChainScanner.scan(tempDir, cfg(['next']));
      const wildcard = result.findings.filter(
        (f) => f.cwe === 829 && f.title.includes('Wildcard'),
      );
      const crit = result.findings.filter((f) => f.cwe === 494);
      expect(wildcard).toHaveLength(1);
      expect(crit).toHaveLength(1);
    });
  });
});
