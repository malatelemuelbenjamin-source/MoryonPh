/*
# Feature 25: Trip History & Journey Records

## Purpose
Lets authenticated users record, organize, and manage journeys they have planned
or explicitly saved, with a clear distinction between planned, started, and
user-confirmed completed trips. Reuses existing locations, routes, transport_modes,
fares, and saved_routes infrastructure. Route searches and fare views do NOT
automatically create trip records.

## New Tables

### trip_history
- id (uuid PK)
- user_id (uuid NOT NULL, DEFAULT auth.uid(), FK -> auth.users ON DELETE CASCADE)
- origin_location_id, destination_location_id, route_id, transport_mode_id (nullable FKs)
- trip_status (enum: planned, saved, started, completed, cancelled; default planned)
- planned_departure_at, started_at, completed_at (timestamptz nullable)
- estimated_fare, actual_fare (numeric nullable, >= 0; actual is user-entered)
- currency_code (text default 'PHP')
- fare_snapshot (jsonb) — historical fare details preserved at plan time
- passenger_category_id (nullable FK -> passenger_categories)
- notes (text max 1000) — private user note
- created_at, updated_at

### trip_history_segments
- id, trip_history_id (FK CASCADE), segment_order, route_id, origin/destination_location_id,
  transport_mode_id, fare_snapshot, created_at

## Security (RLS)
Owner-scoped: user_id = auth.uid(). Segments protected via parent ownership EXISTS check.
Grants: CRUD on both tables TO authenticated only (private user data).
*/

-- Enum
DO $$ BEGIN
  CREATE TYPE trip_status AS ENUM ('planned', 'saved', 'started', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- trip_history
CREATE TABLE IF NOT EXISTS trip_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  origin_location_id uuid REFERENCES locations(id) ON DELETE SET NULL,
  destination_location_id uuid REFERENCES locations(id) ON DELETE SET NULL,
  route_id uuid REFERENCES routes(id) ON DELETE SET NULL,
  transport_mode_id uuid REFERENCES transport_modes(id) ON DELETE SET NULL,
  trip_status trip_status NOT NULL DEFAULT 'planned',
  planned_departure_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  estimated_fare numeric(12,2) CHECK (estimated_fare IS NULL OR estimated_fare >= 0),
  actual_fare numeric(12,2) CHECK (actual_fare IS NULL OR actual_fare >= 0),
  currency_code text NOT NULL DEFAULT 'PHP',
  fare_snapshot jsonb,
  passenger_category_id uuid REFERENCES passenger_categories(id) ON DELETE SET NULL,
  notes text CHECK (notes IS NULL OR char_length(notes) <= 1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE trip_history ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS trip_history_user_updated_idx
  ON trip_history (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS trip_history_user_status_idx
  ON trip_history (user_id, trip_status);
CREATE INDEX IF NOT EXISTS trip_history_user_planned_idx
  ON trip_history (user_id, planned_departure_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON trip_history TO authenticated;

DROP POLICY IF EXISTS "select_own_trips" ON trip_history;
CREATE POLICY "select_own_trips" ON trip_history FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_trips" ON trip_history;
CREATE POLICY "insert_own_trips" ON trip_history FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_trips" ON trip_history;
CREATE POLICY "update_own_trips" ON trip_history FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_trips" ON trip_history;
CREATE POLICY "delete_own_trips" ON trip_history FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- trip_history_segments
CREATE TABLE IF NOT EXISTS trip_history_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_history_id uuid NOT NULL REFERENCES trip_history(id) ON DELETE CASCADE,
  segment_order integer NOT NULL,
  route_id uuid REFERENCES routes(id) ON DELETE SET NULL,
  origin_location_id uuid REFERENCES locations(id) ON DELETE SET NULL,
  destination_location_id uuid REFERENCES locations(id) ON DELETE SET NULL,
  transport_mode_id uuid REFERENCES transport_modes(id) ON DELETE SET NULL,
  fare_snapshot jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE trip_history_segments ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS trip_history_segments_trip_idx
  ON trip_history_segments (trip_history_id, segment_order);

GRANT SELECT, INSERT, UPDATE, DELETE ON trip_history_segments TO authenticated;

DROP POLICY IF EXISTS "select_own_trip_segments" ON trip_history_segments;
CREATE POLICY "select_own_trip_segments" ON trip_history_segments FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM trip_history th WHERE th.id = trip_history_segments.trip_history_id AND th.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "insert_own_trip_segments" ON trip_history_segments;
CREATE POLICY "insert_own_trip_segments" ON trip_history_segments FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM trip_history th WHERE th.id = trip_history_segments.trip_history_id AND th.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "update_own_trip_segments" ON trip_history_segments;
CREATE POLICY "update_own_trip_segments" ON trip_history_segments FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM trip_history th WHERE th.id = trip_history_segments.trip_history_id AND th.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM trip_history th WHERE th.id = trip_history_segments.trip_history_id AND th.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "delete_own_trip_segments" ON trip_history_segments;
CREATE POLICY "delete_own_trip_segments" ON trip_history_segments FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM trip_history th WHERE th.id = trip_history_segments.trip_history_id AND th.user_id = auth.uid())
  );

-- Keep parent updated_at fresh when segments change
CREATE OR REPLACE FUNCTION touch_trip_history_updated_at()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE trip_history SET updated_at = now() WHERE id = NEW.trip_history_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trip_history_segments_touch_parent ON trip_history_segments;
CREATE TRIGGER trip_history_segments_touch_parent
  AFTER INSERT OR UPDATE OR DELETE ON trip_history_segments
  FOR EACH ROW EXECUTE FUNCTION touch_trip_history_updated_at();
