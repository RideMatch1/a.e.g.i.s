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

import { testsslScanner } from '../../src/tls/testssl.js';
import type { AegisConfig } from '@aegis-scan/core';

describe('testsslScanner', () => {
  it('is available when testssl command exists', async () => {
    mockCommandExists.mockImplementation(async (cmd: string) => cmd === 'testssl');
    expect(await testsslScanner.isAvailable()).toBe(true);
  });

  it('is available when testssl.sh command exists', async () => {
    mockCommandExists.mockImplementation(async (cmd: string) => cmd === 'testssl.sh');
    expect(await testsslScanner.isAvailable()).toBe(true);
  });

  it('is unavailable when neither testssl nor testssl.sh exists', async () => {
    mockCommandExists.mockResolvedValue(false);
    expect(await testsslScanner.isAvailable()).toBe(false);
  });

  it('returns error when config.target is not set', async () => {
    const config = {} as AegisConfig;
    const result = await testsslScanner.scan('/tmp/project', config);
    expect(result.findings).toHaveLength(0);
    expect((result as Record<string, unknown>)['error']).toContain('config.target');
  });

  it('parses testssl JSON output and maps findings', async () => {
    mockCommandExists.mockImplementation(async (cmd: string) => cmd === 'testssl');
    mockExec.mockResolvedValue({
      stdout: JSON.stringify({
        scanResult: [{
          ip: '1.2.3.4',
          port: '443',
          findings: [
            {
              id: 'BEAST',
              severity: 'HIGH',
              finding: 'BEAST vulnerability present (OpenSSL <= 1.0.1)',
            },
            {
              id: 'HEARTBLEED',
              severity: 'CRITICAL',
              finding: 'Heartbleed (CVE-2014-0160) - vulnerable',
              cve: 'CVE-2014-0160',
            },
            {
              id: 'hsts',
              severity: 'OK',
              finding: 'HSTS is set',
            },
          ],
        }],
      }),
      stderr: '',
      exitCode: 0,
    });

    const config = { target: 'https://example.com' } as unknown as AegisConfig;
    const result = await testsslScanner.scan('/tmp/project', config);

    // OK and INFO/LOW findings are skipped
    const high = result.findings.find((f) => f.title.includes('BEAST'));
    expect(high).toBeDefined();
    expect(high!.severity).toBe('high');
    expect(high!.id).toBe('TLS-001');
    expect(high!.category).toBe('infrastructure');

    const critical = result.findings.find((f) => f.title.includes('HEARTBLEED'));
    expect(critical).toBeDefined();
    expect(critical!.severity).toBe('critical');
    expect(critical!.description).toContain('CVE-2014-0160');

    // OK finding should NOT appear
    const ok = result.findings.find((f) => f.title.includes('hsts'));
    expect(ok).toBeUndefined();
  });

  it('returns error when output is not valid JSON', async () => {
    mockCommandExists.mockResolvedValue(true);
    mockExec.mockResolvedValue({ stdout: 'testssl error', stderr: '', exitCode: 1 });

    const config = { target: 'https://example.com' } as unknown as AegisConfig;
    const result = await testsslScanner.scan('/tmp/project', config);
    expect((result as Record<string, unknown>)['error']).toBeDefined();
  });
});
