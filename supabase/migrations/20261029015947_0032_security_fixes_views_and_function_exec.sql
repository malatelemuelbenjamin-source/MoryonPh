/*
# Security Fixes: SECURITY DEFINER Views and Function EXECUTE Permissions

## 1. Views Fixed
- `community_report_status_timeline`: Recreated as security_invoker view.
- `fare_concern_status_timeline`: Same fix.

## 2. Functions: REVOKE EXECUTE from PUBLIC/anon
Trigger functions should not be callable as RPCs. Trigger execution is unaffected.
*/

-- Fix 1: Recreate views with security_invoker = true
DROP VIEW IF EXISTS community_report_status_timeline;
DROP VIEW IF EXISTS fare_concern_status_timeline;

CREATE VIEW community_report_status_timeline AS
 SELECT id,
    report_id,
    action,
    previous_status,
    new_status,
    created_at
   FROM community_report_audit_logs a
  WHERE (action = ANY (ARRAY['submitted'::community_report_audit_action, 'marked_under_review'::community_report_audit_action, 'requested_info'::community_report_audit_action, 'resolved'::community_report_audit_action, 'rejected'::community_report_audit_action, 'forwarded_to_verification'::community_report_audit_action, 'reporter_followed_up'::community_report_audit_action]));

ALTER VIEW community_report_status_timeline SET (security_invoker = true);
GRANT SELECT ON community_report_status_timeline TO authenticated;

CREATE VIEW fare_concern_status_timeline AS
 SELECT id,
    report_id,
    action,
    previous_status,
    new_status,
    created_at
   FROM fare_concern_audit_logs a
  WHERE (action = ANY (ARRAY['submitted'::fare_concern_audit_action, 'marked_under_review'::fare_concern_audit_action, 'requested_info'::fare_concern_audit_action, 'resolved'::fare_concern_audit_action, 'rejected'::fare_concern_audit_action, 'closed'::fare_concern_audit_action, 'forwarded_to_verification'::fare_concern_audit_action, 'reporter_followed_up'::fare_concern_audit_action]));

ALTER VIEW fare_concern_status_timeline SET (security_invoker = true);
GRANT SELECT ON fare_concern_status_timeline TO authenticated;

-- Fix 2: Revoke EXECUTE on trigger/internal functions from PUBLIC and anon
REVOKE EXECUTE ON FUNCTION update_updated_at_column() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION update_updated_at_column() FROM anon;

REVOKE EXECUTE ON FUNCTION touch_trip_history_updated_at() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION touch_trip_history_updated_at() FROM anon;

REVOKE EXECUTE ON FUNCTION community_report_comment_audit() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION community_report_comment_audit() FROM anon;

REVOKE EXECUTE ON FUNCTION community_report_write_audit() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION community_report_write_audit() FROM anon;

REVOKE EXECUTE ON FUNCTION fare_concern_comment_audit() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION fare_concern_comment_audit() FROM anon;

REVOKE EXECUTE ON FUNCTION fare_concern_write_audit() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION fare_concern_write_audit() FROM anon;
