/*
# Performance: Add Indexes for Unindexed Foreign Keys

## Purpose
The Supabase performance advisor identified 95 foreign key constraints without
covering indexes. This migration creates indexes for all of them to improve
query performance for common operations like joins, filters by municipality,
user-scoped queries, and status lookups.

## Indexes Created
Indexes are created on the FK column(s) of each table. All indexes use
CONCURRENTLY-safe creation (IF NOT EXISTS) and are non-unique since FKs
are not unique by definition.

## Tables Covered (by category)
- Community reports: attachments, audit_logs, comments, transport_reports
- Fare concerns: attachments, audit_logs, comments, reports
- Fare system: fare_discounts, fare_matrices, fare_matrix_audit_logs,
  fare_update_audit_logs, fare_update_subscriptions, fare_updates, fares
- Cultural events: events, event_images, event_reports
- Destinations: destinations, destination_images, destination_reports
- Transport: transport_alerts, transport_alert_audit_logs, transport_alert_subscriptions,
  transport_operators, transport_operator_audit_logs, transport_service_submissions
- Tricycle: fare_zones, service_areas, zone_connections
- Routes: routes, saved_routes, saved_route_segments
- Tourist: itineraries, itinerary_stops, itinerary_legs, itinerary_expenses
- Trip cost: estimates, items
- Trip history: main, segments
- Saved places, recent searches, local alerts, ports, data verification, users

All indexes are IF NOT EXISTS so re-running is safe.
*/

-- Community reports
CREATE INDEX IF NOT EXISTS idx_cra_uploaded_by ON community_report_attachments(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_cral_actor_id ON community_report_audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_crc_author_id ON community_report_comments(author_id);
CREATE INDEX IF NOT EXISTS idx_ctr_location_id ON community_transport_reports(location_id);
CREATE INDEX IF NOT EXISTS idx_ctr_reviewer_id ON community_transport_reports(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_ctr_route_id ON community_transport_reports(route_id);
CREATE INDEX IF NOT EXISTS idx_ctr_transport_mode_id ON community_transport_reports(transport_mode_id);

-- Fare concerns
CREATE INDEX IF NOT EXISTS idx_fca_uploaded_by ON fare_concern_attachments(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_fcal_actor_id ON fare_concern_audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_fcc_author_id ON fare_concern_comments(author_id);
CREATE INDEX IF NOT EXISTS idx_fcr_boarding_location_id ON fare_concern_reports(boarding_location_id);
CREATE INDEX IF NOT EXISTS idx_fcr_destination_location_id ON fare_concern_reports(destination_location_id);
CREATE INDEX IF NOT EXISTS idx_fcr_reviewer_id ON fare_concern_reports(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_fcr_route_id ON fare_concern_reports(route_id);
CREATE INDEX IF NOT EXISTS idx_fcr_transport_mode_id ON fare_concern_reports(transport_mode_id);

-- Fare system
CREATE INDEX IF NOT EXISTS idx_fd_passenger_category_id ON fare_discounts(passenger_category_id);
CREATE INDEX IF NOT EXISTS idx_fm_created_by ON fare_matrices(created_by);
CREATE INDEX IF NOT EXISTS idx_fmal_performed_by ON fare_matrix_audit_logs(performed_by);
CREATE INDEX IF NOT EXISTS idx_fual_performed_by ON fare_update_audit_logs(performed_by);
CREATE INDEX IF NOT EXISTS idx_fus_location_id ON fare_update_subscriptions(location_id);
CREATE INDEX IF NOT EXISTS idx_fus_transport_mode_id ON fare_update_subscriptions(transport_mode_id);
CREATE INDEX IF NOT EXISTS idx_fu_created_by ON fare_updates(created_by);
CREATE INDEX IF NOT EXISTS idx_fu_previous_fare_id ON fare_updates(previous_fare_id);
CREATE INDEX IF NOT EXISTS idx_fu_verified_by ON fare_updates(verified_by);
CREATE INDEX IF NOT EXISTS idx_fares_created_by ON fares(created_by);

-- Cultural events
CREATE INDEX IF NOT EXISTS idx_ce_location_id ON cultural_events(location_id);
CREATE INDEX IF NOT EXISTS idx_ce_reviewed_by ON cultural_events(reviewed_by);
CREATE INDEX IF NOT EXISTS idx_ce_submitted_by ON cultural_events(submitted_by);
CREATE INDEX IF NOT EXISTS idx_ei_uploaded_by ON event_images(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_er_reviewer_id ON event_reports(reviewer_id);

-- Destinations
CREATE INDEX IF NOT EXISTS idx_di_uploaded_by ON destination_images(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_dr_reviewer_id ON destination_reports(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_dest_created_by ON destinations(created_by);
CREATE INDEX IF NOT EXISTS idx_dest_location_id ON destinations(location_id);
CREATE INDEX IF NOT EXISTS idx_dest_verified_by ON destinations(verified_by);

-- Data verification
CREATE INDEX IF NOT EXISTS idx_drv_published_by ON data_record_versions(published_by);
CREATE INDEX IF NOT EXISTS idx_ve_reviewed_by ON verification_evidence(reviewed_by);
CREATE INDEX IF NOT EXISTS idx_ve_submitted_by ON verification_evidence(submitted_by);

-- Local alerts
CREATE INDEX IF NOT EXISTS idx_la_affected_location_id ON local_alerts(affected_location_id);
CREATE INDEX IF NOT EXISTS idx_la_created_by ON local_alerts(created_by);

-- Ports
CREATE INDEX IF NOT EXISTS idx_ports_verified_by ON ports(verified_by);

-- Recent searches
CREATE INDEX IF NOT EXISTS idx_rs_location_id ON recent_searches(location_id);

-- Routes
CREATE INDEX IF NOT EXISTS idx_routes_created_by ON routes(created_by);

-- Saved places
CREATE INDEX IF NOT EXISTS idx_sp_location_id ON saved_places(location_id);

-- Saved routes
CREATE INDEX IF NOT EXISTS idx_srs_destination_location_id ON saved_route_segments(destination_location_id);
CREATE INDEX IF NOT EXISTS idx_srs_origin_location_id ON saved_route_segments(origin_location_id);
CREATE INDEX IF NOT EXISTS idx_srs_route_id ON saved_route_segments(route_id);
CREATE INDEX IF NOT EXISTS idx_srs_transport_mode_id ON saved_route_segments(transport_mode_id);
CREATE INDEX IF NOT EXISTS idx_sr_preferred_transport_mode_id ON saved_routes(preferred_transport_mode_id);
CREATE INDEX IF NOT EXISTS idx_sr_transport_mode_id ON saved_routes(transport_mode_id);

-- Tourist itineraries
CREATE INDEX IF NOT EXISTS idx_ti_starting_location_id ON tourist_itineraries(starting_location_id);
CREATE INDEX IF NOT EXISTS idx_tie_stop_id ON tourist_itinerary_expenses(stop_id);
CREATE INDEX IF NOT EXISTS idx_til_from_stop_id ON tourist_itinerary_legs(from_stop_id);
CREATE INDEX IF NOT EXISTS idx_til_route_id ON tourist_itinerary_legs(route_id);
CREATE INDEX IF NOT EXISTS idx_til_to_stop_id ON tourist_itinerary_legs(to_stop_id);
CREATE INDEX IF NOT EXISTS idx_til_transport_mode_id ON tourist_itinerary_legs(transport_mode_id);
CREATE INDEX IF NOT EXISTS idx_tis_destination_id ON tourist_itinerary_stops(destination_id);
CREATE INDEX IF NOT EXISTS idx_tis_location_id ON tourist_itinerary_stops(location_id);

-- Transport alerts
CREATE INDEX IF NOT EXISTS idx_taal_actor_id ON transport_alert_audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_tas_transport_mode_id ON transport_alert_subscriptions(transport_mode_id);
CREATE INDEX IF NOT EXISTS idx_ta_location_id ON transport_alerts(location_id);
CREATE INDEX IF NOT EXISTS idx_ta_published_by ON transport_alerts(published_by);
CREATE INDEX IF NOT EXISTS idx_ta_reviewed_by ON transport_alerts(reviewed_by);
CREATE INDEX IF NOT EXISTS idx_ta_transport_mode_id ON transport_alerts(transport_mode_id);

-- Transport operators
CREATE INDEX IF NOT EXISTS idx_toal_actor_id ON transport_operator_audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_to_transport_mode_id ON transport_operators(transport_mode_id);
CREATE INDEX IF NOT EXISTS idx_to_verified_by ON transport_operators(verified_by);

-- Transport service submissions
CREATE INDEX IF NOT EXISTS idx_tss_destination_location_id ON transport_service_submissions(destination_location_id);
CREATE INDEX IF NOT EXISTS idx_tss_origin_location_id ON transport_service_submissions(origin_location_id);
CREATE INDEX IF NOT EXISTS idx_tss_related_route_id ON transport_service_submissions(related_route_id);
CREATE INDEX IF NOT EXISTS idx_tss_reviewed_by ON transport_service_submissions(reviewed_by);
CREATE INDEX IF NOT EXISTS idx_tss_transport_mode_id ON transport_service_submissions(transport_mode_id);

-- Tricycle
CREATE INDEX IF NOT EXISTS idx_tfz_verified_by ON tricycle_fare_zones(verified_by);
CREATE INDEX IF NOT EXISTS idx_tsa_verified_by ON tricycle_service_areas(verified_by);
CREATE INDEX IF NOT EXISTS idx_tzc_fare_id ON tricycle_zone_connections(fare_id);
CREATE INDEX IF NOT EXISTS idx_tzc_route_id ON tricycle_zone_connections(route_id);
CREATE INDEX IF NOT EXISTS idx_tzc_verified_by ON tricycle_zone_connections(verified_by);

-- Trip cost estimates
CREATE INDEX IF NOT EXISTS idx_tce_destination_location_id ON trip_cost_estimates(destination_location_id);
CREATE INDEX IF NOT EXISTS idx_tce_itinerary_id ON trip_cost_estimates(itinerary_id);
CREATE INDEX IF NOT EXISTS idx_tce_origin_location_id ON trip_cost_estimates(origin_location_id);
CREATE INDEX IF NOT EXISTS idx_tce_saved_route_id ON trip_cost_estimates(saved_route_id);

-- Trip cost items
CREATE INDEX IF NOT EXISTS idx_tci_from_location_id ON trip_cost_items(from_location_id);
CREATE INDEX IF NOT EXISTS idx_tci_route_id ON trip_cost_items(route_id);
CREATE INDEX IF NOT EXISTS idx_tci_to_location_id ON trip_cost_items(to_location_id);
CREATE INDEX IF NOT EXISTS idx_tci_transport_mode_id ON trip_cost_items(transport_mode_id);

-- Trip history
CREATE INDEX IF NOT EXISTS idx_th_destination_location_id ON trip_history(destination_location_id);
CREATE INDEX IF NOT EXISTS idx_th_origin_location_id ON trip_history(origin_location_id);
CREATE INDEX IF NOT EXISTS idx_th_passenger_category_id ON trip_history(passenger_category_id);
CREATE INDEX IF NOT EXISTS idx_th_route_id ON trip_history(route_id);
CREATE INDEX IF NOT EXISTS idx_th_transport_mode_id ON trip_history(transport_mode_id);

-- Trip history segments
CREATE INDEX IF NOT EXISTS idx_ths_destination_location_id ON trip_history_segments(destination_location_id);
CREATE INDEX IF NOT EXISTS idx_ths_origin_location_id ON trip_history_segments(origin_location_id);
CREATE INDEX IF NOT EXISTS idx_ths_route_id ON trip_history_segments(route_id);
CREATE INDEX IF NOT EXISTS idx_ths_transport_mode_id ON trip_history_segments(transport_mode_id);

-- Users
CREATE INDEX IF NOT EXISTS idx_users_preferred_passenger_category_id ON users(preferred_passenger_category_id);
