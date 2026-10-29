import { supabase } from './supabase'
import { formatPeso } from './fares'
import type {
  PortWithLocation,
  ScheduleWithDetails,
  SeaRouteWithDetails,
  FareRow,
  SavedRouteRow,
} from './types'

// ---- Ports -------------------------------------------------------------

export async function fetchPorts(): Promise<PortWithLocation[]> {
  const { data, error } = await supabase
    .from('ports')
    .select('*, location:locations!location_id(id, name, municipality, barangay, latitude, longitude)')
    .in('verification_status', ['official', 'verified', 'community'])
    .order('port_name', { ascending: true })

  if (error) {
    console.error('fetchPorts error:', error.message)
    return []
  }
  return (data ?? []) as PortWithLocation[]
}

export async function fetchPort(id: string): Promise<PortWithLocation | null> {
  const { data, error } = await supabase
    .from('ports')
    .select('*, location:locations!location_id(id, name, municipality, barangay, latitude, longitude)')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    console.error('fetchPort error:', error.message)
    return null
  }
  return (data as PortWithLocation) ?? null
}

// ---- Sea transport routes (ferry + roro) --------------------------------

export async function fetchSeaTransportRoutes(opts?: {
  transportMode?: 'ferry' | 'roro' | 'all'
  originPortId?: string
  destinationPortId?: string
}): Promise<SeaRouteWithDetails[]> {
  const modeCodes = opts?.transportMode === 'roro' ? ['roro'] : opts?.transportMode === 'ferry' ? ['ferry'] : ['ferry', 'roro']

  const { data: modes } = await supabase
    .from('transport_modes')
    .select('id, code')
    .in('code', modeCodes)
  if (!modes || modes.length === 0) return []
  const modeIds = modes.map((m: { id: string }) => m.id)

  let q = supabase
    .from('routes')
    .select(`
      id, route_name, route_code, description, origin_location_id, destination_location_id,
      transport_mode_id, operator_name, estimated_duration_minutes, verification_status,
      source, last_verified_at,
      origin_location:locations!origin_location_id(id, name, municipality),
      destination_location:locations!destination_location_id(id, name, municipality),
      transport_mode:transport_modes(id, name, code)
    `)
    .in('transport_mode_id', modeIds)
    .eq('route_status', 'active')
    .in('verification_status', ['official', 'verified', 'community'])
    .order('route_name', { ascending: true })

  const { data: routes, error } = await q
  if (error) {
    console.error('fetchSeaTransportRoutes error:', error.message)
    return []
  }
  if (!routes || routes.length === 0) return []

  // Fetch ports linked to origin/destination locations
  const locationIds = routes.flatMap((r: Record<string, unknown>) => [
    r.origin_location_id as string,
    r.destination_location_id as string,
  ])
  const { data: portsData } = await supabase
    .from('ports')
    .select('id, port_name, location_id')
    .in('location_id', locationIds)
    .in('verification_status', ['official', 'verified', 'community'])

  const portByLocation = new Map<string, { id: string; port_name: string }>()
  for (const p of portsData ?? []) {
    portByLocation.set((p as { location_id: string }).location_id, {
      id: (p as { id: string }).id,
      port_name: (p as { port_name: string }).port_name,
    })
  }

  return routes.map((r: Record<string, unknown>) => ({
    ...(r as unknown as SeaRouteWithDetails),
    origin_port: portByLocation.get(r.origin_location_id as string) ?? null,
    destination_port: portByLocation.get(r.destination_location_id as string) ?? null,
  }))
}

// ---- Schedules ---------------------------------------------------------

export async function fetchSchedules(opts?: {
  routeId?: string
  departurePortId?: string
  arrivalPortId?: string
}): Promise<ScheduleWithDetails[]> {
  let q = supabase
    .from('sea_transport_schedules')
    .select(`
      *,
      route:routes(id, route_name, transport_mode_id, operator_name),
      departure_port:ports!departure_port_id(id, port_name),
      arrival_port:ports!arrival_port_id(id, port_name)
    `)
    .in('verification_status', ['official', 'verified', 'community'])
    .order('departure_datetime', { ascending: true })

  if (opts?.routeId && opts.routeId !== 'all') {
    q = q.eq('route_id', opts.routeId)
  }
  if (opts?.departurePortId && opts.departurePortId !== 'all') {
    q = q.eq('departure_port_id', opts.departurePortId)
  }
  if (opts?.arrivalPortId && opts.arrivalPortId !== 'all') {
    q = q.eq('arrival_port_id', opts.arrivalPortId)
  }

  const { data, error } = await q
  if (error) {
    console.error('fetchSchedules error:', error.message)
    return []
  }
  return (data ?? []) as ScheduleWithDetails[]
}

export async function fetchSchedulesForPort(portId: string): Promise<ScheduleWithDetails[]> {
  const { data, error } = await supabase
    .from('sea_transport_schedules')
    .select(`
      *,
      route:routes(id, route_name, transport_mode_id, operator_name),
      departure_port:ports!departure_port_id(id, port_name),
      arrival_port:ports!arrival_port_id(id, port_name)
    `)
    .in('verification_status', ['official', 'verified', 'community'])
    .or(`departure_port_id.eq.${portId},arrival_port_id.eq.${portId}`)
    .order('departure_datetime', { ascending: true })

  if (error) {
    console.error('fetchSchedulesForPort error:', error.message)
    return []
  }
  return (data ?? []) as ScheduleWithDetails[]
}

// ---- Fares for sea transport routes -------------------------------------

export async function fetchFaresForRoute(routeId: string): Promise<FareRow[]> {
  const { data, error } = await supabase
    .from('fares')
    .select('*')
    .eq('route_id', routeId)
    .in('verification_status', ['official', 'verified', 'community'])
    .order('base_fare', { ascending: true })

  if (error) {
    console.error('fetchFaresForRoute error:', error.message)
    return []
  }
  return (data ?? []) as FareRow[]
}

// ---- Alerts for a location ---------------------------------------------

export async function fetchAlertsForLocation(locationId: string): Promise<{
  id: string
  title: string
  description: string | null
  category: string
  priority: string
  start_at: string | null
  end_at: string | null
  verification_status: string
  source: string | null
}[]> {
  const { data, error } = await supabase
    .from('local_alerts')
    .select('id, title, description, category, priority, start_at, end_at, verification_status, source')
    .eq('affected_location_id', locationId)
    .in('verification_status', ['official', 'verified', 'community'])
    .in('category', ['ferry', 'transport', 'weather', 'emergency'])
    .order('created_at', { ascending: false })

  if (error) {
    console.error('fetchAlertsForLocation error:', error.message)
    return []
  }
  return (data ?? []) as {
    id: string
    title: string
    description: string | null
    category: string
    priority: string
    start_at: string | null
    end_at: string | null
    verification_status: string
    source: string | null
  }[]
}

// ---- Saved journeys ----------------------------------------------------

export async function saveSeaJourney(opts: {
  routeId?: string
  customName?: string
}): Promise<boolean> {
  const { error } = await supabase.from('saved_routes').insert({
    route_id: opts.routeId ?? null,
    custom_name: opts.customName ?? null,
  })
  if (error) {
    console.error('saveSeaJourney error:', error.message)
    return false
  }
  return true
}

export async function unsaveSeaJourney(id: string): Promise<boolean> {
  const { error } = await supabase.from('saved_routes').delete().eq('id', id)
  if (error) {
    console.error('unsaveSeaJourney error:', error.message)
    return false
  }
  return true
}

export async function fetchSavedSeaJourneys(): Promise<SavedRouteRow[]> {
  const { data: modes } = await supabase
    .from('transport_modes')
    .select('id')
    .in('code', ['ferry', 'roro'])

  if (!modes || modes.length === 0) return []
  const modeIds = modes.map((m: { id: string }) => m.id)

  const { data: routes } = await supabase
    .from('routes')
    .select('id')
    .in('transport_mode_id', modeIds)

  if (!routes || routes.length === 0) return []
  const routeIds = routes.map((r: { id: string }) => r.id)

  const { data, error } = await supabase
    .from('saved_routes')
    .select('*')
    .in('route_id', routeIds)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('fetchSavedSeaJourneys error:', error.message)
    return []
  }
  return (data ?? []) as SavedRouteRow[]
}

// ---- Helpers -----------------------------------------------------------

export function portTypeLabel(t: string): string {
  switch (t) {
    case 'passenger': return 'Passenger'
    case 'roro': return 'RORO'
    case 'cargo': return 'Cargo'
    case 'mixed': return 'Mixed'
    case 'unknown': return 'Unknown'
    default: return t
  }
}

export function operatingStatusLabel(s: string): string {
  switch (s) {
    case 'operational': return 'Operational'
    case 'temporarily_closed': return 'Temporarily Closed'
    case 'unknown': return 'Status Unknown'
    default: return s
  }
}

export function operatingStatusClass(s: string): string {
  switch (s) {
    case 'operational': return 'bg-leaf-400/20 text-leaf-700'
    case 'temporarily_closed': return 'bg-red-100 text-red-700'
    default: return 'bg-sand-200 text-ocean-700'
  }
}

export function scheduleTypeLabel(t: string): string {
  switch (t) {
    case 'regular': return 'Regular'
    case 'special': return 'Special Trip'
    case 'one_time': return 'One-Time'
    default: return t
  }
}

export function scheduleStatusLabel(s: string): string {
  switch (s) {
    case 'scheduled': return 'Scheduled'
    case 'delayed': return 'Delayed'
    case 'cancelled': return 'Cancelled'
    case 'completed': return 'Completed'
    default: return 'Unknown'
  }
}

export function scheduleStatusClass(s: string): string {
  switch (s) {
    case 'scheduled': return 'bg-leaf-400/20 text-leaf-700'
    case 'delayed': return 'bg-terra-100 text-terra-700'
    case 'cancelled': return 'bg-red-100 text-red-700'
    case 'completed': return 'bg-ocean-100 text-ocean-800'
    default: return 'bg-sand-200 text-ocean-700'
  }
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return 'Not yet confirmed'
  const d = new Date(iso)
  return d.toLocaleString('en-PH', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function formatFare(amount: number): string {
  return formatPeso(amount)
}
