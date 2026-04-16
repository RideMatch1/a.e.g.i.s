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

import { gitleaksScanner } from '../../src/secrets/gitleaks.js';
import type { AegisConfig } from '@aegis-scan/core';

const MOCK_CONFIG = {} as AegisConfig;

describe('gitleaksScanner', () => {
  it('is available when gitleaks command exists', async () => {
    mockCommandExists.mockResolvedValue(true);
    expect(await gitleaksScanner.isAvailable()).toBe(true);
  });

  it('is unavailable when gitleaks command does not exist', async () => {
    mockCommandExists.mockResolvedValue(false);
    expect(await gitleaksScanner.isAvailable()).toBe(false);
  });

  it('returns empty findings when no leaks found (null output)', async () => {
    mockCommandExists.mockResolvedValue(true);
    mockExec.mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 });

    const result = await gitleaksScanner.scan('/tmp/project', MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
  });

  it('returns empty findings when gitleaks outputs empty array', async () => {
    mockExec.mockResolvedValue({ stdout: '[]', stderr: '', exitCode: 0 });

    const result = await gitleaksScanner.scan('/tmp/project', MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
  });

  it('maps gitleaks results to BLOCKER findings', async () => {
    const leaks = [
      {
        Description: 'Stripe API token',
        StartLine: 5,
        EndLine: 5,
        Match: 'sk_live_abc123',
        File: 'src/lib/payments.ts',
        RuleID: 'stripe-access-token',
        Commit: 'abc123',
      },
      {
        Description: 'AWS Access Key',
        StartLine: 10,
        EndLine: 10,
        Match: 'AKIAIOSFODNN7EXAMPLE',
        File: 'config/aws.ts',
        RuleID: 'aws-access-key-id',
      },
    ];

    mockExec.mockResolvedValue({
      stdout: JSON.stringify(leaks),
      stderr: '',
      exitCode: 1,
    });

    const result = await gitleaksScanner.scan('/tmp/project', MOCK_CONFIG);
    expect(result.findings).toHaveLength(2);

    const first = result.findings[0];
    expect(first.id).toBe('GITLEAKS-001');
    expect(first.severity).toBe('blocker');
    expect(first.title).toContain('stripe-access-token');
    expect(first.file).toBe('src/lib/payments.ts');
    expect(first.line).toBe(5);
    expect(first.category).toBe('security');
  });

  it('handles non-JSON stderr gracefully', async () => {
    mockExec.mockResolvedValue({
      stdout: '',
      stderr: 'fatal: no leaks found',
      exitCode: 0,
    });

    const result = await gitleaksScanner.scan('/tmp/project', MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
  });

  it('does NOT leak secret content in description (Bug 3 fix)', async () => {
    const secretValue = 'sk_live_supersecretkey12345678901234567890';
    mockExec.mockResolvedValue({
      stdout: JSON.stringify([{
        Description: 'Generic secret',
        StartLine: 1,
        EndLine: 1,
        Match: secretValue,
        File: 'secret.ts',
        RuleID: 'generic-secret',
      }]),
      stderr: '',
      exitCode: 1,
    });

    const result = await gitleaksScanner.scan('/tmp/project', MOCK_CONFIG);
    // Description must NOT contain the actual secret value
    expect(result.findings[0].description).not.toContain(secretValue);
    expect(result.findings[0].description).toContain('Remove this secret');
  });
});
