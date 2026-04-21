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
    isTestFile: (filePath) => /\.(test|spec|e2e)\.(ts|tsx|js|jsx|mjs|cjs)$/.test(filePath) || /[\/\\]__tests__[\/\\]/.test(filePath) || /[\/\\]__mocks__[\/\\]/.test(filePath) || /[\/\\](playwright|cypress|e2e)[\/\\]/.test(filePath),

  };
});

import { rateLimitCheckerScanner } from '../../src/quality/rate-limit-checker.js';
import type { AegisConfig } from '@aegis-scan/core';

const MOCK_CONFIG = {} as AegisConfig;

function makeTempProject(): string {
  return mkdtempSync(join(tmpdir(), 'aegis-ratelimit-test-'));
}

function createApiRoute(projectPath: string, subPath: string, content: string): void {
  const routeDir = join(projectPath, 'src', 'app', 'api', subPath);
  mkdirSync(routeDir, { recursive: true });
  writeFileSync(join(routeDir, 'route.ts'), content);
}

describe('rateLimitCheckerScanner', () => {
  let projectPath: string;

  beforeEach(() => {
    projectPath = makeTempProject();
  });

  it('is always available', async () => {
    expect(await rateLimitCheckerScanner.isAvailable(projectPath)).toBe(true);
  });

  it('returns no findings for a project with no api directory', async () => {
    const result = await rateLimitCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.scanner).toBe('rate-limit-checker');
    expect(result.findings).toHaveLength(0);
  });

  it('returns no findings for non-sensitive routes', async () => {
    createApiRoute(
      projectPath,
      'users',
      `
      export async function GET() {
        return Response.json({ users: [] });
      }
    `,
    );

    const result = await rateLimitCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
  });

  it('flags auth route without rate limiting as HIGH', async () => {
    createApiRoute(
      projectPath,
      'auth/login',
      `
      export async function POST(request) {
        const { email, password } = await request.json();
        return Response.json({ token: 'abc' });
      }
    `,
    );

    const result = await rateLimitCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.title.includes('rate limiting'));
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('high');
    expect(finding!.category).toBe('security');
    expect(finding!.id).toBe('RATE-001');
  });

  it('flags payment route without rate limiting', async () => {
    createApiRoute(
      projectPath,
      'payment/charge',
      `
      export async function POST(request) {
        return Response.json({ ok: true });
      }
    `,
    );

    const result = await rateLimitCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings.some((f) => f.title.includes('rate limiting'))).toBe(true);
  });

  it('flags admin route without rate limiting', async () => {
    createApiRoute(
      projectPath,
      'admin/users',
      `
      export async function GET() {
        return Response.json({ users: [] });
      }
    `,
    );

    const result = await rateLimitCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings.some((f) => f.title.includes('rate limiting'))).toBe(true);
  });

  it('flags export route without rate limiting', async () => {
    createApiRoute(
      projectPath,
      'export/csv',
      `
      export async function GET() {
        return new Response('csv data');
      }
    `,
    );

    const result = await rateLimitCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings.some((f) => f.title.includes('rate limiting'))).toBe(true);
  });

  it('does not flag auth route with checkIPRateLimit', async () => {
    createApiRoute(
      projectPath,
      'auth/login',
      `
      import { checkIPRateLimit } from '@/lib/rate-limit';
      export async function POST(request) {
        await checkIPRateLimit(request);
        return Response.json({ token: 'abc' });
      }
    `,
    );

    const result = await rateLimitCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
  });

  it('does not flag admin route with rateLimit', async () => {
    createApiRoute(
      projectPath,
      'admin/settings',
      `
      import { rateLimit } from '@/lib/rate-limit';
      export async function POST(request) {
        await rateLimit(request);
        return Response.json({ ok: true });
      }
    `,
    );

    const result = await rateLimitCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
  });

  it('does not flag route with throttle', async () => {
    createApiRoute(
      projectPath,
      'auth/register',
      `
      import { throttle } from '@/lib/middleware';
      export async function POST(request) {
        throttle(request);
        return Response.json({ ok: true });
      }
    `,
    );

    const result = await rateLimitCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
  });

  it('does not flag route with limiter', async () => {
    createApiRoute(
      projectPath,
      'payment/checkout',
      `
      import { limiter } from '@/lib/security';
      export async function POST(request) {
        await limiter.check(request);
        return Response.json({ ok: true });
      }
    `,
    );

    const result = await rateLimitCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
  });

  it('generates incrementing IDs across multiple routes', async () => {
    createApiRoute(projectPath, 'auth/login', `export async function POST(r) {}`);
    createApiRoute(projectPath, 'admin/users', `export async function GET() {}`);

    const result = await rateLimitCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings.length).toBeGreaterThanOrEqual(2);
    const ids = result.findings.map((f) => f.id);
    expect(ids).toContain('RATE-001');
    expect(ids).toContain('RATE-002');
  });

  it('includes duration and available fields in result', async () => {
    const result = await rateLimitCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(typeof result.duration).toBe('number');
    expect(result.available).toBe(true);
  });
});
