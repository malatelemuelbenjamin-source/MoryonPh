/*
# MoryonGo Feature #6 — Passenger Discount System

1. New Tables
- `passenger_categories` — standardized passenger category codes (regular,
  student, senior, pwd, child, other). These are category IDENTIFIERS, not
  confirmation that any discount is available. Reused across the app instead
  of conflicting definitions.
- `passenger_discount_requirements` — verified eligibility and documentation
  requirements per category, optionally scoped to a transport mode or route.
  Stores source, source_reference, last_verified_at, and effective dates.

2. Modified Tables
- `fare_discounts` — adds nullable `passenger_category_id` FK to
  `passenger_categories.id` so a discount can reference the shared category
  instead of only the text `passenger_type` enum. The existing
  `passenger_type` column is kept for backwards compatibility.
- `users` — adds nullable `preferred_passenger_category_id` FK so a user can
  save a preferred category in their profile. This is a PREFERENCE only — it
  does not prove eligibility. No documents are uploaded.

3. Accuracy discipline (mirrors Features #3-#5)
- No invented discounts, percentages, or eligibility requirements.
- Only official/verified discount rules appear as trusted information.
- community/estimated are shown with a clear label, never as official.
- rejected/archived are never used for current calculations.
- A missing or unverified discount is "unknown", NOT zero.
- discount_type = 'none' means a verified rule explicitly says no discount.
- Expired rules are never silently reused.

4. Security
- RLS on every new table.
- Public read (anon + authenticated) for passenger_categories (catalog).
- Public read (anon + authenticated) for passenger_discount_requirements with
  verification_status in (official, verified, community) and currently effective.
- All writes to new tables restricted to service_role.
- users table: users can update only their own preferred_passenger_category_id
  (column-restricted UPDATE grant). Existing user policies unchanged.

5. Indexes
- passenger_categories: unique code.
- passenger_discount_requirements: category, transport_mode, route, verification.
*/

-- =========================================================
-- PASSENGER_CATEGORIES
-- =========================================================
CREATE TABLE IF NOT EXISTS passenger_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE passenger_categories ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON passenger_categories TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON passenger_categories TO service_role;

DROP POLICY IF EXISTS "passenger_categories_public_read" ON passenger_categories;
CREATE POLICY "passenger_categories_public_read" ON passenger_categories FOR SELECT
  TO anon, authenticated USING (true);

-- Seed the six initial category codes.
INSERT INTO passenger_categories (code, name, description, is_active)
VALUES
  ('regular',  'Regular Passenger', 'Standard adult fare with no discount.', true),
  ('student',  'Student',           'Enrolled students who may qualify for a discount with valid ID.', true),
  ('senior',   'Senior Citizen',    'Senior citizens who may qualify for a discount with valid ID.', true),
  ('pwd',      'PWD',               'Persons with disability who may qualify for a discount with valid ID.', true),
  ('child',    'Child',             'Children who may qualify for a child fare when a verified rule exists.', true),
  ('other',    'Other',             'Other verified passenger categories.', true)
ON CONFLICT (code) DO NOTHING;

-- =========================================================
-- PASSENGER_DISCOUNT_REQUIREMENTS
-- =========================================================
CREATE TABLE IF NOT EXISTS passenger_discount_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  passenger_category_id uuid NOT NULL REFERENCES passenger_categories(id) ON DELETE RESTRICT,
  transport_mode_id uuid REFERENCES transport_modes(id) ON DELETE SET NULL,
  route_id uuid REFERENCES routes(id) ON DELETE SET NULL,
  requirement_title text NOT NULL,
  requirement_description text,
  required_document text,
  source text,
  source_reference text,
  verification_status verification_status NOT NULL DEFAULT 'community',
  effective_from date,
  effective_until date,
  last_verified_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE passenger_discount_requirements ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON passenger_discount_requirements TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON passenger_discount_requirements TO service_role;

DROP POLICY IF EXISTS "passenger_discount_requirements_public_read" ON passenger_discount_requirements;
CREATE POLICY "passenger_discount_requirements_public_read" ON passenger_discount_requirements FOR SELECT
  TO anon, authenticated
  USING (
    verification_status IN ('official','verified','community')
    AND (effective_from IS NULL OR effective_from <= CURRENT_DATE)
    AND (effective_until IS NULL OR effective_until >= CURRENT_DATE)
  );

CREATE INDEX IF NOT EXISTS idx_pdr_category ON passenger_discount_requirements (passenger_category_id);
CREATE INDEX IF NOT EXISTS idx_pdr_transport ON passenger_discount_requirements (transport_mode_id);
CREATE INDEX IF NOT EXISTS idx_pdr_route ON passenger_discount_requirements (route_id);
CREATE INDEX IF NOT EXISTS idx_pdr_verify ON passenger_discount_requirements (verification_status);

-- =========================================================
-- FARE_DISCOUNTS: add passenger_category_id FK
-- =========================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'fare_discounts' AND column_name = 'passenger_category_id'
  ) THEN
    ALTER TABLE fare_discounts
      ADD COLUMN passenger_category_id uuid REFERENCES passenger_categories(id) ON DELETE SET NULL;
  END IF;
END $$;

-- =========================================================
-- USERS: add preferred_passenger_category_id
-- =========================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'preferred_passenger_category_id'
  ) THEN
    ALTER TABLE users
      ADD COLUMN preferred_passenger_category_id uuid REFERENCES passenger_categories(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Grant UPDATE on just the new column to authenticated users.
DROP POLICY IF EXISTS "users_update_preferred_category" ON users;
CREATE POLICY "users_update_preferred_category" ON users FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

GRANT UPDATE (preferred_passenger_category_id) ON users TO authenticated;

-- =========================================================
-- TRIGGERS
-- =========================================================
DROP TRIGGER IF EXISTS trg_passenger_categories_updated ON passenger_categories;
CREATE TRIGGER trg_passenger_categories_updated BEFORE UPDATE ON passenger_categories
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_passenger_discount_requirements_updated ON passenger_discount_requirements;
CREATE TRIGGER trg_passenger_discount_requirements_updated BEFORE UPDATE ON passenger_discount_requirements
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
