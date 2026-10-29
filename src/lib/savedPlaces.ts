import { supabase } from './supabase'
import type { SavedPlaceRow, SavedPlaceWithLocation, SavedPlaceCategory, LocationRow } from './types'

// ---- Fetch all saved places for the current user -----------------------

export async function fetchSavedPlaces(): Promise<SavedPlaceWithLocation[]> {
  const { data, error } = await supabase
    .from('saved_places')
    .select('*, location:locations(id, name, municipality, barangay, latitude, longitude)')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('fetchSavedPlaces error:', error.message)
    return []
  }
  return (data ?? []) as SavedPlaceWithLocation[]
}

// ---- Fetch favorites only ----------------------------------------------

export async function fetchFavoritePlaces(): Promise<SavedPlaceWithLocation[]> {
  const { data, error } = await supabase
    .from('saved_places')
    .select('*, location:locations(id, name, municipality, barangay, latitude, longitude)')
    .eq('is_favorite', true)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('fetchFavoritePlaces error:', error.message)
    return []
  }
  return (data ?? []) as SavedPlaceWithLocation[]
}

// ---- Check if a location is already saved -------------------------------

export async function checkIfSaved(locationId: string): Promise<{ saved: boolean; id: string | null }> {
  const { data, error } = await supabase
    .from('saved_places')
    .select('id')
    .eq('location_id', locationId)
    .maybeSingle()

  if (error) {
    console.error('checkIfSaved error:', error.message)
    return { saved: false, id: null }
  }
  return { saved: !!data, id: (data as { id: string } | null)?.id ?? null }
}

// ---- Add a saved place from a verified location -------------------------

export async function saveVerifiedLocation(opts: {
  locationId: string
  customName?: string
  category?: SavedPlaceCategory
  notes?: string
  isFavorite?: boolean
}): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.from('saved_places').insert({
    location_id: opts.locationId,
    custom_name: opts.customName ?? null,
    category: opts.category ?? 'uncategorized',
    notes: opts.notes ?? null,
    is_favorite: opts.isFavorite ?? false,
  })
  if (error) {
    if (error.code === '23505') {
      return { success: false, error: 'You already saved this location.' }
    }
    console.error('saveVerifiedLocation error:', error.message)
    return { success: false, error: error.message }
  }
  return { success: true }
}

// ---- Add a custom place (not in the verified directory) -----------------

export async function saveCustomPlace(opts: {
  customName: string
  customAddress?: string
  latitude?: number
  longitude?: number
  category?: SavedPlaceCategory
  notes?: string
  isFavorite?: boolean
}): Promise<{ success: boolean; error?: string }> {
  if (!opts.customName.trim()) {
    return { success: false, error: 'Place name is required.' }
  }
  const { error } = await supabase.from('saved_places').insert({
    location_id: null,
    custom_name: opts.customName.trim(),
    custom_address: opts.customAddress?.trim() ?? null,
    latitude: opts.latitude ?? null,
    longitude: opts.longitude ?? null,
    category: opts.category ?? 'uncategorized',
    notes: opts.notes?.trim() ?? null,
    is_favorite: opts.isFavorite ?? false,
  })
  if (error) {
    console.error('saveCustomPlace error:', error.message)
    return { success: false, error: error.message }
  }
  return { success: true }
}

// ---- Update a saved place -----------------------------------------------

export async function updateSavedPlace(
  id: string,
  updates: Partial<Pick<SavedPlaceRow, 'custom_name' | 'category' | 'notes' | 'custom_address' | 'latitude' | 'longitude' | 'is_favorite'>>,
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('saved_places')
    .update(updates)
    .eq('id', id)

  if (error) {
    console.error('updateSavedPlace error:', error.message)
    return { success: false, error: error.message }
  }
  return { success: true }
}

// ---- Toggle favorite ----------------------------------------------------

export async function toggleFavorite(id: string, currentFavorite: boolean): Promise<boolean> {
  const { error } = await supabase
    .from('saved_places')
    .update({ is_favorite: !currentFavorite })
    .eq('id', id)

  if (error) {
    console.error('toggleFavorite error:', error.message)
    return false
  }
  return true
}

// ---- Delete a saved place -----------------------------------------------

export async function deleteSavedPlace(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('saved_places')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('deleteSavedPlace error:', error.message)
    return false
  }
  return true
}

// ---- Search verified locations for adding a place -----------------------

export async function searchLocationsForSave(query: string): Promise<LocationRow[]> {
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
    console.error('searchLocationsForSave error:', error.message)
    return []
  }
  return (data ?? []) as LocationRow[]
}

// ---- Category helpers ---------------------------------------------------

export const CATEGORY_LABELS: Record<SavedPlaceCategory, string> = {
  home: 'Home',
  school: 'School',
  work: 'Work',
  favorite: 'Favorite',
  custom: 'Custom',
  terminal: 'Terminal',
  port: 'Port',
  shopping: 'Shopping',
  landmark: 'Landmark',
  family: 'Family',
  other: 'Other',
  uncategorized: 'Uncategorized',
}

export const CATEGORY_ORDER: SavedPlaceCategory[] = [
  'home', 'school', 'work', 'favorite', 'terminal', 'port', 'shopping', 'landmark', 'family', 'other', 'custom', 'uncategorized',
]
