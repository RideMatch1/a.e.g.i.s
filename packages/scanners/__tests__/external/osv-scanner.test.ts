import { describe, it, expect, vi } from 'vitest';

const { mockCommandExists, mockExec } = vi.hoisted(() => ({
  mockCommandExists: vi.fn(),
  mockExec: vi.fn(),
}));

vi.mock('@aegis-scan/core', () => ({
  commandExists: mockCommandExists,
  exec: mockExec,
  walkFiles: () => [],
  readFileSafe: () => null,
  isTestFile: (filePath) => /\.(test|spec|e2e)\.(ts|tsx|js|jsx|mjs|cjs)$/.test(filePath) || /[\/\\]__tests__[\/\\]/.test(filePath) || /[\/\\]__mocks__[\/\\]/.test(filePath) || /[\/\\](playwright|cypress|e2e)[\/\\]/.test(filePath),
}));

import { osvScannerScanner } from '../../src/dependencies/osv-scanner.js';
import type { AegisConfig } from '@aegis-scan/core';

const MOCK_CONFIG = {} as AegisConfig;

describe('osvScannerScanner', () => {
  it('is available when osv-scanner command exists', async () => {
    mockCommandExists.mockResolvedValue(true);
    expect(await osvScannerScanner.isAvailable()).toBe(true);
  });

  it('is unavailable when osv-scanner command does not exist', async () => {
    mockCommandExists.mockResolvedValue(false);
    expect(await osvScannerScanner.isAvailable()).toBe(false);
  });

  it('returns empty findings when no vulnerabilities', async () => {
    mockExec.mockResolvedValue({
      stdout: JSON.stringify({ results: [] }),
      stderr: '',
      exitCode: 0,
    });

    const result = await osvScannerScanner.scan('/tmp/project', MOCK_CONFIG);
    expect(result.scanner).toBe('osv-scanner');
    expect(result.findings).toHaveLength(0);
  });

  it('maps osv-scanner results to findings', async () => {
    mockExec.mockResolvedValue({
      stdout: JSON.stringify({
        results: [{
          packages: [{
            package: { name: 'lodash', version: '4.17.20', ecosystem: 'npm' },
            vulnerabilities: [
              {
                id: 'GHSA-jf85-cpcp-j695',
                summary: 'Prototype Pollution in lodash',
                severity: [{ type: 'CVSS_V3', score: '7.4' }],
              },
              {
                id: 'GHSA-p6mc-m468-83gw',
                summary: 'Command Injection',
                severity: [{ type: 'CVSS_V3', score: '9.8' }],
              },
            ],
          }],
        }],
      }),
      stderr: '',
      exitCode: 1,
    });

    const result = await osvScannerScanner.scan('/tmp/project', MOCK_CONFIG);
    expect(result.findings).toHaveLength(2);

    const first = result.findings[0];
    expect(first.id).toBe('OSV-001');
    expect(first.severity).toBe('high'); // CVSS 7.4 -> high
    expect(first.title).toContain('lodash@4.17.20');
    expect(first.category).toBe('dependencies');

    const second = result.findings[1];
    expect(second.severity).toBe('critical'); // CVSS 9.8 -> critical
  });

  it('defaults to medium severity when no CVSS score', async () => {
    mockExec.mockResolvedValue({
      stdout: JSON.stringify({
        results: [{
          packages: [{
            package: { name: 'some-pkg', version: '1.0.0', ecosystem: 'npm' },
            vulnerabilities: [{
              id: 'GHSA-xxxx-xxxx-xxxx',
              summary: 'Unknown severity vulnerability',
            }],
          }],
        }],
      }),
      stderr: '',
      exitCode: 1,
    });

    const result = await osvScannerScanner.scan('/tmp/project', MOCK_CONFIG);
    expect(result.findings[0].severity).toBe('medium');
  });

  it('returns error when output is not valid JSON', async () => {
    mockExec.mockResolvedValue({ stdout: 'not json', stderr: '', exitCode: 2 });

    const result = await osvScannerScanner.scan('/tmp/project', MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
    expect((result as Record<string, unknown>)['error']).toBeDefined();
  });
});
