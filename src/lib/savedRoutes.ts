import { supabase } from './supabase'
import type {
  SavedRouteRow,
  SavedRouteWithDetails,
  SavedRouteCategory,
} from './types'

// ---- Fetch all saved routes for the current user -----------------------

export async function fetchSavedRoutes(): Promise<SavedRouteWithDetails[]> {
  const { data, error } = await supabase
    .from('saved_routes')
    .select(
      `*,
      origin_location:locations!saved_routes_origin_location_id_fkey(id, name, municipality),
      destination_location:locations!saved_routes_destination_location_id_fkey(id, name, municipality),
      preferred_transport_mode:transport_modes!saved_routes_preferred_transport_mode_id_fkey(id, name, code, icon),
      route:routes!saved_routes_route_id_fkey(id, route_name, route_code, transport_mode_id),
      saved_route_segments(
        id, saved_route_id, sequence_number, route_id, transport_mode_id,
        origin_location_id, destination_location_id, transfer_notes, created_at,
        route:routes!saved_route_segments_route_id_fkey(id, route_name, route_code),
        transport_mode:transport_modes!saved_route_segments_transport_mode_id_fkey(id, name, code, icon),
        origin_location:locations!saved_route_segments_origin_location_id_fkey(id, name, municipality),
        destination_location:locations!saved_route_segments_destination_location_id_fkey(id, name, municipality)
      )`,
    )
    .order('created_at', { ascending: false })

  if (error) {
    console.error('fetchSavedRoutes error:', error.message)
    return []
  }
  return (data ?? []) as unknown as SavedRouteWithDetails[]
}

// ---- Fetch favorites only ----------------------------------------------

export async function fetchFavoriteRoutes(): Promise<SavedRouteWithDetails[]> {
  const { data, error } = await supabase
    .from('saved_routes')
    .select(
      `*,
      origin_location:locations!saved_routes_origin_location_id_fkey(id, name, municipality),
      destination_location:locations!saved_routes_destination_location_id_fkey(id, name, municipality),
      preferred_transport_mode:transport_modes!saved_routes_preferred_transport_mode_id_fkey(id, name, code, icon),
      route:routes!saved_routes_route_id_fkey(id, route_name, route_code, transport_mode_id),
      saved_route_segments(
        id, saved_route_id, sequence_number, route_id, transport_mode_id,
        origin_location_id, destination_location_id, transfer_notes, created_at,
        route:routes!saved_route_segments_route_id_fkey(id, route_name, route_code),
        transport_mode:transport_modes!saved_route_segments_transport_mode_id_fkey(id, name, code, icon),
        origin_location:locations!saved_route_segments_origin_location_id_fkey(id, name, municipality),
        destination_location:locations!saved_route_segments_destination_location_id_fkey(id, name, municipality)
      )`,
    )
    .eq('is_favorite', true)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('fetchFavoriteRoutes error:', error.message)
    return []
  }
  return (data ?? []) as unknown as SavedRouteWithDetails[]
}

// ---- Save a complete journey -------------------------------------------

export interface SaveJourneyInput {
  customName: string
  originLocationId?: string
  destinationLocationId?: string
  routeId?: string
  preferredTransportModeId?: string
  category: SavedRouteCategory
  notes?: string
  isFavorite?: boolean
  journeySnapshot?: Record<string, unknown>
  segments?: Array<{
    sequenceNumber: number
    routeId?: string
    transportModeId?: string
    originLocationId?: string
    destinationLocationId?: string
    transferNotes?: string
  }>
}

export async function saveJourney(
  input: SaveJourneyInput,
): Promise<{ success: boolean; error?: string; id?: string }> {
  if (!input.customName.trim()) {
    return { success: false, error: 'Trip name is required.' }
  }
  if (input.customName.length > 100) {
    return { success: false, error: 'Trip name must be 100 characters or fewer.' }
  }
  if (input.notes && input.notes.length > 500) {
    return { success: false, error: 'Notes must be 500 characters or fewer.' }
  }

  const insertRow: Record<string, unknown> = {
    custom_name: input.customName.trim(),
    origin_location_id: input.originLocationId ?? null,
    destination_location_id: input.destinationLocationId ?? null,
    route_id: input.routeId ?? null,
    preferred_transport_mode_id: input.preferredTransportModeId ?? null,
    category: input.category,
    notes: input.notes?.trim() ?? null,
    is_favorite: input.isFavorite ?? false,
    journey_snapshot: input.journeySnapshot ?? null,
  }

  const { data, error } = await supabase
    .from('saved_routes')
    .insert(insertRow)
    .select('id')
    .single()

  if (error) {
    console.error('saveJourney error:', error.message)
    return { success: false, error: error.message }
  }

  const savedRouteId = (data as { id: string }).id

  if (input.segments && input.segments.length > 0) {
    const segmentRows: Array<Record<string, unknown>> = input.segments.map((s) => ({
      saved_route_id: savedRouteId,
      sequence_number: s.sequenceNumber,
      route_id: s.routeId ?? null,
      transport_mode_id: s.transportModeId ?? null,
      origin_location_id: s.originLocationId ?? null,
      destination_location_id: s.destinationLocationId ?? null,
      transfer_notes: s.transferNotes?.trim() ?? null,
    }))

    const { error: segError } = await supabase.from('saved_route_segments').insert(segmentRows)
    if (segError) {
      console.error('saveJourney segments error:', segError.message)
    }
  }

  return { success: true, id: savedRouteId }
}

// ---- Update a saved route ----------------------------------------------

export async function updateSavedRoute(
  id: string,
  updates: Partial<Pick<SavedRouteRow, 'custom_name' | 'category' | 'notes' | 'is_favorite'>>,
): Promise<{ success: boolean; error?: string }> {
  if (updates.custom_name !== undefined && updates.custom_name !== null && updates.custom_name.length > 100) {
    return { success: false, error: 'Trip name must be 100 characters or fewer.' }
  }
  if (updates.notes !== undefined && updates.notes && updates.notes.length > 500) {
    return { success: false, error: 'Notes must be 500 characters or fewer.' }
  }

  const cleanUpdates: Record<string, unknown> = {}
  if (updates.custom_name !== undefined) cleanUpdates.custom_name = (updates.custom_name ?? '').trim()
  if (updates.category !== undefined) cleanUpdates.category = updates.category
  if (updates.notes !== undefined) cleanUpdates.notes = updates.notes?.trim() ?? null
  if (updates.is_favorite !== undefined) cleanUpdates.is_favorite = updates.is_favorite

  const { error } = await supabase.from('saved_routes').update(cleanUpdates).eq('id', id)

  if (error) {
    console.error('updateSavedRoute error:', error.message)
    return { success: false, error: error.message }
  }
  return { success: true }
}

// ---- Toggle favorite ----------------------------------------------------

export async function toggleRouteFavorite(
  id: string,
  currentFavorite: boolean,
): Promise<boolean> {
  const { error } = await supabase
    .from('saved_routes')
    .update({ is_favorite: !currentFavorite })
    .eq('id', id)

  if (error) {
    console.error('toggleRouteFavorite error:', error.message)
    return false
  }
  return true
}

// ---- Delete a saved route ----------------------------------------------

export async function deleteSavedRoute(id: string): Promise<boolean> {
  const { error } = await supabase.from('saved_routes').delete().eq('id', id)

  if (error) {
    console.error('deleteSavedRoute error:', error.message)
    return false
  }
  return true
}

// ---- Category helpers ---------------------------------------------------

export const ROUTE_CATEGORY_LABELS: Record<SavedRouteCategory, string> = {
  commute: 'Commute',
  school: 'School',
  work: 'Work',
  family: 'Family',
  tourism: 'Tourism',
  other: 'Other',
}
