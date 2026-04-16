import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

vi.mock('@aegis-scan/core', () => {
  const { readdirSync, readFileSync, realpathSync } = require('fs');
  const path = require('path');

  function walkFiles(dir: string, ignore: string[] = [], extensions: string[] = []): string[] {
    const results: string[] = [];
    const visited = new Set<string>();
    function walk(current: string): void {
      let realPath: string;
      try { realPath = realpathSync(current); } catch { return; }
      if (visited.has(realPath)) return;
      visited.add(realPath);
      let entries: any[];
      try { entries = readdirSync(current, { withFileTypes: true }); } catch { return; }
      for (const entry of entries) {
        const fullPath = path.join(current, entry.name);
        if (entry.isDirectory()) {
          if (ignore.includes(entry.name)) continue;
          walk(fullPath);
        } else if (entry.isFile()) {
          if (extensions.length === 0) { results.push(fullPath); }
          else {
            const ext = path.extname(entry.name).slice(1);
            if (extensions.includes(ext)) results.push(fullPath);
          }
        }
      }
    }
    walk(path.resolve(dir));
    return results;
  }

  return {
    walkFiles,
    readFileSafe: (p: string) => {
      try { return readFileSync(p, 'utf-8'); } catch { return null; }
    },
    commandExists: async () => true,
    exec: async () => ({ stdout: '', stderr: '', exitCode: 0 }),
  };
});

import { rateLimitProbeScanner } from '../../src/attacks/rate-limit-probe.js';
import type { AegisConfig } from '@aegis-scan/core';

function makeTempProject(): string {
  return mkdtempSync(join(tmpdir(), 'aegis-rate-limit-probe-test-'));
}

describe('rateLimitProbeScanner', () => {
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
    expect(await rateLimitProbeScanner.isAvailable(projectPath)).toBe(true);
  });

  it('has correct metadata', () => {
    expect(rateLimitProbeScanner.name).toBe('rate-limit-probe');
    expect(rateLimitProbeScanner.category).toBe('attack');
  });

  it('returns error when no target provided', async () => {
    const config = { projectPath } as AegisConfig;
    const result = await rateLimitProbeScanner.scan(projectPath, config);
    expect(result.error).toContain('No target URL provided');
    expect(result.findings).toHaveLength(0);
  });

  it('reports finding when no 429 response on burst', async () => {
    // All 20 requests return 200 — no rate limiting
    fetchSpy.mockResolvedValue({ status: 200 });

    const config = { projectPath, target: 'https://example.com' } as AegisConfig;
    const result = await rateLimitProbeScanner.scan(projectPath, config);

    // Uses fallback endpoints since no auth routes in project
    expect(result.findings.length).toBeGreaterThanOrEqual(1);
    const finding = result.findings[0];
    expect(finding.severity).toBe('high');
    expect(finding.title).toContain('No rate limiting');
    expect(finding.category).toBe('attack');
    expect(finding.id).toMatch(/^ATK-RL-\d{3}$/);
    expect(finding.owasp).toBe('A07:2021');
    expect(finding.cwe).toBe(307);
  });

  it('reports no finding when 429 is returned', async () => {
    // Mix of 200s and a 429
    let callCount = 0;
    fetchSpy.mockImplementation(() => {
      callCount++;
      return Promise.resolve({ status: callCount > 10 ? 429 : 200 });
    });

    const config = { projectPath, target: 'https://example.com' } as AegisConfig;
    const result = await rateLimitProbeScanner.scan(projectPath, config);
    expect(result.findings).toHaveLength(0);
  });

  it('discovers auth endpoints from project files', async () => {
    const dir = join(projectPath, 'app', 'api', 'auth', 'login');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'route.ts'), 'export async function POST() {}');

    fetchSpy.mockResolvedValue({ status: 200 });

    const config = { projectPath, target: 'https://example.com' } as AegisConfig;
    const result = await rateLimitProbeScanner.scan(projectPath, config);

    // Should have probed the discovered /api/auth/login endpoint
    expect(fetchSpy).toHaveBeenCalled();
    const calledUrls = fetchSpy.mock.calls.map((c: any[]) => c[0] as string);
    expect(calledUrls.some((url: string) => url.includes('/api/auth/login'))).toBe(true);
  });

  it('sends exactly 20 burst requests per endpoint', async () => {
    fetchSpy.mockResolvedValue({ status: 200 });

    const config = { projectPath, target: 'https://example.com' } as AegisConfig;
    await rateLimitProbeScanner.scan(projectPath, config);

    // Fallback has 2 endpoints, 20 requests each = 40 total
    expect(fetchSpy).toHaveBeenCalledTimes(40);
  });

  it('handles fetch errors without crashing', async () => {
    fetchSpy.mockRejectedValue(new Error('Connection refused'));

    const config = { projectPath, target: 'https://example.com' } as AegisConfig;
    const result = await rateLimitProbeScanner.scan(projectPath, config);
    expect(result.findings).toHaveLength(0);
    expect(result.error).toBeUndefined();
  });
});
