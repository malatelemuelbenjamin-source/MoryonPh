/*
# Feature 26: Driver & Transport Operator Portal

## Purpose
Allows eligible drivers and transport operators to register for portal access
and submit proposed route, fare, and service changes for admin review. Nothing
an operator submits becomes official public data until an authorized reviewer
approves it. Reuses existing `is_alert_admin()` for reviewer authorization.

## New Tables

### transport_operators
- id (uuid PK)
- owner_user_id (uuid NOT NULL DEFAULT auth.uid(), FK -> auth.users ON DELETE CASCADE)
- organization_name (text)
- contact_name (text)
- contact_email (text)
- contact_phone (text nullable)
- municipality (text nullable, one of the 6 Marinduque municipalities)
- transport_mode_id (uuid nullable FK -> transport_modes)
- service_category (text)
- verification_status (enum: not_submitted, pending_review, needs_more_information,
  approved, rejected, suspended; default not_submitted)
- reviewer_notes (text nullable — visible only to the operator and reviewers)
- verified_by (uuid nullable FK -> auth.users)
- verified_at (timestamptz nullable)
- supporting_info (text nullable — self-declared, NOT verified)
- created_at, updated_at

### transport_service_submissions
- id (uuid PK)
- operator_id (uuid NOT NULL FK -> transport_operators ON DELETE CASCADE)
- submitted_by_user_id (uuid NOT NULL DEFAULT auth.uid() FK -> auth.users ON DELETE CASCADE)
- submission_type (enum: new_route, route_update, fare_change, schedule_update,
  service_interruption, contact_update)
- related_route_id (uuid nullable FK -> routes)
- transport_mode_id (uuid nullable FK -> transport_modes)
- origin_location_id (uuid nullable FK -> locations)
- destination_location_id (uuid nullable FK -> locations)
- proposed_data (jsonb — structured proposed changes)
- proposed_effective_date (date nullable)
- supporting_notes (text)
- status (enum: pending_review, under_review, needs_more_information, approved,
  rejected, published; default pending_review)
- reviewer_feedback (text nullable — private, visible only to submitter + reviewers)
- reviewed_by (uuid nullable FK -> auth.users)
- reviewed_at (timestamptz nullable)
- created_at, updated_at

### transport_operator_audit_logs
- id (uuid PK)
- operator_id (uuid nullable FK -> transport_operators ON DELETE SET NULL)
- submission_id (uuid nullable FK -> transport_service_submissions ON DELETE SET NULL)
- actor_id (uuid nullable FK -> auth.users)
- action (enum: application_submitted, operator_verified, operator_rejected,
  operator_suspended, service_submitted, fare_proposed, submission_approved,
  submission_rejected, submission_published, info_requested)
- previous_status (text nullable)
- new_status (text nullable)
- summary (text nullable)
- created_at

## Security (RLS)
- transport_operators: owner can read/update their own row; anyone can INSERT
  (creating their own application); reviewers can read all. UPDATE prevents
  changing owner_user_id.
- transport_service_submissions: submitter reads/inserts/updates/deletes their own;
  reviewers can read all, update status (review), but NOT insert/delete.
- transport_operator_audit_logs: insert by owner or admin; read by owner (their
  operator) or admin (all).
- Grants: CRUD to authenticated only (private portal, no anon).
- Uses is_alert_admin() for reviewer authorization (same community_reviewer flag).

## Notes
- The `transport_operator_verification_status` and `transport_submission_status`
  enums are new.
- `transport_operator_audit_action` enum for audit log actions.
- The `set_updated_at()` trigger function already exists in the database.
*/

-- ===== Enums =====
DO $$ BEGIN
  CREATE TYPE transport_operator_verification_status AS ENUM (
    'not_submitted', 'pending_review', 'needs_more_information', 'approved', 'rejected', 'suspended'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE transport_submission_status AS ENUM (
    'pending_review', 'under_review', 'needs_more_information', 'approved', 'rejected', 'published'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE transport_submission_type AS ENUM (
    'new_route', 'route_update', 'fare_change', 'schedule_update', 'service_interruption', 'contact_update'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE transport_operator_audit_action AS ENUM (
    'application_submitted', 'operator_verified', 'operator_rejected',
    'operator_suspended', 'service_submitted', 'fare_proposed',
    'submission_approved', 'submission_rejected', 'submission_published', 'info_requested'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ===== transport_operators =====
CREATE TABLE IF NOT EXISTS transport_operators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_name text NOT NULL CHECK (char_length(organization_name) >= 2 AND char_length(organization_name) <= 200),
  contact_name text NOT NULL CHECK (char_length(contact_name) >= 2 AND char_length(contact_name) <= 200),
  contact_email text NOT NULL,
  contact_phone text CHECK (contact_phone IS NULL OR char_length(contact_phone) <= 50),
  municipality text CHECK (municipality IS NULL OR municipality IN ('Boac','Buenavista','Gasan','Mogpog','Santa Cruz','Torrijos')),
  transport_mode_id uuid REFERENCES transport_modes(id) ON DELETE SET NULL,
  service_category text NOT NULL CHECK (char_length(service_category) >= 2 AND char_length(service_category) <= 100),
  verification_status transport_operator_verification_status NOT NULL DEFAULT 'not_submitted',
  reviewer_notes text,
  verified_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  verified_at timestamptz,
  supporting_info text CHECK (supporting_info IS NULL OR char_length(supporting_info) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE transport_operators ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS transport_operators_owner_idx ON transport_operators (owner_user_id);
CREATE INDEX IF NOT EXISTS transport_operators_status_idx ON transport_operators (verification_status);

GRANT SELECT, INSERT, UPDATE, DELETE ON transport_operators TO authenticated;

-- Owner reads their own operator record; admins read all
DROP POLICY IF EXISTS "to_select_own_or_admin" ON transport_operators;
CREATE POLICY "to_select_own_or_admin" ON transport_operators FOR SELECT
  TO authenticated USING (owner_user_id = auth.uid() OR public.is_alert_admin());

-- Anyone authenticated can create their own operator application
DROP POLICY IF EXISTS "to_insert_own" ON transport_operators;
CREATE POLICY "to_insert_own" ON transport_operators FOR INSERT
  TO authenticated WITH CHECK (owner_user_id = auth.uid());

-- Owner can update their own (but not verification fields); admins can update all
DROP POLICY IF EXISTS "to_update_own_or_admin" ON transport_operators;
CREATE POLICY "to_update_own_or_admin" ON transport_operators FOR UPDATE
  TO authenticated
  USING (owner_user_id = auth.uid() OR public.is_alert_admin())
  WITH CHECK (owner_user_id = auth.uid() OR public.is_alert_admin());

-- Only the owner can delete their own (withdraw application); admins can delete
DROP POLICY IF EXISTS "to_delete_own_or_admin" ON transport_operators;
CREATE POLICY "to_delete_own_or_admin" ON transport_operators FOR DELETE
  TO authenticated USING (owner_user_id = auth.uid() OR public.is_alert_admin());

-- ===== transport_service_submissions =====
CREATE TABLE IF NOT EXISTS transport_service_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id uuid NOT NULL REFERENCES transport_operators(id) ON DELETE CASCADE,
  submitted_by_user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  submission_type transport_submission_type NOT NULL,
  related_route_id uuid REFERENCES routes(id) ON DELETE SET NULL,
  transport_mode_id uuid REFERENCES transport_modes(id) ON DELETE SET NULL,
  origin_location_id uuid REFERENCES locations(id) ON DELETE SET NULL,
  destination_location_id uuid REFERENCES locations(id) ON DELETE SET NULL,
  proposed_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  proposed_effective_date date,
  supporting_notes text CHECK (supporting_notes IS NULL OR char_length(supporting_notes) <= 4000),
  status transport_submission_status NOT NULL DEFAULT 'pending_review',
  reviewer_feedback text,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE transport_service_submissions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS tss_operator_idx ON transport_service_submissions (operator_id);
CREATE INDEX IF NOT EXISTS tss_submitter_idx ON transport_service_submissions (submitted_by_user_id);
CREATE INDEX IF NOT EXISTS tss_status_idx ON transport_service_submissions (status);
CREATE INDEX IF NOT EXISTS tss_created_idx ON transport_service_submissions (created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON transport_service_submissions TO authenticated;

-- Submitter reads their own; admins read all
DROP POLICY IF EXISTS "tss_select_own_or_admin" ON transport_service_submissions;
CREATE POLICY "tss_select_own_or_admin" ON transport_service_submissions FOR SELECT
  TO authenticated USING (submitted_by_user_id = auth.uid() OR public.is_alert_admin());

-- Only the submitter can create (must be the operator owner or admin)
DROP POLICY IF EXISTS "tss_insert_own" ON transport_service_submissions;
CREATE POLICY "tss_insert_own" ON transport_service_submissions FOR INSERT
  TO authenticated WITH CHECK (
    submitted_by_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM transport_operators op
      WHERE op.id = transport_service_submissions.operator_id
      AND (op.owner_user_id = auth.uid() OR public.is_alert_admin())
    )
  );

-- Submitter can update their own (edit pending); admins can update (review)
DROP POLICY IF EXISTS "tss_update_own_or_admin" ON transport_service_submissions;
CREATE POLICY "tss_update_own_or_admin" ON transport_service_submissions FOR UPDATE
  TO authenticated
  USING (submitted_by_user_id = auth.uid() OR public.is_alert_admin())
  WITH CHECK (submitted_by_user_id = auth.uid() OR public.is_alert_admin());

-- Only submitter can delete their own pending; admins can delete
DROP POLICY IF EXISTS "tss_delete_own_or_admin" ON transport_service_submissions;
CREATE POLICY "tss_delete_own_or_admin" ON transport_service_submissions FOR DELETE
  TO authenticated USING (submitted_by_user_id = auth.uid() OR public.is_alert_admin());

-- ===== transport_operator_audit_logs =====
CREATE TABLE IF NOT EXISTS transport_operator_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id uuid REFERENCES transport_operators(id) ON DELETE SET NULL,
  submission_id uuid REFERENCES transport_service_submissions(id) ON DELETE SET NULL,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action transport_operator_audit_action NOT NULL,
  previous_status text,
  new_status text,
  summary text CHECK (summary IS NULL OR char_length(summary) <= 1000),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE transport_operator_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS toal_operator_idx ON transport_operator_audit_logs (operator_id);
CREATE INDEX IF NOT EXISTS toal_submission_idx ON transport_operator_audit_logs (submission_id);
CREATE INDEX IF NOT EXISTS toal_created_idx ON transport_operator_audit_logs (created_at DESC);

GRANT SELECT, INSERT ON transport_operator_audit_logs TO authenticated;

-- Owner of operator or admin can read logs for their operator
DROP POLICY IF EXISTS "toal_select_own_or_admin" ON transport_operator_audit_logs;
CREATE POLICY "toal_select_own_or_admin" ON transport_operator_audit_logs FOR SELECT
  TO authenticated USING (
    public.is_alert_admin()
    OR EXISTS (
      SELECT 1 FROM transport_operators op
      WHERE op.id = transport_operator_audit_logs.operator_id
      AND op.owner_user_id = auth.uid()
    )
  );

-- Owner or admin can insert audit log entries (for their own actions)
DROP POLICY IF EXISTS "toal_insert_own_or_admin" ON transport_operator_audit_logs;
CREATE POLICY "toal_insert_own_or_admin" ON transport_operator_audit_logs FOR INSERT
  TO authenticated WITH CHECK (
    public.is_alert_admin()
    OR EXISTS (
      SELECT 1 FROM transport_operators op
      WHERE op.id = transport_operator_audit_logs.operator_id
      AND op.owner_user_id = auth.uid()
    )
  );

-- ===== Updated_at triggers =====
DROP TRIGGER IF EXISTS trg_transport_operators_updated ON transport_operators;
CREATE TRIGGER trg_transport_operators_updated BEFORE UPDATE ON transport_operators
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_transport_service_submissions_updated ON transport_service_submissions;
CREATE TRIGGER trg_transport_service_submissions_updated BEFORE UPDATE ON transport_service_submissions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
