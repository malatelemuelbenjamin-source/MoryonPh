import { supabase } from './supabase'
import { formatPeso } from './fares'
import type {
  TricycleServiceAreaWithMunicipality,
  TricycleFareZoneWithDetails,
  TricycleZoneConnectionWithDetails,
  LocationRow,
  SavedRouteRow,
} from './types'

// ---- Municipalities ----------------------------------------------------

const SIX_MUNICIPALITIES = ['Boac', 'Buenavista', 'Gasan', 'Mogpog', 'Santa Cruz', 'Torrijos']

export async function fetchTricycleMunicipalities(): Promise<LocationRow[]> {
  const { data, error } = await supabase
    .from('locations')
    .select('*')
    .eq('type', 'municipality')
    .in('name', SIX_MUNICIPALITIES)
    .order('name', { ascending: true })

  if (error) {
    console.error('fetchTricycleMunicipalities error:', error.message)
    return []
  }
  return (data ?? []) as LocationRow[]
}

// ---- Service areas -----------------------------------------------------

export async function fetchServiceAreas(municipalityId?: string): Promise<TricycleServiceAreaWithMunicipality[]> {
  let q = supabase
    .from('tricycle_service_areas')
    .select('*, municipality:locations!municipality_id(id, name, municipality)')
    .in('verification_status', ['official', 'verified', 'community'])
    .order('name', { ascending: true })

  if (municipalityId && municipalityId !== 'all') {
    q = q.eq('municipality_id', municipalityId)
  }

  const { data, error } = await q
  if (error) {
    console.error('fetchServiceAreas error:', error.message)
    return []
  }
  return (data ?? []) as TricycleServiceAreaWithMunicipality[]
}

export async function fetchServiceArea(id: string): Promise<TricycleServiceAreaWithMunicipality | null> {
  const { data, error } = await supabase
    .from('tricycle_service_areas')
    .select('*, municipality:locations!municipality_id(id, name, municipality)')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    console.error('fetchServiceArea error:', error.message)
    return null
  }
  return (data as TricycleServiceAreaWithMunicipality) ?? null
}

// ---- Fare zones --------------------------------------------------------

export async function fetchFareZones(municipalityId?: string, serviceAreaId?: string): Promise<TricycleFareZoneWithDetails[]> {
  let q = supabase
    .from('tricycle_fare_zones')
    .select('*, municipality:locations!municipality_id(id, name, municipality), service_area:tricycle_service_areas!service_area_id(id, name)')
    .in('verification_status', ['official', 'verified', 'community'])
    .order('name', { ascending: true })

  if (municipalityId && municipalityId !== 'all') {
    q = q.eq('municipality_id', municipalityId)
  }
  if (serviceAreaId && serviceAreaId !== 'all') {
    q = q.eq('service_area_id', serviceAreaId)
  }

  const { data, error } = await q
  if (error) {
    console.error('fetchFareZones error:', error.message)
    return []
  }
  return (data ?? []) as TricycleFareZoneWithDetails[]
}

// ---- Zone connections --------------------------------------------------

export async function fetchZoneConnections(opts?: {
  originZoneId?: string
  destinationZoneId?: string
  municipalityId?: string
}): Promise<TricycleZoneConnectionWithDetails[]> {
  let q = supabase
    .from('tricycle_zone_connections')
    .select(`
      *,
      origin_zone:tricycle_fare_zones!origin_zone_id(id, name),
      destination_zone:tricycle_fare_zones!destination_zone_id(id, name),
      route:routes(id, route_name, route_code),
      fare:fares(id, base_fare, fare_type, effective_from, effective_until, verification_status, currency)
    `)
    .in('verification_status', ['official', 'verified', 'community'])
    .order('created_at', { ascending: false })

  if (opts?.originZoneId && opts.originZoneId !== 'all') {
    q = q.eq('origin_zone_id', opts.originZoneId)
  }
  if (opts?.destinationZoneId && opts.destinationZoneId !== 'all') {
    q = q.eq('destination_zone_id', opts.destinationZoneId)
  }

  const { data, error } = await q
  if (error) {
    console.error('fetchZoneConnections error:', error.message)
    return []
  }
  return (data ?? []) as TricycleZoneConnectionWithDetails[]
}

export async function fetchConnectionsForServiceArea(serviceAreaId: string): Promise<TricycleZoneConnectionWithDetails[]> {
  const { data: zones } = await supabase
    .from('tricycle_fare_zones')
    .select('id')
    .eq('service_area_id', serviceAreaId)

  if (!zones || zones.length === 0) return []
  const zoneIds = zones.map((z: { id: string }) => z.id)

  const { data, error } = await supabase
    .from('tricycle_zone_connections')
    .select(`
      *,
      origin_zone:tricycle_fare_zones!origin_zone_id(id, name),
      destination_zone:tricycle_fare_zones!destination_zone_id(id, name),
      route:routes(id, route_name, route_code),
      fare:fares(id, base_fare, fare_type, effective_from, effective_until, verification_status, currency)
    `)
    .in('verification_status', ['official', 'verified', 'community'])
    .or(`origin_zone_id.in.(${zoneIds.join(',')}),destination_zone_id.in.(${zoneIds.join(',')})`)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('fetchConnectionsForServiceArea error:', error.message)
    return []
  }
  return (data ?? []) as TricycleZoneConnectionWithDetails[]
}

// ---- Tricycle routes (from existing routes table filtered by transport mode) ----

export async function fetchTricycleRoutes(municipalityId?: string): Promise<{
  id: string
  route_name: string
  route_code: string | null
  origin_location: { id: string; name: string; municipality: string | null } | null
  destination_location: { id: string; name: string; municipality: string | null } | null
  estimated_duration_minutes: number | null
  verification_status: string
}[]> {
  const { data: modeData } = await supabase
    .from('transport_modes')
    .select('id')
    .eq('code', 'tricycle')
    .maybeSingle()
  if (!modeData) return []

  let q = supabase
    .from('routes')
    .select(`
      id, route_name, route_code, estimated_duration_minutes, verification_status,
      origin_location:locations!origin_location_id(id, name, municipality),
      destination_location:locations!destination_location_id(id, name, municipality)
    `)
    .eq('transport_mode_id', modeData.id)
    .eq('route_status', 'active')
    .in('verification_status', ['official', 'verified', 'community'])
    .order('route_name', { ascending: true })

  if (municipalityId && municipalityId !== 'all') {
    q = q.eq('origin_location_id', municipalityId)
  }

  const { data, error } = await q
  if (error) {
    console.error('fetchTricycleRoutes error:', error.message)
    return []
  }
  return (data ?? []) as unknown as {
    id: string
    route_name: string
    route_code: string | null
    origin_location: { id: string; name: string; municipality: string | null } | null
    destination_location: { id: string; name: string; municipality: string | null } | null
    estimated_duration_minutes: number | null
    verification_status: string
  }[]
}

// ---- Location search for origin/destination ----------------------------

export async function searchTricycleLocations(query: string, municipalityId?: string): Promise<LocationRow[]> {
  const term = query.trim().toLowerCase()
  if (!term) return []

  let q = supabase
    .from('locations')
    .select('*')
    .eq('is_searchable', true)
    .in('verification_status', ['official', 'verified', 'community'])
    .ilike('normalized_name', `${term}%`)
    .order('name', { ascending: true })
    .limit(10)

  if (municipalityId && municipalityId !== 'all') {
    q = q.eq('municipality', municipalityId)
  }

  const { data, error } = await q
  if (error) {
    console.error('searchTricycleLocations error:', error.message)
    return []
  }
  return (data ?? []) as LocationRow[]
}

// ---- Saved journeys ----------------------------------------------------

export async function saveTricycleJourney(opts: {
  routeId?: string
  originLocationId?: string
  destinationLocationId?: string
  customName?: string
}): Promise<boolean> {
  const { error } = await supabase.from('saved_routes').insert({
    route_id: opts.routeId ?? null,
    origin_location_id: opts.originLocationId ?? null,
    destination_location_id: opts.destinationLocationId ?? null,
    custom_name: opts.customName ?? null,
  })
  if (error) {
    console.error('saveTricycleJourney error:', error.message)
    return false
  }
  return true
}

export async function unsaveTricycleJourney(id: string): Promise<boolean> {
  const { error } = await supabase.from('saved_routes').delete().eq('id', id)
  if (error) {
    console.error('unsaveTricycleJourney error:', error.message)
    return false
  }
  return true
}

export async function fetchSavedTricycleJourneys(): Promise<SavedRouteRow[]> {
  const { data: modeData } = await supabase
    .from('transport_modes')
    .select('id')
    .eq('code', 'tricycle')
    .maybeSingle()

  let q = supabase
    .from('saved_routes')
    .select('*')
    .order('created_at', { ascending: false })

  if (modeData) {
    q = q.eq('transport_mode_id', modeData.id)
  } else {
    q = q.not('origin_location_id', 'is', null)
  }

  const { data, error } = await q
  if (error) {
    console.error('fetchSavedTricycleJourneys error:', error.message)
    return []
  }
  return (data ?? []) as SavedRouteRow[]
}

// ---- Helpers -----------------------------------------------------------

export function coverageTypeLabel(t: string): string {
  switch (t) {
    case 'barangay': return 'Barangay'
    case 'terminal': return 'Terminal'
    case 'zone': return 'Zone'
    case 'landmark': return 'Landmark'
    case 'custom_area': return 'Custom Area'
    default: return t
  }
}

export function serviceTypeLabel(t: string): string {
  switch (t) {
    case 'shared': return 'Shared Ride'
    case 'special': return 'Special Ride'
    case 'unspecified': return 'Unspecified'
    default: return t
  }
}

export function formatFareDisplay(fare: { base_fare: number; currency: string } | null): string {
  if (!fare) return 'Fare not yet verified'
  return formatPeso(Number(fare.base_fare))
}
