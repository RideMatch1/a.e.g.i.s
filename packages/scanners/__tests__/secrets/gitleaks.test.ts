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
    exec: async () => ({ stdout: mockExecOutput, stderr: '', exitCode: 1 }),
    isTestFile: () => false,
  };
});

import { gitleaksScanner } from '../../src/secrets/gitleaks.js';
import type { AegisConfig } from '@aegis-scan/core';

const MOCK_CONFIG = {} as AegisConfig;
const PROJECT = mkdtempSync(join(tmpdir(), 'aegis-gitleaks-test-'));

function setMockOutput(findings: Array<{ File: string; RuleID?: string; Description?: string }>) {
  mockExecOutput = JSON.stringify(
    findings.map((f) => ({
      Description: f.Description ?? 'Generic API Key detected',
      StartLine: 1,
      EndLine: 1,
      Match: '<redacted>',
      File: f.File,
      RuleID: f.RuleID ?? 'generic-api-key',
    })),
  );
}

describe('gitleaksScanner — v0.17.5 F5.1 path-allowlist filtering', () => {
  beforeEach(() => {
    mockExecOutput = '';
  });

  it('emits a finding for a real source file', async () => {
    setMockOutput([{ File: 'src/lib/config.ts' }]);
    const result = await gitleaksScanner.scan(PROJECT, MOCK_CONFIG);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].file).toBe('src/lib/config.ts');
  });

  it('filters findings in README.md', async () => {
    setMockOutput([{ File: 'README.md' }]);
    const result = await gitleaksScanner.scan(PROJECT, MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
  });

  it('filters findings in yarn.lock', async () => {
    setMockOutput([{ File: 'apps/web/yarn.lock' }]);
    const result = await gitleaksScanner.scan(PROJECT, MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
  });

  it('filters findings in OpenAPI doc', async () => {
    setMockOutput([{ File: 'docs/api-reference/v2/openapi.json' }]);
    const result = await gitleaksScanner.scan(PROJECT, MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
  });

  it('filters findings in playwright e2e tests', async () => {
    setMockOutput([{ File: 'apps/web/playwright/payment-apps.e2e.ts' }]);
    const result = await gitleaksScanner.scan(PROJECT, MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
  });

  it('filters findings in .env.example', async () => {
    setMockOutput([{ File: '.env.example' }]);
    const result = await gitleaksScanner.scan(PROJECT, MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
  });

  it('mixed input: keeps real source, filters noise', async () => {
    setMockOutput([
      { File: 'README.md' },                           // skip (doc)
      { File: 'src/lib/secrets.ts' },                  // keep (real source)
      { File: 'package-lock.json' },                   // skip (lockfile)
      { File: 'apps/web/playwright/auth.e2e.ts' },     // skip (e2e)
      { File: 'pages/api/login.ts' },                  // keep (real source)
      { File: '.env.example' },                        // skip (example)
      { File: 'docs/setup.mdx' },                      // skip (doc)
    ]);
    const result = await gitleaksScanner.scan(PROJECT, MOCK_CONFIG);
    expect(result.findings).toHaveLength(2);
    expect(result.findings.map((f) => f.file).sort()).toEqual([
      'pages/api/login.ts',
      'src/lib/secrets.ts',
    ]);
  });

  it('renumbers IDs sequentially after filtering', async () => {
    setMockOutput([
      { File: 'README.md' },              // skip
      { File: 'src/a.ts' },               // keep — should be GITLEAKS-001
      { File: 'yarn.lock' },              // skip
      { File: 'src/b.ts' },               // keep — should be GITLEAKS-002
    ]);
    const result = await gitleaksScanner.scan(PROJECT, MOCK_CONFIG);
    expect(result.findings).toHaveLength(2);
    expect(result.findings[0].id).toBe('GITLEAKS-001');
    expect(result.findings[1].id).toBe('GITLEAKS-002');
  });
});
