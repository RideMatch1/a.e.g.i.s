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
}));

import { trivyScanner } from '../../src/infrastructure/trivy.js';
import type { AegisConfig } from '@aegis-scan/core';

const MOCK_CONFIG = {} as AegisConfig;

describe('trivyScanner', () => {
  it('is available when trivy command exists', async () => {
    mockCommandExists.mockResolvedValue(true);
    expect(await trivyScanner.isAvailable()).toBe(true);
  });

  it('is unavailable when trivy command does not exist', async () => {
    mockCommandExists.mockResolvedValue(false);
    expect(await trivyScanner.isAvailable()).toBe(false);
  });

  it('returns empty findings when no vulnerabilities', async () => {
    mockExec.mockResolvedValue({
      stdout: JSON.stringify({ Results: [] }),
      stderr: '',
      exitCode: 0,
    });

    const result = await trivyScanner.scan('/tmp/project', MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
  });

  it('maps trivy vulnerabilities to findings', async () => {
    mockExec.mockResolvedValue({
      stdout: JSON.stringify({
        Results: [{
          Target: 'package-lock.json',
          Type: 'npm',
          Vulnerabilities: [
            {
              VulnerabilityID: 'CVE-2023-12345',
              PkgName: 'lodash',
              InstalledVersion: '4.17.20',
              FixedVersion: '4.17.21',
              Severity: 'HIGH',
              Title: 'Prototype Pollution',
              Description: 'Prototype pollution in lodash',
            },
            {
              VulnerabilityID: 'CVE-2023-99999',
              PkgName: 'axios',
              InstalledVersion: '0.21.0',
              FixedVersion: undefined,
              Severity: 'CRITICAL',
              Title: 'SSRF Vulnerability',
            },
          ],
        }],
      }),
      stderr: '',
      exitCode: 1,
    });

    const result = await trivyScanner.scan('/tmp/project', MOCK_CONFIG);
    expect(result.findings).toHaveLength(2);

    const high = result.findings.find((f) => f.severity === 'high');
    expect(high).toBeDefined();
    expect(high!.title).toContain('lodash');
    expect(high!.title).toContain('CVE-2023-12345');
    expect(high!.id).toBe('TRIVY-001');
    expect(high!.category).toBe('infrastructure');

    const critical = result.findings.find((f) => f.severity === 'critical');
    expect(critical).toBeDefined();
    expect(critical!.title).toContain('axios');
  });

  it('returns error when output is not valid JSON', async () => {
    mockExec.mockResolvedValue({ stdout: 'trivy error output', stderr: '', exitCode: 2 });

    const result = await trivyScanner.scan('/tmp/project', MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
    expect((result as Record<string, unknown>)['error']).toBeDefined();
  });
});
