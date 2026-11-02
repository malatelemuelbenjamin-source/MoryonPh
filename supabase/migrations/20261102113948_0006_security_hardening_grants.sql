-- Part 1: trigger-only SECURITY DEFINER helpers are never called through the API.
-- Triggers still fire because PostgreSQL does not check EXECUTE on trigger functions at fire time.
REVOKE EXECUTE ON FUNCTION public.community_report_comment_audit() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.community_report_write_audit() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fare_concern_comment_audit() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fare_concern_write_audit() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_trip_history_updated_at() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated;

-- Part 2: anon never needs direct table access to users (no anon RLS policy exists).
REVOKE ALL ON TABLE public.users FROM anon;

-- Authenticated: RLS does not restrict TRUNCATE, REFERENCES or TRIGGER, so those are removed.
REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE public.users FROM authenticated;

-- Column-restricted writes: users may insert their own profile and edit only their own profile fields.
REVOKE INSERT, UPDATE ON TABLE public.users FROM authenticated;
GRANT INSERT (id, email, name) ON TABLE public.users TO authenticated;
GRANT UPDATE (
  name,
  username,
  preferred_language,
  home_municipality,
  commuter_preferences,
  notification_preferences,
  profile_photo,
  preferred_passenger_category_id,
  updated_at
) ON TABLE public.users TO authenticated;

-- ROLLBACK (run manually to restore the previous state):
-- GRANT EXECUTE ON FUNCTION public.community_report_comment_audit() TO anon, authenticated;
-- GRANT EXECUTE ON FUNCTION public.community_report_write_audit() TO anon, authenticated;
-- GRANT EXECUTE ON FUNCTION public.fare_concern_comment_audit() TO anon, authenticated;
-- GRANT EXECUTE ON FUNCTION public.fare_concern_write_audit() TO anon, authenticated;
-- GRANT EXECUTE ON FUNCTION public.touch_trip_history_updated_at() TO anon, authenticated;
-- GRANT EXECUTE ON FUNCTION public.update_updated_at_column() TO anon, authenticated;
-- GRANT ALL ON TABLE public.users TO anon, authenticated;
