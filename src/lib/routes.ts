import { supabase } from './supabase'
import type {
  LocationRow,
  PlannedRoute,
  PlannedRouteLeg,
  RouteConnectionRow,
  RouteStopWithLocation,
  RouteWithDetails,
  TransportModeRow,
  VerificationStatus,
} from './types'

// ---- Transport modes ----------------------------------------------------

export async function getTransportModes(): Promise<TransportModeRow[]> {
  const { data, error } = await supabase
    .from('transport_modes')
    .select('*')
    .eq('is_active', true)
    .order('name', { ascending: true })
  if (error) {
    console.error('getTransportModes error:', error.message)
    return []
  }
  return (data ?? []) as TransportModeRow[]
}

// ---- Locations (shared with Feature #1) ---------------------------------

export async function searchLocationsForRouting(
  query: string,
  limit = 10,
): Promise<LocationRow[]> {
  const term = query.trim().toLowerCase()
  if (!term) return []

  const { data, error } = await supabase
    .from('locations')
    .select('*')
    .eq('is_searchable', true)
    .or(
      `normalized_name.ilike.${term}%,municipality.ilike.%${term}%,barangay.ilike.%${term}%`,
    )
    .order('name', { ascending: true })
    .limit(limit)

  if (error) {
    console.error('searchLocationsForRouting error:', error.message)
    return []
  }
  return (data ?? []) as LocationRow[]
}

// ---- Routes -------------------------------------------------------------

export async function fetchRoutesBetween(
  fromId: string,
  toId: string,
): Promise<RouteWithDetails[]> {
  const { data, error } = await supabase
    .from('routes')
    .select(
      '*, origin_location:locations!origin_location_id(id, name, municipality, barangay), destination_location:locations!destination_location_id(id, name, municipality, barangay), transport_mode:transport_modes(id, name, code, icon)',
    )
    .eq('route_status', 'active')
    .in('verification_status', ['official', 'verified', 'community'])
    .or(
      `and(origin_location_id.eq.${fromId},destination_location_id.eq.${toId})`,
    )
    .order('estimated_duration_minutes', { ascending: true, nullsFirst: false })

  if (error) {
    console.error('fetchRoutesBetween error:', error.message)
    return []
  }
  return (data ?? []) as RouteWithDetails[]
}

async function fetchRouteStops(routeId: string): Promise<RouteStopWithLocation[]> {
  const { data, error } = await supabase
    .from('route_stops')
    .select(
      '*, location:locations(id, name, municipality, barangay, latitude, longitude)',
    )
    .eq('route_id', routeId)
    .order('stop_sequence', { ascending: true })

  if (error) {
    console.error('fetchRouteStops error:', error.message)
    return []
  }
  return (data ?? []) as RouteStopWithLocation[]
}

async function fetchConnectionsFromRoute(
  routeId: string,
): Promise<RouteConnectionRow[]> {
  const { data, error } = await supabase
    .from('route_connections')
    .select('*')
    .eq('from_route_id', routeId)
    .in('verification_status', ['official', 'verified', 'community'])
  if (error) {
    console.error('fetchConnectionsFromRoute error:', error.message)
    return []
  }
  return (data ?? []) as RouteConnectionRow[]
}

function rankVerification(s: VerificationStatus): number {
  switch (s) {
    case 'official':
      return 0
    case 'verified':
      return 1
    case 'community':
      return 2
    default:
      return 3
  }
}

// ---- Main planner entry -------------------------------------------------

export interface PlanResult {
  routes: PlannedRoute[]
  error: string | null
}

export async function planRoutes(
  from: LocationRow,
  to: LocationRow,
): Promise<PlanResult> {
  // 1. Direct routes
  const directRoutes = await fetchRoutesBetween(from.id, to.id)
  const directLegs: PlannedRouteLeg[] = []
  for (const r of directRoutes) {
    const stops = await fetchRouteStops(r.id)
    directLegs.push({ route: r, stops })
  }

  const plans: PlannedRoute[] = directLegs.map((leg) => ({
    id: leg.route.id,
    legs: [leg],
    transfers: 0,
    estimatedDurationMinutes: leg.route.estimated_duration_minutes,
    walkingMinutes: null,
    verificationStatus: leg.route.verification_status,
  }))

  // 2. One-transfer routes: from -> X, X -> to via a verified connection.
  if (from.id !== to.id) {
    const firstLegRoutes = await fetchAllRoutesFromOrigin(from.id)
    for (const first of firstLegRoutes) {
      const destOfFirst = first.destination_location_id
      if (destOfFirst === to.id) continue // already a direct route
      const connections = await fetchConnectionsFromRoute(first.id)
      const transferLocs = new Set(
        connections.map((c) => c.transfer_location_id),
      )
      if (!transferLocs.has(destOfFirst)) continue

      // Find a second route from the transfer location to the destination.
      const secondRoutes = await fetchRoutesBetween(destOfFirst, to.id)
      for (const second of secondRoutes) {
        if (second.id === first.id) continue
        const [firstStops, secondStops] = await Promise.all([
          fetchRouteStops(first.id),
          fetchRouteStops(second.id),
        ])
        const totalMin =
          (first.estimated_duration_minutes ?? 0) +
          (second.estimated_duration_minutes ?? 0) ||
          null
        const worse = worseVerification(
          first.verification_status,
          second.verification_status,
        )
        plans.push({
          id: `${first.id}__${second.id}`,
          legs: [
            { route: first, stops: firstStops },
            { route: second, stops: secondStops },
          ],
          transfers: 1,
          estimatedDurationMinutes: totalMin,
          walkingMinutes: null,
          verificationStatus: worse,
        })
      }
    }
  }

  // 3. Rank: direct first, then fewest transfers, shortest duration, least walking,
  //    official verification.
  plans.sort((a, b) => {
    if (a.transfers !== b.transfers) return a.transfers - b.transfers
    const ad = a.estimatedDurationMinutes ?? Number.MAX_SAFE_INTEGER
    const bd = b.estimatedDurationMinutes ?? Number.MAX_SAFE_INTEGER
    if (ad !== bd) return ad - bd
    const aw = a.walkingMinutes ?? 0
    const bw = b.walkingMinutes ?? 0
    if (aw !== bw) return aw - bw
    return rankVerification(a.verificationStatus) - rankVerification(b.verificationStatus)
  })

  return { routes: plans, error: null }
}

async function fetchAllRoutesFromOrigin(fromId: string): Promise<RouteWithDetails[]> {
  const { data, error } = await supabase
    .from('routes')
    .select(
      '*, origin_location:locations!origin_location_id(id, name, municipality, barangay), destination_location:locations!destination_location_id(id, name, municipality, barangay), transport_mode:transport_modes(id, name, code, icon)',
    )
    .eq('route_status', 'active')
    .in('verification_status', ['official', 'verified', 'community'])
    .eq('origin_location_id', fromId)
  if (error) {
    console.error('fetchAllRoutesFromOrigin error:', error.message)
    return []
  }
  return (data ?? []) as RouteWithDetails[]
}

function worseVerification(a: VerificationStatus, b: VerificationStatus): VerificationStatus {
  return rankVerification(a) >= rankVerification(b) ? a : b
}

// ---- Single route detail (for Route Detail screen) ----------------------

export async function getRouteDetail(routeId: string): Promise<RouteWithDetails | null> {
  const { data, error } = await supabase
    .from('routes')
    .select(
      '*, origin_location:locations!origin_location_id(id, name, municipality, barangay), destination_location:locations!destination_location_id(id, name, municipality, barangay), transport_mode:transport_modes(id, name, code, icon)',
    )
    .eq('id', routeId)
    .maybeSingle()

  if (error) {
    console.error('getRouteDetail error:', error.message)
    return null
  }
  return (data as RouteWithDetails) ?? null
}
