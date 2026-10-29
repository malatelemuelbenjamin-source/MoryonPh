/*
# Feature #30: Total Trip Cost Calculator — tables + RLS

## New Tables
1. trip_cost_estimates — saved cost estimate with subtotals, budget, traveler count.
2. trip_cost_items — line items (transport legs + additional expenses).

## Security
- RLS enabled on both, authenticated-only, owner-scoped.
- Items scoped through parent estimate ownership via EXISTS subquery.
*/

-- ===== trip_cost_estimates =====
CREATE TABLE IF NOT EXISTS trip_cost_estimates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  origin_location_id uuid REFERENCES locations(id) ON DELETE SET NULL,
  destination_location_id uuid REFERENCES locations(id) ON DELETE SET NULL,
  trip_date date,
  return_date date,
  is_round_trip boolean NOT NULL DEFAULT false,
  traveler_count integer NOT NULL DEFAULT 1 CHECK (traveler_count >= 1),
  currency_code text NOT NULL DEFAULT 'PHP' CHECK (length(currency_code) = 3),
  transportation_subtotal numeric(12,2) NOT NULL DEFAULT 0 CHECK (transportation_subtotal >= 0),
  additional_expenses_subtotal numeric(12,2) NOT NULL DEFAULT 0 CHECK (additional_expenses_subtotal >= 0),
  known_total numeric(12,2) NOT NULL DEFAULT 0 CHECK (known_total >= 0),
  is_complete boolean NOT NULL DEFAULT true,
  budget_amount numeric(12,2) CHECK (budget_amount IS NULL OR budget_amount >= 0),
  calculation_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  saved_route_id uuid REFERENCES saved_routes(id) ON DELETE SET NULL,
  itinerary_id uuid REFERENCES tourist_itineraries(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','saved','recalculated','archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE trip_cost_estimates ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON trip_cost_estimates TO authenticated;

DROP POLICY IF EXISTS "select_own_cost_estimates" ON trip_cost_estimates;
CREATE POLICY "select_own_cost_estimates" ON trip_cost_estimates
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_cost_estimates" ON trip_cost_estimates;
CREATE POLICY "insert_own_cost_estimates" ON trip_cost_estimates
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_cost_estimates" ON trip_cost_estimates;
CREATE POLICY "update_own_cost_estimates" ON trip_cost_estimates
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_cost_estimates" ON trip_cost_estimates;
CREATE POLICY "delete_own_cost_estimates" ON trip_cost_estimates
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ===== trip_cost_items =====
CREATE TABLE IF NOT EXISTS trip_cost_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id uuid NOT NULL REFERENCES trip_cost_estimates(id) ON DELETE CASCADE,
  item_type text NOT NULL CHECK (item_type IN ('transport_leg','additional_expense')),
  category text NOT NULL DEFAULT 'other',
  description text NOT NULL,
  route_id uuid REFERENCES routes(id) ON DELETE SET NULL,
  transport_mode_id uuid REFERENCES transport_modes(id) ON DELETE SET NULL,
  from_location_id uuid REFERENCES locations(id) ON DELETE SET NULL,
  to_location_id uuid REFERENCES locations(id) ON DELETE SET NULL,
  passenger_type text CHECK (passenger_type IS NULL OR passenger_type IN ('regular','student','senior','pwd')),
  passenger_count integer NOT NULL DEFAULT 1 CHECK (passenger_count >= 0),
  amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  currency_code text NOT NULL DEFAULT 'PHP' CHECK (length(currency_code) = 3),
  quantity numeric(10,2) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  calculation_type text NOT NULL DEFAULT 'per_person' CHECK (calculation_type IN ('per_person','per_group','per_item','per_day','manual_total')),
  line_total numeric(12,2) NOT NULL DEFAULT 0 CHECK (line_total >= 0),
  source_type text NOT NULL DEFAULT 'user_entered' CHECK (source_type IN ('verified','calculated_estimate','user_entered','unverified','unavailable')),
  source_reference text,
  notes text,
  leg_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE trip_cost_items ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON trip_cost_items TO authenticated;

DROP POLICY IF EXISTS "select_own_cost_items" ON trip_cost_items;
CREATE POLICY "select_own_cost_items" ON trip_cost_items
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM trip_cost_estimates WHERE trip_cost_estimates.id = trip_cost_items.estimate_id AND trip_cost_estimates.user_id = auth.uid()));

DROP POLICY IF EXISTS "insert_own_cost_items" ON trip_cost_items;
CREATE POLICY "insert_own_cost_items" ON trip_cost_items
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM trip_cost_estimates WHERE trip_cost_estimates.id = trip_cost_items.estimate_id AND trip_cost_estimates.user_id = auth.uid()));

DROP POLICY IF EXISTS "update_own_cost_items" ON trip_cost_items;
CREATE POLICY "update_own_cost_items" ON trip_cost_items
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM trip_cost_estimates WHERE trip_cost_estimates.id = trip_cost_items.estimate_id AND trip_cost_estimates.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM trip_cost_estimates WHERE trip_cost_estimates.id = trip_cost_items.estimate_id AND trip_cost_estimates.user_id = auth.uid()));

DROP POLICY IF EXISTS "delete_own_cost_items" ON trip_cost_items;
CREATE POLICY "delete_own_cost_items" ON trip_cost_items
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM trip_cost_estimates WHERE trip_cost_estimates.id = trip_cost_items.estimate_id AND trip_cost_estimates.user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_trip_cost_estimates_user_id ON trip_cost_estimates(user_id);
CREATE INDEX IF NOT EXISTS idx_trip_cost_items_estimate_id ON trip_cost_items(estimate_id);