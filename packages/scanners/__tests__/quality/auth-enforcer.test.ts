import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// We need to mock @aegis-scan/core before importing the scanner
// walkFiles and readFileSafe are delegated to real fs in tests via mock implementation

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

import { authEnforcerScanner } from '../../src/quality/auth-enforcer.js';
import type { AegisConfig } from '@aegis-scan/core';

const MOCK_CONFIG = {} as AegisConfig;

function makeTempProject(): string {
  return mkdtempSync(join(tmpdir(), 'aegis-auth-test-'));
}

function createApiRoute(projectPath: string, subPath: string, content: string): void {
  const routeDir = join(projectPath, 'src', 'app', 'api', subPath);
  mkdirSync(routeDir, { recursive: true });
  writeFileSync(join(routeDir, 'route.ts'), content);
}

describe('authEnforcerScanner', () => {
  let projectPath: string;

  beforeEach(() => {
    projectPath = makeTempProject();
  });

  it('is always available', async () => {
    expect(await authEnforcerScanner.isAvailable()).toBe(true);
  });

  it('returns no findings for a project with no api directory', async () => {
    const result = await authEnforcerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.scanner).toBe('auth-enforcer');
    expect(result.findings).toHaveLength(0);
  });

  it('flags a route file missing all auth guards', async () => {
    createApiRoute(
      projectPath,
      'bookings',
      `
      import { NextResponse } from 'next/server';
      export async function GET() {
        return NextResponse.json({ data: [] });
      }
    `,
    );

    const result = await authEnforcerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings.length).toBeGreaterThan(0);
    const finding = result.findings[0];
    expect(finding.severity).toBe('high');
    expect(finding.id).toBe('AUTH-001');
    expect(finding.category).toBe('security');
    expect(finding.file).toContain('route.ts');
    expect(finding.line).toBe(1);
  });

  it('flags a route with auth but missing role guard', async () => {
    createApiRoute(
      projectPath,
      'admin/users',
      `
      import { secureApiRouteWithTenant } from '@/lib/api/tenant-guard';
      export async function DELETE(request) {
        const { context } = await secureApiRouteWithTenant(request, { requireAuth: true });
        // Missing role check!
        return NextResponse.json({ ok: true });
      }
    `,
    );

    const result = await authEnforcerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings.length).toBeGreaterThan(0);
    expect(result.findings[0].severity).toBe('low');
    expect(result.findings[0].title).toContain('role');
  });

  it('does not flag a fully secured route', async () => {
    createApiRoute(
      projectPath,
      'admin/bookings',
      `
      import { secureApiRouteWithTenant } from '@/lib/api/tenant-guard';
      import { requireRole } from '@/lib/api/require-role';
      export async function GET(request) {
        const { context } = await secureApiRouteWithTenant(request, { requireAuth: true });
        requireRole(context, ['admin']);
        return NextResponse.json({ data: [] });
      }
    `,
    );

    const result = await authEnforcerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
  });

  // v0.14 Architecture-Awareness — Supabase-SSR route-level auth recognition.
  // The canonical @supabase/ssr pattern inside a route handler is:
  //   const supabase = await createServerSupabaseClient();
  //   const { data: { user } } = await supabase.auth.getUser();
  //   if (!user) return 401;
  // Pre-v0.14, AUTH_GUARD_PATTERNS only included `/getSession/` and
  // the middleware-level shapes, so supabase.auth.getUser() on a
  // route produced a false "missing authentication guard" finding.
  it('does NOT flag a route using supabase.auth.getUser() (Supabase-SSR route-level)', async () => {
    createApiRoute(
      projectPath,
      'profile',
      `
      import { createServerSupabaseClient } from '@/lib/supabase/server';
      export async function GET() {
        const supabase = await createServerSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return new Response(null, { status: 401 });
        return Response.json({ id: user.id });
      }
    `,
    );
    const result = await authEnforcerScanner.scan(projectPath, MOCK_CONFIG);
    const authFinding = result.findings.find((f) =>
      f.title.includes('missing authentication guard'),
    );
    expect(authFinding).toBeUndefined();
  });

  it('does NOT flag a route using supabase.auth.getSession() (Supabase-SSR route-level)', async () => {
    createApiRoute(
      projectPath,
      'refresh',
      `
      import { createServerSupabaseClient } from '@/lib/supabase/server';
      export async function GET() {
        const supabase = await createServerSupabaseClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return new Response(null, { status: 401 });
        return Response.json({ ok: true });
      }
    `,
    );
    const result = await authEnforcerScanner.scan(projectPath, MOCK_CONFIG);
    const authFinding = result.findings.find((f) =>
      f.title.includes('missing authentication guard'),
    );
    expect(authFinding).toBeUndefined();
  });

  // Regression-guard for the new pattern — a route that has NO auth
  // primitive at all (and no `.auth.` shape either) must still fire
  // the missing-authentication-guard finding. Pins that the v0.14
  // addition doesn't over-suppress.
  it('STILL flags a route with no auth primitive (v0.14 pattern does not over-suppress)', async () => {
    createApiRoute(
      projectPath,
      'v14-regression',
      `
      import { NextResponse } from 'next/server';
      export async function GET() {
        // No auth primitive. Scanner must still flag.
        return NextResponse.json({ data: 'public leak' });
      }
    `,
    );
    const result = await authEnforcerScanner.scan(projectPath, MOCK_CONFIG);
    const authFinding = result.findings.find((f) =>
      f.title.includes('missing authentication guard'),
    );
    expect(authFinding).toBeDefined();
    expect(authFinding!.severity).toBe('high');
    expect(authFinding!.cwe).toBe(306);
  });

  it('detects getServerSession as a valid auth guard', async () => {
    createApiRoute(
      projectPath,
      'profile',
      `
      import { getServerSession } from 'next-auth/next';
      import { isAdmin } from '@/lib/auth';
      export async function GET() {
        const session = await getServerSession();
        if (!session) return new Response(null, { status: 401 });
        if (!isAdmin(session.user)) return new Response(null, { status: 403 });
        return Response.json({});
      }
    `,
    );

    const result = await authEnforcerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
  });

  it('increments finding IDs correctly across multiple unprotected routes', async () => {
    createApiRoute(projectPath, 'a', 'export async function GET() {}');
    createApiRoute(projectPath, 'b', 'export async function GET() {}');

    const result = await authEnforcerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings.length).toBeGreaterThanOrEqual(2);
    const ids = result.findings.map((f) => f.id);
    expect(ids).toContain('AUTH-001');
    expect(ids).toContain('AUTH-002');
  });

  it('includes duration and available fields in result', async () => {
    const result = await authEnforcerScanner.scan(projectPath, MOCK_CONFIG);
    expect(typeof result.duration).toBe('number');
    expect(result.available).toBe(true);
  });

  // v0.9.2 regression (validator MAJOR-02): next-auth / Auth.js ownership
  // comparisons must NOT be flagged as "missing role guard". Previous
  // ROLE_GUARD_PATTERNS set was tuned to a narrow helper family and
  // produced low-severity FPs on every properly-authorised next-auth
  // route in the wild (validator reproduced 3 FPs on shadcn-ui/taxonomy).
  it('does NOT flag next-auth ownership comparison (session.user.id === post.userId)', async () => {
    createApiRoute(
      projectPath,
      'posts-edit',
      `
      import { getServerSession } from 'next-auth/next';
      export async function PATCH(request) {
        const session = await getServerSession();
        if (!session) return new Response(null, { status: 401 });
        const post = await db.post.findUnique({ where: { id: params.id } });
        if (session.user.id !== post.userId) return new Response(null, { status: 403 });
        return NextResponse.json({ ok: true });
      }
    `,
    );
    const result = await authEnforcerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
  });

  it('does NOT flag taxonomy-style verifyCurrentUserHasAccessToPost', async () => {
    createApiRoute(
      projectPath,
      'posts-delete',
      `
      import { getServerSession } from 'next-auth/next';
      import { verifyCurrentUserHasAccessToPost } from '@/lib/api/posts';
      export async function DELETE(_req, { params }) {
        const session = await getServerSession();
        if (!session) return new Response(null, { status: 401 });
        if (!(await verifyCurrentUserHasAccessToPost(params.postId))) {
          return new Response(null, { status: 403 });
        }
        return new Response(null, { status: 204 });
      }
    `,
    );
    const result = await authEnforcerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
  });

  it('does NOT flag canEdit/canDelete community helper patterns', async () => {
    createApiRoute(
      projectPath,
      'comments',
      `
      import { getServerSession } from 'next-auth/next';
      export async function DELETE(req, { params }) {
        const session = await getServerSession();
        if (!session) return new Response(null, { status: 401 });
        if (!canEditComment(session.user.id, params.id)) {
          return new Response(null, { status: 403 });
        }
        return new Response(null, { status: 204 });
      }
    `,
    );
    const result = await authEnforcerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
  });

  it('does NOT flag Clerk role check via has({ role })', async () => {
    createApiRoute(
      projectPath,
      'admin-metrics',
      `
      import { auth } from '@clerk/nextjs';
      export async function GET() {
        const { userId, has } = auth();
        if (!userId) return new Response(null, { status: 401 });
        if (!has({ role: 'admin' })) return new Response(null, { status: 403 });
        return NextResponse.json({});
      }
    `,
    );
    const result = await authEnforcerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
  });

  it('does NOT flag Clerk role check via publicMetadata.role', async () => {
    createApiRoute(
      projectPath,
      'billing',
      `
      import { currentUser } from '@clerk/nextjs';
      export async function GET() {
        const user = await currentUser();
        if (!user) return new Response(null, { status: 401 });
        if (user.publicMetadata.role !== 'admin') {
          return new Response(null, { status: 403 });
        }
        return NextResponse.json({ data: [] });
      }
    `,
    );
    const result = await authEnforcerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
  });

  // v0.9.3 regression (validator MAJOR-02 residual): the v0.9.2 patterns
  // used literal `session\.user\.` which does NOT match `session?.user.`
  // under optional chaining. Every post-null-check ownership comparison
  // in a vanilla next-auth codebase was FP'd. The new patterns accept
  // optional chaining on BOTH the session and the .user segment, as well
  // as reversed operand order and tRPC-style ctx.session prefix.
  it('does NOT flag session?.user.id !== post.userId (optional chaining + !==)', async () => {
    createApiRoute(
      projectPath,
      'posts-optional-chain',
      `
      import { getServerSession } from 'next-auth/next';
      export async function PATCH(request, { params }) {
        const session = await getServerSession();
        if (!session) return new Response(null, { status: 401 });
        const post = await db.post.findUnique({ where: { id: params.id } });
        if (params.userId !== session?.user.id) return new Response(null, { status: 403 });
        return NextResponse.json({ ok: true });
      }
    `,
    );
    const result = await authEnforcerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
  });

  it('does NOT flag resource-on-left reversed-operand ownership (params.userId !== session?.user.id)', async () => {
    createApiRoute(
      projectPath,
      'users-userid-reversed',
      `
      import { getServerSession } from 'next-auth/next';
      export async function GET(req, { params }) {
        const session = await getServerSession();
        if (!session) return new Response(null, { status: 401 });
        if (params.userId !== session?.user.id && session?.user.role !== 'admin') {
          return new Response(null, { status: 403 });
        }
        return NextResponse.json({ ok: true });
      }
    `,
    );
    const result = await authEnforcerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
  });

  it('does NOT flag tRPC ctx.session.user.id comparison', async () => {
    createApiRoute(
      projectPath,
      'trpc-like',
      `
      export async function POST(ctx, { params }) {
        if (!ctx.session) return new Response(null, { status: 401 });
        if (ctx.session.user.id !== params.ownerId) {
          return new Response(null, { status: 403 });
        }
        return NextResponse.json({ ok: true });
      }
    `,
    );
    const result = await authEnforcerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
  });

  it('does NOT flag double-optional chaining session?.user?.id', async () => {
    createApiRoute(
      projectPath,
      'double-optional',
      `
      import { getServerSession } from 'next-auth/next';
      export async function DELETE(req, { params }) {
        const session = await getServerSession();
        if (!session) return new Response(null, { status: 401 });
        if (session?.user?.id !== params.authorId) {
          return new Response(null, { status: 403 });
        }
        return new Response(null, { status: 204 });
      }
    `,
    );
    const result = await authEnforcerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
  });

  it('does NOT flag snake_case user_id column (common in Supabase/Postgres)', async () => {
    createApiRoute(
      projectPath,
      'snake-case-userid',
      `
      import { getServerSession } from 'next-auth/next';
      export async function PATCH(request, { params }) {
        const session = await getServerSession();
        if (!session) return new Response(null, { status: 401 });
        const row = await supabase.from('posts').select().eq('id', params.id).single();
        if (row.user_id !== session?.user.id) {
          return new Response(null, { status: 403 });
        }
        return NextResponse.json({ ok: true });
      }
    `,
    );
    const result = await authEnforcerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
  });

  it('DOES still flag a route with auth() but NO ownership / role check (baseline lock)', async () => {
    createApiRoute(
      projectPath,
      'admin/promote',
      `
      import { getServerSession } from 'next-auth/next';
      export async function POST(request) {
        const session = await getServerSession();
        if (!session) return new Response(null, { status: 401 });
        // NB: no role or ownership check — low-severity finding must fire.
        return NextResponse.json({ ok: true });
      }
    `,
    );
    const result = await authEnforcerScanner.scan(projectPath, MOCK_CONFIG);
    const roleFinding = result.findings.find((f) =>
      f.title.includes('role/authorisation guard'),
    );
    expect(roleFinding).toBeDefined();
    expect(roleFinding!.severity).toBe('low');
  });

  // v0.10 Cluster A regression pins — full-flow + @self-only + Z1.

  it('v0.10 D1: flags a route where ownership comparison is value-captured (not gating)', async () => {
    // `session.user.id === params.id` is assigned to a variable, never
    // used as a gate. The unguarded write then runs for every user.
    // Pre-v0.10: pattern-list matched the equality anywhere → silent FN.
    // Post-v0.10: AST gating-position check rejects value-captures.
    createApiRoute(
      projectPath,
      'profile/[id]',
      `
      import { getServerSession } from 'next-auth/next';
      export async function PATCH(request, { params }) {
        const session = await getServerSession();
        if (!session) return new Response(null, { status: 401 });
        const isOwn = session.user.id === params.id;  // value capture, not a guard
        const body = await request.json();
        await prisma.profile.update({ where: { id: params.id }, data: body });
        return NextResponse.json({ ok: true, owned: isOwn });
      }
    `,
    );
    const result = await authEnforcerScanner.scan(projectPath, MOCK_CONFIG);
    const roleFinding = result.findings.find((f) =>
      f.title.includes('role/authorisation guard'),
    );
    expect(roleFinding).toBeDefined();
    expect(roleFinding!.severity).toBe('low');
  });

  it('v0.10 D3: @self-only JSDoc suppresses CWE-285 but NOT CWE-306', async () => {
    // Self-service route: authenticated, but no role-guard by design.
    createApiRoute(
      projectPath,
      'billing/subscription',
      `
      import { getServerSession } from 'next-auth/next';

      /**
       * Self-service subscription management.
       * @self-only
       */
      export async function POST(request) {
        const session = await getServerSession();
        if (!session) return new Response(null, { status: 401 });
        // No role guard by design — every user manages their own sub.
        return NextResponse.json({ ok: true });
      }
    `,
    );
    const result = await authEnforcerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
  });

  it('v0.10 D3: @self-only does NOT suppress missing-auth (CWE-306)', async () => {
    // Author forgot both auth AND role guards, but added @self-only
    // thinking it exempts. @self-only only suppresses role-guard; auth
    // is still mandatory.
    createApiRoute(
      projectPath,
      'billing/invoices',
      `
      /**
       * @self-only
       */
      export async function GET(request) {
        // No auth guard at all — CWE-306 must still fire.
        return NextResponse.json({ data: 'everyone sees this' });
      }
    `,
    );
    const result = await authEnforcerScanner.scan(projectPath, MOCK_CONFIG);
    const authFinding = result.findings.find((f) =>
      f.title.includes('missing authentication guard'),
    );
    expect(authFinding).toBeDefined();
    expect(authFinding!.cwe).toBe(306);
  });

  it('v0.10 Z1: `error: "unauthorized"` in response body does NOT silence CWE-285', async () => {
    // Pre-v0.10: bare `/authorize/` regex substring-matched inside
    // `"unauthorized"` response strings and silenced the role-guard
    // check on routes without any real ownership / role gate.
    // Post-v0.10: `/\\bauthorize\\s*\\(/` requires a call shape.
    createApiRoute(
      projectPath,
      'profile/update',
      `
      import { getServerSession } from 'next-auth/next';
      export async function POST(request) {
        const session = await getServerSession();
        if (!session) {
          return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
        }
        // Unauthorized is in the error message above; no role guard exists.
        const body = await request.json();
        return NextResponse.json({ ok: true });
      }
    `,
    );
    const result = await authEnforcerScanner.scan(projectPath, MOCK_CONFIG);
    const roleFinding = result.findings.find((f) =>
      f.title.includes('role/authorisation guard'),
    );
    expect(roleFinding).toBeDefined();
    expect(roleFinding!.severity).toBe('low');
  });
});

describe('authEnforcerScanner — server components with DB access', () => {
  let projectPath: string;

  beforeEach(() => {
    projectPath = makeTempProject();
  });

  function createPageComponent(dir: string, subPath: string, content: string): void {
    const pageDir = join(dir, 'src', 'app', subPath);
    mkdirSync(pageDir, { recursive: true });
    writeFileSync(join(pageDir, 'page.tsx'), content);
  }

  it('flags a page.tsx with direct supabase DB access and no auth guard', async () => {
    createPageComponent(
      projectPath,
      'dashboard',
      `
      import { createClient } from '@/utils/supabase/server';
      export default async function DashboardPage() {
        const supabase = createClient();
        const { data } = await supabase.from('bookings').select('*');
        return <div>{JSON.stringify(data)}</div>;
      }
    `,
    );

    const result = await authEnforcerScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.title.includes('Server component'));
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('high');
  });

  it('does NOT flag a page.tsx without DB access', async () => {
    createPageComponent(
      projectPath,
      'about',
      `
      export default function AboutPage() {
        return <div>About us</div>;
      }
    `,
    );

    const result = await authEnforcerScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.title.includes('Server component'));
    expect(finding).toBeUndefined();
  });

  it('does NOT flag a page.tsx with DB access and auth guard', async () => {
    createPageComponent(
      projectPath,
      'admin',
      `
      import { getServerSession } from 'next-auth/next';
      import { createClient } from '@/utils/supabase/server';
      export default async function AdminPage() {
        const session = await getServerSession();
        const supabase = createClient();
        const { data } = await supabase.from('users').select('*');
        return <div>{JSON.stringify(data)}</div>;
      }
    `,
    );

    const result = await authEnforcerScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.title.includes('Server component'));
    expect(finding).toBeUndefined();
  });
});

describe('authEnforcerScanner — Express-style routers', () => {
  let projectPath: string;

  beforeEach(() => {
    projectPath = makeTempProject();
  });

  function createExpressRoute(dir: string, relPath: string, content: string): void {
    const fullDir = join(dir, relPath.split('/').slice(0, -1).join('/'));
    mkdirSync(fullDir, { recursive: true });
    writeFileSync(join(dir, relPath), content);
  }

  it('flags an Express route handler without auth guard', async () => {
    createExpressRoute(
      projectPath,
      'src/routes/users.ts',
      `
      import { Router } from 'express';
      const router = Router();
      router.get('/users', (req, res) => {
        res.json({ users: [] });
      });
      export default router;
    `,
    );

    const result = await authEnforcerScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.title.includes('authentication guard'));
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('high');
  });

  it('does NOT flag an Express route with auth guard', async () => {
    createExpressRoute(
      projectPath,
      'src/routes/admin.ts',
      `
      import { Router } from 'express';
      import { authenticate } from '../middleware/auth';
      import { requireRole } from '../middleware/roles';
      const router = Router();
      router.get('/admin', authenticate, requireRole('admin'), (req, res) => {
        res.json({ ok: true });
      });
      export default router;
    `,
    );

    const result = await authEnforcerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
  });
});

describe('authEnforcerScanner — middleware.ts auth patterns', () => {
  let projectPath: string;

  beforeEach(() => {
    projectPath = makeTempProject();
  });

  it('flags middleware.ts that exists but has no auth pattern', async () => {
    writeFileSync(
      join(projectPath, 'middleware.ts'),
      `
      export function middleware(request) {
        return NextResponse.next();
      }
    `,
    );

    const result = await authEnforcerScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.title.includes('Middleware'));
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('medium');
  });

  it('does NOT flag middleware.ts with auth pattern', async () => {
    writeFileSync(
      join(projectPath, 'middleware.ts'),
      `
      import { withAuth } from 'next-auth/middleware';
      export default withAuth({ pages: { signIn: '/login' } });
    `,
    );

    const result = await authEnforcerScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.title.includes('Middleware'));
    expect(finding).toBeUndefined();
  });

  // v0.13 AUTH-001 FP fix: middleware that does CSRF / rate-limit / CSP
  // but delegates auth to route handlers via secureApiRouteWithTenant is
  // the AEGIS-scaffold architecture. Scanner now recognises ≥1 route
  // with an auth primitive as a compensating control and suppresses the
  // middleware-missing-auth finding.
  it('does NOT flag middleware.ts when ≥1 API route uses per-route auth (compensating control)', async () => {
    writeFileSync(
      join(projectPath, 'middleware.ts'),
      `
      import { NextResponse } from 'next/server';
      export function middleware(request) {
        // CSRF + rate-limit + security headers — no auth on purpose
        return NextResponse.next();
      }
    `,
    );
    createApiRoute(
      projectPath,
      'bookings',
      `
      import { secureApiRouteWithTenant } from '@/lib/api/tenant-guard';
      import { requireRole } from '@/lib/api/require-role';
      export async function GET(request) {
        const { context } = await secureApiRouteWithTenant(request, { requireAuth: true });
        requireRole(context, ['admin']);
        return Response.json({ ok: true });
      }
    `,
    );

    const result = await authEnforcerScanner.scan(projectPath, MOCK_CONFIG);
    const mwFinding = result.findings.find((f) => f.title.includes('Middleware'));
    expect(mwFinding).toBeUndefined();
  });

  // v0.13 AUTH-001 FP fix — threat-model Pass-2 adversarial test.
  // Over-suppression guard: an app with a mix of auth-protected and
  // unprotected routes must still have unprotected routes flagged
  // per-file. The middleware-suppression compensating-control MUST NOT
  // silence CWE-306 findings on the unprotected handler.
  it('flags unprotected route handlers even when middleware-suppression kicks in (no over-suppression)', async () => {
    writeFileSync(
      join(projectPath, 'middleware.ts'),
      `
      import { NextResponse } from 'next/server';
      export function middleware(request) {
        return NextResponse.next();
      }
    `,
    );
    // Route A: fully authenticated (triggers middleware suppression)
    createApiRoute(
      projectPath,
      'secure',
      `
      import { secureApiRouteWithTenant } from '@/lib/api/tenant-guard';
      import { requireRole } from '@/lib/api/require-role';
      export async function GET(request) {
        const { context } = await secureApiRouteWithTenant(request, { requireAuth: true });
        requireRole(context, ['admin']);
        return Response.json({ ok: true });
      }
    `,
    );
    // Route B: no auth — per-route finding must still fire HIGH
    createApiRoute(
      projectPath,
      'unprotected',
      `
      import { NextResponse } from 'next/server';
      export async function GET() {
        return NextResponse.json({ data: 'leaky' });
      }
    `,
    );

    const result = await authEnforcerScanner.scan(projectPath, MOCK_CONFIG);

    // Middleware FP suppressed (compensating control in route A)
    const mwFinding = result.findings.find((f) => f.title.includes('Middleware'));
    expect(mwFinding).toBeUndefined();

    // Route B (unprotected) still flagged HIGH — CWE-306
    const routeBFinding = result.findings.find(
      (f) => f.file?.includes('unprotected') && f.title.includes('authentication guard'),
    );
    expect(routeBFinding, 'unprotected route handler must still be flagged').toBeDefined();
    expect(routeBFinding!.severity).toBe('high');
    expect(routeBFinding!.cwe).toBe(306);
  });

  it('emits fileLevel:true on all line=1 findings (Bug 2 schema contract)', async () => {
    // All auth-enforcer findings are about the file as a whole (missing guard,
    // missing role, etc.) — line:1 is a convention, not a location. The
    // fileLevel flag tells the precision CLI to use a stable scanner|file|title
    // identity instead of a context-hash that drifts with file-head edits.
    // This test is the schema contract: if any auth-enforcer emit site forgets
    // to set fileLevel, this fails.
    createApiRoute(
      projectPath,
      'bookings',
      `
      import { NextResponse } from 'next/server';
      export async function GET() {
        return NextResponse.json({ data: [] });
      }
    `,
    );

    const result = await authEnforcerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings.length).toBeGreaterThan(0);
    for (const f of result.findings) {
      // Every finding at line=1 from auth-enforcer must declare fileLevel
      if (f.line === 1) {
        expect(f.fileLevel, `finding ${f.id} (${f.title}) missing fileLevel`).toBe(true);
      }
    }
  });
});
