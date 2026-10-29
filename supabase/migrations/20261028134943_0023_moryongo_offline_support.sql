/*
# MoryonGo Feature #23 — Offline Mode & Low-Connectivity Support

Creates `offline_dataset_versions` — metadata table tracking published
dataset versions so the client can compare local cache vs server and do
incremental sync. Contains only version metadata, NOT duplicated records.
*/

DO $$ BEGIN
  CREATE TYPE offline_dataset_key AS ENUM (
    'routes','route_stops','route_connections','fares','fare_rules',
    'fare_matrices','fare_matrix_entries','locations','transport_modes',
    'emergency_contacts','emergency_guides','destinations','ports',
    'tricycle_service_areas'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS offline_dataset_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_key offline_dataset_key NOT NULL,
  municipality text,
  version_number integer NOT NULL DEFAULT 1,
  published_at timestamptz DEFAULT now(),
  last_verified_at timestamptz,
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (dataset_key, municipality)
);

ALTER TABLE offline_dataset_versions ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON offline_dataset_versions TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON offline_dataset_versions TO service_role;

DROP POLICY IF EXISTS "public_read_dataset_versions" ON offline_dataset_versions;
CREATE POLICY "public_read_dataset_versions" ON offline_dataset_versions FOR SELECT
  TO anon, authenticated USING (is_published = true);

CREATE INDEX IF NOT EXISTS idx_odv_key ON offline_dataset_versions (dataset_key);
CREATE INDEX IF NOT EXISTS idx_odv_muni ON offline_dataset_versions (municipality);

DROP TRIGGER IF EXISTS trg_odv_updated ON offline_dataset_versions;
CREATE TRIGGER trg_odv_updated BEFORE UPDATE ON offline_dataset_versions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
