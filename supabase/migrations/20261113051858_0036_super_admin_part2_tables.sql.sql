/*
# Super Admin Control Center — Part 2: admin tables with RLS

1. Purpose
Tables backing the Super Admin control center modules: role grant history,
registration review, site settings, media library, CMS pages, announcements,
user notifications, moderation reports, and login auditing.

2. New Tables
- admin_roles: one row per user/role grant or revoke, with who acted and when.
- user_registrations: one row per sign-up for the registration review center.
- site_settings: key/value website configuration; public read, admin write.
- media_assets: catalog of Storage files (photo/video/document) with publish
  and feature flags.
- content_pages: CMS pages with draft/published/archived lifecycle.
- announcements: global or targeted notices; public read of published rows.
- user_notifications: per-user notification inbox; own rows only.
- moderation_reports: reports against users or media with status tracking.
- login_audit: sign-in attempts; admins read all, users insert their own.

3. Security changes
- RLS enabled on every table. Policies call the is_* functions from Part 1 so
  role checks happen inside the database.
- Public (anon) read access only on: site_settings, published content_pages,
  published announcements, published media_assets.
- All writes require admin/super admin per policy; no anon writes anywhere.
- Grants follow least privilege and match the app's actual queries.
*/

-- admin_roles ---------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.admin_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('super_admin', 'admin', 'moderator')),
  granted boolean NOT NULL DEFAULT true,
  granted_by uuid REFERENCES auth.users(id),
  granted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.admin_roles ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.admin_roles TO authenticated;

DROP POLICY IF EXISTS "admins_read_admin_roles" ON public.admin_roles;
CREATE POLICY "admins_read_admin_roles"
ON public.admin_roles FOR SELECT
TO authenticated
USING (public.is_admin());

-- user_registrations ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.user_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'flagged')),
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  decision_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_registrations ENABLE ROW LEVEL SECURITY;

GRANT SELECT, UPDATE ON public.user_registrations TO authenticated;

DROP POLICY IF EXISTS "admins_read_registrations" ON public.user_registrations;
CREATE POLICY "admins_read_registrations"
ON public.user_registrations FOR SELECT
TO authenticated
USING (public.is_admin() OR auth.uid() = user_id);

DROP POLICY IF EXISTS "admins_update_registrations" ON public.user_registrations;
CREATE POLICY "admins_update_registrations"
ON public.user_registrations FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- site_settings ---------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.site_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid REFERENCES auth.users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.site_settings TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.site_settings TO authenticated;

DROP POLICY IF EXISTS "public_read_settings" ON public.site_settings;
CREATE POLICY "public_read_settings"
ON public.site_settings FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "admins_insert_settings" ON public.site_settings;
CREATE POLICY "admins_insert_settings"
ON public.site_settings FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admins_update_settings" ON public.site_settings;
CREATE POLICY "admins_update_settings"
ON public.site_settings FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "super_admins_delete_settings" ON public.site_settings;
CREATE POLICY "super_admins_delete_settings"
ON public.site_settings FOR DELETE
TO authenticated
USING (public.is_super_admin());

-- media_assets -----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.media_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket text NOT NULL DEFAULT 'admin-media',
  storage_path text NOT NULL UNIQUE,
  media_type text NOT NULL CHECK (media_type IN ('photo', 'video', 'document')),
  title text NOT NULL,
  alt_text text,
  description text,
  album text,
  mime_type text,
  size_bytes bigint,
  is_featured boolean NOT NULL DEFAULT false,
  is_published boolean NOT NULL DEFAULT false,
  uploaded_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.media_assets TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.media_assets TO authenticated;

DROP POLICY IF EXISTS "read_media_assets" ON public.media_assets;
CREATE POLICY "read_media_assets"
ON public.media_assets FOR SELECT
TO anon, authenticated
USING (
  is_published = true
  OR public.is_admin()
);

DROP POLICY IF EXISTS "admins_insert_media" ON public.media_assets;
CREATE POLICY "admins_insert_media"
ON public.media_assets FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admins_update_media" ON public.media_assets;
CREATE POLICY "admins_update_media"
ON public.media_assets FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "super_admins_delete_media" ON public.media_assets;
CREATE POLICY "super_admins_delete_media"
ON public.media_assets FOR DELETE
TO authenticated
USING (public.is_super_admin());

-- content_pages -----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.content_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  content text,
  excerpt text,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'archived')),
  publish_at timestamptz,
  hero_image_path text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.content_pages ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.content_pages TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.content_pages TO authenticated;

DROP POLICY IF EXISTS "read_content_pages" ON public.content_pages;
CREATE POLICY "read_content_pages"
ON public.content_pages FOR SELECT
TO anon, authenticated
USING (
  status = 'published'
  OR public.is_admin()
);

DROP POLICY IF EXISTS "admins_insert_pages" ON public.content_pages;
CREATE POLICY "admins_insert_pages"
ON public.content_pages FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admins_update_pages" ON public.content_pages;
CREATE POLICY "admins_update_pages"
ON public.content_pages FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "super_admins_delete_pages" ON public.content_pages;
CREATE POLICY "super_admins_delete_pages"
ON public.content_pages FOR DELETE
TO authenticated
USING (public.is_super_admin());

-- announcements -------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  audience text NOT NULL DEFAULT 'all'
    CHECK (audience IN ('all', 'authenticated', 'selected')),
  selected_user_ids uuid[] DEFAULT '{}',
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'archived')),
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.announcements TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.announcements TO authenticated;

DROP POLICY IF EXISTS "read_announcements" ON public.announcements;
CREATE POLICY "read_announcements"
ON public.announcements FOR SELECT
TO anon, authenticated
USING (
  status = 'published'
  OR public.is_admin()
);

DROP POLICY IF EXISTS "admins_insert_announcements" ON public.announcements;
CREATE POLICY "admins_insert_announcements"
ON public.announcements FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admins_update_announcements" ON public.announcements;
CREATE POLICY "admins_update_announcements"
ON public.announcements FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "super_admins_delete_announcements" ON public.announcements;
CREATE POLICY "super_admins_delete_announcements"
ON public.announcements FOR DELETE
TO authenticated
USING (public.is_super_admin());

-- user_notifications ----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.user_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  announcement_id uuid REFERENCES public.announcements(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;

GRANT SELECT, UPDATE ON public.user_notifications TO authenticated;

DROP POLICY IF EXISTS "read_own_notifications" ON public.user_notifications;
CREATE POLICY "read_own_notifications"
ON public.user_notifications FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "mark_own_notifications_read" ON public.user_notifications;
CREATE POLICY "mark_own_notifications_read"
ON public.user_notifications FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- moderation_reports ------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.moderation_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid REFERENCES auth.users(id),
  target_user_id uuid REFERENCES auth.users(id),
  target_media_id uuid REFERENCES public.media_assets(id),
  reason text NOT NULL CHECK (reason IN (
    'inappropriate_content', 'spam', 'suspicious_activity',
    'policy_violation', 'harassment', 'other'
  )),
  description text NOT NULL,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'investigating', 'resolved', 'dismissed')),
  internal_notes text,
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.moderation_reports ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.moderation_reports TO authenticated;

DROP POLICY IF EXISTS "read_moderation_reports" ON public.moderation_reports;
CREATE POLICY "read_moderation_reports"
ON public.moderation_reports FOR SELECT
TO authenticated
USING (public.is_moderator() OR auth.uid() = reporter_id);

DROP POLICY IF EXISTS "submit_moderation_report" ON public.moderation_reports;
CREATE POLICY "submit_moderation_report"
ON public.moderation_reports FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = reporter_id);

DROP POLICY IF EXISTS "moderators_update_reports" ON public.moderation_reports;
CREATE POLICY "moderators_update_reports"
ON public.moderation_reports FOR UPDATE
TO authenticated
USING (public.is_moderator())
WITH CHECK (public.is_moderator());

-- login_audit ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.login_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  email text,
  success boolean NOT NULL,
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.login_audit ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON public.login_audit TO authenticated;

DROP POLICY IF EXISTS "admins_read_login_audit" ON public.login_audit;
CREATE POLICY "admins_read_login_audit"
ON public.login_audit FOR SELECT
TO authenticated
USING (public.is_admin());

DROP POLICY IF EXISTS "insert_own_login_audit" ON public.login_audit;
CREATE POLICY "insert_own_login_audit"
ON public.login_audit FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);
