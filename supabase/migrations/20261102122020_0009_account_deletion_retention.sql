/*
# Account deletion retention policy

1. Summary
- Deleting an account now removes the person's private data and personal uploaded files.
- Community reports, fare concern reports, destination and event reports, comments, and transport service submissions are kept for moderation and platform integrity, but the link to the deleted account is removed, so they appear as written by an unknown user.
- Moderation and audit history is kept; the actor on those entries is cleared.
- Uploaded files are staged in a pending table before any row is removed, so a failed storage or sign-in account step can be retried with the same file list.

2. Modified tables
- community_transport_reports.reporter_id, fare_concern_reports.reporter_id, destination_reports.reporter_id, event_reports.reporter_id: now nullable; foreign key clears the value (ON DELETE SET NULL) instead of deleting the report.
- community_report_comments.author_id, fare_concern_comments.author_id: now nullable; foreign key clears the value instead of deleting the comment.
- transport_service_submissions.submitted_by_user_id: now nullable; foreign key clears the value.
- Every foreign key to the sign-in accounts that previously had no delete action (audit actors, reviewers, creators, verifiers, uploaders) now clears the value on deletion. This prevents a sign-in account with such history from being impossible to delete.

3. New table
- account_deletion_pending_files: list of uploaded file paths waiting to be removed from storage for a deleting account. Row level security is enabled with no policies; only the service role can read or delete rows.

4. Function changes
- prepare_account_deletion(p_user_id): stages the user's uploaded file paths, removes the user's uploaded attachment rows, clears the user's identity on retained reports and comments, removes private user-owned rows, removes the profile row, and returns every staged file path (including paths staged by earlier attempts). Attachments uploaded by other people on a retained report are kept.

5. Security notes
- No table is opened to anonymous or signed-in browser users.
- The operator owner block is unchanged.
- The function remains callable only by the service role.

6. Important notes
- Uploaded attachments by the deleted user are removed. Report text and attachments from other users stay in place.
- Free text written by the deleted user inside a retained report or comment is not rewritten. The user should be told this in the confirmation screen.
- Rollback: see the report; the constraint changes can be reverted by re-adding NOT NULL and ON DELETE CASCADE, and the pending table can be dropped once empty.
*/

ALTER TABLE public.community_transport_reports ALTER COLUMN reporter_id DROP NOT NULL;
ALTER TABLE public.community_transport_reports DROP CONSTRAINT IF EXISTS community_transport_reports_reporter_id_fkey;
ALTER TABLE public.community_transport_reports ADD CONSTRAINT community_transport_reports_reporter_id_fkey
  FOREIGN KEY (reporter_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.fare_concern_reports ALTER COLUMN reporter_id DROP NOT NULL;
ALTER TABLE public.fare_concern_reports DROP CONSTRAINT IF EXISTS fare_concern_reports_reporter_id_fkey;
ALTER TABLE public.fare_concern_reports ADD CONSTRAINT fare_concern_reports_reporter_id_fkey
  FOREIGN KEY (reporter_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.destination_reports ALTER COLUMN reporter_id DROP NOT NULL;
ALTER TABLE public.destination_reports DROP CONSTRAINT IF EXISTS destination_reports_reporter_id_fkey;
ALTER TABLE public.destination_reports ADD CONSTRAINT destination_reports_reporter_id_fkey
  FOREIGN KEY (reporter_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.event_reports ALTER COLUMN reporter_id DROP NOT NULL;
ALTER TABLE public.event_reports DROP CONSTRAINT IF EXISTS event_reports_reporter_id_fkey;
ALTER TABLE public.event_reports ADD CONSTRAINT event_reports_reporter_id_fkey
  FOREIGN KEY (reporter_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.community_report_comments ALTER COLUMN author_id DROP NOT NULL;
ALTER TABLE public.community_report_comments DROP CONSTRAINT IF EXISTS community_report_comments_author_id_fkey;
ALTER TABLE public.community_report_comments ADD CONSTRAINT community_report_comments_author_id_fkey
  FOREIGN KEY (author_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.fare_concern_comments ALTER COLUMN author_id DROP NOT NULL;
ALTER TABLE public.fare_concern_comments DROP CONSTRAINT IF EXISTS fare_concern_comments_author_id_fkey;
ALTER TABLE public.fare_concern_comments ADD CONSTRAINT fare_concern_comments_author_id_fkey
  FOREIGN KEY (author_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.transport_service_submissions ALTER COLUMN submitted_by_user_id DROP NOT NULL;
ALTER TABLE public.transport_service_submissions DROP CONSTRAINT IF EXISTS transport_service_submissions_submitted_by_user_id_fkey;
ALTER TABLE public.transport_service_submissions ADD CONSTRAINT transport_service_submissions_submitted_by_user_id_fkey
  FOREIGN KEY (submitted_by_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT cl.relname::text AS tbl, a.attname::text AS col, c.conname::text AS name
    FROM pg_constraint c
    JOIN pg_class cl ON cl.oid = c.conrelid
    JOIN pg_namespace ns ON ns.oid = cl.relnamespace
    JOIN pg_class rc ON rc.oid = c.confrelid
    JOIN pg_namespace rn ON rn.oid = rc.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    WHERE c.contype = 'f'
      AND ns.nspname = 'public'
      AND rn.nspname = 'auth'
      AND rc.relname = 'users'
      AND c.confdeltype = 'a'
      AND NOT a.attnotnull
  LOOP
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', r.tbl, r.name);
    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES auth.users(id) ON DELETE SET NULL',
      r.tbl, r.name, r.col
    );
  END LOOP;
END $$;

CREATE TABLE IF NOT EXISTS public.account_deletion_pending_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  bucket text NOT NULL,
  path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, bucket, path)
);

ALTER TABLE public.account_deletion_pending_files ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.account_deletion_pending_files FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.account_deletion_pending_files TO service_role;

CREATE OR REPLACE FUNCTION public.prepare_account_deletion(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_files jsonb;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'User is required';
  END IF;

  IF EXISTS (SELECT 1 FROM transport_operators WHERE owner_user_id = p_user_id) THEN
    RAISE EXCEPTION 'OPERATOR_OWNER' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO account_deletion_pending_files (user_id, bucket, path)
  SELECT p_user_id, f.bucket, f.path
  FROM (
    SELECT 'community-report-attachments'::text AS bucket, a.storage_path AS path
    FROM community_report_attachments a
    WHERE a.uploaded_by = p_user_id
    UNION
    SELECT 'fare-concern-attachments'::text, a.storage_path
    FROM fare_concern_attachments a
    WHERE a.uploaded_by = p_user_id
  ) f
  ON CONFLICT (user_id, bucket, path) DO NOTHING;

  DELETE FROM community_report_attachments WHERE uploaded_by = p_user_id;
  DELETE FROM fare_concern_attachments WHERE uploaded_by = p_user_id;

  UPDATE community_transport_reports
  SET reporter_id = NULL, reporter_followup_preference = NULL
  WHERE reporter_id = p_user_id;
  UPDATE fare_concern_reports SET reporter_id = NULL WHERE reporter_id = p_user_id;
  UPDATE destination_reports SET reporter_id = NULL WHERE reporter_id = p_user_id;
  UPDATE event_reports SET reporter_id = NULL WHERE reporter_id = p_user_id;
  UPDATE community_report_comments SET author_id = NULL WHERE author_id = p_user_id;
  UPDATE fare_concern_comments SET author_id = NULL WHERE author_id = p_user_id;
  UPDATE transport_service_submissions SET submitted_by_user_id = NULL WHERE submitted_by_user_id = p_user_id;

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

  SELECT coalesce(jsonb_agg(jsonb_build_object('bucket', p.bucket, 'path', p.path)), '[]'::jsonb)
  INTO v_files
  FROM account_deletion_pending_files p
  WHERE p.user_id = p_user_id;

  RETURN v_files;
END;
$function$;
