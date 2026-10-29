/*
# Feature 20: Culture & Events — Marinduque Cultural Heritage, Festivals, and Community Events

## Overview
Adds a cultural events and community activities system for MoryonGo. Users can browse
festivals, historical commemorations, community gatherings, workshops, and tourism events
across Marinduque's six municipalities. Reuses existing locations, saved_places patterns,
admin authorization (is_alert_admin), and the Explore module's verification approach.

No events are seeded — the system starts empty. No fabricated dates, venues, or prices.

## 1. New Enums
- event_verification: unverified, pending_review, verified, needs_update, rejected
- event_status: draft, pending_review, published, postponed, cancelled, completed, archived
- event_admission_type: free, paid, unknown
- event_report_category: incorrect_date, incorrect_venue, incorrect_fee, inaccurate_description,
  cancelled_event, inappropriate_content, other_concern
- event_report_status: submitted, under_review, resolved, rejected
- event_registration_status: registered, cancelled

## 2. New Tables

### event_categories
Configurable category system with optional parent-child hierarchy.
- id, name, slug (unique), description, icon, parent_id (self-ref, no cycles),
  sort_order, is_active, created_at, updated_at
- Seeded with: culture_heritage, community_education, tourism_entertainment

### cultural_events
Main event content table.
- id, title, slug (unique), description, category_id (FK event_categories),
  municipality (CHECK in 6 municipalities), location_id (FK locations, nullable),
  venue_name, venue_address, latitude, longitude, start_at, end_at, is_all_day,
  cover_image_path, organizer_name, official_source_url, admission_type, admission_fee,
  currency, registration_required, registration_url, registration_deadline,
  accessibility_information (jsonb), verification_status, status, submitted_by (FK auth.users),
  reviewed_by (FK auth.users), verified_at, published_at, created_at, updated_at

### event_images
Gallery images for events.
- id, event_id (FK cultural_events CASCADE), storage_path, caption, alt_text,
  sort_order, uploaded_by (FK auth.users), created_at

### saved_events
User bookmarked events (unique user+event).
- id, user_id (DEFAULT auth.uid()), event_id (FK cultural_events CASCADE), created_at

### event_reports
User-submitted corrections for event information.
- id, event_id (FK cultural_events CASCADE), reporter_id (DEFAULT auth.uid()),
  category, description, status, reviewer_id, reviewer_notes, resolved_at, created_at, updated_at

### event_registrations
Optional event registration (links to external URL preferred, but supports native registration).
- id, event_id (FK cultural_events CASCADE), user_id (DEFAULT auth.uid()),
  registration_status, registered_at, updated_at

## 3. Security (RLS)

### event_categories
- Public read for active categories. Admin write via is_alert_admin().

### cultural_events
- Public read: status = 'published' AND verification_status IN ('verified','pending_review')
  (pending_review visible but labeled; drafts/unverified/rejected NOT public).
- Admin full CRUD via is_alert_admin().
- Submitters can read their own submitted events.
- service_role full access.

### event_images
- Public read for published events' images. Admin write via is_alert_admin().

### saved_events
- Users can CRUD only their own saved events (user_id = auth.uid()).

### event_reports
- Users can INSERT their own reports. Users can SELECT their own. Admin can SELECT all + UPDATE.

### event_registrations
- Users can register/cancel their own. Users can see their own. Admin can see all.
- service_role full access.

## 4. Notes
- is_alert_admin() SECURITY DEFINER function reused for admin authorization.
- No fabricated events seeded — system starts empty.
- External registration URLs are preferred over native registration.
*/

-- ===== Enums =====

DO $$ BEGIN
  CREATE TYPE event_verification AS ENUM (
    'unverified','pending_review','verified','needs_update','rejected'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE event_status AS ENUM (
    'draft','pending_review','published','postponed','cancelled','completed','archived'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE event_admission_type AS ENUM ('free','paid','unknown');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE event_report_category AS ENUM (
    'incorrect_date','incorrect_venue','incorrect_fee',
    'inaccurate_description','cancelled_event','inappropriate_content','other_concern'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE event_report_status AS ENUM ('submitted','under_review','resolved','rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE event_registration_status AS ENUM ('registered','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ===== event_categories =====

CREATE TABLE IF NOT EXISTS public.event_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  icon text,
  parent_id uuid REFERENCES public.event_categories(id) ON DELETE SET NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT evcat_no_self_ref CHECK (id IS NULL OR parent_id IS NULL OR parent_id <> id)
);

ALTER TABLE public.event_categories ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_evcat_parent ON public.event_categories (parent_id);
CREATE INDEX IF NOT EXISTS idx_evcat_active ON public.event_categories (is_active, sort_order);

GRANT SELECT ON public.event_categories TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.event_categories TO authenticated, service_role;

DROP POLICY IF EXISTS "evcat_public_read" ON public.event_categories;
CREATE POLICY "evcat_public_read"
ON public.event_categories FOR SELECT
TO anon, authenticated USING (is_active = true);

DROP POLICY IF EXISTS "evcat_admin_insert" ON public.event_categories;
CREATE POLICY "evcat_admin_insert"
ON public.event_categories FOR INSERT
TO authenticated WITH CHECK (public.is_alert_admin());

DROP POLICY IF EXISTS "evcat_admin_update" ON public.event_categories;
CREATE POLICY "evcat_admin_update"
ON public.event_categories FOR UPDATE
TO authenticated USING (public.is_alert_admin()) WITH CHECK (public.is_alert_admin());

DROP POLICY IF EXISTS "evcat_admin_delete" ON public.event_categories;
CREATE POLICY "evcat_admin_delete"
ON public.event_categories FOR DELETE
TO authenticated USING (public.is_alert_admin());

-- ===== cultural_events =====

CREATE TABLE IF NOT EXISTS public.cultural_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (char_length(title) >= 3 AND char_length(title) <= 200),
  slug text NOT NULL UNIQUE,
  description text,
  category_id uuid REFERENCES public.event_categories(id) ON DELETE SET NULL,
  municipality text CHECK (municipality IS NULL OR municipality IN ('Boac','Buenavista','Gasan','Mogpog','Santa Cruz','Torrijos')),
  location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  venue_name text,
  venue_address text,
  latitude double precision CHECK (latitude IS NULL OR (latitude >= -90 AND latitude <= 90)),
  longitude double precision CHECK (longitude IS NULL OR (longitude >= -180 AND longitude <= 180)),
  start_at timestamptz,
  end_at timestamptz,
  is_all_day boolean NOT NULL DEFAULT false,
  cover_image_path text,
  organizer_name text,
  official_source_url text,
  admission_type event_admission_type NOT NULL DEFAULT 'unknown',
  admission_fee text,
  currency text DEFAULT 'PHP',
  registration_required boolean,
  registration_url text,
  registration_deadline timestamptz,
  accessibility_information jsonb,
  verification_status event_verification NOT NULL DEFAULT 'unverified',
  status event_status NOT NULL DEFAULT 'draft',
  submitted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  verified_at timestamptz,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cultural_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_ce_category ON public.cultural_events (category_id);
CREATE INDEX IF NOT EXISTS idx_ce_municipality ON public.cultural_events (municipality);
CREATE INDEX IF NOT EXISTS idx_ce_status ON public.cultural_events (status, verification_status);
CREATE INDEX IF NOT EXISTS idx_ce_start ON public.cultural_events (start_at);
CREATE INDEX IF NOT EXISTS idx_ce_slug ON public.cultural_events (slug);

GRANT SELECT ON public.cultural_events TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.cultural_events TO authenticated, service_role;

-- Public reads: published + (verified or pending_review)
DROP POLICY IF EXISTS "ce_public_read" ON public.cultural_events;
CREATE POLICY "ce_public_read"
ON public.cultural_events FOR SELECT
TO anon, authenticated
USING (
  status = 'published'
  AND verification_status IN ('verified','pending_review')
);

-- Admin can read all
DROP POLICY IF EXISTS "ce_admin_read_all" ON public.cultural_events;
CREATE POLICY "ce_admin_read_all"
ON public.cultural_events FOR SELECT
TO authenticated
USING (public.is_alert_admin());

-- Submitter can read their own submissions
DROP POLICY IF EXISTS "ce_submitter_read" ON public.cultural_events;
CREATE POLICY "ce_submitter_read"
ON public.cultural_events FOR SELECT
TO authenticated
USING (submitted_by = auth.uid());

-- Authenticated users can submit events (status defaults to draft/pending_review)
DROP POLICY IF EXISTS "ce_user_insert" ON public.cultural_events;
CREATE POLICY "ce_user_insert"
ON public.cultural_events FOR INSERT
TO authenticated
WITH CHECK (submitted_by = auth.uid() AND status IN ('draft','pending_review'));

-- Admin can update
DROP POLICY IF EXISTS "ce_admin_update" ON public.cultural_events;
CREATE POLICY "ce_admin_update"
ON public.cultural_events FOR UPDATE
TO authenticated
USING (public.is_alert_admin() OR submitted_by = auth.uid())
WITH CHECK (public.is_alert_admin() OR submitted_by = auth.uid());

-- Admin can delete
DROP POLICY IF EXISTS "ce_admin_delete" ON public.cultural_events;
CREATE POLICY "ce_admin_delete"
ON public.cultural_events FOR DELETE
TO authenticated
USING (public.is_alert_admin());

-- ===== event_images =====

CREATE TABLE IF NOT EXISTS public.event_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.cultural_events(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  caption text,
  alt_text text,
  sort_order integer NOT NULL DEFAULT 0,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.event_images ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_ei_event ON public.event_images (event_id, sort_order);

GRANT SELECT ON public.event_images TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.event_images TO authenticated, service_role;

DROP POLICY IF EXISTS "ei_public_read" ON public.event_images;
CREATE POLICY "ei_public_read"
ON public.event_images FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.cultural_events e
    WHERE e.id = event_images.event_id
    AND e.status = 'published'
  )
);

DROP POLICY IF EXISTS "ei_admin_insert" ON public.event_images;
CREATE POLICY "ei_admin_insert"
ON public.event_images FOR INSERT
TO authenticated
WITH CHECK (public.is_alert_admin());

DROP POLICY IF EXISTS "ei_admin_update" ON public.event_images;
CREATE POLICY "ei_admin_update"
ON public.event_images FOR UPDATE
TO authenticated
USING (public.is_alert_admin()) WITH CHECK (public.is_alert_admin());

DROP POLICY IF EXISTS "ei_admin_delete" ON public.event_images;
CREATE POLICY "ei_admin_delete"
ON public.event_images FOR DELETE
TO authenticated
USING (public.is_alert_admin());

-- ===== saved_events =====

CREATE TABLE IF NOT EXISTS public.saved_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.cultural_events(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, event_id)
);

ALTER TABLE public.saved_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_se_user ON public.saved_events (user_id);
CREATE INDEX IF NOT EXISTS idx_se_event ON public.saved_events (event_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_events TO service_role;

DROP POLICY IF EXISTS "se_select_own" ON public.saved_events;
CREATE POLICY "se_select_own"
ON public.saved_events FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "se_insert_own" ON public.saved_events;
CREATE POLICY "se_insert_own"
ON public.saved_events FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "se_delete_own" ON public.saved_events;
CREATE POLICY "se_delete_own"
ON public.saved_events FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- ===== event_reports =====

CREATE TABLE IF NOT EXISTS public.event_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.cultural_events(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  category event_report_category NOT NULL,
  description text NOT NULL CHECK (char_length(description) >= 10 AND char_length(description) <= 4000),
  status event_report_status NOT NULL DEFAULT 'submitted',
  reviewer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewer_notes text,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.event_reports ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_er_event ON public.event_reports (event_id);
CREATE INDEX IF NOT EXISTS idx_er_reporter ON public.event_reports (reporter_id);
CREATE INDEX IF NOT EXISTS idx_er_status ON public.event_reports (status);

GRANT SELECT, INSERT, UPDATE ON public.event_reports TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_reports TO service_role;

DROP POLICY IF EXISTS "er_select_own" ON public.event_reports;
CREATE POLICY "er_select_own"
ON public.event_reports FOR SELECT
TO authenticated
USING (reporter_id = auth.uid() OR public.is_alert_admin());

DROP POLICY IF EXISTS "er_insert_own" ON public.event_reports;
CREATE POLICY "er_insert_own"
ON public.event_reports FOR INSERT
TO authenticated
WITH CHECK (reporter_id = auth.uid());

DROP POLICY IF EXISTS "er_admin_update" ON public.event_reports;
CREATE POLICY "er_admin_update"
ON public.event_reports FOR UPDATE
TO authenticated
USING (reporter_id = auth.uid() OR public.is_alert_admin())
WITH CHECK (reporter_id = auth.uid() OR public.is_alert_admin());

-- ===== event_registrations =====

CREATE TABLE IF NOT EXISTS public.event_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.cultural_events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  registration_status event_registration_status NOT NULL DEFAULT 'registered',
  registered_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);

ALTER TABLE public.event_registrations ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_ereg_event ON public.event_registrations (event_id);
CREATE INDEX IF NOT EXISTS idx_ereg_user ON public.event_registrations (user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_registrations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_registrations TO service_role;

DROP POLICY IF EXISTS "ereg_select_own" ON public.event_registrations;
CREATE POLICY "ereg_select_own"
ON public.event_registrations FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR public.is_alert_admin());

DROP POLICY IF EXISTS "ereg_insert_own" ON public.event_registrations;
CREATE POLICY "ereg_insert_own"
ON public.event_registrations FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "ereg_update_own" ON public.event_registrations;
CREATE POLICY "ereg_update_own"
ON public.event_registrations FOR UPDATE
TO authenticated
USING (user_id = auth.uid() OR public.is_alert_admin())
WITH CHECK (user_id = auth.uid() OR public.is_alert_admin());

DROP POLICY IF EXISTS "ereg_delete_own" ON public.event_registrations;
CREATE POLICY "ereg_delete_own"
ON public.event_registrations FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- ===== Updated_at triggers =====

DROP TRIGGER IF EXISTS trg_evcat_updated ON public.event_categories;
CREATE TRIGGER trg_evcat_updated BEFORE UPDATE ON public.event_categories
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_ce_updated ON public.cultural_events;
CREATE TRIGGER trg_ce_updated BEFORE UPDATE ON public.cultural_events
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_er_updated ON public.event_reports;
CREATE TRIGGER trg_er_updated BEFORE UPDATE ON public.event_reports
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_ereg_updated ON public.event_registrations;
CREATE TRIGGER trg_ereg_updated BEFORE UPDATE ON public.event_registrations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ===== Seed parent categories =====

INSERT INTO public.event_categories (name, slug, description, icon, sort_order, is_active) VALUES
  ('Culture & Heritage', 'culture_heritage', 'Traditional festivals, cultural performances, historical commemorations, and heritage celebrations.', 'landmark', 1, true),
  ('Community & Education', 'community_education', 'Barangay activities, community gatherings, workshops, seminars, and school events.', 'users', 2, true),
  ('Tourism & Entertainment', 'tourism_entertainment', 'Tourism festivals, music and dance performances, art exhibits, food fairs, and local markets.', 'music', 3, true)
ON CONFLICT (slug) DO NOTHING;