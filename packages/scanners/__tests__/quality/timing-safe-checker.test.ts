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

import { timingSafeCheckerScanner } from '../../src/quality/timing-safe-checker.js';
import type { AegisConfig } from '@aegis-scan/core';

const MOCK_CONFIG = {} as AegisConfig;

function makeTempProject(): string {
  return mkdtempSync(join(tmpdir(), 'aegis-timing-test-'));
}

function createApiRoute(projectPath: string, subPath: string, content: string): void {
  const routeDir = join(projectPath, 'src', 'app', 'api', subPath);
  mkdirSync(routeDir, { recursive: true });
  writeFileSync(join(routeDir, 'route.ts'), content);
}

describe('timingSafeCheckerScanner', () => {
  let projectPath: string;

  beforeEach(() => {
    projectPath = makeTempProject();
  });

  it('is always available', async () => {
    expect(await timingSafeCheckerScanner.isAvailable(projectPath)).toBe(true);
  });

  it('returns no findings for a project with no api directory', async () => {
    const result = await timingSafeCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.scanner).toBe('timing-safe-checker');
    expect(result.findings).toHaveLength(0);
  });

  it('returns no findings for routes with no secret comparisons', async () => {
    createApiRoute(
      projectPath,
      'health',
      `
      export async function GET() {
        return Response.json({ status: 'ok' });
      }
    `,
    );

    const result = await timingSafeCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
  });

  it('flags === token comparison without timingSafeEqual as MEDIUM', async () => {
    createApiRoute(
      projectPath,
      'cron/daily',
      `
      export async function POST(request: Request) {
        const token = request.headers.get('x-cron-token');
        if (token !== process.env.CRON_TOKEN) {
          return new Response('Unauthorized', { status: 401 });
        }
        return Response.json({ ok: true });
      }
    `,
    );

    const result = await timingSafeCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.scanner === 'timing-safe-checker');
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('medium');
    expect(finding!.id).toBe('TIMING-001');
    expect(finding!.category).toBe('security');
    expect(finding!.owasp).toBe('A02:2021');
    expect(finding!.cwe).toBe(208);
  });

  it('flags === process.env.CRON_SECRET comparison', async () => {
    createApiRoute(
      projectPath,
      'cron/cleanup',
      `
      export async function POST(request: Request) {
        const authHeader = request.headers.get('authorization');
        if (authHeader === process.env.CRON_SECRET) {
          // run job
        }
        return Response.json({ ok: true });
      }
    `,
    );

    const result = await timingSafeCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings.some((f) => f.title.includes('timing'))).toBe(true);
  });

  it('flags headers.get(authorization) === comparison', async () => {
    createApiRoute(
      projectPath,
      'webhooks/stripe',
      `
      export async function POST(request: Request) {
        const apiKey = request.headers.get('authorization');
        if (apiKey !== secret) {
          return new Response('Forbidden', { status: 403 });
        }
        return Response.json({ received: true });
      }
    `,
    );

    const result = await timingSafeCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings.length).toBeGreaterThan(0);
  });

  it('does not flag when timingSafeStringEqual is used', async () => {
    createApiRoute(
      projectPath,
      'cron/daily',
      `
      import { timingSafeStringEqual } from '@/lib/crypto';
      export async function POST(request: Request) {
        const token = request.headers.get('x-cron-token') ?? '';
        if (!timingSafeStringEqual(token, process.env.CRON_SECRET ?? '')) {
          return new Response('Unauthorized', { status: 401 });
        }
        return Response.json({ ok: true });
      }
    `,
    );

    const result = await timingSafeCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
  });

  it('does not flag when crypto.timingSafeEqual is used', async () => {
    createApiRoute(
      projectPath,
      'webhooks/github',
      `
      import crypto from 'crypto';
      export async function POST(request: Request) {
        const sig = request.headers.get('x-hub-signature-256') ?? '';
        const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');
        if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
          return new Response('Bad signature', { status: 401 });
        }
        return Response.json({ ok: true });
      }
    `,
    );

    const result = await timingSafeCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
  });

  it('skips test files', async () => {
    const testDir = join(projectPath, 'src', 'app', 'api', 'cron');
    mkdirSync(testDir, { recursive: true });
    writeFileSync(
      join(testDir, 'route.test.ts'),
      `
      it('should reject invalid token', () => {
        const token = 'abc';
        expect(token !== secret).toBe(true);
      });
    `,
    );

    const result = await timingSafeCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
  });

  it('generates incrementing IDs across multiple vulnerable routes', async () => {
    createApiRoute(projectPath, 'cron/a', `export async function POST(r) { if (token !== secret) return; }`);
    createApiRoute(projectPath, 'cron/b', `export async function POST(r) { if (apiKey !== secret) return; }`);

    const result = await timingSafeCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings.length).toBeGreaterThanOrEqual(2);
    const ids = result.findings.map((f) => f.id);
    expect(ids).toContain('TIMING-001');
    expect(ids).toContain('TIMING-002');
  });

  it('includes duration and available fields in result', async () => {
    const result = await timingSafeCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(typeof result.duration).toBe('number');
    expect(result.available).toBe(true);
  });

  // v0.11 S12 — widen variable-name allowlist to UPPERCASE identifiers
  // with security-suffix (_KEY / _TOKEN / _SECRET / _PASSWORD / _HASH).
  it('v0.11 S12: flags `presented === ADMIN_API_KEY` comparison', async () => {
    createApiRoute(
      projectPath,
      'admin/verify',
      `
      const ADMIN_API_KEY = process.env.ADMIN_API_KEY;
      export async function POST(request) {
        const presented = request.headers.get('x-admin-key') ?? '';
        if (presented === ADMIN_API_KEY) {
          return Response.json({ ok: true });
        }
        return new Response('forbidden', { status: 403 });
      }
    `,
    );
    const result = await timingSafeCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings.length).toBeGreaterThan(0);
    expect(result.findings[0].cwe).toBe(208);
  });

  it('v0.11 S12: flags `process.env.USER_TOKEN === header` comparison', async () => {
    createApiRoute(
      projectPath,
      'user/verify',
      `
      export async function POST(request) {
        const header = request.headers.get('authorization') ?? '';
        if (header === process.env.USER_TOKEN) {
          return Response.json({ ok: true });
        }
        return new Response('no', { status: 401 });
      }
    `,
    );
    const result = await timingSafeCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings.length).toBeGreaterThan(0);
    expect(result.findings[0].cwe).toBe(208);
  });
});
