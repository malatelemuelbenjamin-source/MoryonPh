/*
# Geographic upload and validation pipeline

1. Summary
Adds a controlled pipeline for administrators to upload geographic files (GeoJSON, KML, CSV), keep the original file in private storage, record validation results, review, and approve. Approved polygon datasets become draft boundary versions that use the existing verify-then-publish workflow. Adds a restore action that republishes a previously verified version.

2. New tables
- geographic_upload_jobs: one row per uploaded file. Stores the original file path, SHA-256 fingerprint, dataset category and metadata, field mapping, validation report, normalized geometry for polygon datasets, status, and review details.
- geographic_upload_events: audit trail of upload, approval, and rejection actions with the acting administrator.

3. Modified tables
- geographic_boundaries: kind check now also accepts barangay_boundary.

4. Storage
- Private bucket geographic-uploads (10 MB limit). Administrators can insert and read objects. No update or delete policy exists, so originals cannot be overwritten or removed through the API.

5. Functions
- create_geographic_upload_job: administrator-only. Rejects exact duplicates of active uploads. Sets status to validation_failed when critical errors exist, otherwise needs_review.
- review_geographic_upload: administrator-only. Rejects a job or approves it into a draft boundary version. Only needs_review jobs can be decided. Approval of non-boundary categories is blocked until their feature types are supported.
- rollback_geographic_boundary: administrator-only. Restores an archived, verified version as the published version and archives the current one.

6. Security
- RLS enabled on both new tables. Only administrators (is_alert_admin) can read them. Anonymous users have no access.
- Writes happen only through the functions above. Functions are revoked from PUBLIC and anon and granted to authenticated only.

7. Notes
- Policies are dropped before they are created so the migration can be re-run.
- Unverified datasets are never published by this migration. Publication still requires source verification.
*/

ALTER TABLE geographic_boundaries DROP CONSTRAINT IF EXISTS geographic_boundaries_kind_check;
ALTER TABLE geographic_boundaries ADD CONSTRAINT geographic_boundaries_kind_check CHECK (
  kind = ANY (ARRAY['island_outline'::text, 'coastline'::text, 'nearby_island'::text, 'water_body'::text, 'bay'::text, 'municipal_boundary'::text, 'barangay_boundary'::text])
);

CREATE TABLE IF NOT EXISTS geographic_upload_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name text NOT NULL CHECK (char_length(file_name) BETWEEN 1 AND 255),
  file_format text NOT NULL CHECK (file_format IN ('geojson', 'kml', 'csv')),
  file_size_bytes integer NOT NULL CHECK (file_size_bytes > 0 AND file_size_bytes <= 10485760),
  file_sha256 text NOT NULL CHECK (file_sha256 ~ '^[a-f0-9]{64}$'),
  storage_path text NOT NULL UNIQUE CHECK (storage_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]{1,200}$'),
  category text NOT NULL CHECK (category IN (
    'island_boundary', 'municipal_boundary', 'barangay_boundary', 'coastline', 'roads', 'buildings',
    'infrastructure', 'public_facilities', 'transport_routes', 'transport_terminals', 'landmarks', 'other_approved'
  )),
  municipality_id uuid REFERENCES municipalities(id),
  boundary_key text CHECK (boundary_key IS NULL OR boundary_key ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text NOT NULL CHECK (char_length(trim(title)) > 0),
  description text,
  coverage text,
  source_organization text NOT NULL CHECK (char_length(trim(source_organization)) > 0),
  source_url text CHECK (source_url IS NULL OR source_url ~* '^https://'),
  source_reference text,
  license text NOT NULL CHECK (char_length(trim(license)) > 0),
  dataset_version text,
  notes text,
  status text NOT NULL CHECK (status IN (
    'uploaded', 'processing', 'validation_failed', 'needs_review', 'approved', 'published', 'rejected', 'archived'
  )),
  validation jsonb NOT NULL DEFAULT '{}'::jsonb,
  field_mapping jsonb NOT NULL DEFAULT '{}'::jsonb,
  geometry_data jsonb,
  bbox jsonb,
  boundary_id uuid REFERENCES geographic_boundaries(id),
  review_note text,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS geographic_upload_jobs_active_fingerprint
  ON geographic_upload_jobs (file_sha256)
  WHERE status IN ('needs_review', 'approved', 'published');
CREATE INDEX IF NOT EXISTS geographic_upload_jobs_municipality_id_idx ON geographic_upload_jobs (municipality_id);
CREATE INDEX IF NOT EXISTS geographic_upload_jobs_boundary_id_idx ON geographic_upload_jobs (boundary_id);

CREATE TABLE IF NOT EXISTS geographic_upload_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES geographic_upload_jobs(id),
  action text NOT NULL CHECK (action IN ('uploaded', 'approved', 'rejected')),
  actor_id uuid NOT NULL DEFAULT auth.uid(),
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS geographic_upload_events_job_id_idx ON geographic_upload_events (job_id);

ALTER TABLE geographic_upload_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE geographic_upload_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON geographic_upload_jobs FROM PUBLIC, anon;
REVOKE ALL ON geographic_upload_events FROM PUBLIC, anon;
GRANT SELECT ON geographic_upload_jobs TO authenticated;
GRANT SELECT ON geographic_upload_events TO authenticated;

DROP POLICY IF EXISTS "admin_read_geographic_upload_jobs" ON geographic_upload_jobs;
CREATE POLICY "admin_read_geographic_upload_jobs" ON geographic_upload_jobs FOR SELECT
  TO authenticated USING (public.is_alert_admin());

DROP POLICY IF EXISTS "admin_read_geographic_upload_events" ON geographic_upload_events;
CREATE POLICY "admin_read_geographic_upload_events" ON geographic_upload_events FOR SELECT
  TO authenticated USING (public.is_alert_admin());

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('geographic-uploads', 'geographic-uploads', false, 10485760)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "admin_insert_geographic_uploads" ON storage.objects;
CREATE POLICY "admin_insert_geographic_uploads" ON storage.objects FOR INSERT
  TO authenticated WITH CHECK (bucket_id = 'geographic-uploads' AND public.is_alert_admin());

DROP POLICY IF EXISTS "admin_read_geographic_uploads" ON storage.objects;
CREATE POLICY "admin_read_geographic_uploads" ON storage.objects FOR SELECT
  TO authenticated USING (bucket_id = 'geographic-uploads' AND public.is_alert_admin());

CREATE OR REPLACE FUNCTION public.create_geographic_upload_job(
  p_file_name text,
  p_file_format text,
  p_file_size_bytes integer,
  p_file_sha256 text,
  p_storage_path text,
  p_category text,
  p_municipality_id uuid,
  p_metadata jsonb,
  p_field_mapping jsonb,
  p_validation jsonb,
  p_geometry jsonb,
  p_bbox jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_id uuid;
  v_key text;
  v_title text;
  v_organization text;
  v_license text;
  v_critical integer;
  v_status text;
  v_boundary boolean;
BEGIN
  PERFORM public.require_geographic_admin();

  v_title := trim(COALESCE(p_metadata->>'title', ''));
  v_organization := trim(COALESCE(p_metadata->>'source_organization', ''));
  v_license := trim(COALESCE(p_metadata->>'license', ''));
  v_key := NULLIF(trim(COALESCE(p_metadata->>'boundary_key', '')), '');
  v_boundary := p_category IN ('island_boundary', 'municipal_boundary', 'barangay_boundary');

  IF v_title = '' OR v_organization = '' OR v_license = '' THEN
    RAISE EXCEPTION 'Title, source organization and license are required' USING ERRCODE = '22023';
  END IF;

  IF v_boundary AND (v_key IS NULL OR v_key !~ '^[a-z0-9]+(-[a-z0-9]+)*$') THEN
    RAISE EXCEPTION 'Boundary key must use lowercase letters, numbers and single hyphens' USING ERRCODE = '22023';
  END IF;

  IF p_category = 'barangay_boundary' AND p_municipality_id IS NULL THEN
    RAISE EXCEPTION 'Barangay boundaries must be linked to a municipality' USING ERRCODE = '22023';
  END IF;

  IF p_municipality_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM municipalities WHERE id = p_municipality_id) THEN
    RAISE EXCEPTION 'The selected municipality does not exist' USING ERRCODE = '22023';
  END IF;

  IF p_geometry IS NOT NULL AND p_geometry->>'type' <> 'MultiPolygon' THEN
    RAISE EXCEPTION 'Stored boundary geometry must be a MultiPolygon' USING ERRCODE = '22023';
  END IF;

  IF v_boundary AND p_geometry IS NULL THEN
    RAISE EXCEPTION 'Boundary datasets need polygon geometry' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1 FROM geographic_upload_jobs
    WHERE file_sha256 = p_file_sha256 AND status IN ('needs_review', 'approved', 'published')
  ) THEN
    RAISE EXCEPTION 'This exact file is already waiting for review or has already been approved' USING ERRCODE = '23505';
  END IF;

  v_critical := jsonb_array_length(COALESCE(p_validation->'critical_errors', '[]'::jsonb));
  v_status := CASE WHEN v_critical > 0 THEN 'validation_failed' ELSE 'needs_review' END;

  INSERT INTO geographic_upload_jobs (
    file_name, file_format, file_size_bytes, file_sha256, storage_path, category, municipality_id,
    boundary_key, title, description, coverage, source_organization, source_url, source_reference,
    license, dataset_version, notes, status, validation, field_mapping, geometry_data, bbox
  )
  VALUES (
    p_file_name, p_file_format, p_file_size_bytes, p_file_sha256, p_storage_path, p_category, p_municipality_id,
    CASE WHEN v_boundary THEN v_key ELSE NULL END,
    v_title,
    NULLIF(trim(COALESCE(p_metadata->>'description', '')), ''),
    NULLIF(trim(COALESCE(p_metadata->>'coverage', '')), ''),
    v_organization,
    NULLIF(trim(COALESCE(p_metadata->>'source_url', '')), ''),
    NULLIF(trim(COALESCE(p_metadata->>'source_reference', '')), ''),
    v_license,
    NULLIF(trim(COALESCE(p_metadata->>'dataset_version', '')), ''),
    NULLIF(trim(COALESCE(p_metadata->>'notes', '')), ''),
    v_status,
    COALESCE(p_validation, '{}'::jsonb),
    COALESCE(p_field_mapping, '{}'::jsonb),
    p_geometry,
    p_bbox
  )
  RETURNING id INTO v_id;

  INSERT INTO geographic_upload_events (job_id, action, details)
  VALUES (v_id, 'uploaded', jsonb_build_object('status', v_status, 'critical_error_count', v_critical));

  RETURN v_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.review_geographic_upload(
  p_job_id uuid,
  p_decision text,
  p_note text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_job geographic_upload_jobs%ROWTYPE;
  v_kind text;
  v_boundary_id uuid;
BEGIN
  PERFORM public.require_geographic_admin();

  IF p_decision NOT IN ('approve', 'reject') THEN
    RAISE EXCEPTION 'Decision must be approve or reject' USING ERRCODE = '22023';
  END IF;
  IF trim(COALESCE(p_note, '')) = '' THEN
    RAISE EXCEPTION 'A review note is required' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_job FROM geographic_upload_jobs WHERE id = p_job_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Upload not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_job.status <> 'needs_review' THEN
    RAISE EXCEPTION 'Only uploads waiting for review can be approved or rejected' USING ERRCODE = '22023';
  END IF;

  IF p_decision = 'reject' THEN
    UPDATE geographic_upload_jobs
    SET status = 'rejected', review_note = trim(p_note), reviewed_by = auth.uid(), reviewed_at = now()
    WHERE id = p_job_id;
    INSERT INTO geographic_upload_events (job_id, action, details)
    VALUES (p_job_id, 'rejected', jsonb_build_object('note', trim(p_note)));
    RETURN NULL;
  END IF;

  v_kind := CASE v_job.category
    WHEN 'island_boundary' THEN 'island_outline'
    WHEN 'municipal_boundary' THEN 'municipal_boundary'
    WHEN 'barangay_boundary' THEN 'barangay_boundary'
    ELSE NULL
  END;
  IF v_kind IS NULL THEN
    RAISE EXCEPTION 'This category is stored for review but cannot be approved yet. Only island, municipality and barangay boundaries can be approved in this version.'
      USING ERRCODE = '0A000';
  END IF;
  IF v_job.geometry_data IS NULL THEN
    RAISE EXCEPTION 'This upload has no boundary geometry to approve' USING ERRCODE = '22023';
  END IF;

  v_boundary_id := public.import_geographic_boundary(
    v_job.boundary_key,
    v_job.title,
    v_kind,
    jsonb_build_object(
      'name', v_job.title,
      'publisher', v_job.source_organization,
      'source_url', COALESCE(v_job.source_url, ''),
      'license', v_job.license,
      'source_year', '',
      'last_updated_on', '',
      'notes', concat_ws(' | ',
        NULLIF(v_job.description, ''),
        NULLIF(v_job.coverage, ''),
        NULLIF(v_job.source_reference, ''),
        NULLIF(v_job.dataset_version, ''),
        NULLIF(v_job.notes, ''))
    ),
    v_job.geometry_data,
    v_job.bbox,
    jsonb_array_length(v_job.geometry_data->'coordinates')
  );

  UPDATE geographic_upload_jobs
  SET status = 'approved', boundary_id = v_boundary_id, review_note = trim(p_note),
      reviewed_by = auth.uid(), reviewed_at = now()
  WHERE id = p_job_id;

  INSERT INTO geographic_upload_events (job_id, action, details)
  VALUES (p_job_id, 'approved', jsonb_build_object('boundary_id', v_boundary_id, 'note', trim(p_note)));

  RETURN v_boundary_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.rollback_geographic_boundary(
  p_boundary_id uuid,
  p_note text
)
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

  IF trim(COALESCE(p_note, '')) = '' THEN
    RAISE EXCEPTION 'A reason for the restore is required' USING ERRCODE = '22023';
  END IF;

  SELECT boundary_key, status, verification_status INTO v_key, v_status, v_verification
  FROM geographic_boundaries WHERE id = p_boundary_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Boundary not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_status <> 'archived' THEN
    RAISE EXCEPTION 'Only archived versions can be restored' USING ERRCODE = '22023';
  END IF;
  IF v_verification <> 'verified' THEN
    RAISE EXCEPTION 'Only versions verified against their source can be restored' USING ERRCODE = '22023';
  END IF;

  UPDATE geographic_boundaries SET status = 'archived', archived_at = now()
  WHERE boundary_key = v_key AND status = 'published'
  RETURNING id INTO v_previous;

  IF v_previous IS NOT NULL THEN
    INSERT INTO geographic_import_history (boundary_id, action, actor_id, details)
    VALUES (v_previous, 'archived', auth.uid(), jsonb_build_object('reason', 'rolled_back', 'superseded_by', p_boundary_id));
  END IF;

  UPDATE geographic_boundaries SET status = 'published', published_at = now(), archived_at = NULL
  WHERE id = p_boundary_id;

  INSERT INTO geographic_import_history (boundary_id, action, actor_id, details)
  VALUES (p_boundary_id, 'published', auth.uid(), jsonb_build_object('restored', true, 'replaced', v_previous, 'note', trim(p_note)));
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.create_geographic_upload_job(text, text, integer, text, text, text, uuid, jsonb, jsonb, jsonb, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_geographic_upload_job(text, text, integer, text, text, text, uuid, jsonb, jsonb, jsonb, jsonb, jsonb) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.review_geographic_upload(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_geographic_upload(uuid, text, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.rollback_geographic_boundary(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rollback_geographic_boundary(uuid, text) TO authenticated;
