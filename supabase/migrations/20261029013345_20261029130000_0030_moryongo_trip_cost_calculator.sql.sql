/*
# Feature #30: Total Trip Cost Calculator

## Purpose
Allows commuters and tourists to estimate the total cost of a journey — transportation
fares from verified records plus user-entered additional expenses — and save those
estimates for later comparison and recalculation.

## New Tables

### 1. trip_cost_estimates
Stores a saved cost estimate for a trip.
- `id` (uuid PK)
- `user_id` (uuid, FK auth.users, NOT NULL DEFAULT auth.uid())
- `title` (text, NOT NULL)
- `origin_location_id` (uuid, nullable, FK locations)
- `destination_location_id` (uuid, nullable, FK locations)
- `trip_date` (date, nullable)
- `return_date` (date, nullable)
- `is_round_trip` (boolean, DEFAULT false)
- `traveler_count` (integer, NOT NULL, DEFAULT 1, CHECK >= 1)
- `currency_code` (text, NOT NULL, DEFAULT 'PHP', CHECK length 3)
- `transportation_subtotal` (numeric(12,2), NOT NULL, DEFAULT 0, CHECK >= 0)
- `additional_expenses_subtotal` (numeric(12,2), NOT NULL, DEFAULT 0, CHECK >= 0)
- `known_total` (numeric(12,2), NOT NULL, DEFAULT 0, CHECK >= 0)
- `is_complete` (boolean, NOT NULL, DEFAULT true)
- `budget_amount` (numeric(12,2), nullable, CHECK >= 0)
- `calculation_metadata` (jsonb, DEFAULT '{}')
- `saved_route_id` (uuid, nullable, FK saved_routes ON DELETE SET NULL)
- `itinerary_id` (uuid, nullable, FK tourist_itineraries ON DELETE SET NULL)
- `status` (text, NOT NULL, DEFAULT 'draft', CHECK in draft/saved/recalculated/archived)
- `created_at` (timestamptz, DEFAULT now())
- `updated_at` (timestamptz, DEFAULT now())

### 2. trip_cost_items
Stores individual line items (transport legs + additional expenses) for a cost estimate.
- `id` (uuid PK)
- `estimate_id` (uuid, FK trip_cost_estimates ON DELETE CASCADE)
- `item_type` (text, NOT NULL, CHECK in 'transport_leg'/'additional_expense')
- `category` (text, NOT NULL, DEFAULT 'other') — e.g. food, accommodation, entrance_fee, transport_leg, parking, fuel, toll, boat_addon, rental, shopping, other
- `description` (text, NOT NULL)
- `route_id` (uuid, nullable, FK routes)
- `transport_mode_id` (uuid, nullable, FK transport_modes)
- `from_location_id` (uuid, nullable, FK locations)
- `to_location_id` (uuid, nullable, FK locations)
- `passenger_type` (text, nullable, CHECK in regular/student/senior/pwd)
- `passenger_count` (integer, NOT NULL, DEFAULT 1, CHECK >= 0)
- `amount` (numeric(12,2), NOT NULL, DEFAULT 0, CHECK >= 0)
- `currency_code` (text, NOT NULL, DEFAULT 'PHP', CHECK length 3)
- `quantity` (numeric(10,2), NOT NULL, DEFAULT 1, CHECK > 0)
- `calculation_type` (text, NOT NULL, DEFAULT 'per_person', CHECK in per_person/per_group/per_item/per_day/manual_total)
- `line_total` (numeric(12,2), NOT NULL, DEFAULT 0, CHECK >= 0)
- `source_type` (text, NOT NULL, DEFAULT 'user_entered', CHECK in verified/calculated_estimate/user_entered/unverified/unavailable)
- `source_reference` (text, nullable)
- `notes` (text, nullable)
- `leg_order` (integer, NOT NULL, DEFAULT 0)
- `created_at` (timestamptz, DEFAULT now())
- `updated_at` (timestamptz, DEFAULT now())

## Security
- RLS enabled on both tables.
- Grants: SELECT/INSERT/UPDATE/DELETE to authenticated only.
- Owner-scoped policies: users can only access their own estimates and items (items scoped through parent estimate ownership).
- trip_cost_items policies use EXISTS subquery to verify the parent estimate belongs to the user.

## Notes
- Monetary amounts use numeric(12,2) to avoid floating-point rounding.
- The `calculation_metadata` jsonb stores a snapshot of how the estimate was produced
  (fare IDs, verification dates, breakdown) so historical estimates remain explainable
  even after fares change.
- `is_complete` flags whether all items had known prices; incomplete estimates are
  displayed as such in the UI.
*/