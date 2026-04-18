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

import { tenantIsolationCheckerScanner } from '../../src/quality/tenant-isolation-checker.js';
import type { AegisConfig } from '@aegis-scan/core';

const MOCK_CONFIG = {} as AegisConfig;

function makeTempProject(): string {
  return mkdtempSync(join(tmpdir(), 'aegis-tenant-test-'));
}

function createFile(projectPath: string, relPath: string, content: string): string {
  const parts = relPath.split('/');
  const dir = join(projectPath, ...parts.slice(0, -1));
  mkdirSync(dir, { recursive: true });
  const fullPath = join(projectPath, relPath);
  writeFileSync(fullPath, content);
  return fullPath;
}

describe('tenantIsolationCheckerScanner', () => {
  let projectPath: string;

  beforeEach(() => {
    projectPath = makeTempProject();
    // Create a file referencing tenant_id so the scanner detects a multi-tenant project
    createFile(projectPath, 'lib/tenant.ts', 'export const TENANT_COL = "tenant_id";');
  });

  it('is always available', async () => {
    expect(await tenantIsolationCheckerScanner.isAvailable('')).toBe(true);
  });

  it('returns no findings for empty project', async () => {
    const result = await tenantIsolationCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.scanner).toBe('tenant-isolation-checker');
    expect(result.findings).toHaveLength(0);
  });

  it('flags .from() without tenant_id filter in route file as HIGH', async () => {
    createFile(
      projectPath,
      'app/api/users/route.ts',
      `
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  const supabase = createClient('url', 'key');
  const { data } = await supabase.from('users').select('*');
  return NextResponse.json(data);
}
`,
    );

    const result = await tenantIsolationCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings.length).toBeGreaterThan(0);
    const finding = result.findings.find(f => f.title.includes('missing tenant-boundary filter'));
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('high');
    expect(finding!.id).toMatch(/^TENANT-/);
    expect(finding!.owasp).toBe('A01:2021');
    expect(finding!.cwe).toBe(639);
  });

  it('does NOT flag .from() with .eq(tenant_id) in query chain', async () => {
    createFile(
      projectPath,
      'app/api/users/route.ts',
      `
import { NextResponse } from 'next/server';

export async function GET() {
  const supabase = createClient('url', 'key');
  const { data } = await supabase
    .from('users')
    .select('*')
    .eq('tenant_id', tenantId);
  return NextResponse.json(data);
}
`,
    );

    const result = await tenantIsolationCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const tenantFindings = result.findings.filter(f => f.title.includes('missing tenant-boundary filter'));
    expect(tenantFindings).toHaveLength(0);
  });

  it('skips files that use secureApiRouteWithTenant', async () => {
    createFile(
      projectPath,
      'app/api/users/route.ts',
      `
import { secureApiRouteWithTenant } from '@/lib/api/tenant-guard';

export async function GET(request: NextRequest) {
  const { context } = await secureApiRouteWithTenant(request, { requireAuth: true });
  const { data } = await supabase.from('users').select('*');
  return NextResponse.json(data);
}
`,
    );

    const result = await tenantIsolationCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
  });

  it('flags service_role usage as CRITICAL', async () => {
    createFile(
      projectPath,
      'app/api/data-sync/route.ts',
      `
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  const supabase = createClient('url', process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data } = await supabase.from('users').select('*').eq('tenant_id', tid);
  return NextResponse.json(data);
}
`,
    );

    const result = await tenantIsolationCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find(f => f.severity === 'critical');
    expect(finding).toBeDefined();
    expect(finding!.title).toContain('Service role key');
  });

  it('only checks route.ts/route.js files', async () => {
    createFile(
      projectPath,
      'lib/helper.ts',
      `
const { data } = await supabase.from('users').select('*');
`,
    );

    const result = await tenantIsolationCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
  });

  it('skips test files', async () => {
    createFile(
      projectPath,
      'app/api/__tests__/route.ts',
      `
const { data } = await supabase.from('users').select('*');
`,
    );

    const result = await tenantIsolationCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
  });

  it('includes duration and available fields', async () => {
    const result = await tenantIsolationCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(typeof result.duration).toBe('number');
    expect(result.available).toBe(true);
  });

  // v0.10 Cluster C + Z2 regression pins — Prisma awareness + AST-based
  // detection (no regex matching inside comment prose).

  it('v0.10: does NOT flag Prisma query with workspaceId discriminant (D6 pin)', async () => {
    createFile(
      projectPath,
      'app/api/links/route.ts',
      `
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const links = await prisma.link.findMany({
    where: { workspaceId: 'ws_123' },
    take: 10,
  });
  return NextResponse.json(links);
}
`,
    );

    const result = await tenantIsolationCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const prismaFindings = result.findings.filter(f => f.title.includes('Prisma'));
    expect(prismaFindings).toHaveLength(0);
  });

  it('v0.10: does NOT flag Prisma query with teamId discriminant (D7 pin)', async () => {
    createFile(
      projectPath,
      'app/api/projects/route.ts',
      `
import { prisma } from '@/lib/prisma';

export async function GET() {
  return prisma.project.findMany({
    where: { teamId: 'team_1', archivedAt: null },
  });
}
`,
    );

    const result = await tenantIsolationCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const prismaFindings = result.findings.filter(f => f.title.includes('Prisma'));
    expect(prismaFindings).toHaveLength(0);
  });

  it('v0.10: flags Prisma query WITHOUT discriminant (D8 pin)', async () => {
    createFile(
      projectPath,
      'app/api/documents/route.ts',
      `
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  const name = new URL(req.url).searchParams.get('name') ?? '';
  const docs = await prisma.document.findMany({
    where: { name: { contains: name } },
  });
  return NextResponse.json(docs);
}
`,
    );

    const result = await tenantIsolationCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const prismaFindings = result.findings.filter(f => f.title.includes('Prisma'));
    expect(prismaFindings.length).toBeGreaterThan(0);
    // v0.10 dub-corpus calibration: Prisma findings emit at MEDIUM
    // (audit required) not HIGH (IDOR). ORM relationships often scope
    // implicitly via FK chains.
    expect(prismaFindings[0].severity).toBe('medium');
    expect(prismaFindings[0].cwe).toBe(639);
  });

  it('v0.10: skips routes under `/admin/` path (dub-corpus calibration)', async () => {
    createFile(
      projectPath,
      'app/api/admin/ban/route.ts',
      `
import { prisma } from '@/lib/prisma';

export async function POST() {
  // Intentionally cross-tenant — admin ban flow.
  const banned = await prisma.user.findMany({ where: { flagged: true } });
  return Response.json(banned);
}
`,
    );

    const result = await tenantIsolationCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const prismaFindings = result.findings.filter(f => f.title.includes('Prisma'));
    expect(prismaFindings).toHaveLength(0);
  });

  it('v0.10: honours `@cross-tenant` JSDoc annotation', async () => {
    createFile(
      projectPath,
      'app/api/support/users/route.ts',
      `
import { prisma } from '@/lib/prisma';

/**
 * Support tooling — intentionally cross-tenant.
 * @cross-tenant
 */
export async function GET() {
  return prisma.user.findMany({ where: { status: 'active' } });
}
`,
    );

    const result = await tenantIsolationCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const prismaFindings = result.findings.filter(f => f.title.includes('Prisma'));
    expect(prismaFindings).toHaveLength(0);
  });

  it('v0.10: AST-based — `.from(` inside comment does NOT fire (Z2 pin)', async () => {
    // A route file mentioning `.from(` only in prose / docstring must
    // not trigger. The pre-v0.10 regex matched substring-inside-comment.
    createFile(
      projectPath,
      'app/api/docs/route.ts',
      `
/**
 * Docs for this endpoint:
 *   supabase.from('users') — handled in a sibling handler, not here.
 * We only serve static content; no DB calls in this file.
 */
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ ok: true });
}
`,
    );

    const result = await tenantIsolationCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
  });

  it('v0.10: case-insensitive service_role match on UPPERCASE env var (Z8 partial pin)', async () => {
    createFile(
      projectPath,
      'app/api/data/route.ts',
      `
import { createClient } from '@supabase/supabase-js';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(req: Request) {
  const body = await req.json();
  return admin.from('anything').insert(body);
}
`,
    );

    const result = await tenantIsolationCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const srFindings = result.findings.filter(f => f.title.includes('Service role'));
    expect(srFindings.length).toBeGreaterThan(0);
    expect(srFindings[0].severity).toBe('critical');
    expect(srFindings[0].cwe).toBe(639);
  });

  it('v0.11.2 Part A: line comment `// service_role: …` does NOT emit (Z2-comment-leak)', async () => {
    // Bug X: devs commenting WHY a helper is used was mis-flagged as
    // real service_role usage. stripComments runs before the regex —
    // the route below uses only the anon client in code; the prose in
    // the comment must not fire.
    createFile(
      projectPath,
      'app/api/public/info/route.ts',
      `
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  // service_role: public endpoint, no user session
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  return Response.json({ status: 'ok', client: supabase });
}
`,
    );
    const result = await tenantIsolationCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const srFindings = result.findings.filter(f => f.title.includes('Service role'));
    expect(srFindings).toHaveLength(0);
  });

  it('v0.11.2 Part A: JSDoc block mentioning service_role does NOT emit', async () => {
    createFile(
      projectPath,
      'app/api/public/info/route.ts',
      `
/**
 * Public endpoint.
 * @description Uses service_role for slug resolution because tenants
 *   table RLS blocks anonymous SELECT. Downstream queries scoped.
 */
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  return Response.json({ status: 'ok', client: supabase });
}
`,
    );
    const result = await tenantIsolationCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const srFindings = result.findings.filter(f => f.title.includes('Service role'));
    expect(srFindings).toHaveLength(0);
  });

  it('v0.11.2 Part A: literal `\'service_role\'` in code STILL emits (regression pin)', async () => {
    // Strings are preserved by stripComments so legitimate literal
    // references survive. Used as an over-suppression regression guard.
    createFile(
      projectPath,
      'app/api/public/role-check/route.ts',
      `
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  const body = (await req.json()) as { role: string };
  const expected = 'service_role';
  return Response.json({ match: body.role === expected, client: supabase });
}
`,
    );
    const result = await tenantIsolationCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const srFindings = result.findings.filter(f => f.title.includes('Service role'));
    expect(srFindings.length).toBeGreaterThan(0);
  });
});
