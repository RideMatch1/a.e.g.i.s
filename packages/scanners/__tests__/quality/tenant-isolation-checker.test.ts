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

  it('v0.11.2 Part B: `createAdminSupabaseClient()` helper-call emits (Bug Y signal-inversion)', async () => {
    // Routes using a wrapper helper without any literal "service_role"
    // in the file were silent-missed by the Day-0 single-regex check.
    // Part B adds helper-name patterns so the signal fires on idiomatic
    // helper invocations.
    createFile(
      projectPath,
      'app/api/public/tenant-lookup/route.ts',
      `
import { createAdminSupabaseClient } from '@/lib/supabase/admin';

export async function GET() {
  const supabase = createAdminSupabaseClient();
  return Response.json({ ok: true, client: supabase });
}
`,
    );
    const result = await tenantIsolationCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const srFindings = result.findings.filter(f => f.title.includes('Service role'));
    expect(srFindings.length).toBeGreaterThan(0);
  });

  it('v0.11.2 Part B: alt helper names `createServiceRoleClient` / `getServiceClient` also emit', async () => {
    createFile(
      projectPath,
      'app/api/public/lookup/route.ts',
      `
import { createServiceRoleClient } from '@/lib/supabase';
import { getServiceClient } from '@/lib/supabase-service';

export async function GET() {
  const a = createServiceRoleClient();
  const b = getServiceClient();
  return Response.json({ a, b });
}
`,
    );
    const result = await tenantIsolationCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const srFindings = result.findings.filter(f => f.title.includes('Service role'));
    expect(srFindings.length).toBeGreaterThan(0);
  });

  it('v0.11.2 Part B: anon-only `createClient(URL, ANON_KEY)` does NOT emit (regression pin)', async () => {
    // Part B widening must not over-match on anon usage. A file with
    // `createClient` + the ANON key has no service_role exposure.
    createFile(
      projectPath,
      'app/api/public/health/route.ts',
      `
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  return Response.json({ ok: true, client: supabase });
}
`,
    );
    const result = await tenantIsolationCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const srFindings = result.findings.filter(f => f.title.includes('Service role'));
    expect(srFindings).toHaveLength(0);
  });

  // ==========================================================================
  // v0.11.2 Part C — Scope-aware service_role suppression.
  //
  // Unit tests mirror canary fixtures T7-T17 under
  // packages/benchmark/canary-fixtures/phase3-v011x-dogfood/. Canaries
  // prove end-to-end behavior on a Next.js-shaped project; unit tests pin
  // the narrower property that suppression is only applied when a specific
  // binding-origin chain holds, not lexical name-match.
  // ==========================================================================

  it('v0.11.2 Part C (T7): [slug] route + helper + .eq(\'slug\', slug) → suppress', async () => {
    createFile(
      projectPath,
      'app/api/public/[slug]/tenant/route.ts',
      `
import { createAdminSupabaseClient } from '@/lib/supabase/admin';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const supabase = createAdminSupabaseClient();
  const { data } = await supabase.from('tenants').select('*').eq('slug', slug).single();
  return Response.json(data);
}
`,
    );
    const result = await tenantIsolationCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const tenantFindings = result.findings.filter(f => f.scanner === 'tenant-isolation-checker');
    expect(tenantFindings).toHaveLength(0);
  });

  it('v0.11.2 Part C (T8): two-step destructure `const p = await params; const { slug } = p;` → suppress', async () => {
    createFile(
      projectPath,
      'app/api/public/[slug]/two-step/route.ts',
      `
import { createAdminSupabaseClient } from '@/lib/supabase/admin';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const p = await params;
  const { slug } = p;
  const supabase = createAdminSupabaseClient();
  const { data } = await supabase.from('tenants').select('*').eq('slug', slug).single();
  return Response.json(data);
}
`,
    );
    const result = await tenantIsolationCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const tenantFindings = result.findings.filter(f => f.scanner === 'tenant-isolation-checker');
    expect(tenantFindings).toHaveLength(0);
  });

  it('v0.11.2 Part C (T9): service_role + no .eq() discriminant → still emit (N-C-1)', async () => {
    createFile(
      projectPath,
      'app/api/public/tenants-unscoped/route.ts',
      `
import { createAdminSupabaseClient } from '@/lib/supabase/admin';

export async function GET() {
  const supabase = createAdminSupabaseClient();
  const { data } = await supabase.from('tenants').select('*');
  return Response.json(data);
}
`,
    );
    const result = await tenantIsolationCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const tenantFindings = result.findings.filter(f => f.scanner === 'tenant-isolation-checker');
    expect(tenantFindings.length).toBeGreaterThan(0);
  });

  it('v0.11.2 Part C (T10): .eq(\'slug\', body.slug) — body-param not URL → still emit (N-C-2)', async () => {
    // Attacker controls body.slug. Binding-origin check rejects because
    // slug's declaration initializer is await req.json(), not await params.
    createFile(
      projectPath,
      'app/api/public/tenant-by-body/route.ts',
      `
import { createAdminSupabaseClient } from '@/lib/supabase/admin';

export async function POST(req: Request) {
  const body = (await req.json()) as { slug: string };
  const supabase = createAdminSupabaseClient();
  const { data } = await supabase.from('tenants').select('*').eq('slug', body.slug).single();
  return Response.json(data);
}
`,
    );
    const result = await tenantIsolationCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const tenantFindings = result.findings.filter(f => f.scanner === 'tenant-isolation-checker');
    expect(tenantFindings.length).toBeGreaterThan(0);
  });

  it('v0.11.2 Part C (T11): .eq arg via helper `normalize(slug)` → still emit (N-C-3)', async () => {
    createFile(
      projectPath,
      'app/api/public/[slug]/normalized/route.ts',
      `
import { createAdminSupabaseClient } from '@/lib/supabase/admin';

function normalize(s: string): string { return s.toLowerCase().trim(); }

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const normalized = normalize(slug);
  const supabase = createAdminSupabaseClient();
  const { data } = await supabase.from('tenants').select('*').eq('slug', normalized).single();
  return Response.json(data);
}
`,
    );
    const result = await tenantIsolationCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const tenantFindings = result.findings.filter(f => f.scanner === 'tenant-isolation-checker');
    expect(tenantFindings.length).toBeGreaterThan(0);
  });

  it('v0.11.2 Part C (T12): .eq(\'slug\', \'hardcoded\') literal → still emit (N-C-4)', async () => {
    createFile(
      projectPath,
      'app/api/public/tenant-hardcoded/route.ts',
      `
import { createAdminSupabaseClient } from '@/lib/supabase/admin';

export async function GET() {
  const supabase = createAdminSupabaseClient();
  const { data } = await supabase.from('tenants').select('*').eq('slug', 'production').single();
  return Response.json(data);
}
`,
    );
    const result = await tenantIsolationCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const tenantFindings = result.findings.filter(f => f.scanner === 'tenant-isolation-checker');
    expect(tenantFindings.length).toBeGreaterThan(0);
  });

  it('v0.11.2 Part C (T13): scoped read + unscoped .insert write → still emit (N-C-5)', async () => {
    // Presence of any write in the handler defeats the scoped-read
    // suppression: service_role stays emitting even though the read
    // chain is URL-param-scoped.
    createFile(
      projectPath,
      'app/api/public/[slug]/audit-write/route.ts',
      `
import { createAdminSupabaseClient } from '@/lib/supabase/admin';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const body = (await req.json()) as { action: string };
  const supabase = createAdminSupabaseClient();
  const { data } = await supabase.from('tenants').select('id').eq('slug', slug).single();
  await supabase.from('audit_log').insert({ tenant_id: data?.id, action: body.action });
  return Response.json({ ok: true });
}
`,
    );
    const result = await tenantIsolationCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const tenantFindings = result.findings.filter(f => f.scanner === 'tenant-isolation-checker');
    expect(tenantFindings.length).toBeGreaterThan(0);
  });

  it('v0.11.2 Part C (T14): two .from() chains, second unscoped → still emit (N-C-6)', async () => {
    createFile(
      projectPath,
      'app/api/public/[slug]/two-fetches/route.ts',
      `
import { createAdminSupabaseClient } from '@/lib/supabase/admin';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const supabase = createAdminSupabaseClient();
  const { data: tenant } = await supabase.from('tenants').select('id').eq('slug', slug).single();
  const { data: treatments } = await supabase.from('treatments').select('*');
  return Response.json({ tenant, treatments });
}
`,
    );
    const result = await tenantIsolationCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const tenantFindings = result.findings.filter(f => f.scanner === 'tenant-isolation-checker');
    expect(tenantFindings.length).toBeGreaterThan(0);
  });

  it('v0.11.2 Part C (T15): compound [org]/[slug] + at-least-one URL-param .eq → suppress (MVP)', async () => {
    createFile(
      projectPath,
      'app/api/public/[org]/[slug]/tenant/route.ts',
      `
import { createAdminSupabaseClient } from '@/lib/supabase/admin';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ org: string; slug: string }> },
) {
  const { org, slug } = await params;
  const supabase = createAdminSupabaseClient();
  const { data } = await supabase
    .from('tenants')
    .select('*')
    .eq('org_slug', org)
    .eq('slug', slug)
    .single();
  return Response.json(data);
}
`,
    );
    const result = await tenantIsolationCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const tenantFindings = result.findings.filter(f => f.scanner === 'tenant-isolation-checker');
    expect(tenantFindings).toHaveLength(0);
  });

  it('v0.11.2 Part C (T16): .eq(\'id\', slug) different-field but URL-param → suppress (MVP)', async () => {
    // The column name ('id') is not a TENANT_DISCRIMINANT, but the
    // .eq arg is a URL-param — still a scoped primary-key lookup.
    createFile(
      projectPath,
      'app/api/public/[slug]/by-id/route.ts',
      `
import { createAdminSupabaseClient } from '@/lib/supabase/admin';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const supabase = createAdminSupabaseClient();
  const { data } = await supabase.from('tenants').select('*').eq('id', slug).single();
  return Response.json(data);
}
`,
    );
    const result = await tenantIsolationCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const tenantFindings = result.findings.filter(f => f.scanner === 'tenant-isolation-checker');
    expect(tenantFindings).toHaveLength(0);
  });

  it('v0.11.2 Part C (T17): body-shadow `const { slug } = await req.json()` → still emit (N-C-10)', async () => {
    // Pure lexical name-match would mis-suppress because the signature
    // TYPE annotation says `params: Promise<{ slug: string }>` — but
    // the body never destructures from await params. slug's binding
    // origin is req.json(), not params → binding-origin check emits.
    createFile(
      projectPath,
      'app/api/public/[slug]/body-shadow/route.ts',
      `
import { createAdminSupabaseClient } from '@/lib/supabase/admin';

export async function POST(
  req: Request,
  _ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = (await req.json()) as { slug: string };
  const supabase = createAdminSupabaseClient();
  const { data } = await supabase.from('tenants').select('*').eq('slug', slug).single();
  return Response.json(data);
}
`,
    );
    const result = await tenantIsolationCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const tenantFindings = result.findings.filter(f => f.scanner === 'tenant-isolation-checker');
    expect(tenantFindings.length).toBeGreaterThan(0);
  });

  it('v0.11.2 Part C internal: GET scoped + POST unscoped → file not scoped, emit', async () => {
    // File-level suppression requires EVERY handler to be safe-scoped.
    // Mixed files — one GET with .eq(URL-param), one POST with bare
    // .from() — must keep emitting because POST exposes a cross-tenant
    // path even if GET is safe.
    createFile(
      projectPath,
      'app/api/public/[slug]/mixed/route.ts',
      `
import { createAdminSupabaseClient } from '@/lib/supabase/admin';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const supabase = createAdminSupabaseClient();
  const { data } = await supabase.from('tenants').select('*').eq('slug', slug);
  return Response.json(data);
}

export async function POST() {
  const supabase = createAdminSupabaseClient();
  const { data } = await supabase.from('treatments').select('*');
  return Response.json(data);
}
`,
    );
    const result = await tenantIsolationCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const tenantFindings = result.findings.filter(f => f.scanner === 'tenant-isolation-checker');
    expect(tenantFindings.length).toBeGreaterThan(0);
  });

  it('v0.11.2 Part C internal: arrow handler `export const GET = async (…) => {}` supported', async () => {
    // Route handlers declared as exported arrow-function consts must be
    // recognised identically to `export async function GET`.
    createFile(
      projectPath,
      'app/api/public/[slug]/arrow/route.ts',
      `
import { createAdminSupabaseClient } from '@/lib/supabase/admin';

export const GET = async (
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) => {
  const { slug } = await params;
  const supabase = createAdminSupabaseClient();
  const { data } = await supabase.from('tenants').select('*').eq('slug', slug).single();
  return Response.json(data);
};
`,
    );
    const result = await tenantIsolationCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const tenantFindings = result.findings.filter(f => f.scanner === 'tenant-isolation-checker');
    expect(tenantFindings).toHaveLength(0);
  });

  it('v0.11.2 Part C internal: helper-only file (no .from() anywhere) → emit (no false suppression)', async () => {
    // A handler with no database queries shouldn't earn scope-based
    // suppression just by virtue of having a URL param in the sig —
    // that would silently suppress service_role helpers in files that
    // never prove scoping.
    createFile(
      projectPath,
      'app/api/public/[slug]/helper-only/route.ts',
      `
import { createAdminSupabaseClient } from '@/lib/supabase/admin';

export async function GET(
  _req: Request,
  _ctx: { params: Promise<{ slug: string }> },
) {
  const supabase = createAdminSupabaseClient();
  return Response.json({ ok: true, client: supabase });
}
`,
    );
    const result = await tenantIsolationCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const tenantFindings = result.findings.filter(f => f.scanner === 'tenant-isolation-checker');
    expect(tenantFindings.length).toBeGreaterThan(0);
  });

  // v0.14 DO-3 — config-based additionalBoundaryColumns.
  //
  // Architecture-awareness: projects using a non-tenant_id multi-tenancy
  // model (e.g. user-scoped with `user_id`) can declare their boundary
  // columns via aegis.config.json. Default behavior (no config) is
  // identical to v0.13 — the six built-in discriminants only.
  describe('v0.14 config-based additionalBoundaryColumns', () => {
    function createTenantScopedRoute(dir: string, subPath: string): void {
      const routeDir = join(dir, 'src', 'app', 'api', subPath);
      mkdirSync(routeDir, { recursive: true });
      writeFileSync(join(routeDir, 'route.ts'), `
import { createServerSupabaseClient } from '@/lib/supabase/server';
export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.from('posts').select('*').eq('tenant_id', '123');
  return Response.json(data);
}
`);
    }

    function createUserScopedRoute(dir: string, subPath: string): void {
      const routeDir = join(dir, 'src', 'app', 'api', subPath);
      mkdirSync(routeDir, { recursive: true });
      writeFileSync(join(routeDir, 'route.ts'), `
import { createServerSupabaseClient } from '@/lib/supabase/server';
export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.from('posts').select('*').eq('user_id', 'abc');
  return Response.json(data);
}
`);
    }

    const missingBoundaryTitle = 'Supabase query missing tenant-boundary filter';

    it('default config + tenant_id query → NO finding (backward-compat with v0.13)', async () => {
      createTenantScopedRoute(projectPath, 'posts');
      const result = await tenantIsolationCheckerScanner.scan(projectPath, MOCK_CONFIG);
      const boundary = result.findings.filter((f) =>
        f.title.includes(missingBoundaryTitle),
      );
      expect(boundary).toHaveLength(0);
    });

    it('default config + user_id query → FINDING fires (pre-v0.14 behavior preserved)', async () => {
      createUserScopedRoute(projectPath, 'posts');
      const result = await tenantIsolationCheckerScanner.scan(projectPath, MOCK_CONFIG);
      const boundary = result.findings.filter((f) =>
        f.title.includes(missingBoundaryTitle),
      );
      expect(boundary.length).toBeGreaterThan(0);
    });

    it('additionalBoundaryColumns=["user_id"] + user_id query → NO finding (DO-3 fix)', async () => {
      createUserScopedRoute(projectPath, 'posts');
      const configWithUserId = {
        scanners: {
          tenantIsolation: { additionalBoundaryColumns: ['user_id'] },
        },
      } as unknown as AegisConfig;
      const result = await tenantIsolationCheckerScanner.scan(
        projectPath,
        configWithUserId,
      );
      const boundary = result.findings.filter((f) =>
        f.title.includes(missingBoundaryTitle),
      );
      expect(boundary).toHaveLength(0);
    });

    it('additionalBoundaryColumns=["user_id"] + workspace_id query (not configured) → FINDING fires', async () => {
      const routeDir = join(projectPath, 'src', 'app', 'api', 'posts');
      mkdirSync(routeDir, { recursive: true });
      writeFileSync(join(routeDir, 'route.ts'), `
import { createServerSupabaseClient } from '@/lib/supabase/server';
export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.from('posts').select('*').eq('workspace_id', 'x');
  return Response.json(data);
}
`);
      const configWithUserId = {
        scanners: {
          tenantIsolation: { additionalBoundaryColumns: ['user_id'] },
        },
      } as unknown as AegisConfig;
      const result = await tenantIsolationCheckerScanner.scan(
        projectPath,
        configWithUserId,
      );
      const boundary = result.findings.filter((f) =>
        f.title.includes(missingBoundaryTitle),
      );
      // workspace_id is NOT in defaults (only workspaceId — camelCase) and NOT
      // in the config — the finding fires. Note: `workspaceId` (camelCase) IS
      // a default discriminant, so the scanner must not over-match on the
      // snake-case sibling.
      expect(boundary.length).toBeGreaterThan(0);
    });

    it('replaceBoundaryColumns=true + user_id config + tenant_id query → FINDING fires (opt-in replace works)', async () => {
      createTenantScopedRoute(projectPath, 'posts');
      const configReplace = {
        scanners: {
          tenantIsolation: {
            additionalBoundaryColumns: ['user_id'],
            replaceBoundaryColumns: true,
          },
        },
      } as unknown as AegisConfig;
      const result = await tenantIsolationCheckerScanner.scan(
        projectPath,
        configReplace,
      );
      const boundary = result.findings.filter((f) =>
        f.title.includes(missingBoundaryTitle),
      );
      // Replacement list is ONLY ["user_id"] — tenant_id is no longer
      // recognized, so the query is counted as missing-boundary and fires.
      expect(boundary.length).toBeGreaterThan(0);
    });

    it('invalid boundary column names are dropped with a warn-log (not silently)', async () => {
      createUserScopedRoute(projectPath, 'posts');
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        const configBadCol = {
          scanners: {
            tenantIsolation: {
              // '1bad' starts with digit — invalid SQL identifier shape.
              // 'user_id; DROP TABLE' — injection attempt.
              // 'user_id' — valid, should land.
              additionalBoundaryColumns: ['1bad', 'user_id; DROP TABLE', 'user_id'],
            },
          },
        } as unknown as AegisConfig;
        const result = await tenantIsolationCheckerScanner.scan(
          projectPath,
          configBadCol,
        );
        // Only 'user_id' survived validation — user_id query should NOT fire.
        const boundary = result.findings.filter((f) =>
          f.title.includes(missingBoundaryTitle),
        );
        expect(boundary).toHaveLength(0);
        // Warn-log fired for each of the 2 invalid entries.
        const warnMessages = warnSpy.mock.calls.map((c) => String(c[0]));
        const droppedMessages = warnMessages.filter((m) =>
          m.includes('[tenant-isolation]') && m.includes('dropped'),
        );
        expect(droppedMessages.length).toBe(2);
      } finally {
        warnSpy.mockRestore();
      }
    });
  });

  describe('v0.15.4 D-C-002 public-route-heuristic — path-param-as-tenant-discriminant', () => {
    function serviceRoleRouteFile(path: string): void {
      createFile(
        projectPath,
        path,
        `
import { createClient } from '@supabase/supabase-js';
export async function GET() {
  const supabase = createClient('url', process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data } = await supabase.from('bookings').select('*');
  return Response.json(data);
}
`,
      );
    }

    it('TP-public-slug-downgraded: /api/public/spa/[slug]/route.ts → severity info', async () => {
      serviceRoleRouteFile('app/api/public/spa/[slug]/route.ts');

      const result = await tenantIsolationCheckerScanner.scan(projectPath, MOCK_CONFIG);
      const finding = result.findings.find((f) => f.title.includes('Service role key'));
      expect(finding).toBeDefined();
      expect(finding!.severity).toBe('info');
      expect(finding!.description).toMatch(/public.route|path-discriminant|\[slug\]/i);
    });

    it('TP-public-tenant-downgraded: /api/public/[tenant]/data/route.ts → severity info', async () => {
      serviceRoleRouteFile('app/api/public/[tenant]/data/route.ts');

      const result = await tenantIsolationCheckerScanner.scan(projectPath, MOCK_CONFIG);
      const finding = result.findings.find((f) => f.title.includes('Service role key'));
      expect(finding).toBeDefined();
      expect(finding!.severity).toBe('info');
      expect(finding!.description).toMatch(/public.route|path-discriminant|\[tenant\]/i);
    });

    it('TP-nested-multi-bracket: /api/public/spa/[slug]/booking/[token]/route.ts → severity info', async () => {
      serviceRoleRouteFile('app/api/public/spa/[slug]/booking/[token]/route.ts');

      const result = await tenantIsolationCheckerScanner.scan(projectPath, MOCK_CONFIG);
      const finding = result.findings.find((f) => f.title.includes('Service role key'));
      expect(finding).toBeDefined();
      expect(finding!.severity).toBe('info');
    });

    it('FP-non-public-prefix-still-critical: /api/reports/[id]/route.ts (non-public prefix, bracket-param) → severity critical preserved', async () => {
      // Note: /api/admin/ was the original dispatch-fixture but the scanner pre-skips /admin/
      // per v0.10 dub-corpus-calibration, so admin-routes never reach the severity-assignment.
      // Using /api/reports/ instead — non-public prefix that isn't in any pre-existing skip-list.
      serviceRoleRouteFile('app/api/reports/[id]/route.ts');

      const result = await tenantIsolationCheckerScanner.scan(projectPath, MOCK_CONFIG);
      const finding = result.findings.find((f) => f.title.includes('Service role key'));
      expect(finding).toBeDefined();
      expect(finding!.severity).toBe('critical');
    });

    it('FP-public-no-bracket-still-critical: /api/public/settings/route.ts (no bracket) → severity critical preserved', async () => {
      serviceRoleRouteFile('app/api/public/settings/route.ts');

      const result = await tenantIsolationCheckerScanner.scan(projectPath, MOCK_CONFIG);
      const finding = result.findings.find((f) => f.title.includes('Service role key'));
      expect(finding).toBeDefined();
      expect(finding!.severity).toBe('critical');
    });

    it('FP-non-discriminant-bracket-still-critical: /api/public/items/[itemId]/route.ts ([itemId] not allowlisted) → severity critical preserved', async () => {
      serviceRoleRouteFile('app/api/public/items/[itemId]/route.ts');

      const result = await tenantIsolationCheckerScanner.scan(projectPath, MOCK_CONFIG);
      const finding = result.findings.find((f) => f.title.includes('Service role key'));
      expect(finding).toBeDefined();
      expect(finding!.severity).toBe('critical');
    });

    it('FP-normal-authenticated-route: /api/bookings/route.ts (no public-prefix) → severity critical preserved', async () => {
      serviceRoleRouteFile('app/api/bookings/route.ts');

      const result = await tenantIsolationCheckerScanner.scan(projectPath, MOCK_CONFIG);
      const finding = result.findings.find((f) => f.title.includes('Service role key'));
      expect(finding).toBeDefined();
      expect(finding!.severity).toBe('critical');
    });
  });
});

describe('tenantIsolationCheckerScanner — path-invariance (D-CA-001 contract, v0164)', () => {
  let projectPath: string;

  beforeEach(() => {
    projectPath = makeTempProject();
    // Activation-gate: scanner only proceeds when the project contains a
    // tenant-discriminant literal or a Supabase / Prisma client import.
    createFile(projectPath, 'lib/tenant.ts', 'export const TENANT_COL = "tenant_id";');
  });

  const UNSCOPED_QUERY = [
    "import { NextResponse } from 'next/server';",
    "import { createClient } from '@supabase/supabase-js';",
    '',
    'export async function GET() {',
    "  const supabase = createClient('url', 'key');",
    "  const { data } = await supabase.from('users').select('*');",
    '  return NextResponse.json(data);',
    '}',
  ].join('\n');

  it('N1-class: flags unscoped query under /api/test/ route path (regression-guard for v0.16.3 fix)', async () => {
    createFile(projectPath, 'src/app/api/test/route.ts', UNSCOPED_QUERY);
    const result = await tenantIsolationCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const hits = result.findings.filter(
      (f) => f.scanner === 'tenant-isolation-checker' && f.cwe === 639,
    );
    expect(hits.length).toBeGreaterThan(0);
  });

  it('P1-class: skips unscoped query in *.test.ts basename (scanner filters to route.ts basename — vacuous P1-confirmation)', async () => {
    createFile(projectPath, 'src/foo.test.ts', UNSCOPED_QUERY);
    const result = await tenantIsolationCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(
      result.findings.filter((f) => f.scanner === 'tenant-isolation-checker'),
    ).toHaveLength(0);
  });
});
