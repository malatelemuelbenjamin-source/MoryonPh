import { supabase } from './supabase'
import { calculateFare, formatPeso } from './fares'
import { fetchRoutesBetween } from './routes'
import type {
  TripCostEstimateRow,
  TripCostEstimateWithDetails,
  TripCostItemRow,
  TripCostItemWithDetails,
  CostEstimateStatus,
  CostItemCalculationType,
  CostItemSourceType,
  CostItemType,
  PassengerType,
  RouteWithDetails,
} from './types'

// ---- Labels ---------------------------------------------------------------

export const EXPENSE_CATEGORIES = [
  'food',
  'accommodation',
  'entrance_fee',
  'parking',
  'fuel',
  'toll',
  'boat_addon',
  'rental',
  'shopping',
  'other',
] as const

export const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  food: 'Food & Drinks',
  accommodation: 'Accommodation',
  entrance_fee: 'Entrance Fees',
  parking: 'Parking',
  fuel: 'Fuel',
  toll: 'Toll Fees',
  boat_addon: 'Boat / Ferry Add-ons',
  rental: 'Rental Services',
  shopping: 'Shopping',
  other: 'Other',
}

export const CALC_TYPE_LABELS: Record<CostItemCalculationType, string> = {
  per_person: 'Per Person',
  per_group: 'Per Group',
  per_item: 'Per Item',
  per_day: 'Per Day',
  manual_total: 'Manual Total',
}

export const SOURCE_TYPE_LABELS: Record<CostItemSourceType, string> = {
  verified: 'Verified Fare',
  calculated_estimate: 'Calculated Estimate',
  user_entered: 'User-Entered',
  unverified: 'Unverified Amount',
  unavailable: 'Price Unavailable',
}

export const STATUS_LABELS: Record<CostEstimateStatus, string> = {
  draft: 'Draft',
  saved: 'Saved',
  recalculated: 'Recalculated',
  archived: 'Archived',
}

export function sourceClasses(s: CostItemSourceType): string {
  switch (s) {
    case 'verified': return 'bg-leaf-100 text-leaf-700'
    case 'calculated_estimate': return 'bg-ocean-100 text-ocean-800'
    case 'user_entered': return 'bg-sand-200 text-ocean-700'
    case 'unverified': return 'bg-terra-100 text-terra-700'
    case 'unavailable': return 'bg-red-100 text-red-700'
  }
}

// ---- Line total calculation -----------------------------------------------

export function computeLineTotal(
  amount: number,
  quantity: number,
  calculationType: CostItemCalculationType,
  _travelerCount: number,
  passengerCount: number,
): number {
  switch (calculationType) {
    case 'per_person':
      return round2(amount * quantity * passengerCount)
    case 'per_group':
      return round2(amount * quantity)
    case 'per_item':
      return round2(amount * quantity)
    case 'per_day':
      return round2(amount * quantity)
    case 'manual_total':
      return round2(amount)
  }
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

export function formatCurrency(amount: number, currency = 'PHP'): string {
  if (currency === 'PHP') return formatPeso(amount)
  return `${amount.toFixed(2)} ${currency}`
}

// ---- Interfaces for trip legs ---------------------------------------------

export interface TripLegSpec {
  fromLocationId: string
  toLocationId: string
  passengerType: PassengerType
  passengerCount: number
}

export interface CalculatedLeg {
  route: RouteWithDetails | null
  fareAmount: number | null
  sourceType: CostItemSourceType
  sourceReference: string | null
  passengerType: PassengerType
  passengerCount: number
  fromLocationId: string
  toLocationId: string
  lineTotal: number
  error: string | null
}

// ---- Calculate transport legs from route + fare data ----------------------

export async function calculateTripLegs(
  legs: TripLegSpec[],
): Promise<CalculatedLeg[]> {
  const results: CalculatedLeg[] = []

  for (const leg of legs) {
    if (leg.fromLocationId === leg.toLocationId) {
      results.push({
        route: null,
        fareAmount: null,
        sourceType: 'unavailable',
        sourceReference: null,
        passengerType: leg.passengerType,
        passengerCount: leg.passengerCount,
        fromLocationId: leg.fromLocationId,
        toLocationId: leg.toLocationId,
        lineTotal: 0,
        error: 'Origin and destination are the same.',
      })
      continue
    }

    const routes = await fetchRoutesBetween(leg.fromLocationId, leg.toLocationId)
    if (routes.length === 0) {
      results.push({
        route: null,
        fareAmount: null,
        sourceType: 'unavailable',
        sourceReference: null,
        passengerType: leg.passengerType,
        passengerCount: leg.passengerCount,
        fromLocationId: leg.fromLocationId,
        toLocationId: leg.toLocationId,
        lineTotal: 0,
        error: 'No verified route found between these locations.',
      })
      continue
    }

    const route = routes[0]
    const fareResult = await calculateFare(route.id, leg.passengerType)

    if (!fareResult.hasFare) {
      results.push({
        route,
        fareAmount: null,
        sourceType: 'unavailable',
        sourceReference: null,
        passengerType: leg.passengerType,
        passengerCount: leg.passengerCount,
        fromLocationId: leg.fromLocationId,
        toLocationId: leg.toLocationId,
        lineTotal: 0,
        error: fareResult.expired ? 'Fare record has expired.' : 'No fare data for this route.',
      })
      continue
    }

    const fareAmount = fareResult.totalAmount
    const sourceType: CostItemSourceType =
      fareResult.fare?.verification_status === 'official' || fareResult.fare?.verification_status === 'verified'
        ? 'verified'
        : 'calculated_estimate'

    results.push({
      route,
      fareAmount,
      sourceType,
      sourceReference: fareResult.fare?.source_reference ?? fareResult.fare?.id ?? null,
      passengerType: leg.passengerType,
      passengerCount: leg.passengerCount,
      fromLocationId: leg.fromLocationId,
      toLocationId: leg.toLocationId,
      lineTotal: round2(fareAmount * leg.passengerCount),
      error: null,
    })
  }

  return results
}

// ---- Cost breakdown -------------------------------------------------------

export interface CostBreakdown {
  transportationTotal: number
  additionalExpensesTotal: number
  knownTotal: number
  perTraveler: number
  isComplete: boolean
  unavailableItems: number
  notes: string[]
  legs: CalculatedLeg[]
  items: TripCostItemWithDetails[]
}

export function buildCostBreakdown(
  legs: CalculatedLeg[],
  additionalItems: TripCostItemWithDetails[],
  travelerCount: number,
): CostBreakdown {
  const notes: string[] = []
  let transportationTotal = 0
  let unavailableItems = 0

  for (const leg of legs) {
    if (leg.lineTotal > 0) {
      transportationTotal = round2(transportationTotal + leg.lineTotal)
    } else {
      unavailableItems++
    }
  }

  if (unavailableItems > 0) {
    notes.push(`${unavailableItems} transport leg(s) have no fare information. Transportation total may be incomplete.`)
  }

  let additionalExpensesTotal = 0
  for (const item of additionalItems) {
    if (item.source_type === 'unavailable') {
      unavailableItems++
      continue
    }
    additionalExpensesTotal = round2(additionalExpensesTotal + Number(item.line_total))
  }

  const knownTotal = round2(transportationTotal + additionalExpensesTotal)
  const perTraveler = travelerCount > 0 ? round2(knownTotal / travelerCount) : knownTotal
  const isComplete = unavailableItems === 0

  if (!isComplete) {
    notes.push('This estimate is incomplete. Some costs could not be determined and are excluded from the total.')
  }

  return {
    transportationTotal,
    additionalExpensesTotal,
    knownTotal,
    perTraveler,
    isComplete,
    unavailableItems,
    notes,
    legs,
    items: additionalItems,
  }
}

// ---- Budget comparison ----------------------------------------------------

export interface BudgetComparison {
  budget: number | null
  knownTotal: number
  remaining: number | null
  overBudget: number | null
  percentUsed: number | null
  status: 'under' | 'near' | 'over' | 'unknown'
}

export function compareBudget(budget: number | null, knownTotal: number): BudgetComparison {
  if (budget == null || budget <= 0) {
    return { budget: null, knownTotal, remaining: null, overBudget: null, percentUsed: null, status: 'unknown' }
  }
  const remaining = round2(budget - knownTotal)
  const overBudget = remaining < 0 ? round2(Math.abs(remaining)) : null
  const percentUsed = budget > 0 ? Math.round((knownTotal / budget) * 100) : null
  let status: 'under' | 'near' | 'over' = 'under'
  if (percentUsed != null && percentUsed >= 100) status = 'over'
  else if (percentUsed != null && percentUsed >= 80) status = 'near'
  return { budget, knownTotal, remaining: remaining >= 0 ? remaining : 0, overBudget, percentUsed, status }
}

// ---- CRUD: Create estimate ------------------------------------------------

export interface NewEstimateInput {
  title: string
  origin_location_id?: string | null
  destination_location_id?: string | null
  trip_date?: string | null
  return_date?: string | null
  is_round_trip?: boolean
  traveler_count?: number
  currency_code?: string
  budget_amount?: number | null
  saved_route_id?: string | null
  itinerary_id?: string | null
}

export async function createEstimate(
  input: NewEstimateInput,
): Promise<{ success: boolean; id?: string; error?: string }> {
  if (!input.title.trim()) {
    return { success: false, error: 'Estimate name is required.' }
  }
  if (input.traveler_count != null && input.traveler_count < 1) {
    return { success: false, error: 'Number of travelers must be at least 1.' }
  }
  if (input.trip_date && input.return_date && input.return_date < input.trip_date) {
    return { success: false, error: 'Return date cannot be before trip date.' }
  }

  const { data, error } = await supabase
    .from('trip_cost_estimates')
    .insert({
      title: input.title.trim(),
      origin_location_id: input.origin_location_id ?? null,
      destination_location_id: input.destination_location_id ?? null,
      trip_date: input.trip_date ?? null,
      return_date: input.return_date ?? null,
      is_round_trip: input.is_round_trip ?? false,
      traveler_count: input.traveler_count ?? 1,
      currency_code: input.currency_code ?? 'PHP',
      budget_amount: input.budget_amount ?? null,
      saved_route_id: input.saved_route_id ?? null,
      itinerary_id: input.itinerary_id ?? null,
      status: 'draft',
    })
    .select('id')
    .maybeSingle()

  if (error) {
    console.error('createEstimate error:', error.message)
    return { success: false, error: friendlyError(error.message) }
  }
  return { success: true, id: (data as { id: string } | null)?.id }
}

// ---- CRUD: Fetch estimates ------------------------------------------------

export async function fetchMyEstimates(): Promise<TripCostEstimateRow[]> {
  const { data, error } = await supabase
    .from('trip_cost_estimates')
    .select('*')
    .neq('status', 'archived')
    .order('updated_at', { ascending: false })

  if (error) {
    console.error('fetchMyEstimates error:', error.message)
    return []
  }
  return (data ?? []) as TripCostEstimateRow[]
}

export async function fetchEstimateDetail(id: string): Promise<TripCostEstimateWithDetails | null> {
  const { data: est, error: estErr } = await supabase
    .from('trip_cost_estimates')
    .select('*, origin_location:locations!origin_location_id(id, name, municipality), destination_location:locations!destination_location_id(id, name, municipality)')
    .eq('id', id)
    .maybeSingle()

  if (estErr || !est) {
    console.error('fetchEstimateDetail error:', estErr?.message ?? 'not found')
    return null
  }

  const estimate = est as TripCostEstimateWithDetails

  const { data: items } = await supabase
    .from('trip_cost_items')
    .select('*, route:routes(id, route_name, route_code), transport_mode:transport_modes(id, name, code, icon), from_location:locations!from_location_id(id, name, municipality), to_location:locations!to_location_id(id, name, municipality)')
    .eq('estimate_id', id)
    .order('leg_order', { ascending: true })

  estimate.items = (items ?? []) as TripCostItemWithDetails[]
  return estimate
}

// ---- CRUD: Update estimate ------------------------------------------------

export async function updateEstimate(
  id: string,
  updates: Partial<Pick<TripCostEstimateRow, 'title' | 'trip_date' | 'return_date' | 'is_round_trip' | 'traveler_count' | 'budget_amount' | 'status' | 'saved_route_id' | 'itinerary_id'>>,
): Promise<{ success: boolean; error?: string }> {
  if (updates.title !== undefined && !updates.title.trim()) {
    return { success: false, error: 'Estimate name cannot be empty.' }
  }
  if (updates.traveler_count != null && updates.traveler_count < 1) {
    return { success: false, error: 'Number of travelers must be at least 1.' }
  }

  const { error } = await supabase
    .from('trip_cost_estimates')
    .update(updates)
    .eq('id', id)

  if (error) {
    console.error('updateEstimate error:', error.message)
    return { success: false, error: friendlyError(error.message) }
  }
  return { success: true }
}

// ---- CRUD: Delete / Duplicate ---------------------------------------------

export async function deleteEstimate(id: string): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('trip_cost_estimates')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('deleteEstimate error:', error.message)
    return { success: false, error: friendlyError(error.message) }
  }
  return { success: true }
}

export async function duplicateEstimate(id: string): Promise<{ success: boolean; newId?: string; error?: string }> {
  const original = await fetchEstimateDetail(id)
  if (!original) return { success: false, error: 'Estimate not found.' }

  const { success, id: newId, error } = await createEstimate({
    title: `${original.title} (Copy)`,
    origin_location_id: original.origin_location_id,
    destination_location_id: original.destination_location_id,
    trip_date: original.trip_date,
    return_date: original.return_date,
    is_round_trip: original.is_round_trip,
    traveler_count: original.traveler_count,
    currency_code: original.currency_code,
    budget_amount: original.budget_amount != null ? Number(original.budget_amount) : null,
    saved_route_id: original.saved_route_id,
    itinerary_id: original.itinerary_id,
  })

  if (!success || !newId) return { success: false, error: error ?? 'Failed to create copy.' }

  for (const item of original.items) {
    await addItem(newId, {
      item_type: item.item_type,
      category: item.category,
      description: item.description,
      route_id: item.route_id,
      transport_mode_id: item.transport_mode_id,
      from_location_id: item.from_location_id,
      to_location_id: item.to_location_id,
      passenger_type: item.passenger_type,
      passenger_count: item.passenger_count,
      amount: Number(item.amount),
      currency_code: item.currency_code,
      quantity: Number(item.quantity),
      calculation_type: item.calculation_type,
      line_total: Number(item.line_total),
      source_type: item.source_type,
      source_reference: item.source_reference,
      notes: item.notes,
      leg_order: item.leg_order,
    })
  }

  return { success: true, newId }
}

// ---- CRUD: Add item -------------------------------------------------------

export interface NewItemInput {
  item_type: CostItemType
  category: string
  description: string
  route_id?: string | null
  transport_mode_id?: string | null
  from_location_id?: string | null
  to_location_id?: string | null
  passenger_type?: PassengerType | null
  passenger_count?: number
  amount: number
  currency_code?: string
  quantity?: number
  calculation_type?: CostItemCalculationType
  line_total?: number
  source_type?: CostItemSourceType
  source_reference?: string | null
  notes?: string | null
  leg_order?: number
}

export async function addItem(
  estimateId: string,
  input: NewItemInput,
): Promise<{ success: boolean; id?: string; error?: string }> {
  if (input.amount < 0) {
    return { success: false, error: 'Amount cannot be negative.' }
  }

  const { data, error } = await supabase
    .from('trip_cost_items')
    .insert({
      estimate_id: estimateId,
      item_type: input.item_type,
      category: input.category,
      description: input.description.trim(),
      route_id: input.route_id ?? null,
      transport_mode_id: input.transport_mode_id ?? null,
      from_location_id: input.from_location_id ?? null,
      to_location_id: input.to_location_id ?? null,
      passenger_type: input.passenger_type ?? null,
      passenger_count: input.passenger_count ?? 1,
      amount: input.amount,
      currency_code: input.currency_code ?? 'PHP',
      quantity: input.quantity ?? 1,
      calculation_type: input.calculation_type ?? 'per_person',
      line_total: input.line_total ?? computeLineTotal(
        input.amount,
        input.quantity ?? 1,
        input.calculation_type ?? 'per_person',
        1,
        input.passenger_count ?? 1,
      ),
      source_type: input.source_type ?? 'user_entered',
      source_reference: input.source_reference ?? null,
      notes: input.notes?.trim() || null,
      leg_order: input.leg_order ?? 0,
    })
    .select('id')
    .maybeSingle()

  if (error) {
    console.error('addItem error:', error.message)
    return { success: false, error: friendlyError(error.message) }
  }
  return { success: true, id: (data as { id: string } | null)?.id }
}

// ---- CRUD: Update / Delete item -------------------------------------------

export async function updateItem(
  id: string,
  updates: Partial<Pick<TripCostItemRow, 'description' | 'amount' | 'quantity' | 'calculation_type' | 'line_total' | 'source_type' | 'notes' | 'category' | 'passenger_count'>>,
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('trip_cost_items')
    .update(updates)
    .eq('id', id)

  if (error) {
    console.error('updateItem error:', error.message)
    return { success: false, error: friendlyError(error.message) }
  }
  return { success: true }
}

export async function deleteItem(id: string): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('trip_cost_items')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('deleteItem error:', error.message)
    return { success: false, error: friendlyError(error.message) }
  }
  return { success: true }
}

// ---- Recalculate: re-fetch fares for all transport legs -------------------

export async function recalculateEstimate(
  estimateId: string,
): Promise<{ success: boolean; updated: number; unavailable: number; error?: string }> {
  const estimate = await fetchEstimateDetail(estimateId)
  if (!estimate) return { success: false, updated: 0, unavailable: 0, error: 'Estimate not found.' }

  const transportItems = estimate.items.filter((i) => i.item_type === 'transport_leg')
  let updated = 0
  let unavailable = 0

  for (const item of transportItems) {
    if (!item.from_location_id || !item.to_location_id) {
      unavailable++
      continue
    }

    const routes = await fetchRoutesBetween(item.from_location_id, item.to_location_id)
    if (routes.length === 0) {
      await updateItem(item.id, { source_type: 'unavailable', line_total: 0 })
      unavailable++
      continue
    }

    const route = routes[0]
    const pType = item.passenger_type ?? 'regular'
    const fareResult = await calculateFare(route.id, pType)

    if (!fareResult.hasFare) {
      await updateItem(item.id, { source_type: 'unavailable', line_total: 0 })
      unavailable++
      continue
    }

    const newLineTotal = round2(fareResult.totalAmount * item.passenger_count)
    const newSource: CostItemSourceType =
      fareResult.fare?.verification_status === 'official' || fareResult.fare?.verification_status === 'verified'
        ? 'verified'
        : 'calculated_estimate'

    await supabase
      .from('trip_cost_items')
      .update({
        amount: fareResult.totalAmount,
        line_total: newLineTotal,
        source_type: newSource,
        route_id: route.id,
        transport_mode_id: route.transport_mode_id,
      })
      .eq('id', item.id)

    updated++
  }

  // Recalculate estimate totals
  await recalculateEstimateTotals(estimateId)

  await updateEstimate(estimateId, { status: 'recalculated' })
  return { success: true, updated, unavailable }
}

// ---- Recalculate estimate totals from items -------------------------------

export async function recalculateEstimateTotals(estimateId: string): Promise<void> {
  const estimate = await fetchEstimateDetail(estimateId)
  if (!estimate) return

  let transportTotal = 0
  let additionalTotal = 0
  let hasUnavailable = false

  for (const item of estimate.items) {
    if (item.source_type === 'unavailable') {
      hasUnavailable = true
      continue
    }
    if (item.item_type === 'transport_leg') {
      transportTotal = round2(transportTotal + Number(item.line_total))
    } else {
      additionalTotal = round2(additionalTotal + Number(item.line_total))
    }
  }

  const knownTotal = round2(transportTotal + additionalTotal)

  await supabase
    .from('trip_cost_estimates')
    .update({
      transportation_subtotal: transportTotal,
      additional_expenses_subtotal: additionalTotal,
      known_total: knownTotal,
      is_complete: !hasUnavailable,
    })
    .eq('id', estimateId)
}

// ---- Save estimate (finalize) ---------------------------------------------

export async function saveEstimate(estimateId: string): Promise<{ success: boolean; error?: string }> {
  await recalculateEstimateTotals(estimateId)
  return updateEstimate(estimateId, { status: 'saved' })
}

// ---- Helpers ---------------------------------------------------------------

function friendlyError(msg: string): string {
  if (msg.includes('row-level security')) {
    return 'You do not have permission to perform this action. Please sign in.'
  }
  if (msg.includes('duplicate')) {
    return 'This may already exist. Please check and try again.'
  }
  return msg
}

// ---- Check fare freshness --------------------------------------------------

export function isFareStale(lastVerifiedAt: string | null): boolean {
  if (!lastVerifiedAt) return true
  const verified = new Date(lastVerifiedAt)
  const daysSince = (Date.now() - verified.getTime()) / (1000 * 60 * 60 * 24)
  return daysSince > 180
}
