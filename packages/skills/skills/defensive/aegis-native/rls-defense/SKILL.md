<!-- aegis-local: AEGIS-native skill, MIT-licensed; mirrors @aegis-wizard/cli RLS-defense pattern + addresses AEGIS scanner findings: rls-bypass-checker (CWE-863), tenant-isolation-checker (CWE-639). -->

---
name: defensive-rls-defense
description: "Supabase Row-Level Security (RLS) hardening methodology. Covers RLS policy design, auth.uid() vs auth.jwt(), service-role-key safety, .rpc() function security, AEGIS rls-bypass-checker remediation, multi-tenant isolation patterns, defensive defaults, regression test patterns, and incident-response when RLS is bypassed. Use when designing or auditing Supabase schemas, fixing rls-bypass-checker findings, hardening multi-tenant SaaS applications, or responding to suspected cross-tenant data leakage."
---

# RLS Defense — Supabase Row-Level Security Methodology

## When to use this skill

- Designing a new Supabase project — set up RLS correctly from commit 0.
- Reviewing an existing schema — verify RLS policies actually enforce isolation.
- Fixing AEGIS `rls-bypass-checker` (CWE-863) or `tenant-isolation-checker` (CWE-639) findings.
- Responding to suspected cross-tenant data leakage incidents.
- Hardening before a security audit (SOC 2 / ISO 27001 / PCI-DSS).

## The core invariant

**Every table that holds user-scoped or tenant-scoped data MUST have RLS enabled AND at least one policy that bounds visibility to the requesting user/tenant.** Tables without RLS are a critical exposure; tables with RLS but no policies are equally critical (RLS-enabled-without-policy denies everything but is easy to reverse with a wildcard policy that opens the door).

## Defensive design checklist

### 1. RLS-enabled-by-default discipline

```sql
-- Enable RLS on every table that holds user/tenant data
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- Verify after every migration
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
-- Every row should show rowsecurity = true (except for purely-public reference tables)
```

### 2. Policy patterns that actually isolate

**Owner-scoped (user owns rows):**

```sql
CREATE POLICY "Users see only their own rows"
ON public.documents FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users insert only with their own user_id"
ON public.documents FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update only their own rows"
ON public.documents FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete only their own rows"
ON public.documents FOR DELETE
USING (auth.uid() = user_id);
```

**Tenant-scoped (multi-tenant isolation):**

```sql
-- Pattern: tenant_id flows through profiles → all tables
CREATE POLICY "Tenant-scoped read"
ON public.invoices FOR SELECT
USING (
  tenant_id IN (
    SELECT tenant_id FROM public.profiles
    WHERE profiles.id = auth.uid()
  )
);

-- Same shape for INSERT/UPDATE/DELETE with WITH CHECK on tenant_id.
```

### 3. Anti-patterns that break isolation

**Avoid `auth.jwt() ->> 'role'` for authorization decisions** — JWTs are operator-controllable and the token's claim can be spoofed if your `service_role` ever reaches client-side code.

**Avoid `service_role` keys in API routes that handle user input** — `service_role` bypasses RLS entirely. Every API route that uses `service_role` needs hand-rolled authorization to replace what RLS would have enforced.

**Avoid `.rpc()` with template-literal function names**:

```typescript
// BAD: function name is interpolated, attacker can rename target function
await supabase.rpc(`get_${userInput}`, params)

// GOOD: function name is a literal
await supabase.rpc('get_user_documents', { user_id: validatedId })
```

The `template-sql-checker` and `rls-bypass-checker` flag both shapes; this skill is the remediation methodology.

### 4. RPC function security

PostgreSQL functions can run with `SECURITY DEFINER` (run as definer's role, often superuser) or `SECURITY INVOKER` (run as caller's role, default).

```sql
-- DEFAULT — function runs as caller, RLS applies
CREATE FUNCTION public.get_user_docs()
RETURNS SETOF documents
LANGUAGE sql
SECURITY INVOKER  -- explicit, even if default
AS $$
  SELECT * FROM documents WHERE user_id = auth.uid();
$$;

-- SECURITY DEFINER ONLY when you need to break RLS for a specific elevated operation
-- AND every parameter is pre-validated
CREATE FUNCTION public.admin_audit_logs(target_user uuid)
RETURNS SETOF audit_log
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public  -- prevent search-path-poisoning
AS $$
BEGIN
  -- Hand-rolled authorization check because RLS is bypassed
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  RETURN QUERY SELECT * FROM audit_log WHERE user_id = target_user;
END;
$$;
```

**SECURITY DEFINER without `SET search_path` is a search-path-poisoning vulnerability** — the function inherits the caller's search_path and an attacker who can prepend their own schema can hijack the function.

### 4a. SECURITY DEFINER RPC + `p_user_id` parameter — canonical authz guard

Pattern surfaced in production audits (CWE-863, IDOR via RPC): SECURITY DEFINER RPCs in the `public` schema accept a `p_user_id` parameter without verifying it equals `auth.uid()`. Every signed-in user can then call the RPC with any other user's id and act on their data:

- spend OTHER users' loyalty points (`purchase_item(other_uid, ...)`)
- award themselves arbitrary points (`award_points(my_uid, 999999)`)
- redeem rewards or finish duels on behalf of other users

These are **silent vulnerabilities** until Supabase ships a linter rule that surfaces them. Splinter rules `0028_anon_security_definer_function_executable` + `0029_authenticated_security_definer_function_executable` (added in early 2026) flag the privilege side, but they are argument-blind — a function can be linter-clean but still missing the internal `auth.uid()` check. Static migration audit catches the body-side gap at PR review.

**Canonical fix — install a single guard helper, then PERFORM it at the top of every RPC that takes a user-identity parameter:**

```sql
-- One helper, owned by you, called everywhere
CREATE OR REPLACE FUNCTION public._aegis_authorize_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
STABLE
SET search_path = ''
AS $$
BEGIN
  IF (SELECT auth.role()) = 'service_role' THEN
    RETURN;  -- server-side admin / cron bypass
  END IF;
  IF (SELECT auth.uid()) IS NULL OR (SELECT auth.uid()) <> p_user_id THEN
    RAISE EXCEPTION 'AEGIS-AUTHZ: caller % may not act on user %',
      coalesce((SELECT auth.uid())::text, 'anon'), p_user_id
      USING ERRCODE = '42501';
  END IF;
END;
$$;

-- Every RPC that touches another user's data calls this on entry
CREATE FUNCTION public.purchase_arena_item(p_user_id uuid, p_item_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM public._aegis_authorize_user(p_user_id);  -- ← MANDATORY first line
  -- ... actual logic
END $$;
```

**Linter-clean grants — REVOKE from PUBLIC, not from anon:**
The default `EXECUTE` privilege on a SQL function is granted to `PUBLIC`, which transitively includes `anon`, `authenticated`, AND `service_role`. `REVOKE EXECUTE FROM anon` does **not** remove anon's access while the PUBLIC grant exists. To restrict to `authenticated` + `service_role`, you must:

```sql
REVOKE ALL  ON FUNCTION public.<name>(<args>) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.<name>(<args>) TO authenticated, service_role;
```

**Bulk programmatic application** (idempotent — auto-discovers all guarded RPCs):

```sql
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.prosecdef = true
       AND p.prorettype <> 'trigger'::regtype
       AND p.prosrc ~ '_aegis_authorize_user'  -- only the guarded ones
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%I(%s) FROM PUBLIC, anon',
                   r.proname, r.args);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO authenticated, service_role',
                   r.proname, r.args);
  END LOOP;
END $$;
```

**Decision tree for a SECURITY DEFINER function in `public`:**

| Function shape | Treatment |
|---|---|
| Returns `trigger` (called only by trigger system) | `REVOKE EXECUTE FROM PUBLIC, anon, authenticated`. Triggers run as table-owner regardless. |
| Cron / batch / admin-only (`cleanup_*`, `auto_unban_*`, `expire_*`) | `REVOKE FROM PUBLIC, anon, authenticated`. Only `service_role` may call. No internal guard needed. |
| User-callable RPC with `p_user_id` parameter | Inject `PERFORM _aegis_authorize_user(p_user_id);` at top. `REVOKE FROM PUBLIC, anon`; `GRANT TO authenticated, service_role`. |
| User-callable RPC with resource ID (`p_dog_id`, `p_post_id`) | Verify caller-ownership (or prefer `SECURITY INVOKER` and let RLS filter). |
| Read-only data accessor over RLS-protected tables | Switch to `SECURITY INVOKER`. RLS handles authz. |
| PostGIS / extension-owned C functions | Cannot revoke (extension owns them). Move PostGIS to `extensions` schema instead. |

**Why this surfaces in established projects without warning:** the Supabase database linter is rule-versioned. New rules ship without a code-change in your repo, and they retroactively flag patterns that were always exposures but were never explicitly checked. **Run `get_advisors` (or the SQL surrogates above) on every deploy**, not just at release.

### 5. Defensive testing — every policy needs a regression test

```sql
-- Test as user A
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = 'user-a-uuid';

SELECT count(*) FROM documents;  -- should equal A's row count, not all rows

SET LOCAL request.jwt.claim.sub = 'user-b-uuid';
SELECT count(*) FROM documents;  -- should equal B's row count, NOT A's
```

Wire this into your test suite. AEGIS doesn't run live SQL tests, but `tenant-isolation-checker` and `rls-bypass-checker` flag the patterns at code-review time.

## Incident response — RLS bypassed

Order of operations:

1. **Disclose internally** — RLS bypass = potential data breach; engage legal + DPO immediately.
2. **Stop the bleeding** — disable the affected route or endpoint at the gateway level (Vercel / Cloudflare / load balancer) BEFORE patching code.
3. **Audit log forensics** — Supabase logs every RLS-context query; pull the affected window's logs to bound the exposure.
4. **Determine reach** — for each suspect query, identify the rows visible to each user-context vs the rows the user should have seen.
5. **Patch and re-deploy** — fix the policy, re-deploy, verify with regression tests.
6. **Notify affected users** — per GDPR Art. 33 within 72 hours of becoming aware.

## How AEGIS scanners help

| Scanner | What it catches |
|---|---|
| `rls-bypass-checker` (CWE-863) | `service_role` usage in API routes, `.rpc()` template-injection patterns |
| `tenant-isolation-checker` (CWE-639) | Supabase queries missing `tenant_id` filter |
| `template-sql-checker` (CWE-89) | Template-literal SQL injection in `.rpc()` / `.execute()` / `.query()` / `.$queryRawUnsafe()` |
| `mass-assignment-checker` (CWE-915) | Unvalidated `request.json()` flowing into `.insert()` |
| `auth-enforcer` (CWE-285, 306) | API routes without auth guards |

Run `aegis scan .` on your repo; fix everything `rls-bypass-checker` and `tenant-isolation-checker` flag before going to production.

## Complementary external skill (mandatory)

This AEGIS skill covers the **security-remediation layer** —
scanner-finding mapping, incident-response, multi-tenant
isolation invariants. It does **not** cover RLS performance
optimization in depth, because that is the upstream Supabase
team's domain and is maintained as a separate skill.

When working on RLS at any depth, install the upstream Supabase
skill package once, globally:

```bash
npx skills add supabase/agent-skills -g -y
```

That ships
[`supabase-postgres-best-practices`](https://github.com/supabase/agent-skills/tree/main/skills/supabase-postgres-best-practices),
whose three `security-*` reference files complement this skill:

- `references/security-rls-basics.md` — the canonical RLS-enable + policy pattern as Supabase recommends it.
- `references/security-rls-performance.md` — the `(select auth.uid())` wrap that turns a per-row function call into a single-evaluation cached call (5–10x faster on large tables), security-definer helper functions for complex membership checks, and the discipline of indexing every column referenced inside an RLS policy.
- `references/security-privileges.md` — least-privilege role design and GRANT minimization, the layer beneath RLS.

When the AEGIS `rls-bypass-checker` flags a finding and you have a working policy fix, consult the upstream `security-rls-performance.md` next to ensure the fixed policy is also performant on production-sized tables. RLS that is correct but slow gets disabled by stressed engineers, which re-opens the security hole.

## See also

- AEGIS scaffold's RLS bootstrap migration — `aegis new <project>` ships a `tenants` + `profiles` table + auto-profile-on-signup trigger pre-wired.
- AEGIS patterns library — `docs/patterns/index.md` documents the multi-tenant Supabase pattern catalog.
- Upstream Supabase docs — https://supabase.com/docs/guides/auth/row-level-security
