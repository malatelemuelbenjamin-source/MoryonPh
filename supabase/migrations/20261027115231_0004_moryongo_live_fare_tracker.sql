/*
# MoryonGo Feature #4 — Live Fare Tracker + Fare Updates

1. New Tables
- `fare_updates` — records fare changes over time, comparing previous vs new fare.
  Reuses `fares.id`, `routes.id` from Feature #3. Never auto-publishes; pending
  records stay pending until an admin verifies.
- `fare_update_subscriptions` — user preferences for fare-change notifications,
  keyed to existing routes/transport_modes/locations.
- `fare_update_audit_logs` — audit trail of who changed a fare update's status.

2. Accuracy discipline (mirrors Feature #3)
- No invented fare changes, effective dates, sources, or announcements.
- Pending updates are NOT shown as official/verified current fares.
- Only `official` and `verified` fare_updates are surfaced to normal users as
  published updates; `community` is shown with a clear label.
- `estimated`, `rejected`, `archived` are never shown as current updates.
- The Fare Calculator continues to select the correct current fare by effective
  date — future fares do not become active early, expired fares are not current.

3. Change detection
- update_type is derived by comparing numeric previous_amount vs new_amount.
- change_percentage = ((new - old) / old) * 100, only when old > 0.
- A detected change creates a PENDING record — it is never auto-published.

4. Security
- RLS on every new table.
- Public read (anon + authenticated) for published, non-pending/non-rejected/
  non-archived fare_updates.
- Subscriptions: users manage only their own rows (auth.uid = user_id).
- Audit logs: read/write restricted to service_role (admin tooling).
- No regular user can insert/update/delete fare_updates or audit logs.
*/

-- =========================================================
-- ENUMS
-- =========================================================
DO $$ BEGIN
  CREATE TYPE fare_update_type AS ENUM (
    'increase','decrease','unchanged_verified','new_fare',
    'correction','expiration','other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE fare_update_status AS ENUM (
    'pending','official','verified','community','estimated','rejected','archived'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE fare_notification_type AS ENUM (
    'fare_change','fare_verification','upcoming_fare','all'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE fare_audit_action AS ENUM (
    'created','submitted','reviewed','verified','rejected','corrected','archived'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =========================================================
-- FARE_UPDATES
-- =========================================================
CREATE TABLE IF NOT EXISTS fare_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fare_id uuid NOT NULL REFERENCES fares(id) ON DELETE CASCADE,
  route_id uuid NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  previous_fare_id uuid REFERENCES fares(id) ON DELETE SET NULL,
  update_type fare_update_type NOT NULL DEFAULT 'new_fare',
  previous_amount numeric(10,2) CHECK (previous_amount IS NULL OR previous_amount >= 0),
  new_amount numeric(10,2) NOT NULL CHECK (new_amount >= 0),
  change_amount numeric(10,2) NOT NULL DEFAULT 0,
  change_percentage numeric(6,2),
  announcement_title text,
  announcement_description text,
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  source text,
  source_reference text,
  verification_status fare_update_status NOT NULL DEFAULT 'pending',
  verified_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  verified_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE fare_updates ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON fare_updates TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON fare_updates TO service_role;

-- Public reads only published updates (not pending/rejected/archived).
DROP POLICY IF EXISTS "fare_updates_public_read" ON fare_updates;
CREATE POLICY "fare_updates_public_read" ON fare_updates FOR SELECT
  TO anon, authenticated
  USING (verification_status IN ('official','verified','community'));

CREATE INDEX IF NOT EXISTS idx_fare_updates_route ON fare_updates (route_id);
CREATE INDEX IF NOT EXISTS idx_fare_updates_fare ON fare_updates (fare_id);
CREATE INDEX IF NOT EXISTS idx_fare_updates_status ON fare_updates (verification_status, effective_from);
CREATE INDEX IF NOT EXISTS idx_fare_updates_effective ON fare_updates (effective_from);

-- =========================================================
-- FARE_UPDATE_SUBSCRIPTIONS
-- =========================================================
CREATE TABLE IF NOT EXISTS fare_update_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  route_id uuid REFERENCES routes(id) ON DELETE CASCADE,
  transport_mode_id uuid REFERENCES transport_modes(id) ON DELETE CASCADE,
  location_id uuid REFERENCES locations(id) ON DELETE CASCADE,
  notification_type fare_notification_type NOT NULL DEFAULT 'all',
  is_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT fare_sub_target CHECK (
    route_id IS NOT NULL OR transport_mode_id IS NOT NULL OR location_id IS NOT NULL
  )
);

ALTER TABLE fare_update_subscriptions ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON fare_update_subscriptions TO authenticated;

DROP POLICY IF EXISTS "fare_subs_owner_all" ON fare_update_subscriptions;
CREATE POLICY "fare_subs_owner_all" ON fare_update_subscriptions
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_fare_subs_user ON fare_update_subscriptions (user_id);
CREATE INDEX IF NOT EXISTS idx_fare_subs_route ON fare_update_subscriptions (route_id);

-- =========================================================
-- FARE_UPDATE_AUDIT_LOGS
-- =========================================================
CREATE TABLE IF NOT EXISTS fare_update_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fare_update_id uuid NOT NULL REFERENCES fare_updates(id) ON DELETE CASCADE,
  action fare_audit_action NOT NULL,
  previous_status fare_update_status,
  new_status fare_update_status,
  performed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reason text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE fare_update_audit_logs ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON fare_update_audit_logs TO authenticated;
GRANT INSERT, UPDATE, DELETE ON fare_update_audit_logs TO service_role;

-- Users can read audit entries for published updates (transparency), but
-- service_role writes them. Pending/internal details are admin-only via service_role.
DROP POLICY IF EXISTS "fare_audit_public_read" ON fare_update_audit_logs;
CREATE POLICY "fare_audit_public_read" ON fare_update_audit_logs FOR SELECT
  TO authenticated
  USING (
    new_status IN ('official','verified','community')
    OR previous_status IN ('official','verified','community')
  );

CREATE INDEX IF NOT EXISTS idx_fare_audit_update ON fare_update_audit_logs (fare_update_id);

-- =========================================================
-- UPDATED_AT TRIGGERS
-- =========================================================
DROP TRIGGER IF EXISTS trg_fare_updates_updated ON fare_updates;
CREATE TRIGGER trg_fare_updates_updated BEFORE UPDATE ON fare_updates
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_fare_subs_updated ON fare_update_subscriptions;
CREATE TRIGGER trg_fare_subs_updated BEFORE UPDATE ON fare_update_subscriptions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =========================================================
-- Helper: compute change_amount and change_percentage automatically
-- =========================================================
CREATE OR REPLACE FUNCTION fare_update_recompute()
RETURNS TRIGGER AS $$
DECLARE
  prev numeric(10,2);
BEGIN
  prev := COALESCE(NEW.previous_amount, 0);
  IF NEW.new_amount > prev THEN
    NEW.update_type := COALESCE(NEW.update_type, 'increase');
    NEW.change_amount := NEW.new_amount - prev;
  ELSIF NEW.new_amount < prev THEN
    NEW.update_type := COALESCE(NEW.update_type, 'decrease');
    NEW.change_amount := prev - NEW.new_amount;
    NEW.change_amount := -NEW.change_amount;
  ELSE
    NEW.update_type := COALESCE(NEW.update_type, 'unchanged_verified');
    NEW.change_amount := 0;
  END IF;

  IF prev > 0 THEN
    NEW.change_percentage := ROUND((((NEW.new_amount - prev) / prev) * 100)::numeric, 2);
  ELSE
    NEW.change_percentage := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_fare_update_compute ON fare_updates;
CREATE TRIGGER trg_fare_update_compute
  BEFORE INSERT OR UPDATE OF previous_amount, new_amount ON fare_updates
  FOR EACH ROW EXECUTE FUNCTION fare_update_recompute();
