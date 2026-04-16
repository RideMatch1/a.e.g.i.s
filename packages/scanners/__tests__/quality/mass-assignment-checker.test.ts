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

import { massAssignmentCheckerScanner } from '../../src/quality/mass-assignment-checker.js';
import type { AegisConfig } from '@aegis-scan/core';

const MOCK_CONFIG = {} as AegisConfig;

function makeTempProject(): string {
  return mkdtempSync(join(tmpdir(), 'aegis-mass-test-'));
}

function createApiRoute(projectPath: string, subPath: string, content: string): void {
  const routeDir = join(projectPath, 'src', 'app', 'api', subPath);
  mkdirSync(routeDir, { recursive: true });
  writeFileSync(join(routeDir, 'route.ts'), content);
}

describe('massAssignmentCheckerScanner', () => {
  let projectPath: string;

  beforeEach(() => {
    projectPath = makeTempProject();
  });

  it('is always available', async () => {
    expect(await massAssignmentCheckerScanner.isAvailable(projectPath)).toBe(true);
  });

  it('returns no findings for a project with no api directory', async () => {
    const result = await massAssignmentCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.scanner).toBe('mass-assignment-checker');
    expect(result.findings).toHaveLength(0);
  });

  it('returns no findings for a GET-only route', async () => {
    createApiRoute(projectPath, 'users', `
      export async function GET() {
        const users = await supabase.from('users').select('*');
        return Response.json({ users });
      }
    `);
    const result = await massAssignmentCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
  });

  it('flags Supabase .insert(body) without validation as HIGH', async () => {
    createApiRoute(projectPath, 'items', `
      export async function POST(request) {
        const body = await request.json();
        await supabase.from('items').insert(body);
        return Response.json({ ok: true });
      }
    `);
    const result = await massAssignmentCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.title.includes('Mass assignment'));
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('high');
    expect(finding!.category).toBe('security');
    expect(finding!.owasp).toBe('A08:2021');
    expect(finding!.cwe).toBe(915);
    expect(finding!.id).toBe('MASS-001');
  });

  it('flags Supabase .update(body) without validation as HIGH', async () => {
    createApiRoute(projectPath, 'profile', `
      export async function PATCH(request) {
        const body = await request.json();
        await supabase.from('profiles').update(body).eq('id', id);
        return Response.json({ ok: true });
      }
    `);
    const result = await massAssignmentCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings.some((f) => f.title.includes('Mass assignment'))).toBe(true);
  });

  it('flags Supabase .upsert(body) without validation as HIGH', async () => {
    createApiRoute(projectPath, 'settings', `
      export async function PUT(request) {
        const body = await request.json();
        await supabase.from('settings').upsert(body);
        return Response.json({ ok: true });
      }
    `);
    const result = await massAssignmentCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings.some((f) => f.title.includes('Mass assignment'))).toBe(true);
  });

  it('flags Prisma create({ data: body }) as HIGH', async () => {
    createApiRoute(projectPath, 'posts', `
      export async function POST(request) {
        const body = await request.json();
        await prisma.post.create({ data: body });
        return Response.json({ ok: true });
      }
    `);
    const result = await massAssignmentCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings.some((f) => f.title.includes('Mass assignment'))).toBe(true);
  });

  it('does NOT flag when Zod .parse() is used before insert', async () => {
    createApiRoute(projectPath, 'items', `
      import { z } from 'zod';
      const schema = z.object({ name: z.string() }).strict();
      export async function POST(request) {
        const body = await request.json();
        const validated = schema.parse(body);
        await supabase.from('items').insert(validated);
        return Response.json({ ok: true });
      }
    `);
    const result = await massAssignmentCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings.filter((f) => f.title.includes('Mass assignment'))).toHaveLength(0);
  });

  it('does NOT flag when Zod .safeParse() is used', async () => {
    createApiRoute(projectPath, 'items', `
      import { z } from 'zod';
      const schema = z.object({ name: z.string() }).strict();
      export async function POST(request) {
        const body = await request.json();
        const result = schema.safeParse(body);
        if (!result.success) return Response.json({ error: 'invalid' }, { status: 400 });
        await supabase.from('items').insert(result.data);
        return Response.json({ ok: true });
      }
    `);
    const result = await massAssignmentCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings.filter((f) => f.title.includes('Mass assignment'))).toHaveLength(0);
  });

  it('does NOT flag when body is destructured before use', async () => {
    createApiRoute(projectPath, 'items', `
      export async function POST(request) {
        const body = await request.json();
        const { name, description, price } = body;
        await supabase.from('items').insert({ name, description, price });
        return Response.json({ ok: true });
      }
    `);
    const result = await massAssignmentCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings.filter((f) => f.title.includes('Mass assignment'))).toHaveLength(0);
  });

  it('generates incrementing IDs across multiple routes', async () => {
    createApiRoute(projectPath, 'a', `
      export async function POST(request) {
        const body = await request.json();
        await supabase.from('a').insert(body);
      }
    `);
    createApiRoute(projectPath, 'b', `
      export async function POST(request) {
        const body = await request.json();
        await supabase.from('b').update(body);
      }
    `);
    const result = await massAssignmentCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings.length).toBeGreaterThanOrEqual(2);
    const ids = result.findings.map((f) => f.id);
    expect(ids).toContain('MASS-001');
    expect(ids).toContain('MASS-002');
  });

  it('includes duration and available fields in result', async () => {
    const result = await massAssignmentCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(typeof result.duration).toBe('number');
    expect(result.available).toBe(true);
  });
});
