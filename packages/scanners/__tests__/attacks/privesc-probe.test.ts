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
    isTestFile: (filePath) => /\.(test|spec|e2e)\.(ts|tsx|js|jsx|mjs|cjs)$/.test(filePath) || /[\/\\]__tests__[\/\\]/.test(filePath) || /[\/\\]__mocks__[\/\\]/.test(filePath) || /[\/\\](playwright|cypress|e2e)[\/\\]/.test(filePath),

  };
});

import { privescProbeScanner } from '../../src/attacks/privesc-probe.js';
import type { AegisConfig } from '@aegis-scan/core';

function makeTempProject(): string {
  return mkdtempSync(join(tmpdir(), 'aegis-privesc-probe-test-'));
}

function makeAdminRoute(projectPath: string, routeRelPath: string, content: string): void {
  const dir = join(projectPath, ...routeRelPath.split('/').slice(0, -1));
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(projectPath, routeRelPath), content);
}

const ADMIN_GET_HANDLER = 'export async function GET() {}';

describe('privescProbeScanner', () => {
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
    expect(await privescProbeScanner.isAvailable(projectPath)).toBe(true);
  });

  it('has correct metadata', () => {
    expect(privescProbeScanner.name).toBe('privesc-probe');
    expect(privescProbeScanner.category).toBe('attack');
  });

  it('returns error when no target provided', async () => {
    const config = { projectPath } as AegisConfig;
    const result = await privescProbeScanner.scan(projectPath, config);
    expect(result.error).toContain('No target URL provided');
    expect(result.findings).toHaveLength(0);
  });

  it('makes no requests when project has no /admin/ routes', async () => {
    // Non-admin route — should not be probed
    makeAdminRoute(projectPath, 'app/api/public/health/route.ts', ADMIN_GET_HANDLER);

    const config = { projectPath, target: 'https://example.com' } as AegisConfig;
    const result = await privescProbeScanner.scan(projectPath, config);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.findings).toHaveLength(0);
  });

  it('makes no requests when admin route has no HTTP handler export', async () => {
    // File exists under /admin/ but exports no method
    makeAdminRoute(projectPath, 'app/api/admin/helpers/route.ts', 'function helper() {}');

    const config = { projectPath, target: 'https://example.com' } as AegisConfig;
    const result = await privescProbeScanner.scan(projectPath, config);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.findings).toHaveLength(0);
  });

  it('reports HIGH finding when admin route returns 200 with fake staff JWT', async () => {
    makeAdminRoute(projectPath, 'app/api/admin/users/route.ts', ADMIN_GET_HANDLER);

    fetchSpy.mockResolvedValue({ status: 200 });

    const config = { projectPath, target: 'https://example.com' } as AegisConfig;
    const result = await privescProbeScanner.scan(projectPath, config);

    expect(result.findings.length).toBeGreaterThanOrEqual(1);
    const finding = result.findings[0];
    expect(finding.severity).toBe('high');
    expect(finding.title).toContain('Potential privilege escalation');
    expect(finding.title).toContain('staff token');
    expect(finding.category).toBe('attack');
    expect(finding.id).toMatch(/^PRIVESC-\d{3}$/);
    expect(finding.owasp).toBe('A01:2021');
    expect(finding.cwe).toBe(269);
  });

  it('sends the fake staff JWT in the Authorization header', async () => {
    makeAdminRoute(projectPath, 'app/api/admin/settings/route.ts', ADMIN_GET_HANDLER);

    fetchSpy.mockResolvedValue({ status: 403 });

    const config = { projectPath, target: 'https://example.com' } as AegisConfig;
    await privescProbeScanner.scan(projectPath, config);

    const firstCall = fetchSpy.mock.calls[0];
    const headers = firstCall[1].headers as Record<string, string>;
    expect(headers['Authorization']).toMatch(/^Bearer eyJhbGciOiJIUzI1NiJ9\./);
  });

  it('reports CRITICAL finding when admin route returns 200 with no auth at all', async () => {
    makeAdminRoute(projectPath, 'app/api/admin/reports/route.ts', ADMIN_GET_HANDLER);

    // First request (staff JWT) → 403, second request (no auth) → 200
    let callCount = 0;
    fetchSpy.mockImplementation(() => {
      callCount++;
      return Promise.resolve({ status: callCount === 1 ? 403 : 200 });
    });

    const config = { projectPath, target: 'https://example.com' } as AegisConfig;
    const result = await privescProbeScanner.scan(projectPath, config);

    expect(result.findings.length).toBeGreaterThanOrEqual(1);
    const critical = result.findings.find((f) => f.severity === 'critical');
    expect(critical).toBeDefined();
    expect(critical!.title).toContain('Unauthenticated admin route');
    expect(critical!.id).toMatch(/^PRIVESC-\d{3}$/);
    expect(critical!.owasp).toBe('A01:2021');
    expect(critical!.cwe).toBe(269);
  });

  it('reports no finding when admin route returns 403 for both requests', async () => {
    makeAdminRoute(projectPath, 'app/api/admin/data/route.ts', ADMIN_GET_HANDLER);

    fetchSpy.mockResolvedValue({ status: 403 });

    const config = { projectPath, target: 'https://example.com' } as AegisConfig;
    const result = await privescProbeScanner.scan(projectPath, config);

    expect(result.findings).toHaveLength(0);
  });

  it('reports only HIGH (not CRITICAL) when staff JWT request already returns 200', async () => {
    makeAdminRoute(projectPath, 'app/api/admin/config/route.ts', ADMIN_GET_HANDLER);

    // Staff JWT → 200 immediately; should not also do the no-auth check
    fetchSpy.mockResolvedValue({ status: 200 });

    const config = { projectPath, target: 'https://example.com' } as AegisConfig;
    const result = await privescProbeScanner.scan(projectPath, config);

    // Should have exactly 1 finding (HIGH), not 2
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].severity).toBe('high');
    // Should have made only 1 fetch call (the staff JWT one; no-auth check skipped)
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('handles fetch errors without crashing', async () => {
    makeAdminRoute(projectPath, 'app/api/admin/users/route.ts', ADMIN_GET_HANDLER);

    fetchSpy.mockRejectedValue(new Error('Connection refused'));

    const config = { projectPath, target: 'https://example.com' } as AegisConfig;
    const result = await privescProbeScanner.scan(projectPath, config);

    expect(result.findings).toHaveLength(0);
    expect(result.error).toBeUndefined();
  });

  it('discovers routes with various HTTP methods', async () => {
    makeAdminRoute(
      projectPath,
      'app/api/admin/tenants/route.ts',
      'export async function POST() {}',
    );

    fetchSpy.mockResolvedValue({ status: 401 });

    const config = { projectPath, target: 'https://example.com' } as AegisConfig;
    const result = await privescProbeScanner.scan(projectPath, config);

    // Should have probed — route exports POST which matches the handler regex
    expect(fetchSpy).toHaveBeenCalled();
    expect(result.findings).toHaveLength(0);
  });
});
