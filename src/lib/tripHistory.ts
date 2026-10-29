import { supabase } from './supabase'
import type {
  TripStatus,
  TripHistoryRow,
  TripHistoryWithDetails,
  TripHistorySegmentRow,
} from './types'

// ---- Status labels ----------------------------------------------------------

export const TRIP_STATUS_LABELS: Record<TripStatus, string> = {
  planned: 'Planned',
  saved: 'Saved',
  started: 'Started',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

export const TRIP_STATUS_ORDER: TripStatus[] = [
  'planned',
  'saved',
  'started',
  'completed',
  'cancelled',
]

export function tripStatusColor(status: TripStatus): string {
  switch (status) {
    case 'planned':
      return 'bg-ocean-100 text-ocean-800'
    case 'saved':
      return 'bg-leaf-100 text-leaf-700'
    case 'started':
      return 'bg-terra-100 text-terra-700'
    case 'completed':
      return 'bg-leaf-600 text-white'
    case 'cancelled':
      return 'bg-red-100 text-red-700'
  }
}

// ---- Fetch list with optional filters ---------------------------------------

export interface TripHistoryFilter {
  search?: string
  status?: TripStatus | 'all'
  transportModeId?: string | 'all'
  dateFrom?: string | null
  dateTo?: string | null
  sort?: 'recent' | 'oldest'
}

const DETAIL_SELECT = `
  *,
  origin_location:locations!trip_history_origin_location_id_fkey(id, name, municipality),
  destination_location:locations!trip_history_destination_location_id_fkey(id, name, municipality),
  transport_mode:transport_modes!trip_history_transport_mode_id_fkey(id, name, code, icon),
  route:routes!trip_history_route_id_fkey(id, route_name, route_code),
  passenger_category:passenger_categories!trip_history_passenger_category_id_fkey(id, name, code),
  trip_history_segments(
    id, trip_history_id, segment_order, route_id, origin_location_id, destination_location_id,
    transport_mode_id, fare_snapshot, created_at,
    route:routes!trip_history_segments_route_id_fkey(id, route_name, route_code),
    transport_mode:transport_modes!trip_history_segments_transport_mode_id_fkey(id, name, code, icon),
    origin_location:locations!trip_history_segments_origin_location_id_fkey(id, name, municipality),
    destination_location:locations!trip_history_segments_destination_location_id_fkey(id, name, municipality)
  )
`

export async function fetchTripHistory(
  filter: TripHistoryFilter = {},
): Promise<TripHistoryWithDetails[]> {
  let query = supabase.from('trip_history').select(DETAIL_SELECT)

  if (filter.status && filter.status !== 'all') {
    query = query.eq('trip_status', filter.status)
  }
  if (filter.transportModeId && filter.transportModeId !== 'all') {
    query = query.eq('transport_mode_id', filter.transportModeId)
  }
  if (filter.dateFrom) {
    query = query.gte('planned_departure_at', `${filter.dateFrom}T00:00:00`)
  }
  if (filter.dateTo) {
    query = query.lte('planned_departure_at', `${filter.dateTo}T23:59:59`)
  }

  query = query.order('updated_at', { ascending: filter.sort === 'oldest' })

  const { data, error } = await query
  if (error) {
    console.error('fetchTripHistory error:', error.message)
    return []
  }

  let rows = (data ?? []) as unknown as TripHistoryWithDetails[]

  if (filter.search) {
    const q = filter.search.toLowerCase()
    rows = rows.filter(
      (r) =>
        r.origin_location?.name?.toLowerCase().includes(q) ||
        r.destination_location?.name?.toLowerCase().includes(q) ||
        r.route?.route_name?.toLowerCase().includes(q),
    )
  }

  return rows
}

// ---- Fetch single trip ------------------------------------------------------

export async function fetchTripById(
  id: string,
): Promise<TripHistoryWithDetails | null> {
  const { data, error } = await supabase
    .from('trip_history')
    .select(DETAIL_SELECT)
    .eq('id', id)
    .maybeSingle()

  if (error) {
    console.error('fetchTripHistory error:', error.message)
    return null
  }
  return (data as unknown as TripHistoryWithDetails) ?? null
}

// ---- Create a trip ----------------------------------------------------------

export interface CreateTripInput {
  originLocationId?: string | null
  destinationLocationId?: string | null
  routeId?: string | null
  transportModeId?: string | null
  tripStatus?: TripStatus
  plannedDepartureAt?: string | null
  estimatedFare?: number | null
  currencyCode?: string
  fareSnapshot?: Record<string, unknown> | null
  passengerCategoryId?: string | null
  notes?: string | null
  segments?: Array<{
    segmentOrder: number
    routeId?: string | null
    originLocationId?: string | null
    destinationLocationId?: string | null
    transportModeId?: string | null
    fareSnapshot?: Record<string, unknown> | null
  }>
}

export async function createTrip(
  input: CreateTripInput,
): Promise<{ success: boolean; error?: string; id?: string }> {
  if (input.notes && input.notes.length > 1000) {
    return { success: false, error: 'Notes must be 1000 characters or fewer.' }
  }
  if (input.estimatedFare != null && input.estimatedFare < 0) {
    return { success: false, error: 'Estimated fare cannot be negative.' }
  }

  const row: Record<string, unknown> = {
    origin_location_id: input.originLocationId ?? null,
    destination_location_id: input.destinationLocationId ?? null,
    route_id: input.routeId ?? null,
    transport_mode_id: input.transportModeId ?? null,
    trip_status: input.tripStatus ?? 'planned',
    planned_departure_at: input.plannedDepartureAt ?? null,
    estimated_fare: input.estimatedFare ?? null,
    currency_code: input.currencyCode ?? 'PHP',
    fare_snapshot: input.fareSnapshot ?? null,
    passenger_category_id: input.passengerCategoryId ?? null,
    notes: input.notes?.trim() ?? null,
  }

  const { data, error } = await supabase
    .from('trip_history')
    .insert(row)
    .select('id')
    .single()

  if (error) {
    console.error('createTrip error:', error.message)
    return { success: false, error: error.message }
  }

  const tripId = (data as { id: string }).id

  if (input.segments && input.segments.length > 0) {
    const segRows = input.segments.map((s) => ({
      trip_history_id: tripId,
      segment_order: s.segmentOrder,
      route_id: s.routeId ?? null,
      origin_location_id: s.originLocationId ?? null,
      destination_location_id: s.destinationLocationId ?? null,
      transport_mode_id: s.transportModeId ?? null,
      fare_snapshot: s.fareSnapshot ?? null,
    }))
    const { error: segErr } = await supabase.from('trip_history_segments').insert(segRows)
    if (segErr) {
      console.error('createTrip segments error:', segErr.message)
    }
  }

  return { success: true, id: tripId }
}

// ---- Update trip ------------------------------------------------------------

export async function updateTrip(
  id: string,
  updates: Partial<Pick<
    TripHistoryRow,
    'trip_status' | 'planned_departure_at' | 'notes' | 'estimated_fare' | 'actual_fare' | 'passenger_category_id'
  >>,
): Promise<{ success: boolean; error?: string }> {
  if (updates.notes !== undefined && updates.notes && updates.notes.length > 1000) {
    return { success: false, error: 'Notes must be 1000 characters or fewer.' }
  }
  if (updates.estimated_fare !== undefined && updates.estimated_fare != null && updates.estimated_fare < 0) {
    return { success: false, error: 'Estimated fare cannot be negative.' }
  }
  if (updates.actual_fare !== undefined && updates.actual_fare != null && updates.actual_fare < 0) {
    return { success: false, error: 'Actual fare cannot be negative.' }
  }

  const clean: Record<string, unknown> = {}
  if (updates.trip_status !== undefined) {
    clean.trip_status = updates.trip_status
    if (updates.trip_status === 'started') clean.started_at = new Date().toISOString()
    if (updates.trip_status === 'completed') clean.completed_at = new Date().toISOString()
  }
  if (updates.planned_departure_at !== undefined) clean.planned_departure_at = updates.planned_departure_at
  if (updates.notes !== undefined) clean.notes = updates.notes?.trim() ?? null
  if (updates.estimated_fare !== undefined) clean.estimated_fare = updates.estimated_fare
  if (updates.actual_fare !== undefined) clean.actual_fare = updates.actual_fare
  if (updates.passenger_category_id !== undefined) clean.passenger_category_id = updates.passenger_category_id

  const { error } = await supabase.from('trip_history').update(clean).eq('id', id)
  if (error) {
    console.error('updateTrip error:', error.message)
    return { success: false, error: error.message }
  }
  return { success: true }
}

// ---- Delete trip ------------------------------------------------------------

export async function deleteTrip(id: string): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.from('trip_history').delete().eq('id', id)
  if (error) {
    console.error('deleteTrip error:', error.message)
    return { success: false, error: error.message }
  }
  return { success: true }
}

// ---- Delete multiple trips --------------------------------------------------

export async function deleteTrips(ids: string[]): Promise<{ success: boolean; error?: string }> {
  if (ids.length === 0) return { success: true }
  const { error } = await supabase.from('trip_history').delete().in('id', ids)
  if (error) {
    console.error('deleteTrips error:', error.message)
    return { success: false, error: error.message }
  }
  return { success: true }
}

// ---- Transport modes for filter dropdown ------------------------------------

export async function fetchTransportModesForFilter(): Promise<
  Array<{ id: string; name: string; code: string }>
> {
  const { data, error } = await supabase
    .from('transport_modes')
    .select('id, name, code')
    .eq('is_active', true)
    .order('name')
  if (error) {
    console.error('fetchTransportModesForFilter error:', error.message)
    return []
  }
  return (data ?? []) as Array<{ id: string; name: string; code: string }>
}

export type { TripHistorySegmentRow }
