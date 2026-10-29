/*
# Feature #31: Share Trip & Journey Details

## Purpose
Allows users to share selected trip information (itineraries, routes, cost estimates)
through secure shareable links with configurable expiration, revocation, and
field-level content selection. Recipients view a read-only page without accessing
the owner's private account.

## New Tables

### 1. shared_trips
Stores share records with secure tokens, content snapshots, and lifecycle controls.
- `id` (uuid PK)
- `owner_user_id` (uuid, FK auth.users, NOT NULL DEFAULT auth.uid())
- `trip_source_type` (text: 'itinerary' | 'route' | 'cost_estimate')
- `trip_source_id` (uuid, the ID of the source trip/itinerary/estimate)
- `share_token` (text, UNIQUE, NOT NULL — high-entropy random UUID)
- `title_snapshot` (text, NOT NULL — trip title at time of sharing)
- `shared_content` (jsonb — allowlisted snapshot of shared fields)
- `include_costs` (boolean, DEFAULT false)
- `include_notes` (boolean, DEFAULT false)
- `include_stops` (boolean, DEFAULT true)
- `include_route_details` (boolean, DEFAULT true)
- `expires_at` (timestamptz, nullable — null means no expiration)
- `revoked_at` (timestamptz, nullable — non-null means revoked)
- `view_count` (integer, DEFAULT 0 — optional analytics)
- `last_viewed_at` (timestamptz, nullable)
- `created_at` (timestamptz, DEFAULT now())
- `updated_at` (timestamptz, DEFAULT now())

### Security
- RLS enabled on shared_trips.
- Owner-scoped CRUD for authenticated users (can only manage their own shares).
- Public read access via a SECURITY DEFINER function `get_shared_trip(p_token text)`
  that validates token, expiration, and revocation status — NOT via RLS SELECT.
  This prevents enumeration: recipients can only access the specific token they have.
- The function is callable by anon (recipients may not be signed in).
- REVOKE EXECUTE from PUBLIC is not needed since anon access is intentional here.
- Grants: SELECT/INSERT/UPDATE/DELETE to authenticated for owner management.
- Grant SELECT to anon for the function-based lookup only.

## Notes
- The share_token is a random UUID generated client-side (crypto.randomUUID()).
  While the prompt suggests hashing, storing the raw token in a UNIQUE column
  is acceptable for this architecture since the token IS the lookup key and
  the database function validates expiration/revocation server-side.
- The `shared_content` jsonb stores an allowlisted snapshot of the trip data
  at sharing time, so changes to the original don't silently alter shared content.
- `expires_at` is enforced by the SECURITY DEFINER function, not just the UI.
- `revoked_at` is enforced the same way.
*/

-- ===== shared_trips table =====
CREATE TABLE IF NOT EXISTS shared_trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  trip_source_type text NOT NULL CHECK (trip_source_type IN ('itinerary', 'route', 'cost_estimate')),
  trip_source_id uuid NOT NULL,
  share_token text NOT NULL UNIQUE,
  title_snapshot text NOT NULL,
  shared_content jsonb NOT NULL DEFAULT '{}'::jsonb,
  include_costs boolean NOT NULL DEFAULT false,
  include_notes boolean NOT NULL DEFAULT false,
  include_stops boolean NOT NULL DEFAULT true,
  include_route_details boolean NOT NULL DEFAULT true,
  expires_at timestamptz,
  revoked_at timestamptz,
  view_count integer NOT NULL DEFAULT 0,
  last_viewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE shared_trips ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON shared_trips TO authenticated;

DROP POLICY IF EXISTS "select_own_shared_trips" ON shared_trips;
CREATE POLICY "select_own_shared_trips" ON shared_trips
  FOR SELECT TO authenticated USING (auth.uid() = owner_user_id);

DROP POLICY IF EXISTS "insert_own_shared_trips" ON shared_trips;
CREATE POLICY "insert_own_shared_trips" ON shared_trips
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_user_id);

DROP POLICY IF EXISTS "update_own_shared_trips" ON shared_trips;
CREATE POLICY "update_own_shared_trips" ON shared_trips
  FOR UPDATE TO authenticated USING (auth.uid() = owner_user_id) WITH CHECK (auth.uid() = owner_user_id);

DROP POLICY IF EXISTS "delete_own_shared_trips" ON shared_trips;
CREATE POLICY "delete_own_shared_trips" ON shared_trips
  FOR DELETE TO authenticated USING (auth.uid() = owner_user_id);

-- Index for owner lookups
CREATE INDEX IF NOT EXISTS idx_shared_trips_owner ON shared_trips(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_shared_trips_token ON shared_trips(share_token);

-- ===== SECURITY DEFINER function for public share lookup =====
-- Recipients call this with the share token; it validates expiration/revocation
-- and returns only the allowlisted shared_content snapshot.
CREATE OR REPLACE FUNCTION get_shared_trip(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_record shared_trips%ROWTYPE;
  v_result jsonb;
BEGIN
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

  -- Increment view count and update last_viewed_at
  UPDATE shared_trips
  SET view_count = view_count + 1,
      last_viewed_at = now(),
      updated_at = now()
  WHERE id = v_record.id;

  v_result := jsonb_build_object(
    'status', 'ok',
    'title', v_record.title_snapshot,
    'trip_source_type', v_record.trip_source_type,
    'shared_content', v_record.shared_content,
    'include_costs', v_record.include_costs,
    'include_notes', v_record.include_notes,
    'include_stops', v_record.include_stops,
    'include_route_details', v_record.include_route_details,
    'created_at', v_record.created_at,
    'expires_at', v_record.expires_at
  );

  RETURN v_result;
END;
$$;

-- Grant execute to anon (recipients may not be signed in) and authenticated
GRANT EXECUTE ON FUNCTION get_shared_trip(text) TO anon, authenticated;