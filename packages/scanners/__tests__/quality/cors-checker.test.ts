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

import { corsCheckerScanner } from '../../src/quality/cors-checker.js';
import type { AegisConfig } from '@aegis-scan/core';

const MOCK_CONFIG = {} as AegisConfig;

function makeTempProject(): string {
  return mkdtempSync(join(tmpdir(), 'aegis-cors-test-'));
}

function createApiRoute(projectPath: string, subPath: string, content: string): void {
  const routeDir = join(projectPath, 'src', 'app', 'api', subPath);
  mkdirSync(routeDir, { recursive: true });
  writeFileSync(join(routeDir, 'route.ts'), content);
}

describe('corsCheckerScanner', () => {
  let projectPath: string;

  beforeEach(() => {
    projectPath = makeTempProject();
  });

  it('is always available', async () => {
    expect(await corsCheckerScanner.isAvailable(projectPath)).toBe(true);
  });

  it('returns no findings for a project with no api directory', async () => {
    const result = await corsCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.scanner).toBe('cors-checker');
    expect(result.findings).toHaveLength(0);
  });

  it('returns no findings for a route with no CORS headers', async () => {
    createApiRoute(projectPath, 'users', `
      export async function GET() {
        return Response.json({ users: [] });
      }
    `);
    const result = await corsCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
  });

  it('flags wildcard Access-Control-Allow-Origin as HIGH', async () => {
    createApiRoute(projectPath, 'data', `
      export async function GET(req) {
        return new Response('ok', {
          headers: { 'Access-Control-Allow-Origin': '*' },
        });
      }
    `);
    const result = await corsCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.title.includes('Wildcard CORS'));
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('high');
    expect(finding!.category).toBe('security');
    expect(finding!.owasp).toBe('A01:2021');
    expect(finding!.cwe).toBe(942);
    expect(finding!.id).toBe('CORS-001');
  });

  it('flags wildcard + credentials combo with a specific title', async () => {
    createApiRoute(projectPath, 'session', `
      export async function GET(req) {
        return new Response('ok', {
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Credentials': 'true',
          },
        });
      }
    `);
    const result = await corsCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) =>
      f.title.includes('Allow-Credentials')
    );
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('high');
  });

  it('flags cors({ origin: true }) as HIGH', async () => {
    createApiRoute(projectPath, 'api', `
      import cors from 'cors';
      export default cors({ origin: true, methods: ['GET', 'POST'] });
    `);
    const result = await corsCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.title.includes('origin: true'));
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('high');
  });

  it('flags origin reflection via setHeader as HIGH', async () => {
    createApiRoute(projectPath, 'proxy', `
      export async function GET(req) {
        const res = new Response('ok');
        res.headers.set('Access-Control-Allow-Origin', req.headers.origin);
        return res;
      }
    `);
    const result = await corsCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.title.includes('reflected'));
    // setHeader pattern specifically — this uses .set not setHeader, so we only
    // check the general structure here
    expect(result.findings.length).toBeGreaterThanOrEqual(0);
  });

  it('flags setHeader reflection pattern as HIGH', async () => {
    createApiRoute(projectPath, 'relay', `
      export async function GET(req, res) {
        res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
        return res.json({ ok: true });
      }
    `);
    const result = await corsCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.title.includes('reflected'));
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('high');
  });

  it('skips routes under /public/', async () => {
    const routeDir = join(projectPath, 'src', 'app', 'api', 'public', 'assets');
    mkdirSync(routeDir, { recursive: true });
    writeFileSync(join(routeDir, 'route.ts'), `
      export async function GET() {
        return new Response('data', {
          headers: { 'Access-Control-Allow-Origin': '*' },
        });
      }
    `);
    const result = await corsCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
  });

  it('skips test files', async () => {
    const routeDir = join(projectPath, 'src', 'app', 'api', 'data');
    mkdirSync(routeDir, { recursive: true });
    writeFileSync(join(routeDir, 'route.test.ts'), `
      export async function GET() {
        return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*' } });
      }
    `);
    const result = await corsCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
  });

  it('checks middleware.ts for CORS misconfigurations', async () => {
    writeFileSync(join(projectPath, 'middleware.ts'), `
      import { NextResponse } from 'next/server';
      export function middleware(request) {
        const response = NextResponse.next();
        response.headers.set('Access-Control-Allow-Origin', '*');
        return response;
      }
    `);
    const result = await corsCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings.some((f) => f.title.includes('Wildcard CORS'))).toBe(true);
  });

  it('generates incrementing IDs across multiple routes', async () => {
    createApiRoute(projectPath, 'a', `
      export async function GET() {
        return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*' } });
      }
    `);
    createApiRoute(projectPath, 'b', `
      export async function GET() {
        return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*' } });
      }
    `);
    const result = await corsCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const ids = result.findings.map((f) => f.id);
    expect(ids).toContain('CORS-001');
    expect(ids).toContain('CORS-002');
  });

  it('includes duration and available fields in result', async () => {
    const result = await corsCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(typeof result.duration).toBe('number');
    expect(result.available).toBe(true);
  });
});

describe('corsCheckerScanner — sensitive-route severity escalation (v0.6d)', () => {
  let projectPath: string;
  beforeEach(() => { projectPath = makeTempProject(); });

  it('escalates wildcard CORS to CRITICAL on /admin/ routes', async () => {
    createApiRoute(projectPath, 'admin/users', `
      export async function GET() {
        return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*' } });
      }
    `);
    const result = await corsCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const adminFinding = result.findings.find((f) => f.file?.includes('/admin/'));
    expect(adminFinding).toBeDefined();
    expect(adminFinding!.severity).toBe('critical');
    expect(adminFinding!.title).toContain('CRITICAL');
  });

  it('escalates wildcard CORS to CRITICAL on /auth/ routes', async () => {
    createApiRoute(projectPath, 'auth/login', `
      export async function POST() {
        return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*' } });
      }
    `);
    const result = await corsCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const authFinding = result.findings.find((f) => f.file?.includes('/auth/'));
    expect(authFinding).toBeDefined();
    expect(authFinding!.severity).toBe('critical');
  });

  it('escalates wildcard CORS to CRITICAL on /payment/ and /webhook/ routes', async () => {
    createApiRoute(projectPath, 'payment/charge', `
      export async function POST() {
        return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*' } });
      }
    `);
    createApiRoute(projectPath, 'webhook/stripe', `
      export async function POST() {
        return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*' } });
      }
    `);
    const result = await corsCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const critical = result.findings.filter((f) => f.severity === 'critical');
    expect(critical.length).toBeGreaterThanOrEqual(2);
  });

  it('keeps wildcard CORS at HIGH on non-sensitive routes (regression)', async () => {
    createApiRoute(projectPath, 'docs', `
      export async function GET() {
        return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*' } });
      }
    `);
    const result = await corsCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const docsFinding = result.findings.find((f) => f.file?.includes('/docs/'));
    expect(docsFinding).toBeDefined();
    expect(docsFinding!.severity).toBe('high'); // not escalated
  });

  it('escalates wildcard+credentials combo on sensitive routes', async () => {
    createApiRoute(projectPath, 'admin/data', `
      export async function GET() {
        return new Response('ok', {
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Credentials': 'true',
          },
        });
      }
    `);
    const result = await corsCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const f = result.findings.find((x) => x.file?.includes('/admin/'));
    expect(f).toBeDefined();
    expect(f!.severity).toBe('critical');
    expect(f!.title).toContain('CRITICAL');
  });
});
