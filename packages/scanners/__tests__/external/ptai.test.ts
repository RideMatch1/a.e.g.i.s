import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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
  isTestFile: (filePath: string) =>
    /\.(test|spec|e2e)\.(ts|tsx|js|jsx|mjs|cjs)$/.test(filePath),
}));

import { ptaiScanner } from '../../src/dast/ptai.js';
import type { AegisConfig } from '@aegis-scan/core';

describe('ptaiScanner — mode-gate + isAvailable + SARIF parse smoke (post-87dafa5)', () => {
  const ENV_KEYS = ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'OLLAMA_HOST'];
  const originalEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const k of ENV_KEYS) {
      originalEnv[k] = process.env[k];
      delete process.env[k];
    }
    mockCommandExists.mockReset();
    mockExec.mockReset();
    mockReadFileSafe.mockReset();
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

  it('isAvailable=false when ptai binary missing', async () => {
    mockCommandExists.mockResolvedValue(false);
    process.env.ANTHROPIC_API_KEY = 'k';
    expect(await ptaiScanner.isAvailable('/tmp/p')).toBe(false);
  });

  it('isAvailable=false when binary present but no LLM key in env', async () => {
    mockCommandExists.mockResolvedValue(true);
    expect(await ptaiScanner.isAvailable('/tmp/p')).toBe(false);
  });

  it('isAvailable=true with OLLAMA_HOST (local-only fallback)', async () => {
    mockCommandExists.mockResolvedValue(true);
    process.env.OLLAMA_HOST = 'http://localhost:11434';
    expect(await ptaiScanner.isAvailable('/tmp/p')).toBe(true);
  });

  it('scan returns target-required error when config.target unset', async () => {
    const config = { mode: 'pentest' } as unknown as AegisConfig;
    const result = await ptaiScanner.scan('/tmp/p', config);
    expect(result.findings).toHaveLength(0);
    expect(result.error).toMatch(/requires --target/);
  });

  it('scan returns mode-gate error when not in pentest mode', async () => {
    const config = { target: 'https://example.com', mode: 'scan' } as unknown as AegisConfig;
    const result = await ptaiScanner.scan('/tmp/p', config);
    expect(result.findings).toHaveLength(0);
    expect(result.error).toMatch(/--mode pentest/);
    expect(mockExec).not.toHaveBeenCalled();
  });

  it('scan invokes argv-style exec with start subcommand + sarif format', async () => {
    mockExec.mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 });
    mockReadFileSafe.mockReturnValue(JSON.stringify({ runs: [] }));
    const config = { target: 'https://example.com', mode: 'pentest' } as unknown as AegisConfig;
    await ptaiScanner.scan('/tmp/p', config);
    expect(mockExec).toHaveBeenCalledWith(
      'ptai',
      expect.arrayContaining(['start', 'https://example.com', '--non-interactive', '--format', 'sarif']),
      expect.any(Object),
    );
    const callArgs = mockExec.mock.calls[0]?.[1];
    expect(Array.isArray(callArgs)).toBe(true);
  });

  it('scan parses SARIF 2.1.0 results array', async () => {
    mockExec.mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 });
    mockReadFileSafe.mockReturnValue(
      JSON.stringify({
        runs: [
          {
            tool: {
              driver: {
                rules: [{ id: 'sql-inj-001', shortDescription: { text: 'SQLi in search' } }],
              },
            },
            results: [
              {
                ruleId: 'sql-inj-001',
                level: 'error',
                message: { text: 'Tainted query parameter' },
                properties: { severity: 'critical', cwe: 89 },
              },
              {
                ruleId: 'xss-001',
                level: 'warning',
                message: { text: 'Reflected XSS' },
                properties: { cwe: 79 },
              },
            ],
          },
        ],
      }),
    );
    const config = { target: 'https://example.com', mode: 'pentest' } as unknown as AegisConfig;
    const result = await ptaiScanner.scan('/tmp/p', config);
    expect(result.findings).toHaveLength(2);
    // properties.severity overrides level
    expect(result.findings[0]?.severity).toBe('critical');
    expect(result.findings[0]?.cwe).toBe(89);
    expect(result.findings[0]?.title).toBe('SQLi in search'); // from rule shortDescription
    // level=warning maps to medium when no properties.severity
    expect(result.findings[1]?.severity).toBe('medium');
    expect(result.findings[1]?.cwe).toBe(79);
  });

  it('scan returns error when SARIF report missing on disk', async () => {
    mockExec.mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 });
    mockReadFileSafe.mockReturnValue(null);
    const config = { target: 'https://example.com', mode: 'pentest' } as unknown as AegisConfig;
    const result = await ptaiScanner.scan('/tmp/p', config);
    expect(result.findings).toHaveLength(0);
    expect(result.error).toMatch(/SARIF report not generated/);
  });

  it('scan returns error when ptai exits >1', async () => {
    mockExec.mockResolvedValue({ stdout: '', stderr: 'auth failed', exitCode: 5 });
    const config = { target: 'https://example.com', mode: 'pentest' } as unknown as AegisConfig;
    const result = await ptaiScanner.scan('/tmp/p', config);
    expect(result.findings).toHaveLength(0);
    expect(result.error).toMatch(/exited 5/);
  });
});
