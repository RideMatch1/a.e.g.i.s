import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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

import { strixScanner } from '../../src/dast/strix.js';
import type { AegisConfig } from '@aegis-scan/core';

describe('strixScanner — mode-gate + isAvailable + parse smoke (post-87dafa5)', () => {
  // Env restoration so test-order doesn't bleed LLM_API_KEY between tests
  const ENV_KEYS = ['LLM_API_KEY', 'ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'STRIX_LLM'];
  const originalEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const k of ENV_KEYS) {
      originalEnv[k] = process.env[k];
      delete process.env[k];
    }
    mockCommandExists.mockReset();
    mockExec.mockReset();
  });

  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (originalEnv[k] === undefined) {
        delete process.env[k];
      } else {
        process.env[k] = originalEnv[k];
      }
    }
  });

  it('isAvailable=false when strix binary missing', async () => {
    mockCommandExists.mockResolvedValue(false);
    process.env.LLM_API_KEY = 'k';
    expect(await strixScanner.isAvailable('/tmp/p')).toBe(false);
  });

  it('isAvailable=false when LLM key missing even if binary present', async () => {
    mockCommandExists.mockResolvedValue(true);
    expect(await strixScanner.isAvailable('/tmp/p')).toBe(false);
  });

  it('isAvailable=true when binary present AND LLM_API_KEY set', async () => {
    mockCommandExists.mockResolvedValue(true);
    process.env.LLM_API_KEY = 'sk-test';
    expect(await strixScanner.isAvailable('/tmp/p')).toBe(true);
  });

  it('isAvailable=true with ANTHROPIC_API_KEY (alternate provider)', async () => {
    mockCommandExists.mockResolvedValue(true);
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
    expect(await strixScanner.isAvailable('/tmp/p')).toBe(true);
  });

  it('scan returns target-required error when config.target unset', async () => {
    const config = { mode: 'pentest' } as unknown as AegisConfig;
    const result = await strixScanner.scan('/tmp/p', config);
    expect(result.findings).toHaveLength(0);
    expect(result.error).toMatch(/requires --target/);
  });

  it('scan returns mode-gate error when not in pentest mode (cost-protection)', async () => {
    const config = { target: 'https://example.com', mode: 'scan' } as unknown as AegisConfig;
    const result = await strixScanner.scan('/tmp/p', config);
    expect(result.findings).toHaveLength(0);
    expect(result.error).toMatch(/--mode pentest/);
    // Critical: exec MUST NOT have been called when mode-gate blocks
    expect(mockExec).not.toHaveBeenCalled();
  });

  it('scan invokes argv-style exec (no shell-string — CWE-78 prevention)', async () => {
    mockExec.mockResolvedValue({ stdout: '{}', stderr: '', exitCode: 0 });
    const config = { target: 'https://example.com', mode: 'pentest' } as unknown as AegisConfig;
    await strixScanner.scan('/tmp/p', config);
    expect(mockExec).toHaveBeenCalledWith(
      'strix',
      expect.arrayContaining(['--target', 'https://example.com', '-n', '--output', 'json']),
      expect.any(Object),
    );
    // Ensure exec received an args ARRAY (argv-style), not a shell-string
    const callArgs = mockExec.mock.calls[0]?.[1];
    expect(Array.isArray(callArgs)).toBe(true);
  });

  it('scan parses Strix JSON report findings array', async () => {
    mockExec.mockResolvedValue({
      stdout: JSON.stringify({
        findings: [
          { id: 'STRIX-001', severity: 'critical', title: 'IDOR in /api/users/:id', cwe: 639 },
          { severity: 'high', title: 'SQLi in /api/search', cwe: '89' },
        ],
      }),
      stderr: '',
      exitCode: 0,
    });
    const config = { target: 'https://example.com', mode: 'pentest' } as unknown as AegisConfig;
    const result = await strixScanner.scan('/tmp/p', config);
    expect(result.findings).toHaveLength(2);
    expect(result.findings[0]?.severity).toBe('critical');
    expect(result.findings[0]?.cwe).toBe(639);
    expect(result.findings[1]?.cwe).toBe(89);
    // Auto-generated ID for the second (no id field in source)
    expect(result.findings[1]?.id).toMatch(/^STRIX-/);
  });

  it('scan returns error when stdout has no JSON', async () => {
    mockExec.mockResolvedValue({ stdout: 'progress log only no json', stderr: '', exitCode: 0 });
    const config = { target: 'https://example.com', mode: 'pentest' } as unknown as AegisConfig;
    const result = await strixScanner.scan('/tmp/p', config);
    expect(result.findings).toHaveLength(0);
    expect(result.error).toMatch(/no JSON/);
  });

  it('scan returns error when strix exits >1', async () => {
    mockExec.mockResolvedValue({ stdout: '', stderr: 'fatal', exitCode: 2 });
    const config = { target: 'https://example.com', mode: 'pentest' } as unknown as AegisConfig;
    const result = await strixScanner.scan('/tmp/p', config);
    expect(result.findings).toHaveLength(0);
    expect(result.error).toMatch(/exited 2/);
  });
});
