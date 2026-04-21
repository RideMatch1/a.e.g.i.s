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

import { zodEnforcerScanner } from '../../src/quality/zod-enforcer.js';
import type { AegisConfig } from '@aegis-scan/core';

const MOCK_CONFIG = {} as AegisConfig;

function makeTempProject(): string {
  return mkdtempSync(join(tmpdir(), 'aegis-zod-test-'));
}

function createApiRoute(projectPath: string, subPath: string, content: string): void {
  const routeDir = join(projectPath, 'src', 'app', 'api', subPath);
  mkdirSync(routeDir, { recursive: true });
  writeFileSync(join(routeDir, 'route.ts'), content);
}

describe('zodEnforcerScanner', () => {
  let projectPath: string;

  beforeEach(() => {
    projectPath = makeTempProject();
  });

  it('is always available', async () => {
    expect(await zodEnforcerScanner.isAvailable(projectPath)).toBe(true);
  });

  it('returns no findings for a project with no api directory', async () => {
    const result = await zodEnforcerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.scanner).toBe('zod-enforcer');
    expect(result.findings).toHaveLength(0);
  });

  it('returns no findings for GET-only routes', async () => {
    createApiRoute(
      projectPath,
      'users',
      `
      export async function GET() {
        return Response.json({ users: [] });
      }
    `,
    );

    const result = await zodEnforcerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
  });

  it('flags POST route without Zod as HIGH', async () => {
    createApiRoute(
      projectPath,
      'bookings',
      `
      export async function POST(request) {
        const body = await request.json();
        return Response.json({ ok: true });
      }
    `,
    );

    const result = await zodEnforcerScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.title.includes('missing Zod'));
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('high');
    expect(finding!.category).toBe('security');
    expect(finding!.id).toBe('ZOD-001');
  });

  it('flags PUT route without Zod as HIGH', async () => {
    createApiRoute(
      projectPath,
      'settings',
      `
      export async function PUT(request) {
        const body = await request.json();
        return Response.json({ ok: true });
      }
    `,
    );

    const result = await zodEnforcerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings.some((f) => f.title.includes('missing Zod'))).toBe(true);
  });

  it('flags PATCH route without Zod as HIGH', async () => {
    createApiRoute(
      projectPath,
      'profile',
      `
      export async function PATCH(request) {
        const body = await request.json();
        return Response.json({ ok: true });
      }
    `,
    );

    const result = await zodEnforcerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings.some((f) => f.title.includes('missing Zod'))).toBe(true);
  });

  it('does NOT flag DELETE route (no body by convention)', async () => {
    createApiRoute(
      projectPath,
      'items',
      `
      export async function DELETE(request) {
        const id = request.nextUrl.searchParams.get('id');
        return Response.json({ ok: true });
      }
    `,
    );

    const result = await zodEnforcerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings.some((f) => f.title.includes('missing Zod'))).toBe(false);
  });

  it('does not flag route with Zod import and .parse()', async () => {
    createApiRoute(
      projectPath,
      'bookings',
      `
      import { z } from 'zod';
      const schema = z.object({ name: z.string() }).strict();
      export async function POST(request) {
        const body = schema.parse(await request.json());
        return Response.json({ ok: true });
      }
    `,
    );

    const result = await zodEnforcerScanner.scan(projectPath, MOCK_CONFIG);
    // No "missing Zod" finding (may still have .strict() findings)
    const missingZod = result.findings.find((f) => f.title.includes('missing Zod'));
    expect(missingZod).toBeUndefined();
  });

  it('does not flag route with Zod import and .safeParse()', async () => {
    createApiRoute(
      projectPath,
      'orders',
      `
      import { z } from 'zod';
      const schema = z.object({ qty: z.number() }).strict();
      export async function POST(request) {
        const result = schema.safeParse(await request.json());
        if (!result.success) return Response.json({ error: 'Invalid' }, { status: 400 });
        return Response.json({ ok: true });
      }
    `,
    );

    const result = await zodEnforcerScanner.scan(projectPath, MOCK_CONFIG);
    const missingZod = result.findings.find((f) => f.title.includes('missing Zod'));
    expect(missingZod).toBeUndefined();
  });

  it('flags z.object without .strict() as MEDIUM', async () => {
    createApiRoute(
      projectPath,
      'tasks',
      `
      import { z } from 'zod';
      const schema = z.object({ title: z.string() });
      export async function POST(request) {
        const body = schema.parse(await request.json());
        return Response.json({ ok: true });
      }
    `,
    );

    const result = await zodEnforcerScanner.scan(projectPath, MOCK_CONFIG);
    const strictFinding = result.findings.find((f) => f.title.includes('.strict()'));
    expect(strictFinding).toBeDefined();
    expect(strictFinding!.severity).toBe('medium');
  });

  it('does not flag z.object with .strict()', async () => {
    createApiRoute(
      projectPath,
      'events',
      `
      import { z } from 'zod';
      const schema = z.object({ name: z.string() }).strict();
      export async function POST(request) {
        const body = schema.parse(await request.json());
        return Response.json({ ok: true });
      }
    `,
    );

    const result = await zodEnforcerScanner.scan(projectPath, MOCK_CONFIG);
    const strictFinding = result.findings.find((f) => f.title.includes('.strict()'));
    expect(strictFinding).toBeUndefined();
  });

  it('generates incrementing IDs across multiple routes', async () => {
    createApiRoute(projectPath, 'a', `export async function POST(r) {}`);
    createApiRoute(projectPath, 'b', `export async function PUT(r) {}`);

    const result = await zodEnforcerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings.length).toBeGreaterThanOrEqual(2);
    const ids = result.findings.map((f) => f.id);
    expect(ids).toContain('ZOD-001');
    expect(ids).toContain('ZOD-002');
  });

  it('includes duration and available fields in result', async () => {
    const result = await zodEnforcerScanner.scan(projectPath, MOCK_CONFIG);
    expect(typeof result.duration).toBe('number');
    expect(result.available).toBe(true);
  });
});
