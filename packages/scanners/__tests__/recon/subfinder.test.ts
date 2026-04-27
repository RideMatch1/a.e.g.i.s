import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockCommandExists, mockExec } = vi.hoisted(() => ({
  mockCommandExists: vi.fn(),
  mockExec: vi.fn(),
}));

vi.mock('@aegis-scan/core', () => ({
  commandExists: mockCommandExists,
  exec: mockExec,
  walkFiles: () => [],
  isTestFile: (filePath: string) =>
    /\.(test|spec|e2e)\.(ts|tsx|js|jsx|mjs|cjs)$/.test(filePath),
}));

import { subfinderScanner } from '../../src/recon/subfinder.js';
import type { AegisConfig } from '@aegis-scan/core';

describe('subfinderScanner — isAvailable + mode-gate + parse', () => {
  beforeEach(() => {
    mockCommandExists.mockReset();
    mockExec.mockReset();
  });

  it('isAvailable=false when subfinder binary missing', async () => {
    mockCommandExists.mockResolvedValue(false);
    expect(await subfinderScanner.isAvailable('/tmp/p')).toBe(false);
  });

  it('isAvailable=true when subfinder binary present (no API key required for free providers)', async () => {
    mockCommandExists.mockResolvedValue(true);
    expect(await subfinderScanner.isAvailable('/tmp/p')).toBe(true);
  });

  it('scan returns target-required error when config.target unset', async () => {
    const config = { mode: 'pentest' } as unknown as AegisConfig;
    const result = await subfinderScanner.scan('/tmp/p', config);
    expect(result.findings).toHaveLength(0);
    expect(result.error).toMatch(/requires --target/);
  });

  it('scan returns mode-gate error when not in pentest mode (consent-protection)', async () => {
    const config = { target: 'example.com', mode: 'scan' } as unknown as AegisConfig;
    const result = await subfinderScanner.scan('/tmp/p', config);
    expect(result.findings).toHaveLength(0);
    expect(result.error).toMatch(/--mode pentest/);
    // Critical: exec MUST NOT have been called when mode-gate blocks
    expect(mockExec).not.toHaveBeenCalled();
  });

  it('scan strips URL down to bare domain before calling subfinder', async () => {
    mockExec.mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 });
    const config = { target: 'https://example.com/foo/bar', mode: 'pentest' } as unknown as AegisConfig;
    await subfinderScanner.scan('/tmp/p', config);
    // The bare hostname (example.com) should be passed to subfinder, not the full URL
    expect(mockExec).toHaveBeenCalledWith(
      'subfinder',
      ['-d', 'example.com', '-oJ', '-silent'],
      expect.any(Object),
    );
  });

  it('scan invokes argv-style exec (no shell-string — CWE-78 prevention)', async () => {
    mockExec.mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 });
    const config = { target: 'example.com', mode: 'pentest' } as unknown as AegisConfig;
    await subfinderScanner.scan('/tmp/p', config);
    const callArgs = mockExec.mock.calls[0]?.[1];
    expect(Array.isArray(callArgs)).toBe(true);
  });

  it('scan rejects bare-IP targets (subfinder is for public DNS, not IPs)', async () => {
    mockExec.mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 });
    const config = { target: '8.8.8.8', mode: 'pentest' } as unknown as AegisConfig;
    const result = await subfinderScanner.scan('/tmp/p', config);
    expect(result.error).toMatch(/could not derive bare domain/);
    expect(mockExec).not.toHaveBeenCalled();
  });

  it('scan parses JSONL subdomain output and dedupes hosts', async () => {
    mockExec.mockResolvedValue({
      stdout:
        '{"host":"api.example.com","input":"example.com","source":"crtsh"}\n' +
        '{"host":"www.example.com","input":"example.com","source":"crtsh"}\n' +
        '{"host":"api.example.com","input":"example.com","source":"alienvault"}\n' + // dupe via different source
        '\n' + // blank line
        'progress: line that should be skipped\n' +
        '{"host":"mail.example.com","input":"example.com","source":"crtsh"}\n',
      stderr: '',
      exitCode: 0,
    });
    const config = { target: 'example.com', mode: 'pentest' } as unknown as AegisConfig;
    const result = await subfinderScanner.scan('/tmp/p', config);
    // 3 unique hosts (api dedup'd)
    expect(result.findings).toHaveLength(3);
    const titles = result.findings.map((f) => f.title);
    expect(titles).toContain('Subdomain discovered: api.example.com');
    expect(titles).toContain('Subdomain discovered: www.example.com');
    expect(titles).toContain('Subdomain discovered: mail.example.com');
  });

  it('scan classifies common-internal-prefix subdomains as severity:low (recon signal)', async () => {
    mockExec.mockResolvedValue({
      stdout:
        '{"host":"dev.example.com","source":"crtsh"}\n' +
        '{"host":"staging.example.com","source":"crtsh"}\n' +
        '{"host":"admin.example.com","source":"crtsh"}\n' +
        '{"host":"www.example.com","source":"crtsh"}\n',
      stderr: '',
      exitCode: 0,
    });
    const config = { target: 'example.com', mode: 'pentest' } as unknown as AegisConfig;
    const result = await subfinderScanner.scan('/tmp/p', config);
    expect(result.findings).toHaveLength(4);
    const sevByHost = Object.fromEntries(
      result.findings.map((f) => [f.title.replace('Subdomain discovered: ', ''), f.severity]),
    );
    expect(sevByHost['dev.example.com']).toBe('low');
    expect(sevByHost['staging.example.com']).toBe('low');
    expect(sevByHost['admin.example.com']).toBe('low');
    expect(sevByHost['www.example.com']).toBe('info');
  });

  it('scan returns error when subfinder exits >1', async () => {
    mockExec.mockResolvedValue({ stdout: '', stderr: 'fatal', exitCode: 2 });
    const config = { target: 'example.com', mode: 'pentest' } as unknown as AegisConfig;
    const result = await subfinderScanner.scan('/tmp/p', config);
    expect(result.findings).toHaveLength(0);
    expect(result.error).toMatch(/exited 2/);
  });
});
