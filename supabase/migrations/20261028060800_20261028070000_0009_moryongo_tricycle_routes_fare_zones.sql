/*
# MoryonGo Feature #8: Tricycle Routes and Fare Zones System

1. New Tables
- `tricycle_service_areas` — verified tricycle service areas per municipality.
  Fields: id, name, municipality_id (→ locations), description, coverage_type enum,
  coverage_geojson (jsonb, optional), centroid_latitude/longitude (optional),
  verification_status (reuses existing enum, default 'community'), source_name, source_url,
  verified_by (→ auth.users), verified_at, created_at, updated_at.
- `tricycle_fare_zones` — fare zones within service areas.
  Fields: id, name, municipality_id (→ locations), service_area_id (→ tricycle_service_areas, optional),
  description, boundary_geojson (jsonb, optional), verification_status, source_name,
  verified_by (→ auth.users), verified_at, created_at, updated_at.
- `tricycle_zone_connections` — zone-to-zone service links with optional route/fare references.
  Fields: id, origin_zone_id, destination_zone_id, route_id (optional), fare_id (optional),
  service_type enum, availability_notes, verification_status, source_name, verified_by, verified_at,
  created_at, updated_at. Unique constraint on (origin_zone_id, destination_zone_id, service_type).

2. Modified Tables
- `saved_routes` — added optional origin_location_id, destination_location_id, transport_mode_id
  so tricycle journeys can be saved without a route_id.

3. New Enums
- `tricycle_coverage_type`: 'barangay','terminal','zone','landmark','custom_area'
- `tricycle_service_type`: 'shared','special','unspecified'

4. Security
- RLS enabled on all 3 new tables.
- Public read (anon + authenticated) for verified/published records only.
- service_role gets INSERT, UPDATE, DELETE (admin tooling).
- Updated_at triggers reuse existing set_updated_at() function.
*/

-- =========================================================
-- ENUMS
-- =========================================================
DO $$ BEGIN
  CREATE TYPE tricycle_coverage_type AS ENUM (
    'barangay','terminal','zone','landmark','custom_area'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE tricycle_service_type AS ENUM (
    'shared','special','unspecified'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =========================================================
-- TRICYCLE_SERVICE_AREAS
-- =========================================================
CREATE TABLE IF NOT EXISTS tricycle_service_areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  municipality_id uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  description text,
  coverage_type tricycle_coverage_type NOT NULL DEFAULT 'zone',
  coverage_geojson jsonb,
  centroid_latitude double precision,
  centroid_longitude double precision,
  verification_status verification_status NOT NULL DEFAULT 'community',
  source_name text,
  source_url text,
  verified_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  verified_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE tricycle_service_areas ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON tricycle_service_areas TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON tricycle_service_areas TO service_role;

DROP POLICY IF EXISTS "tricycle_service_areas_public_read" ON tricycle_service_areas;
CREATE POLICY "tricycle_service_areas_public_read" ON tricycle_service_areas FOR SELECT
  TO anon, authenticated
  USING (verification_status IN ('official','verified','community'));

CREATE INDEX IF NOT EXISTS idx_tricycle_sa_municipality ON tricycle_service_areas (municipality_id);
CREATE INDEX IF NOT EXISTS idx_tricycle_sa_status ON tricycle_service_areas (verification_status);

-- =========================================================
-- TRICYCLE_FARE_ZONES
-- =========================================================
CREATE TABLE IF NOT EXISTS tricycle_fare_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  municipality_id uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  service_area_id uuid REFERENCES tricycle_service_areas(id) ON DELETE SET NULL,
  description text,
  boundary_geojson jsonb,
  verification_status verification_status NOT NULL DEFAULT 'community',
  source_name text,
  verified_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  verified_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE tricycle_fare_zones ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON tricycle_fare_zones TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON tricycle_fare_zones TO service_role;

DROP POLICY IF EXISTS "tricycle_fare_zones_public_read" ON tricycle_fare_zones;
CREATE POLICY "tricycle_fare_zones_public_read" ON tricycle_fare_zones FOR SELECT
  TO anon, authenticated
  USING (verification_status IN ('official','verified','community'));

CREATE INDEX IF NOT EXISTS idx_tricycle_fz_municipality ON tricycle_fare_zones (municipality_id);
CREATE INDEX IF NOT EXISTS idx_tricycle_fz_service_area ON tricycle_fare_zones (service_area_id);
CREATE INDEX IF NOT EXISTS idx_tricycle_fz_status ON tricycle_fare_zones (verification_status);

-- =========================================================
-- TRICYCLE_ZONE_CONNECTIONS
-- =========================================================
CREATE TABLE IF NOT EXISTS tricycle_zone_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  origin_zone_id uuid NOT NULL REFERENCES tricycle_fare_zones(id) ON DELETE CASCADE,
  destination_zone_id uuid NOT NULL REFERENCES tricycle_fare_zones(id) ON DELETE CASCADE,
  route_id uuid REFERENCES routes(id) ON DELETE SET NULL,
  fare_id uuid REFERENCES fares(id) ON DELETE SET NULL,
  service_type tricycle_service_type NOT NULL DEFAULT 'unspecified',
  availability_notes text,
  verification_status verification_status NOT NULL DEFAULT 'community',
  source_name text,
  verified_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  verified_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT tricycle_zone_conn_unique UNIQUE (origin_zone_id, destination_zone_id, service_type)
);

ALTER TABLE tricycle_zone_connections ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON tricycle_zone_connections TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON tricycle_zone_connections TO service_role;

DROP POLICY IF EXISTS "tricycle_zone_conn_public_read" ON tricycle_zone_connections;
CREATE POLICY "tricycle_zone_conn_public_read" ON tricycle_zone_connections FOR SELECT
  TO anon, authenticated
  USING (verification_status IN ('official','verified','community'));

CREATE INDEX IF NOT EXISTS idx_tricycle_zc_origin ON tricycle_zone_connections (origin_zone_id);
CREATE INDEX IF NOT EXISTS idx_tricycle_zc_dest ON tricycle_zone_connections (destination_zone_id);
CREATE INDEX IF NOT EXISTS idx_tricycle_zc_status ON tricycle_zone_connections (verification_status);

-- =========================================================
-- EXTEND saved_routes with optional origin/destination columns
-- =========================================================
ALTER TABLE saved_routes ADD COLUMN IF NOT EXISTS origin_location_id uuid REFERENCES locations(id) ON DELETE SET NULL;
ALTER TABLE saved_routes ADD COLUMN IF NOT EXISTS destination_location_id uuid REFERENCES locations(id) ON DELETE SET NULL;
ALTER TABLE saved_routes ADD COLUMN IF NOT EXISTS transport_mode_id uuid REFERENCES transport_modes(id) ON DELETE SET NULL;

-- =========================================================
-- UPDATED_AT TRIGGERS
-- =========================================================
DROP TRIGGER IF EXISTS trg_tricycle_sa_updated ON tricycle_service_areas;
CREATE TRIGGER trg_tricycle_sa_updated BEFORE UPDATE ON tricycle_service_areas
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_tricycle_fz_updated ON tricycle_fare_zones;
CREATE TRIGGER trg_tricycle_fz_updated BEFORE UPDATE ON tricycle_fare_zones
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_tricycle_zc_updated ON tricycle_zone_connections;
CREATE TRIGGER trg_tricycle_zc_updated BEFORE UPDATE ON tricycle_zone_connections
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
