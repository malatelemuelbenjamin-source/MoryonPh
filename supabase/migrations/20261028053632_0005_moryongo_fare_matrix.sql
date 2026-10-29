/*
# MoryonGo Feature #5 — Fare Matrix

1. New Tables
- `fare_matrices` — groups/publishes fare matrix records for a transport mode
  and optionally a single route. Reuses `transport_modes.id` and `routes.id`.
  Has publication_status (draft/published/archived) AND verification_status
  (official/verified/community/estimated/rejected/archived) — these are
  independent: a published matrix is NOT automatically official.
- `fare_matrix_entries` — individual rows in a matrix (origin → destination,
  passenger type, fare amount). References `fare_matrices.id`, optionally
  `fares.id`, `locations.id` for origin and destination. The fare amount is
  nullable so unknown fares are shown as "Not available" rather than guessed.
- `fare_matrix_audit_logs` — audit trail of admin actions on a matrix
  (created, published, corrected, verified, rejected, archived).

2. Accuracy discipline (mirrors Features #3 and #4)
- No invented fares, routes, discounts, or fare stages.
- Only `official` and `verified` matrices/entries appear as trusted fare info.
- `community` and `estimated` are shown with a clear label, never as official.
- `rejected` and `archived` are never shown as current.
- Unknown discounts display "Not available" — never guessed.
- Expired matrices (effective_until < today) are not shown as current.

3. Security
- RLS on every new table.
- Public read (anon + authenticated) for published, currently-effective
  matrices/entries with verification_status in (official, verified, community).
- All write operations restricted to service_role (admin tooling).
- Audit logs: read-only to authenticated (transparency), writes to service_role.

4. Indexes
- route_id, transport_mode_id, effective dates, verification_status, publication_status.
*/

-- =========================================================
-- ENUMS
-- =========================================================
DO $$ BEGIN
  CREATE TYPE fare_matrix_type AS ENUM (
    'fixed','stage_based','distance_based','zone_based','other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE fare_matrix_publication_status AS ENUM (
    'draft','published','archived'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE fare_matrix_passenger_type AS ENUM (
    'regular','student','senior','pwd','other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE fare_matrix_audit_action AS ENUM (
    'created','published','corrected','verified','rejected','archived'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =========================================================
-- FARE_MATRICES
-- =========================================================
CREATE TABLE IF NOT EXISTS fare_matrices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  transport_mode_id uuid REFERENCES transport_modes(id) ON DELETE SET NULL,
  route_id uuid REFERENCES routes(id) ON DELETE SET NULL,
  matrix_type fare_matrix_type NOT NULL DEFAULT 'fixed',
  publication_status fare_matrix_publication_status NOT NULL DEFAULT 'draft',
  verification_status verification_status NOT NULL DEFAULT 'community',
  source text,
  source_reference text,
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  effective_until date,
  last_verified_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE fare_matrices ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON fare_matrices TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON fare_matrices TO service_role;

DROP POLICY IF EXISTS "fare_matrices_public_read" ON fare_matrices;
CREATE POLICY "fare_matrices_public_read" ON fare_matrices FOR SELECT
  TO anon, authenticated
  USING (
    publication_status = 'published'
    AND verification_status IN ('official','verified','community')
    AND effective_from <= CURRENT_DATE
    AND (effective_until IS NULL OR effective_until >= CURRENT_DATE)
  );

CREATE INDEX IF NOT EXISTS idx_fare_matrices_transport ON fare_matrices (transport_mode_id);
CREATE INDEX IF NOT EXISTS idx_fare_matrices_route ON fare_matrices (route_id);
CREATE INDEX IF NOT EXISTS idx_fare_matrices_pub_verify ON fare_matrices (publication_status, verification_status);
CREATE INDEX IF NOT EXISTS idx_fare_matrices_effective ON fare_matrices (effective_from, effective_until);

-- =========================================================
-- FARE_MATRIX_ENTRIES
-- =========================================================
CREATE TABLE IF NOT EXISTS fare_matrix_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fare_matrix_id uuid NOT NULL REFERENCES fare_matrices(id) ON DELETE CASCADE,
  fare_id uuid REFERENCES fares(id) ON DELETE SET NULL,
  origin_location_id uuid REFERENCES locations(id) ON DELETE RESTRICT,
  destination_location_id uuid REFERENCES locations(id) ON DELETE RESTRICT,
  origin_stop_sequence integer,
  destination_stop_sequence integer,
  fare_amount numeric(10,2) CHECK (fare_amount IS NULL OR fare_amount >= 0),
  passenger_type fare_matrix_passenger_type NOT NULL DEFAULT 'regular',
  currency text NOT NULL DEFAULT 'PHP',
  verification_status verification_status NOT NULL DEFAULT 'community',
  source text,
  source_reference text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE fare_matrix_entries ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON fare_matrix_entries TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON fare_matrix_entries TO service_role;

DROP POLICY IF EXISTS "fare_matrix_entries_public_read" ON fare_matrix_entries;
CREATE POLICY "fare_matrix_entries_public_read" ON fare_matrix_entries FOR SELECT
  TO anon, authenticated
  USING (
    verification_status IN ('official','verified','community')
    AND EXISTS (
      SELECT 1 FROM fare_matrices m
      WHERE m.id = fare_matrix_id
        AND m.publication_status = 'published'
        AND m.verification_status IN ('official','verified','community')
        AND m.effective_from <= CURRENT_DATE
        AND (m.effective_until IS NULL OR m.effective_until >= CURRENT_DATE)
    )
  );

CREATE INDEX IF NOT EXISTS idx_fare_matrix_entries_matrix ON fare_matrix_entries (fare_matrix_id);
CREATE INDEX IF NOT EXISTS idx_fare_matrix_entries_fare ON fare_matrix_entries (fare_id);
CREATE INDEX IF NOT EXISTS idx_fare_matrix_entries_origin ON fare_matrix_entries (origin_location_id);
CREATE INDEX IF NOT EXISTS idx_fare_matrix_entries_dest ON fare_matrix_entries (destination_location_id);
CREATE INDEX IF NOT EXISTS idx_fare_matrix_entries_passenger ON fare_matrix_entries (passenger_type);

-- =========================================================
-- FARE_MATRIX_AUDIT_LOGS
-- =========================================================
CREATE TABLE IF NOT EXISTS fare_matrix_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fare_matrix_id uuid NOT NULL REFERENCES fare_matrices(id) ON DELETE CASCADE,
  action fare_matrix_audit_action NOT NULL,
  previous_status fare_matrix_publication_status,
  new_status fare_matrix_publication_status,
  performed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reason text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE fare_matrix_audit_logs ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON fare_matrix_audit_logs TO authenticated;
GRANT INSERT, UPDATE, DELETE ON fare_matrix_audit_logs TO service_role;

DROP POLICY IF EXISTS "fare_matrix_audit_auth_read" ON fare_matrix_audit_logs;
CREATE POLICY "fare_matrix_audit_auth_read" ON fare_matrix_audit_logs FOR SELECT
  TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_fare_matrix_audit_matrix ON fare_matrix_audit_logs (fare_matrix_id);

-- =========================================================
-- UPDATED_AT TRIGGERS
-- =========================================================
DROP TRIGGER IF EXISTS trg_fare_matrices_updated ON fare_matrices;
CREATE TRIGGER trg_fare_matrices_updated BEFORE UPDATE ON fare_matrices
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_fare_matrix_entries_updated ON fare_matrix_entries;
CREATE TRIGGER trg_fare_matrix_entries_updated BEFORE UPDATE ON fare_matrix_entries
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
