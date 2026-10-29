/*
# Feature 27: Admin Audit Logs Table

1. New Tables
- `admin_audit_logs` — Centralized audit log for all administrative actions across MoryonGo modules.
  - `id` (uuid PK)
  - `actor_user_id` (uuid, references auth.users) — who performed the action
  - `action` (text) — short action identifier (e.g. "route_published", "fare_verified")
  - `entity_type` (text) — what kind of record was affected (e.g. "route", "fare", "operator")
  - `entity_id` (uuid, nullable) — ID of the affected record
  - `summary` (text, nullable) — human-readable description
  - `before_data` (jsonb, nullable) — state before the change
  - `after_data` (jsonb, nullable) — state after the change
  - `created_at` (timestamptz, default now())

2. Security
- Enable RLS on `admin_audit_logs`.
- Grant SELECT to `authenticated` so admins can read logs.
- Grant INSERT to `service_role` only (edge functions/server-side) — users must NOT create audit entries directly.
- No UPDATE/DELETE grants — audit logs are append-only.
- Read access restricted to alert admins via `is_alert_admin()`.

3. Indexes
- `idx_admin_audit_logs_created_at` — for chronological ordering
- `idx_admin_audit_logs_actor_user_id` — for filtering by actor
- `idx_admin_audit_logs_entity_type` — for filtering by entity type

4. Important Notes
- This table complements the existing per-module audit tables (fare_update_audit_logs, community_report_audit_logs, etc.).
- The centralized log provides a single view for the admin dashboard's "Recent Activity" feed.
- Only the `service_role` can insert — the frontend calls a SECURITY DEFINER function to log admin actions safely.
*/

CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  summary text,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE admin_audit_logs ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON admin_audit_logs TO authenticated;
GRANT INSERT ON admin_audit_logs TO service_role;

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at ON admin_audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_actor_user_id ON admin_audit_logs (actor_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_entity_type ON admin_audit_logs (entity_type);

DROP POLICY IF EXISTS "Admins can read audit logs" ON admin_audit_logs;
CREATE POLICY "Admins can read audit logs"
  ON admin_audit_logs FOR SELECT
  TO authenticated
  USING (public.is_alert_admin());
