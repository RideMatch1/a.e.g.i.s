import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

vi.mock('@aegis-scan/core', () => {
  const { readdirSync, readFileSync, statSync } = require('fs');
  const { join } = require('path');

  function walkFilesSync(dir: string, ignore: string[], exts: string[]): string[] {
    const results: string[] = [];
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return results;
    }
    for (const entry of entries) {
      if (ignore.includes(entry)) continue;
      const full = join(dir, entry);
      try {
        const stat = statSync(full);
        if (stat.isDirectory()) {
          results.push(...walkFilesSync(full, ignore, exts));
        } else {
          const ext = entry.split('.').pop() ?? '';
          if (exts.includes(ext)) results.push(full);
        }
      } catch {
        // skip
      }
    }
    return results;
  }

  return {
    walkFiles: (dir: string, ignore: string[], exts: string[]) =>
      walkFilesSync(dir, ignore, exts),
    readFileSafe: (path: string) => {
      try {
        return readFileSync(path, 'utf-8');
      } catch {
        return null;
      }
    },
    commandExists: async () => true,
    exec: async () => ({ stdout: '', stderr: '', exitCode: 0 }),
  };
});

import { csrfCheckerScanner } from '../../src/quality/csrf-checker.js';
import type { AegisConfig } from '@aegis-scan/core';

const MOCK_CONFIG = {} as AegisConfig;

function makeTempProject(): string {
  return mkdtempSync(join(tmpdir(), 'aegis-csrf-test-'));
}

function createApiRoute(projectPath: string, subPath: string, content: string): void {
  const routeDir = join(projectPath, 'src', 'app', 'api', subPath);
  mkdirSync(routeDir, { recursive: true });
  writeFileSync(join(routeDir, 'route.ts'), content);
}

describe('csrfCheckerScanner', () => {
  let projectPath: string;

  beforeEach(() => {
    projectPath = makeTempProject();
  });

  it('is always available', async () => {
    expect(await csrfCheckerScanner.isAvailable(projectPath)).toBe(true);
  });

  it('returns no findings for a project with no api directory', async () => {
    const result = await csrfCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.scanner).toBe('csrf-checker');
    expect(result.findings).toHaveLength(0);
  });

  it('flags a POST handler with no CSRF protection as HIGH', async () => {
    createApiRoute(
      projectPath,
      'bookings',
      `
      import { NextResponse } from 'next/server';
      export async function POST(request: Request) {
        const body = await request.json();
        return NextResponse.json({ ok: true });
      }
    `,
    );

    const result = await csrfCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings).toHaveLength(1);
    const finding = result.findings[0];
    expect(finding.severity).toBe('high');
    expect(finding.id).toBe('CSRF-001');
    expect(finding.category).toBe('security');
    expect(finding.owasp).toBe('A01:2021');
    expect(finding.cwe).toBe(352);
    expect(finding.file).toContain('route.ts');
  });

  it('flags PUT, PATCH and DELETE handlers too', async () => {
    createApiRoute(
      projectPath,
      'items',
      `
      export async function PUT(request: Request) {
        return Response.json({ ok: true });
      }
      export async function PATCH(request: Request) {
        return Response.json({ ok: true });
      }
      export async function DELETE(request: Request) {
        return Response.json({ ok: true });
      }
    `,
    );

    const result = await csrfCheckerScanner.scan(projectPath, MOCK_CONFIG);
    // One finding per file (file-level check)
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].severity).toBe('high');
  });

  it('does NOT flag a route with Origin header check', async () => {
    createApiRoute(
      projectPath,
      'orders',
      `
      export async function POST(request: Request) {
        const origin = request.headers.get('origin');
        if (origin !== process.env.ALLOWED_ORIGIN) return new Response(null, { status: 403 });
        return Response.json({ ok: true });
      }
    `,
    );

    const result = await csrfCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
  });

  it('does NOT flag a route using secureApiRouteWithTenant', async () => {
    createApiRoute(
      projectPath,
      'bookings/create',
      `
      import { secureApiRouteWithTenant } from '@/lib/api/tenant-guard';
      export async function POST(request: Request) {
        const { context } = await secureApiRouteWithTenant(request, { requireAuth: true });
        return Response.json({ ok: true });
      }
    `,
    );

    const result = await csrfCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
  });

  it('does NOT flag a route that checks Content-Type: application/json', async () => {
    createApiRoute(
      projectPath,
      'api-v2/data',
      `
      export async function POST(request: Request) {
        const ct = request.headers.get('Content-Type');
        if (!ct?.includes('application/json')) return new Response(null, { status: 415 });
        return Response.json({ ok: true });
      }
    `,
    );

    const result = await csrfCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
  });

  it('does NOT flag GET-only routes', async () => {
    createApiRoute(
      projectPath,
      'listings',
      `
      export async function GET() {
        return Response.json({ data: [] });
      }
    `,
    );

    const result = await csrfCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
  });

  it('skips /webhook/ routes', async () => {
    const dir = join(projectPath, 'src', 'app', 'api', 'webhook', 'stripe');
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, 'route.ts'),
      `
      export async function POST(request: Request) {
        return Response.json({ received: true });
      }
    `,
    );

    const result = await csrfCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
  });

  it('skips /auth/ routes', async () => {
    const dir = join(projectPath, 'src', 'app', 'api', 'auth', 'callback');
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, 'route.ts'),
      `
      export async function POST(request: Request) {
        return Response.json({ ok: true });
      }
    `,
    );

    const result = await csrfCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
  });

  it('skips /cron/ routes', async () => {
    const dir = join(projectPath, 'src', 'app', 'api', 'cron', 'cleanup');
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, 'route.ts'),
      `
      export async function POST(request: Request) {
        return Response.json({ ok: true });
      }
    `,
    );

    const result = await csrfCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
  });

  it('generates incrementing IDs across multiple unprotected routes', async () => {
    createApiRoute(
      projectPath,
      'a',
      `export async function POST() { return Response.json({}); }`,
    );
    createApiRoute(
      projectPath,
      'b',
      `export async function PUT() { return Response.json({}); }`,
    );

    const result = await csrfCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings.length).toBeGreaterThanOrEqual(2);
    const ids = result.findings.map((f) => f.id);
    expect(ids).toContain('CSRF-001');
    expect(ids).toContain('CSRF-002');
  });

  it('includes duration and available fields in result', async () => {
    const result = await csrfCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(typeof result.duration).toBe('number');
    expect(result.available).toBe(true);
  });

  it('does NOT flag a route with SameSite cookie', async () => {
    createApiRoute(
      projectPath,
      'sessions',
      `
      export async function POST(request: Request) {
        const response = Response.json({ ok: true });
        response.headers.set('Set-Cookie', 'session=abc; SameSite=Strict; HttpOnly');
        return response;
      }
    `,
    );

    const result = await csrfCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
  });
});
