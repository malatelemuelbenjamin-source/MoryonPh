/*
# MoryonGo Feature #7 — Jeepney Routes System

1. New Tables
- `route_service_details` — optional jeepney-specific metadata for a route
  (service direction, notes, operating days, first/last trip, frequency,
  boarding instructions, accessibility notes). All schedule fields are
  nullable because service hours and frequency must NOT be assumed.
  verification_status / source / source_reference / last_verified_at
  preserve the provenance of the information.
- `route_geometries` — optional verified route geometry (GeoJSON or encoded
  polyline). Only authorized users may publish verified geometry. No
  fabricated coordinates are ever generated.
- `saved_routes` — user-owned saved route bookmarks. Each user sees only
  their own saved routes. Unique constraint prevents saving the same route
  twice per user.

2. No Modified Tables
- The existing `routes`, `route_stops`, `locations`, and `transport_modes`
  tables already support every field the Jeepney Routes feature needs.
  No duplicate `jeepney_routes` table is created.

3. Security
- `route_service_details` and `route_geometries`: public read (anon +
  authenticated) for official/verified/ community records that are currently
  effective. All writes restricted to service_role.
- `saved_routes`: owner-scoped CRUD for authenticated users only. Each user
  sees and manages only their own saved routes. user_id defaults to auth.uid().
- No service-role key is ever exposed in frontend code.

4. Indexes
- route_service_details: route_id, verification_status.
- route_geometries: route_id, verification_status.
- saved_routes: user_id, route_id.
*/

-- =========================================================
-- ROUTE_SERVICE_DETAILS
-- =========================================================
CREATE TABLE IF NOT EXISTS route_service_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id uuid NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  service_direction text,
  service_notes text,
  operating_days text,
  first_trip_time time,
  last_trip_time time,
  service_frequency_minutes integer,
  boarding_instructions text,
  accessibility_notes text,
  verification_status verification_status NOT NULL DEFAULT 'community',
  source text,
  source_reference text,
  last_verified_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE route_service_details ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON route_service_details TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON route_service_details TO service_role;

DROP POLICY IF EXISTS "route_service_details_public_read" ON route_service_details;
CREATE POLICY "route_service_details_public_read" ON route_service_details FOR SELECT
  TO anon, authenticated
  USING (
    verification_status IN ('official','verified','community')
  );

CREATE INDEX IF NOT EXISTS idx_rsd_route ON route_service_details (route_id);
CREATE INDEX IF NOT EXISTS idx_rsd_verify ON route_service_details (verification_status);

DROP TRIGGER IF EXISTS trg_route_service_details_updated ON route_service_details;
CREATE TRIGGER trg_route_service_details_updated BEFORE UPDATE ON route_service_details
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =========================================================
-- ROUTE_GEOMETRIES
-- =========================================================
CREATE TABLE IF NOT EXISTS route_geometries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id uuid NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  geometry_format text NOT NULL DEFAULT 'geojson',
  geometry_data jsonb NOT NULL,
  verification_status verification_status NOT NULL DEFAULT 'community',
  source text,
  source_reference text,
  last_verified_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE route_geometries ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON route_geometries TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON route_geometries TO service_role;

DROP POLICY IF EXISTS "route_geometries_public_read" ON route_geometries;
CREATE POLICY "route_geometries_public_read" ON route_geometries FOR SELECT
  TO anon, authenticated
  USING (
    verification_status IN ('official','verified','community')
  );

CREATE INDEX IF NOT EXISTS idx_rg_route ON route_geometries (route_id);
CREATE INDEX IF NOT EXISTS idx_rg_verify ON route_geometries (verification_status);

DROP TRIGGER IF EXISTS trg_route_geometries_updated ON route_geometries;
CREATE TRIGGER trg_route_geometries_updated BEFORE UPDATE ON route_geometries
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =========================================================
-- SAVED_ROUTES
-- =========================================================
CREATE TABLE IF NOT EXISTS saved_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  route_id uuid NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  custom_name text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id, route_id)
);

ALTER TABLE saved_routes ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON saved_routes TO authenticated;

DROP POLICY IF EXISTS "select_own_saved_routes" ON saved_routes;
CREATE POLICY "select_own_saved_routes" ON saved_routes FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_saved_routes" ON saved_routes;
CREATE POLICY "insert_own_saved_routes" ON saved_routes FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_saved_routes" ON saved_routes;
CREATE POLICY "update_own_saved_routes" ON saved_routes FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_saved_routes" ON saved_routes;
CREATE POLICY "delete_own_saved_routes" ON saved_routes FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_saved_routes_user ON saved_routes (user_id);
CREATE INDEX IF NOT EXISTS idx_saved_routes_route ON saved_routes (route_id);

DROP TRIGGER IF EXISTS trg_saved_routes_updated ON saved_routes;
CREATE TRIGGER trg_saved_routes_updated BEFORE UPDATE ON saved_routes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
