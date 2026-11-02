/*
# Shared itinerary privacy and shared trip hardening

## Plain-English summary
Shared itineraries used to be readable by anyone holding the link through direct table access, and the anonymous role held full table privileges (including TRUNCATE) on the itinerary and shared trip tables. This migration removes that direct access. Shared itineraries are now served only through a server-side function that validates the link token, enforces the share rules on the server, and returns only the fields a public viewer needs. Shared trip links get the same token checks, server-side option enforcement, and view-count protection.

## 1. Changed access
- Dropped the four anonymous SELECT policies that exposed shared itinerary, day, stop, and leg rows directly.
- Revoked ALL table privileges from the anonymous role on tourist_itineraries, tourist_itinerary_days, tourist_itinerary_stops, tourist_itinerary_legs, and shared_trips.
- Revoked TRUNCATE, REFERENCES, and TRIGGER from the signed-in role on those tables. Owners keep SELECT, INSERT, UPDATE, DELETE through their existing owner-scoped policies.

## 2. New function: get_shared_itinerary(p_token text)
- Validates the token is a UUID before any lookup; anything else returns not_found.
- Returns status "ok" with the itinerary title, description, dates, travelers, starting place, days, stops, and transport legs.
- Never returns owner IDs, share tokens, budgets, preferences, expenses, or private notes (stop notes, day notes, leg notes).
- Returns status "revoked" when the itinerary exists but sharing is off or it is archived.
- Runs as the function owner with a fixed search_path. Executable by the anonymous and signed-in roles only.

## 3. Updated function: get_shared_trip(p_token text)
- Same token format check as above.
- View count increases at most once every 15 minutes per shared trip, so refreshing or scripted requests cannot inflate counts.
- Option flags are enforced on the server: stops, route details, costs, notes, and descriptions are removed from the response when their flag is off.
- Response keys are unchanged, so existing viewer pages keep working.

## Important notes
1. Existing share links keep working because all stored tokens are UUIDs and the lookup is by the same token.
2. Rollback instructions are in the accompanying report; the previous policies and grants are listed there.
*/

DROP POLICY IF EXISTS "anon_select_shared_itineraries" ON public.tourist_itineraries;
DROP POLICY IF EXISTS "anon_select_shared_itinerary_days" ON public.tourist_itinerary_days;
DROP POLICY IF EXISTS "anon_select_shared_itinerary_stops" ON public.tourist_itinerary_stops;
DROP POLICY IF EXISTS "anon_select_shared_itinerary_legs" ON public.tourist_itinerary_legs;

REVOKE ALL ON public.tourist_itineraries, public.tourist_itinerary_days, public.tourist_itinerary_stops, public.tourist_itinerary_legs, public.shared_trips FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.tourist_itineraries, public.tourist_itinerary_days, public.tourist_itinerary_stops, public.tourist_itinerary_legs, public.shared_trips FROM authenticated;

CREATE OR REPLACE FUNCTION public.get_shared_itinerary(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_itinerary tourist_itineraries%ROWTYPE;
  v_result jsonb;
BEGIN
  IF p_token IS NULL OR p_token !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  SELECT * INTO v_itinerary FROM tourist_itineraries WHERE share_token = p_token LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  IF NOT v_itinerary.is_shared OR v_itinerary.status = 'archived' THEN
    RETURN jsonb_build_object('status', 'revoked');
  END IF;

  SELECT jsonb_build_object(
    'status', 'ok',
    'itinerary', jsonb_build_object(
      'id', v_itinerary.id,
      'title', v_itinerary.title,
      'description', v_itinerary.description,
      'start_date', v_itinerary.start_date,
      'end_date', v_itinerary.end_date,
      'traveler_count', v_itinerary.traveler_count,
      'currency_code', v_itinerary.currency_code,
      'status', v_itinerary.status,
      'starting_location', (
        SELECT jsonb_build_object('id', l.id, 'name', l.name, 'municipality', l.municipality)
        FROM locations l WHERE l.id = v_itinerary.starting_location_id
      ),
      'days', (
        SELECT coalesce(jsonb_agg(jsonb_build_object(
          'id', d.id,
          'day_number', d.day_number,
          'trip_date', d.trip_date,
          'stops', (
            SELECT coalesce(jsonb_agg(jsonb_build_object(
              'id', s.id,
              'itinerary_day_id', s.itinerary_day_id,
              'destination_id', s.destination_id,
              'location_id', s.location_id,
              'custom_title', s.custom_title,
              'custom_location_description', s.custom_location_description,
              'stop_order', s.stop_order,
              'planned_arrival_time', s.planned_arrival_time,
              'planned_departure_time', s.planned_departure_time,
              'estimated_duration_minutes', s.estimated_duration_minutes,
              'is_rest_break', s.is_rest_break,
              'destination', (
                SELECT jsonb_build_object(
                  'id', x.id, 'name', x.name, 'municipality', x.municipality,
                  'latitude', x.latitude, 'longitude', x.longitude,
                  'entrance_fee', x.entrance_fee, 'opening_hours', x.opening_hours,
                  'verification_status', x.verification_status)
                FROM destinations x WHERE x.id = s.destination_id
              ),
              'location', (
                SELECT jsonb_build_object(
                  'id', y.id, 'name', y.name, 'municipality', y.municipality,
                  'latitude', y.latitude, 'longitude', y.longitude)
                FROM locations y WHERE y.id = s.location_id
              )
            ) ORDER BY s.stop_order), '[]'::jsonb)
            FROM tourist_itinerary_stops s WHERE s.itinerary_day_id = d.id
          )
        ) ORDER BY d.day_number), '[]'::jsonb)
        FROM tourist_itinerary_days d WHERE d.itinerary_id = v_itinerary.id
      ),
      'legs', (
        SELECT coalesce(jsonb_agg(jsonb_build_object(
          'id', g.id,
          'leg_order', g.leg_order,
          'estimated_fare', g.estimated_fare,
          'currency_code', g.currency_code,
          'estimated_duration_minutes', g.estimated_duration_minutes,
          'fare_source_status', g.fare_source_status,
          'route', (
            SELECT jsonb_build_object('id', r.id, 'route_name', r.route_name, 'route_code', r.route_code,
              'estimated_duration_minutes', r.estimated_duration_minutes)
            FROM routes r WHERE r.id = g.route_id
          ),
          'transport_mode', (
            SELECT jsonb_build_object('id', m.id, 'name', m.name, 'code', m.code, 'icon', m.icon)
            FROM transport_modes m WHERE m.id = g.transport_mode_id
          )
        ) ORDER BY g.leg_order), '[]'::jsonb)
        FROM tourist_itinerary_legs g WHERE g.itinerary_id = v_itinerary.id
      )
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_shared_itinerary(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_shared_itinerary(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_shared_trip(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_record shared_trips%ROWTYPE;
  v_content jsonb;
  v_days jsonb;
BEGIN
  IF p_token IS NULL OR p_token !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  SELECT * INTO v_record FROM shared_trips WHERE share_token = p_token LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  IF v_record.revoked_at IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'revoked');
  END IF;

  IF v_record.expires_at IS NOT NULL AND v_record.expires_at < now() THEN
    RETURN jsonb_build_object('status', 'expired');
  END IF;

  IF v_record.last_viewed_at IS NULL OR v_record.last_viewed_at < now() - interval '15 minutes' THEN
    UPDATE shared_trips
    SET view_count = view_count + 1,
        last_viewed_at = now(),
        updated_at = now()
    WHERE id = v_record.id;
  END IF;

  v_content := coalesce(v_record.shared_content, '{}'::jsonb);

  IF NOT v_record.include_stops THEN
    v_content := v_content || jsonb_build_object('days', '[]'::jsonb);
  END IF;

  IF NOT v_record.include_notes THEN
    v_days := (
      SELECT coalesce(jsonb_agg(jsonb_set(d.elem, '{stops}', (
        SELECT coalesce(jsonb_agg(jsonb_set(s.elem, '{notes}', 'null'::jsonb) ORDER BY s.ord), '[]'::jsonb)
        FROM jsonb_array_elements(coalesce(d.elem->'stops', '[]'::jsonb)) WITH ORDINALITY AS s(elem, ord)
      )) ORDER BY d.ord), '[]'::jsonb)
      FROM jsonb_array_elements(coalesce(v_content->'days', '[]'::jsonb)) WITH ORDINALITY AS d(elem, ord)
    );
    v_content := v_content || jsonb_build_object('description', NULL::jsonb, 'days', v_days);
  END IF;

  IF NOT v_record.include_route_details THEN
    v_content := v_content || jsonb_build_object('legs', '[]'::jsonb);
  END IF;

  IF NOT v_record.include_costs THEN
    v_content := v_content || jsonb_build_object(
      'expenses', '[]'::jsonb,
      'cost_summary', NULL::jsonb,
      'legs', (
        SELECT coalesce(jsonb_agg(l.elem || jsonb_build_object('estimated_fare', NULL::jsonb) ORDER BY l.ord), '[]'::jsonb)
        FROM jsonb_array_elements(coalesce(v_content->'legs', '[]'::jsonb)) WITH ORDINALITY AS l(elem, ord)
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'status', 'ok',
    'title', v_record.title_snapshot,
    'trip_source_type', v_record.trip_source_type,
    'shared_content', v_content,
    'include_costs', v_record.include_costs,
    'include_notes', v_record.include_notes,
    'include_stops', v_record.include_stops,
    'include_route_details', v_record.include_route_details,
    'created_at', v_record.created_at,
    'expires_at', v_record.expires_at
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_shared_trip(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_shared_trip(text) TO anon, authenticated;
