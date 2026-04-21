import { describe, it, expect, vi } from 'vitest';

const { mockCommandExists, mockExec, mockReadFileSafe } = vi.hoisted(() => ({
  mockCommandExists: vi.fn(),
  mockExec: vi.fn(),
  mockReadFileSafe: vi.fn(),
}));

vi.mock('@aegis-scan/core', () => ({
  commandExists: mockCommandExists,
  exec: mockExec,
  readFileSafe: mockReadFileSafe,
  walkFiles: () => [],
  isTestFile: (filePath) => /\.(test|spec|e2e)\.(ts|tsx|js|jsx|mjs|cjs)$/.test(filePath) || /[\/\\]__tests__[\/\\]/.test(filePath) || /[\/\\]__mocks__[\/\\]/.test(filePath) || /[\/\\](playwright|cypress|e2e)[\/\\]/.test(filePath),
}));

import { zapScanner } from '../../src/dast/zap.js';
import type { AegisConfig } from '@aegis-scan/core';

describe('zapScanner', () => {
  it('is available when docker command exists', async () => {
    mockCommandExists.mockResolvedValue(true);
    expect(await zapScanner.isAvailable('/tmp/project')).toBe(true);
  });

  it('is unavailable when docker command does not exist', async () => {
    mockCommandExists.mockResolvedValue(false);
    expect(await zapScanner.isAvailable('/tmp/project')).toBe(false);
  });

  it('returns error when config.target is not set', async () => {
    const config = {} as AegisConfig;
    const result = await zapScanner.scan('/tmp/project', config);
    expect(result.findings).toHaveLength(0);
    expect(result.error).toBe('ZAP requires --target URL');
  });

  it('uses zap-baseline.py for scan mode', async () => {
    mockExec.mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 });
    mockReadFileSafe.mockReturnValue(JSON.stringify({ site: [] }));

    const config = { target: 'https://example.com', mode: 'scan' } as unknown as AegisConfig;
    await zapScanner.scan('/tmp/project', config);

    expect(mockExec).toHaveBeenCalledWith(
      'docker',
      expect.arrayContaining(['zap-baseline.py']),
      expect.any(Object),
    );
  });

  it('uses zap-full-scan.py for pentest mode', async () => {
    mockExec.mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 });
    mockReadFileSafe.mockReturnValue(JSON.stringify({ site: [] }));

    const config = { target: 'https://example.com', mode: 'pentest' } as unknown as AegisConfig;
    await zapScanner.scan('/tmp/project', config);

    expect(mockExec).toHaveBeenCalledWith(
      'docker',
      expect.arrayContaining(['zap-full-scan.py']),
      expect.any(Object),
    );
  });

  it('adds --add-host for localhost targets', async () => {
    mockExec.mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 });
    mockReadFileSafe.mockReturnValue(JSON.stringify({ site: [] }));

    const config = { target: 'http://localhost:3000', mode: 'scan' } as unknown as AegisConfig;
    await zapScanner.scan('/tmp/project', config);

    expect(mockExec).toHaveBeenCalledWith(
      'docker',
      expect.arrayContaining(['--add-host=host.docker.internal:host-gateway']),
      expect.any(Object),
    );
  });

  it('does NOT add --add-host for remote targets', async () => {
    mockExec.mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 });
    mockReadFileSafe.mockReturnValue(JSON.stringify({ site: [] }));

    const config = { target: 'https://example.com', mode: 'scan' } as unknown as AegisConfig;
    await zapScanner.scan('/tmp/project', config);

    const callArgs = mockExec.mock.calls[mockExec.mock.calls.length - 1][1] as string[];
    expect(callArgs).not.toContain('--add-host=host.docker.internal:host-gateway');
  });

  it('parses ZAP JSON report with alerts', async () => {
    mockExec.mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 });

    const zapReport = {
      site: [{
        alerts: [
          {
            riskcode: '3',
            name: 'SQL Injection',
            desc: 'SQL injection vulnerability found',
            cweid: '89',
            instances: [{ uri: 'https://example.com/api/users' }],
          },
          {
            riskcode: '2',
            name: 'Missing CSP Header',
            desc: 'Content Security Policy header missing',
            cweid: '693',
            instances: [{ uri: 'https://example.com' }],
          },
          {
            riskcode: '0',
            name: 'Server Information',
            desc: 'Server leaks version information',
            cweid: '-1',
            instances: [{ uri: 'https://example.com' }],
          },
        ],
      }],
    };

    mockReadFileSafe.mockReturnValue(JSON.stringify(zapReport));

    const config = { target: 'https://example.com', mode: 'scan' } as unknown as AegisConfig;
    const result = await zapScanner.scan('/tmp/project', config);

    expect(result.findings).toHaveLength(3);

    expect(result.findings[0].id).toBe('ZAP-001');
    expect(result.findings[0].severity).toBe('high');
    expect(result.findings[0].title).toBe('SQL Injection');
    expect(result.findings[0].cwe).toBe(89);
    expect(result.findings[0].category).toBe('dast');

    expect(result.findings[1].id).toBe('ZAP-002');
    expect(result.findings[1].severity).toBe('medium');

    // CWE -1 should not be included
    expect(result.findings[2].id).toBe('ZAP-003');
    expect(result.findings[2].severity).toBe('info');
    expect(result.findings[2].owasp).toBeUndefined();
  });

  it('returns error when report file is not found', async () => {
    mockExec.mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 });
    mockReadFileSafe.mockReturnValue(null);

    const config = { target: 'https://example.com', mode: 'scan' } as unknown as AegisConfig;
    const result = await zapScanner.scan('/tmp/project', config);

    expect(result.findings).toHaveLength(0);
    expect(result.error).toContain('not generated');
  });

  it('returns error when report JSON is invalid', async () => {
    mockExec.mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 });
    mockReadFileSafe.mockReturnValue('not json');

    const config = { target: 'https://example.com', mode: 'scan' } as unknown as AegisConfig;
    const result = await zapScanner.scan('/tmp/project', config);

    expect(result.findings).toHaveLength(0);
    expect(result.error).toContain('Failed to parse');
  });

  it('handles report with no sites', async () => {
    mockExec.mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 });
    mockReadFileSafe.mockReturnValue(JSON.stringify({}));

    const config = { target: 'https://example.com', mode: 'scan' } as unknown as AegisConfig;
    const result = await zapScanner.scan('/tmp/project', config);

    expect(result.findings).toHaveLength(0);
    expect(result.error).toBeUndefined();
  });
});
