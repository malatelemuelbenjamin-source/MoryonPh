/*
# Feature 17: Weather Information and Travel Weather Advisories

## Overview
Adds weather data caching and user alert subscription tables for the MoryonGo
Weather & Travel Conditions feature. Weather data is fetched securely through
a server-side edge function (weather-proxy) that holds API keys server-side.
The frontend never contacts the weather provider directly.

## 1. New Tables

### weather_cache
Stores normalized weather data returned by the trusted backend (edge function).
Only the service_role (edge function) may write. All users may read cached data.

- id — UUID PK
- location_id — optional FK to locations table (municipality record)
- municipality — text, the municipality name (Boac, Buenavista, Gasan, Mogpog, Santa Cruz, Torrijos)
- provider — text, weather provider identifier (e.g. 'openweathermap')
- data_type — text CHECK: 'current' | 'hourly' | 'daily' | 'warning'
- payload — jsonb, normalized weather payload from the backend
- observed_at — timestamptz, observation timestamp if applicable
- fetched_at — timestamptz, when the data was retrieved
- expires_at — timestamptz, cache expiration timestamp
- created_at — timestamptz default now()

Indexes: (municipality, data_type, expires_at), (location_id, data_type)

### weather_alert_subscriptions
Per-user subscription to weather alerts for specific municipalities.

- id — UUID PK
- user_id — UUID NOT NULL DEFAULT auth.uid(), FK auth.users ON DELETE CASCADE
- municipality — text, municipality name
- alert_preferences — text[], array of preferred alert categories (e.g. ['severe','rain','wind'])
- enabled — boolean default true
- created_at — timestamptz default now()
- updated_at — timestamptz default now()

Index: (user_id)
Unique constraint: (user_id, municipality) — one subscription per user per municipality.

## 2. Security (RLS)

### weather_cache
- RLS enabled. SELECT to anon+authenticated (shared weather data). WRITE to service_role only.

### weather_alert_subscriptions
- RLS enabled. Owner-scoped CRUD via auth.uid() = user_id.

## 3. Notes
- The weather-proxy edge function uses service_role key to write cache records.
- API keys stored as edge function secrets, never in the DB.
*/

-- ---- weather_cache table ----
CREATE TABLE IF NOT EXISTS weather_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid REFERENCES locations(id) ON DELETE SET NULL,
  municipality text NOT NULL,
  provider text NOT NULL DEFAULT 'openweathermap',
  data_type text NOT NULL CHECK (data_type IN ('current', 'hourly', 'daily', 'warning')),
  payload jsonb NOT NULL,
  observed_at timestamptz,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_weather_cache_muni_type_expires
  ON weather_cache (municipality, data_type, expires_at);
CREATE INDEX IF NOT EXISTS idx_weather_cache_location_type
  ON weather_cache (location_id, data_type);

ALTER TABLE weather_cache ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON weather_cache TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON weather_cache TO service_role;

DROP POLICY IF EXISTS "public_can_read_weather_cache" ON weather_cache;
CREATE POLICY "public_can_read_weather_cache"
ON weather_cache FOR SELECT
TO anon, authenticated USING (true);

-- ---- weather_alert_subscriptions table ----
CREATE TABLE IF NOT EXISTS weather_alert_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  municipality text NOT NULL,
  alert_preferences text[] NOT NULL DEFAULT '{severe,rain,wind}',
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_weather_subs_user_muni
  ON weather_alert_subscriptions (user_id, municipality);
CREATE INDEX IF NOT EXISTS idx_weather_subs_user
  ON weather_alert_subscriptions (user_id);

ALTER TABLE weather_alert_subscriptions ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON weather_alert_subscriptions TO authenticated;

DROP POLICY IF EXISTS "select_own_weather_subs" ON weather_alert_subscriptions;
CREATE POLICY "select_own_weather_subs"
ON weather_alert_subscriptions FOR SELECT
TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_weather_subs" ON weather_alert_subscriptions;
CREATE POLICY "insert_own_weather_subs"
ON weather_alert_subscriptions FOR INSERT
TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_weather_subs" ON weather_alert_subscriptions;
CREATE POLICY "update_own_weather_subs"
ON weather_alert_subscriptions FOR UPDATE
TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_weather_subs" ON weather_alert_subscriptions;
CREATE POLICY "delete_own_weather_subs"
ON weather_alert_subscriptions FOR DELETE
TO authenticated USING (auth.uid() = user_id);