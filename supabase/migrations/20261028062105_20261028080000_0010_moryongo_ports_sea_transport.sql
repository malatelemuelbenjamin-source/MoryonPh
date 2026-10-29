/*
# MoryonGo Feature #9: Ports and Sea Transport (Ferry/RORO) System

1. New Tables
- `ports` — port-specific information linked to existing locations.
  Fields: id, location_id (→ locations), port_name, port_type enum, description,
  contact_number, official_website, latitude, longitude, operating_status enum,
  verification_status (reuses existing enum), source_name, source_url,
  verified_by (→ auth.users), verified_at, created_at, updated_at.
- `sea_transport_schedules` — sailing schedules for ferry/RORO routes.
  Fields: id, route_id (→ routes), operator_name, departure_port_id (→ ports),
  arrival_port_id (→ ports), departure_datetime, arrival_datetime, schedule_type enum,
  effective_from, effective_until, status enum, verification_status, source_name,
  source_url, verified_at, created_at, updated_at.

2. Modified Tables
- `fares` — added optional `fare_category` text column to distinguish passenger
  fares from vehicle fares (e.g. "adult", "child", "motorcycle", "private_car").
  Uses ADD COLUMN IF NOT EXISTS — safe and reversible.

3. New Enums
- `port_type`: 'passenger','roro','cargo','mixed','unknown'
- `port_operating_status`: 'operational','temporarily_closed','unknown'
- `schedule_type`: 'regular','special','one_time'
- `schedule_status`: 'scheduled','delayed','cancelled','completed','unknown'

4. Security
- RLS enabled on both new tables.
- Public read (anon + authenticated) for verified/published records only.
- service_role gets INSERT, UPDATE, DELETE (admin tooling).
- Updated_at triggers reuse existing set_updated_at() function.
*/

-- =========================================================
-- ENUMS
-- =========================================================
DO $$ BEGIN
  CREATE TYPE port_type AS ENUM ('passenger','roro','cargo','mixed','unknown');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE port_operating_status AS ENUM ('operational','temporarily_closed','unknown');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE schedule_type AS ENUM ('regular','special','one_time');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE schedule_status AS ENUM ('scheduled','delayed','cancelled','completed','unknown');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =========================================================
-- PORTS
-- =========================================================
CREATE TABLE IF NOT EXISTS ports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  port_name text NOT NULL,
  port_type port_type NOT NULL DEFAULT 'unknown',
  description text,
  contact_number text,
  official_website text,
  latitude double precision,
  longitude double precision,
  operating_status port_operating_status NOT NULL DEFAULT 'unknown',
  verification_status verification_status NOT NULL DEFAULT 'community',
  source_name text,
  source_url text,
  verified_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  verified_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE ports ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON ports TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON ports TO service_role;

DROP POLICY IF EXISTS "ports_public_read" ON ports;
CREATE POLICY "ports_public_read" ON ports FOR SELECT
  TO anon, authenticated
  USING (verification_status IN ('official','verified','community'));

CREATE INDEX IF NOT EXISTS idx_ports_location ON ports (location_id);
CREATE INDEX IF NOT EXISTS idx_ports_type ON ports (port_type);
CREATE INDEX IF NOT EXISTS idx_ports_status ON ports (verification_status);

-- =========================================================
-- SEA_TRANSPORT_SCHEDULES
-- =========================================================
CREATE TABLE IF NOT EXISTS sea_transport_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id uuid NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  operator_name text,
  departure_port_id uuid REFERENCES ports(id) ON DELETE SET NULL,
  arrival_port_id uuid REFERENCES ports(id) ON DELETE SET NULL,
  departure_datetime timestamptz,
  arrival_datetime timestamptz,
  schedule_type schedule_type NOT NULL DEFAULT 'regular',
  effective_from date,
  effective_until date,
  status schedule_status NOT NULL DEFAULT 'unknown',
  verification_status verification_status NOT NULL DEFAULT 'community',
  source_name text,
  source_url text,
  verified_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE sea_transport_schedules ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON sea_transport_schedules TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON sea_transport_schedules TO service_role;

DROP POLICY IF EXISTS "sea_schedules_public_read" ON sea_transport_schedules;
CREATE POLICY "sea_schedules_public_read" ON sea_transport_schedules FOR SELECT
  TO anon, authenticated
  USING (verification_status IN ('official','verified','community'));

CREATE INDEX IF NOT EXISTS idx_sea_sched_route ON sea_transport_schedules (route_id);
CREATE INDEX IF NOT EXISTS idx_sea_sched_departure ON sea_transport_schedules (departure_port_id);
CREATE INDEX IF NOT EXISTS idx_sea_sched_arrival ON sea_transport_schedules (arrival_port_id);
CREATE INDEX IF NOT EXISTS idx_sea_sched_status ON sea_transport_schedules (verification_status);
CREATE INDEX IF NOT EXISTS idx_sea_sched_dep_time ON sea_transport_schedules (departure_datetime);

-- =========================================================
-- EXTEND fares with optional fare_category column
-- =========================================================
ALTER TABLE fares ADD COLUMN IF NOT EXISTS fare_category text;

-- =========================================================
-- UPDATED_AT TRIGGERS
-- =========================================================
DROP TRIGGER IF EXISTS trg_ports_updated ON ports;
CREATE TRIGGER trg_ports_updated BEFORE UPDATE ON ports
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_sea_sched_updated ON sea_transport_schedules;
CREATE TRIGGER trg_sea_sched_updated BEFORE UPDATE ON sea_transport_schedules
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
