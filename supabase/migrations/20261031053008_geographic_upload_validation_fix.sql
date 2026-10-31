/*
# Fix upload validation handling

1. Summary
Corrects how the upload function reads the validation report. The report stores critical problems under the name criticalErrors, but the function was looking for critical_errors, so failed files could be sent to review. Also lets a boundary file with critical problems be saved as a failed validation instead of being rejected outright.

2. Modified functions
- create_geographic_upload_job: counts criticalErrors from the validation report. Requires polygon geometry for boundary categories only when the file has no critical problems.

3. Security
- Same administrator-only checks and grants as before. No table or policy changes.

4. Notes
- Re-running this migration is safe. The function is replaced in place.
*/

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
  v_critical := jsonb_array_length(COALESCE(p_validation->'criticalErrors', '[]'::jsonb));

  IF p_category NOT IN (
    'island_boundary', 'municipal_boundary', 'barangay_boundary', 'coastline', 'roads', 'buildings',
    'infrastructure', 'public_facilities', 'transport_routes', 'transport_terminals', 'landmarks', 'other_approved'
  ) THEN
    RAISE EXCEPTION 'Unknown dataset category' USING ERRCODE = '22023';
  END IF;

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

  IF v_boundary AND v_critical = 0 AND p_geometry IS NULL THEN
    RAISE EXCEPTION 'Boundary datasets need polygon geometry' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1 FROM geographic_upload_jobs
    WHERE file_sha256 = p_file_sha256 AND status IN ('needs_review', 'approved', 'published')
  ) THEN
    RAISE EXCEPTION 'This exact file is already waiting for review or has already been approved' USING ERRCODE = '23505';
  END IF;

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

REVOKE EXECUTE ON FUNCTION public.create_geographic_upload_job(text, text, integer, text, text, text, uuid, jsonb, jsonb, jsonb, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_geographic_upload_job(text, text, integer, text, text, text, uuid, jsonb, jsonb, jsonb, jsonb, jsonb) TO authenticated;
