/*
# Super Admin Control Center — Part 4: media storage bucket

1. Purpose
Create the admin-media storage bucket for photos, videos, and documents
managed through the Super Admin media library, with storage policies that
mirror the media_assets table rules: admins manage everything, public reads
published files.

2. Security changes
- Bucket admin-media is public-read (published media is served on the site).
- INSERT/UPDATE/DELETE restricted to admin (is_admin()) via storage.policies.
- Public SELECT allowed so published photos/videos render on the site.

3. Notes
- No table data is touched. The bucket id must match the media_assets.bucket
  default value ('admin-media').
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('admin-media', 'admin-media', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "admin_media_read" ON storage.objects;
CREATE POLICY "admin_media_read"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'admin-media');

DROP POLICY IF EXISTS "admin_media_insert" ON storage.objects;
CREATE POLICY "admin_media_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'admin-media' AND public.is_admin());

DROP POLICY IF EXISTS "admin_media_update" ON storage.objects;
CREATE POLICY "admin_media_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'admin-media' AND public.is_admin())
WITH CHECK (bucket_id = 'admin-media' AND public.is_admin());

DROP POLICY IF EXISTS "admin_media_delete" ON storage.objects;
CREATE POLICY "admin_media_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'admin-media' AND public.is_super_admin());
