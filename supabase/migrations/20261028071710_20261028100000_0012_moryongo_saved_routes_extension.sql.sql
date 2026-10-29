/*
# MoryonGo Feature #13: Saved Routes and Favorite Trips

Extends the existing saved_routes table (created in Feature #7) from a simple
route bookmark into a full journey-saving system, and adds a saved_route_segments
table for multi-leg journeys.

## Changes to saved_routes
- origin_location_id (uuid, nullable) — FK to locations
- destination_location_id (uuid, nullable) — FK to locations
- journey_snapshot (jsonb, nullable) — validated snapshot of the saved journey
- preferred_transport_mode_id (uuid, nullable) — FK to transport_modes
- category (saved_route_category enum) — commute/school/work/family/tourism/other
- is_favorite (boolean, default false)
- notes (text, nullable)
- route_id made nullable (a saved trip may use custom locations without a single route)

## New table: saved_route_segments
- Multi-leg journey segments with sequence ordering
- Each segment references a route, transport mode, origin/destination
- FK to saved_routes with ON DELETE CASCADE

## New enum: saved_route_category
- commute, school, work, family, tourism, other

## Security
- RLS already enabled on saved_routes; policies already exist (owner-scoped CRUD)
- RLS enabled on saved_route_segments with owner-scoped policies via parent join
- Grants to authenticated only (app requires sign-in)
- Indexes on user_id, is_favorite, category, and segment ordering
*/

-- =========================================================
-- ENUM
-- =========================================================
DO $$ BEGIN
  CREATE TYPE saved_route_category AS ENUM ('commute','school','work','family','tourism','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =========================================================
-- EXTEND saved_routes
-- =========================================================
ALTER TABLE saved_routes ALTER COLUMN route_id DROP NOT NULL;

ALTER TABLE saved_routes ADD COLUMN IF NOT EXISTS origin_location_id uuid REFERENCES locations(id) ON DELETE SET NULL;
ALTER TABLE saved_routes ADD COLUMN IF NOT EXISTS destination_location_id uuid REFERENCES locations(id) ON DELETE SET NULL;
ALTER TABLE saved_routes ADD COLUMN IF NOT EXISTS journey_snapshot jsonb;
ALTER TABLE saved_routes ADD COLUMN IF NOT EXISTS preferred_transport_mode_id uuid REFERENCES transport_modes(id) ON DELETE SET NULL;
ALTER TABLE saved_routes ADD COLUMN IF NOT EXISTS category saved_route_category NOT NULL DEFAULT 'other';
ALTER TABLE saved_routes ADD COLUMN IF NOT EXISTS is_favorite boolean NOT NULL DEFAULT false;
ALTER TABLE saved_routes ADD COLUMN IF NOT EXISTS notes text;

-- Drop old unique constraint (user_id, route_id) since route_id is now nullable
-- and a user may save multiple trips using the same route with different names.
ALTER TABLE saved_routes DROP CONSTRAINT IF EXISTS saved_routes_user_id_route_id_key;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_saved_routes_user_favorite ON saved_routes (user_id, is_favorite);
CREATE INDEX IF NOT EXISTS idx_saved_routes_user_category ON saved_routes (user_id, category);
CREATE INDEX IF NOT EXISTS idx_saved_routes_origin ON saved_routes (origin_location_id);
CREATE INDEX IF NOT EXISTS idx_saved_routes_destination ON saved_routes (destination_location_id);

-- =========================================================
-- saved_route_segments
-- =========================================================
CREATE TABLE IF NOT EXISTS saved_route_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  saved_route_id uuid NOT NULL REFERENCES saved_routes(id) ON DELETE CASCADE,
  sequence_number integer NOT NULL,
  route_id uuid REFERENCES routes(id) ON DELETE SET NULL,
  transport_mode_id uuid REFERENCES transport_modes(id) ON DELETE SET NULL,
  origin_location_id uuid REFERENCES locations(id) ON DELETE SET NULL,
  destination_location_id uuid REFERENCES locations(id) ON DELETE SET NULL,
  transfer_notes text,
  created_at timestamptz DEFAULT now(),
  UNIQUE (saved_route_id, sequence_number)
);

ALTER TABLE saved_route_segments ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON saved_route_segments TO authenticated;

DROP POLICY IF EXISTS "select_own_saved_route_segments" ON saved_route_segments;
CREATE POLICY "select_own_saved_route_segments" ON saved_route_segments FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM saved_routes WHERE saved_routes.id = saved_route_segments.saved_route_id AND saved_routes.user_id = auth.uid()));

DROP POLICY IF EXISTS "insert_own_saved_route_segments" ON saved_route_segments;
CREATE POLICY "insert_own_saved_route_segments" ON saved_route_segments FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM saved_routes WHERE saved_routes.id = saved_route_segments.saved_route_id AND saved_routes.user_id = auth.uid()));

DROP POLICY IF EXISTS "update_own_saved_route_segments" ON saved_route_segments;
CREATE POLICY "update_own_saved_route_segments" ON saved_route_segments FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM saved_routes WHERE saved_routes.id = saved_route_segments.saved_route_id AND saved_routes.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM saved_routes WHERE saved_routes.id = saved_route_segments.saved_route_id AND saved_routes.user_id = auth.uid()));

DROP POLICY IF EXISTS "delete_own_saved_route_segments" ON saved_route_segments;
CREATE POLICY "delete_own_saved_route_segments" ON saved_route_segments FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM saved_routes WHERE saved_routes.id = saved_route_segments.saved_route_id AND saved_routes.user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_saved_route_segments_parent_seq ON saved_route_segments (saved_route_id, sequence_number);
