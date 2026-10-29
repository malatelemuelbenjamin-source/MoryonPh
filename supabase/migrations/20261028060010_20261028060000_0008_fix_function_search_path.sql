-- Fix mutable search_path on functions flagged by the database linter.
-- Setting a fixed search_path prevents search-path injection on SECURITY DEFINER / trigger functions.

ALTER FUNCTION public.set_updated_at() SET search_path = public;
ALTER FUNCTION public.fare_update_recompute() SET search_path = public;
