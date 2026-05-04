-- Service role bypasses RLS on every table — should be the only role with this attribute,
-- and only via Supabase's managed `service_role`. Never grant BYPASSRLS to a custom role.
CREATE ROLE app_admin LOGIN PASSWORD 'redacted-in-vault' BYPASSRLS;
GRANT app_admin TO authenticated;
