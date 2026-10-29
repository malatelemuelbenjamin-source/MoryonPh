/*
# MoryonGo Feature #22 — Emergency Information & Assistance

1. emergency_contacts — verified hotline directory (national + per-municipality)
2. emergency_guides — safety/preparedness information articles
Both reuse existing verification_status enum and locations table.
RLS: public read of published/verified records; service_role full CRUD;
   authenticated can submit community-suggested contacts (pending review).
*/

-- =========================================================
-- EMERGENCY CONTACT CATEGORY ENUM
-- =========================================================
DO $$ BEGIN
  CREATE TYPE emergency_contact_category AS ENUM (
    'national_emergency','police','fire_rescue','ambulance_medical',
    'municipal_emergency','disaster_response','maritime_safety',
    'coast_guard','other_assistance'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =========================================================
-- EMERGENCY GUIDE CATEGORY ENUM
-- =========================================================
DO $$ BEGIN
  CREATE TYPE emergency_guide_category AS ENUM (
    'earthquake','typhoon_flood','landslide','fire','medical_emergency',
    'road_accident','maritime_safety','missing_person','other_hazard'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =========================================================
-- EMERGENCY CONTACTS TABLE
-- =========================================================
CREATE TABLE IF NOT EXISTS emergency_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_name text NOT NULL,
  category emergency_contact_category NOT NULL DEFAULT 'other_assistance',
  phone_number text,
  address text,
  municipality text,
  service_coverage text,
  official_source_url text,
  availability_notes text,
  verification_status verification_status NOT NULL DEFAULT 'community',
  is_published boolean NOT NULL DEFAULT false,
  last_verified_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE emergency_contacts ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON emergency_contacts TO anon, authenticated;
GRANT INSERT ON emergency_contacts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON emergency_contacts TO service_role;

DROP POLICY IF EXISTS "public_read_emergency_contacts" ON emergency_contacts;
CREATE POLICY "public_read_emergency_contacts" ON emergency_contacts FOR SELECT
  TO anon, authenticated USING (is_published = true AND verification_status IN ('official','verified'));

DROP POLICY IF EXISTS "authed_suggest_emergency_contact" ON emergency_contacts;
CREATE POLICY "authed_suggest_emergency_contact" ON emergency_contacts FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_ec_category ON emergency_contacts (category);
CREATE INDEX IF NOT EXISTS idx_ec_municipality ON emergency_contacts (municipality);

DROP TRIGGER IF EXISTS trg_ec_updated ON emergency_contacts;
CREATE TRIGGER trg_ec_updated BEFORE UPDATE ON emergency_contacts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =========================================================
-- EMERGENCY GUIDES TABLE
-- =========================================================
CREATE TABLE IF NOT EXISTS emergency_guides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  category emergency_guide_category NOT NULL DEFAULT 'other_hazard',
  content text NOT NULL,
  source_name text,
  source_url text,
  municipality text,
  verification_status verification_status NOT NULL DEFAULT 'community',
  is_published boolean NOT NULL DEFAULT false,
  reviewed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE emergency_guides ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON emergency_guides TO anon, authenticated;
GRANT INSERT ON emergency_guides TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON emergency_guides TO service_role;

DROP POLICY IF EXISTS "public_read_emergency_guides" ON emergency_guides;
CREATE POLICY "public_read_emergency_guides" ON emergency_guides FOR SELECT
  TO anon, authenticated USING (is_published = true AND verification_status IN ('official','verified'));

DROP POLICY IF EXISTS "authed_suggest_emergency_guide" ON emergency_guides;
CREATE POLICY "authed_suggest_emergency_guide" ON emergency_guides FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_eg_category ON emergency_guides (category);
CREATE INDEX IF NOT EXISTS idx_eg_municipality ON emergency_guides (municipality);

DROP TRIGGER IF EXISTS trg_eg_updated ON emergency_guides;
CREATE TRIGGER trg_eg_updated BEFORE UPDATE ON emergency_guides
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
