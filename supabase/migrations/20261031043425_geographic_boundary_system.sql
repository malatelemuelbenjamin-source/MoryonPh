/*
# Geographic boundary system: sources, versioned boundaries, audit history

1. Plain-English summary
- Adds a way to store geographic boundary datasets (such as the Marinduque island outline) with their original source, license, coordinate system, and verification status.
- Each boundary is stored as a numbered version. Only one version per boundary can be published at a time.
- Every import, review, publish and archive action is written to an audit history.
- Seeds a first draft of the Marinduque island extent from the six municipal boundaries already in the database (geoBoundaries gbOpen ADM3, 2020). The draft is marked unverified and is NOT published.

2. New tables
- `geographic_data_sources`: dataset name, publisher, source URL, license text, source year, last updated date, notes, whether the origin was checked, and who checked it.
- `geographic_boundaries`: boundary key, version number, label, kind, status (draft, published, archived), verification status (unverified, verified, rejected), source reference, geometry type (Polygon or MultiPolygon), coordinate reference system (EPSG:4326), GeoJSON geometry, bounding box, feature count, and review and publish timestamps.
- `geographic_import_history`: audit trail of imported, reviewed, published and archived actions, with the acting administrator and details.

3. Security
- Row level security is enabled on all three tables.
- Anyone (anon and authenticated) can read sources and published boundaries. Drafts and archived versions are visible only to administrators.
- The audit history is readable only by administrators.
- No table can be written directly. All changes go through administrator-only functions that check the admin claim (is_alert_admin) on every call.
- Publishing requires a draft. A rejected dataset cannot be published. An unverified dataset cannot replace an existing published version; it must be verified first.

4. Important notes
- No PostGIS extension is required. Geometry is stored as GeoJSON in jsonb, as the existing municipal boundaries are.
- The seeded draft is not an official boundary. Its source must be checked before verification.
- The partial unique index guarantees that a boundary key never has two published versions.
*/

CREATE TABLE IF NOT EXISTS geographic_data_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  publisher text NOT NULL,
  source_url text,
  license text NOT NULL,
  source_year integer,
  last_updated_on date,
  notes text,
  origin_checked boolean NOT NULL DEFAULT false,
  origin_checked_by uuid,
  origin_checked_at timestamptz,
  imported_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS geographic_boundaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  boundary_key text NOT NULL,
  version integer NOT NULL,
  label text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('island_outline', 'coastline', 'nearby_island', 'water_body', 'bay')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  verification_status text NOT NULL DEFAULT 'unverified' CHECK (verification_status IN ('unverified', 'verified', 'rejected')),
  source_id uuid NOT NULL REFERENCES geographic_data_sources(id),
  geometry_type text NOT NULL CHECK (geometry_type IN ('Polygon', 'MultiPolygon')),
  crs text NOT NULL DEFAULT 'EPSG:4326',
  geometry_data jsonb NOT NULL,
  bbox jsonb NOT NULL,
  feature_count integer NOT NULL CHECK (feature_count >= 1),
  imported_by uuid,
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  archived_at timestamptz,
  UNIQUE (boundary_key, version)
);

CREATE UNIQUE INDEX IF NOT EXISTS geographic_boundaries_one_published
  ON geographic_boundaries (boundary_key) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS geographic_boundaries_source_id_idx ON geographic_boundaries (source_id);

CREATE TABLE IF NOT EXISTS geographic_import_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  boundary_id uuid REFERENCES geographic_boundaries(id),
  action text NOT NULL CHECK (action IN ('imported', 'reviewed', 'published', 'archived')),
  actor_id uuid,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS geographic_import_history_boundary_id_idx ON geographic_import_history (boundary_id);

ALTER TABLE geographic_data_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE geographic_boundaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE geographic_import_history ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON geographic_data_sources TO anon, authenticated;
GRANT SELECT ON geographic_boundaries TO anon, authenticated;
GRANT SELECT ON geographic_import_history TO authenticated;

DROP POLICY IF EXISTS "public_read_geographic_sources" ON geographic_data_sources;
CREATE POLICY "public_read_geographic_sources" ON geographic_data_sources
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "public_read_published_boundaries" ON geographic_boundaries;
CREATE POLICY "public_read_published_boundaries" ON geographic_boundaries
  FOR SELECT TO anon, authenticated USING (status = 'published');

DROP POLICY IF EXISTS "admin_read_all_boundaries" ON geographic_boundaries;
CREATE POLICY "admin_read_all_boundaries" ON geographic_boundaries
  FOR SELECT TO authenticated USING (public.is_alert_admin());

DROP POLICY IF EXISTS "admin_read_boundary_history" ON geographic_import_history;
CREATE POLICY "admin_read_boundary_history" ON geographic_import_history
  FOR SELECT TO authenticated USING (public.is_alert_admin());

CREATE OR REPLACE FUNCTION public.require_geographic_admin()
RETURNS void
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_alert_admin() THEN
    RAISE EXCEPTION 'Only administrators can manage geographic boundaries' USING ERRCODE = '42501';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.import_geographic_boundary(
  p_boundary_key text,
  p_label text,
  p_kind text,
  p_source jsonb,
  p_geometry jsonb,
  p_bbox jsonb,
  p_feature_count integer
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_source_id uuid;
  v_version integer;
  v_id uuid;
BEGIN
  PERFORM public.require_geographic_admin();

  IF COALESCE(trim(p_boundary_key), '') = '' OR COALESCE(trim(p_label), '') = '' THEN
    RAISE EXCEPTION 'Boundary key and label are required' USING ERRCODE = '22023';
  END IF;
  IF COALESCE(trim(p_source->>'name'), '') = ''
    OR COALESCE(trim(p_source->>'publisher'), '') = ''
    OR COALESCE(trim(p_source->>'license'), '') = '' THEN
    RAISE EXCEPTION 'Source name, publisher and license are required' USING ERRCODE = '22023';
  END IF;
  IF p_geometry->>'type' NOT IN ('Polygon', 'MultiPolygon') THEN
    RAISE EXCEPTION 'Geometry must be a Polygon or MultiPolygon' USING ERRCODE = '22023';
  END IF;

  INSERT INTO geographic_data_sources (name, publisher, source_url, license, source_year, last_updated_on, notes, imported_by)
  VALUES (
    trim(p_source->>'name'),
    trim(p_source->>'publisher'),
    NULLIF(trim(p_source->>'source_url'), ''),
    trim(p_source->>'license'),
    NULLIF(p_source->>'source_year', '')::integer,
    NULLIF(p_source->>'last_updated_on', '')::date,
    NULLIF(trim(p_source->>'notes'), ''),
    auth.uid()
  )
  RETURNING id INTO v_source_id;

  SELECT COALESCE(MAX(version), 0) + 1 INTO v_version
  FROM geographic_boundaries WHERE boundary_key = trim(p_boundary_key);

  INSERT INTO geographic_boundaries (
    boundary_key, version, label, kind, source_id, geometry_type, geometry_data, bbox, feature_count, imported_by
  )
  VALUES (
    trim(p_boundary_key), v_version, trim(p_label), p_kind, v_source_id,
    p_geometry->>'type', p_geometry, p_bbox, p_feature_count, auth.uid()
  )
  RETURNING id INTO v_id;

  INSERT INTO geographic_import_history (boundary_id, action, actor_id, details)
  VALUES (v_id, 'imported', auth.uid(), jsonb_build_object('version', v_version, 'source_id', v_source_id, 'feature_count', p_feature_count));

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.review_geographic_boundary(
  p_boundary_id uuid,
  p_decision text,
  p_source_checked boolean,
  p_note text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_source_id uuid;
  v_status text;
  v_note text := NULLIF(trim(p_note), '');
BEGIN
  PERFORM public.require_geographic_admin();

  IF p_decision NOT IN ('verified', 'rejected', 'unverified') THEN
    RAISE EXCEPTION 'Unknown review decision' USING ERRCODE = '22023';
  END IF;

  SELECT source_id, status INTO v_source_id, v_status
  FROM geographic_boundaries WHERE id = p_boundary_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Boundary not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_status = 'archived' THEN
    RAISE EXCEPTION 'Archived versions cannot be reviewed' USING ERRCODE = '22023';
  END IF;
  IF p_decision = 'verified' AND NOT COALESCE(p_source_checked, false) THEN
    RAISE EXCEPTION 'Confirm the original source before verifying the dataset' USING ERRCODE = '22023';
  END IF;

  IF COALESCE(p_source_checked, false) THEN
    UPDATE geographic_data_sources
    SET origin_checked = true, origin_checked_by = auth.uid(), origin_checked_at = now()
    WHERE id = v_source_id;
  END IF;

  UPDATE geographic_boundaries
  SET verification_status = p_decision, reviewed_by = auth.uid(), reviewed_at = now(), review_note = v_note
  WHERE id = p_boundary_id;

  INSERT INTO geographic_import_history (boundary_id, action, actor_id, details)
  VALUES (p_boundary_id, 'reviewed', auth.uid(), jsonb_build_object(
    'decision', p_decision,
    'source_checked', COALESCE(p_source_checked, false),
    'note', v_note
  ));
END;
$$;

CREATE OR REPLACE FUNCTION public.publish_geographic_boundary(p_boundary_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key text;
  v_status text;
  v_verification text;
  v_previous uuid;
BEGIN
  PERFORM public.require_geographic_admin();

  SELECT boundary_key, status, verification_status INTO v_key, v_status, v_verification
  FROM geographic_boundaries WHERE id = p_boundary_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Boundary not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_status <> 'draft' THEN
    RAISE EXCEPTION 'Only draft versions can be published' USING ERRCODE = '22023';
  END IF;
  IF v_verification = 'rejected' THEN
    RAISE EXCEPTION 'Rejected datasets cannot be published' USING ERRCODE = '22023';
  END IF;

  IF v_verification <> 'verified' AND EXISTS (
    SELECT 1 FROM geographic_boundaries WHERE boundary_key = v_key AND status = 'published'
  ) THEN
    RAISE EXCEPTION 'An unverified dataset cannot replace the published version. Verify it first.' USING ERRCODE = '22023';
  END IF;

  UPDATE geographic_boundaries SET status = 'archived', archived_at = now()
  WHERE boundary_key = v_key AND status = 'published'
  RETURNING id INTO v_previous;

  IF v_previous IS NOT NULL THEN
    INSERT INTO geographic_import_history (boundary_id, action, actor_id, details)
    VALUES (v_previous, 'archived', auth.uid(), jsonb_build_object('reason', 'superseded', 'superseded_by', p_boundary_id));
  END IF;

  UPDATE geographic_boundaries SET status = 'published', published_at = now()
  WHERE id = p_boundary_id;

  INSERT INTO geographic_import_history (boundary_id, action, actor_id, details)
  VALUES (p_boundary_id, 'published', auth.uid(), jsonb_build_object('replaced', v_previous, 'verification_status', v_verification));
END;
$$;

CREATE OR REPLACE FUNCTION public.archive_geographic_boundary(p_boundary_id uuid, p_note text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
BEGIN
  PERFORM public.require_geographic_admin();

  SELECT status INTO v_status FROM geographic_boundaries WHERE id = p_boundary_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Boundary not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_status = 'archived' THEN
    RAISE EXCEPTION 'This version is already archived' USING ERRCODE = '22023';
  END IF;

  UPDATE geographic_boundaries SET status = 'archived', archived_at = now() WHERE id = p_boundary_id;

  INSERT INTO geographic_import_history (boundary_id, action, actor_id, details)
  VALUES (p_boundary_id, 'archived', auth.uid(), jsonb_build_object('previous_status', v_status, 'note', NULLIF(trim(p_note), '')));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.require_geographic_admin() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.import_geographic_boundary(text, text, text, jsonb, jsonb, jsonb, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.review_geographic_boundary(uuid, text, boolean, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.publish_geographic_boundary(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.archive_geographic_boundary(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.import_geographic_boundary(text, text, text, jsonb, jsonb, jsonb, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_geographic_boundary(uuid, text, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.publish_geographic_boundary(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.archive_geographic_boundary(uuid, text) TO authenticated;

DO $$
DECLARE
  v_source_id uuid;
  v_geometry jsonb;
  v_bbox jsonb;
  v_polygons integer;
BEGIN
  IF EXISTS (SELECT 1 FROM geographic_boundaries WHERE boundary_key = 'marinduque-island') THEN
    RETURN;
  END IF;

  SELECT jsonb_build_object('type', 'MultiPolygon', 'coordinates', jsonb_agg(poly)), count(*)
  INTO v_geometry, v_polygons
  FROM municipality_boundaries m
  CROSS JOIN LATERAL jsonb_array_elements(m.geometry_data->'coordinates') AS poly;

  SELECT jsonb_build_object(
    'min_lon', min((pt->>0)::float), 'max_lon', max((pt->>0)::float),
    'min_lat', min((pt->>1)::float), 'max_lat', max((pt->>1)::float)
  ) INTO v_bbox
  FROM municipality_boundaries m
  CROSS JOIN LATERAL jsonb_array_elements(m.geometry_data->'coordinates') AS poly
  CROSS JOIN LATERAL jsonb_array_elements(poly) AS ring
  CROSS JOIN LATERAL jsonb_array_elements(ring) AS pt;

  INSERT INTO geographic_data_sources (name, publisher, source_url, license, source_year, notes)
  VALUES (
    'Marinduque municipal boundaries, geoBoundaries gbOpen ADM3 (2020)',
    'geoBoundaries (wmgeolab)',
    'https://www.geoboundaries.org',
    'geoBoundaries gbOpen. Exact license terms not yet checked against the source.',
    2020,
    'Six municipality polygons combined into one MultiPolygon. Shared borders are not dissolved, so internal municipal lines remain. Simplified during the earlier import. Not an official PSA or LGU boundary.'
  )
  RETURNING id INTO v_source_id;

  INSERT INTO geographic_boundaries (
    boundary_key, version, label, kind, source_id, geometry_type, geometry_data, bbox, feature_count
  )
  VALUES (
    'marinduque-island', 1, 'Marinduque island extent (from municipal boundaries)', 'island_outline',
    v_source_id, 'MultiPolygon', v_geometry, v_bbox, v_polygons
  );
END;
$$;
