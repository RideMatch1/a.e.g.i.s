import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const { mockReadFileSafe, mockWalkFiles } = vi.hoisted(() => ({
  mockReadFileSafe: vi.fn(),
  mockWalkFiles: vi.fn(),
}));

vi.mock('@aegis-scan/core', () => ({
  commandExists: vi.fn().mockResolvedValue(true),
  exec: vi.fn(),
  readFileSafe: mockReadFileSafe,
  walkFiles: mockWalkFiles,
  isTestFile: (filePath) => /\.(test|spec|e2e)\.(ts|tsx|js|jsx|mjs|cjs)$/.test(filePath) || /[\/\\]__tests__[\/\\]/.test(filePath) || /[\/\\]__mocks__[\/\\]/.test(filePath) || /[\/\\](playwright|cypress|e2e)[\/\\]/.test(filePath),
}));

import { depConfusionCheckerScanner } from '../../src/dependencies/dep-confusion.js';
import type { AegisConfig } from '@aegis-scan/core';

const MOCK_CONFIG = {} as AegisConfig;

describe('depConfusionCheckerScanner', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'aegis-dep-confusion-'));
    vi.clearAllMocks();
    mockWalkFiles.mockReturnValue([]);
    // Default: no files exist (no private registry files)
    mockReadFileSafe.mockReturnValue(null);
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('is always available (pure file scanner)', async () => {
    expect(await depConfusionCheckerScanner.isAvailable(tempDir)).toBe(true);
  });

  it('returns no findings when package.json does not exist', async () => {
    // mockReadFileSafe returns null by default — package.json doesn't exist
    const result = await depConfusionCheckerScanner.scan(tempDir, MOCK_CONFIG);
    expect(result.scanner).toBe('dep-confusion-checker');
    expect(result.findings).toHaveLength(0);
    expect(result.available).toBe(true);
  });

  it('returns no findings when package.json has no scoped packages', async () => {
    mockReadFileSafe.mockImplementation((filePath: string) => {
      if (filePath.endsWith('package.json')) {
        return JSON.stringify({
          dependencies: { 'react': '^18.0.0', 'express': '^4.0.0' },
        });
      }
      return null;
    });

    // Create actual package.json file so existsSync passes
    writeFileSync(join(tempDir, 'package.json'), JSON.stringify({
      dependencies: { 'react': '^18.0.0', 'express': '^4.0.0' },
    }));

    const result = await depConfusionCheckerScanner.scan(tempDir, MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
  });

  it('flags HIGH when scoped packages exist but no private registry is configured', async () => {
    writeFileSync(join(tempDir, 'package.json'), JSON.stringify({
      dependencies: {
        'react': '^18.0.0',
        '@mycompany/ui-kit': '^1.0.0',
        '@mycompany/auth': '^2.0.0',
      },
    }));

    mockReadFileSafe.mockImplementation((filePath: string) => {
      if (filePath.endsWith('package.json') && !filePath.includes('node_modules')) {
        return JSON.stringify({
          dependencies: {
            'react': '^18.0.0',
            '@mycompany/ui-kit': '^1.0.0',
            '@mycompany/auth': '^2.0.0',
          },
        });
      }
      return null; // No .npmrc, .yarnrc, etc.
    });

    const result = await depConfusionCheckerScanner.scan(tempDir, MOCK_CONFIG);
    expect(result.findings.length).toBeGreaterThan(0);

    const finding = result.findings[0];
    expect(finding.severity).toBe('high');
    expect(finding.id).toMatch(/^DEPCONF-/);
    expect(finding.category).toBe('dependencies');
    expect(finding.owasp).toBe('A06:2021');
    expect(finding.cwe).toBe(427);
    expect(finding.title).toContain('scoped package');
  });

  it('does NOT flag when private registry is configured via .npmrc', async () => {
    writeFileSync(join(tempDir, 'package.json'), JSON.stringify({
      dependencies: {
        '@mycompany/ui-kit': '^1.0.0',
      },
    }));
    writeFileSync(join(tempDir, '.npmrc'), '@mycompany:registry=https://npm.mycompany.com\n');

    mockReadFileSafe.mockImplementation((filePath: string) => {
      if (filePath.includes('package.json') && !filePath.includes('node_modules')) {
        return JSON.stringify({ dependencies: { '@mycompany/ui-kit': '^1.0.0' } });
      }
      if (filePath.endsWith('.npmrc')) {
        return '@mycompany:registry=https://npm.mycompany.com\n';
      }
      return null;
    });

    const result = await depConfusionCheckerScanner.scan(tempDir, MOCK_CONFIG);
    const highFindings = result.findings.filter((f) => f.severity === 'high' && f.title.includes('Dependency confusion'));
    expect(highFindings).toHaveLength(0);
  });

  it('flags MEDIUM when private registry uses HTTP (not HTTPS)', async () => {
    writeFileSync(join(tempDir, 'package.json'), JSON.stringify({
      dependencies: { '@mycompany/ui-kit': '^1.0.0' },
    }));
    writeFileSync(join(tempDir, '.npmrc'), '@mycompany:registry=http://npm.mycompany.com\n');

    mockReadFileSafe.mockImplementation((filePath: string) => {
      if (filePath.includes('package.json') && !filePath.includes('node_modules')) {
        return JSON.stringify({ dependencies: { '@mycompany/ui-kit': '^1.0.0' } });
      }
      if (filePath.endsWith('.npmrc')) {
        return '@mycompany:registry=http://npm.mycompany.com\n';
      }
      return null;
    });

    const result = await depConfusionCheckerScanner.scan(tempDir, MOCK_CONFIG);
    const httpFindings = result.findings.filter(
      (f) => f.severity === 'medium' && f.title.includes('HTTP'),
    );
    expect(httpFindings.length).toBeGreaterThan(0);
    expect(httpFindings[0].cwe).toBe(427);
  });

  it('includes duration and available fields in result', async () => {
    mockReadFileSafe.mockReturnValue(null);
    const result = await depConfusionCheckerScanner.scan(tempDir, MOCK_CONFIG);
    expect(typeof result.duration).toBe('number');
    expect(result.available).toBe(true);
  });

  it('uses DEPCONF- prefix for finding IDs', async () => {
    writeFileSync(join(tempDir, 'package.json'), JSON.stringify({
      dependencies: { '@acme/private-lib': '^1.0.0' },
    }));

    mockReadFileSafe.mockImplementation((filePath: string) => {
      if (filePath.includes('package.json') && !filePath.includes('node_modules')) {
        return JSON.stringify({ dependencies: { '@acme/private-lib': '^1.0.0' } });
      }
      return null;
    });

    const result = await depConfusionCheckerScanner.scan(tempDir, MOCK_CONFIG);
    for (const finding of result.findings) {
      expect(finding.id).toMatch(/^DEPCONF-\d{3}$/);
    }
  });
});
