import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

vi.mock('@aegis-scan/core', () => {
  const { readdirSync, readFileSync, existsSync, realpathSync, statSync } = require('fs');
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

import { authProbeScanner } from '../../src/attacks/auth-probe.js';
import type { AegisConfig } from '@aegis-scan/core';

function makeTempProject(): string {
  return mkdtempSync(join(tmpdir(), 'aegis-auth-probe-test-'));
}

function makeAdminRoute(projectPath: string, routeRelPath: string, content: string): void {
  const dir = join(projectPath, ...routeRelPath.split('/').slice(0, -1));
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(projectPath, routeRelPath), content);
}

describe('authProbeScanner', () => {
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
    expect(await authProbeScanner.isAvailable(projectPath)).toBe(true);
  });

  it('has correct metadata', () => {
    expect(authProbeScanner.name).toBe('auth-probe');
    expect(authProbeScanner.category).toBe('attack');
  });

  it('returns error when no target provided', async () => {
    const config = { projectPath } as AegisConfig;
    const result = await authProbeScanner.scan(projectPath, config);
    expect(result.error).toContain('No target URL provided');
    expect(result.findings).toHaveLength(0);
  });

  it('reports finding when admin route returns 200 without auth', async () => {
    makeAdminRoute(projectPath, 'app/api/admin/users/route.ts', `
      import { requireRole } from '@/lib/require-role';
      export async function GET() { requireRole('admin'); }
    `);

    fetchSpy.mockResolvedValue({ status: 200 });

    const config = { projectPath, target: 'https://example.com' } as AegisConfig;
    const result = await authProbeScanner.scan(projectPath, config);

    expect(result.findings.length).toBeGreaterThanOrEqual(1);
    const finding = result.findings[0];
    expect(finding.severity).toBe('high');
    expect(finding.title).toContain('Unauthenticated access');
    expect(finding.category).toBe('attack');
    expect(finding.id).toMatch(/^ATK-AUTH-\d{3}$/);
    expect(finding.owasp).toBe('A01:2021');
  });

  it('does not report finding when admin route returns 401', async () => {
    makeAdminRoute(projectPath, 'app/api/admin/settings/route.ts', `
      import { requireRole } from '@/lib/require-role';
      export async function GET() { requireRole('admin'); }
    `);

    fetchSpy.mockResolvedValue({ status: 401 });

    const config = { projectPath, target: 'https://example.com' } as AegisConfig;
    const result = await authProbeScanner.scan(projectPath, config);
    expect(result.findings).toHaveLength(0);
  });

  it('does not probe non-admin routes', async () => {
    makeAdminRoute(projectPath, 'app/api/public/health/route.ts', `
      export async function GET() { return Response.json({ ok: true }); }
    `);

    const config = { projectPath, target: 'https://example.com' } as AegisConfig;
    const result = await authProbeScanner.scan(projectPath, config);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.findings).toHaveLength(0);
  });

  it('handles fetch errors gracefully', async () => {
    makeAdminRoute(projectPath, 'app/api/admin/data/route.ts', `
      requireRole(context, ['admin']);
    `);

    fetchSpy.mockRejectedValue(new Error('Connection refused'));

    const config = { projectPath, target: 'https://example.com' } as AegisConfig;
    const result = await authProbeScanner.scan(projectPath, config);
    expect(result.findings).toHaveLength(0);
    expect(result.error).toBeUndefined();
  });
});
