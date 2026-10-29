import { supabase } from './supabase'
import type {
  LocalAlertWithLocation,
  LocationRow,
  RecentSearchWithLocation,
  SavedPlaceWithLocation,
} from './types'

// ---- Locations ----------------------------------------------------------

export async function searchLocations(query: string, limit = 8): Promise<LocationRow[]> {
  const term = query.trim().toLowerCase()
  if (!term) return []

  const { data, error } = await supabase
    .from('locations')
    .select('*')
    .eq('is_searchable', true)
    .ilike('normalized_name', `${term}%`)
    .order('name', { ascending: true })
    .limit(limit)

  if (error) {
    console.error('searchLocations error:', error.message)
    return []
  }
  return (data ?? []) as LocationRow[]
}

// ---- Saved places -------------------------------------------------------

export async function getSavedPlaces(userId: string): Promise<SavedPlaceWithLocation[]> {
  const { data, error } = await supabase
    .from('saved_places')
    .select(
      '*, location:locations(id, name, municipality, barangay)',
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('getSavedPlaces error:', error.message)
    return []
  }
  return (data ?? []) as SavedPlaceWithLocation[]
}

// ---- Recent searches ----------------------------------------------------

export async function getRecentSearches(
  userId: string,
  limit = 5,
): Promise<RecentSearchWithLocation[]> {
  const { data, error } = await supabase
    .from('recent_searches')
    .select('*, location:locations(id, name, municipality)')
    .eq('user_id', userId)
    .order('searched_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('getRecentSearches error:', error.message)
    return []
  }
  return (data ?? []) as RecentSearchWithLocation[]
}

export async function recordSearch(
  userId: string,
  location: { id: string; name: string; municipality: string | null } | null,
  searchText: string,
): Promise<void> {
  const { error } = await supabase.from('recent_searches').insert({
    user_id: userId,
    location_id: location?.id ?? null,
    search_text: location?.name ?? searchText,
  })
  if (error) console.error('recordSearch error:', error.message)
}

export async function deleteRecentSearch(id: string): Promise<boolean> {
  const { error } = await supabase.from('recent_searches').delete().eq('id', id)
  if (error) {
    console.error('deleteRecentSearch error:', error.message)
    return false
  }
  return true
}

export async function clearRecentSearches(userId: string): Promise<boolean> {
  const { error } = await supabase
    .from('recent_searches')
    .delete()
    .eq('user_id', userId)
  if (error) {
    console.error('clearRecentSearches error:', error.message)
    return false
  }
  return true
}

// ---- Local alerts -------------------------------------------------------

export async function getActiveAlerts(limit = 6): Promise<LocalAlertWithLocation[]> {
  // RLS already filters to official/verified/community + active window.
  // We surface official/verified first, then community, never estimated as official.
  const { data, error } = await supabase
    .from('local_alerts')
    .select(
      '*, affected_location:locations!affected_location_id(id, name, municipality)',
    )
    .order('start_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('getActiveAlerts error:', error.message)
    return []
  }
  return (data ?? []) as LocalAlertWithLocation[]
}
