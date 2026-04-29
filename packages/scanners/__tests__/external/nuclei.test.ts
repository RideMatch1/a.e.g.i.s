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

import { nucleiScanner } from '../../src/dast/nuclei.js';
import type { AegisConfig } from '@aegis-scan/core';

describe('nucleiScanner', () => {
  it('is available when nuclei command exists', async () => {
    mockCommandExists.mockResolvedValue(true);
    expect(await nucleiScanner.isAvailable()).toBe(true);
  });

  it('is unavailable when nuclei command does not exist', async () => {
    mockCommandExists.mockResolvedValue(false);
    expect(await nucleiScanner.isAvailable()).toBe(false);
  });

  it('returns error when config.target is not set', async () => {
    const config = {} as AegisConfig;
    const result = await nucleiScanner.scan('/tmp/project', config);
    expect(result.findings).toHaveLength(0);
    expect((result as Record<string, unknown>)['error']).toContain('config.target');
  });

  it('parses JSONL output correctly', async () => {
    mockCommandExists.mockResolvedValue(true);
    const line1 = JSON.stringify({
      'template-id': 'xss-reflected',
      info: { name: 'Reflected XSS', severity: 'high', description: 'XSS found' },
      host: 'https://example.com',
      matched: 'https://example.com/search?q=<script>',
      type: 'http',
    });
    const line2 = JSON.stringify({
      'template-id': 'tech-detect',
      info: { name: 'Next.js Detection', severity: 'info' },
      host: 'https://example.com',
      matched: 'https://example.com',
      type: 'http',
    });

    mockExec.mockResolvedValue({
      stdout: `${line1}\n${line2}\n`,
      stderr: '',
      exitCode: 0,
    });

    const config = { target: 'https://example.com', mode: 'pentest' } as unknown as AegisConfig;
    const result = await nucleiScanner.scan('/tmp/project', config);

    expect(result.findings).toHaveLength(2);
    expect(result.findings[0].id).toBe('NUCLEI-001');
    expect(result.findings[0].severity).toBe('high');
    expect(result.findings[0].title).toBe('Reflected XSS');
    expect(result.findings[0].category).toBe('dast');
  });

  it('skips non-JSON lines in JSONL output', async () => {
    mockExec.mockResolvedValue({
      stdout: `
[INF] Templates loaded: 1234
${JSON.stringify({ 'template-id': 'test', info: { name: 'Test', severity: 'medium' }, host: 'http://test.com', matched: 'http://test.com', type: 'http' })}
[INF] Scan completed
`,
      stderr: '',
      exitCode: 0,
    });

    const config = { target: 'https://example.com', mode: 'pentest' } as unknown as AegisConfig;
    const result = await nucleiScanner.scan('/tmp/project', config);
    expect(result.findings).toHaveLength(1);
  });

  it('returns mode-gate error when mode is audit/scan (CRIT-001 v0.17.8 fix)', async () => {
    mockExec.mockClear();
    const config = { target: 'https://example.com', mode: 'audit' } as unknown as AegisConfig;
    const result = await nucleiScanner.scan('/tmp/project', config);
    expect(result.findings).toHaveLength(0);
    expect(result.error).toMatch(/--mode pentest or --mode siege/);
    expect(mockExec).not.toHaveBeenCalled();
  });

  it('returns mode-gate error when mode is missing entirely (CRIT-001 v0.17.8 fix)', async () => {
    mockExec.mockClear();
    const config = { target: 'https://example.com' } as unknown as AegisConfig;
    const result = await nucleiScanner.scan('/tmp/project', config);
    expect(result.findings).toHaveLength(0);
    expect(result.error).toMatch(/--mode pentest or --mode siege/);
    expect(mockExec).not.toHaveBeenCalled();
  });

  it('runs nuclei when mode is siege (siege also allows DAST)', async () => {
    mockCommandExists.mockResolvedValue(true);
    mockExec.mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 });
    mockExec.mockClear();
    const config = { target: 'https://example.com', mode: 'siege' } as unknown as AegisConfig;
    await nucleiScanner.scan('/tmp/project', config);
    expect(mockExec).toHaveBeenCalled();
  });
});
