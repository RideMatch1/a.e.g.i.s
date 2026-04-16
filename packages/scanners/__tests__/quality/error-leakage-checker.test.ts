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

import { errorLeakageCheckerScanner } from '../../src/quality/error-leakage-checker.js';
import type { AegisConfig } from '@aegis-scan/core';

const MOCK_CONFIG = {} as AegisConfig;

function makeTempProject(): string {
  return mkdtempSync(join(tmpdir(), 'aegis-leakage-test-'));
}

function createApiRoute(projectPath: string, subPath: string, content: string): void {
  const routeDir = join(projectPath, 'src', 'app', 'api', subPath);
  mkdirSync(routeDir, { recursive: true });
  writeFileSync(join(routeDir, 'route.ts'), content);
}

describe('errorLeakageCheckerScanner', () => {
  let projectPath: string;

  beforeEach(() => {
    projectPath = makeTempProject();
  });

  it('is always available', async () => {
    expect(await errorLeakageCheckerScanner.isAvailable(projectPath)).toBe(true);
  });

  it('returns no findings for a project with no api directory', async () => {
    const result = await errorLeakageCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.scanner).toBe('error-leakage-checker');
    expect(result.findings).toHaveLength(0);
  });

  it('returns no findings for a route with only safe error handling', async () => {
    createApiRoute(
      projectPath,
      'bookings',
      `
      export async function GET() {
        try {
          return Response.json({ data: [] });
        } catch {
          return Response.json({ error: 'Internal Server Error' }, { status: 500 });
        }
      }
    `,
    );

    const result = await errorLeakageCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
  });

  it('flags error.message leakage as HIGH', async () => {
    createApiRoute(
      projectPath,
      'bookings',
      `
      export async function POST(request: Request) {
        try {
          const data = await request.json();
          return Response.json({ ok: true });
        } catch (error) {
          return Response.json({ error: error.message }, { status: 500 });
        }
      }
    `,
    );

    const result = await errorLeakageCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.scanner === 'error-leakage-checker');
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('high');
    expect(finding!.id).toBe('LEAK-001');
    expect(finding!.category).toBe('security');
    expect(finding!.owasp).toBe('A04:2021');
    expect(finding!.cwe).toBe(209);
  });

  it('flags err.message in json response', async () => {
    createApiRoute(
      projectPath,
      'users',
      `
      export async function DELETE(request: Request) {
        try {
          await deleteUser(id);
          return Response.json({ ok: true });
        } catch (err) {
          return Response.json({ error: err.message }, { status: 500 });
        }
      }
    `,
    );

    const result = await errorLeakageCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings.some((f) => f.title.includes('error detail'))).toBe(true);
  });

  it('flags e.message (short variable name) leakage', async () => {
    createApiRoute(
      projectPath,
      'payments',
      `
      export async function POST(req: Request) {
        try {
          await processPayment();
        } catch (e) {
          return Response.json({ message: e.message }, { status: 500 });
        }
      }
    `,
    );

    const result = await errorLeakageCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings.length).toBeGreaterThan(0);
  });

  it('flags JSON.stringify(error) in response context', async () => {
    createApiRoute(
      projectPath,
      'webhooks',
      `
      export async function POST(request: Request) {
        try {
          await processWebhook();
        } catch (error) {
          return new Response(JSON.stringify(error), { status: 500 });
        }
      }
    `,
    );

    const result = await errorLeakageCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings.length).toBeGreaterThan(0);
  });

  it('skips lines containing "Internal Server Error"', async () => {
    createApiRoute(
      projectPath,
      'safe-route',
      `
      export async function GET() {
        try {
          return Response.json({ data: [] });
        } catch (error) {
          return Response.json({ error: 'Internal Server Error' }, { status: 500 });
        }
      }
    `,
    );

    const result = await errorLeakageCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
  });

  it('skips lines containing "Nicht autorisiert"', async () => {
    createApiRoute(
      projectPath,
      'auth-route',
      `
      export async function GET() {
        try {
          return Response.json({ data: [] });
        } catch (error) {
          return Response.json({ error: 'Nicht autorisiert' }, { status: 401 });
        }
      }
    `,
    );

    const result = await errorLeakageCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
  });

  it('still flags a file that has BOTH safe and unsafe error handling', async () => {
    createApiRoute(
      projectPath,
      'mixed-route',
      `
      export async function GET() {
        try {
          return Response.json({ data: [] });
        } catch (error) {
          return Response.json({ error: 'Internal Server Error' }, { status: 500 });
        }
      }
      export async function POST(request: Request) {
        try {
          await doSomething();
        } catch (error) {
          return Response.json({ error: error.message }, { status: 500 });
        }
      }
    `,
    );

    const result = await errorLeakageCheckerScanner.scan(projectPath, MOCK_CONFIG);
    // Should catch the unsafe POST handler, not the safe GET handler
    expect(result.findings.length).toBeGreaterThan(0);
  });

  it('generates incrementing IDs across multiple routes with leakage', async () => {
    createApiRoute(projectPath, 'a', `export async function GET() { try {} catch (err) { return Response.json({ error: err.message }); } }`);
    createApiRoute(projectPath, 'b', `export async function GET() { try {} catch (e) { return Response.json({ message: e.message }); } }`);

    const result = await errorLeakageCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings.length).toBeGreaterThanOrEqual(2);
    const ids = result.findings.map((f) => f.id);
    expect(ids).toContain('LEAK-001');
    expect(ids).toContain('LEAK-002');
  });

  it('reports the correct line number of the leakage', async () => {
    createApiRoute(
      projectPath,
      'with-lines',
      `export async function GET() {
  try {
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}`,
    );

    const result = await errorLeakageCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings.length).toBeGreaterThan(0);
    expect(result.findings[0].line).toBeGreaterThan(1);
  });

  it('includes duration and available fields in result', async () => {
    const result = await errorLeakageCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(typeof result.duration).toBe('number');
    expect(result.available).toBe(true);
  });
});
