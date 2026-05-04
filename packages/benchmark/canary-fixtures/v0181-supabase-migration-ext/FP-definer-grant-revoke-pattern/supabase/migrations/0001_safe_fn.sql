CREATE OR REPLACE FUNCTION public.get_user_dashboard(p_user_id uuid)
  RETURNS json
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
AS $$
DECLARE
  result json;
BEGIN
  PERFORM public._aegis_authorize_user(p_user_id);
  SELECT json_build_object('id', id, 'name', display_name)
    INTO result
  FROM public.profiles
  WHERE id = p_user_id;
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_user_dashboard(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_dashboard(uuid) TO authenticated, service_role;
