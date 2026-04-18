-- Reference-implementation extract — generic Next.js+Supabase primitive.
-- Defines the minimum viable multi-tenant schema + RLS policies.
--
-- Tables: tenants, profiles, audit_log
-- RLS:    enabled on all; service_role bypass + authenticated read-scoped-to-own-tenant.
-- Writes: authenticated users cannot INSERT/UPDATE/DELETE — server-side only via service_role.
--         This makes audit_log effectively append-only from the client perspective.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- tenants — multi-tenant boundary.
CREATE TABLE IF NOT EXISTS public.tenants (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug       text UNIQUE NOT NULL,
  name       text NOT NULL,
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- profiles — user ↔ tenant membership (no PII; email stays in auth.users).
CREATE TABLE IF NOT EXISTS public.profiles (
  id         uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id  uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  role       text NOT NULL CHECK (role IN ('admin', 'manager', 'member')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_profiles_tenant_id ON public.profiles(tenant_id);

-- audit_log — append-only action trail (nullable user_id for system-emitted events).
CREATE TABLE IF NOT EXISTS public.audit_log (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action     text NOT NULL,
  metadata   jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_log_tenant_created ON public.audit_log(tenant_id, created_at DESC);

-- Row Level Security.
ALTER TABLE public.tenants   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- service_role bypass: server-side handlers use the service key and must
-- read/write every row across tenants.
CREATE POLICY service_role_full_access_tenants ON public.tenants
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_full_access_profiles ON public.profiles
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_full_access_audit_log ON public.audit_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- authenticated SELECT: users may only read rows belonging to their own tenant.
-- No INSERT/UPDATE/DELETE policies are defined — writes are denied by default
-- and must route through server-side service_role handlers.
CREATE POLICY member_read_own_tenants ON public.tenants
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.tenant_id = tenants.id
    )
  );
CREATE POLICY member_read_own_profiles ON public.profiles
  FOR SELECT TO authenticated
  USING (profiles.id = auth.uid());
CREATE POLICY member_read_own_audit_log ON public.audit_log
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.tenant_id = audit_log.tenant_id
    )
  );
