CREATE OR REPLACE FUNCTION public.delete_user_account(p_user_id uuid)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public._aegis_authorize_user(p_user_id);
  DELETE FROM public.users WHERE id = p_user_id;
END;
$$;

-- VULNERABLE: granted to PUBLIC without REVOKE first → anonymous can call
GRANT EXECUTE ON FUNCTION public.delete_user_account(uuid) TO public;
