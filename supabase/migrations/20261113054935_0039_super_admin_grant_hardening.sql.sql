/*
# Super admin grant hardening

1. Purpose
- Remove privileges that were granted wider than the policies require, so the database only allows what the app needs.

2. Changes
- `anon` keeps SELECT only on the public content tables: site_settings, content_pages, media_assets, announcements.
- `anon` loses all privileges on admin_roles, user_registrations, login_audit, moderation_reports, user_notifications.
- `anon` loses INSERT/UPDATE/DELETE on the public content tables above.
- `authenticated` loses INSERT/UPDATE/DELETE on admin_roles. Admin roles are only changed through the set_user_role function.

3. Security
- RLS policies are unchanged. These revokes only remove grants that no policy uses.
- Every statement is idempotent (REVOKE of a missing grant is a no-op).

4. Notes
- No data is modified or deleted.
*/

REVOKE INSERT, UPDATE, DELETE ON site_settings FROM anon;
REVOKE INSERT, UPDATE, DELETE ON content_pages FROM anon;
REVOKE INSERT, UPDATE, DELETE ON media_assets FROM anon;
REVOKE INSERT, UPDATE, DELETE ON announcements FROM anon;

REVOKE ALL ON admin_roles FROM anon;
REVOKE ALL ON user_registrations FROM anon;
REVOKE ALL ON login_audit FROM anon;
REVOKE ALL ON moderation_reports FROM anon;
REVOKE ALL ON user_notifications FROM anon;

REVOKE INSERT, UPDATE, DELETE ON admin_roles FROM authenticated;
