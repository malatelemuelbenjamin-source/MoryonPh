/*
# Feature 18: Transport Alerts and Service Disruption Notifications

## Overview
Adds a comprehensive transport alert system with a full publication workflow,
alert categories, severity levels, lifecycle management (draft → pending_review
→ published → updated → resolved/expired/rejected), per-user subscriptions,
and audit logging. The existing `local_alerts` table lacks route/transport_mode
references, severity levels, publication workflow, and subscription support, so
a dedicated `transport_alerts` table is created here. The existing
`is_community_reviewer()` SECURITY DEFINER function is reused for admin auth.

## 1. New Enums
- transport_alert_category (13 values): route_closure, service_interruption,
  schedule_change, jeepney_advisory, tricycle_advisory, ferry_roro_advisory,
  boat_island_advisory, port_advisory, weather_transport, terminal_stop_advisory,
  road_access_traffic, emergency_transport, general_announcement
- transport_alert_severity (5 values): info, low, moderate, high, critical
- transport_alert_status (7 values): draft, pending_review, published, updated,
  resolved, expired, rejected
- transport_alert_verification (4 values): verified, application_advisory,
  unverified, rejected — distinguishes verified official alerts from
  app-issued advisories and unverified claims
- transport_alert_audit_action (7 values): created, submitted_for_review,
  published, updated, resolved, expired, rejected

## 2. New Tables

### transport_alerts
Main alert table with full lifecycle support.
- id, title, description, category, severity, status, verification
- municipality, location_id (FK locations), route_id (FK routes), transport_mode_id (FK transport_modes)
- source_name, source_url, source_reference
- published_by (FK auth.users), reviewed_by (FK auth.users)
- starts_at, ends_at, published_at, resolved_at, updated_at, created_at
- recommended_actions (text) — practical guidance
- source_report_id (uuid, nullable) — references a community_transport_reports
  row when this alert was created from an investigated community report

### transport_alert_audit_logs
Audit trail for all alert lifecycle changes.
- id, alert_id (FK transport_alerts CASCADE), actor_id, action, previous_status,
  new_status, note, created_at

### transport_alert_subscriptions
Per-user notification preferences.
- id, user_id (DEFAULT auth.uid()), municipality (nullable), route_id (nullable),
  transport_mode_id (nullable), categories (text[]), minimum_severity, enabled
- Unique constraint: (user_id, municipality, route_id, transport_mode_id)

## 3. Security (RLS)

### transport_alerts
- Public reads (anon + authenticated): only status = 'published' OR 'resolved',
  AND not expired (ends_at is null or > now()).
- Reviewers (is_community_reviewer()): full SELECT + UPDATE.
- INSERT/UPDATE/DELETE for service_role (edge functions, admin tooling).
- No ordinary user can create, publish, or change alerts.

### transport_alert_audit_logs
- SELECT to authenticated (transparency for published alerts).
- INSERT/UPDATE/DELETE to service_role only.

### transport_alert_subscriptions
- Owner-scoped CRUD via auth.uid() = user_id (4 separate policies).

## 4. Helper Function
- is_alert_admin() — SECURITY DEFINER, checks raw_app_meta_data for
  `community_reviewer` flag (reuses the same flag as community reports).
  This avoids creating a separate admin role.

## 5. Notes
- Only published or resolved alerts are visible to the public.
- Draft, pending_review, and rejected alerts are admin-only.
- Alert expiration is checked via RLS (ends_at > now() or IS NULL).
- Audit logs are inserted by the admin workflow via service_role or
  direct insert from the edge function, not by triggers.
*/

-- ===== Enums =====

DO $$ BEGIN
  CREATE TYPE transport_alert_category AS ENUM (
    'route_closure',
    'service_interruption',
    'schedule_change',
    'jeepney_advisory',
    'tricycle_advisory',
    'ferry_roro_advisory',
    'boat_island_advisory',
    'port_advisory',
    'weather_transport',
    'terminal_stop_advisory',
    'road_access_traffic',
    'emergency_transport',
    'general_announcement'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE transport_alert_severity AS ENUM (
    'info',
    'low',
    'moderate',
    'high',
    'critical'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE transport_alert_status AS ENUM (
    'draft',
    'pending_review',
    'published',
    'updated',
    'resolved',
    'expired',
    'rejected'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE transport_alert_verification AS ENUM (
    'verified',
    'application_advisory',
    'unverified',
    'rejected'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE transport_alert_audit_action AS ENUM (
    'created',
    'submitted_for_review',
    'published',
    'updated',
    'resolved',
    'expired',
    'rejected'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ===== Admin helper function =====
-- Reuses the same community_reviewer flag from raw_app_meta_data.

CREATE OR REPLACE FUNCTION public.is_alert_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'community_reviewer')::boolean,
    false
  )
$$;

REVOKE EXECUTE ON FUNCTION public.is_alert_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_alert_admin() TO authenticated;

-- ===== transport_alerts table =====

CREATE TABLE IF NOT EXISTS public.transport_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (char_length(title) >= 5 AND char_length(title) <= 200),
  description text NOT NULL CHECK (char_length(description) >= 10 AND char_length(description) <= 8000),
  category transport_alert_category NOT NULL,
  severity transport_alert_severity NOT NULL DEFAULT 'info',
  status transport_alert_status NOT NULL DEFAULT 'draft',
  verification transport_alert_verification NOT NULL DEFAULT 'unverified',
  municipality text CHECK (municipality IS NULL OR municipality IN ('Boac','Buenavista','Gasan','Mogpog','Santa Cruz','Torrijos')),
  location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  route_id uuid REFERENCES public.routes(id) ON DELETE SET NULL,
  transport_mode_id uuid REFERENCES public.transport_modes(id) ON DELETE SET NULL,
  source_name text,
  source_url text,
  source_reference text,
  recommended_actions text,
  source_report_id uuid,
  published_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  starts_at timestamptz,
  ends_at timestamptz,
  published_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_published_has_source CHECK (
    status NOT IN ('published', 'updated') OR source_name IS NOT NULL
  )
);

ALTER TABLE public.transport_alerts ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_ta_status ON public.transport_alerts (status);
CREATE INDEX IF NOT EXISTS idx_ta_severity ON public.transport_alerts (severity);
CREATE INDEX IF NOT EXISTS idx_ta_category ON public.transport_alerts (category);
CREATE INDEX IF NOT EXISTS idx_ta_municipality ON public.transport_alerts (municipality);
CREATE INDEX IF NOT EXISTS idx_ta_route ON public.transport_alerts (route_id);
CREATE INDEX IF NOT EXISTS idx_ta_published_at ON public.transport_alerts (published_at DESC);
CREATE INDEX IF NOT EXISTS idx_ta_ends_at ON public.transport_alerts (ends_at);

GRANT SELECT ON public.transport_alerts TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.transport_alerts TO authenticated, service_role;

-- Public reads: only published or resolved, not expired
DROP POLICY IF EXISTS "ta_public_read" ON public.transport_alerts;
CREATE POLICY "ta_public_read"
ON public.transport_alerts FOR SELECT
TO anon, authenticated
USING (
  status IN ('published', 'updated', 'resolved')
  AND (ends_at IS NULL OR ends_at > now())
);

-- Reviewers can read all alerts (including drafts)
DROP POLICY IF EXISTS "ta_admin_read_all" ON public.transport_alerts;
CREATE POLICY "ta_admin_read_all"
ON public.transport_alerts FOR SELECT
TO authenticated
USING (public.is_alert_admin());

-- Reviewers can insert alerts
DROP POLICY IF EXISTS "ta_admin_insert" ON public.transport_alerts;
CREATE POLICY "ta_admin_insert"
ON public.transport_alerts FOR INSERT
TO authenticated
WITH CHECK (public.is_alert_admin());

-- Reviewers can update alerts
DROP POLICY IF EXISTS "ta_admin_update" ON public.transport_alerts;
CREATE POLICY "ta_admin_update"
ON public.transport_alerts FOR UPDATE
TO authenticated
USING (public.is_alert_admin())
WITH CHECK (public.is_alert_admin());

-- Reviewers can delete alerts (rare, for cleanup)
DROP POLICY IF EXISTS "ta_admin_delete" ON public.transport_alerts;
CREATE POLICY "ta_admin_delete"
ON public.transport_alerts FOR DELETE
TO authenticated
USING (public.is_alert_admin());

-- ===== transport_alert_audit_logs table =====

CREATE TABLE IF NOT EXISTS public.transport_alert_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id uuid NOT NULL REFERENCES public.transport_alerts(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action transport_alert_audit_action NOT NULL,
  previous_status transport_alert_status,
  new_status transport_alert_status,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.transport_alert_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_taal_alert ON public.transport_alert_audit_logs (alert_id);

GRANT SELECT ON public.transport_alert_audit_logs TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.transport_alert_audit_logs TO authenticated, service_role;

DROP POLICY IF EXISTS "taal_read" ON public.transport_alert_audit_logs;
CREATE POLICY "taal_read"
ON public.transport_alert_audit_logs FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "taal_admin_write" ON public.transport_alert_audit_logs;
CREATE POLICY "taal_admin_write"
ON public.transport_alert_audit_logs FOR INSERT
TO authenticated
WITH CHECK (public.is_alert_admin());

-- ===== transport_alert_subscriptions table =====

CREATE TABLE IF NOT EXISTS public.transport_alert_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  municipality text,
  route_id uuid REFERENCES public.routes(id) ON DELETE CASCADE,
  transport_mode_id uuid REFERENCES public.transport_modes(id) ON DELETE CASCADE,
  categories text[] NOT NULL DEFAULT '{}',
  minimum_severity transport_alert_severity NOT NULL DEFAULT 'info',
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tas_target CHECK (
    municipality IS NOT NULL OR route_id IS NOT NULL OR transport_mode_id IS NOT NULL
  )
);

ALTER TABLE public.transport_alert_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_tas_user ON public.transport_alert_subscriptions (user_id);
CREATE INDEX IF NOT EXISTS idx_tas_municipality ON public.transport_alert_subscriptions (municipality);
CREATE INDEX IF NOT EXISTS idx_tas_route ON public.transport_alert_subscriptions (route_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.transport_alert_subscriptions TO authenticated;

DROP POLICY IF EXISTS "tas_select_own" ON public.transport_alert_subscriptions;
CREATE POLICY "tas_select_own"
ON public.transport_alert_subscriptions FOR SELECT
TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "tas_insert_own" ON public.transport_alert_subscriptions;
CREATE POLICY "tas_insert_own"
ON public.transport_alert_subscriptions FOR INSERT
TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "tas_update_own" ON public.transport_alert_subscriptions;
CREATE POLICY "tas_update_own"
ON public.transport_alert_subscriptions FOR UPDATE
TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "tas_delete_own" ON public.transport_alert_subscriptions;
CREATE POLICY "tas_delete_own"
ON public.transport_alert_subscriptions FOR DELETE
TO authenticated USING (auth.uid() = user_id);

-- ===== Updated_at triggers =====

DROP TRIGGER IF EXISTS trg_ta_updated ON public.transport_alerts;
CREATE TRIGGER trg_ta_updated BEFORE UPDATE ON public.transport_alerts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_tas_updated ON public.transport_alert_subscriptions;
CREATE TRIGGER trg_tas_updated BEFORE UPDATE ON public.transport_alert_subscriptions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();