-- AEGIS Security Helpers — canonical authorization primitives for SECURITY DEFINER RPCs.
--
-- WHY THIS EXISTS
-- ─────────────────────────────────────────────────────────────────────────
-- Functions in the `public` schema are reachable via PostgREST as
-- /rest/v1/rpc/<name>. When such a function is SECURITY DEFINER (runs
-- as the owner, typically superuser, bypassing RLS) AND accepts a
-- user-identity parameter (`p_user_id`), the function MUST verify
-- internally that the caller is authorized to act on that user.
--
-- This is the same vulnerability class surfaced by a real-world 2026
-- third-party Supabase audit: 21 RPCs accepted `p_user_id` but never checked it against
-- `auth.uid()`. Any signed-in user could call any RPC with another
-- user's id and act on their data (CWE-863, IDOR exploitable via
-- Supabase REST endpoint).
--
-- This file ships the canonical guard helper. Use it as the FIRST
-- statement in the body of every SECURITY DEFINER function that takes
-- a user-identity parameter:
--
--   CREATE FUNCTION public.do_thing(p_user_id uuid, ...)
--   RETURNS X LANGUAGE plpgsql SECURITY DEFINER
--   SET search_path = public, pg_temp
--   AS $$
--   BEGIN
--     PERFORM public._aegis_authorize_user(p_user_id);  -- ← MANDATORY
--     -- ... actual logic
--   END;
--   $$;
--
-- After CREATE FUNCTION, also REVOKE the default PUBLIC grant so anon
-- callers can't reach the function at all (defense-in-depth):
--
--   REVOKE ALL ON FUNCTION public.do_thing(uuid, ...) FROM PUBLIC, anon;
--   GRANT EXECUTE ON FUNCTION public.do_thing(uuid, ...) TO authenticated, service_role;
--
-- Why "REVOKE FROM PUBLIC, anon" not just "REVOKE FROM anon": the default
-- EXECUTE on a Postgres function is granted to PUBLIC, which transitively
-- includes anon, authenticated, AND service_role. REVOKE FROM anon does
-- NOT remove anon's access while the PUBLIC grant exists.
--
-- See:
--   * `packages/skills/skills/defensive/aegis-native/rls-defense/SKILL.md`
--     (Section 4a) — full pattern catalog with decision-tree
--   * AEGIS scanner `supabase-migration-checker` (rule SBM-001) catches
--     the missing-guard pattern at PR-review time.

CREATE OR REPLACE FUNCTION public._aegis_authorize_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
STABLE
SET search_path = ''
AS $$
BEGIN
  -- service_role bypass for legitimate server-side admin / cron paths.
  IF (SELECT auth.role()) = 'service_role' THEN
    RETURN;
  END IF;

  -- everyone else must be authenticated AND acting on their own user_id.
  IF (SELECT auth.uid()) IS NULL OR (SELECT auth.uid()) <> p_user_id THEN
    RAISE EXCEPTION 'AEGIS-AUTHZ: caller % may not act on user %',
      coalesce((SELECT auth.uid())::text, 'anon'), p_user_id
      USING ERRCODE = '42501';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public._aegis_authorize_user(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public._aegis_authorize_user(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public._aegis_authorize_user(uuid) IS
'AEGIS canonical RPC guard. Call as PERFORM public._aegis_authorize_user(p_user_id) at the top of every SECURITY DEFINER function that accepts a user-identity parameter. Raises 42501 unless caller is service_role or auth.uid() = p_user_id. See packages/rules/supabase/RULES.md for the full pattern catalog.';
