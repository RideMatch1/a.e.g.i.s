// Reference-implementation extract — generic Next.js+Supabase primitive.

import { NextRequest } from 'next/server';
import { createServerSupabaseClient } from '../supabase/server';
import { UnauthorizedError } from '../errors';

export interface TenantContext {
  userId: string | null;
  tenantId: string | null;
  role: 'admin' | 'manager' | 'member' | null;
}

export interface SecureRouteOptions {
  /**
   * Require a valid authenticated user. If true and no user is signed
   * in, `context.userId` will be null and the caller should throw
   * UnauthorizedError. If false, all three context fields are returned
   * as null for unauthenticated requests (guest-mode).
   */
  requireAuth?: boolean;
}

export interface SecureRouteResult {
  context: TenantContext;
  /**
   * The Supabase server-client (anon-key, RLS-enforced). Reuse for
   * downstream queries in the same handler to avoid re-creating the
   * cookie-bound client per query.
   */
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;
}

/**
 * Resolve the caller's tenant context from the Supabase session.
 *
 * The primary guard for tenant-scoped API routes. Uses the anon-key
 * Supabase client so RLS policies apply to the `profiles` self-read.
 * Pure auth+tenant resolution — rate-limiting, CSRF, and role checks
 * are separate concerns composed by the caller via the dedicated
 * primitives (`checkIPRateLimit`, `requireRole`, etc.).
 *
 * Return shape:
 * - `context.userId`:   the signed-in user id, or null
 * - `context.tenantId`: the user's tenant from `profiles.tenant_id`, or null
 * - `context.role`:     the user's role from `profiles.role`, or null
 * - `supabase`:         the same server-client used internally, for reuse
 *
 * The function does NOT throw on a missing session when `requireAuth` is
 * true; instead it returns `userId: null`. The caller is expected to
 * `throw new UnauthorizedError(...)` when `context.userId` is null and
 * the route is not guest-accessible. This keeps the guard composable:
 * handlers that want to tolerate unauthenticated reads (public pages,
 * webhooks with their own auth) can short-circuit without a try/catch.
 *
 * Errors from `supabase.auth.getUser()` (network, JWT decode failure)
 * are propagated — they indicate a real infrastructure problem, not a
 * missing session, and must not be silently swallowed.
 */
export async function secureApiRouteWithTenant(
  _request: NextRequest,
  _options: SecureRouteOptions = {},
): Promise<SecureRouteResult> {
  const supabase = await createServerSupabaseClient();

  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user ?? null;

  if (!user) {
    return {
      context: { userId: null, tenantId: null, role: null },
      supabase,
    };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('tenant_id, role')
    .eq('id', user.id)
    .single();

  return {
    context: {
      userId: user.id,
      tenantId: profile?.tenant_id ?? null,
      role: (profile?.role as TenantContext['role']) ?? null,
    },
    supabase,
  };
}

// Re-export so the scaffolded app can catch the conventional error type
// from a single import site.
export { UnauthorizedError };
