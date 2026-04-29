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

  // v0.9.2 regression (validator MAJOR-01): handler parameter aliased as
  // `req` (the Next.js App Router community's dominant abbreviation) must
  // NOT silently bypass mass-assignment detection. Previous versions
  // hardcoded `request.json()` in the source-read regex.
  it('flags Supabase .insert(body) with req.json() (req alias) as HIGH', async () => {
    createApiRoute(projectPath, 'items-req', `
      export async function POST(req) {
        const body = await req.json();
        await supabase.from('items').insert(body);
        return Response.json({ ok: true });
      }
    `);
    const result = await massAssignmentCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.title.includes('Mass assignment'));
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('high');
    expect(finding!.cwe).toBe(915);
  });

  it('flags inline .insert(await req.json()) (req alias, no intermediate body var) as HIGH', async () => {
    createApiRoute(projectPath, 'items-inline-req', `
      export async function POST(req) {
        await supabase.from('items').insert(await req.json());
        return Response.json({ ok: true });
      }
    `);
    const result = await massAssignmentCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings.some((f) => f.title.includes('Mass assignment'))).toBe(true);
  });

  it('does NOT flag when req.json() result is destructured before use', async () => {
    createApiRoute(projectPath, 'items-destructure-req', `
      export async function POST(req) {
        const { name, description, price } = await req.json();
        await supabase.from('items').insert({ name, description, price });
        return Response.json({ ok: true });
      }
    `);
    const result = await massAssignmentCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings.filter((f) => f.title.includes('Mass assignment'))).toHaveLength(0);
  });

  // ============================================================
  // v0.17.7 F-MASS-1: sensitive-field destructure + Supabase signUp
  // Source: 2026-04-29 Round-3 dogfood (hirenfire-v2 / serviconnect)
  // ============================================================

  it('F-MASS-1: flags destructure that includes sensitive `role` from request.json()', async () => {
    createApiRoute(projectPath, 'auth/signup', `
      import { db } from '@/lib/db';
      export async function POST(request) {
        const { email, password, name, role, hourlyRate } = await request.json();
        const { data: user } = await db.from('User').insert({
          email, password, name, role: role || 'customer',
        }).select().single();
        return Response.json({ user });
      }
    `);
    const result = await massAssignmentCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.cwe === 915);
    expect(finding).toBeDefined();
    expect(finding!.title).toMatch(/sensitive field destructured/i);
  });

  it('F-MASS-1: flags destructure with `is_admin` flag from body', async () => {
    createApiRoute(projectPath, 'profile', `
      import { db } from '@/lib/db';
      export async function PATCH(req) {
        const body = await req.json();
        const { name, email, is_admin } = body;
        await db.from('User').update({ name, email, is_admin }).eq('id', '1');
        return Response.json({ ok: true });
      }
    `);
    const result = await massAssignmentCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.cwe === 915);
    expect(finding).toBeDefined();
  });

  it('F-MASS-1: flags destructure with `tenant_id` from body', async () => {
    createApiRoute(projectPath, 'orgs/create', `
      import { db } from '@/lib/db';
      export async function POST(request) {
        const { name, tenant_id, owner_id } = await request.json();
        await db.from('Org').insert({ name, tenant_id, owner_id });
        return Response.json({ ok: true });
      }
    `);
    const result = await massAssignmentCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.cwe === 915);
    expect(finding).toBeDefined();
  });

  it('F-MASS-1: flags supabase.auth.signUp options.data containing user-controlled `role`', async () => {
    createApiRoute(projectPath, 'auth/signup', `
      import { createClient } from '@/lib/supabase/server';
      export async function POST(request) {
        const { email, password, role, fullName } = await request.json();
        const supabase = createClient();
        const { data, error } = await supabase.auth.signUp({
          email, password,
          options: { data: { role, full_name: fullName } },
        });
        return Response.json({ user: data?.user });
      }
    `);
    const result = await massAssignmentCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.cwe === 915);
    expect(finding).toBeDefined();
  });

  it('F-MASS-1: does NOT flag destructure of only non-sensitive fields', async () => {
    createApiRoute(projectPath, 'profile', `
      import { db } from '@/lib/db';
      export async function POST(request) {
        const { email, name, phone } = await request.json();
        await db.from('User').insert({ email, name, phone, role: 'customer' });
        return Response.json({ ok: true });
      }
    `);
    const result = await massAssignmentCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.cwe === 915);
    expect(finding).toBeUndefined();
  });

  it('F-MASS-1: does NOT flag when Zod-strict-parse is the validation boundary', async () => {
    createApiRoute(projectPath, 'auth/signup', `
      import { z } from 'zod';
      import { db } from '@/lib/db';
      const Schema = z.object({
        email: z.string().email(),
        role: z.enum(['customer', 'guest']),
      }).strict();
      export async function POST(request) {
        const input = Schema.strict().parse(await request.json());
        await db.from('User').insert({ email: input.email, role: input.role });
        return Response.json({ ok: true });
      }
    `);
    const result = await massAssignmentCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.cwe === 915);
    expect(finding).toBeUndefined();
  });

  // v0.10 Z5 — nested-args Prisma regex regression pin.
  it('v0.10 Z5: flags Prisma update with nested where + data:body (dub-shape)', async () => {
    createApiRoute(projectPath, 'users', `
      import { prisma } from '@/lib/prisma';
      export async function PATCH(req) {
        const body = await req.json();
        await prisma.user.update({
          where: { id: session.user.id },
          data: body,
        });
        return Response.json({ ok: true });
      }
    `);
    const result = await massAssignmentCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const massFindings = result.findings.filter((f) => f.title.includes('Mass assignment'));
    expect(massFindings.length).toBeGreaterThan(0);
    expect(massFindings[0].cwe).toBe(915);
  });
});
