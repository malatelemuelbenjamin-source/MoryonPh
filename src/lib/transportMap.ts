import { supabase } from './supabase'
import type {
  LocationRow,
  RouteRow,
  RouteGeometryRow,
  TransportModeRow,
  SavedPlaceWithLocation,
} from './types'

// ---- Map locations with coordinates ------------------------------------

export interface MapLocation extends Pick<
  LocationRow,
  'id' | 'name' | 'type' | 'municipality' | 'barangay' | 'latitude' | 'longitude' | 'verification_status'
> {
  route_count?: number
}

export async function fetchMapLocations(opts?: {
  transportModeCode?: string
  locationType?: string
}): Promise<MapLocation[]> {
  let q = supabase
    .from('locations')
    .select('id, name, type, municipality, barangay, latitude, longitude, verification_status')
    .not('latitude', 'is', null)
    .not('longitude', 'is', null)
    .in('verification_status', ['official', 'verified', 'community'])
    .order('name', { ascending: true })

  if (opts?.locationType && opts.locationType !== 'all') {
    q = q.eq('type', opts.locationType)
  }

  const { data, error } = await q
  if (error) {
    console.error('fetchMapLocations error:', error.message)
    return []
  }
  return (data ?? []) as MapLocation[]
}

// ---- Transport modes ---------------------------------------------------

export async function fetchTransportModes(): Promise<TransportModeRow[]> {
  const { data, error } = await supabase
    .from('transport_modes')
    .select('*')
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (error) {
    console.error('fetchTransportModes error:', error.message)
    return []
  }
  return (data ?? []) as TransportModeRow[]
}

// ---- Routes with transport mode info -----------------------------------

export interface MapRoute extends Pick<
  RouteRow,
  'id' | 'route_name' | 'route_code' | 'origin_location_id' | 'destination_location_id' |
  'transport_mode_id' | 'operator_name' | 'estimated_duration_minutes' | 'verification_status'
> {
  origin_location: Pick<LocationRow, 'id' | 'name' | 'latitude' | 'longitude'> | null
  destination_location: Pick<LocationRow, 'id' | 'name' | 'latitude' | 'longitude'> | null
  transport_mode: Pick<TransportModeRow, 'id' | 'name' | 'code'> | null
}

export async function fetchMapRoutes(transportModeCode?: string): Promise<MapRoute[]> {
  let modeIds: string[] = []
  if (transportModeCode && transportModeCode !== 'all') {
    const { data: modeData } = await supabase
      .from('transport_modes')
      .select('id')
      .eq('code', transportModeCode)
      .maybeSingle()
    if (!modeData) return []
    modeIds = [modeData.id]
  }

  let q = supabase
    .from('routes')
    .select(`
      id, route_name, route_code, origin_location_id, destination_location_id,
      transport_mode_id, operator_name, estimated_duration_minutes, verification_status,
      origin_location:locations!origin_location_id(id, name, latitude, longitude),
      destination_location:locations!destination_location_id(id, name, latitude, longitude),
      transport_mode:transport_modes(id, name, code)
    `)
    .eq('route_status', 'active')
    .in('verification_status', ['official', 'verified', 'community'])
    .order('route_name', { ascending: true })

  if (modeIds.length > 0) {
    q = q.in('transport_mode_id', modeIds)
  }

  const { data, error } = await q
  if (error) {
    console.error('fetchMapRoutes error:', error.message)
    return []
  }
  return (data ?? []) as unknown as MapRoute[]
}

// ---- Route geometry ----------------------------------------------------

export async function fetchRouteGeometry(routeId: string): Promise<RouteGeometryRow | null> {
  const { data, error } = await supabase
    .from('route_geometries')
    .select('*')
    .eq('route_id', routeId)
    .in('verification_status', ['official', 'verified'])
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('fetchRouteGeometry error:', error.message)
    return null
  }
  return (data as RouteGeometryRow) ?? null
}

// ---- Route stops for a route -------------------------------------------

export async function fetchRouteStopsForMap(routeId: string): Promise<{
  id: string
  stop_sequence: number
  stop_type: string
  location: Pick<LocationRow, 'id' | 'name' | 'latitude' | 'longitude'> | null
}[]> {
  const { data, error } = await supabase
    .from('route_stops')
    .select(`
      id, stop_sequence, stop_type,
      location:locations(id, name, latitude, longitude)
    `)
    .eq('route_id', routeId)
    .order('stop_sequence', { ascending: true })

  if (error) {
    console.error('fetchRouteStopsForMap error:', error.message)
    return []
  }
  return (data ?? []) as unknown as {
    id: string
    stop_sequence: number
    stop_type: string
    location: Pick<LocationRow, 'id' | 'name' | 'latitude' | 'longitude'> | null
  }[]
}

// ---- Active alerts -----------------------------------------------------

export interface MapAlert {
  id: string
  title: string
  description: string | null
  category: string
  priority: string
  affected_location_id: string | null
  start_at: string | null
  end_at: string | null
  verification_status: string
  source: string | null
}

export async function fetchMapAlerts(): Promise<MapAlert[]> {
  const { data, error } = await supabase
    .from('local_alerts')
    .select('id, title, description, category, priority, affected_location_id, start_at, end_at, verification_status, source')
    .in('verification_status', ['official', 'verified'])
    .order('created_at', { ascending: false })

  if (error) {
    console.error('fetchMapAlerts error:', error.message)
    return []
  }

  const now = new Date().toISOString()
  return ((data ?? []) as MapAlert[]).filter((a) => {
    if (a.end_at && a.end_at < now) return false
    return true
  })
}

// ---- Location search ---------------------------------------------------

export async function searchMapLocations(query: string): Promise<LocationRow[]> {
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
    console.error('searchMapLocations error:', error.message)
    return []
  }
  return (data ?? []) as LocationRow[]
}

// ---- Saved places ------------------------------------------------------

export async function saveMapPlace(opts: {
  locationId: string
  customName?: string
  category?: 'home' | 'school' | 'work' | 'favorite' | 'custom'
}): Promise<boolean> {
  const { error } = await supabase.from('saved_places').insert({
    location_id: opts.locationId,
    custom_name: opts.customName ?? null,
    category: opts.category ?? 'favorite',
  })
  if (error) {
    console.error('saveMapPlace error:', error.message)
    return false
  }
  return true
}

export async function unsaveMapPlace(id: string): Promise<boolean> {
  const { error } = await supabase.from('saved_places').delete().eq('id', id)
  if (error) {
    console.error('unsaveMapPlace error:', error.message)
    return false
  }
  return true
}

export async function fetchSavedPlaces(): Promise<SavedPlaceWithLocation[]> {
  const { data, error } = await supabase
    .from('saved_places')
    .select('*, location:locations(id, name, municipality, barangay)')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('fetchSavedPlaces error:', error.message)
    return []
  }
  return (data ?? []) as SavedPlaceWithLocation[]
}

export async function isPlaceSaved(locationId: string): Promise<{ saved: boolean; id: string | null }> {
  const { data, error } = await supabase
    .from('saved_places')
    .select('id')
    .eq('location_id', locationId)
    .maybeSingle()

  if (error) {
    console.error('isPlaceSaved error:', error.message)
    return { saved: false, id: null }
  }
  return { saved: !!data, id: (data as { id: string } | null)?.id ?? null }
}
