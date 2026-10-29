/*
# Feature 28: Data Verification & Quality Control System

1. New Tables
- `verification_evidence` — Source references and evidence attached to records under review.
  - `id` (uuid PK)
  - `entity_type` (text) — what kind of record (route, fare, location, etc.)
  - `entity_id` (uuid) — ID of the referenced record
  - `source_type` (enum) — official_government, authorized_operator, official_announcement, published_fare_matrix, direct_confirmation, field_observation, community_submission, other
  - `source_title` (text) — short title for the source
  - `source_url` (text, nullable) — link to source
  - `source_organization` (text, nullable) — issuing organization
  - `evidence_description` (text, nullable) — reviewer notes about the evidence
  - `submitted_by` (uuid, references auth.users) — who provided the evidence
  - `reviewed_by` (uuid, nullable, references auth.users) — who reviewed it
  - `review_status` (enum) — pending, under_review, accepted, rejected
  - `created_at` (timestamptz, default now())
  - `reviewed_at` (timestamptz, nullable)

- `data_quality_checks` — Automated validation outcomes for records.
  - `id` (uuid PK)
  - `entity_type` (text) — what kind of record
  - `entity_id` (uuid) — ID of the checked record
  - `check_category` (enum) — completeness, consistency, duplicate, freshness, relationship
  - `check_name` (text) — specific check identifier
  - `result` (enum) — pass, warning, fail
  - `explanation` (text, nullable) — human-readable description of the issue
  - `evaluated_at` (timestamptz, default now())

- `data_verification_reviews` — Review assignments and decisions.
  - `id` (uuid PK)
  - `entity_type` (text) — what kind of record
  - `entity_id` (uuid) — ID of the reviewed record
  - `reviewer_id` (uuid, references auth.users) — who performed the review
  - `decision` (enum) — pending_review, under_review, needs_more_info, verified, rejected, disputed
  - `notes` (text, nullable) — internal review notes
  - `rejection_reason` (text, nullable) — reason if rejected
  - `previous_verification_status` (text, nullable) — status before this review
  - `new_verification_status` (text, nullable) — status after this review
  - `created_at` (timestamptz, default now())
  - `decided_at` (timestamptz, nullable) — when the decision was finalized

- `data_record_versions` — Historical snapshots of important records.
  - `id` (uuid PK)
  - `entity_type` (text) — what kind of record
  - `entity_id` (uuid) — ID of the original record
  - `version_number` (integer) — sequential version
  - `snapshot_data` (jsonb) — full record state at this version
  - `published_by` (uuid, nullable, references auth.users) — who published this version
  - `published_at` (timestamptz, default now())
  - `superseded_at` (timestamptz, nullable) — when this version was replaced

2. Security
- Enable RLS on all four new tables.
- verification_evidence: admins can read/insert/update; submitters can read their own.
- data_quality_checks: admins can read; service_role can insert (server-side checks).
- data_verification_reviews: admins can read/insert; reviewers can read their assignments.
- data_record_versions: authenticated can read (for published history); admins can read all.
- All write operations for sensitive tables restricted to admins via is_alert_admin().

3. Indexes
- verification_evidence: entity_type + entity_id, review_status
- data_quality_checks: entity_type + entity_id, result, evaluated_at
- data_verification_reviews: entity_type + entity_id, reviewer_id, decision
- data_record_versions: entity_type + entity_id, version_number

4. Important Notes
- These tables complement the existing per-module audit logs and verification_status columns.
- The existing verification_status enum on routes, fares, locations, etc. remains the source of truth for each record's status.
- data_verification_reviews provides an attributable review history layered on top.
- data_quality_checks stores results of automated validation runs for display in the dashboard.
- data_record_versions preserves snapshots before publication for audit comparison.
*/

-- verification_evidence
CREATE TABLE IF NOT EXISTS verification_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  source_type text NOT NULL CHECK (source_type IN ('official_government','authorized_operator','official_announcement','published_fare_matrix','direct_confirmation','field_observation','community_submission','other')),
  source_title text NOT NULL,
  source_url text,
  source_organization text,
  evidence_description text,
  submitted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  review_status text NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending','under_review','accepted','rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz
);

ALTER TABLE verification_evidence ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON verification_evidence TO authenticated;

CREATE INDEX IF NOT EXISTS idx_verif_evidence_entity ON verification_evidence (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_verif_evidence_status ON verification_evidence (review_status);

DROP POLICY IF EXISTS "Admins can manage evidence" ON verification_evidence;
CREATE POLICY "Admins can manage evidence"
  ON verification_evidence FOR ALL
  TO authenticated
  USING (public.is_alert_admin())
  WITH CHECK (public.is_alert_admin());

DROP POLICY IF EXISTS "Users can read own submitted evidence" ON verification_evidence;
CREATE POLICY "Users can read own submitted evidence"
  ON verification_evidence FOR SELECT
  TO authenticated
  USING (submitted_by = auth.uid());

-- data_quality_checks
CREATE TABLE IF NOT EXISTS data_quality_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  check_category text NOT NULL CHECK (check_category IN ('completeness','consistency','duplicate','freshness','relationship')),
  check_name text NOT NULL,
  result text NOT NULL CHECK (result IN ('pass','warning','fail')),
  explanation text,
  evaluated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE data_quality_checks ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON data_quality_checks TO authenticated;
GRANT INSERT, DELETE ON data_quality_checks TO service_role;

CREATE INDEX IF NOT EXISTS idx_quality_checks_entity ON data_quality_checks (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_quality_checks_result ON data_quality_checks (result);
CREATE INDEX IF NOT EXISTS idx_quality_checks_evaluated ON data_quality_checks (evaluated_at DESC);

DROP POLICY IF EXISTS "Admins can read quality checks" ON data_quality_checks;
CREATE POLICY "Admins can read quality checks"
  ON data_quality_checks FOR SELECT
  TO authenticated
  USING (public.is_alert_admin());

-- data_verification_reviews
CREATE TABLE IF NOT EXISTS data_verification_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  reviewer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  decision text NOT NULL DEFAULT 'pending_review' CHECK (decision IN ('pending_review','under_review','needs_more_info','verified','rejected','disputed')),
  notes text,
  rejection_reason text,
  previous_verification_status text,
  new_verification_status text,
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz
);

ALTER TABLE data_verification_reviews ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON data_verification_reviews TO authenticated;

CREATE INDEX IF NOT EXISTS idx_verif_reviews_entity ON data_verification_reviews (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_verif_reviews_reviewer ON data_verification_reviews (reviewer_id);
CREATE INDEX IF NOT EXISTS idx_verif_reviews_decision ON data_verification_reviews (decision);

DROP POLICY IF EXISTS "Admins can manage reviews" ON data_verification_reviews;
CREATE POLICY "Admins can manage reviews"
  ON data_verification_reviews FOR ALL
  TO authenticated
  USING (public.is_alert_admin())
  WITH CHECK (public.is_alert_admin());

DROP POLICY IF EXISTS "Reviewers can read own reviews" ON data_verification_reviews;
CREATE POLICY "Reviewers can read own reviews"
  ON data_verification_reviews FOR SELECT
  TO authenticated
  USING (reviewer_id = auth.uid());

-- data_record_versions
CREATE TABLE IF NOT EXISTS data_record_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  version_number integer NOT NULL DEFAULT 1,
  snapshot_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  published_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  published_at timestamptz NOT NULL DEFAULT now(),
  superseded_at timestamptz
);

ALTER TABLE data_record_versions ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON data_record_versions TO authenticated;

CREATE INDEX IF NOT EXISTS idx_record_versions_entity ON data_record_versions (entity_type, entity_id, version_number DESC);

DROP POLICY IF EXISTS "Authenticated can read versions" ON data_record_versions;
CREATE POLICY "Authenticated can read versions"
  ON data_record_versions FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins can insert versions" ON data_record_versions;
CREATE POLICY "Admins can insert versions"
  ON data_record_versions FOR INSERT
  TO authenticated
  WITH CHECK (public.is_alert_admin());
