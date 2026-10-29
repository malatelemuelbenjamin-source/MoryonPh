import { supabase } from './supabase'
import { fetchEstimateDetail } from './tripCostCalculator'
import { fetchItineraryDetail } from './touristPlanner'
import { getRouteDetail } from './routes'
import type {
  SharedTripRow,
  SharedTripLookupResult,
  TripSourceType,
  TouristItineraryWithDetails,
  TripCostEstimateWithDetails,
  RouteWithDetails,
} from './types'

// ---- Token generation -----------------------------------------------------

function generateShareToken(): string {
  return crypto.randomUUID()
}

// ---- Expiration helpers ---------------------------------------------------

export const EXPIRY_OPTIONS = [
  { label: '7 days', value: 7 },
  { label: '30 days', value: 30 },
  { label: '90 days', value: 90 },
  { label: 'No expiration', value: 0 },
] as const

export function computeExpiry(days: number): string | null {
  if (days <= 0) return null
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString()
}

export function formatExpiry(expiresAt: string | null): string {
  if (!expiresAt) return 'No expiration'
  const d = new Date(expiresAt)
  return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
}

export function isExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false
  return new Date(expiresAt) < new Date()
}

export function isRevoked(revokedAt: string | null): boolean {
  return revokedAt != null
}

// ---- Snapshot building ----------------------------------------------------

export interface ShareContentOptions {
  include_costs: boolean
  include_notes: boolean
  include_stops: boolean
  include_route_details: boolean
}

export interface ItinerarySnapshot {
  title: string
  description: string | null
  start_date: string | null
  end_date: string | null
  traveler_count: number
  starting_location: { name: string; municipality: string | null } | null
  days: {
    day_number: number
    trip_date: string | null
    stops: {
      stop_order: number
      name: string
      municipality: string | null
      is_rest_break: boolean
      planned_arrival_time: string | null
      planned_departure_time: string | null
      estimated_duration_minutes: number | null
      notes: string | null
    }[]
  }[]
  legs: {
    leg_order: number
    route_name: string | null
    transport_mode: string | null
    estimated_fare: number | null
    fare_source_status: string
    estimated_duration_minutes: number | null
  }[]
  expenses: {
    category: string
    amount: number
    description: string | null
    source_type: string
  }[]
  cost_summary: {
    transportation_total: number
    expenses_total: number
    known_total: number
    is_complete: boolean
  } | null
}

export async function buildItinerarySnapshot(
  itinerary: TouristItineraryWithDetails,
  opts: ShareContentOptions,
): Promise<Record<string, unknown>> {
  const snapshot: ItinerarySnapshot = {
    title: itinerary.title,
    description: opts.include_notes ? itinerary.description : null,
    start_date: itinerary.start_date,
    end_date: itinerary.end_date,
    traveler_count: itinerary.traveler_count,
    starting_location: itinerary.starting_location
      ? { name: itinerary.starting_location.name, municipality: itinerary.starting_location.municipality }
      : null,
    days: opts.include_stops
      ? itinerary.days.map((day) => ({
          day_number: day.day_number,
          trip_date: day.trip_date,
          stops: day.stops.map((stop) => ({
            stop_order: stop.stop_order,
            name: stop.custom_title ?? stop.destination?.name ?? stop.location?.name ?? 'Unknown stop',
            municipality: stop.destination?.municipality ?? stop.location?.municipality ?? null,
            is_rest_break: stop.is_rest_break,
            planned_arrival_time: stop.planned_arrival_time,
            planned_departure_time: stop.planned_departure_time,
            estimated_duration_minutes: stop.estimated_duration_minutes,
            notes: opts.include_notes ? stop.user_notes : null,
          })),
        }))
      : [],
    legs: opts.include_route_details
      ? itinerary.legs.map((leg) => ({
          leg_order: leg.leg_order,
          route_name: leg.route?.route_name ?? null,
          transport_mode: leg.transport_mode?.name ?? null,
          estimated_fare: leg.estimated_fare,
          fare_source_status: leg.fare_source_status,
          estimated_duration_minutes: leg.estimated_duration_minutes,
        }))
      : [],
    expenses: opts.include_costs
      ? itinerary.expenses.map((exp) => ({
          category: exp.category,
          amount: Number(exp.amount),
          description: exp.description,
          source_type: exp.source_type,
        }))
      : [],
    cost_summary: opts.include_costs
      ? {
          transportation_total: itinerary.legs.reduce((sum, l) => sum + (Number(l.estimated_fare) || 0), 0),
          expenses_total: itinerary.expenses.reduce((sum, e) => sum + Number(e.amount), 0),
          known_total:
            itinerary.legs.reduce((sum, l) => sum + (Number(l.estimated_fare) || 0), 0) +
            itinerary.expenses.reduce((sum, e) => sum + Number(e.amount), 0),
          is_complete: itinerary.legs.every((l) => l.estimated_fare != null),
        }
      : null,
  }
  return snapshot as unknown as Record<string, unknown>
}

export interface RouteSnapshot {
  route_name: string
  route_code: string | null
  transport_mode: string | null
  operator_name: string | null
  origin: { name: string; municipality: string | null } | null
  destination: { name: string; municipality: string | null } | null
  estimated_duration_minutes: number | null
  verification_status: string
}

export async function buildRouteSnapshot(
  route: RouteWithDetails,
  _opts: ShareContentOptions,
): Promise<Record<string, unknown>> {
  const snapshot: RouteSnapshot = {
    route_name: route.route_name,
    route_code: route.route_code,
    transport_mode: route.transport_mode?.name ?? null,
    operator_name: route.operator_name,
    origin: route.origin_location
      ? { name: route.origin_location.name, municipality: route.origin_location.municipality }
      : null,
    destination: route.destination_location
      ? { name: route.destination_location.name, municipality: route.destination_location.municipality }
      : null,
    estimated_duration_minutes: route.estimated_duration_minutes,
    verification_status: route.verification_status,
  }
  return snapshot as unknown as Record<string, unknown>
}

export interface CostEstimateSnapshot {
  title: string
  trip_date: string | null
  return_date: string | null
  is_round_trip: boolean
  traveler_count: number
  origin: { name: string; municipality: string | null } | null
  destination: { name: string; municipality: string | null } | null
  items: {
    description: string
    category: string
    amount: number
    line_total: number
    source_type: string
    calculation_type: string
  }[]
  cost_summary: {
    transportation_subtotal: number
    additional_expenses_subtotal: number
    known_total: number
    is_complete: boolean
  }
}

export async function buildCostEstimateSnapshot(
  estimate: TripCostEstimateWithDetails,
  opts: ShareContentOptions,
): Promise<Record<string, unknown>> {
  const snapshot: CostEstimateSnapshot = {
    title: estimate.title,
    trip_date: estimate.trip_date,
    return_date: estimate.return_date,
    is_round_trip: estimate.is_round_trip,
    traveler_count: estimate.traveler_count,
    origin: estimate.origin_location
      ? { name: estimate.origin_location.name, municipality: estimate.origin_location.municipality }
      : null,
    destination: estimate.destination_location
      ? { name: estimate.destination_location.name, municipality: estimate.destination_location.municipality }
      : null,
    items: opts.include_costs
      ? estimate.items.map((item) => ({
          description: item.description,
          category: item.category,
          amount: Number(item.amount),
          line_total: Number(item.line_total),
          source_type: item.source_type,
          calculation_type: item.calculation_type,
        }))
      : [],
    cost_summary: opts.include_costs
      ? {
          transportation_subtotal: Number(estimate.transportation_subtotal),
          additional_expenses_subtotal: Number(estimate.additional_expenses_subtotal),
          known_total: Number(estimate.known_total),
          is_complete: estimate.is_complete,
        }
      : {
          transportation_subtotal: 0,
          additional_expenses_subtotal: 0,
          known_total: 0,
          is_complete: false,
        },
  }
  return snapshot as unknown as Record<string, unknown>
}

// ---- Create share link ----------------------------------------------------

export interface CreateShareInput {
  trip_source_type: TripSourceType
  trip_source_id: string
  title: string
  shared_content: Record<string, unknown>
  options: ShareContentOptions
  expires_at: string | null
}

export async function createShareLink(
  input: CreateShareInput,
): Promise<{ success: boolean; token?: string; id?: string; error?: string }> {
  const token = generateShareToken()

  const { data, error } = await supabase
    .from('shared_trips')
    .insert({
      trip_source_type: input.trip_source_type,
      trip_source_id: input.trip_source_id,
      share_token: token,
      title_snapshot: input.title,
      shared_content: input.shared_content,
      include_costs: input.options.include_costs,
      include_notes: input.options.include_notes,
      include_stops: input.options.include_stops,
      include_route_details: input.options.include_route_details,
      expires_at: input.expires_at,
    })
    .select('id, share_token')
    .maybeSingle()

  if (error) {
    console.error('createShareLink error:', error.message)
    return { success: false, error: friendlyError(error.message) }
  }

  const row = data as { id: string; share_token: string } | null
  if (!row) return { success: false, error: 'Failed to create share link.' }
  return { success: true, token: row.share_token, id: row.id }
}

// ---- Fetch owner's share records ------------------------------------------

export async function fetchMyShares(): Promise<SharedTripRow[]> {
  const { data, error } = await supabase
    .from('shared_trips')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('fetchMyShares error:', error.message)
    return []
  }
  return (data ?? []) as SharedTripRow[]
}

// ---- Revoke / Delete / Extend ---------------------------------------------

export async function revokeShare(id: string): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('shared_trips')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id)

  if (error) {
    console.error('revokeShare error:', error.message)
    return { success: false, error: friendlyError(error.message) }
  }
  return { success: true }
}

export async function deleteShare(id: string): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('shared_trips')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('deleteShare error:', error.message)
    return { success: false, error: friendlyError(error.message) }
  }
  return { success: true }
}

export async function extendShare(
  id: string,
  expiresAt: string | null,
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('shared_trips')
    .update({ expires_at: expiresAt, revoked_at: null })
    .eq('id', id)

  if (error) {
    console.error('extendShare error:', error.message)
    return { success: false, error: friendlyError(error.message) }
  }
  return { success: true }
}

// ---- Public lookup (for recipients) ---------------------------------------

export async function lookupSharedTrip(token: string): Promise<SharedTripLookupResult | null> {
  const { data, error } = await supabase.rpc('get_shared_trip', { p_token: token })

  if (error) {
    console.error('lookupSharedTrip error:', error.message)
    return null
  }

  const result = data as SharedTripLookupResult
  if (!result || !result.status) return null
  return result
}

// ---- Source data fetchers -------------------------------------------------

export async function fetchSourceData(
  sourceType: TripSourceType,
  sourceId: string,
): Promise<{ title: string; content: Record<string, unknown> } | null> {
  if (sourceType === 'itinerary') {
    const itinerary = await fetchItineraryDetail(sourceId)
    if (!itinerary) return null
    return { title: itinerary.title, content: {} }
  }
  if (sourceType === 'route') {
    const route = await getRouteDetail(sourceId)
    if (!route) return null
    return { title: route.route_name, content: {} }
  }
  if (sourceType === 'cost_estimate') {
    const estimate = await fetchEstimateDetail(sourceId)
    if (!estimate) return null
    return { title: estimate.title, content: {} }
  }
  return null
}

// ---- Build share URL ------------------------------------------------------

export function buildShareUrl(token: string): string {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
  return `${baseUrl}/shared/${token}`
}

// ---- Clipboard ------------------------------------------------------------

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

// ---- Native share ---------------------------------------------------------

export async function nativeShare(title: string, url: string): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.share) return false
  try {
    await navigator.share({ title, url })
    return true
  } catch {
    return false
  }
}

// ---- Helpers --------------------------------------------------------------

function friendlyError(msg: string): string {
  if (msg.includes('row-level security')) {
    return 'You do not have permission to perform this action. Please sign in.'
  }
  if (msg.includes('duplicate')) {
    return 'This may already exist. Please check and try again.'
  }
  return msg
}

// ---- Status labels --------------------------------------------------------

export function sourceTypeLabel(t: TripSourceType): string {
  switch (t) {
    case 'itinerary': return 'Itinerary'
    case 'route': return 'Route'
    case 'cost_estimate': return 'Cost Estimate'
  }
}

export function shareStatusLabel(row: SharedTripRow): string {
  if (isRevoked(row.revoked_at)) return 'Revoked'
  if (isExpired(row.expires_at)) return 'Expired'
  return 'Active'
}
