/*
# Municipality directory and verified-only publishing

1. Summary
- Adds a directory of the six Marinduque municipalities (Boac, Buenavista, Gasan, Mogpog, Santa Cruz, Torrijos).
- Adds an admin-only update for municipality details (official code, description, image link, center, area, source). Nothing is invented: every detail starts empty.
- Tightens publishing so only verified boundary datasets can be published.
- Allows the boundary kind 'municipal_boundary' in the versioned boundary system.
- Copies the six existing municipal outlines (from the earlier municipality_boundaries table) into the versioned boundary system as unverified drafts. They are not published.

2. New Tables
- `municipalities`: id, name (unique, official name), boundary_key (unique, links to geographic_boundaries), official_code (unique when set, digits only), description, image_url (https only), center_lon and center_lat (both or neither), area_sq_km (positive), details_source_name, details_source_url, details_verification_status ('unverified' or 'verified'), created_at, updated_at.
- `municipality_revisions`: audit trail of detail changes (who, when, what status).

3. Changed Objects
- `geographic_boundaries_kind_check`: adds 'municipal_boundary' to the allowed kinds (the list is widened, nothing removed).
- `publish_geographic_boundary`: now refuses any dataset whose verification status is not 'verified'. Previously an unverified first version could be published.
- New `update_municipality_details` (admin only).

4. Seeded Data
- Six municipality rows with official names and boundary keys. No official codes, descriptions, images, coordinates, or areas.
- Six draft boundary versions, one per municipality, copied from municipality_boundaries. Source: geoBoundaries gbOpen ADM3 (2020), clipped and simplified. Status: draft, unverified.

5. Security
- RLS enabled on both new tables.
- `municipalities`: public read (anon and authenticated). No direct write grants.
- `municipality_revisions`: readable by administrators only.
- Writes happen only through administrator-only SECURITY DEFINER functions. Execute is revoked from PUBLIC and anon.

6. Notes
- Existing municipal outlines are approximate and were not checked against PSA or LGU maps. They must be verified by an administrator before publication.
- municipality_boundaries is kept unchanged.
*/

ALTER TABLE geographic_boundaries DROP CONSTRAINT IF EXISTS geographic_boundaries_kind_check;
ALTER TABLE geographic_boundaries ADD CONSTRAINT geographic_boundaries_kind_check CHECK (
  kind = ANY (ARRAY['island_outline', 'coastline', 'nearby_island', 'water_body', 'bay', 'municipal_boundary']::text[])
);

CREATE TABLE IF NOT EXISTS municipalities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  boundary_key text NOT NULL UNIQUE,
  official_code text UNIQUE,
  description text,
  image_url text,
  center_lon double precision,
  center_lat double precision,
  area_sq_km numeric(10,2),
  details_source_name text,
  details_source_url text,
  details_verification_status text NOT NULL DEFAULT 'unverified',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT municipalities_name_clean CHECK (name = btrim(name) AND name <> ''),
  CONSTRAINT municipalities_code_digits CHECK (official_code IS NULL OR official_code ~ '^[0-9]+$'),
  CONSTRAINT municipalities_image_https CHECK (image_url IS NULL OR image_url LIKE 'https://%'),
  CONSTRAINT municipalities_center_pair CHECK ((center_lon IS NULL) = (center_lat IS NULL)),
  CONSTRAINT municipalities_center_range CHECK (
    center_lon IS NULL OR (center_lon BETWEEN -180 AND 180 AND center_lat BETWEEN -90 AND 90)
  ),
  CONSTRAINT municipalities_area_positive CHECK (area_sq_km IS NULL OR area_sq_km > 0),
  CONSTRAINT municipalities_details_status CHECK (details_verification_status IN ('unverified', 'verified'))
);

CREATE UNIQUE INDEX IF NOT EXISTS municipalities_name_lower_key ON municipalities (lower(name));

CREATE TABLE IF NOT EXISTS municipality_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  municipality_id uuid NOT NULL REFERENCES municipalities(id),
  action text NOT NULL,
  actor_id uuid,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS municipality_revisions_municipality_idx ON municipality_revisions (municipality_id);

ALTER TABLE municipalities ENABLE ROW LEVEL SECURITY;
ALTER TABLE municipality_revisions ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON municipalities TO anon, authenticated;
GRANT SELECT ON municipality_revisions TO authenticated;

DROP POLICY IF EXISTS "public_read_municipalities" ON municipalities;
CREATE POLICY "public_read_municipalities" ON municipalities
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "admin_read_municipality_revisions" ON municipality_revisions;
CREATE POLICY "admin_read_municipality_revisions" ON municipality_revisions
  FOR SELECT TO authenticated USING (public.is_alert_admin());

INSERT INTO municipalities (name, boundary_key) VALUES
  ('Boac', 'municipality-boac'),
  ('Buenavista', 'municipality-buenavista'),
  ('Gasan', 'municipality-gasan'),
  ('Mogpog', 'municipality-mogpog'),
  ('Santa Cruz', 'municipality-santa-cruz'),
  ('Torrijos', 'municipality-torrijos')
ON CONFLICT (name) DO NOTHING;

CREATE OR REPLACE FUNCTION public.update_municipality_details(
  p_municipality_id uuid,
  p_official_code text,
  p_description text,
  p_image_url text,
  p_center_lon double precision,
  p_center_lat double precision,
  p_area_sq_km numeric,
  p_source_name text,
  p_source_url text,
  p_source_checked boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_old municipalities%ROWTYPE;
  v_code text := NULLIF(btrim(p_official_code), '');
  v_description text := NULLIF(btrim(p_description), '');
  v_image text := NULLIF(btrim(p_image_url), '');
  v_source_name text := NULLIF(btrim(p_source_name), '');
  v_source_url text := NULLIF(btrim(p_source_url), '');
  v_status text;
BEGIN
  PERFORM public.require_geographic_admin();

  SELECT * INTO v_old FROM municipalities WHERE id = p_municipality_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Municipality not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_code IS NOT NULL AND v_code !~ '^[0-9]+$' THEN
    RAISE EXCEPTION 'The official code must contain digits only' USING ERRCODE = '22023';
  END IF;
  IF v_image IS NOT NULL AND v_image NOT LIKE 'https://%' THEN
    RAISE EXCEPTION 'The image link must start with https://' USING ERRCODE = '22023';
  END IF;
  IF (p_center_lon IS NULL) <> (p_center_lat IS NULL) THEN
    RAISE EXCEPTION 'Enter both longitude and latitude, or neither' USING ERRCODE = '22023';
  END IF;
  IF p_area_sq_km IS NOT NULL AND p_area_sq_km <= 0 THEN
    RAISE EXCEPTION 'The area must be greater than zero' USING ERRCODE = '22023';
  END IF;
  IF p_source_checked AND (v_source_name IS NULL OR v_source_url IS NULL) THEN
    RAISE EXCEPTION 'Name the source and give its link before marking the details as verified' USING ERRCODE = '22023';
  END IF;

  v_status := CASE WHEN p_source_checked THEN 'verified' ELSE 'unverified' END;

  UPDATE municipalities
  SET official_code = v_code,
      description = v_description,
      image_url = v_image,
      center_lon = p_center_lon,
      center_lat = p_center_lat,
      area_sq_km = p_area_sq_km,
      details_source_name = v_source_name,
      details_source_url = v_source_url,
      details_verification_status = v_status,
      updated_at = now()
  WHERE id = p_municipality_id;

  INSERT INTO municipality_revisions (municipality_id, action, actor_id, details)
  VALUES (
    p_municipality_id,
    'details_updated',
    auth.uid(),
    jsonb_build_object(
      'previous_status', v_old.details_verification_status,
      'status', v_status,
      'source_name', v_source_name,
      'source_url', v_source_url,
      'fields_set', jsonb_build_object(
        'official_code', v_code IS NOT NULL,
        'description', v_description IS NOT NULL,
        'image', v_image IS NOT NULL,
        'center', p_center_lon IS NOT NULL,
        'area', p_area_sq_km IS NOT NULL
      )
    )
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.update_municipality_details(uuid, text, text, text, double precision, double precision, numeric, text, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_municipality_details(uuid, text, text, text, double precision, double precision, numeric, text, text, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.publish_geographic_boundary(p_boundary_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
IF v_verification <> 'verified' THEN
RAISE EXCEPTION 'Only verified datasets can be published. Verify the source first.' USING ERRCODE = '22023';
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
$function$;

DO $$
DECLARE
  r record;
  v_source uuid;
  v_boundary uuid;
  v_min_lon double precision;
  v_max_lon double precision;
  v_min_lat double precision;
  v_max_lat double precision;
BEGIN
  FOR r IN
    SELECT m.name, m.boundary_key, mb.geometry_data
    FROM municipalities m
    JOIN municipality_boundaries mb ON mb.municipality = m.name
    WHERE NOT EXISTS (SELECT 1 FROM geographic_boundaries gb WHERE gb.boundary_key = m.boundary_key)
  LOOP
    INSERT INTO geographic_data_sources (name, publisher, source_url, license, source_year, notes)
    VALUES (
      'geoBoundaries gbOpen ADM3 (2020): ' || r.name || ' municipal outline',
      'geoBoundaries (wmgeolab)',
      'https://www.geoboundaries.org',
      'geoBoundaries gbOpen. Exact license terms not yet checked against the source.',
      2020,
      'Clipped to Marinduque and simplified to about 200 m accuracy. Not checked against official PSA or LGU maps.'
    )
    RETURNING id INTO v_source;

    SELECT min((p->>0)::double precision), max((p->>0)::double precision),
           min((p->>1)::double precision), max((p->>1)::double precision)
    INTO v_min_lon, v_max_lon, v_min_lat, v_max_lat
    FROM jsonb_path_query(r.geometry_data, 'strict $.coordinates[*][*][*]') AS p;

    INSERT INTO geographic_boundaries (
      boundary_key, version, label, kind, status, verification_status, source_id,
      geometry_type, crs, geometry_data, bbox, feature_count
    )
    VALUES (
      r.boundary_key, 1, r.name || ' municipal boundary', 'municipal_boundary', 'draft', 'unverified', v_source,
      'MultiPolygon', 'EPSG:4326', r.geometry_data,
      jsonb_build_object('min_lon', v_min_lon, 'max_lon', v_max_lon, 'min_lat', v_min_lat, 'max_lat', v_max_lat),
      jsonb_array_length(r.geometry_data->'coordinates')
    )
    RETURNING id INTO v_boundary;

    INSERT INTO geographic_import_history (boundary_id, action, actor_id, details)
    VALUES (v_boundary, 'imported', NULL, jsonb_build_object('version', 1, 'source_id', v_source, 'origin', 'municipality_boundaries (migration 20261031041144)'));
  END LOOP;
END $$;
