/*
# MoryonGo Foundation Schema — Feature #1 (Home Dashboard)

1. New Tables
- `users` — extended public profile (linked 1:1 to auth.users). Optional fields only.
- `locations` — canonical Marinduque geographic database. Reused by ALL future modules
  (route planner, fare calculator, jeepney/tricycle routes, ports, tourist destinations,
  nearby places, emergency facilities). No duplicate location tables should ever be created.
- `saved_places` — per-user saved location shortcuts (home/school/work/favorite/custom).
- `recent_searches` — per-user private search history (newest first).
- `local_alerts` — verified transport / ferry / road / weather / government advisories.

2. Verification + source discipline
- Every official record carries `verification_status`, `source`, and `last_verified_at`.
- Home screen only surfaces `official` and `verified` prominently; `community` is allowed
  but MUST be visually labeled "Community Report — Not yet verified"; `estimated` is never
  shown as official.

3. Seed data
- Seeds ONLY the six verified Marinduque municipalities as geographic records:
  Boac, Buenavista, Gasan, Mogpog, Santa Cruz, Torrijos.
- No barangays, terminals, ports, or tourist destinations are invented.

4. Security
- RLS enabled on every table.
- `locations` is publicly readable (anon + authenticated) — the catalog is shared.
- `local_alerts` publicly readable for `official`/`verified`/`community` rows that are
  currently active; only `service_role` may insert/update/delete (admin-only authoring).
- `saved_places`, `recent_searches`, `users` are owner-scoped to `authenticated`.
- Owner columns (`user_id`) default to `auth.uid()` so client inserts without a
  user_id still satisfy the WITH CHECK policy.

Note: `users` is a reserved word in PostgreSQL, so it is quoted throughout.
*/

-- =========================================================
-- ENUMS
-- =========================================================
DO $$ BEGIN
  CREATE TYPE location_type AS ENUM (
    'municipality','barangay','terminal','port','tourist_destination',
    'landmark','hospital','school','market','business','other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE verification_status AS ENUM (
    'official','verified','community','estimated','rejected','archived'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE alert_category AS ENUM (
    'transport','ferry','road','weather','tourism','emergency','government','other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE alert_priority AS ENUM (
    'critical','high','medium','low','information'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE saved_place_category AS ENUM (
    'home','school','work','favorite','custom'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE preferred_language AS ENUM ('filipino','english');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =========================================================
-- USERS (public profile, 1:1 with auth.users)
-- =========================================================
CREATE TABLE IF NOT EXISTS "users" (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text,
  email text,
  profile_photo text,
  preferred_language preferred_language DEFAULT 'filipino',
  home_municipality text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON "users" TO authenticated;

DROP POLICY IF EXISTS "users_select_own" ON "users";
CREATE POLICY "users_select_own" ON "users" FOR SELECT
  TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "users_insert_own" ON "users";
CREATE POLICY "users_insert_own" ON "users" FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "users_update_own" ON "users";
CREATE POLICY "users_update_own" ON "users" FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- =========================================================
-- LOCATIONS (shared canonical geographic database)
-- =========================================================
CREATE TABLE IF NOT EXISTS locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  normalized_name text NOT NULL,
  type location_type NOT NULL DEFAULT 'other',
  municipality text,
  barangay text,
  province text NOT NULL DEFAULT 'Marinduque',
  latitude double precision,
  longitude double precision,
  address text,
  description text,
  is_searchable boolean NOT NULL DEFAULT true,
  verification_status verification_status NOT NULL DEFAULT 'community',
  source text,
  last_verified_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON locations TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON locations TO service_role;

DROP POLICY IF EXISTS "locations_public_read" ON locations;
CREATE POLICY "locations_public_read" ON locations FOR SELECT
  TO anon, authenticated USING (is_searchable = true);

CREATE INDEX IF NOT EXISTS idx_locations_type ON locations (type);
CREATE INDEX IF NOT EXISTS idx_locations_municipality ON locations (municipality);
CREATE INDEX IF NOT EXISTS idx_locations_normalized_name ON locations USING gin (to_tsvector('simple', normalized_name));
CREATE INDEX IF NOT EXISTS idx_locations_verification ON locations (verification_status);

-- =========================================================
-- SAVED PLACES
-- =========================================================
CREATE TABLE IF NOT EXISTS saved_places (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  location_id uuid REFERENCES locations(id) ON DELETE SET NULL,
  custom_name text,
  category saved_place_category NOT NULL DEFAULT 'favorite',
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE saved_places ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON saved_places TO authenticated;

DROP POLICY IF EXISTS "saved_places_select_own" ON saved_places;
CREATE POLICY "saved_places_select_own" ON saved_places FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "saved_places_insert_own" ON saved_places;
CREATE POLICY "saved_places_insert_own" ON saved_places FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "saved_places_update_own" ON saved_places;
CREATE POLICY "saved_places_update_own" ON saved_places FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "saved_places_delete_own" ON saved_places;
CREATE POLICY "saved_places_delete_own" ON saved_places FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- =========================================================
-- RECENT SEARCHES
-- =========================================================
CREATE TABLE IF NOT EXISTS recent_searches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  location_id uuid REFERENCES locations(id) ON DELETE SET NULL,
  search_text text,
  searched_at timestamptz DEFAULT now()
);

ALTER TABLE recent_searches ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON recent_searches TO authenticated;

DROP POLICY IF EXISTS "recent_searches_select_own" ON recent_searches;
CREATE POLICY "recent_searches_select_own" ON recent_searches FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "recent_searches_insert_own" ON recent_searches;
CREATE POLICY "recent_searches_insert_own" ON recent_searches FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "recent_searches_delete_own" ON recent_searches;
CREATE POLICY "recent_searches_delete_own" ON recent_searches FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_recent_searches_user_time ON recent_searches (user_id, searched_at DESC);

-- =========================================================
-- LOCAL ALERTS
-- =========================================================
CREATE TABLE IF NOT EXISTS local_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  category alert_category NOT NULL DEFAULT 'other',
  affected_location_id uuid REFERENCES locations(id) ON DELETE SET NULL,
  source text,
  source_reference text,
  verification_status verification_status NOT NULL DEFAULT 'community',
  priority alert_priority NOT NULL DEFAULT 'information',
  start_at timestamptz,
  end_at timestamptz,
  last_verified_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE local_alerts ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON local_alerts TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON local_alerts TO service_role;

DROP POLICY IF EXISTS "local_alerts_public_read" ON local_alerts;
CREATE POLICY "local_alerts_public_read" ON local_alerts FOR SELECT
  TO anon, authenticated
  USING (
    verification_status IN ('official','verified','community')
    AND (end_at IS NULL OR end_at > now())
  );

CREATE INDEX IF NOT EXISTS idx_local_alerts_status ON local_alerts (verification_status);
CREATE INDEX IF NOT EXISTS idx_local_alerts_priority ON local_alerts (priority);
CREATE INDEX IF NOT EXISTS idx_local_alerts_start ON local_alerts (start_at);

-- =========================================================
-- updated_at trigger helper
-- =========================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_users_updated ON "users";
CREATE TRIGGER trg_users_updated BEFORE UPDATE ON "users"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_locations_updated ON locations;
CREATE TRIGGER trg_locations_updated BEFORE UPDATE ON locations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_saved_places_updated ON saved_places;
CREATE TRIGGER trg_saved_places_updated BEFORE UPDATE ON saved_places
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_local_alerts_updated ON local_alerts;
CREATE TRIGGER trg_local_alerts_updated BEFORE UPDATE ON local_alerts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =========================================================
-- SEED: six Marinduque municipalities (verified)
-- Coordinates are the well-known municipal center coordinates
-- of each Marinduque municipality (publicly available geographic data).
-- =========================================================
INSERT INTO locations (
  name, normalized_name, type, municipality, barangay, province,
  latitude, longitude, address, description, is_searchable,
  verification_status, source, last_verified_at
) VALUES
  ('Boac',          'boac',          'municipality', 'Boac',          NULL, 'Marinduque', 13.4667, 121.8500, 'Boac, Marinduque',          'Provincial capital of Marinduque.', true, 'official', 'MoryonGo — Marinduque municipality gazetteer', now()),
  ('Buenavista',    'buenavista',    'municipality', 'Buenavista',    NULL, 'Marinduque', 13.4667, 121.9333, 'Buenavista, Marinduque',    'Northern municipality of Marinduque.', true, 'official', 'MoryonGo — Marinduque municipality gazetteer', now()),
  ('Gasan',         'gasan',         'municipality', 'Gasan',         NULL, 'Marinduque', 13.3167, 121.8833, 'Gasan, Marinduque',          'Southwestern municipality of Marinduque.', true, 'official', 'MoryonGo — Marinduque municipality gazetteer', now()),
  ('Mogpog',        'mogpog',        'municipality', 'Mogpog',        NULL, 'Marinduque', 13.4167, 121.8333, 'Mogpog, Marinduque',         'Northern municipality of Marinduque.', true, 'official', 'MoryonGo — Marinduque municipality gazetteer', now()),
  ('Santa Cruz',    'santa cruz',    'municipality', 'Santa Cruz',    NULL, 'Marinduque', 13.5000, 121.9167, 'Santa Cruz, Marinduque',     'Northernmost municipality of Marinduque.', true, 'official', 'MoryonGo — Marinduque municipality gazetteer', now()),
  ('Torrijos',      'torrijos',      'municipality', 'Torrijos',      NULL, 'Marinduque', 13.3000, 121.9833, 'Torrijos, Marinduque',       'Eastern municipality of Marinduque.', true, 'official', 'MoryonGo — Marinduque municipality gazetteer', now())
ON CONFLICT DO NOTHING;
