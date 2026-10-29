/*
# Feature 19: Explore Marinduque — Tourism and Local Discovery

## Overview
Adds a tourism and local discovery system for MoryonGo, letting users browse
verified destinations across Marinduque's six municipalities. The existing
`locations` table stores geographic data; these new tables add destination-
specific content (description, images, categories, fees, hours, amenities) on
top of location references. The existing `saved_places` feature is reused for
favorites — no duplicate favorites table.

## 1. New Enums
- destination_verification: unverified, pending_review, verified, rejected, needs_update
- destination_report_category: incorrect_address, incorrect_hours, outdated_fees,
  inaccurate_description, closed_destination, inappropriate_content, other_concern
- destination_report_status: submitted, under_review, resolved, rejected

## 2. New Tables

### explore_categories
Flexible category system with optional parent-child hierarchy.
- id, name, slug (unique), description, icon, parent_id (self-ref, no cycles),
  sort_order, is_active, created_at, updated_at
- Seeded with parent categories: nature_outdoor, historical_cultural, food_dining,
  accommodation_recreation, other_places

### destinations
Main destination content table.
- id, location_id (FK locations, nullable), name, slug (unique), description,
  category_id (FK explore_categories), municipality (CHECK in 6 municipalities),
  address, latitude, longitude, cover_image_path, entrance_fee, currency,
  opening_hours (jsonb), contact_information, official_website, amenities (jsonb),
  accessibility_information (jsonb), verification_status, verified_by (FK auth.users),
  verified_at, is_featured, is_published, created_by (FK auth.users), created_at, updated_at

### destination_images
Gallery images for destinations.
- id, destination_id (FK destinations CASCADE), storage_path, caption, alt_text,
  sort_order, uploaded_by (FK auth.users), verification_status, created_at

### destination_reports
User-submitted corrections for destination information.
- id, destination_id (FK destinations CASCADE), reporter_id (DEFAULT auth.uid()),
  category, description, status, reviewer_id (FK auth.users), reviewer_notes,
  resolved_at, created_at, updated_at

## 3. Security (RLS)

### explore_categories
- Public read (anon + authenticated) for active categories.
- Admin write (is_alert_admin() reuses the community_reviewer flag).

### destinations
- Public read: only is_published = true AND verification_status IN ('verified','pending_review')
  (pending_review visible but labeled; unverified/rejected/needs_update NOT public).
- Admin full CRUD via is_alert_admin().
- service_role full access.

### destination_images
- Public read for published destinations' images.
- Admin write via is_alert_admin().
- service_role full access.

### destination_reports
- Users can INSERT their own reports (reporter_id = auth.uid()).
- Users can SELECT their own reports.
- Admin can SELECT all + UPDATE for review.
- service_role full access.

## 4. Notes
- is_alert_admin() SECURITY DEFINER function from Feature 18 is reused for admin auth.
- No fabricated destinations are seeded — the system starts empty.
- The existing saved_places table is reused for favorites (no duplicate system).
- Parent category self-reference has a CHECK to prevent self-referencing.
*/

-- ===== Enums =====

DO $$ BEGIN
  CREATE TYPE destination_verification AS ENUM (
    'unverified','pending_review','verified','rejected','needs_update'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE destination_report_category AS ENUM (
    'incorrect_address','incorrect_hours','outdated_fees',
    'inaccurate_description','closed_destination','inappropriate_content','other_concern'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE destination_report_status AS ENUM (
    'submitted','under_review','resolved','rejected'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ===== explore_categories =====

CREATE TABLE IF NOT EXISTS public.explore_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  icon text,
  parent_id uuid REFERENCES public.explore_categories(id) ON DELETE SET NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ec_no_self_ref CHECK (id IS NULL OR parent_id IS NULL OR parent_id <> id)
);

ALTER TABLE public.explore_categories ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_ec_parent ON public.explore_categories (parent_id);
CREATE INDEX IF NOT EXISTS idx_ec_active ON public.explore_categories (is_active, sort_order);

GRANT SELECT ON public.explore_categories TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.explore_categories TO authenticated, service_role;

DROP POLICY IF EXISTS "ec_public_read" ON public.explore_categories;
CREATE POLICY "ec_public_read"
ON public.explore_categories FOR SELECT
TO anon, authenticated USING (is_active = true);

DROP POLICY IF EXISTS "ec_admin_write" ON public.explore_categories;
CREATE POLICY "ec_admin_write"
ON public.explore_categories FOR INSERT
TO authenticated WITH CHECK (public.is_alert_admin());

DROP POLICY IF EXISTS "ec_admin_update" ON public.explore_categories;
CREATE POLICY "ec_admin_update"
ON public.explore_categories FOR UPDATE
TO authenticated USING (public.is_alert_admin()) WITH CHECK (public.is_alert_admin());

DROP POLICY IF EXISTS "ec_admin_delete" ON public.explore_categories;
CREATE POLICY "ec_admin_delete"
ON public.explore_categories FOR DELETE
TO authenticated USING (public.is_alert_admin());

-- ===== destinations =====

CREATE TABLE IF NOT EXISTS public.destinations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  name text NOT NULL CHECK (char_length(name) >= 3 AND char_length(name) <= 200),
  slug text NOT NULL UNIQUE,
  description text,
  category_id uuid REFERENCES public.explore_categories(id) ON DELETE SET NULL,
  municipality text CHECK (municipality IS NULL OR municipality IN ('Boac','Buenavista','Gasan','Mogpog','Santa Cruz','Torrijos')),
  address text,
  latitude double precision CHECK (latitude IS NULL OR (latitude >= -90 AND latitude <= 90)),
  longitude double precision CHECK (longitude IS NULL OR (longitude >= -180 AND longitude <= 180)),
  cover_image_path text,
  entrance_fee text,
  currency text DEFAULT 'PHP',
  opening_hours jsonb,
  contact_information text,
  official_website text,
  amenities jsonb,
  accessibility_information jsonb,
  verification_status destination_verification NOT NULL DEFAULT 'unverified',
  verified_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  verified_at timestamptz,
  is_featured boolean NOT NULL DEFAULT false,
  is_published boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.destinations ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_dest_category ON public.destinations (category_id);
CREATE INDEX IF NOT EXISTS idx_dest_municipality ON public.destinations (municipality);
CREATE INDEX IF NOT EXISTS idx_dest_published ON public.destinations (is_published, verification_status);
CREATE INDEX IF NOT EXISTS idx_dest_featured ON public.destinations (is_featured);
CREATE INDEX IF NOT EXISTS idx_dest_slug ON public.destinations (slug);

GRANT SELECT ON public.destinations TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.destinations TO authenticated, service_role;

-- Public reads: published + (verified or pending_review)
DROP POLICY IF EXISTS "dest_public_read" ON public.destinations;
CREATE POLICY "dest_public_read"
ON public.destinations FOR SELECT
TO anon, authenticated
USING (
  is_published = true
  AND verification_status IN ('verified','pending_review')
);

-- Admin can read all
DROP POLICY IF EXISTS "dest_admin_read_all" ON public.destinations;
CREATE POLICY "dest_admin_read_all"
ON public.destinations FOR SELECT
TO authenticated
USING (public.is_alert_admin());

-- Admin can insert
DROP POLICY IF EXISTS "dest_admin_insert" ON public.destinations;
CREATE POLICY "dest_admin_insert"
ON public.destinations FOR INSERT
TO authenticated
WITH CHECK (public.is_alert_admin());

-- Admin can update
DROP POLICY IF EXISTS "dest_admin_update" ON public.destinations;
CREATE POLICY "dest_admin_update"
ON public.destinations FOR UPDATE
TO authenticated
USING (public.is_alert_admin()) WITH CHECK (public.is_alert_admin());

-- Admin can delete
DROP POLICY IF EXISTS "dest_admin_delete" ON public.destinations;
CREATE POLICY "dest_admin_delete"
ON public.destinations FOR DELETE
TO authenticated
USING (public.is_alert_admin());

-- ===== destination_images =====

CREATE TABLE IF NOT EXISTS public.destination_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  destination_id uuid NOT NULL REFERENCES public.destinations(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  caption text,
  alt_text text,
  sort_order integer NOT NULL DEFAULT 0,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  verification_status destination_verification NOT NULL DEFAULT 'unverified',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.destination_images ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_di_destination ON public.destination_images (destination_id, sort_order);

GRANT SELECT ON public.destination_images TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.destination_images TO authenticated, service_role;

-- Public can read images for published destinations
DROP POLICY IF EXISTS "di_public_read" ON public.destination_images;
CREATE POLICY "di_public_read"
ON public.destination_images FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.destinations d
    WHERE d.id = destination_images.destination_id
    AND d.is_published = true
  )
);

-- Admin can insert images
DROP POLICY IF EXISTS "di_admin_insert" ON public.destination_images;
CREATE POLICY "di_admin_insert"
ON public.destination_images FOR INSERT
TO authenticated
WITH CHECK (public.is_alert_admin());

-- Admin can update images
DROP POLICY IF EXISTS "di_admin_update" ON public.destination_images;
CREATE POLICY "di_admin_update"
ON public.destination_images FOR UPDATE
TO authenticated
USING (public.is_alert_admin()) WITH CHECK (public.is_alert_admin());

-- Admin can delete images
DROP POLICY IF EXISTS "di_admin_delete" ON public.destination_images;
CREATE POLICY "di_admin_delete"
ON public.destination_images FOR DELETE
TO authenticated
USING (public.is_alert_admin());

-- ===== destination_reports =====

CREATE TABLE IF NOT EXISTS public.destination_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  destination_id uuid NOT NULL REFERENCES public.destinations(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  category destination_report_category NOT NULL,
  description text NOT NULL CHECK (char_length(description) >= 10 AND char_length(description) <= 4000),
  status destination_report_status NOT NULL DEFAULT 'submitted',
  reviewer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewer_notes text,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.destination_reports ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_dr_destination ON public.destination_reports (destination_id);
CREATE INDEX IF NOT EXISTS idx_dr_reporter ON public.destination_reports (reporter_id);
CREATE INDEX IF NOT EXISTS idx_dr_status ON public.destination_reports (status);

GRANT SELECT, INSERT, UPDATE ON public.destination_reports TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.destination_reports TO service_role;

-- Users can see their own reports
DROP POLICY IF EXISTS "dr_select_own" ON public.destination_reports;
CREATE POLICY "dr_select_own"
ON public.destination_reports FOR SELECT
TO authenticated
USING (reporter_id = auth.uid() OR public.is_alert_admin());

-- Users can insert their own reports
DROP POLICY IF EXISTS "dr_insert_own" ON public.destination_reports;
CREATE POLICY "dr_insert_own"
ON public.destination_reports FOR INSERT
TO authenticated
WITH CHECK (reporter_id = auth.uid());

-- Admin can update (review) reports
DROP POLICY IF EXISTS "dr_admin_update" ON public.destination_reports;
CREATE POLICY "dr_admin_update"
ON public.destination_reports FOR UPDATE
TO authenticated
USING (reporter_id = auth.uid() OR public.is_alert_admin())
WITH CHECK (reporter_id = auth.uid() OR public.is_alert_admin());

-- ===== Updated_at triggers =====

DROP TRIGGER IF EXISTS trg_ec_updated ON public.explore_categories;
CREATE TRIGGER trg_ec_updated BEFORE UPDATE ON public.explore_categories
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_dest_updated ON public.destinations;
CREATE TRIGGER trg_dest_updated BEFORE UPDATE ON public.destinations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_dr_updated ON public.destination_reports;
CREATE TRIGGER trg_dr_updated BEFORE UPDATE ON public.destination_reports
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ===== Seed parent categories =====

INSERT INTO public.explore_categories (name, slug, description, icon, sort_order, is_active) VALUES
  ('Nature & Outdoor', 'nature_outdoor', 'Beaches, waterfalls, mountains, caves, and outdoor adventures.', 'palmtree', 1, true),
  ('Historical & Cultural', 'historical_cultural', 'Historical landmarks, museums, churches, and heritage sites.', 'landmark', 2, true),
  ('Food & Dining', 'food_dining', 'Restaurants, cafes, local eateries, and food destinations.', 'utensils', 3, true),
  ('Accommodation & Recreation', 'accommodation_recreation', 'Hotels, resorts, parks, and family recreation.', 'bed', 4, true),
  ('Other Places', 'other_places', 'Visitor centers, tourism offices, and public facilities.', 'map', 5, true)
ON CONFLICT (slug) DO NOTHING;