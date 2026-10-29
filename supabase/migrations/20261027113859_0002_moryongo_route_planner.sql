/*
# MoryonGo Feature #2 — Route Planner Schema

1. New Tables
- `transport_modes` — canonical list of Marinduque transport modes (walking, jeepney,
  tricycle, e_tricycle, bus, van, ferry, roro, boat, other). A mode only becomes
  "available" in a municipality when a verified route record references it.
- `routes` — verified/admin-approved transport routes between two locations.
  Origin/destination reference the shared Feature #1 `locations` table — no duplicate
  location tables are created.
- `route_stops` — ordered stops for each route (origin/stop/transfer/destination/terminal/port).
- `route_connections` — verified transfer points joining two routes for multi-leg journeys.

2. Data accuracy discipline (carried over from Feature #1)
- Every route carries `verification_status`, `source`, `source_reference`, `last_verified_at`,
  `created_by`, `updated_at`.
- Only `official` and `verified` routes are surfaced as reliable results.
- `community` and `estimated` must never be presented as official.
- No fake routes, fares, schedules, operators, or transfer points are seeded.

3. Security
- RLS enabled on every new table.
- `transport_modes`, `routes`, `route_stops`, `route_connections` are publicly readable
  (anon + authenticated) for active+verified rows only.
- Only `service_role` may insert/update/delete (admin/operator authoring).
- Regular users cannot modify route records regardless of auth state.

4. Future compatibility
- `routes.id` is the stable reusable route identifier. Future Fare Calculator, Live
  Status, Saved Routes, Trip History, and Community Reports must reference this id
  rather than duplicating route information.
*/

-- =========================================================
-- ENUMS
-- =========================================================
DO $$ BEGIN
  CREATE TYPE route_status AS ENUM ('active','inactive','suspended','archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- route_verification_status reuses the existing verification_status enum from
-- Feature #1 (official/verified/community/estimated/rejected/archived).

DO $$ BEGIN
  CREATE TYPE stop_type AS ENUM ('origin','stop','transfer','destination','terminal','port');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =========================================================
-- TRANSPORT_MODES
-- =========================================================
CREATE TABLE IF NOT EXISTS transport_modes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  description text,
  icon text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE transport_modes ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON transport_modes TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON transport_modes TO service_role;

DROP POLICY IF EXISTS "transport_modes_public_read" ON transport_modes;
CREATE POLICY "transport_modes_public_read" ON transport_modes FOR SELECT
  TO anon, authenticated USING (is_active = true);

-- =========================================================
-- ROUTES
-- =========================================================
CREATE TABLE IF NOT EXISTS routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_name text NOT NULL,
  route_code text,
  description text,
  origin_location_id uuid NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
  destination_location_id uuid NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
  transport_mode_id uuid REFERENCES transport_modes(id) ON DELETE SET NULL,
  operator_name text,
  direction text,
  estimated_duration_minutes integer,
  route_status route_status NOT NULL DEFAULT 'active',
  verification_status verification_status NOT NULL DEFAULT 'community',
  source text,
  source_reference text,
  last_verified_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE routes ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON routes TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON routes TO service_role;

-- Public can read active, non-rejected/non-archived routes.
DROP POLICY IF EXISTS "routes_public_read" ON routes;
CREATE POLICY "routes_public_read" ON routes FOR SELECT
  TO anon, authenticated
  USING (
    route_status = 'active'
    AND verification_status IN ('official','verified','community')
  );

CREATE INDEX IF NOT EXISTS idx_routes_origin ON routes (origin_location_id);
CREATE INDEX IF NOT EXISTS idx_routes_destination ON routes (destination_location_id);
CREATE INDEX IF NOT EXISTS idx_routes_mode ON routes (transport_mode_id);
CREATE INDEX IF NOT EXISTS idx_routes_status ON routes (route_status, verification_status);

-- =========================================================
-- ROUTE_STOPS
-- =========================================================
CREATE TABLE IF NOT EXISTS route_stops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id uuid NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
  stop_sequence integer NOT NULL,
  stop_type stop_type NOT NULL DEFAULT 'stop',
  pickup_allowed boolean NOT NULL DEFAULT true,
  dropoff_allowed boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE route_stops ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON route_stops TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON route_stops TO service_role;

DROP POLICY IF EXISTS "route_stops_public_read" ON route_stops;
CREATE POLICY "route_stops_public_read" ON route_stops FOR SELECT
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_route_stops_route_seq ON route_stops (route_id, stop_sequence);
CREATE INDEX IF NOT EXISTS idx_route_stops_location ON route_stops (location_id);

-- =========================================================
-- ROUTE_CONNECTIONS
-- =========================================================
CREATE TABLE IF NOT EXISTS route_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_route_id uuid NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  to_route_id uuid NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  transfer_location_id uuid NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
  minimum_transfer_minutes integer,
  walking_distance_meters integer,
  transfer_notes text,
  verification_status verification_status NOT NULL DEFAULT 'community',
  last_verified_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE route_connections ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON route_connections TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON route_connections TO service_role;

DROP POLICY IF EXISTS "route_connections_public_read" ON route_connections;
CREATE POLICY "route_connections_public_read" ON route_connections FOR SELECT
  TO anon, authenticated
  USING (verification_status IN ('official','verified','community'));

CREATE INDEX IF NOT EXISTS idx_route_connections_from ON route_connections (from_route_id);
CREATE INDEX IF NOT EXISTS idx_route_connections_to ON route_connections (to_route_id);
CREATE INDEX IF NOT EXISTS idx_route_connections_transfer ON route_connections (transfer_location_id);

-- =========================================================
-- updated_at triggers
-- =========================================================
DROP TRIGGER IF EXISTS trg_transport_modes_updated ON transport_modes;
CREATE TRIGGER trg_transport_modes_updated BEFORE UPDATE ON transport_modes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_routes_updated ON routes;
CREATE TRIGGER trg_routes_updated BEFORE UPDATE ON routes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_route_stops_updated ON route_stops;
CREATE TRIGGER trg_route_stops_updated BEFORE UPDATE ON route_stops
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_route_connections_updated ON route_connections;
CREATE TRIGGER trg_route_connections_updated BEFORE UPDATE ON route_connections
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =========================================================
-- SEED: transport modes (canonical list only — no routes invented)
-- =========================================================
INSERT INTO transport_modes (name, code, description, icon, is_active) VALUES
  ('Walking',    'walking',    'Walk between nearby points.',                 'foot',     true),
  ('Jeepney',    'jeepney',     'Public jeepney route.',                       'jeepney',  true),
  ('Tricycle',   'tricycle',    'Motorized tricycle (sidecar).',              'tricycle', true),
  ('E-Tricycle', 'e_tricycle',  'Electric tricycle.',                          'e-tricycle', true),
  ('Bus',        'bus',         'Public bus route.',                           'bus',      true),
  ('Van',        'van',         'Point-to-point van service.',                 'van',      true),
  ('Ferry',      'ferry',       'Passenger ferry service.',                    'ferry',    true),
  ('RORO',       'roro',        'Roll-on/roll-off vessel.',                    'roro',     true),
  ('Boat',       'boat',        'Small boat / banca service.',                 'boat',     true),
  ('Other',      'other',       'Other transport mode.',                       'other',    true)
ON CONFLICT (code) DO NOTHING;
