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

import { semgrepScanner } from '../../src/sast/semgrep.js';
import type { AegisConfig } from '@aegis-scan/core';

const MOCK_CONFIG = {} as AegisConfig;

describe('semgrepScanner', () => {
  it('is available when semgrep command exists', async () => {
    mockCommandExists.mockResolvedValue(true);
    expect(await semgrepScanner.isAvailable()).toBe(true);
  });

  it('is unavailable when semgrep command does not exist', async () => {
    mockCommandExists.mockResolvedValue(false);
    expect(await semgrepScanner.isAvailable()).toBe(false);
  });

  it('returns empty findings on empty semgrep output', async () => {
    mockCommandExists.mockResolvedValue(true);
    mockExec.mockResolvedValue({
      stdout: JSON.stringify({ results: [] }),
      stderr: '',
      exitCode: 0,
    });

    const result = await semgrepScanner.scan('/tmp/project', MOCK_CONFIG);
    expect(result.scanner).toBe('semgrep');
    expect(result.findings).toHaveLength(0);
  });

  it('maps semgrep results to findings with correct severity', async () => {
    mockExec.mockResolvedValue({
      stdout: JSON.stringify({
        results: [
          {
            path: '/tmp/project/src/api/route.ts',
            check_id: 'typescript.hardcoded-secret',
            extra: {
              message: 'Hardcoded secret found',
              severity: 'ERROR',
            },
            start: { line: 42, col: 5 },
            end: { line: 42, col: 30 },
          },
          {
            path: '/tmp/project/src/utils.ts',
            check_id: 'typescript.sql-injection',
            extra: {
              message: 'Potential SQL injection',
              severity: 'WARNING',
            },
            start: { line: 10, col: 1 },
            end: { line: 10, col: 50 },
          },
        ],
      }),
      stderr: '',
      exitCode: 1, // semgrep exits 1 when findings present
    });

    const result = await semgrepScanner.scan('/tmp/project', MOCK_CONFIG);
    expect(result.findings).toHaveLength(2);

    const first = result.findings[0];
    expect(first.id).toBe('SEMGREP-001');
    expect(first.severity).toBe('critical'); // ERROR -> critical
    expect(first.title).toBe('typescript.hardcoded-secret');
    expect(first.file).toBe('/tmp/project/src/api/route.ts');
    expect(first.line).toBe(42);
    expect(first.category).toBe('security');

    const second = result.findings[1];
    expect(second.severity).toBe('high'); // WARNING -> high
  });

  it('returns error in result when output is not valid JSON', async () => {
    mockExec.mockResolvedValue({
      stdout: 'not json',
      stderr: '',
      exitCode: 2,
    });

    const result = await semgrepScanner.scan('/tmp/project', MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
    expect((result as Record<string, unknown>)['error']).toBeDefined();
  });

  it('maps CRITICAL severity correctly', async () => {
    mockExec.mockResolvedValue({
      stdout: JSON.stringify({
        results: [{
          path: '/tmp/file.ts',
          check_id: 'critical-rule',
          extra: { message: 'Critical issue', severity: 'CRITICAL' },
          start: { line: 1, col: 1 },
          end: { line: 1, col: 10 },
        }],
      }),
      stderr: '',
      exitCode: 1,
    });

    const result = await semgrepScanner.scan('/tmp/project', MOCK_CONFIG);
    expect(result.findings[0].severity).toBe('critical');
  });
});
