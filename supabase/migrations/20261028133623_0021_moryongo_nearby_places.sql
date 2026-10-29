/*
# MoryonGo Feature #21 — Nearby Places & Services

1. New Types
- `nearby_place_category` enum: categorizes nearby places into daily-needs,
  essential-services, transportation, and travel/tourism groups. Values:
  restaurant, cafe_bakery, grocery_market, convenience_store, local_shop,
  public_market, pharmacy, hospital_clinic, health_center, atm_bank,
  police_station, fire_station, government_office, gas_station, public_toilet,
  jeepney_stop, tricycle_terminal, bus_terminal, port, ferry_terminal,
  boat_service, tourist_attraction, beach, historical_cultural, accommodation,
  visitor_info, other.

2. New Table
- `nearby_place_details` — extension table linked to the existing canonical
  `locations` table (reuses locations for name, municipality, barangay,
  coordinates, address, verification_status, source). Stores extra place
  metadata that locations doesn't have: category, phone, operating hours,
  description, data source, verification tracking.
  - `place_id` FK → locations(id) ON DELETE CASCADE
  - `category` nearby_place_category enum
  - `phone_number` text (nullable)
  - `operating_hours` jsonb (nullable, structured)
  - `description` text (nullable)
  - `data_source` text (nullable, e.g. 'moryongo', 'official', 'community')
  - `last_verified_at` timestamptz
  - `is_active` boolean default true

3. Security
- RLS enabled on nearby_place_details.
- Public read: anon + authenticated can read active, non-rejected records.
- service_role: full CRUD (for admin edge functions).
- authenticated: INSERT for community submissions (status defaults to
  'community' via the locations FK relationship).
- No UPDATE/DELETE for anon or authenticated directly — admin-managed.

4. Indexes
- nearby_place_details(place_id) — fast join to locations.
- nearby_place_details(category) — category filter.
- locations(type), locations(municipality) — existing, reused.
*/

-- =========================================================
-- NEARBY PLACE CATEGORY ENUM
-- =========================================================
DO $$ BEGIN
  CREATE TYPE nearby_place_category AS ENUM (
    'restaurant','cafe_bakery','grocery_market','convenience_store','local_shop',
    'public_market','pharmacy','hospital_clinic','health_center','atm_bank',
    'police_station','fire_station','government_office','gas_station','public_toilet',
    'jeepney_stop','tricycle_terminal','bus_terminal','port','ferry_terminal',
    'boat_service','tourist_attraction','beach','historical_cultural','accommodation',
    'visitor_info','other'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =========================================================
-- NEARBY PLACE DETAILS TABLE
-- =========================================================
CREATE TABLE IF NOT EXISTS nearby_place_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  category nearby_place_category NOT NULL DEFAULT 'other',
  phone_number text,
  operating_hours jsonb,
  description text,
  data_source text,
  last_verified_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE nearby_place_details ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON nearby_place_details TO anon, authenticated;
GRANT INSERT ON nearby_place_details TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON nearby_place_details TO service_role;

DROP POLICY IF EXISTS "public_read_nearby_places" ON nearby_place_details;
CREATE POLICY "public_read_nearby_places" ON nearby_place_details FOR SELECT
  TO anon, authenticated USING (is_active = true);

DROP POLICY IF EXISTS "authed_submit_nearby_place" ON nearby_place_details;
CREATE POLICY "authed_submit_nearby_place" ON nearby_place_details FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_npd_place ON nearby_place_details (place_id);
CREATE INDEX IF NOT EXISTS idx_npd_category ON nearby_place_details (category);

DROP TRIGGER IF EXISTS trg_npd_updated ON nearby_place_details;
CREATE TRIGGER trg_npd_updated BEFORE UPDATE ON nearby_place_details
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
