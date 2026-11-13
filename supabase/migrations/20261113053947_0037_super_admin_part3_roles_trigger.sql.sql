/*
# Super Admin Control Center — Part 3: role granting + registration trigger

1. Purpose
The server-side function that grants or revokes admin roles, and a trigger
that records every new sign-up for the registration review center.

2. New Functions
- set_user_role(target_user_id, role, grant): super-admin-only. Writes the role
  flag into auth.users.raw_app_meta_data (server-side only), records the
  decision in admin_roles, and writes an audit log entry. A super admin cannot
  revoke their own super_admin role (lock-out guard). Revoke is implemented by
  removing the JSON key; grant sets it to true.
- handle_new_user_registration(): trigger on new auth users. Creates the
  public users profile row (same as the app's existing fallback) and a
  user_registrations row with status pending.

3. Security changes
- set_user_role is SECURITY DEFINER with locked search_path; EXECUTE revoked
  from PUBLIC and anon, granted to authenticated only; the function body
  re-checks is_super_admin() and raises 42501 otherwise.
- The trigger is SECURITY DEFINER so it can insert into public.users and
  public.user_registrations on behalf of the signing-up user.
*/

CREATE OR REPLACE FUNCTION public.set_user_role(
  p_target_user_id uuid,
  p_role text,
  p_grant boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Only super admins can change roles' USING ERRCODE = '42501';
  END IF;

  IF p_role NOT IN ('super_admin', 'admin', 'moderator') THEN
    RAISE EXCEPTION 'Unknown role: %', p_role;
  END IF;

  IF p_role = 'super_admin' AND NOT p_grant AND p_target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot revoke your own super admin role';
  END IF;

  IF p_grant THEN
    UPDATE auth.users
    SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb)
      || jsonb_build_object(p_role, true)
    WHERE id = p_target_user_id;
  ELSE
    UPDATE auth.users
    SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) - p_role
    WHERE id = p_target_user_id;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target user not found';
  END IF;

  INSERT INTO public.admin_roles (user_id, role, granted, granted_by)
  VALUES (p_target_user_id, p_role, p_grant, auth.uid())
  ON CONFLICT (user_id, role)
  DO UPDATE SET
    granted = EXCLUDED.granted,
    granted_by = EXCLUDED.granted_by,
    granted_at = now();

  INSERT INTO public.admin_audit_logs
    (actor_user_id, action, entity_type, entity_id, summary, after_data)
  VALUES (
    auth.uid(),
    CASE WHEN p_grant THEN 'role_granted' ELSE 'role_revoked' END,
    'user_role',
    p_target_user_id,
    p_role || CASE WHEN p_grant THEN ' granted' ELSE ' revoked' END,
    jsonb_build_object('role', p_role, 'granted', p_grant)
  );

  RETURN jsonb_build_object('success', true, 'role', p_role, 'granted', p_grant);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_user_role(uuid, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_user_role(uuid, text, boolean) TO authenticated;

-- ---------------------------------------------------------------------------
-- Registration trigger
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_user_registration()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data ->> 'name',
      split_part(COALESCE(NEW.email, ''), '@', 1)
    )
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_registrations (user_id, status)
  VALUES (NEW.id, 'pending')
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'on_auth_user_created'
      AND tgrelid = 'auth.users'::regclass
  ) THEN
    CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_registration();
  END IF;
END;
$$;

-- Seed default website settings used by the control center and public site.
INSERT INTO public.site_settings (key, value) VALUES
  ('site', '{"site_name": "MoryonGo", "tagline": "Marinduque Transport Guide", "maintenance_mode": false, "registration_mode": "open"}'::jsonb)
ON CONFLICT (key) DO NOTHING;
