---
name: rbac-requirerole
category: foundation
title: Role-Based Access Control with requireRole()
description: >
  Layered RBAC on top of tenant-isolation. Defense-in-depth: secureApiRouteWithTenant
  checks auth+tenant, requireRole() checks permission. Sensitive fields are filtered
  via filterSensitiveFields() based on requester's role.
version: 1
dependencies:
  npm: []
placeholders:
  - name: PROJECT_NAME
    description: The project identifier (kebab-case, from wizard). Used in file-headers and path hints.
    required: true
  - name: ROLES_UNION
    description: TypeScript union-literal of the app's role strings (e.g. `'admin' | 'manager' | 'user'`).
    default: "'admin' | 'manager' | 'user'"
    required: true
  - name: SENSITIVE_PERSONAL_FIELDS_JSON
    description: JSON-encoded list of fields that only managers+owners may read (IBAN, salary, SSN).
    default: '[]'
    type: json
  - name: PUBLIC_PROFILE_FIELDS_JSON
    description: JSON-encoded list of profile fields safe for any authenticated user to read.
    default: '["id", "full_name", "avatar_url", "role", "is_active", "created_at"]'
    type: json
brief_section: Foundation
estimated_files: 1
tags: [rbac, authorization, defense-in-depth]
related:
  - foundation/multi-tenant-supabase
  - foundation/auth-supabase-full
---

# Role-Based Access Control with requireRole()

After `secureApiRouteWithTenant()` confirms "this user is authenticated and belongs to tenant X", you still need to know WHAT they're allowed to do. `requireRole()` is the second line of defense.

**Defense-in-depth rule:** Every sensitive API route calls BOTH:
1. `secureApiRouteWithTenant()` — authentication + tenant-isolation
2. `requireRole(context, [allowed-roles])` — role-permission

Missing either one = vulnerability.

---

## Commands to run

No new dependencies. This pattern is pure-TypeScript.

---

## Files to create

### `src/lib/api/require-role.ts`

```typescript
/**
 * Role-Based Access Control Helper — {{PROJECT_NAME}}
 *
 * Defense-in-Depth: secureApiRouteWithTenant checks auth+tenant only, NOT role.
 * EVERY route with sensitive data MUST call requireRole() explicitly.
 */
import { ForbiddenError } from './tenant-guard';

export type Role = {{ROLES_UNION}};  // e.g. 'admin' | 'manager' | 'user'

export interface RoleContext {
  userId: string | null;
  role?: string | null;
}

/**
 * Throw if context's role is not in allowedRoles.
 * Call after secureApiRouteWithTenant().
 */
export function requireRole(context: RoleContext, allowedRoles: readonly Role[]): void {
  if (!context.role) {
    throw new ForbiddenError('No role assigned — contact admin');
  }
  if (!allowedRoles.includes(context.role as Role)) {
    throw new ForbiddenError('Insufficient permissions for this action');
  }
}

/**
 * Allow the request if:
 *   (a) context.userId === targetUserId (self-access), OR
 *   (b) context.role is in allowedRoles.
 *
 * Common pattern for user-profile-edit where user can edit own + managers can edit any.
 */
export function requireRoleOrSelf(
  context: RoleContext,
  allowedRoles: readonly Role[],
  targetUserId: string | null,
): void {
  if (context.userId && targetUserId && context.userId === targetUserId) return;
  requireRole(context, allowedRoles);
}

export function hasRole(context: RoleContext, allowedRoles: readonly Role[]): boolean {
  if (!context.role) return false;
  return allowedRoles.includes(context.role as Role);
}

export function isManager(context: RoleContext): boolean {
  return hasRole(context, ['admin', 'manager'] as readonly Role[]);
}

export function isAdmin(context: RoleContext): boolean {
  return hasRole(context, ['admin'] as readonly Role[]);
}

// ============================================================================
// Sensitive-field filtering
// ============================================================================

/**
 * Fields that only admins + the field-owner may see.
 * Customize to your domain. Common examples in SENSITIVE_PERSONAL_FIELDS below.
 */
export const SENSITIVE_PERSONAL_FIELDS = {{SENSITIVE_PERSONAL_FIELDS_JSON}} as const;

/**
 * Safe fields for any authenticated user in the same tenant to see.
 */
export const PUBLIC_PROFILE_FIELDS = {{PUBLIC_PROFILE_FIELDS_JSON}} as const;

/**
 * Given a profile-row and the requester's context, remove sensitive fields
 * unless requester is manager or the profile's owner.
 *
 * Use at API-response-boundary for profile endpoints.
 */
export function filterSensitiveFields<T extends Record<string, unknown> & { id?: unknown }>(
  profile: T,
  context: RoleContext,
): T {
  if (isManager(context)) return profile;
  if (context.userId && profile.id === context.userId) return profile;

  const filtered = { ...profile };
  for (const field of SENSITIVE_PERSONAL_FIELDS) {
    if (field in filtered) delete (filtered as Record<string, unknown>)[field];
  }
  return filtered;
}

/**
 * Inverse — select only the public-safe fields from a row.
 * Use for public-facing endpoints (e.g. team-list visible to all users).
 */
export function selectPublicFields<T extends Record<string, unknown>>(profile: T): Partial<T> {
  const result: Partial<T> = {};
  for (const field of PUBLIC_PROFILE_FIELDS) {
    if (field in profile) (result as Record<string, unknown>)[field as string] = profile[field as string];
  }
  return result;
}
```

---

## Usage examples

### Authenticated route with role-gate

```typescript
// src/app/api/admin/customers/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { secureApiRouteWithTenant } from '@/lib/api/tenant-guard';
import { requireRole, filterSensitiveFields } from '@/lib/api/require-role';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const { context } = await secureApiRouteWithTenant(request, { requireAuth: true });
  if (!context.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // ✅ Second layer: require manager or admin
  requireRole(context, ['admin', 'manager']);

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('tenant_id', context.tenantId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Filter sensitive fields based on role
  const filtered = data.map((row) => filterSensitiveFields(row, context));
  return NextResponse.json(filtered);
}
```

### Self-edit OR admin pattern

```typescript
// src/app/api/admin/profiles/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { secureApiRouteWithTenant } from '@/lib/api/tenant-guard';
import { requireRoleOrSelf } from '@/lib/api/require-role';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { z } from 'zod';

const PatchSchema = z.object({
  full_name: z.string().min(2).max(120).optional(),
  avatar_url: z.string().url().optional(),
}).strict();

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { context } = await secureApiRouteWithTenant(request, { requireAuth: true });
  if (!context.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // User can edit own profile; managers can edit any
  requireRoleOrSelf(context, ['admin', 'manager'], id);

  const body = PatchSchema.parse(await request.json());
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('profiles')
    .update(body)
    .eq('id', id)
    .eq('tenant_id', context.tenantId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
```

### UI-level role-based rendering

```typescript
// src/components/admin/some-page.tsx
'use client';

import { useEffect, useState } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';

export function AdminOnlyButton() {
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const supabase = createBrowserSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      setRole(data?.role ?? null);
    })();
  }, []);

  if (role !== 'admin') return null;
  return <button>Admin-only action</button>;
}
```

*Note:* UI-level role checks are convenience only. The API route MUST also enforce via `requireRole()`. Never trust the client.

---

## Sensible defaults per SENSITIVE_PERSONAL_FIELDS

If your project stores HR/financial data, common sensitive fields:
```typescript
// Example for HR-data (adjust to your domain)
[
  'iban', 'bic', 'bank_name',
  'monthly_salary', 'hourly_rate', 'tax_class', 'tax_id',
  'social_security_number', 'ssn',
  'passport_number', 'personal_id_number',
  'health_insurance', 'health_insurance_number',
  'birth_date', 'date_of_birth',
  'address_street', 'address_zip', 'address_city',
  'private_email', 'private_phone',
  'emergency_contact_name', 'emergency_contact_phone',
  'dietary_preferences', 'religion', 'marital_status',
]
```

Your wizard-generated list reflects your specific domain.

---

## Test example

```typescript
// src/lib/api/__tests__/require-role.test.ts
import { describe, it, expect } from 'vitest';
import { requireRole, requireRoleOrSelf, isManager, filterSensitiveFields } from '../require-role';
import { ForbiddenError } from '../tenant-guard';

describe('requireRole', () => {
  it('throws when role missing', () => {
    expect(() => requireRole({ userId: 'u1', role: null }, ['admin'])).toThrow(ForbiddenError);
  });

  it('throws when role not in allowedRoles', () => {
    expect(() => requireRole({ userId: 'u1', role: 'user' }, ['admin'])).toThrow(ForbiddenError);
  });

  it('allows when role matches', () => {
    expect(() => requireRole({ userId: 'u1', role: 'admin' }, ['admin'])).not.toThrow();
  });
});

describe('requireRoleOrSelf', () => {
  it('allows self-edit regardless of role', () => {
    expect(() => requireRoleOrSelf({ userId: 'u1', role: 'user' }, ['admin'], 'u1')).not.toThrow();
  });

  it('allows admin to edit others', () => {
    expect(() => requireRoleOrSelf({ userId: 'admin1', role: 'admin' }, ['admin'], 'u1')).not.toThrow();
  });

  it('blocks user-editing-other', () => {
    expect(() => requireRoleOrSelf({ userId: 'u1', role: 'user' }, ['admin'], 'u2')).toThrow();
  });
});

describe('filterSensitiveFields', () => {
  it('passes all fields to managers', () => {
    const profile = { id: 'u1', full_name: 'A', iban: 'DE123' };
    const result = filterSensitiveFields(profile, { userId: 'mgr', role: 'manager' });
    expect(result.iban).toBe('DE123');
  });

  it('passes all fields to the owner', () => {
    const profile = { id: 'u1', full_name: 'A', iban: 'DE123' };
    const result = filterSensitiveFields(profile, { userId: 'u1', role: 'user' });
    expect(result.iban).toBe('DE123');
  });

  it('strips sensitive fields from non-owner non-manager', () => {
    const profile = { id: 'u1', full_name: 'A', iban: 'DE123' };
    const result = filterSensitiveFields(profile, { userId: 'u2', role: 'user' });
    expect(result.iban).toBeUndefined();
    expect(result.full_name).toBe('A');
  });
});
```

---

## Common pitfalls

1. **Calling `secureApiRouteWithTenant()` but forgetting `requireRole()`.** Result: anyone authenticated can hit the route regardless of role. Always both.
2. **Checking role client-side only.** The API MUST verify. Client-checks are UX-convenience.
3. **Not using `filterSensitiveFields()` on responses.** A user queries their own profile and sees another user's sensitive data because the response-shape leaked.
4. **Adding a new role without updating the `Role` type.** TypeScript-strict catches this if `Role` is a closed union. If you use `string`, you'll silently accept typos.
5. **Using `hasRole()` as the only gate.** `hasRole()` is a check, `requireRole()` is an assertion. Prefer `requireRole()` at route-boundary because it throws (caller-code cleaner).

---

## Related patterns

- `foundation/multi-tenant-supabase` — provides `secureApiRouteWithTenant()` prerequisite
- `foundation/auth-supabase-full` — the auth-flows that populate the role
- `compliance/dsgvo-kit` — uses `filterSensitiveFields()` for data-export

---

## Quality-gate

```bash
npm run test -- require-role    # expect all pass
npx aegis scan .                 # expect score ≥ 970
grep -rn "requireRole" src/app/api | wc -l   # expect non-zero (every sensitive route)
```

---

**Pattern version: 1 · Last-updated: 2026-04-22 · AEGIS-foundation**
