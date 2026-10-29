import { supabase } from './supabase'
import type { VerificationStatus } from './types'

// ---- Types ----------------------------------------------------------------

export type EmergencyContactCategory =
  | 'national_emergency' | 'police' | 'fire_rescue' | 'ambulance_medical'
  | 'municipal_emergency' | 'disaster_response' | 'maritime_safety'
  | 'coast_guard' | 'other_assistance'

export type EmergencyGuideCategory =
  | 'earthquake' | 'typhoon_flood' | 'landslide' | 'fire' | 'medical_emergency'
  | 'road_accident' | 'maritime_safety' | 'missing_person' | 'other_hazard'

export interface EmergencyContactRow {
  id: string
  agency_name: string
  category: EmergencyContactCategory
  phone_number: string | null
  address: string | null
  municipality: string | null
  service_coverage: string | null
  official_source_url: string | null
  availability_notes: string | null
  verification_status: VerificationStatus
  is_published: boolean
  last_verified_at: string | null
  created_at: string
  updated_at: string
}

export interface EmergencyGuideRow {
  id: string
  title: string
  category: EmergencyGuideCategory
  content: string
  source_name: string | null
  source_url: string | null
  municipality: string | null
  verification_status: VerificationStatus
  is_published: boolean
  reviewed_at: string | null
  created_at: string
  updated_at: string
}

// ---- Labels ----------------------------------------------------------------

export const CONTACT_CATEGORY_LABELS: Record<EmergencyContactCategory, string> = {
  national_emergency: 'National Emergency Services',
  police: 'Police',
  fire_rescue: 'Fire & Rescue',
  ambulance_medical: 'Ambulance & Medical',
  municipal_emergency: 'Municipal Emergency Management',
  disaster_response: 'Disaster Response',
  maritime_safety: 'Maritime Safety',
  coast_guard: 'Coast Guard',
  other_assistance: 'Other Assistance',
}

export const GUIDE_CATEGORY_LABELS: Record<EmergencyGuideCategory, string> = {
  earthquake: 'Earthquake',
  typhoon_flood: 'Typhoon & Flooding',
  landslide: 'Landslide',
  fire: 'Fire Incident',
  medical_emergency: 'Medical Emergency',
  road_accident: 'Road Accident',
  maritime_safety: 'Maritime & Boat Safety',
  missing_person: 'Missing Person Assistance',
  other_hazard: 'Other Hazard',
}

export const MUNICIPALITIES = ['Boac', 'Buenavista', 'Gasan', 'Mogpog', 'Santa Cruz', 'Torrijos'] as const

// ---- Fetch emergency contacts ---------------------------------------------

export async function fetchEmergencyContacts(municipality?: string): Promise<EmergencyContactRow[]> {
  let query = supabase
    .from('emergency_contacts')
    .select('*')
    .eq('is_published', true)
    .in('verification_status', ['official', 'verified'])
    .order('category', { ascending: true })

  if (municipality && municipality !== 'all') {
    query = query.or(`municipality.eq.${municipality},municipality.is.null`)
  }

  const { data, error } = await query
  if (error) {
    console.error('fetchEmergencyContacts error:', error.message)
    return []
  }
  return (data ?? []) as EmergencyContactRow[]
}

export async function fetchEmergencyContactsByCategory(
  category: EmergencyContactCategory,
  municipality?: string,
): Promise<EmergencyContactRow[]> {
  let query = supabase
    .from('emergency_contacts')
    .select('*')
    .eq('is_published', true)
    .in('verification_status', ['official', 'verified'])
    .eq('category', category)

  if (municipality && municipality !== 'all') {
    query = query.or(`municipality.eq.${municipality},municipality.is.null`)
  }

  const { data, error } = await query.order('agency_name', { ascending: true })
  if (error) {
    console.error('fetchEmergencyContactsByCategory error:', error.message)
    return []
  }
  return (data ?? []) as EmergencyContactRow[]
}

// ---- Fetch emergency guides -----------------------------------------------

export async function fetchEmergencyGuides(municipality?: string): Promise<EmergencyGuideRow[]> {
  let query = supabase
    .from('emergency_guides')
    .select('*')
    .eq('is_published', true)
    .in('verification_status', ['official', 'verified'])

  if (municipality && municipality !== 'all') {
    query = query.or(`municipality.eq.${municipality},municipality.is.null`)
  }

  const { data, error } = await query.order('title', { ascending: true })
  if (error) {
    console.error('fetchEmergencyGuides error:', error.message)
    return []
  }
  return (data ?? []) as EmergencyGuideRow[]
}

export async function fetchEmergencyGuide(id: string): Promise<EmergencyGuideRow | null> {
  const { data, error } = await supabase
    .from('emergency_guides')
    .select('*')
    .eq('id', id)
    .eq('is_published', true)
    .in('verification_status', ['official', 'verified'])
    .maybeSingle()

  if (error) {
    console.error('fetchEmergencyGuide error:', error.message)
    return null
  }
  return (data as EmergencyGuideRow) ?? null
}

// ---- Submit community-suggested contact ------------------------------------

export async function submitEmergencyContactSuggestion(input: {
  agency_name: string
  category: EmergencyContactCategory
  phone_number?: string
  address?: string
  municipality?: string
  service_coverage?: string
  official_source_url?: string
}): Promise<{ success: boolean; error?: string }> {
  if (!input.agency_name.trim()) {
    return { success: false, error: 'Agency name is required.' }
  }
  const { error } = await supabase.from('emergency_contacts').insert({
    agency_name: input.agency_name.trim(),
    category: input.category,
    phone_number: input.phone_number?.trim() || null,
    address: input.address?.trim() || null,
    municipality: input.municipality || null,
    service_coverage: input.service_coverage?.trim() || null,
    official_source_url: input.official_source_url?.trim() || null,
    verification_status: 'community',
    is_published: false,
  })
  if (error) {
    console.error('submitEmergencyContactSuggestion error:', error.message)
    return { success: false, error: error.message }
  }
  return { success: true }
}
