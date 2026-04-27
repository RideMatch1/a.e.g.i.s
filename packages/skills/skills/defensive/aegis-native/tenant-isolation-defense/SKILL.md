<!-- aegis-local: AEGIS-native skill, MIT-licensed; mirrors @aegis-wizard/cli multi-tenant pattern + addresses AEGIS scanner finding: tenant-isolation-checker (CWE-639). -->

---
name: defensive-tenant-isolation
description: "Multi-tenant SaaS isolation methodology. Covers tenant_id flow design, secureApiRouteWithTenant primitive usage, JWT-based tenant injection patterns, defense against IDOR + tenant-bypass, AEGIS tenant-isolation-checker remediation, public-route exception handling, and regression-test discipline. Use when designing multi-tenant Supabase or PostgreSQL applications, fixing tenant-isolation-checker findings, or auditing for cross-tenant data leakage."
---

# Tenant Isolation Defense — Multi-Tenant SaaS Methodology

## When to use this skill

- Designing a new multi-tenant SaaS — get the isolation invariant right from commit 0.
- Reviewing an existing multi-tenant codebase for cross-tenant exposure.
- Fixing AEGIS `tenant-isolation-checker` (CWE-639) findings.
- Auditing IDOR-class findings (CWE-639 Insecure Direct Object Reference).
- Hardening before a SOC 2 audit.

## The core invariant

**Every database query touching tenant-scoped data MUST filter by `tenant_id`, AND the `tenant_id` MUST come from the authenticated session — never from request input.**

Two failure modes:

1. **Missing filter** — query returns rows from all tenants. Catastrophic.
2. **Filter sourced from request input** — attacker sends `?tenant_id=victim-tenant-uuid` and reads anyone's data. Equally catastrophic.

## The secure pattern

### Server-side primitive

```typescript
// lib/security/secureApiRouteWithTenant.ts (AEGIS scaffold ships this)

import { createClient } from '@supabase/supabase-js';

export async function secureApiRouteWithTenant<T>(
  req: Request,
  handler: (ctx: { supabase: SupabaseClient; userId: string; tenantId: string }) => Promise<T>
): Promise<Response> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } }
  );

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return new Response('Unauthorized', { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('tenant_id')
    .eq('id', user.id)
    .single();

  if (!profile?.tenant_id) {
    return new Response('Forbidden', { status: 403 });
  }

  // tenant_id is always derived from the session, never from the request body
  return handler({
    supabase,
    userId: user.id,
    tenantId: profile.tenant_id,
  });
}
```

### Usage in API routes

```typescript
// app/api/invoices/route.ts

export async function GET(req: Request) {
  return secureApiRouteWithTenant(req, async ({ supabase, tenantId }) => {
    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('tenant_id', tenantId);  // tenant_id from session, NOT from query params

    if (error) return Response.json({ error }, { status: 500 });
    return Response.json(data);
  });
}
```

## Anti-patterns the scanner flags

### Anti-pattern 1 — Missing `tenant_id` filter

```typescript
// FLAGGED by tenant-isolation-checker (CWE-639)
const { data } = await supabase
  .from('invoices')
  .select('*');  // returns ALL tenants' invoices — cross-tenant leak

// FIX
const { data } = await supabase
  .from('invoices')
  .select('*')
  .eq('tenant_id', sessionTenantId);
```

### Anti-pattern 2 — `tenant_id` from request input

```typescript
// FLAGGED by tenant-isolation-checker (CWE-639)
const { searchParams } = new URL(req.url);
const tenantId = searchParams.get('tenant_id');
const { data } = await supabase
  .from('invoices')
  .select('*')
  .eq('tenant_id', tenantId);  // attacker sets ?tenant_id=victim — IDOR

// FIX — always source tenant_id from session
const { tenantId } = await getAuthenticatedSession(req);
```

### Anti-pattern 3 — `tenant_id` in mutation body

```typescript
// FLAGGED — mass-assignment + tenant-isolation
const body = await req.json();
await supabase.from('invoices').insert(body);  // body can carry attacker's tenant_id

// FIX — strip tenant_id from input, inject from session
const body = MutationSchema.parse(await req.json());
await supabase.from('invoices').insert({
  ...body,
  tenant_id: sessionTenantId,  // session-sourced, overrides any body field
});
```

## Public-route exceptions (rare, document each)

A small set of routes legitimately operate without a tenant scope:

- Auth/login endpoints (no tenant context exists yet at this point)
- Public marketing pages (no DB read at all, ideally)
- Health-check endpoints (no DB read)
- Webhook receivers from trusted vendors (verified by signature, then dispatched into tenant-scoped logic)

Document each exception explicitly:

```typescript
// app/api/auth/login/route.ts
// AEGIS-EXCEPTION: tenant-isolation N/A — login endpoint runs before tenant context exists.
// Verified safe via signed-cookie + supabase-auth-helpers; no direct DB writes here.
export async function POST(req: Request) {
  /* ... */
}
```

The `aegis scan` config supports per-finding suppression with rationale; see `docs/suppressions.md`.

## Multi-axis tenant scoping

Some apps need MORE than `tenant_id` — for example, organizations within tenants, or divisions within organizations:

```sql
CREATE TABLE invoices (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,        -- Customer org
  organization_id uuid,            -- Sub-unit within the customer
  user_id uuid NOT NULL,           -- Creator
  -- ...
);

-- RLS policy enforces all three when applicable
CREATE POLICY "tenant + org + user scoping"
ON public.invoices FOR SELECT
USING (
  tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid())
  AND (organization_id IS NULL OR organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ))
);
```

## Regression-test pattern

```typescript
// __tests__/tenant-isolation.test.ts
describe('Tenant Isolation', () => {
  it('user from tenant A cannot read tenant B documents', async () => {
    await seedTenant('A', { documents: [{ id: 'a1' }] });
    await seedTenant('B', { documents: [{ id: 'b1' }] });

    const sessionA = await createSession('A');
    const res = await fetch('/api/documents', {
      headers: { Authorization: `Bearer ${sessionA.token}` },
    });
    const docs = await res.json();
    expect(docs).toHaveLength(1);
    expect(docs[0].id).toBe('a1');  // not b1
  });

  it('tenant_id in request body is ignored', async () => {
    await seedTenant('A', {});
    await seedTenant('B', { documents: [{ id: 'b1' }] });

    const sessionA = await createSession('A');
    const res = await fetch('/api/documents', {
      method: 'POST',
      headers: { Authorization: `Bearer ${sessionA.token}` },
      body: JSON.stringify({ tenant_id: 'B', name: 'attack' }),  // attacker tries to set tenant
    });
    const created = await res.json();
    expect(created.tenant_id).toBe('A');  // session-sourced wins
  });
});
```

Run this on every CI run. Tenant-isolation regressions silently leak data; you need a test that fails LOUDLY when the invariant breaks.

## How AEGIS helps

- `tenant-isolation-checker` (CWE-639) — flags Supabase queries missing `tenant_id` and queries where `tenant_id` is sourced from request input.
- `mass-assignment-checker` (CWE-915) — flags unvalidated body → `.insert()`.
- `aegis-wizard/cli` scaffold — ships `secureApiRouteWithTenant`, the `tenants` + `profiles` schema with the auto-profile-on-signup trigger, and an exemplary API route demonstrating the composition pattern.

## See also

- `defensive-rls-defense` skill — the RLS counterpart that complements API-route-level isolation.
- AEGIS patterns library — `docs/patterns/index.md` § "Multi-tenant Supabase pattern".
- AEGIS-finding suppression docs — `docs/suppressions.md`.
