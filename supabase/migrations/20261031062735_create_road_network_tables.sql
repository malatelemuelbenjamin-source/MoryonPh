/*
# Create road network tables (OpenStreetMap road import)

Plain-English summary
This migration adds the storage for the Marinduque road network. Each import from OpenStreetMap creates a
"road dataset version" that is first held for admin review (staging). An admin then publishes one version,
which becomes the only road data the public map shows. Earlier published versions are archived so they can
be restored (rollback). Roads are stored one row per OpenStreetMap way; nothing is merged by distance.

1. New Tables
- `road_dataset_versions`: one row per import. Holds the status (importing, staging, published, archived,
  failed), the source endpoint and query used, counts (roads kept, skipped, duplicates, invalid), per-municipality
  coverage, attribution text, and who imported and published it.
- `road_segments`: one row per road. Holds the name, classification (OpenStreetMap highway tag), surface,
  access information, municipality link, source identifiers, the original geometry, a simplified display
  geometry, a bounding box for viewport loading, the preserved raw tags, quality flags, and verification status.

2. Security
- Row level security is enabled on both tables.
- Anonymous and signed-in visitors can read only published versions and their roads. Admins can also read
  staging and archived versions (checked with the existing admin helper).
- No client role can insert, update, or delete rows directly. Imports are written by a server-side function
  using the service role, and publishing goes through an admin-only function.
- `activate_road_dataset_version` is admin-only (existing `require_geographic_admin` check) and is not callable
  by anonymous users.

3. Important notes
- Idempotent: tables and indexes use IF NOT EXISTS, and policies are dropped before they are created.
- A partial unique index allows only one published version and only one importing version at a time.
- `barangay_id` is reserved and stays empty until a verified barangay dataset exists.
- Publishing a version archives the previously published version. Failed imports never touch published rows.
*/

CREATE TABLE IF NOT EXISTS road_dataset_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version integer NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'importing' CHECK (status IN ('importing', 'staging', 'published', 'archived', 'failed')),
  source_id uuid REFERENCES geographic_data_sources(id) ON DELETE SET NULL,
  source_name text NOT NULL,
  source_license text NOT NULL,
  source_attribution text NOT NULL,
  source_endpoint text NOT NULL,
  source_query text NOT NULL,
  source_fetched_at timestamptz,
  bbox jsonb,
  raw_element_count integer NOT NULL DEFAULT 0,
  road_count integer NOT NULL DEFAULT 0,
  invalid_count integer NOT NULL DEFAULT 0,
  duplicate_count integer NOT NULL DEFAULT 0,
  municipality_coverage jsonb NOT NULL DEFAULT '[]'::jsonb,
  failure_reason text,
  imported_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  archived_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS road_dataset_one_published ON road_dataset_versions (status) WHERE status = 'published';
CREATE UNIQUE INDEX IF NOT EXISTS road_dataset_one_importing ON road_dataset_versions (status) WHERE status = 'importing';

CREATE TABLE IF NOT EXISTS road_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_version_id uuid NOT NULL REFERENCES road_dataset_versions(id) ON DELETE CASCADE,
  source_feature_id text NOT NULL,
  source_id uuid REFERENCES geographic_data_sources(id) ON DELETE SET NULL,
  road_name text,
  road_classification text,
  surface_type text,
  access_information text,
  municipality_id uuid REFERENCES municipalities(id) ON DELETE SET NULL,
  barangay_id uuid,
  geometry jsonb NOT NULL,
  display_geometry jsonb NOT NULL,
  min_lon double precision NOT NULL,
  min_lat double precision NOT NULL,
  max_lon double precision NOT NULL,
  max_lat double precision NOT NULL,
  osm_tags jsonb NOT NULL DEFAULT '{}'::jsonb,
  quality_flags text[] NOT NULL DEFAULT '{}'::text[],
  verification_status text NOT NULL DEFAULT 'unverified' CHECK (verification_status IN ('unverified', 'verified', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT road_segments_version_feature_key UNIQUE (dataset_version_id, source_feature_id)
);

CREATE INDEX IF NOT EXISTS road_segments_bounds_idx ON road_segments (dataset_version_id, min_lon, max_lon, min_lat, max_lat);
CREATE INDEX IF NOT EXISTS road_segments_municipality_idx ON road_segments (municipality_id);
CREATE INDEX IF NOT EXISTS road_segments_classification_idx ON road_segments (road_classification);
CREATE INDEX IF NOT EXISTS road_segments_name_idx ON road_segments (lower(road_name));

ALTER TABLE road_dataset_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE road_segments ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON road_dataset_versions TO anon, authenticated;
GRANT SELECT ON road_segments TO anon, authenticated;
GRANT ALL ON road_dataset_versions TO service_role;
GRANT ALL ON road_segments TO service_role;

DROP POLICY IF EXISTS "select_published_or_admin_road_versions" ON road_dataset_versions;
CREATE POLICY "select_published_or_admin_road_versions" ON road_dataset_versions FOR SELECT
TO anon, authenticated
USING (status = 'published' OR public.is_alert_admin());

DROP POLICY IF EXISTS "select_published_or_admin_road_segments" ON road_segments;
CREATE POLICY "select_published_or_admin_road_segments" ON road_segments FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM road_dataset_versions v
    WHERE v.id = road_segments.dataset_version_id AND v.status = 'published'
  )
  OR public.is_alert_admin()
);

CREATE OR REPLACE FUNCTION public.activate_road_dataset_version(p_version_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
  v_roads integer;
BEGIN
  PERFORM require_geographic_admin();

  SELECT status, road_count INTO v_status, v_roads
  FROM road_dataset_versions
  WHERE id = p_version_id
  FOR UPDATE;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Road dataset version not found';
  END IF;

  IF v_status NOT IN ('staging', 'archived') THEN
    RAISE EXCEPTION 'Only a staged or archived road version can be published (current status: %)', v_status;
  END IF;

  IF v_roads = 0 THEN
    RAISE EXCEPTION 'A road version with no roads cannot be published';
  END IF;

  UPDATE road_dataset_versions
  SET status = 'archived', archived_at = now()
  WHERE status = 'published';

  UPDATE road_dataset_versions
  SET status = 'published', published_at = now(), archived_at = NULL
  WHERE id = p_version_id;

  UPDATE road_segments
  SET verification_status = 'verified', updated_at = now()
  WHERE dataset_version_id = p_version_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.activate_road_dataset_version(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.activate_road_dataset_version(uuid) TO authenticated;
