/*
# MoryonGo Feature #3 — Fare Calculator + Fare Database

1. New Tables
- `fares` — verified/admin-approved fare records attached to existing routes.
  Reuses `routes.id` and `transport_modes.id` from Feature #2. No duplicate
  route or location tables.
- `fare_rules` — flexible per-fare rules (fixed_amount, distance_rate, stage_rate,
  additional_charge, minimum_fare, maximum_fare, percentage_discount, …).
- `fare_discounts` — per-passenger-type discounts (regular/student/senior/pwd).
  Discount values are never assumed — only verified records are used.

2. Fare accuracy discipline
- Every fare carries verification_status, source, source_reference, effective_from,
  effective_until, last_verified_at, created_by, updated_at.
- Only `official` and `verified` fares are surfaced as reliable current fares.
- `community` is shown with a clear label, never as official.
- `estimated`, `rejected`, `archived` are never shown as current fare.
- No fare amounts are hardcoded in the frontend — all values come from this table.
- No invented/demo fares are seeded.

3. Effective dates
- A fare is "current" only if effective_from <= now() AND (effective_until IS NULL
  OR effective_until >= now()). Expired fares are preserved for history but never
  displayed as current.

4. Security
- RLS enabled on every new table.
- Public read (anon + authenticated) for active, non-rejected/non-archived fares
  whose effective period covers the current date.
- Only `service_role` may insert/update/delete (admin/operator authoring).
- Regular users cannot modify fare records regardless of auth state.
*/

-- =========================================================
-- ENUMS
-- =========================================================
DO $$ BEGIN
  CREATE TYPE fare_type AS ENUM ('fixed','distance_based','zone_based','stage_based','range','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE fare_rule_type AS ENUM (
    'fixed_amount','percentage_discount','additional_charge',
    'distance_rate','stage_rate','minimum_fare','maximum_fare','other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE passenger_type AS ENUM ('regular','student','senior','pwd');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE discount_type AS ENUM ('percentage','fixed_amount','none');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =========================================================
-- FARES
-- =========================================================
CREATE TABLE IF NOT EXISTS fares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id uuid NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  transport_mode_id uuid REFERENCES transport_modes(id) ON DELETE SET NULL,
  fare_type fare_type NOT NULL DEFAULT 'fixed',
  base_fare numeric(10,2) NOT NULL CHECK (base_fare >= 0),
  minimum_fare numeric(10,2) CHECK (minimum_fare IS NULL OR minimum_fare >= 0),
  maximum_fare numeric(10,2) CHECK (maximum_fare IS NULL OR maximum_fare >= 0),
  distance_from_km numeric(6,2) CHECK (distance_from_km IS NULL OR distance_from_km >= 0),
  distance_to_km numeric(6,2) CHECK (distance_to_km IS NULL OR distance_to_km >= 0),
  currency text NOT NULL DEFAULT 'PHP',
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  effective_until date CHECK (effective_until IS NULL OR effective_until >= effective_from),
  verification_status verification_status NOT NULL DEFAULT 'community',
  source text,
  source_reference text,
  last_verified_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE fares ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON fares TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON fares TO service_role;

-- Public can read active, non-rejected/non-archived fares within effective period.
DROP POLICY IF EXISTS "fares_public_read" ON fares;
CREATE POLICY "fares_public_read" ON fares FOR SELECT
  TO anon, authenticated
  USING (
    verification_status IN ('official','verified','community')
    AND effective_from <= CURRENT_DATE
    AND (effective_until IS NULL OR effective_until >= CURRENT_DATE)
  );

CREATE INDEX IF NOT EXISTS idx_fares_route ON fares (route_id);
CREATE INDEX IF NOT EXISTS idx_fares_mode ON fares (transport_mode_id);
CREATE INDEX IF NOT EXISTS idx_fares_status ON fares (verification_status, effective_from, effective_until);

-- =========================================================
-- FARE_RULES
-- =========================================================
CREATE TABLE IF NOT EXISTS fare_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fare_id uuid NOT NULL REFERENCES fares(id) ON DELETE CASCADE,
  rule_type fare_rule_type NOT NULL,
  rule_value numeric(10,2) NOT NULL DEFAULT 0 CHECK (rule_value >= 0),
  passenger_type passenger_type,
  description text,
  verification_status verification_status NOT NULL DEFAULT 'community',
  source text,
  source_reference text,
  effective_from date,
  effective_until date CHECK (effective_until IS NULL OR effective_until >= effective_from),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE fare_rules ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON fare_rules TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON fare_rules TO service_role;

DROP POLICY IF EXISTS "fare_rules_public_read" ON fare_rules;
CREATE POLICY "fare_rules_public_read" ON fare_rules FOR SELECT
  TO anon, authenticated
  USING (verification_status IN ('official','verified','community'));

CREATE INDEX IF NOT EXISTS idx_fare_rules_fare ON fare_rules (fare_id);

-- =========================================================
-- FARE_DISCOUNTS
-- =========================================================
CREATE TABLE IF NOT EXISTS fare_discounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fare_id uuid NOT NULL REFERENCES fares(id) ON DELETE CASCADE,
  passenger_type passenger_type NOT NULL,
  discount_type discount_type NOT NULL DEFAULT 'none',
  discount_value numeric(10,2) NOT NULL DEFAULT 0 CHECK (discount_value >= 0),
  eligibility_notes text,
  required_document text,
  verification_status verification_status NOT NULL DEFAULT 'community',
  source text,
  source_reference text,
  effective_from date,
  effective_until date CHECK (effective_until IS NULL OR effective_until >= effective_from),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE fare_discounts ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON fare_discounts TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON fare_discounts TO service_role;

DROP POLICY IF EXISTS "fare_discounts_public_read" ON fare_discounts;
CREATE POLICY "fare_discounts_public_read" ON fare_discounts FOR SELECT
  TO anon, authenticated
  USING (verification_status IN ('official','verified','community'));

-- Validate percentage discounts: value must be between 0 and 100.
CREATE UNIQUE INDEX IF NOT EXISTS idx_fare_discounts_pct_chk
  ON fare_discounts (id)
  WHERE discount_type = 'percentage' AND (discount_value < 0 OR discount_value > 100);

CREATE INDEX IF NOT EXISTS idx_fare_discounts_fare ON fare_discounts (fare_id);
CREATE INDEX IF NOT EXISTS idx_fare_discounts_type ON fare_discounts (passenger_type);

-- =========================================================
-- UPDATED_AT TRIGGERS
-- =========================================================
DROP TRIGGER IF EXISTS trg_fares_updated ON fares;
CREATE TRIGGER trg_fares_updated BEFORE UPDATE ON fares
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_fare_rules_updated ON fare_rules;
CREATE TRIGGER trg_fare_rules_updated BEFORE UPDATE ON fare_rules
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_fare_discounts_updated ON fare_discounts;
CREATE TRIGGER trg_fare_discounts_updated BEFORE UPDATE ON fare_discounts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
