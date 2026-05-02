import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

vi.mock('@aegis-scan/core', () => ({
  walkFiles: () => [],
  readFileSafe: () => null,
  commandExists: async () => true,
  exec: async () => ({ stdout: '', stderr: '', exitCode: 0 }),
  isTestFile: (filePath: string) => /\.(test|spec|e2e)\.(ts|tsx|js|jsx|mjs|cjs)$/.test(filePath) || /[\/\\]__tests__[\/\\]/.test(filePath) || /[\/\\]__mocks__[\/\\]/.test(filePath) || /[\/\\](playwright|cypress|e2e)[\/\\]/.test(filePath),
  opsecPace: async () => {},
  applyOpsecHeaders: (init: any) => init ?? {},
}));

import { headerProbeScanner } from '../../src/attacks/header-probe.js';
import type { AegisConfig } from '@aegis-scan/core';

function makeTempProject(): string {
  return mkdtempSync(join(tmpdir(), 'aegis-header-probe-test-'));
}

function makeHeaders(headerMap: Record<string, string>): Headers {
  const headers = new Headers();
  for (const [key, value] of Object.entries(headerMap)) {
    headers.set(key, value);
  }
  return headers;
}

describe('headerProbeScanner', () => {
  let projectPath: string;
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    projectPath = makeTempProject();
    fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('is always available', async () => {
    expect(await headerProbeScanner.isAvailable(projectPath)).toBe(true);
  });

  it('has correct metadata', () => {
    expect(headerProbeScanner.name).toBe('header-probe');
    expect(headerProbeScanner.category).toBe('attack');
  });

  it('returns error when no target provided', async () => {
    const config = { projectPath } as AegisConfig;
    const result = await headerProbeScanner.scan(projectPath, config);
    expect(result.error).toContain('No target URL provided');
    expect(result.findings).toHaveLength(0);
  });

  it('reports all missing headers when none are set', async () => {
    fetchSpy.mockResolvedValue({
      headers: makeHeaders({}),
    });

    const config = { projectPath, target: 'https://example.com' } as AegisConfig;
    const result = await headerProbeScanner.scan(projectPath, config);

    expect(result.findings).toHaveLength(7);
    for (const finding of result.findings) {
      expect(finding.category).toBe('attack');
      expect(finding.id).toMatch(/^ATK-HDR-\d{3}$/);
      expect(finding.scanner).toBe('header-probe');
    }
  });

  it('reports no findings when all headers are present', async () => {
    fetchSpy.mockResolvedValue({
      headers: makeHeaders({
        'strict-transport-security': 'max-age=31536000',
        'content-security-policy': "default-src 'self'",
        'x-frame-options': 'DENY',
        'x-content-type-options': 'nosniff',
        'referrer-policy': 'strict-origin-when-cross-origin',
        'permissions-policy': 'camera=()',
        'cross-origin-opener-policy': 'same-origin',
      }),
    });

    const config = { projectPath, target: 'https://example.com' } as AegisConfig;
    const result = await headerProbeScanner.scan(projectPath, config);
    expect(result.findings).toHaveLength(0);
  });

  it('reports only missing headers (partial set)', async () => {
    fetchSpy.mockResolvedValue({
      headers: makeHeaders({
        'strict-transport-security': 'max-age=31536000',
        'content-security-policy': "default-src 'self'",
      }),
    });

    const config = { projectPath, target: 'https://example.com' } as AegisConfig;
    const result = await headerProbeScanner.scan(projectPath, config);

    // 7 total - 2 present = 5 missing
    expect(result.findings).toHaveLength(5);
    expect(result.findings.find((f) => f.title.includes('strict-transport-security'))).toBeUndefined();
    expect(result.findings.find((f) => f.title.includes('content-security-policy'))).toBeUndefined();
    expect(result.findings.find((f) => f.title.includes('x-frame-options'))).toBeDefined();
  });

  it('marks HSTS and CSP as high severity', async () => {
    fetchSpy.mockResolvedValue({
      headers: makeHeaders({}),
    });

    const config = { projectPath, target: 'https://example.com' } as AegisConfig;
    const result = await headerProbeScanner.scan(projectPath, config);

    const hsts = result.findings.find((f) => f.title.includes('strict-transport-security'));
    const csp = result.findings.find((f) => f.title.includes('content-security-policy'));
    expect(hsts?.severity).toBe('high');
    expect(csp?.severity).toBe('high');
  });

  it('handles fetch errors gracefully', async () => {
    fetchSpy.mockRejectedValue(new Error('Network error'));

    const config = { projectPath, target: 'https://example.com' } as AegisConfig;
    const result = await headerProbeScanner.scan(projectPath, config);
    expect(result.findings).toHaveLength(0);
    expect(result.error).toContain('Failed to reach target');
  });
});
