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

import { trufflehogScanner } from '../../src/secrets/trufflehog.js';
import type { AegisConfig } from '@aegis-scan/core';

const MOCK_CONFIG = {} as AegisConfig;

describe('trufflehogScanner', () => {
  it('is available when trufflehog command exists', async () => {
    mockCommandExists.mockResolvedValue(true);
    expect(await trufflehogScanner.isAvailable('/tmp/project')).toBe(true);
  });

  it('is unavailable when trufflehog command does not exist', async () => {
    mockCommandExists.mockResolvedValue(false);
    expect(await trufflehogScanner.isAvailable('/tmp/project')).toBe(false);
  });

  it('returns empty findings when no secrets found', async () => {
    mockExec.mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 });

    const result = await trufflehogScanner.scan('/tmp/project', MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
  });

  it('parses verified secrets as blocker severity', async () => {
    const line = JSON.stringify({
      SourceMetadata: {
        Data: {
          Git: {
            file: 'src/config.ts',
            line: 42,
            commit: 'abc123def456',
          },
        },
      },
      DetectorName: 'AWS',
      Verified: true,
      Raw: 'AKIAIOSFODNN7EXAMPLE',
    });

    mockExec.mockResolvedValue({ stdout: line, stderr: '', exitCode: 0 });

    const result = await trufflehogScanner.scan('/tmp/project', MOCK_CONFIG);

    expect(result.findings).toHaveLength(1);
    const finding = result.findings[0];
    expect(finding.id).toBe('TRUFFLEHOG-001');
    expect(finding.severity).toBe('blocker');
    expect(finding.title).toContain('AWS');
    expect(finding.title).toContain('(VERIFIED - ACTIVE)');
    expect(finding.file).toBe('src/config.ts');
    expect(finding.line).toBe(42);
    expect(finding.category).toBe('security');
    expect(finding.owasp).toBe('A07:2021');
    expect(finding.cwe).toBe(798);
  });

  it('parses unverified secrets as critical severity', async () => {
    const line = JSON.stringify({
      SourceMetadata: {
        Data: {
          Git: {
            file: 'env.example',
            line: 1,
            commit: 'deadbeef1234',
          },
        },
      },
      DetectorName: 'Stripe',
      Verified: false,
      Raw: 'sk_test_fake123',
    });

    mockExec.mockResolvedValue({ stdout: line, stderr: '', exitCode: 0 });

    const result = await trufflehogScanner.scan('/tmp/project', MOCK_CONFIG);

    expect(result.findings).toHaveLength(1);
    const finding = result.findings[0];
    expect(finding.severity).toBe('critical');
    expect(finding.title).not.toContain('VERIFIED');
  });

  it('parses multiple JSONL results', async () => {
    const line1 = JSON.stringify({
      SourceMetadata: { Data: { Git: { file: 'a.ts', line: 1, commit: 'aaa' } } },
      DetectorName: 'AWS',
      Verified: true,
      Raw: 'secret1',
    });
    const line2 = JSON.stringify({
      SourceMetadata: { Data: { Git: { file: 'b.ts', line: 5, commit: 'bbb' } } },
      DetectorName: 'GitHub',
      Verified: false,
      Raw: 'secret2',
    });

    mockExec.mockResolvedValue({
      stdout: `${line1}\n${line2}\n`,
      stderr: '',
      exitCode: 0,
    });

    const result = await trufflehogScanner.scan('/tmp/project', MOCK_CONFIG);

    expect(result.findings).toHaveLength(2);
    expect(result.findings[0].id).toBe('TRUFFLEHOG-001');
    expect(result.findings[1].id).toBe('TRUFFLEHOG-002');
  });

  it('NEVER includes secret value (Raw) in description', async () => {
    const secretValue = 'sk_live_supersecretkey12345678901234567890';
    const line = JSON.stringify({
      SourceMetadata: { Data: { Git: { file: 'secret.ts', line: 1, commit: 'abc' } } },
      DetectorName: 'Stripe',
      Verified: true,
      Raw: secretValue,
    });

    mockExec.mockResolvedValue({ stdout: line, stderr: '', exitCode: 0 });

    const result = await trufflehogScanner.scan('/tmp/project', MOCK_CONFIG);

    expect(result.findings[0].description).not.toContain(secretValue);
    expect(result.findings[0].title).not.toContain(secretValue);
    expect(result.findings[0].description).toContain('Remove this secret');
  });

  it('skips non-JSON lines in output', async () => {
    const validLine = JSON.stringify({
      SourceMetadata: { Data: { Git: { file: 'x.ts', line: 1, commit: 'abc' } } },
      DetectorName: 'Generic',
      Verified: false,
      Raw: 'something',
    });

    mockExec.mockResolvedValue({
      stdout: `[INFO] Scanning...\n${validLine}\n[INFO] Done\n`,
      stderr: '',
      exitCode: 0,
    });

    const result = await trufflehogScanner.scan('/tmp/project', MOCK_CONFIG);
    expect(result.findings).toHaveLength(1);
  });

  it('passes correct arguments to trufflehog', async () => {
    mockExec.mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 });

    await trufflehogScanner.scan('/tmp/my-project', MOCK_CONFIG);

    expect(mockExec).toHaveBeenCalledWith(
      'trufflehog',
      ['git', 'file:///tmp/my-project', '--json'],
      { timeout: 120_000 },
    );
  });

  it('handles missing SourceMetadata gracefully', async () => {
    const line = JSON.stringify({
      DetectorName: 'Unknown',
      Verified: false,
      Raw: 'something',
    });

    mockExec.mockResolvedValue({ stdout: line, stderr: '', exitCode: 0 });

    const result = await trufflehogScanner.scan('/tmp/project', MOCK_CONFIG);

    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].file).toBeUndefined();
    expect(result.findings[0].line).toBeUndefined();
  });
});
