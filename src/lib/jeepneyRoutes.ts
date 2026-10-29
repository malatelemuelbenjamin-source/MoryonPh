import { supabase } from './supabase'
import type {
  JeepneyRouteWithDetails,
  RouteStopWithLocation,
  RouteServiceDetailsRow,
  SavedRouteRow,
} from './types'

// ---- Fetch jeepney routes with stop counts --------------------------------

export async function fetchJeepneyRoutes(opts?: {
  search?: string
  municipality?: string
  originId?: string
  destinationId?: string
  direction?: string
  verificationOnly?: boolean
}): Promise<JeepneyRouteWithDetails[]> {
  // First get the jeepney transport mode id.
  const { data: modeData } = await supabase
    .from('transport_modes')
    .select('id')
    .eq('code', 'jeepney')
    .maybeSingle()
  if (!modeData) return []

  let q = supabase
    .from('routes')
    .select(`
      *,
      origin_location:locations!origin_location_id(id, name, municipality, barangay),
      destination_location:locations!destination_location_id(id, name, municipality, barangay),
      transport_mode:transport_modes(id, name, code, icon)
    `)
    .eq('transport_mode_id', modeData.id)
    .eq('route_status', 'active')
    .in('verification_status', opts?.verificationOnly === false ? ['official', 'verified', 'community'] : ['official', 'verified'])

  if (opts?.municipality && opts.municipality !== 'all') {
    q = q.or(`origin_location.municipality.eq.${opts.municipality},destination_location.municipality.eq.${opts.municipality}`)
  }
  if (opts?.originId && opts.originId !== 'all') {
    q = q.eq('origin_location_id', opts.originId)
  }
  if (opts?.destinationId && opts.destinationId !== 'all') {
    q = q.eq('destination_location_id', opts.destinationId)
  }
  if (opts?.direction && opts.direction !== 'all') {
    q = q.eq('direction', opts.direction)
  }

  const { data: routes, error } = await q.order('route_name', { ascending: true })
  if (error) {
    console.error('fetchJeepneyRoutes error:', error.message)
    return []
  }
  if (!routes || routes.length === 0) return []

  // Fetch stop counts for all routes in one query.
  const routeIds = routes.map((r: { id: string }) => r.id)
  const { data: stopCounts } = await supabase
    .from('route_stops')
    .select('route_id')
    .in('route_id', routeIds)

  const countMap = new Map<string, number>()
  for (const s of stopCounts ?? []) {
    const rid = (s as { route_id: string }).route_id
    countMap.set(rid, (countMap.get(rid) ?? 0) + 1)
  }

  return routes.map((r: Record<string, unknown>) => ({
    ...r,
    stop_count: countMap.get(r.id as string) ?? 0,
    route_service_details: null,
    is_saved: false,
  })) as JeepneyRouteWithDetails[]
}

// ---- Fetch route stops in sequence ---------------------------------------

export async function fetchRouteStops(routeId: string): Promise<RouteStopWithLocation[]> {
  const { data, error } = await supabase
    .from('route_stops')
    .select(`
      *,
      location:locations(id, name, municipality, barangay, latitude, longitude)
    `)
    .eq('route_id', routeId)
    .order('stop_sequence', { ascending: true })
  if (error) {
    console.error('fetchRouteStops error:', error.message)
    return []
  }
  return (data ?? []) as RouteStopWithLocation[]
}

// ---- Fetch service details ------------------------------------------------

export async function fetchRouteServiceDetails(routeId: string): Promise<RouteServiceDetailsRow | null> {
  const { data, error } = await supabase
    .from('route_service_details')
    .select('*')
    .eq('route_id', routeId)
    .in('verification_status', ['official', 'verified', 'community'])
    .order('verification_status', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) {
    console.error('fetchRouteServiceDetails error:', error.message)
    return null
  }
  return (data as RouteServiceDetailsRow) ?? null
}

// ---- Saved routes ---------------------------------------------------------

export async function isRouteSaved(routeId: string): Promise<boolean> {
  const { data } = await supabase
    .from('saved_routes')
    .select('id')
    .eq('route_id', routeId)
    .maybeSingle()
  return !!data
}

export async function saveRoute(routeId: string, customName?: string): Promise<boolean> {
  const { error } = await supabase
    .from('saved_routes')
    .insert({ route_id: routeId, custom_name: customName ?? null })
  if (error) {
    console.error('saveRoute error:', error.message)
    return false
  }
  return true
}

export async function unsaveRoute(routeId: string): Promise<boolean> {
  const { error } = await supabase
    .from('saved_routes')
    .delete()
    .eq('route_id', routeId)
  if (error) {
    console.error('unsaveRoute error:', error.message)
    return false
  }
  return true
}

export async function fetchSavedRoutes(): Promise<SavedRouteRow[]> {
  const { data, error } = await supabase
    .from('saved_routes')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) {
    console.error('fetchSavedRoutes error:', error.message)
    return []
  }
  return (data ?? []) as SavedRouteRow[]
}

// ---- Fetch municipalities with jeepney route data -------------------------

export async function fetchJeepneyMunicipalities(): Promise<string[]> {
  const { data: modeData } = await supabase
    .from('transport_modes')
    .select('id')
    .eq('code', 'jeepney')
    .maybeSingle()
  if (!modeData) return []

  const { data: routes } = await supabase
    .from('routes')
    .select('origin_location:locations!origin_location_id(municipality), destination_location:locations!destination_location_id(municipality)')
    .eq('transport_mode_id', modeData.id)
    .eq('route_status', 'active')
    .in('verification_status', ['official', 'verified'])

  const municipalities = new Set<string>()
  for (const r of routes ?? []) {
    const origin = r.origin_location as unknown as { municipality: string | null } | null
    const dest = r.destination_location as unknown as { municipality: string | null } | null
    if (origin?.municipality) municipalities.add(origin.municipality)
    if (dest?.municipality) municipalities.add(dest.municipality)
  }
  return Array.from(municipalities).sort()
}

// ---- Fetch available directions ------------------------------------------

export async function fetchJeepneyDirections(): Promise<string[]> {
  const { data: modeData } = await supabase
    .from('transport_modes')
    .select('id')
    .eq('code', 'jeepney')
    .maybeSingle()
  if (!modeData) return []

  const { data } = await supabase
    .from('routes')
    .select('direction')
    .eq('transport_mode_id', modeData.id)
    .eq('route_status', 'active')
    .in('verification_status', ['official', 'verified'])
    .not('direction', 'is', null)

  const directions = new Set<string>()
  for (const r of data ?? []) {
    if ((r as { direction: string | null }).direction) {
      directions.add((r as { direction: string }).direction)
    }
  }
  return Array.from(directions).sort()
}
