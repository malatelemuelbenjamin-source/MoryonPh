/*
# Feature 16: Fare Concern & Violation Reports

## Purpose
Allows commuters to submit concerns about potentially incorrect fares,
suspected overcharging, inconsistent fare collection, discount-related
concerns, and other fare-related issues. Every report is stored in Supabase
and managed through a secure review workflow. A user-submitted report is an
allegation, not proof of a violation — reports never automatically change
official fares, discounts, routes, or schedules.

## New Tables

### 1. fare_concern_reports
Main fare concern report table.
- id (uuid PK)
- reporter_id (uuid, FK auth.users, defaults to auth.uid())
- report_reference (text, unique) — human-readable reference (e.g. "FC-2026-0001")
- category (enum fare_concern_category) — 10 controlled categories
- title (text, 3..120 chars)
- description (text, 10..4000 chars)
- municipality (text) — one of six Marinduque municipalities
- route_id (uuid, nullable, FK routes)
- transport_mode_id (uuid, nullable, FK transport_modes)
- boarding_location_id (uuid, nullable, FK locations)
- destination_location_id (uuid, nullable, FK locations)
- incident_at (timestamptz, nullable) — when the incident occurred
- amount_charged (numeric, nullable, >= 0) — amount allegedly charged
- expected_fare_amount (numeric, nullable, >= 0) — expected fare
- passenger_category (enum fare_concern_passenger_category, nullable)
- fare_record_id (uuid, nullable) — reference to fare record if applicable
- status (enum fare_concern_status, default 'submitted')
- reviewer_id (uuid, nullable, FK auth.users)
- reviewer_notes (text, nullable) — PRIVATE admin notes
- resolution_summary (text, nullable)
- rejection_reason (text, nullable)
- forwarded_to_verification (boolean, default false)
- verification_forwarded_at (timestamptz, nullable)
- created_at, updated_at, reviewed_at, resolved_at (timestamptz)

### 2. fare_concern_attachments
Evidence photo storage metadata.
- id (uuid PK)
- report_id (uuid FK fare_concern_reports ON DELETE CASCADE)
- uploaded_by (uuid FK auth.users, defaults to auth.uid())
- storage_path (text)
- file_name (text, max 255)
- mime_type (text, jpeg/png/webp only)
- file_size (bigint, 1..10MB)
- created_at (timestamptz)

### 3. fare_concern_comments
Follow-up responses between reporter and reviewer.
- id (uuid PK)
- report_id (uuid FK fare_concern_reports ON DELETE CASCADE)
- author_id (uuid FK auth.users, defaults to auth.uid())
- author_role (enum fare_concern_comment_role) — reporter | reviewer
- body (text, 1..2000 chars)
- is_visible_to_reporter (boolean, default true)
- created_at (timestamptz)

### 4. fare_concern_audit_logs
Audit trail for review actions.
- id (uuid PK)
- report_id (uuid FK fare_concern_reports ON DELETE CASCADE)
- actor_id (uuid, nullable, FK auth.users)
- action (enum fare_concern_audit_action)
- previous_status (enum fare_concern_status, nullable)
- new_status (enum fare_concern_status, nullable)
- internal_note (text, nullable)
- created_at (timestamptz)

## New Enums
- fare_concern_category (10 values)
- fare_concern_status (6 values: submitted, under_review, needs_more_info, resolved, rejected, closed)
- fare_concern_comment_role (reporter, reviewer)
- fare_concern_audit_action (submitted, marked_under_review, requested_info, resolved, rejected, closed, forwarded_to_verification, reporter_followed_up)
- fare_concern_passenger_category (regular, student, senior, pwd)

## Security (RLS + Grants)
- Same pattern as community_transport_reports: owner-scoped CRUD, reviewer
  full access via is_community_reviewer() (reused from Feature 15), audit
  logs inserted by triggers only, reporter-safe timeline view.

## Storage
- Private bucket `fare-concern-attachments` (public = false)
- Same storage policy pattern as community-report-attachments.

## Notes
1. Reuses the is_community_reviewer() function from Feature 15 — no new
   reviewer function needed.
2. Report reference generated via a sequence + DEFAULT expression.
3. No public feed for fare concerns — privacy-sensitive by nature.
*/

-- ===== Enums =====

DO $$ BEGIN
  CREATE TYPE fare_concern_category AS ENUM (
    'suspected_overcharging',
    'fare_differs_from_matrix',
    'student_discount_concern',
    'senior_discount_concern',
    'pwd_discount_concern',
    'fare_calculation_concern',
    'inconsistent_fare_collection',
    'unclear_or_unposted_fare',
    'additional_fare_or_surcharge',
    'other_fare_concern'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE fare_concern_status AS ENUM (
    'submitted',
    'under_review',
    'needs_more_info',
    'resolved',
    'rejected',
    'closed'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE fare_concern_comment_role AS ENUM (
    'reporter',
    'reviewer'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE fare_concern_audit_action AS ENUM (
    'submitted',
    'marked_under_review',
    'requested_info',
    'resolved',
    'rejected',
    'closed',
    'forwarded_to_verification',
    'reporter_followed_up'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE fare_concern_passenger_category AS ENUM (
    'regular',
    'student',
    'senior',
    'pwd'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ===== Report reference sequence =====

CREATE SEQUENCE IF NOT EXISTS public.fare_concern_ref_seq START 1;

CREATE OR REPLACE FUNCTION public.generate_fare_concern_reference()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 'FC-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('fare_concern_ref_seq')::text, 4, '0')
$$;

REVOKE EXECUTE ON FUNCTION public.generate_fare_concern_reference() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_fare_concern_reference() TO authenticated;

-- ===== Main report table =====

CREATE TABLE IF NOT EXISTS public.fare_concern_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  report_reference text NOT NULL DEFAULT public.generate_fare_concern_reference() UNIQUE,
  category fare_concern_category NOT NULL,
  title text NOT NULL CHECK (char_length(title) >= 3 AND char_length(title) <= 120),
  description text NOT NULL CHECK (char_length(description) >= 10 AND char_length(description) <= 4000),
  municipality text NOT NULL CHECK (municipality IN ('Boac','Buenavista','Gasan','Mogpog','Santa Cruz','Torrijos')),
  route_id uuid REFERENCES public.routes(id) ON DELETE SET NULL,
  transport_mode_id uuid REFERENCES public.transport_modes(id) ON DELETE SET NULL,
  boarding_location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  destination_location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  incident_at timestamptz,
  amount_charged numeric CHECK (amount_charged IS NULL OR amount_charged >= 0),
  expected_fare_amount numeric CHECK (expected_fare_amount IS NULL OR expected_fare_amount >= 0),
  passenger_category fare_concern_passenger_category,
  fare_record_id uuid,
  status fare_concern_status NOT NULL DEFAULT 'submitted',
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
  CONSTRAINT fcr_chk_rejection_has_reason CHECK (
    status <> 'rejected' OR (rejection_reason IS NOT NULL AND char_length(rejection_reason) >= 5)
  ),
  CONSTRAINT fcr_chk_resolve_has_summary CHECK (
    status <> 'resolved' OR (resolution_summary IS NOT NULL AND char_length(resolution_summary) >= 5)
  )
);

ALTER TABLE public.fare_concern_reports ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_fcr_reporter ON public.fare_concern_reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_fcr_status ON public.fare_concern_reports(status);
CREATE INDEX IF NOT EXISTS idx_fcr_category ON public.fare_concern_reports(category);
CREATE INDEX IF NOT EXISTS idx_fcr_municipality ON public.fare_concern_reports(municipality);
CREATE INDEX IF NOT EXISTS idx_fcr_created_at ON public.fare_concern_reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fcr_reference ON public.fare_concern_reports(report_reference);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fare_concern_reports TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fare_concern_reports TO service_role;
GRANT USAGE ON SEQUENCE public.fare_concern_ref_seq TO authenticated;

-- Users see only their own reports + reviewers see all (no public feed for fare concerns)
DROP POLICY IF EXISTS "fcr_select_own_or_reviewer" ON public.fare_concern_reports;
CREATE POLICY "fcr_select_own_or_reviewer"
ON public.fare_concern_reports FOR SELECT
TO authenticated
USING (
  reporter_id = auth.uid()
  OR public.is_community_reviewer()
);

DROP POLICY IF EXISTS "fcr_insert_own" ON public.fare_concern_reports;
CREATE POLICY "fcr_insert_own"
ON public.fare_concern_reports FOR INSERT
TO authenticated
WITH CHECK (reporter_id = auth.uid());

DROP POLICY IF EXISTS "fcr_update_own_or_reviewer" ON public.fare_concern_reports;
CREATE POLICY "fcr_update_own_or_reviewer"
ON public.fare_concern_reports FOR UPDATE
TO authenticated
USING (reporter_id = auth.uid() OR public.is_community_reviewer())
WITH CHECK (
  public.is_community_reviewer()
  OR (
    reporter_id = auth.uid()
    AND status IN ('submitted','needs_more_info')
  )
);

DROP POLICY IF EXISTS "fcr_delete_own" ON public.fare_concern_reports;
CREATE POLICY "fcr_delete_own"
ON public.fare_concern_reports FOR DELETE
TO authenticated
USING (reporter_id = auth.uid() AND status = 'submitted');

-- ===== Attachments table =====

CREATE TABLE IF NOT EXISTS public.fare_concern_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.fare_concern_reports(id) ON DELETE CASCADE,
  uploaded_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  file_name text NOT NULL CHECK (char_length(file_name) <= 255),
  mime_type text NOT NULL CHECK (mime_type IN ('image/jpeg','image/png','image/webp')),
  file_size bigint NOT NULL CHECK (file_size > 0 AND file_size <= 10485760),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.fare_concern_attachments ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_fca_report ON public.fare_concern_attachments(report_id);

GRANT SELECT, INSERT, DELETE ON public.fare_concern_attachments TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.fare_concern_attachments TO service_role;

DROP POLICY IF EXISTS "fca_select_owner_or_reviewer" ON public.fare_concern_attachments;
CREATE POLICY "fca_select_owner_or_reviewer"
ON public.fare_concern_attachments FOR SELECT
TO authenticated
USING (
  uploaded_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.fare_concern_reports r
    WHERE r.id = fare_concern_attachments.report_id
    AND r.reporter_id = auth.uid()
  )
  OR public.is_community_reviewer()
);

DROP POLICY IF EXISTS "fca_insert_own" ON public.fare_concern_attachments;
CREATE POLICY "fca_insert_own"
ON public.fare_concern_attachments FOR INSERT
TO authenticated
WITH CHECK (
  uploaded_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.fare_concern_reports r
    WHERE r.id = fare_concern_attachments.report_id
    AND r.reporter_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "fca_delete_owner_or_reviewer" ON public.fare_concern_attachments;
CREATE POLICY "fca_delete_owner_or_reviewer"
ON public.fare_concern_attachments FOR DELETE
TO authenticated
USING (
  uploaded_by = auth.uid()
  OR public.is_community_reviewer()
);

-- ===== Comments table =====

CREATE TABLE IF NOT EXISTS public.fare_concern_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.fare_concern_reports(id) ON DELETE CASCADE,
  author_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  author_role fare_concern_comment_role NOT NULL,
  body text NOT NULL CHECK (char_length(body) >= 1 AND char_length(body) <= 2000),
  is_visible_to_reporter boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.fare_concern_comments ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_fcc_report ON public.fare_concern_comments(report_id, created_at);

GRANT SELECT, INSERT ON public.fare_concern_comments TO authenticated;
GRANT SELECT, INSERT ON public.fare_concern_comments TO service_role;

DROP POLICY IF EXISTS "fcc_select" ON public.fare_concern_comments;
CREATE POLICY "fcc_select"
ON public.fare_concern_comments FOR SELECT
TO authenticated
USING (
  public.is_community_reviewer()
  OR (
    is_visible_to_reporter = true
    AND EXISTS (
      SELECT 1 FROM public.fare_concern_reports r
      WHERE r.id = fare_concern_comments.report_id
      AND r.reporter_id = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS "fcc_insert" ON public.fare_concern_comments;
CREATE POLICY "fcc_insert"
ON public.fare_concern_comments FOR INSERT
TO authenticated
WITH CHECK (
  author_id = auth.uid()
  AND (
    (author_role = 'reviewer' AND public.is_community_reviewer())
    OR (
      author_role = 'reporter'
      AND EXISTS (
        SELECT 1 FROM public.fare_concern_reports r
        WHERE r.id = fare_concern_comments.report_id
        AND r.reporter_id = auth.uid()
      )
    )
  )
);

-- ===== Audit logs table =====

CREATE TABLE IF NOT EXISTS public.fare_concern_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.fare_concern_reports(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action fare_concern_audit_action NOT NULL,
  previous_status fare_concern_status,
  new_status fare_concern_status,
  internal_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.fare_concern_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_fcal_report ON public.fare_concern_audit_logs(report_id, created_at);

GRANT SELECT ON public.fare_concern_audit_logs TO authenticated;
GRANT SELECT, INSERT ON public.fare_concern_audit_logs TO service_role;

DROP POLICY IF EXISTS "fcal_select_reviewer" ON public.fare_concern_audit_logs;
CREATE POLICY "fcal_select_reviewer"
ON public.fare_concern_audit_logs FOR SELECT
TO authenticated
USING (public.is_community_reviewer());

-- ===== Audit trigger function =====

CREATE OR REPLACE FUNCTION public.fare_concern_write_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_action fare_concern_audit_action;
  v_prev fare_concern_status;
  v_note text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.fare_concern_audit_logs (report_id, actor_id, action, new_status)
    VALUES (NEW.id, v_actor, 'submitted', NEW.status);
    RETURN NEW;
  END IF;

  v_prev := OLD.status;
  IF NEW.status <> OLD.status THEN
    CASE NEW.status
      WHEN 'under_review' THEN v_action := 'marked_under_review';
      WHEN 'needs_more_info' THEN v_action := 'requested_info';
      WHEN 'resolved' THEN v_action := 'resolved';
      WHEN 'rejected' THEN v_action := 'rejected';
      WHEN 'closed' THEN v_action := 'closed';
      ELSE v_action := 'marked_under_review';
    END CASE;

    v_note := CASE
      WHEN NEW.status = 'rejected' THEN NEW.rejection_reason
      WHEN NEW.status = 'resolved' THEN NEW.resolution_summary
      WHEN NEW.status = 'needs_more_info' THEN NEW.reviewer_notes
      ELSE NULL
    END;

    INSERT INTO public.fare_concern_audit_logs (report_id, actor_id, action, previous_status, new_status, internal_note)
    VALUES (NEW.id, v_actor, v_action, v_prev, NEW.status, v_note);
  END IF;

  IF NEW.forwarded_to_verification = true AND OLD.forwarded_to_verification = false THEN
    INSERT INTO public.fare_concern_audit_logs (report_id, actor_id, action)
    VALUES (NEW.id, v_actor, 'forwarded_to_verification');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fcr_audit ON public.fare_concern_reports;
CREATE TRIGGER trg_fcr_audit
AFTER INSERT OR UPDATE OF status, forwarded_to_verification
ON public.fare_concern_reports
FOR EACH ROW EXECUTE FUNCTION public.fare_concern_write_audit();

REVOKE EXECUTE ON FUNCTION public.fare_concern_write_audit() FROM PUBLIC, anon;

-- ===== Reporter follow-up audit trigger =====

CREATE OR REPLACE FUNCTION public.fare_concern_comment_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_report public.fare_concern_reports%ROWTYPE;
BEGIN
  SELECT * INTO v_report FROM public.fare_concern_reports WHERE id = NEW.report_id;
  IF NEW.author_role = 'reporter' AND v_report.status = 'needs_more_info' THEN
    INSERT INTO public.fare_concern_audit_logs (report_id, actor_id, action, new_status)
    VALUES (NEW.report_id, NEW.author_id, 'reporter_followed_up', v_report.status);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fcc_audit ON public.fare_concern_comments;
CREATE TRIGGER trg_fcc_audit
AFTER INSERT ON public.fare_concern_comments
FOR EACH ROW EXECUTE FUNCTION public.fare_concern_comment_audit();

REVOKE EXECUTE ON FUNCTION public.fare_concern_comment_audit() FROM PUBLIC, anon;

-- ===== Status timeline view (reporter-safe) =====

CREATE OR REPLACE VIEW public.fare_concern_status_timeline AS
SELECT
  a.id,
  a.report_id,
  a.action,
  a.previous_status,
  a.new_status,
  a.created_at
FROM public.fare_concern_audit_logs a
WHERE a.action IN (
  'submitted',
  'marked_under_review',
  'requested_info',
  'resolved',
  'rejected',
  'closed',
  'forwarded_to_verification',
  'reporter_followed_up'
);

GRANT SELECT ON public.fare_concern_status_timeline TO authenticated;

-- ===== updated_at trigger =====

DROP TRIGGER IF EXISTS trg_fcr_updated ON public.fare_concern_reports;
CREATE TRIGGER trg_fcr_updated
BEFORE UPDATE ON public.fare_concern_reports
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ===== Storage bucket =====

INSERT INTO storage.buckets (id, name, public)
VALUES ('fare-concern-attachments', 'fare-concern-attachments', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "fca_storage_upload_own" ON storage.objects;
CREATE POLICY "fca_storage_upload_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'fare-concern-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "fca_storage_read_own_or_reviewer" ON storage.objects;
CREATE POLICY "fca_storage_read_own_or_reviewer" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'fare-concern-attachments'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.is_community_reviewer()
    )
  );

DROP POLICY IF EXISTS "fca_storage_delete_own_or_reviewer" ON storage.objects;
CREATE POLICY "fca_storage_delete_own_or_reviewer" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'fare-concern-attachments'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.is_community_reviewer()
    )
  );
