import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

let mockExecOutput = '';

vi.mock('@aegis-scan/core', () => {
  return {
    walkFiles: () => [],
    readFileSafe: () => null,
    commandExists: async () => true,
    exec: async () => ({ stdout: mockExecOutput, stderr: '', exitCode: 0 }),
    isTestFile: () => false,
  };
});

import { trufflehogScanner } from '../../src/secrets/trufflehog.js';
import type { AegisConfig } from '@aegis-scan/core';

const MOCK_CONFIG = {} as AegisConfig;
const PROJECT = mkdtempSync(join(tmpdir(), 'aegis-trufflehog-test-'));

function setMockOutput(
  findings: Array<{ file: string; detector?: string; verified?: boolean; line?: number }>,
) {
  // TruffleHog emits one JSON object per line (JSONL)
  mockExecOutput = findings
    .map((f) =>
      JSON.stringify({
        SourceMetadata: {
          Data: { Git: { file: f.file, line: f.line ?? 1, commit: 'abc12345' } },
        },
        DetectorName: f.detector ?? 'GenericKey',
        Verified: f.verified ?? false,
      }),
    )
    .join('\n');
}

describe('trufflehogScanner — v0.17.5 F5.1 path-allowlist filtering', () => {
  beforeEach(() => {
    mockExecOutput = '';
  });

  it('emits a finding for a real source file', async () => {
    setMockOutput([{ file: 'src/lib/secrets.ts' }]);
    const result = await trufflehogScanner.scan(PROJECT, MOCK_CONFIG);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].file).toBe('src/lib/secrets.ts');
  });

  it('filters findings in lockfiles', async () => {
    setMockOutput([{ file: 'yarn.lock' }, { file: 'package-lock.json' }]);
    const result = await trufflehogScanner.scan(PROJECT, MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
  });

  it('filters findings in i18n.lock and translations', async () => {
    setMockOutput([
      { file: 'i18n.lock' },
      { file: 'locales/de.json' },
      { file: 'translations/fr.po' },
    ]);
    const result = await trufflehogScanner.scan(PROJECT, MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
  });

  it('filters findings in test fixtures and bookingScenario-class data', async () => {
    setMockOutput([
      { file: 'packages/testing/src/lib/bookingScenario/data.ts' },
      { file: '__tests__/setup.ts' },
      { file: 'cypress/fixtures/users.json' },
    ]);
    const result = await trufflehogScanner.scan(PROJECT, MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
  });

  it('preserves verified-status semantics on filtered results', async () => {
    setMockOutput([
      { file: 'src/lib/api.ts', detector: 'AWS', verified: true },
      { file: 'src/lib/sentry.ts', detector: 'Sentry', verified: false },
    ]);
    const result = await trufflehogScanner.scan(PROJECT, MOCK_CONFIG);
    expect(result.findings).toHaveLength(2);
    const verified = result.findings.find((f) => f.title.includes('VERIFIED'));
    expect(verified).toBeDefined();
    expect(verified!.severity).toBe('blocker');
    const unverified = result.findings.find((f) => !f.title.includes('VERIFIED'));
    expect(unverified!.severity).toBe('critical');
  });

  it('mixed input: keeps source, filters noise', async () => {
    setMockOutput([
      { file: 'README.md' },                  // skip
      { file: 'src/lib/api.ts' },             // keep
      { file: 'yarn.lock' },                  // skip
      { file: 'docs/setup.md' },              // skip
      { file: 'lib/auth.ts' },                // keep
      { file: 'fixtures/test-data.json' },    // skip
    ]);
    const result = await trufflehogScanner.scan(PROJECT, MOCK_CONFIG);
    expect(result.findings).toHaveLength(2);
  });
});
