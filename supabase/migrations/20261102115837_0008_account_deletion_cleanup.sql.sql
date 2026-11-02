/*
# Account deletion cleanup function

## Plain-English summary
Deleting an account now runs through a server-side function that only the backend (service role) can call. The function first refuses if the user owns a transport operator, then removes the user's private records (saved places and routes, searches, assistant conversations, itineraries, shared trips, trip history, alert and fare subscriptions, event registrations, and the profile row). It returns the list of uploaded attachment files so the backend can delete them from storage. The sign-in account itself is deleted by the backend afterwards, which cascades the remaining per-user rows through the existing foreign keys. Audit records keep their content but lose the link to the deleted user.

## 1. New function: prepare_account_deletion(p_user_id uuid)
- Executable only by the service role. Not executable by anonymous or signed-in users.
- Raises OPERATOR_OWNER if the user owns any transport operator. Ownership must be transferred or the operator closed first.
- Deletes the user's private rows in a single transaction; any failure rolls everything back.
- Returns a JSON list of storage files (bucket and path) belonging to the user's attachments, including attachments on the user's own reports.
- Idempotent: running it again after a failure deletes nothing new and returns the same file list until the account itself is removed.

## 2. Access changes
- Revoked DELETE on public.users from the signed-in role (and anonymous role, which has no privileges).

## Notes
1. Admin accounts are blocked by the backend before this function is called, because administrator status lives in the sign-in metadata, not in the database rows.
2. Community and fare-concern reports and comments that the user authored are removed with the account through the existing cascade rules.
3. Audit log actor columns are cleared by the existing "set null" rules when the sign-in account is deleted.

## Rollback
- Drop the function: DROP FUNCTION IF EXISTS public.prepare_account_deletion(uuid);
- Restore DELETE for the signed-in role on public.users only if it was needed: GRANT DELETE ON public.users TO authenticated;
*/

CREATE OR REPLACE FUNCTION public.prepare_account_deletion(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_files jsonb;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'User is required';
  END IF;

  IF EXISTS (SELECT 1 FROM transport_operators WHERE owner_user_id = p_user_id) THEN
    RAISE EXCEPTION 'OPERATOR_OWNER' USING ERRCODE = 'P0001';
  END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object('bucket', f.bucket, 'path', f.path)), '[]'::jsonb)
  INTO v_files
  FROM (
    SELECT 'community-report-attachments'::text AS bucket, a.storage_path AS path
    FROM community_report_attachments a
    WHERE a.uploaded_by = p_user_id
       OR a.report_id IN (SELECT r.id FROM community_transport_reports r WHERE r.reporter_id = p_user_id)
    UNION
    SELECT 'fare-concern-attachments'::text, a.storage_path
    FROM fare_concern_attachments a
    WHERE a.uploaded_by = p_user_id
       OR a.report_id IN (SELECT r.id FROM fare_concern_reports r WHERE r.reporter_id = p_user_id)
  ) f;

  DELETE FROM mory_ai_conversations WHERE user_id = p_user_id;
  DELETE FROM recent_searches WHERE user_id = p_user_id;
  DELETE FROM saved_places WHERE user_id = p_user_id;
  DELETE FROM saved_routes WHERE user_id = p_user_id;
  DELETE FROM saved_events WHERE user_id = p_user_id;
  DELETE FROM trip_history WHERE user_id = p_user_id;
  DELETE FROM trip_cost_estimates WHERE user_id = p_user_id;
  DELETE FROM event_registrations WHERE user_id = p_user_id;
  DELETE FROM fare_update_subscriptions WHERE user_id = p_user_id;
  DELETE FROM transport_alert_subscriptions WHERE user_id = p_user_id;
  DELETE FROM weather_alert_subscriptions WHERE user_id = p_user_id;
  DELETE FROM tourist_itineraries WHERE user_id = p_user_id;
  DELETE FROM shared_trips WHERE owner_user_id = p_user_id;
  DELETE FROM users WHERE id = p_user_id;

  RETURN v_files;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.prepare_account_deletion(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_account_deletion(uuid) TO service_role;

REVOKE DELETE ON public.users FROM authenticated;
REVOKE DELETE ON public.users FROM anon;
