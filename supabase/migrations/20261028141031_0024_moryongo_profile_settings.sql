/*
# MoryonGo Feature #24 — User Profile & Account Settings

Extends the existing `users` table with:
- username (nullable, unique when set)
- commuter_preferences jsonb (non-sensitive: default view, preferred modes, etc.)
- notification_preferences jsonb (per-category on/off flags)

Existing RLS policies (users_select_own, users_update_own) already enforce
auth.uid() = id, so the new columns inherit the same protection automatically.
No new tables needed — the existing `users` table is the profile table.
*/

ALTER TABLE users ADD COLUMN IF NOT EXISTS username text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS commuter_preferences jsonb DEFAULT '{}'::jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_preferences jsonb DEFAULT '{
  "transport_alerts": true,
  "fare_updates": true,
  "weather_advisories": true,
  "saved_route_updates": true,
  "event_reminders": false
}'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users (username) WHERE username IS NOT NULL;

GRANT UPDATE (username, commuter_preferences, notification_preferences, name, home_municipality, preferred_language, profile_photo, preferred_passenger_category_id) ON users TO authenticated;
