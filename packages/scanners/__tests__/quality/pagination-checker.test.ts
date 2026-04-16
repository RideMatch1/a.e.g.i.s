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

import { paginationCheckerScanner } from '../../src/quality/pagination-checker.js';
import type { AegisConfig } from '@aegis-scan/core';

const MOCK_CONFIG = {} as AegisConfig;

function makeTempProject(): string {
  return mkdtempSync(join(tmpdir(), 'aegis-pagination-test-'));
}

function createApiRoute(projectPath: string, subPath: string, content: string): void {
  const routeDir = join(projectPath, 'src', 'app', 'api', subPath);
  mkdirSync(routeDir, { recursive: true });
  writeFileSync(join(routeDir, 'route.ts'), content);
}

describe('paginationCheckerScanner', () => {
  let projectPath: string;

  beforeEach(() => {
    projectPath = makeTempProject();
  });

  it('is always available', async () => {
    expect(await paginationCheckerScanner.isAvailable(projectPath)).toBe(true);
  });

  it('returns no findings for a project with no api directory', async () => {
    const result = await paginationCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.scanner).toBe('pagination-checker');
    expect(result.findings).toHaveLength(0);
  });

  it('returns no findings for a route that has no database query', async () => {
    createApiRoute(
      projectPath,
      'health',
      `
      export async function GET() {
        return Response.json({ status: 'ok' });
      }
    `,
    );

    const result = await paginationCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
  });

  it('flags a Supabase .from() query without .limit() as HIGH', async () => {
    createApiRoute(
      projectPath,
      'bookings',
      `
      export async function GET(request) {
        const { data } = await supabase.from('bookings').select('*');
        return Response.json(data);
      }
    `,
    );

    const result = await paginationCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.scanner === 'pagination-checker');
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('high');
    expect(finding!.id).toBe('PAGINATION-001');
    expect(finding!.category).toBe('security');
    expect(finding!.owasp).toBe('A05:2021');
    expect(finding!.cwe).toBe(770);
  });

  it('flags a Prisma findMany() without take: as HIGH', async () => {
    createApiRoute(
      projectPath,
      'users',
      `
      export async function GET() {
        const users = await prisma.user.findMany({ where: { active: true } });
        return Response.json(users);
      }
    `,
    );

    const result = await paginationCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings.some((f) => f.title.includes('pagination'))).toBe(true);
  });

  it('does not flag a Supabase query with .limit()', async () => {
    createApiRoute(
      projectPath,
      'bookings',
      `
      export async function GET() {
        const { data } = await supabase.from('bookings').select('*').limit(50);
        return Response.json(data);
      }
    `,
    );

    const result = await paginationCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
  });

  it('does not flag a Supabase query with .range()', async () => {
    createApiRoute(
      projectPath,
      'treatments',
      `
      export async function GET(request) {
        const { searchParams } = new URL(request.url);
        const from = parseInt(searchParams.get('from') ?? '0');
        const { data } = await supabase.from('treatments').select('*').range(from, from + 19);
        return Response.json(data);
      }
    `,
    );

    const result = await paginationCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
  });

  it('does not flag a Prisma findMany() with take:', async () => {
    createApiRoute(
      projectPath,
      'services',
      `
      export async function GET() {
        const services = await prisma.service.findMany({ take: 20, skip: 0 });
        return Response.json(services);
      }
    `,
    );

    const result = await paginationCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
  });

  it('does not flag a route that reads limit from searchParams', async () => {
    createApiRoute(
      projectPath,
      'guests',
      `
      export async function GET(request) {
        const limit = searchParams.get('limit') ?? '25';
        const { data } = await supabase.from('guests').select('*');
        return Response.json(data);
      }
    `,
    );

    const result = await paginationCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
  });

  it('generates incrementing IDs across multiple unprotected routes', async () => {
    createApiRoute(projectPath, 'a', `export async function GET() { await supabase.from('a').select(); }`);
    createApiRoute(projectPath, 'b', `export async function GET() { await supabase.from('b').select(); }`);

    const result = await paginationCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings.length).toBeGreaterThanOrEqual(2);
    const ids = result.findings.map((f) => f.id);
    expect(ids).toContain('PAGINATION-001');
    expect(ids).toContain('PAGINATION-002');
  });

  it('only flags route.ts and route.js, not other ts files', async () => {
    const dir = join(projectPath, 'src', 'app', 'api', 'helpers');
    mkdirSync(dir, { recursive: true });
    // A utility file that happens to call .from() — should not be flagged
    writeFileSync(join(dir, 'db.ts'), `export function loadAll() { return supabase.from('t').select(); }`);

    const result = await paginationCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
  });

  it('includes duration and available fields in result', async () => {
    const result = await paginationCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(typeof result.duration).toBe('number');
    expect(result.available).toBe(true);
  });
});
