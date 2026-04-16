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

import { raceProbeScanner } from '../../src/attacks/race-probe.js';
import type { AegisConfig } from '@aegis-scan/core';

function makeTempProject(): string {
  return mkdtempSync(join(tmpdir(), 'aegis-race-probe-test-'));
}

function makeRoute(projectPath: string, routeRelPath: string, content: string): void {
  const dir = join(projectPath, ...routeRelPath.split('/').slice(0, -1));
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(projectPath, routeRelPath), content);
}

const POST_HANDLER = 'export async function POST() {}';

describe('raceProbeScanner', () => {
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
    expect(await raceProbeScanner.isAvailable(projectPath)).toBe(true);
  });

  it('has correct metadata', () => {
    expect(raceProbeScanner.name).toBe('race-probe');
    expect(raceProbeScanner.category).toBe('attack');
  });

  it('returns error when no target provided', async () => {
    const config = { projectPath } as AegisConfig;
    const result = await raceProbeScanner.scan(projectPath, config);
    expect(result.error).toContain('No target URL provided');
    expect(result.findings).toHaveLength(0);
  });

  it('makes no requests when project has no matching routes', async () => {
    // Route exists but path has no race-condition keywords
    makeRoute(projectPath, 'app/api/health/route.ts', POST_HANDLER);

    const config = { projectPath, target: 'https://example.com' } as AegisConfig;
    const result = await raceProbeScanner.scan(projectPath, config);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.findings).toHaveLength(0);
  });

  it('makes no requests when matching route has no POST export', async () => {
    // Path has 'book' keyword but only GET handler — should not be probed
    makeRoute(
      projectPath,
      'app/api/booking/route.ts',
      'export async function GET() {}',
    );

    const config = { projectPath, target: 'https://example.com' } as AegisConfig;
    const result = await raceProbeScanner.scan(projectPath, config);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.findings).toHaveLength(0);
  });

  it('skips routes with destructive keywords in path', async () => {
    // Even though 'pay' matches, 'delete' should override and skip
    makeRoute(projectPath, 'app/api/payment/delete/route.ts', POST_HANDLER);
    makeRoute(projectPath, 'app/api/booking/remove/route.ts', POST_HANDLER);
    makeRoute(projectPath, 'app/api/redeem/drop/route.ts', POST_HANDLER);

    const config = { projectPath, target: 'https://example.com' } as AegisConfig;
    const result = await raceProbeScanner.scan(projectPath, config);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.findings).toHaveLength(0);
  });

  it('reports MEDIUM finding when all 5 concurrent requests return 200', async () => {
    makeRoute(projectPath, 'app/api/booking/route.ts', POST_HANDLER);

    fetchSpy.mockResolvedValue({ status: 200 });

    const config = { projectPath, target: 'https://example.com' } as AegisConfig;
    const result = await raceProbeScanner.scan(projectPath, config);

    expect(result.findings.length).toBeGreaterThanOrEqual(1);
    const finding = result.findings[0];
    expect(finding.severity).toBe('medium');
    expect(finding.title).toContain('Potential race condition');
    expect(finding.title).toContain('concurrent identical requests');
    expect(finding.category).toBe('attack');
    expect(finding.id).toMatch(/^RACE-\d{3}$/);
    expect(finding.owasp).toBe('A04:2021');
    expect(finding.cwe).toBe(362);
  });

  it('sends exactly 5 concurrent requests per endpoint', async () => {
    makeRoute(projectPath, 'app/api/checkout/route.ts', POST_HANDLER);

    fetchSpy.mockResolvedValue({ status: 200 });

    const config = { projectPath, target: 'https://example.com' } as AegisConfig;
    await raceProbeScanner.scan(projectPath, config);

    expect(fetchSpy).toHaveBeenCalledTimes(5);
  });

  it('reports no finding when at least one request returns 409', async () => {
    makeRoute(projectPath, 'app/api/reserve/route.ts', POST_HANDLER);

    let callCount = 0;
    fetchSpy.mockImplementation(() => {
      callCount++;
      return Promise.resolve({ status: callCount >= 3 ? 409 : 200 });
    });

    const config = { projectPath, target: 'https://example.com' } as AegisConfig;
    const result = await raceProbeScanner.scan(projectPath, config);

    expect(result.findings).toHaveLength(0);
  });

  it('reports no finding when at least one request returns 429', async () => {
    makeRoute(projectPath, 'app/api/purchase/route.ts', POST_HANDLER);

    let callCount = 0;
    fetchSpy.mockImplementation(() => {
      callCount++;
      return Promise.resolve({ status: callCount === 5 ? 429 : 200 });
    });

    const config = { projectPath, target: 'https://example.com' } as AegisConfig;
    const result = await raceProbeScanner.scan(projectPath, config);

    expect(result.findings).toHaveLength(0);
  });

  it('reports no finding when requests return 400', async () => {
    makeRoute(projectPath, 'app/api/pay/route.ts', POST_HANDLER);

    // Server correctly rejects the dummy body
    fetchSpy.mockResolvedValue({ status: 400 });

    const config = { projectPath, target: 'https://example.com' } as AegisConfig;
    const result = await raceProbeScanner.scan(projectPath, config);

    expect(result.findings).toHaveLength(0);
  });

  it('discovers all supported race-condition keywords', async () => {
    const keywords = ['book', 'pay', 'redeem', 'claim', 'reserve', 'checkout', 'purchase'];
    for (const kw of keywords) {
      makeRoute(projectPath, `app/api/${kw}/route.ts`, POST_HANDLER);
    }

    fetchSpy.mockResolvedValue({ status: 200 });

    const config = { projectPath, target: 'https://example.com' } as AegisConfig;
    const result = await raceProbeScanner.scan(projectPath, config);

    // Each keyword route gets 5 requests = 7 * 5 = 35
    expect(fetchSpy).toHaveBeenCalledTimes(keywords.length * 5);
    expect(result.findings).toHaveLength(keywords.length);
  });

  it('handles fetch errors without crashing', async () => {
    makeRoute(projectPath, 'app/api/booking/route.ts', POST_HANDLER);

    fetchSpy.mockRejectedValue(new Error('Connection refused'));

    const config = { projectPath, target: 'https://example.com' } as AegisConfig;
    const result = await raceProbeScanner.scan(projectPath, config);

    expect(result.findings).toHaveLength(0);
    expect(result.error).toBeUndefined();
  });

  it('sends POST with Content-Type application/json and dummy body', async () => {
    makeRoute(projectPath, 'app/api/checkout/route.ts', POST_HANDLER);

    fetchSpy.mockResolvedValue({ status: 409 });

    const config = { projectPath, target: 'https://example.com' } as AegisConfig;
    await raceProbeScanner.scan(projectPath, config);

    const firstCall = fetchSpy.mock.calls[0];
    expect(firstCall[1].method).toBe('POST');
    const headers = firstCall[1].headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(firstCall[1].body)).toEqual({ test: true });
  });
});
