/*
# MoryonGo Feature #12: Saved Places and Favorite Locations

Extends the existing saved_places table (created in Feature #1) with:
- custom_address (text) — user-entered address for custom places
- latitude / longitude (double precision) — optional coordinates
- is_favorite (boolean) — favorite flag separate from category
- Extended saved_place_category enum with: terminal, port, shopping, landmark, family, other, uncategorized
- Unique constraint on (user_id, location_id) to prevent duplicate saves of the same verified location
- Index on (user_id, is_favorite) for dashboard favorites query
*/

-- Extend the enum with new categories (safe — ADD VALUE is non-breaking)
ALTER TYPE saved_place_category ADD VALUE IF NOT EXISTS 'terminal';
ALTER TYPE saved_place_category ADD VALUE IF NOT EXISTS 'port';
ALTER TYPE saved_place_category ADD VALUE IF NOT EXISTS 'shopping';
ALTER TYPE saved_place_category ADD VALUE IF NOT EXISTS 'landmark';
ALTER TYPE saved_place_category ADD VALUE IF NOT EXISTS 'family';
ALTER TYPE saved_place_category ADD VALUE IF NOT EXISTS 'other';
ALTER TYPE saved_place_category ADD VALUE IF NOT EXISTS 'uncategorized';

-- Add new columns safely
ALTER TABLE saved_places ADD COLUMN IF NOT EXISTS custom_address text;
ALTER TABLE saved_places ADD COLUMN IF NOT EXISTS latitude double precision;
ALTER TABLE saved_places ADD COLUMN IF NOT EXISTS longitude double precision;
ALTER TABLE saved_places ADD COLUMN IF NOT EXISTS is_favorite boolean NOT NULL DEFAULT false;

-- Unique constraint: one user can't save the same verified location twice
-- Only applies when location_id is not null (partial index)
CREATE UNIQUE INDEX IF NOT EXISTS idx_saved_places_user_location_unique
  ON saved_places (user_id, location_id)
  WHERE location_id IS NOT NULL;

-- Index for favorites query on dashboard
CREATE INDEX IF NOT EXISTS idx_saved_places_user_favorite
  ON saved_places (user_id, is_favorite);

-- Index for category filtering
CREATE INDEX IF NOT EXISTS idx_saved_places_user_category
  ON saved_places (user_id, category);
