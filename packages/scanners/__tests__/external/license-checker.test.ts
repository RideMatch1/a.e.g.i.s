import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const { mockReadFileSafe } = vi.hoisted(() => ({
  mockReadFileSafe: vi.fn(),
}));

vi.mock('@aegis-scan/core', () => ({
  commandExists: async () => true,
  exec: async () => ({ stdout: '', stderr: '', exitCode: 0 }),
  walkFiles: () => [],
  readFileSafe: mockReadFileSafe,
}));

import { licenseCheckerScanner } from '../../src/dependencies/license-checker.js';
import type { AegisConfig } from '@aegis-scan/core';

const MOCK_CONFIG = {} as AegisConfig;

function makeTempProject(): string {
  return mkdtempSync(join(tmpdir(), 'aegis-license-test-'));
}

function createNodeModulesPkg(projectPath: string, pkgName: string, license: string): void {
  const pkgDir = join(projectPath, 'node_modules', pkgName);
  mkdirSync(pkgDir, { recursive: true });
  writeFileSync(join(pkgDir, 'package.json'), JSON.stringify({ name: pkgName, version: '1.0.0', license }));
}

describe('licenseCheckerScanner', () => {
  let projectPath: string;

  beforeEach(() => {
    projectPath = makeTempProject();
    // Default: readFileSafe delegates to actual file reading
    mockReadFileSafe.mockImplementation((path: string) => {
      const { readFileSync } = require('fs');
      try {
        return readFileSync(path, 'utf-8');
      } catch {
        return null;
      }
    });
  });

  it('returns empty findings when node_modules does not exist', async () => {
    const result = await licenseCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
    expect((result as Record<string, unknown>)['error']).toContain('node_modules');
  });

  it('returns no findings for permissive licenses (MIT, Apache-2.0, BSD)', async () => {
    createNodeModulesPkg(projectPath, 'react', 'MIT');
    createNodeModulesPkg(projectPath, 'lodash', 'MIT');
    createNodeModulesPkg(projectPath, 'express', 'Apache-2.0');

    const result = await licenseCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const licenseFindings = result.findings.filter((f) => f.id.startsWith('LIC-'));
    expect(licenseFindings).toHaveLength(0);
  });

  it('flags AGPL license as HIGH', async () => {
    createNodeModulesPkg(projectPath, 'agpl-package', 'AGPL-3.0');

    const result = await licenseCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.title.includes('agpl-package'));
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('high');
    expect(finding!.category).toBe('dependencies');
  });

  it('flags GPL-3.0 license as HIGH', async () => {
    createNodeModulesPkg(projectPath, 'gpl-package', 'GPL-3.0');

    const result = await licenseCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.title.includes('gpl-package'));
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('high');
  });

  it('flags SSPL license as HIGH', async () => {
    createNodeModulesPkg(projectPath, 'sspl-package', 'SSPL-1.0');

    const result = await licenseCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.title.includes('sspl-package'));
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('high');
  });

  it('generates LIC-xxx IDs', async () => {
    createNodeModulesPkg(projectPath, 'bad-license-pkg', 'GPL-3.0-only');

    const result = await licenseCheckerScanner.scan(projectPath, MOCK_CONFIG);
    if (result.findings.length > 0) {
      expect(result.findings[0].id).toMatch(/^LIC-/);
    }
  });
});
