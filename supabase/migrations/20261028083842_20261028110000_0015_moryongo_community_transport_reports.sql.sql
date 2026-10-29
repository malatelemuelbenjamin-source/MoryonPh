/*
# Feature 15: Community Transport Reports

## Purpose
Allows commuters to submit reports about missing or incorrect transport
information, service issues, missing stops, accessibility concerns, and other
commuter problems. Every report is stored in Supabase and managed through a
secure review workflow. Community-submitted information remains unverified until
an authorized reviewer confirms it.

## New Tables

### 1. community_transport_reports
Main report table.
- id (uuid PK)
- reporter_id (uuid, FK auth.users, defaults to auth.uid()) — the submitter
- category (enum community_report_category) — controlled category
- title (text, 3..120 chars) — report title
- description (text, 10..4000 chars) — report details
- municipality (text) — one of the six Marinduque municipalities
- location_id (uuid, nullable, FK locations) — optional related location
- route_id (uuid, nullable, FK routes) — optional related route
- transport_mode_id (uuid, nullable, FK transport_modes) — optional transport mode
- latitude (numeric, nullable) — optional coordinate
- longitude (numeric, nullable) — optional coordinate
- observed_at (timestamptz, nullable) — when the issue was observed
- status (enum community_report_status, default 'submitted') — workflow status
- urgency (text, nullable) — user-submitted priority hint, not official
- reporter_followup_preference (text, nullable) — optional contact preference note
- reviewer_id (uuid, nullable, FK auth.users) — authorized reviewer
- reviewer_notes (text, nullable) — PRIVATE admin notes
- resolution_summary (text, nullable) — outcome explanation (shown to reporter)
- rejection_reason (text, nullable) — required when status='rejected' (shown to reporter)
- forwarded_to_verification (boolean, default false) — traceable link to Data Verification
- verification_forwarded_at (timestamptz, nullable)
- created_at, updated_at, reviewed_at, resolved_at (timestamptz)

### 2. community_report_attachments
Photo evidence storage metadata.
- id (uuid PK)
- report_id (uuid FK community_transport_reports ON DELETE CASCADE)
- uploaded_by (uuid FK auth.users, defaults to auth.uid())
- storage_path (text) — private Supabase Storage object path
- file_name (text) — sanitized display name
- mime_type (text) — validated image type (jpeg/png/webp)
- file_size (bigint) — bytes
- created_at (timestamptz)

### 3. community_report_comments
Follow-up responses between reporter and reviewer.
- id (uuid PK)
- report_id (uuid FK community_transport_reports ON DELETE CASCADE)
- author_id (uuid FK auth.users, defaults to auth.uid())
- author_role (enum community_report_comment_role) — 'reporter' | 'reviewer'
- body (text, 1..2000 chars)
- is_visible_to_reporter (boolean, default true)
- created_at (timestamptz)

### 4. community_report_audit_logs
Audit trail for review actions.
- id (uuid PK)
- report_id (uuid FK community_transport_reports ON DELETE CASCADE)
- actor_id (uuid, nullable, FK auth.users)
- action (enum community_report_audit_action)
- previous_status (enum community_report_status, nullable)
- new_status (enum community_report_status, nullable)
- internal_note (text, nullable) — private
- created_at (timestamptz)

## New Enums
- community_report_category (9 values)
- community_report_status (5 values: submitted, under_review, needs_more_info, resolved, rejected)
- community_report_comment_role (reporter, reviewer)
- community_report_audit_action (submitted, marked_under_review, requested_info, resolved, rejected, forwarded_to_verification, reporter_followed_up)

## Security (RLS + Grants)
- community_transport_reports:
  - authenticated may INSERT rows they own (reporter_id = auth.uid()).
  - authenticated may SELECT their own rows OR rows with status in
    (resolved) for a limited public feed.
  - authenticated may UPDATE only non-administrative columns on their own rows
    when status is 'submitted' or 'needs_more_info' (owner follow-up).
  - Reviewers (determined by is_community_reviewer() SECURITY DEFINER helper)
    get full SELECT and UPDATE on workflow columns.
  - service_role full access for edge functions.
- community_report_attachments:
  - authenticated may INSERT for their own reports.
  - SELECT limited to report owner or reviewer.
- community_report_comments:
  - authenticated may INSERT as reporter on own reports or as reviewer.
  - SELECT limited to rows visible to reporter or reviewer-only.
- community_report_audit_logs:
  - authenticated INSERT only via trigger (actor captured automatically).
  - SELECT only for reviewers; reporters see status timeline via a view.

## Storage
- Private bucket `community-report-attachments` (public = false).
- Storage policies: authenticated users can upload/read/delete only objects
  under a path prefixed by their own user id, plus reviewers can read all.

## Helper Functions
- is_community_reviewer() RETURNS boolean — SECURITY DEFINER, checks the
  caller's raw_app_meta_data for a `community_reviewer` flag set to true.
  Used by RLS policies to authorize reviewer actions server-side.

## Notes
1. Reviewer authorization is driven by raw_app_meta_data (user-immutable),
   NOT raw_user_meta_data.
2. Audit log rows are inserted by triggers on community_transport_reports
   status changes; ordinary users cannot write to the audit table directly.
3. Report status is never changed by the reporter; only reviewers update it.
4. A status timeline view `community_report_status_timeline` exposes only the
   audit actions appropriate for the reporter (hides internal_note).
*/

-- ===== Enums =====

DO $$ BEGIN
  CREATE TYPE community_report_category AS ENUM (
    'missing_route',
    'missing_stop_or_terminal',
    'incorrect_location_info',
    'transport_service_issue',
    'missing_or_incorrect_schedule',
    'accessibility_concern',
    'passenger_info_concern',
    'safety_concern',
    'other_transport_concern'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE community_report_status AS ENUM (
    'submitted',
    'under_review',
    'needs_more_info',
    'resolved',
    'rejected'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE community_report_comment_role AS ENUM (
    'reporter',
    'reviewer'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE community_report_audit_action AS ENUM (
    'submitted',
    'marked_under_review',
    'requested_info',
    'resolved',
    'rejected',
    'forwarded_to_verification',
    'reporter_followed_up'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ===== Reviewer helper function =====

CREATE OR REPLACE FUNCTION public.is_community_reviewer()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'community_reviewer')::boolean,
    false
  )
$$;

REVOKE EXECUTE ON FUNCTION public.is_community_reviewer() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_community_reviewer() TO authenticated;

-- ===== Main report table =====

CREATE TABLE IF NOT EXISTS public.community_transport_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  category community_report_category NOT NULL,
  title text NOT NULL CHECK (char_length(title) >= 3 AND char_length(title) <= 120),
  description text NOT NULL CHECK (char_length(description) >= 10 AND char_length(description) <= 4000),
  municipality text NOT NULL CHECK (municipality IN ('Boac','Buenavista','Gasan','Mogpog','Santa Cruz','Torrijos')),
  location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  route_id uuid REFERENCES public.routes(id) ON DELETE SET NULL,
  transport_mode_id uuid REFERENCES public.transport_modes(id) ON DELETE SET NULL,
  latitude numeric CHECK (latitude IS NULL OR (latitude >= -90 AND latitude <= 90)),
  longitude numeric CHECK (longitude IS NULL OR (longitude >= -180 AND longitude <= 180)),
  observed_at timestamptz,
  status community_report_status NOT NULL DEFAULT 'submitted',
  urgency text CHECK (urgency IS NULL OR char_length(urgency) <= 40),
  reporter_followup_preference text CHECK (reporter_followup_preference IS NULL OR char_length(reporter_followup_preference) <= 200),
  reviewer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewer_notes text,
  resolution_summary text,
  rejection_reason text,
  forwarded_to_verification boolean NOT NULL DEFAULT false,
  verification_forwarded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  resolved_at timestamptz,
  CONSTRAINT chk_rejection_has_reason CHECK (
    status <> 'rejected' OR (rejection_reason IS NOT NULL AND char_length(rejection_reason) >= 5)
  ),
  CONSTRAINT chk_resolve_has_summary CHECK (
    status <> 'resolved' OR (resolution_summary IS NOT NULL AND char_length(resolution_summary) >= 5)
  )
);

ALTER TABLE public.community_transport_reports ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_ctr_reporter ON public.community_transport_reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_ctr_status ON public.community_transport_reports(status);
CREATE INDEX IF NOT EXISTS idx_ctr_category ON public.community_transport_reports(category);
CREATE INDEX IF NOT EXISTS idx_ctr_municipality ON public.community_transport_reports(municipality);
CREATE INDEX IF NOT EXISTS idx_ctr_created_at ON public.community_transport_reports(created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_transport_reports TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_transport_reports TO service_role;

-- Users can see their own reports + resolved reports (limited public feed)
DROP POLICY IF EXISTS "ctr_select_own_or_public" ON public.community_transport_reports;
CREATE POLICY "ctr_select_own_or_public"
ON public.community_transport_reports FOR SELECT
TO authenticated
USING (
  reporter_id = auth.uid()
  OR status = 'resolved'
  OR public.is_community_reviewer()
);

-- Users can insert reports they own
DROP POLICY IF EXISTS "ctr_insert_own" ON public.community_transport_reports;
CREATE POLICY "ctr_insert_own"
ON public.community_transport_reports FOR INSERT
TO authenticated
WITH CHECK (reporter_id = auth.uid());

-- Users can update only non-admin fields on their own reports, and only when
-- the report is in a state that allows reporter edits (submitted / needs_more_info).
-- Reviewers can update all rows.
DROP POLICY IF EXISTS "ctr_update_own_or_reviewer" ON public.community_transport_reports;
CREATE POLICY "ctr_update_own_or_reviewer"
ON public.community_transport_reports FOR UPDATE
TO authenticated
USING (reporter_id = auth.uid() OR public.is_community_reviewer())
WITH CHECK (
  -- reviewer can set anything
  public.is_community_reviewer()
  -- owner can only update non-admin columns while report is editable
  OR (
    reporter_id = auth.uid()
    AND status IN ('submitted','needs_more_info')
  )
);

-- Users can delete their own reports only while submitted (not after review started)
DROP POLICY IF EXISTS "ctr_delete_own" ON public.community_transport_reports;
CREATE POLICY "ctr_delete_own"
ON public.community_transport_reports FOR DELETE
TO authenticated
USING (reporter_id = auth.uid() AND status = 'submitted');

-- ===== Attachments table =====

CREATE TABLE IF NOT EXISTS public.community_report_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.community_transport_reports(id) ON DELETE CASCADE,
  uploaded_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  file_name text NOT NULL CHECK (char_length(file_name) <= 255),
  mime_type text NOT NULL CHECK (mime_type IN ('image/jpeg','image/png','image/webp')),
  file_size bigint NOT NULL CHECK (file_size > 0 AND file_size <= 10485760),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.community_report_attachments ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_cra_report ON public.community_report_attachments(report_id);

GRANT SELECT, INSERT, DELETE ON public.community_report_attachments TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.community_report_attachments TO service_role;

-- Owner or reviewer can read attachments
DROP POLICY IF EXISTS "cra_select_owner_or_reviewer" ON public.community_report_attachments;
CREATE POLICY "cra_select_owner_or_reviewer"
ON public.community_report_attachments FOR SELECT
TO authenticated
USING (
  uploaded_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.community_transport_reports r
    WHERE r.id = community_report_attachments.report_id
    AND r.reporter_id = auth.uid()
  )
  OR public.is_community_reviewer()
);

-- Users can insert attachments for their own reports
DROP POLICY IF EXISTS "cra_insert_own" ON public.community_report_attachments;
CREATE POLICY "cra_insert_own"
ON public.community_report_attachments FOR INSERT
TO authenticated
WITH CHECK (
  uploaded_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.community_transport_reports r
    WHERE r.id = community_report_attachments.report_id
    AND r.reporter_id = auth.uid()
  )
);

-- Owner or reviewer can delete
DROP POLICY IF EXISTS "cra_delete_owner_or_reviewer" ON public.community_report_attachments;
CREATE POLICY "cra_delete_owner_or_reviewer"
ON public.community_report_attachments FOR DELETE
TO authenticated
USING (
  uploaded_by = auth.uid()
  OR public.is_community_reviewer()
);

-- ===== Comments table =====

CREATE TABLE IF NOT EXISTS public.community_report_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.community_transport_reports(id) ON DELETE CASCADE,
  author_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  author_role community_report_comment_role NOT NULL,
  body text NOT NULL CHECK (char_length(body) >= 1 AND char_length(body) <= 2000),
  is_visible_to_reporter boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.community_report_comments ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_crc_report ON public.community_report_comments(report_id, created_at);

GRANT SELECT, INSERT ON public.community_report_comments TO authenticated;
GRANT SELECT, INSERT ON public.community_report_comments TO service_role;

-- Reporter sees comments visible to them on their own reports; reviewer sees all
DROP POLICY IF EXISTS "crc_select" ON public.community_report_comments;
CREATE POLICY "crc_select"
ON public.community_report_comments FOR SELECT
TO authenticated
USING (
  -- reviewer sees all comments on any report
  public.is_community_reviewer()
  -- reporter sees visible comments on their own reports
  OR (
    is_visible_to_reporter = true
    AND EXISTS (
      SELECT 1 FROM public.community_transport_reports r
      WHERE r.id = community_report_comments.report_id
      AND r.reporter_id = auth.uid()
    )
  )
);

-- Reporter can comment on own reports; reviewer can comment on any
DROP POLICY IF EXISTS "crc_insert" ON public.community_report_comments;
CREATE POLICY "crc_insert"
ON public.community_report_comments FOR INSERT
TO authenticated
WITH CHECK (
  author_id = auth.uid()
  AND (
    -- reviewer can comment on any report
    (author_role = 'reviewer' AND public.is_community_reviewer())
    -- reporter can comment on own report
    OR (
      author_role = 'reporter'
      AND EXISTS (
        SELECT 1 FROM public.community_transport_reports r
        WHERE r.id = community_report_comments.report_id
        AND r.reporter_id = auth.uid()
      )
    )
  )
);

-- ===== Audit logs table =====

CREATE TABLE IF NOT EXISTS public.community_report_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.community_transport_reports(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action community_report_audit_action NOT NULL,
  previous_status community_report_status,
  new_status community_report_status,
  internal_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.community_report_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_craal_report ON public.community_report_audit_logs(report_id, created_at);

GRANT SELECT ON public.community_report_audit_logs TO authenticated;
GRANT SELECT, INSERT ON public.community_report_audit_logs TO service_role;

-- Only reviewers can read audit logs (reporters get the timeline view instead)
DROP POLICY IF EXISTS "craal_select_reviewer" ON public.community_report_audit_logs;
CREATE POLICY "craal_select_reviewer"
ON public.community_report_audit_logs FOR SELECT
TO authenticated
USING (public.is_community_reviewer());

-- No direct INSERT policy for authenticated: audit rows are inserted by a
-- SECURITY DEFINER trigger function only.

-- ===== Audit trigger function =====

CREATE OR REPLACE FUNCTION public.community_report_write_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_action community_report_audit_action;
  v_prev community_report_status;
  v_note text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.community_report_audit_logs (report_id, actor_id, action, new_status)
    VALUES (NEW.id, v_actor, 'submitted', NEW.status);
    RETURN NEW;
  END IF;

  -- UPDATE
  v_prev := OLD.status;
  IF NEW.status <> OLD.status THEN
    CASE NEW.status
      WHEN 'under_review' THEN v_action := 'marked_under_review';
      WHEN 'needs_more_info' THEN v_action := 'requested_info';
      WHEN 'resolved' THEN v_action := 'resolved';
      WHEN 'rejected' THEN v_action := 'rejected';
      ELSE v_action := 'marked_under_review';
    END CASE;

    v_note := CASE
      WHEN NEW.status = 'rejected' THEN NEW.rejection_reason
      WHEN NEW.status = 'resolved' THEN NEW.resolution_summary
      WHEN NEW.status = 'needs_more_info' THEN NEW.reviewer_notes
      ELSE NULL
    END;

    INSERT INTO public.community_report_audit_logs (report_id, actor_id, action, previous_status, new_status, internal_note)
    VALUES (NEW.id, v_actor, v_action, v_prev, NEW.status, v_note);
  END IF;

  IF NEW.forwarded_to_verification = true AND OLD.forwarded_to_verification = false THEN
    INSERT INTO public.community_report_audit_logs (report_id, actor_id, action)
    VALUES (NEW.id, v_actor, 'forwarded_to_verification');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ctr_audit ON public.community_transport_reports;
CREATE TRIGGER trg_ctr_audit
AFTER INSERT OR UPDATE OF status, forwarded_to_verification
ON public.community_transport_reports
FOR EACH ROW EXECUTE FUNCTION public.community_report_write_audit();

REVOKE EXECUTE ON FUNCTION public.community_report_write_audit() FROM PUBLIC, anon;

-- ===== Reporter follow-up audit trigger =====
-- When a reporter adds a comment on a report that is in 'needs_more_info',
-- record a 'reporter_followed_up' audit entry so reviewers are notified.
CREATE OR REPLACE FUNCTION public.community_report_comment_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_report public.community_transport_reports%ROWTYPE;
BEGIN
  SELECT * INTO v_report FROM public.community_transport_reports WHERE id = NEW.report_id;
  IF NEW.author_role = 'reporter' AND v_report.status = 'needs_more_info' THEN
    INSERT INTO public.community_report_audit_logs (report_id, actor_id, action, new_status)
    VALUES (NEW.report_id, NEW.author_id, 'reporter_followed_up', v_report.status);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_crc_audit ON public.community_report_comments;
CREATE TRIGGER trg_crc_audit
AFTER INSERT ON public.community_report_comments
FOR EACH ROW EXECUTE FUNCTION public.community_report_comment_audit();

REVOKE EXECUTE ON FUNCTION public.community_report_comment_audit() FROM PUBLIC, anon;

-- ===== Status timeline view (reporter-safe) =====
-- Exposes audit actions WITHOUT the internal_note column, so reporters
-- can see their status timeline without seeing private reviewer notes.

CREATE OR REPLACE VIEW public.community_report_status_timeline AS
SELECT
  a.id,
  a.report_id,
  a.action,
  a.previous_status,
  a.new_status,
  a.created_at
FROM public.community_report_audit_logs a
WHERE a.action IN (
  'submitted',
  'marked_under_review',
  'requested_info',
  'resolved',
  'rejected',
  'forwarded_to_verification',
  'reporter_followed_up'
);

GRANT SELECT ON public.community_report_status_timeline TO authenticated;

-- ===== updated_at trigger =====
DROP TRIGGER IF EXISTS trg_ctr_updated ON public.community_transport_reports;
CREATE TRIGGER trg_ctr_updated
BEFORE UPDATE ON public.community_transport_reports
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ===== Storage bucket =====
INSERT INTO storage.buckets (id, name, public)
VALUES ('community-report-attachments', 'community-report-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: users manage objects under their own user-id prefix;
-- reviewers can read all objects in the bucket.
DROP POLICY IF EXISTS "cra_storage_upload_own" ON storage.objects;
CREATE POLICY "cra_storage_upload_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'community-report-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "cra_storage_read_own_or_reviewer" ON storage.objects;
CREATE POLICY "cra_storage_read_own_or_reviewer" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'community-report-attachments'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.is_community_reviewer()
    )
  );

DROP POLICY IF EXISTS "cra_storage_delete_own_or_reviewer" ON storage.objects;
CREATE POLICY "cra_storage_delete_own_or_reviewer" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'community-report-attachments'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.is_community_reviewer()
    )
  );
