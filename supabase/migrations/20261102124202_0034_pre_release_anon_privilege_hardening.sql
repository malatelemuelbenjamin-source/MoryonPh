/*
# Pre-release anon and grant hardening

## Plain-English summary
Anonymous visitors (people not signed in) were holding write, truncate, reference and trigger
privileges on every public table and view. Row level security already blocked their writes,
because no policy grants anonymous writes, but the grants were wider than the app needs.
This migration removes those privileges. Public reading, signed-in access and the public
shared-trip links are unchanged.

## 1. Changes
- Anonymous users lose INSERT, UPDATE and DELETE on all public tables and views.
- Anonymous and signed-in users lose TRUNCATE, REFERENCES and TRIGGER on all public tables and views.
  PostgREST never uses these privileges; removing them removes a destructive path for no feature.

## 2. Unchanged (intentionally)
- Anonymous SELECT on public-read tables (destinations, routes, fares, events and similar).
- Signed-in INSERT/UPDATE/DELETE, which remain governed by row level security policies.
- EXECUTE on get_shared_itinerary and get_shared_trip for anonymous users (public share links).
- EXECUTE on admin functions for signed-in users only; these check the admin claim internally.

## 3. Notes
- Idempotent: REVOKE of a privilege that is already absent is a no-op.
- No table, policy, function or data is changed.
*/

REVOKE INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
