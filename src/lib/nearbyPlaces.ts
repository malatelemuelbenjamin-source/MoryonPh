import { supabase } from './supabase'
import type {
  NearbyPlace,
  NearbyPlaceCategory,
  NearbyPlaceCategoryGroup,
  NearbyPlaceDetailRow,
  LocationRow,
  LocationType,
} from './types'

// ---- Category groups -----------------------------------------------------

export const CATEGORY_GROUPS: NearbyPlaceCategoryGroup[] = [
  {
    id: 'daily_needs',
    label: 'Daily Needs',
    icon: '🛍️',
    categories: ['restaurant', 'cafe_bakery', 'grocery_market', 'convenience_store', 'local_shop', 'public_market'],
  },
  {
    id: 'essential_services',
    label: 'Essential Services',
    icon: '🏥',
    categories: ['pharmacy', 'hospital_clinic', 'health_center', 'atm_bank', 'police_station', 'fire_station', 'government_office', 'gas_station', 'public_toilet'],
  },
  {
    id: 'transportation',
    label: 'Transportation',
    icon: '🚐',
    categories: ['jeepney_stop', 'tricycle_terminal', 'bus_terminal', 'port', 'ferry_terminal', 'boat_service'],
  },
  {
    id: 'travel_tourism',
    label: 'Travel & Tourism',
    icon: '🏖️',
    categories: ['tourist_attraction', 'beach', 'historical_cultural', 'accommodation', 'visitor_info'],
  },
]

export const CATEGORY_LABELS: Record<NearbyPlaceCategory, string> = {
  restaurant: 'Restaurants & Eateries',
  cafe_bakery: 'Cafés & Bakeries',
  grocery_market: 'Grocery Stores & Markets',
  convenience_store: 'Convenience Stores',
  local_shop: 'Local Shops',
  public_market: 'Public Markets',
  pharmacy: 'Pharmacies',
  hospital_clinic: 'Hospitals & Clinics',
  health_center: 'Health Centers',
  atm_bank: 'ATMs & Banks',
  police_station: 'Police Stations',
  fire_station: 'Fire Stations',
  government_office: 'Government Offices',
  gas_station: 'Gas Stations',
  public_toilet: 'Public Toilets',
  jeepney_stop: 'Jeepney Stops & Terminals',
  tricycle_terminal: 'Tricycle Terminals',
  bus_terminal: 'Bus Terminals',
  port: 'Ports',
  ferry_terminal: 'Ferry & RORO Terminals',
  boat_service: 'Boat Service Points',
  tourist_attraction: 'Tourist Attractions',
  beach: 'Beaches',
  historical_cultural: 'Historical & Cultural Sites',
  accommodation: 'Accommodation',
  visitor_info: 'Visitor Information Centers',
  other: 'Other',
}

// Maps existing location_type to a nearby place category when no
// nearby_place_details row exists. Lets us surface existing locations
// (terminals, ports, markets, hospitals, etc.) as nearby places.
const LOCATION_TYPE_TO_CATEGORY: Partial<Record<LocationType, NearbyPlaceCategory>> = {
  terminal: 'jeepney_stop',
  port: 'port',
  market: 'public_market',
  hospital: 'hospital_clinic',
  school: 'other',
  business: 'local_shop',
  tourist_destination: 'tourist_attraction',
  landmark: 'tourist_attraction',
  other: 'other',
}

// ---- Distance calculation (Haversine) ------------------------------------

export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

export function formatDistance(km: number | null): string {
  if (km === null) return ''
  if (km < 1) return `${Math.round(km * 1000)} m away`
  return `${km.toFixed(1)} km away`
}

// ---- Radius options -------------------------------------------------------

export const RADIUS_OPTIONS = [
  { value: 0.5, label: '500 m' },
  { value: 1, label: '1 km' },
  { value: 3, label: '3 km' },
  { value: 5, label: '5 km' },
  { value: 10, label: '10 km' },
  { value: 0, label: 'Any' },
]

// ---- Fetch nearby places -------------------------------------------------

export interface NearbyPlacesQuery {
  search?: string
  municipality?: string
  category?: NearbyPlaceCategory | 'all'
  categoryGroup?: string
  radiusKm?: number
  userLat?: number | null
  userLng?: number | null
  limit?: number
}

export async function fetchNearbyPlaces(opts: NearbyPlacesQuery): Promise<NearbyPlace[]> {
  const {
    search = '',
    municipality,
    category = 'all',
    categoryGroup,
    radiusKm,
    userLat = null,
    userLng = null,
    limit = 50,
  } = opts

  // Build category filter
  let categories: NearbyPlaceCategory[] | null = null
  if (category !== 'all' && category) {
    categories = [category]
  } else if (categoryGroup) {
    const group = CATEGORY_GROUPS.find((g) => g.id === categoryGroup)
    if (group) categories = group.categories
  }

  // Query locations joined with nearby_place_details (left join — many
  // existing locations won't have a details row, so we infer category from
  // location_type as a fallback).
  let query = supabase
    .from('locations')
    .select(
      '*, nearby_details:nearby_place_details(*)',
    )
    .eq('is_searchable', true)
    .in('verification_status', ['official', 'verified', 'community'])

  if (municipality && municipality !== 'all') {
    query = query.eq('municipality', municipality)
  }

  const term = search.trim()
  if (term) {
    query = query.or(`name.ilike.%${term}%,normalized_name.ilike.%${term}%,description.ilike.%${term}%`)
  }

  const { data, error } = await query.order('name', { ascending: true }).limit(limit * 2)

  if (error) {
    console.error('fetchNearbyPlaces error:', error.message)
    return []
  }

  let places = (data ?? []) as unknown as (LocationRow & { nearby_details: NearbyPlaceDetailRow | null })[]

  // Filter by category
  if (categories) {
    places = places.filter((p) => {
      const cat = getPlaceCategory(p)
      return cat ? categories.includes(cat) : false
    })
  }

  // Calculate distances and filter by radius
  const withDistance: NearbyPlace[] = places.map((p) => {
    let distance: number | null = null
    if (userLat !== null && userLng !== null && p.latitude && p.longitude) {
      distance = haversineKm(userLat, userLng, p.latitude, p.longitude)
    }
    return { ...p, distance_km: distance }
  })

  let filtered = withDistance
  if (radiusKm && radiusKm > 0 && userLat !== null && userLng !== null) {
    filtered = filtered.filter(
      (p) => p.distance_km !== null && p.distance_km <= radiusKm,
    )
  }

  // Sort: places with distance by distance, then alphabetical
  filtered.sort((a, b) => {
    if (a.distance_km !== null && b.distance_km !== null) return a.distance_km - b.distance_km
    if (a.distance_km !== null) return -1
    if (b.distance_km !== null) return 1
    return a.name.localeCompare(b.name)
  })

  return filtered.slice(0, limit)
}

// ---- Get place category (from details or inferred from location type) ----

export function getPlaceCategory(
  place: LocationRow & { nearby_details: NearbyPlaceDetailRow | null },
): NearbyPlaceCategory | null {
  if (place.nearby_details && place.nearby_details.category) {
    return place.nearby_details.category
  }
  return LOCATION_TYPE_TO_CATEGORY[place.type] ?? null
}

// ---- Fetch single place with details ------------------------------------

export async function fetchNearbyPlace(id: string): Promise<NearbyPlace | null> {
  const { data, error } = await supabase
    .from('locations')
    .select('*, nearby_details:nearby_place_details(*)')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    console.error('fetchNearbyPlace error:', error.message)
    return null
  }
  if (!data) return null
  return { ...(data as LocationRow & { nearby_details: NearbyPlaceDetailRow | null }), distance_km: null }
}

// ---- Submit a missing place (community submission) -----------------------

export async function submitNearbyPlaceSuggestion(input: {
  name: string
  municipality?: string
  barangay?: string
  address?: string
  latitude?: number | null
  longitude?: number | null
  category?: NearbyPlaceCategory
  phone_number?: string
  description?: string
}): Promise<{ success: boolean; error?: string }> {
  if (!input.name.trim()) {
    return { success: false, error: 'Place name is required.' }
  }

  // Insert into locations with community verification status
  const { data: locData, error: locError } = await supabase
    .from('locations')
    .insert({
      name: input.name.trim(),
      normalized_name: input.name.trim().toLowerCase(),
      type: 'other',
      municipality: input.municipality ?? null,
      barangay: input.barangay ?? null,
      address: input.address?.trim() ?? null,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      is_searchable: false, // hidden until reviewed
      verification_status: 'community',
      source: 'community_submission',
    })
    .select('id')
    .maybeSingle()

  if (locError) {
    console.error('submitNearbyPlaceSuggestion location error:', locError.message)
    return { success: false, error: locError.message }
  }

  const placeId = (locData as { id: string } | null)?.id
  if (!placeId) {
    return { success: false, error: 'Failed to create place record.' }
  }

  // Insert into nearby_place_details
  if (input.category || input.phone_number || input.description) {
    const { error: detError } = await supabase
      .from('nearby_place_details')
      .insert({
        place_id: placeId,
        category: input.category ?? 'other',
        phone_number: input.phone_number?.trim() ?? null,
        description: input.description?.trim() ?? null,
        data_source: 'community_submission',
        is_active: false, // hidden until reviewed
      })

    if (detError) {
      console.error('submitNearbyPlaceSuggestion details error:', detError.message)
      // location was created, that's fine
    }
  }

  return { success: true }
}

// ---- Get available categories that have results ---------------------------

export function getAvailableCategories(places: NearbyPlace[]): Set<NearbyPlaceCategory> {
  const cats = new Set<NearbyPlaceCategory>()
  for (const p of places) {
    const cat = getPlaceCategory(p)
    if (cat) cats.add(cat)
  }
  return cats
}
