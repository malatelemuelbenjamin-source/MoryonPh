import { supabase } from './supabase'
import { fetchFaresForRoute, isFareCurrent, formatPeso } from './fares'
import { fetchRoutesBetween } from './routes'
import { fetchAlertsForMunicipality } from './transportAlerts'
import { fetchWeather } from './weather'
import { MUNICIPALITIES as EXPLORE_MUNIS } from './explore'
import type {
  TouristItineraryRow,
  TouristItineraryDayRow,
  TouristItineraryStopRow,
  TouristItineraryLegRow,
  TouristItineraryExpenseRow,
  TouristItineraryWithDetails,
  ItineraryStopWithDetails,
  ItineraryLegWithDetails,
  ItineraryExpenseWithStop,
  ItineraryStatus,
  FareSourceStatus,
  ItineraryExpenseCategory,
  ItineraryExpenseSource,
  LocationRow,
  DestinationWithDetails,
  RouteWithDetails,
} from './types'

// ---- Constants -----------------------------------------------------------

export const MUNICIPALITIES = EXPLORE_MUNIS

export const STATUS_LABELS: Record<ItineraryStatus, string> = {
  draft: 'Draft',
  planned: 'Planned',
  in_progress: 'In Progress',
  completed: 'Completed',
  archived: 'Archived',
}

export const STATUS_ORDER: ItineraryStatus[] = ['draft', 'planned', 'in_progress', 'completed', 'archived']

export const FARE_SOURCE_LABELS: Record<FareSourceStatus, string> = {
  verified: 'Verified Fare',
  estimated: 'Estimated',
  user_entered: 'User-Entered',
  unavailable: 'Route Information Unavailable',
}

export const EXPENSE_CATEGORY_LABELS: Record<ItineraryExpenseCategory, string> = {
  transportation: 'Transportation',
  entrance_fee: 'Entrance Fees',
  accommodation: 'Accommodation',
  food: 'Food & Dining',
  other: 'Other',
}

export const EXPENSE_SOURCE_LABELS: Record<ItineraryExpenseSource, string> = {
  verified: 'Verified',
  estimated: 'Estimated',
  user_entered: 'User-Entered',
}

export function statusClasses(s: ItineraryStatus): string {
  switch (s) {
    case 'draft': return 'bg-sand-200 text-ocean-700'
    case 'planned': return 'bg-ocean-100 text-ocean-800'
    case 'in_progress': return 'bg-leaf-100 text-leaf-700'
    case 'completed': return 'bg-leaf-600 text-white'
    case 'archived': return 'bg-sand-200 text-ocean-500'
  }
}

// ---- Create itinerary ----------------------------------------------------

export interface NewItineraryInput {
  title: string
  description?: string
  start_date?: string | null
  end_date?: string | null
  starting_location_id?: string | null
  traveler_count?: number
  budget_amount?: number
  currency_code?: string
  preferences?: Record<string, unknown> | null
}

export async function createItinerary(
  input: NewItineraryInput,
): Promise<{ success: boolean; id?: string; error?: string }> {
  if (!input.title.trim()) {
    return { success: false, error: 'Trip name is required.' }
  }
  if (input.start_date && input.end_date && input.end_date < input.start_date) {
    return { success: false, error: 'End date cannot be before start date.' }
  }
  if (input.traveler_count != null && input.traveler_count < 1) {
    return { success: false, error: 'Number of travelers must be at least 1.' }
  }

  const { data, error } = await supabase
    .from('tourist_itineraries')
    .insert({
      title: input.title.trim(),
      description: input.description?.trim() || null,
      start_date: input.start_date ?? null,
      end_date: input.end_date ?? null,
      starting_location_id: input.starting_location_id ?? null,
      traveler_count: input.traveler_count ?? 1,
      budget_amount: input.budget_amount ?? 0,
      currency_code: input.currency_code ?? 'PHP',
      preferences: input.preferences ?? {},
      status: 'draft',
    })
    .select('id')
    .maybeSingle()

  if (error) {
    console.error('createItinerary error:', error.message)
    return { success: false, error: friendlyError(error.message) }
  }
  return { success: true, id: (data as { id: string } | null)?.id }
}

// ---- Fetch itineraries ---------------------------------------------------

export async function fetchMyItineraries(): Promise<TouristItineraryRow[]> {
  const { data, error } = await supabase
    .from('tourist_itineraries')
    .select('*')
    .neq('status', 'archived')
    .order('updated_at', { ascending: false })

  if (error) {
    console.error('fetchMyItineraries error:', error.message)
    return []
  }
  return (data ?? []) as TouristItineraryRow[]
}

export async function fetchArchivedItineraries(): Promise<TouristItineraryRow[]> {
  const { data, error } = await supabase
    .from('tourist_itineraries')
    .select('*')
    .eq('status', 'archived')
    .order('updated_at', { ascending: false })

  if (error) {
    console.error('fetchArchivedItineraries error:', error.message)
    return []
  }
  return (data ?? []) as TouristItineraryRow[]
}

// ---- Fetch full itinerary detail -----------------------------------------

export async function fetchItineraryDetail(id: string): Promise<TouristItineraryWithDetails | null> {
  const { data: iti, error: itiErr } = await supabase
    .from('tourist_itineraries')
    .select('*, starting_location:locations!starting_location_id(id, name, municipality)')
    .eq('id', id)
    .maybeSingle()

  if (itiErr || !iti) {
    console.error('fetchItineraryDetail error:', itiErr?.message ?? 'not found')
    return null
  }

  const itinerary = iti as TouristItineraryWithDetails

  // Fetch days
  const { data: days } = await supabase
    .from('tourist_itinerary_days')
    .select('*')
    .eq('itinerary_id', id)
    .order('day_number', { ascending: true })

  // Fetch stops
  const { data: stops } = await supabase
    .from('tourist_itinerary_stops')
    .select(
      '*, destination:destinations(id, name, municipality, latitude, longitude, entrance_fee, opening_hours, verification_status), location:locations(id, name, municipality, latitude, longitude)',
    )
    .eq('itinerary_id', id)
    .order('stop_order', { ascending: true })

  // Fetch legs
  const { data: legs } = await supabase
    .from('tourist_itinerary_legs')
    .select(
      '*, route:routes(id, route_name, route_code, estimated_duration_minutes), transport_mode:transport_modes(id, name, code, icon), from_stop:tourist_itinerary_stops!from_stop_id(id, custom_title, destination_id, location_id), to_stop:tourist_itinerary_stops!to_stop_id(id, custom_title, destination_id, location_id)',
    )
    .eq('itinerary_id', id)
    .order('leg_order', { ascending: true })

  // Fetch expenses
  const { data: expenses } = await supabase
    .from('tourist_itinerary_expenses')
    .select('*, stop:tourist_itinerary_stops(id, custom_title)')
    .eq('itinerary_id', id)
    .order('created_at', { ascending: false })

  // Group stops by day
  const dayRows = (days ?? []) as TouristItineraryDayRow[]
  const stopRows = (stops ?? []) as ItineraryStopWithDetails[]
  const legRows = (legs ?? []) as ItineraryLegWithDetails[]
  const expRows = (expenses ?? []) as ItineraryExpenseWithStop[]

  itinerary.days = dayRows.map((d) => ({
    ...d,
    stops: stopRows.filter((s) => s.itinerary_day_id === d.id),
  }))
  // Stops without a day assignment
  const unassigned = stopRows.filter((s) => !s.itinerary_day_id)
  if (unassigned.length > 0 && dayRows.length === 0) {
    itinerary.days = [{ id: 'none', itinerary_id: id, day_number: 0, trip_date: null, notes: null, created_at: '', updated_at: '', stops: unassigned }]
  }
  itinerary.legs = legRows
  itinerary.expenses = expRows

  return itinerary
}

// ---- Fetch shared itinerary (public, by token) ---------------------------

export async function fetchSharedItinerary(token: string): Promise<TouristItineraryWithDetails | null> {
  const { data: iti, error } = await supabase
    .from('tourist_itineraries')
    .select('*, starting_location:locations!starting_location_id(id, name, municipality)')
    .eq('share_token', token)
    .eq('is_shared', true)
    .neq('status', 'archived')
    .maybeSingle()

  if (error || !iti) {
    return null
  }

  const itinerary = iti as TouristItineraryWithDetails

  const { data: stops } = await supabase
    .from('tourist_itinerary_stops')
    .select('*, destination:destinations(id, name, municipality, latitude, longitude, entrance_fee, opening_hours, verification_status), location:locations(id, name, municipality, latitude, longitude)')
    .eq('itinerary_id', itinerary.id)
    .order('stop_order', { ascending: true })

  const { data: days } = await supabase
    .from('tourist_itinerary_days')
    .select('*')
    .eq('itinerary_id', itinerary.id)
    .order('day_number', { ascending: true })

  const { data: legs } = await supabase
    .from('tourist_itinerary_legs')
    .select('*, route:routes(id, route_name, route_code, estimated_duration_minutes), transport_mode:transport_modes(id, name, code, icon), from_stop:tourist_itinerary_stops!from_stop_id(id, custom_title, destination_id, location_id), to_stop:tourist_itinerary_stops!to_stop_id(id, custom_title, destination_id, location_id)')
    .eq('itinerary_id', itinerary.id)
    .order('leg_order', { ascending: true })

  const dayRows = (days ?? []) as TouristItineraryDayRow[]
  const stopRows = (stops ?? []) as ItineraryStopWithDetails[]
  const legRows = (legs ?? []) as ItineraryLegWithDetails[]

  itinerary.days = dayRows.map((d) => ({
    ...d,
    stops: stopRows.filter((s) => s.itinerary_day_id === d.id),
  }))
  itinerary.legs = legRows
  itinerary.expenses = []

  return itinerary
}

// ---- Update itinerary ----------------------------------------------------

export async function updateItinerary(
  id: string,
  updates: Partial<Pick<TouristItineraryRow, 'title' | 'description' | 'start_date' | 'end_date' | 'starting_location_id' | 'traveler_count' | 'budget_amount' | 'currency_code' | 'status' | 'preferences'>>,
): Promise<{ success: boolean; error?: string }> {
  if (updates.title !== undefined && !updates.title.trim()) {
    return { success: false, error: 'Trip name cannot be empty.' }
  }
  if (updates.start_date && updates.end_date && updates.end_date < updates.start_date) {
    return { success: false, error: 'End date cannot be before start date.' }
  }
  if (updates.traveler_count != null && updates.traveler_count < 1) {
    return { success: false, error: 'Number of travelers must be at least 1.' }
  }

  const { error } = await supabase
    .from('tourist_itineraries')
    .update(updates)
    .eq('id', id)

  if (error) {
    console.error('updateItinerary error:', error.message)
    return { success: false, error: friendlyError(error.message) }
  }
  return { success: true }
}

// ---- Delete / archive / duplicate ---------------------------------------

export async function deleteItinerary(id: string): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('tourist_itineraries')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('deleteItinerary error:', error.message)
    return { success: false, error: friendlyError(error.message) }
  }
  return { success: true }
}

export async function archiveItinerary(id: string): Promise<{ success: boolean; error?: string }> {
  return updateItinerary(id, { status: 'archived' })
}

export async function restoreItinerary(id: string): Promise<{ success: boolean; error?: string }> {
  return updateItinerary(id, { status: 'draft' })
}

export async function duplicateItinerary(id: string): Promise<{ success: boolean; newId?: string; error?: string }> {
  const original = await fetchItineraryDetail(id)
  if (!original) {
    return { success: false, error: 'Itinerary not found.' }
  }

  const { success, id: newId, error } = await createItinerary({
    title: `${original.title} (Copy)`,
    description: original.description ?? undefined,
    start_date: original.start_date,
    end_date: original.end_date,
    starting_location_id: original.starting_location_id,
    traveler_count: original.traveler_count,
    budget_amount: Number(original.budget_amount),
    currency_code: original.currency_code,
    preferences: original.preferences,
  })

  if (!success || !newId) {
    return { success: false, error: error ?? 'Failed to create copy.' }
  }

  // Copy days + stops
  for (const day of original.days) {
    if (day.day_number === 0) {
      // Unassigned stops — copy them directly
      for (const stop of day.stops) {
        await addStop(newId, {
          destination_id: stop.destination_id,
          location_id: stop.location_id,
          custom_title: stop.custom_title,
          custom_location_description: stop.custom_location_description,
          custom_latitude: stop.custom_latitude,
          custom_longitude: stop.custom_longitude,
          stop_order: stop.stop_order,
          is_rest_break: stop.is_rest_break,
          user_notes: stop.user_notes ?? undefined,
        })
      }
      continue
    }

    const { success: dayOk, id: dayId } = await addDay(newId, day.day_number, day.trip_date, day.notes ?? undefined)
    if (!dayOk || !dayId) continue

    for (const stop of day.stops) {
      await addStop(newId, {
        itinerary_day_id: dayId,
        destination_id: stop.destination_id,
        location_id: stop.location_id,
        custom_title: stop.custom_title,
        custom_location_description: stop.custom_location_description,
        custom_latitude: stop.custom_latitude,
        custom_longitude: stop.custom_longitude,
        stop_order: stop.stop_order,
        planned_arrival_time: stop.planned_arrival_time ?? undefined,
        planned_departure_time: stop.planned_departure_time ?? undefined,
        estimated_duration_minutes: stop.estimated_duration_minutes ?? undefined,
        is_rest_break: stop.is_rest_break,
        user_notes: stop.user_notes ?? undefined,
      })
    }
  }

  return { success: true, newId }
}

// ---- Days ----------------------------------------------------------------

export async function addDay(
  itineraryId: string,
  dayNumber: number,
  tripDate?: string | null,
  notes?: string,
): Promise<{ success: boolean; id?: string; error?: string }> {
  const { data, error } = await supabase
    .from('tourist_itinerary_days')
    .insert({
      itinerary_id: itineraryId,
      day_number: dayNumber,
      trip_date: tripDate ?? null,
      notes: notes?.trim() || null,
    })
    .select('id')
    .maybeSingle()

  if (error) {
    console.error('addDay error:', error.message)
    return { success: false, error: friendlyError(error.message) }
  }
  return { success: true, id: (data as { id: string } | null)?.id }
}

export async function updateDay(
  id: string,
  updates: Partial<Pick<TouristItineraryDayRow, 'day_number' | 'trip_date' | 'notes'>>,
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('tourist_itinerary_days')
    .update(updates)
    .eq('id', id)

  if (error) {
    console.error('updateDay error:', error.message)
    return { success: false, error: friendlyError(error.message) }
  }
  return { success: true }
}

export async function deleteDay(id: string): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('tourist_itinerary_days')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('deleteDay error:', error.message)
    return { success: false, error: friendlyError(error.message) }
  }
  return { success: true }
}

export async function duplicateDay(itineraryId: string, dayId: string): Promise<{ success: boolean; error?: string }> {
  const itinerary = await fetchItineraryDetail(itineraryId)
  if (!itinerary) return { success: false, error: 'Itinerary not found.' }

  const sourceDay = itinerary.days.find((d) => d.id === dayId)
  if (!sourceDay) return { success: false, error: 'Day not found.' }

  const maxDayNum = Math.max(...itinerary.days.map((d) => d.day_number), 0)
  const { success, id: newDayId, error } = await addDay(itineraryId, maxDayNum + 1, sourceDay.trip_date, sourceDay.notes ?? undefined)
  if (!success || !newDayId) return { success: false, error: error ?? 'Failed to create day.' }

  for (const stop of sourceDay.stops) {
    await addStop(itineraryId, {
      itinerary_day_id: newDayId,
      destination_id: stop.destination_id,
      location_id: stop.location_id,
      custom_title: stop.custom_title,
      custom_location_description: stop.custom_location_description,
      custom_latitude: stop.custom_latitude,
      custom_longitude: stop.custom_longitude,
      stop_order: stop.stop_order,
      planned_arrival_time: stop.planned_arrival_time ?? undefined,
      planned_departure_time: stop.planned_departure_time ?? undefined,
      estimated_duration_minutes: stop.estimated_duration_minutes ?? undefined,
      is_rest_break: stop.is_rest_break,
      user_notes: stop.user_notes ?? undefined,
    })
  }

  return { success: true }
}

// ---- Stops ----------------------------------------------------------------

export interface NewStopInput {
  itinerary_day_id?: string | null
  destination_id?: string | null
  location_id?: string | null
  custom_title?: string | null
  custom_location_description?: string | null
  custom_latitude?: number | null
  custom_longitude?: number | null
  stop_order?: number
  planned_arrival_time?: string | null
  planned_departure_time?: string | null
  estimated_duration_minutes?: number | null
  is_rest_break?: boolean
  user_notes?: string | null
}

export async function addStop(
  itineraryId: string,
  input: NewStopInput,
): Promise<{ success: boolean; id?: string; error?: string }> {
  // Auto-assign stop_order if not provided
  let stopOrder = input.stop_order
  if (stopOrder == null) {
    const { count } = await supabase
      .from('tourist_itinerary_stops')
      .select('*', { count: 'exact', head: true })
      .eq('itinerary_id', itineraryId)
    stopOrder = (count ?? 0) + 1
  }

  const { data, error } = await supabase
    .from('tourist_itinerary_stops')
    .insert({
      itinerary_id: itineraryId,
      itinerary_day_id: input.itinerary_day_id ?? null,
      destination_id: input.destination_id ?? null,
      location_id: input.location_id ?? null,
      custom_title: input.custom_title?.trim() || null,
      custom_location_description: input.custom_location_description?.trim() || null,
      custom_latitude: input.custom_latitude ?? null,
      custom_longitude: input.custom_longitude ?? null,
      stop_order: stopOrder,
      planned_arrival_time: input.planned_arrival_time ?? null,
      planned_departure_time: input.planned_departure_time ?? null,
      estimated_duration_minutes: input.estimated_duration_minutes ?? null,
      is_rest_break: input.is_rest_break ?? false,
      user_notes: input.user_notes?.trim() || null,
    })
    .select('id')
    .maybeSingle()

  if (error) {
    console.error('addStop error:', error.message)
    return { success: false, error: friendlyError(error.message) }
  }
  return { success: true, id: (data as { id: string } | null)?.id }
}

export async function updateStop(
  id: string,
  updates: Partial<Pick<TouristItineraryStopRow, 'itinerary_day_id' | 'destination_id' | 'location_id' | 'custom_title' | 'custom_location_description' | 'custom_latitude' | 'custom_longitude' | 'stop_order' | 'planned_arrival_time' | 'planned_departure_time' | 'estimated_duration_minutes' | 'is_rest_break' | 'user_notes'>>,
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('tourist_itinerary_stops')
    .update(updates)
    .eq('id', id)

  if (error) {
    console.error('updateStop error:', error.message)
    return { success: false, error: friendlyError(error.message) }
  }
  return { success: true }
}

export async function deleteStop(id: string): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('tourist_itinerary_stops')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('deleteStop error:', error.message)
    return { success: false, error: friendlyError(error.message) }
  }
  return { success: true }
}

export async function reorderStops(_itineraryId: string, orderedStopIds: string[]): Promise<{ success: boolean; error?: string }> {
  for (let i = 0; i < orderedStopIds.length; i++) {
    const { error } = await supabase
      .from('tourist_itinerary_stops')
      .update({ stop_order: i + 1 })
      .eq('id', orderedStopIds[i])
    if (error) {
      console.error('reorderStops error:', error.message)
      return { success: false, error: friendlyError(error.message) }
    }
  }
  return { success: true }
}

export async function moveStopToDay(stopId: string, dayId: string | null): Promise<{ success: boolean; error?: string }> {
  return updateStop(stopId, { itinerary_day_id: dayId })
}

// ---- Legs (transport between stops) --------------------------------------

export interface LegInfo {
  routeId: string | null
  transportModeId: string | null
  estimatedFare: number | null
  fareSourceStatus: FareSourceStatus
  estimatedDurationMinutes: number | null
  notes?: string | null
}

/**
 * Attempt to find transport routes between two stops' locations.
 * Returns possible legs sorted by direct routes first.
 */
export async function findTransportBetweenStops(
  fromStop: ItineraryStopWithDetails,
  toStop: ItineraryStopWithDetails,
): Promise<{ routes: RouteWithDetails[]; error: string | null }> {
  // Resolve location IDs for each stop
  const fromLocId = fromStop.location_id ?? fromStop.location?.id ?? null
  const toLocId = toStop.location_id ?? toStop.location?.id ?? null

  if (!fromLocId || !toLocId) {
    return { routes: [], error: 'Location information unavailable for one or both stops.' }
  }

  const routes = await fetchRoutesBetween(fromLocId, toLocId)
  return { routes, error: routes.length === 0 ? 'No direct route found between these stops.' : null }
}

/**
 * Auto-generate legs for all consecutive stop pairs in the itinerary.
 * Uses the existing route planner to find routes between stops.
 * Only creates legs for stops that have location data.
 */
export async function autoGenerateLegs(itineraryId: string): Promise<{ success: boolean; created: number; unavailable: number; error?: string }> {
  const itinerary = await fetchItineraryDetail(itineraryId)
  if (!itinerary) return { success: false, created: 0, unavailable: 0, error: 'Itinerary not found.' }

  // Collect all stops in order (flattened across days)
  const allStops: ItineraryStopWithDetails[] = []
  for (const day of itinerary.days) {
    allStops.push(...day.stops)
  }

  if (allStops.length < 2) {
    return { success: false, created: 0, unavailable: 0, error: 'At least 2 stops are needed to generate transport legs.' }
  }

  // Delete existing legs
  await supabase.from('tourist_itinerary_legs').delete().eq('itinerary_id', itineraryId)

  let created = 0
  let unavailable = 0
  let legOrder = 1

  for (let i = 0; i < allStops.length - 1; i++) {
    const from = allStops[i]
    const to = allStops[i + 1]

    // Skip rest breaks
    if (from.is_rest_break || to.is_rest_break) continue

    const { routes } = await findTransportBetweenStops(from, to)

    if (routes.length === 0) {
      // Create a leg with unavailable status
      await supabase.from('tourist_itinerary_legs').insert({
        itinerary_id: itineraryId,
        from_stop_id: from.id,
        to_stop_id: to.id,
        route_id: null,
        transport_mode_id: null,
        leg_order: legOrder++,
        estimated_fare: null,
        fare_source_status: 'unavailable',
        estimated_duration_minutes: null,
        notes: 'Route information unavailable',
      })
      unavailable++
      continue
    }

    // Use the first (best) route
    const route = routes[0]
    const fares = await fetchFaresForRoute(route.id)
    const currentFares = fares.filter(isFareCurrent)
    const fare = currentFares.length > 0 ? currentFares[0] : null

    let fareAmount: number | null = null
    let fareStatus: FareSourceStatus = 'unavailable'
    if (fare) {
      fareAmount = Number(fare.base_fare)
      fareStatus = fare.verification_status === 'official' || fare.verification_status === 'verified' ? 'verified' : 'estimated'
    }

    await supabase.from('tourist_itinerary_legs').insert({
      itinerary_id: itineraryId,
      from_stop_id: from.id,
      to_stop_id: to.id,
      route_id: route.id,
      transport_mode_id: route.transport_mode_id,
      leg_order: legOrder++,
      estimated_fare: fareAmount,
      currency_code: 'PHP',
      fare_source_status: fareStatus,
      estimated_duration_minutes: route.estimated_duration_minutes ?? null,
      notes: null,
    })
    created++
  }

  return { success: true, created, unavailable }
}

export async function updateLeg(
  id: string,
  updates: Partial<Pick<TouristItineraryLegRow, 'route_id' | 'transport_mode_id' | 'estimated_fare' | 'fare_source_status' | 'estimated_duration_minutes' | 'notes'>>,
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('tourist_itinerary_legs')
    .update(updates)
    .eq('id', id)

  if (error) {
    console.error('updateLeg error:', error.message)
    return { success: false, error: friendlyError(error.message) }
  }
  return { success: true }
}

export async function deleteLeg(id: string): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('tourist_itinerary_legs')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('deleteLeg error:', error.message)
    return { success: false, error: friendlyError(error.message) }
  }
  return { success: true }
}

// ---- Expenses ------------------------------------------------------------

export async function addExpense(
  itineraryId: string,
  input: { category: ItineraryExpenseCategory; amount: number; currency_code?: string; description?: string; stop_id?: string | null; source_type?: ItineraryExpenseSource },
): Promise<{ success: boolean; id?: string; error?: string }> {
  if (input.amount < 0) {
    return { success: false, error: 'Amount cannot be negative.' }
  }
  const { data, error } = await supabase
    .from('tourist_itinerary_expenses')
    .insert({
      itinerary_id: itineraryId,
      stop_id: input.stop_id ?? null,
      category: input.category,
      amount: input.amount,
      currency_code: input.currency_code ?? 'PHP',
      description: input.description?.trim() || null,
      source_type: input.source_type ?? 'user_entered',
    })
    .select('id')
    .maybeSingle()

  if (error) {
    console.error('addExpense error:', error.message)
    return { success: false, error: friendlyError(error.message) }
  }
  return { success: true, id: (data as { id: string } | null)?.id }
}

export async function updateExpense(
  id: string,
  updates: Partial<Pick<TouristItineraryExpenseRow, 'category' | 'amount' | 'currency_code' | 'description' | 'stop_id' | 'source_type'>>,
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('tourist_itinerary_expenses')
    .update(updates)
    .eq('id', id)

  if (error) {
    console.error('updateExpense error:', error.message)
    return { success: false, error: friendlyError(error.message) }
  }
  return { success: true }
}

export async function deleteExpense(id: string): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('tourist_itinerary_expenses')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('deleteExpense error:', error.message)
    return { success: false, error: friendlyError(error.message) }
  }
  return { success: true }
}

// ---- Cost Estimator ------------------------------------------------------

export interface CostBreakdown {
  transportationTotal: number
  entranceFeesTotal: number
  accommodationTotal: number
  foodTotal: number
  otherTotal: number
  userExpensesTotal: number
  grandTotal: number
  perTraveler: number
  currency: string
  legs: { id: string; fare: number | null; fareSource: FareSourceStatus; label: string }[]
  incomplete: boolean
  notes: string[]
}

export function calculateTripCost(itinerary: TouristItineraryWithDetails): CostBreakdown {
  const notes: string[] = []
  const currency = itinerary.currency_code || 'PHP'

  // Transportation from legs
  const legs: CostBreakdown['legs'] = []
  let transportationTotal = 0
  let hasUnavailableLegs = false

  for (const leg of itinerary.legs) {
    const fare = leg.estimated_fare != null ? Number(leg.estimated_fare) : null
    legs.push({
      id: leg.id,
      fare,
      fareSource: leg.fare_source_status,
      label: leg.route?.route_name ?? 'Transport leg',
    })
    if (fare != null) {
      // Multiply by traveler count for transportation
      transportationTotal += fare * itinerary.traveler_count
    } else {
      hasUnavailableLegs = true
    }
  }

  if (hasUnavailableLegs) {
    notes.push('Some transport legs have no fare information. Transportation total may be incomplete.')
  }

  // Entrance fees from destinations
  let entranceFeesTotal = 0
  let hasUnknownFees = false
  const allStops = itinerary.days.flatMap((d) => d.stops)
  for (const stop of allStops) {
    if (stop.is_rest_break) continue
    if (stop.destination?.entrance_fee) {
      const fee = parseEntranceFee(stop.destination.entrance_fee)
      if (fee != null) {
        entranceFeesTotal += fee * itinerary.traveler_count
      } else {
        hasUnknownFees = true
      }
    }
  }
  if (hasUnknownFees) {
    notes.push('Some destinations have entrance fee information that could not be parsed. Fees may be incomplete.')
  }

  // User-entered expenses by category
  let accommodationTotal = 0
  let foodTotal = 0
  let otherTotal = 0
  let userTransportation = 0

  for (const exp of itinerary.expenses) {
    const amt = Number(exp.amount) || 0
    switch (exp.category) {
      case 'transportation':
        userTransportation += amt
        break
      case 'entrance_fee':
        entranceFeesTotal += amt
        break
      case 'accommodation':
        accommodationTotal += amt
        break
      case 'food':
        foodTotal += amt
        break
      case 'other':
        otherTotal += amt
        break
    }
  }

  transportationTotal += userTransportation
  const userExpensesTotal = accommodationTotal + foodTotal + otherTotal
  const grandTotal = transportationTotal + entranceFeesTotal + accommodationTotal + foodTotal + otherTotal
  const perTraveler = itinerary.traveler_count > 0 ? grandTotal / itinerary.traveler_count : grandTotal

  return {
    transportationTotal,
    entranceFeesTotal,
    accommodationTotal,
    foodTotal,
    otherTotal,
    userExpensesTotal,
    grandTotal,
    perTraveler,
    currency,
    legs,
    incomplete: hasUnavailableLegs || hasUnknownFees,
    notes,
  }
}

function parseEntranceFee(raw: string): number | null {
  // Entrance fees are stored as text; try to extract a numeric value.
  const match = raw.match(/(\d+(?:\.\d+)?)/)
  if (match) return parseFloat(match[1])
  if (raw.toLowerCase().includes('free')) return 0
  return null
}

export function formatCurrency(amount: number, currency = 'PHP'): string {
  if (currency === 'PHP') return formatPeso(amount)
  return `${currency} ${amount.toFixed(2)}`
}

// ---- Route Optimization (geographic nearest-neighbor) --------------------

export interface OptimizationResult {
  optimizedOrder: string[]
  method: string
  note: string
}

/**
 * Suggest a more efficient stop order using nearest-neighbor based on
 * verified destination coordinates. This is a geographic suggestion only,
 * NOT based on road distance or travel time.
 */
export function suggestOptimizedOrder(stops: ItineraryStopWithDetails[]): OptimizationResult | null {
  const withCoords = stops.filter((s) => {
    const lat = s.custom_latitude ?? s.destination?.latitude ?? s.location?.latitude
    const lng = s.custom_longitude ?? s.destination?.longitude ?? s.location?.longitude
    return lat != null && lng != null
  })

  if (withCoords.length < 3) {
    return null
  }

  // Nearest-neighbor starting from the first stop
  const ordered: ItineraryStopWithDetails[] = [withCoords[0]]
  const remaining = withCoords.slice(1)

  while (remaining.length > 0) {
    const last = ordered[ordered.length - 1]
    const lastLat = last.custom_latitude ?? last.destination?.latitude ?? last.location?.latitude
    const lastLng = last.custom_longitude ?? last.destination?.longitude ?? last.location?.longitude

    let bestIdx = 0
    let bestDist = Infinity

    for (let i = 0; i < remaining.length; i++) {
      const lat = remaining[i].custom_latitude ?? remaining[i].destination?.latitude ?? remaining[i].location?.latitude
      const lng = remaining[i].custom_longitude ?? remaining[i].destination?.longitude ?? remaining[i].location?.longitude
      const dist = haversine(lastLat!, lastLng!, lat!, lng!)
      if (dist < bestDist) {
        bestDist = dist
        bestIdx = i
      }
    }

    ordered.push(remaining[bestIdx])
    remaining.splice(bestIdx, 1)
  }

  // Stops without coordinates go at the end in original order
  const withoutCoords = stops.filter((s) => {
    const lat = s.custom_latitude ?? s.destination?.latitude ?? s.location?.latitude
    const lng = s.custom_longitude ?? s.destination?.longitude ?? s.location?.longitude
    return lat == null || lng == null
  })

  const final = [...ordered, ...withoutCoords]
  return {
    optimizedOrder: final.map((s) => s.id),
    method: 'Geographic nearest-neighbor',
    note: 'This suggestion is based on straight-line distance between coordinates, not road distance or travel time. It may not reflect actual road conditions or transport availability.',
  }
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ---- Sharing -------------------------------------------------------------

export async function enableSharing(itineraryId: string): Promise<{ success: boolean; token?: string; error?: string }> {
  const token = crypto.randomUUID()
  const { error } = await supabase
    .from('tourist_itineraries')
    .update({ is_shared: true, share_token: token })
    .eq('id', itineraryId)

  if (error) {
    console.error('enableSharing error:', error.message)
    return { success: false, error: friendlyError(error.message) }
  }
  return { success: true, token }
}

export async function disableSharing(itineraryId: string): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('tourist_itineraries')
    .update({ is_shared: false, share_token: null })
    .eq('id', itineraryId)

  if (error) {
    console.error('disableSharing error:', error.message)
    return { success: false, error: friendlyError(error.message) }
  }
  return { success: true }
}

// ---- Weather & Alerts Integration ----------------------------------------

export async function fetchWeatherForItinerary(municipality: string) {
  return fetchWeather(municipality)
}

export async function fetchAlertsForItinerary(municipalities: string[]) {
  const allAlerts = await Promise.all(municipalities.map((m) => fetchAlertsForMunicipality(m)))
  // Deduplicate by alert id
  const seen = new Set<string>()
  const deduped: Awaited<ReturnType<typeof fetchAlertsForMunicipality>>[number][] = []
  for (const alerts of allAlerts) {
    for (const a of alerts) {
      if (!seen.has(a.id)) {
        seen.add(a.id)
        deduped.push(a)
      }
    }
  }
  return deduped
}

// ---- Destination search for adding stops ---------------------------------

export async function searchDestinationsForItinerary(
  query: string,
  municipality?: string,
): Promise<DestinationWithDetails[]> {
  let q = supabase
    .from('destinations')
    .select('*, category:explore_categories(id, name, slug, icon), location:locations(id, name, municipality)')
    .eq('is_published', true)
    .in('verification_status', ['verified', 'pending_review'])

  const term = query.trim()
  if (term) {
    q = q.or(`name.ilike.%${term}%,description.ilike.%${term}%`)
  }
  if (municipality && municipality !== 'all') {
    q = q.eq('municipality', municipality)
  }

  const { data, error } = await q.order('name', { ascending: true }).limit(30)
  if (error) {
    console.error('searchDestinationsForItinerary error:', error.message)
    return []
  }
  return (data ?? []) as DestinationWithDetails[]
}

// ---- Locations search for starting location ------------------------------

export async function searchLocationsForItinerary(query: string): Promise<LocationRow[]> {
  const term = query.trim().toLowerCase()
  if (!term) return []
  const { data, error } = await supabase
    .from('locations')
    .select('*')
    .eq('is_searchable', true)
    .in('verification_status', ['official', 'verified', 'community'])
    .or(`name.ilike.%${term}%,normalized_name.ilike.%${term}%`)
    .order('name', { ascending: true })
    .limit(15)

  if (error) {
    console.error('searchLocationsForItinerary error:', error.message)
    return []
  }
  return (data ?? []) as LocationRow[]
}

// ---- Helpers -------------------------------------------------------------

function friendlyError(msg: string): string {
  if (msg.includes('row-level security')) {
    return 'You do not have permission to perform this action. Please sign in.'
  }
  if (msg.includes('duplicate')) {
    return 'This may already exist. Please check and try again.'
  }
  return msg
}

// ---- Opening hours check -------------------------------------------------

/**
 * Check if a planned visit time conflicts with known opening hours.
 * Returns a warning string if there's a potential conflict.
 */
export function checkOpeningHoursConflict(
  openingHours: Record<string, unknown> | null,
  plannedTime: string | null,
): string | null {
  if (!openingHours || !plannedTime) return null

  // Opening hours format varies; we do a basic check.
  // If we can't parse the structure, don't claim a conflict.
  try {
    const dayName = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
    const dayHours = (openingHours as Record<string, string>)[dayName]
    if (!dayHours) return null

    if (dayHours.toLowerCase() === 'closed') {
      return 'This destination may be closed on the planned visit day. Please verify opening hours.'
    }

    // Try to parse hours like "08:00-17:00"
    const match = dayHours.match(/(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})/)
    if (match) {
      const open = match[1]
      const close = match[2]
      if (plannedTime < open || plannedTime > close) {
        return `Planned time ${plannedTime} is outside the known opening hours (${open}–${close}).`
      }
    }
    return null
  } catch {
    return null
  }
}
