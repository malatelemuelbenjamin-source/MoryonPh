/*
# Root owner claim

1. Purpose
- Activates the website owner's account as ROOT super admin without editing auth tables by hand.

2. New function
- public.claim_root_owner(): signed-in callers only. Succeeds only when the signed-in email is the verified owner email (lemuelbenjamin.malate@gmail.com). It is idempotent.
- On success it writes super_admin, admin, moderator and community_reviewer flags into the user's app metadata (server-side only, not client-writable), upserts the three rows in admin_roles, and records an entry in admin_audit_logs.

3. Security
- SECURITY DEFINER with a fixed search_path.
- EXECUTE revoked from PUBLIC and anon; granted to authenticated only.
- Any other account gets a 42501 permission error and no changes.
- The user must refresh their session after claiming so the new flags appear in their token.

4. Notes
- No existing rows are modified or deleted.
*/

CREATE OR REPLACE FUNCTION public.claim_root_owner()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_owner constant text := 'lemuelbenjamin.malate@gmail.com';
  v_role text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in required' USING ERRCODE = '42501';
  END IF;

  IF v_email <> v_owner THEN
    RAISE EXCEPTION 'This account is not the website owner' USING ERRCODE = '42501';
  END IF;

  UPDATE auth.users
  SET raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
    || jsonb_build_object('super_admin', true, 'admin', true, 'moderator', true, 'community_reviewer', true)
  WHERE id = v_uid;

  FOREACH v_role IN ARRAY ARRAY['super_admin', 'admin', 'moderator'] LOOP
    INSERT INTO public.admin_roles (user_id, role, granted, granted_by, granted_at)
    VALUES (v_uid, v_role, true, v_uid, now())
    ON CONFLICT (user_id, role) DO UPDATE
      SET granted = true, granted_by = v_uid, granted_at = now();
  END LOOP;

  INSERT INTO public.admin_audit_logs (actor_user_id, action, entity_type, entity_id, summary, after_data)
  VALUES (
    v_uid,
    'root_owner_claimed',
    'admin_role',
    v_uid,
    'Root super admin activated for the website owner',
    jsonb_build_object('roles', jsonb_build_array('super_admin', 'admin', 'moderator'))
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_root_owner() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_root_owner() TO authenticated;
