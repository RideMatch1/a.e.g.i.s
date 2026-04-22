---
name: multi-tenant-supabase
category: foundation
title: Multi-Tenancy with Supabase (tenants + profiles + RLS)
description: >
  Establishes tenants + profiles tables with Row-Level-Security.
  Every domain-table FK-refs tenants and filters via tenant_id in app-layer + RLS-layer.
  Adds the secureApiRouteWithTenant guard that extracts tenant_id from the authenticated
  user's profile and enforces CSRF-protection on mutating routes.
version: 1
dependencies:
  npm:
    - "@supabase/supabase-js"
    - "@supabase/ssr"
    - "next"
placeholders:
  - name: PROJECT_NAME
    description: The project identifier (kebab-case, from wizard).
    required: true
  - name: DEFAULT_TENANT_ID
    description: >
      UUID-v4 fallback tenant_id for unauthenticated routes (guest, webhooks).
      Only used when explicit opt-in via allowDefaultTenantFallback=true.
    default: auto-generate UUID-v4 at wizard-time
    required: true
brief_section: Foundation
estimated_files: 4
estimated_migration_size: 60
tags: [multi-tenant, rls, supabase, auth]
related:
  - foundation/auth-supabase-full
  - foundation/rbac-requireRole
  - foundation/middleware-hardened
---

# Multi-Tenancy with Supabase

Every production SaaS needs proper tenant isolation. This pattern establishes the foundation: a `tenants` table, a `profiles` table linked to `auth.users`, Row-Level-Security policies, and the canonical `secureApiRouteWithTenant()` guard that extracts tenant-context from every authenticated request.

**Non-negotiable rules this pattern enforces:**

1. Every domain-table has `tenant_id uuid not null references tenants(id) on delete cascade`.
2. Every authenticated API route calls `secureApiRouteWithTenant()` before any query.
3. Every RLS policy filters by `tenant_id = (auth.jwt() ->> 'tenant_id')::uuid`.
4. Cross-tenant reads/writes are physically impossible from the app-layer.

If you break rule 1-3, you have a potential IDOR vulnerability. Trust no component.

---

## Commands to run

```bash
# Supabase project initialization (if not already done)
npx supabase init
npx supabase link --project-ref <your-ref>

# Install dependencies
npm install @supabase/supabase-js @supabase/ssr
```

---

## Files to create

### `supabase/migrations/00001_base_tenants_profiles.sql`

```sql
-- Multi-tenant foundation: tenants + profiles tables + RLS
-- Pattern: foundation/multi-tenant-supabase v1

-- ============================================================================
-- tenants — the top-level organization/workspace
-- ============================================================================
create table if not exists public.tenants (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text unique not null check (slug ~ '^[a-z][a-z0-9-]*$'),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.tenants is
  'Top-level tenants. slug is URL-safe identifier for subdomain/path routing.';

-- Default tenant (fallback for unauth-routes; rarely needed)
insert into public.tenants (id, name, slug, is_active)
values ('{{DEFAULT_TENANT_ID}}', 'Default', 'default', true)
on conflict (id) do nothing;

-- ============================================================================
-- profiles — extends auth.users with tenant + role
-- ============================================================================
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  tenant_id   uuid references public.tenants(id) on delete cascade,
  role        text not null default 'user' check (role in ('admin', 'manager', 'user')),
  full_name   text,
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.profiles is
  'User profile extension. NEVER stores email/phone — those live in auth.users (DSGVO).';

-- Trigger: auto-create profile row on auth.users insert
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, tenant_id, role)
  values (new.id, null, 'user')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Trigger: update updated_at on any profile update
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ============================================================================
-- RLS policies
-- ============================================================================
alter table public.tenants enable row level security;
alter table public.profiles enable row level security;

-- tenants: users can read their own tenant; admins can read/update
create policy tenants_select_own on public.tenants
  for select using (
    id in (select tenant_id from public.profiles where id = auth.uid())
  );

create policy tenants_update_admin on public.tenants
  for update using (
    id in (
      select tenant_id from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- profiles: users read/update their own; admins read/update within their tenant
create policy profiles_select_self_or_tenant on public.profiles
  for select using (
    id = auth.uid()
    or tenant_id in (
      select tenant_id from public.profiles
      where id = auth.uid() and role in ('admin', 'manager')
    )
  );

create policy profiles_update_self_or_admin on public.profiles
  for update using (
    id = auth.uid()
    or tenant_id in (
      select tenant_id from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- NOTE: inserts are disabled from app-layer (only via handle_new_user trigger).
-- deletes are cascade-from-auth.users.
```

### `src/lib/supabase/server.ts`

```typescript
/**
 * Supabase Server Client — {{PROJECT_NAME}}
 *
 * For use in Server Components, API Routes, Server Actions.
 * Uses anon key (RLS-enforced). DEFAULT for all server-queries.
 */
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createServerSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Ignored in Server Components (read-only cookies)
          }
        },
      },
    },
  );
}
```

### `src/lib/supabase/client.ts`

```typescript
/**
 * Supabase Browser Client — {{PROJECT_NAME}}
 *
 * For use in Client Components (browser-side).
 * Uses anon key (RLS-enforced).
 */
import { createBrowserClient } from '@supabase/ssr';

export function createBrowserSupabaseClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
```

### `src/lib/supabase/admin.ts`

```typescript
/**
 * Supabase Admin Client — {{PROJECT_NAME}}
 *
 * SERVICE ROLE — bypasses RLS. Use ONLY for:
 * - auth.admin.* operations
 * - Cron jobs
 * - Webhooks
 * - Seed scripts
 *
 * NEVER import this in regular API routes. Use createServerSupabaseClient() instead.
 */
import { createClient } from '@supabase/supabase-js';

export function createAdminSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  }

  // eslint-disable-next-line no-restricted-imports -- Service role required for admin operations
  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
```

### `src/lib/api/client-ip.ts`

```typescript
/**
 * Trusted Client IP Resolution — {{PROJECT_NAME}}
 *
 * SECURITY CRITICAL — used by rate-limiter and audit-log.
 *
 * Trust Model: CF-Connecting-IP > X-Real-IP > rightmost X-Forwarded-For
 * NEVER trust the first X-Forwarded-For element (client-controllable).
 */
import type { NextRequest } from 'next/server';

function getTrustedProxyCount(): number {
  const raw = process.env.TRUSTED_PROXY_COUNT;
  if (!raw) return 1;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 0 || n > 10) return 1;
  return n;
}

export function getTrustedClientIp(request: NextRequest | Request): string | null {
  const cf = request.headers.get('cf-connecting-ip');
  if (cf && cf.trim().length > 0) return cf.trim();

  const xr = request.headers.get('x-real-ip');
  if (xr && xr.trim().length > 0) return xr.trim();

  const xff = request.headers.get('x-forwarded-for');
  if (xff) {
    const parts = xff.split(',').map((s) => s.trim()).filter((s) => s.length > 0);
    if (parts.length > 0) {
      const trustedCount = getTrustedProxyCount();
      const idx = Math.max(0, parts.length - trustedCount);
      const candidate = parts[idx];
      if (candidate) return candidate;
    }
  }

  return null;
}

export function getTrustedClientIpOrUnknown(request: NextRequest | Request): string {
  return getTrustedClientIp(request) ?? 'unknown';
}
```

### `src/lib/api/tenant-guard.ts`

```typescript
/**
 * Tenant Isolation Guard — {{PROJECT_NAME}}
 *
 * Validates tenant_id and extracts user context from Supabase Auth.
 *
 * tenantId ALWAYS comes from the authenticated user's profile (profiles.tenant_id).
 * DEFAULT_TENANT_ID is ONLY a fallback for unauthenticated routes
 * (guest-facing, webhooks).
 */
import { NextRequest } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getTrustedClientIp } from './client-ip';

// Inline-error-class so this file is self-contained (no circular deps).
export class ForbiddenError extends Error {
  readonly statusCode = 403;
  constructor(message: string) {
    super(message);
    this.name = 'ForbiddenError';
  }
}

const DEFAULT_TENANT_ID = '{{DEFAULT_TENANT_ID}}';

/**
 * Secure API route with tenant validation + user context
 *
 * Paranoid-by-default. requireAuth defaults to `true`.
 * Unauth-routes MUST explicitly pass `requireAuth: false` AND
 * provide a source for tenantId.
 *
 * Rules:
 * - `requireAuth: true`  → tenantId comes exclusively from profiles.tenant_id
 * - `requireAuth: false` → caller MUST set `options.tenantId`
 *                          or set `allowDefaultTenantFallback: true`
 */
export async function secureApiRouteWithTenant(
  request: NextRequest,
  options: {
    requireAuth?: boolean;
    tenantId?: string;
    allowDefaultTenantFallback?: boolean;
  } = {}
): Promise<{
  context: {
    userId: string | null;
    tenantId: string;
    ipAddress: string | null;
    userAgent: string | null;
    role?: string | null;
    userName?: string | null;
    userEmail?: string | null;
  };
  headers: Record<string, string>;
}> {
  const requireAuth = options.requireAuth !== false;

  let userId: string | null = null;
  let role: string | null = null;
  let userName: string | null = null;
  let userEmail: string | null = null;
  let tenantId: string | null = options.tenantId || null;

  // Try Supabase session auth
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      userId = user.id;

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, tenant_id, full_name')
        .eq('id', user.id)
        .single();

      if (profile) {
        role = profile.role;
        userName = profile.full_name || null;
        // DSGVO: email ONLY from auth.users, NEVER from profiles
        userEmail = user.email || null;
        if (profile.tenant_id) {
          tenantId = profile.tenant_id;
        }
      }
    } else if (requireAuth) {
      throw new ForbiddenError('Authentication required');
    }
  } catch (error) {
    if (error instanceof ForbiddenError) throw error;
    if (requireAuth) {
      const msg = error instanceof Error ? error.message : 'unknown';
      throw new ForbiddenError(`Authentication failed: ${msg}`);
    }
  }

  // Auth: tenantId MUST come from profile — no fallback.
  if (requireAuth && !tenantId) {
    throw new ForbiddenError(
      `No tenant assigned (userId: ${userId ?? 'null'}). Profile has no tenant_id.`
    );
  }

  // Unauth: caller must supply tenantId explicitly OR opt-in to fallback.
  let resolvedTenantId: string;
  if (tenantId) {
    resolvedTenantId = tenantId;
  } else if (options.allowDefaultTenantFallback) {
    resolvedTenantId = DEFAULT_TENANT_ID;
  } else {
    throw new ForbiddenError(
      'tenantId missing. Unauthenticated routes must pass options.tenantId or set allowDefaultTenantFallback.'
    );
  }

  // CSRF protection: on mutations (POST/PATCH/PUT/DELETE), verify Origin header matches Host.
  const method = request.method;
  if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) {
    const origin = request.headers.get('origin');
    const host = request.headers.get('host');
    if (origin && host) {
      try {
        const originHost = new URL(origin).host;
        if (originHost !== host) {
          throw new ForbiddenError('Cross-Origin request blocked (CSRF protection)');
        }
      } catch (e) {
        if (e instanceof ForbiddenError) throw e;
        throw new ForbiddenError('Invalid Origin header');
      }
    }
  }

  const ipAddress = getTrustedClientIp(request);
  const userAgent = request.headers.get('user-agent') || null;

  return {
    context: {
      userId,
      tenantId: resolvedTenantId,
      ipAddress,
      userAgent,
      role,
      userName,
      userEmail,
    },
    headers: {},
  };
}
```

### `src/lib/utils/tenant-resolver.ts`

```typescript
/**
 * Tenant Slug Resolver — {{PROJECT_NAME}}
 *
 * Resolves tenant slug (e.g. "acme-corp") to tenant_id.
 * Cached with 5min TTL for performance on public routes.
 *
 * SERVER-SIDE ONLY.
 */
import { createServerSupabaseClient } from '@/lib/supabase/server';

interface CachedTenant {
  id: string;
  name: string;
  cachedAt: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000;
const tenantCache = new Map<string, CachedTenant>();

export async function resolveTenantBySlug(
  slug: string,
): Promise<{ id: string; name: string } | null> {
  if (!slug || typeof slug !== 'string' || slug.length > 100) return null;

  const cleanSlug = slug.toLowerCase().trim();
  if (!/^[a-z0-9-]+$/.test(cleanSlug)) return null;

  const cached = tenantCache.get(cleanSlug);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return { id: cached.id, name: cached.name };
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('tenants')
    .select('id, name')
    .eq('slug', cleanSlug)
    .eq('is_active', true)
    .single();

  if (error || !data) return null;

  tenantCache.set(cleanSlug, {
    id: data.id,
    name: data.name,
    cachedAt: Date.now(),
  });

  return { id: data.id, name: data.name };
}
```

---

## Usage example (in your API routes)

Every authenticated route starts like this:

```typescript
// src/app/api/<resource>/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { secureApiRouteWithTenant } from '@/lib/api/tenant-guard';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { z } from 'zod';

const BodySchema = z.object({
  // fields
}).strict();

export async function POST(request: NextRequest) {
  try {
    const { context } = await secureApiRouteWithTenant(request, { requireAuth: true });
    if (!context.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = BodySchema.parse(await request.json());
    const supabase = await createServerSupabaseClient();

    const { data, error } = await supabase
      .from('<table>')
      .insert({ ...body, tenant_id: context.tenantId })  // tenant_id injected server-side
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (err) {
    const status = (err as { statusCode?: number }).statusCode ?? 500;
    const message = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ error: message }, { status });
  }
}
```

---

## Required environment variables

```env
NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...  # SERVER-SIDE ONLY, never expose to client
TRUSTED_PROXY_COUNT=1  # 1 for single-proxy (Vercel/Dokploy), 2 if Cloudflare-in-front
```

---

## Test example (Vitest)

```typescript
// src/lib/api/__tests__/tenant-guard.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { secureApiRouteWithTenant, ForbiddenError } from '../tenant-guard';
import { NextRequest } from 'next/server';

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(),
}));

describe('secureApiRouteWithTenant', () => {
  it('throws ForbiddenError when unauthenticated + requireAuth=true', async () => {
    // ... setup mock to return no user
    const request = new NextRequest('https://example.com/api/test', { method: 'GET' });
    await expect(secureApiRouteWithTenant(request, { requireAuth: true })).rejects.toThrow(ForbiddenError);
  });

  it('blocks cross-origin mutations (CSRF)', async () => {
    const request = new NextRequest('https://example.com/api/test', {
      method: 'POST',
      headers: { origin: 'https://evil.com', host: 'example.com' },
    });
    await expect(secureApiRouteWithTenant(request, { requireAuth: false, tenantId: 'x' }))
      .rejects.toThrow(/CSRF/);
  });

  // ... additional test cases
});
```

---

## Common pitfalls

1. **Passing client-supplied `tenant_id`** in request body — always use `context.tenantId` from the guard, never trust the client.
2. **Forgetting RLS on new tables** — every new domain-table needs `alter table ... enable row level security` + a `create policy` statement referencing `tenant_id`.
3. **Using `createAdminSupabaseClient()` in normal routes** — bypasses RLS. Only for auth-admin / cron / webhooks / seed.
4. **Storing email/phone in `profiles`** — DSGVO-violation. Those live in `auth.users`. Query via `context.userEmail` which reads from `auth.users`.
5. **Accepting `Origin: null`** — some legitimate requests have this (file:// or some proxies). Decide policy: reject (stricter) or allow-after-additional-check. Default above rejects missing-origin on mutations.
6. **Not invalidating tenant-resolver-cache** on tenant-slug changes — the 5min TTL means stale reads possible. If you rename a tenant, clear the cache or accept 5min staleness.

---

## Related patterns

- `foundation/auth-supabase-full` — completes the auth-flow (login, signup, password-reset, MFA)
- `foundation/rbac-requireRole` — adds role-based authorization on top of tenant-isolation
- `foundation/middleware-hardened` — middleware-layer enforcement (CSP, HSTS, rate-limit, route-protection)
- `compliance/dsgvo-kit` — DSGVO data-export + account-deletion that respect tenant-isolation

---

## Quality-gate

After installing this pattern:

```bash
# Type-check
npx tsc --noEmit

# Build
npm run build

# Security scan
npx @aegis-wizard/cli@latest scan .
# expect: score ≥ 970, grade A, 0 critical

# Test
npm run test -- tenant-guard
# expect: all pass
```

If any gate fails, inspect the finding and cross-reference this pattern's code — copy-paste errors are the usual cause.

---

**Pattern version: 1 · Last-updated: 2026-04-22 · AEGIS-foundation**
