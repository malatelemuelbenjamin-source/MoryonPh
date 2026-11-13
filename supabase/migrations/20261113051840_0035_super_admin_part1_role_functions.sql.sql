/*
# Super Admin Control Center — Part 1: security helper functions

1. Purpose
Server-side role checks for the Super Admin control center. Roles are stored
in auth users' app_metadata, which client-side APIs cannot modify — this
prevents privilege escalation by construction.

2. New Functions (security definer, locked search_path)
- is_super_admin(): true when the caller's JWT app_metadata has super_admin.
- is_admin(): super admin OR admin flag.
- is_moderator(): admin OR moderator flag.
- require_super_admin(): raises an exception when caller is not super admin.

3. Security changes
- EXECUTE revoked from PUBLIC and anon on all four functions; granted to
  authenticated only. No tables are created or modified in this migration.
*/

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'super_admin')::boolean,
    false
  )
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_super_admin()
    OR COALESCE((auth.jwt() -> 'app_metadata' ->> 'admin')::boolean, false)
$$;

CREATE OR REPLACE FUNCTION public.is_moderator()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin()
    OR COALESCE((auth.jwt() -> 'app_metadata' ->> 'moderator')::boolean, false)
$$;

CREATE OR REPLACE FUNCTION public.require_super_admin()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Requires super admin privileges' USING ERRCODE = '42501';
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.is_super_admin() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_moderator() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.require_super_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_moderator() TO authenticated;
GRANT EXECUTE ON FUNCTION public.require_super_admin() TO authenticated;
