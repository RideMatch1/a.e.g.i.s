import { walkFiles, readFileSafe } from '@aegis-scan/core';
import type { Scanner, ScanResult, Finding, AegisConfig } from '@aegis-scan/core';
import { stripComments } from '../ast/page-context.js';

/**
 * Supabase Service-Role Flow Checker — detects route handlers and
 * Server Actions that instantiate a Supabase client with the
 * SUPABASE_SERVICE_ROLE_KEY (or call supabase.auth.admin.* APIs)
 * without verifying the caller's identity beforehand. The
 * service-role key bypasses every RLS policy on every table; a
 * client-callable path that uses it without a prior auth gate is a
 * full tenant-bypass vector.
 *
 * v0.18.1 F-SUPABASE-SERVICE-ROLE-FLOW-1 — closes a coverage gap.
 * The existing `next-public-leak` scanner catches the env-side leak
 * (NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY). This scanner catches the
 * runtime flow: server-side service-role usage in a request-handler
 * shape that lacks a recognised auth-call.
 *
 * OWASP A01:2021 — Broken Access Control
 * CWE-285 (Improper Authorization) — service-role usage without
 *         caller-identity verification means the access control
 *         is effectively absent for any path that traverses the
 *         service-role client.
 *
 * Scope:
 *   - app/api/**\/route.{ts,tsx,js,jsx} (App Router route handlers)
 *   - 'use server' files anywhere in the project (Server Actions —
 *     callable from any client component, no inherent auth gate)
 *
 * Detection:
 *   1. File mentions SERVICE_ROLE_KEY (env-var read or import)
 *   2. File EITHER instantiates a client with the service-role key
 *      OR calls supabase.auth.admin.* (admin-API requires service-
 *      role context)
 *   3. File body contains NO recognised auth-call (auth() /
 *      getUser() / getServerSession() / requireAuth() / Clerk auth /
 *      tRPC ctx.session-shape / known HOC wrappers)
 *
 * Conservative-by-design — the scanner does not perform AST-level
 * order-of-call analysis. A recognised auth-call ANYWHERE in the
 * file suppresses the finding, even if the actual call-site does
 * not run before the service-role usage. This is the same trade-off
 * `auth-enforcer` makes; the per-file gate is sufficient to silence
 * the dominant-FP class while still catching the dominant-TP class
 * (handler that imports service-role and never reads auth state).
 */

const ROUTE_FILE_RE =
  /(?:^|[/\\])(?:app|pages)[/\\]api[/\\].*(?:route\.[tj]sx?$|[^/\\]+\.[tj]sx?$)/;

const USE_SERVER_DIRECTIVE_RE = /^[\s\n]*['"]use server['"]\s*;?/m;

/** Service-role key tokens. The substring match is intentionally
 *  broad: the env-var name is the canonical signal across all
 *  Supabase-self-hosted and Supabase-cloud installations. */
const SERVICE_ROLE_TOKEN_RE =
  /\b(?:SUPABASE_SERVICE_ROLE_KEY|SERVICE_ROLE_KEY|service[_-]?role[_-]?key|serviceRoleKey)\b/;

/** createClient(url, <service-role-var>) — second-arg shape varies
 *  but the `service_role`/`SERVICE_ROLE` token substring is stable
 *  across spread, env-read, and constant patterns. */
const CREATE_CLIENT_WITH_SERVICE_ROLE_RE =
  /\bcreateClient\s*\([^)]*(?:SERVICE_ROLE|service[_-]?role)[^)]*\)/i;

/** supabase.auth.admin.* — these APIs ONLY work with a service-role
 *  client. A call to any auth.admin.* method implies service-role
 *  context (or an inevitable runtime error, which is its own bug). */
const AUTH_ADMIN_CALL_RE = /\b(?:supabase|admin|client|sb)\.auth\.admin\.\w+\s*\(/;

/** Recognised auth-call patterns. Mirror of `auth-enforcer`'s
 *  AUTH_GUARD_PATTERNS, narrowed to the Supabase + Next-auth +
 *  Clerk + tRPC subset most relevant for Supabase-stack projects.
 *  Any of these in the file body suppresses the finding. */
const AUTH_GUARD_PATTERNS: readonly RegExp[] = [
  /\bauth\s*\(\s*\)/,
  /\bgetServerSession\s*\(/,
  /\bgetSession\s*\(/,
  /\b\.auth\.(?:getUser|getSession)\s*\(/,
  /\brequireAuth\s*\(/,
  /\brequireAuthHandler\s*\(/,
  /\bsecureApiRoute(?:WithTenant)?\s*\(/,
  /\bcurrentUser\s*\(\s*\)/,
  /\bauth\.protect\s*\(/,
  /\bclerkClient\.users\.getUser\s*\(/,
  /\bclerkClient\.sessions\.verifySession\s*\(/,
  /\bgetAuth\s*\(\s*(?:req|request)\b/,
  /\bctx\.(?:session|user)\b/,
  /\bwithApiGuards?\s*\(/,
  /\bcreateAgentRoute\s*\(/,
  /\bcreateProtectedRoute\s*\(/,
  /\bsecureRoute\s*\(/,
  /\bprotectedRoute\s*\(/,
  /\bwithSession\s*\(/,
  /\bwithRouteAuth\s*\(/,
  /\bwrapWithAuth\s*\(/,
  // User-authored auth-helper convention — `await requireUser(req)`,
  // `await assertAuthed(req, role)`, etc. Restricted to await + req
  // arg to avoid matching unrelated utility calls.
  /\bawait\s+(?:require|assert|verify|check|ensure|validate|authenticate)\w*\s*\(\s*[^)]*\b(?:req|request|context|ctx|c)\b/i,
];

function findFirstMatchLine(content: string, re: RegExp): number {
  const idx = content.search(re);
  if (idx < 0) return 1;
  return content.slice(0, idx).split('\n').length;
}

function isInScope(filePath: string, content: string): boolean {
  if (ROUTE_FILE_RE.test(filePath)) return true;
  if (USE_SERVER_DIRECTIVE_RE.test(content)) return true;
  return false;
}

function usesServiceRole(content: string): { kind: 'create-client' | 'auth-admin' | 'env-read'; line: number } | null {
  if (CREATE_CLIENT_WITH_SERVICE_ROLE_RE.test(content)) {
    return {
      kind: 'create-client',
      line: findFirstMatchLine(content, CREATE_CLIENT_WITH_SERVICE_ROLE_RE),
    };
  }
  if (AUTH_ADMIN_CALL_RE.test(content)) {
    return {
      kind: 'auth-admin',
      line: findFirstMatchLine(content, AUTH_ADMIN_CALL_RE),
    };
  }
  // Bare env-read signal — file references SERVICE_ROLE_KEY but the
  // exact instantiation pattern was not matched. Lower-confidence
  // heuristic; only fires when the file is in-scope and lacks an
  // auth-call (covered by hasAuthGuard below).
  if (SERVICE_ROLE_TOKEN_RE.test(content)) {
    return {
      kind: 'env-read',
      line: findFirstMatchLine(content, SERVICE_ROLE_TOKEN_RE),
    };
  }
  return null;
}

function hasAuthGuard(content: string): boolean {
  return AUTH_GUARD_PATTERNS.some((p) => p.test(content));
}

export const supabaseServiceRoleFlowCheckerScanner: Scanner = {
  name: 'supabase-service-role-flow-checker',
  description:
    'Detects Next.js route handlers and Server Actions that use SUPABASE_SERVICE_ROLE_KEY (or supabase.auth.admin.* APIs) without first verifying the caller via auth() / getUser() / getServerSession() / known HOC wrapper. Service-role bypasses RLS — unguarded usage is a full tenant-bypass vector.',
  category: 'security',

  async isAvailable(_projectPath: string): Promise<boolean> {
    return true;
  },

  async scan(projectPath: string, _config: AegisConfig): Promise<ScanResult> {
    const start = Date.now();
    const findings: Finding[] = [];

    const files = await walkFiles(
      projectPath,
      ['node_modules', '.git', '.next', 'dist', 'build', 'coverage', 'out', '.turbo'],
      ['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs'],
    );

    let idCounter = 1;
    for (const file of files) {
      const original = await readFileSafe(file);
      if (!original) continue;
      // Strip line + block comments before pattern matching so a fixture
      // or doc-comment naming `auth()` / `getUser()` does not falsely
      // suppress the finding. The scope-detection still uses the original
      // content for the 'use server' directive (top-of-file).
      const content = stripComments(original);
      if (!isInScope(file, original)) continue;
      const usage = usesServiceRole(content);
      if (!usage) continue;
      if (hasAuthGuard(content)) continue;

      const id = `SUPA-SVCROLE-${String(idCounter++).padStart(3, '0')}`;
      const isServerAction = USE_SERVER_DIRECTIVE_RE.test(content);
      const shape = isServerAction ? "'use server' Server Action" : 'app/api route handler';
      const usageDesc =
        usage.kind === 'create-client'
          ? "instantiates createClient(url, SERVICE_ROLE_KEY)"
          : usage.kind === 'auth-admin'
          ? 'calls supabase.auth.admin.* (service-role-only API)'
          : 'reads SERVICE_ROLE_KEY from environment';

      findings.push({
        id,
        scanner: 'supabase-service-role-flow-checker',
        severity: 'critical',
        title: `${shape} uses SERVICE_ROLE without verifying caller — RLS bypass`,
        description: `A ${shape} ${usageDesc} but the file body has no recognised auth-call (auth() / getUser() / getServerSession() / requireAuth / Clerk / tRPC ctx.session / known HOC wrapper). The service-role key bypasses every RLS policy on every table — without a caller-identity check upstream of the service-role client, every authenticated user (and Server Actions: every public visitor) acts with full database privileges. Verify the caller's identity (and role/ownership where applicable) BEFORE the service-role client is instantiated; reserve service-role usage for operations that legitimately need to bypass RLS (cross-user reconciliation, audit-log writes, admin actions).`,
        file,
        line: usage.line,
        category: 'security',
        owasp: 'A01:2021',
        cwe: 285,
        fix: {
          description:
            'Verify the caller before reaching for the service-role client. Pattern: const userClient = createServerClient(URL, ANON_KEY, { cookies }); const { data: { user } } = await userClient.auth.getUser(); if (!user) return new Response("Unauthorized", { status: 401 }); — and for admin-only paths, additionally check user.user_metadata?.role === "admin" or call a getProfileRole helper. Only after this point instantiate the service-role client and perform the privileged operation.',
          links: [
            'https://cwe.mitre.org/data/definitions/285.html',
            'https://supabase.com/docs/guides/api/api-keys#the-servicerole-key',
            'https://supabase.com/docs/guides/auth/server-side/nextjs',
          ],
        },
      });
    }

    return {
      scanner: 'supabase-service-role-flow-checker',
      category: 'security',
      findings,
      duration: Date.now() - start,
      available: true,
    };
  },
};
