import { supabase } from './supabase'
import type {
  ExploreCategoryRow,
  DestinationWithDetails,
  DestinationImageRow,
  DestinationReportCategory,
  DestinationVerification,
} from './types'

// ---- Constants -----------------------------------------------------------

export const MUNICIPALITIES = ['Boac', 'Buenavista', 'Gasan', 'Mogpog', 'Santa Cruz', 'Torrijos'] as const

export const VERIFICATION_LABELS: Record<DestinationVerification, string> = {
  unverified: 'Unverified',
  pending_review: 'Pending Review',
  verified: 'Verified',
  rejected: 'Rejected',
  needs_update: 'Needs Update',
}

export function verificationClasses(v: DestinationVerification): string {
  switch (v) {
    case 'verified': return 'bg-leaf-100 text-leaf-700'
    case 'pending_review': return 'bg-sand-200 text-terra-800'
    case 'unverified': return 'bg-ocean-50 text-ocean-600'
    case 'rejected': return 'bg-red-100 text-red-700'
    case 'needs_update': return 'bg-terra-100 text-terra-700'
  }
}

export const REPORT_CATEGORY_LABELS: Record<DestinationReportCategory, string> = {
  incorrect_address: 'Incorrect Address',
  incorrect_hours: 'Incorrect Hours',
  outdated_fees: 'Outdated Fees',
  inaccurate_description: 'Inaccurate Description',
  closed_destination: 'Closed Destination',
  inappropriate_content: 'Inappropriate Content',
  other_concern: 'Other Concern',
}

// ---- Category helpers ----------------------------------------------------

export function categoryIcon(slug: string | null | undefined): string {
  if (!slug) return '📍'
  switch (slug) {
    case 'nature_outdoor': return '🌿'
    case 'historical_cultural': return '🏛️'
    case 'food_dining': return '🍽️'
    case 'accommodation_recreation': return '🏨'
    case 'other_places': return '📍'
    default: return '📍'
  }
}

// ---- Fetch categories ----------------------------------------------------

export async function fetchCategories(): Promise<ExploreCategoryRow[]> {
  const { data, error } = await supabase
    .from('explore_categories')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  if (error) {
    console.error('fetchCategories error:', error.message)
    return []
  }
  return (data ?? []) as ExploreCategoryRow[]
}

// ---- Fetch destinations --------------------------------------------------

export async function fetchDestinations(limit = 50): Promise<DestinationWithDetails[]> {
  const { data, error } = await supabase
    .from('destinations')
    .select(
      '*, category:explore_categories(id, name, slug, icon), location:locations(id, name, municipality)',
    )
    .eq('is_published', true)
    .in('verification_status', ['verified', 'pending_review'])
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('fetchDestinations error:', error.message)
    return []
  }
  return (data ?? []) as DestinationWithDetails[]
}

export async function fetchFeaturedDestinations(limit = 10): Promise<DestinationWithDetails[]> {
  const { data, error } = await supabase
    .from('destinations')
    .select(
      '*, category:explore_categories(id, name, slug, icon), location:locations(id, name, municipality)',
    )
    .eq('is_published', true)
    .eq('is_featured', true)
    .in('verification_status', ['verified', 'pending_review'])
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('fetchFeaturedDestinations error:', error.message)
    return []
  }
  return (data ?? []) as DestinationWithDetails[]
}

export async function fetchDestinationsByMunicipality(municipality: string): Promise<DestinationWithDetails[]> {
  const { data, error } = await supabase
    .from('destinations')
    .select(
      '*, category:explore_categories(id, name, slug, icon), location:locations(id, name, municipality)',
    )
    .eq('is_published', true)
    .eq('municipality', municipality)
    .in('verification_status', ['verified', 'pending_review'])
    .order('created_at', { ascending: false })

  if (error) {
    console.error('fetchDestinationsByMunicipality error:', error.message)
    return []
  }
  return (data ?? []) as DestinationWithDetails[]
}

export async function fetchDestinationsByCategory(categoryId: string): Promise<DestinationWithDetails[]> {
  const { data, error } = await supabase
    .from('destinations')
    .select(
      '*, category:explore_categories(id, name, slug, icon), location:locations(id, name, municipality)',
    )
    .eq('is_published', true)
    .eq('category_id', categoryId)
    .in('verification_status', ['verified', 'pending_review'])
    .order('created_at', { ascending: false })

  if (error) {
    console.error('fetchDestinationsByCategory error:', error.message)
    return []
  }
  return (data ?? []) as DestinationWithDetails[]
}

export async function searchDestinations(query: string, municipality?: string, categoryId?: string): Promise<DestinationWithDetails[]> {
  let q = supabase
    .from('destinations')
    .select(
      '*, category:explore_categories(id, name, slug, icon), location:locations(id, name, municipality)',
    )
    .eq('is_published', true)
    .in('verification_status', ['verified', 'pending_review'])

  const term = query.trim()
  if (term) {
    q = q.or(`name.ilike.%${term}%,description.ilike.%${term}%`)
  }
  if (municipality && municipality !== 'all') {
    q = q.eq('municipality', municipality)
  }
  if (categoryId && categoryId !== 'all') {
    q = q.eq('category_id', categoryId)
  }

  const { data, error } = await q.order('name', { ascending: true }).limit(50)

  if (error) {
    console.error('searchDestinations error:', error.message)
    return []
  }
  return (data ?? []) as DestinationWithDetails[]
}

// ---- Fetch single destination with images --------------------------------

export async function fetchDestination(id: string): Promise<DestinationWithDetails | null> {
  const { data, error } = await supabase
    .from('destinations')
    .select(
      '*, category:explore_categories(id, name, slug, icon), location:locations(id, name, municipality, latitude, longitude)',
    )
    .eq('id', id)
    .maybeSingle()

  if (error) {
    console.error('fetchDestination error:', error.message)
    return null
  }
  if (!data) return null

  const dest = data as DestinationWithDetails
  const { data: imgData } = await supabase
    .from('destination_images')
    .select('*')
    .eq('destination_id', id)
    .order('sort_order', { ascending: true })

  dest.images = (imgData ?? []) as DestinationImageRow[]
  return dest
}

// ---- Fetch destination images --------------------------------------------

export async function fetchDestinationImages(destinationId: string): Promise<DestinationImageRow[]> {
  const { data, error } = await supabase
    .from('destination_images')
    .select('*')
    .eq('destination_id', destinationId)
    .order('sort_order', { ascending: true })

  if (error) {
    console.error('fetchDestinationImages error:', error.message)
    return []
  }
  return (data ?? []) as DestinationImageRow[]
}

// ---- Report incorrect information ----------------------------------------

export async function submitDestinationReport(
  destinationId: string,
  category: DestinationReportCategory,
  description: string,
): Promise<{ success: boolean; error?: string }> {
  if (description.trim().length < 10) {
    return { success: false, error: 'Description must be at least 10 characters.' }
  }

  const { error } = await supabase.from('destination_reports').insert({
    destination_id: destinationId,
    category,
    description: description.trim(),
  })

  if (error) {
    console.error('submitDestinationReport error:', error.message)
    return { success: false, error: friendlyError(error.message) }
  }
  return { success: true }
}

// ---- Admin: create destination -------------------------------------------

export interface NewDestinationInput {
  name: string
  description?: string
  category_id?: string | null
  municipality?: string | null
  location_id?: string | null
  address?: string
  latitude?: number | null
  longitude?: number | null
  entrance_fee?: string
  official_website?: string
  contact_information?: string
  is_featured?: boolean
}

export async function createDestination(
  input: NewDestinationInput,
): Promise<{ success: boolean; id?: string; error?: string }> {
  const slug = input.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

  const { data, error } = await supabase
    .from('destinations')
    .insert({
      name: input.name.trim(),
      slug: slug || `dest-${Date.now()}`,
      description: input.description?.trim() || null,
      category_id: input.category_id ?? null,
      municipality: input.municipality ?? null,
      location_id: input.location_id ?? null,
      address: input.address?.trim() || null,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      entrance_fee: input.entrance_fee?.trim() || null,
      official_website: input.official_website?.trim() || null,
      contact_information: input.contact_information?.trim() || null,
      is_featured: input.is_featured ?? false,
      is_published: false,
      verification_status: 'unverified',
    })
    .select('id')
    .maybeSingle()

  if (error) {
    console.error('createDestination error:', error.message)
    return { success: false, error: friendlyError(error.message) }
  }
  return { success: true, id: (data as { id: string } | null)?.id }
}

// ---- Admin: publish / verify / feature -----------------------------------

export async function publishDestination(id: string): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('destinations')
    .update({ is_published: true })
    .eq('id', id)

  if (error) {
    console.error('publishDestination error:', error.message)
    return { success: false, error: friendlyError(error.message) }
  }
  return { success: true }
}

export async function verifyDestination(id: string): Promise<{ success: boolean; error?: string }> {
  const userId = (await supabase.auth.getUser()).data.user?.id ?? null
  const { error } = await supabase
    .from('destinations')
    .update({
      verification_status: 'verified',
      verified_by: userId,
      verified_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) {
    console.error('verifyDestination error:', error.message)
    return { success: false, error: friendlyError(error.message) }
  }
  return { success: true }
}

export async function unpublishDestination(id: string): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('destinations')
    .update({ is_published: false })
    .eq('id', id)

  if (error) {
    console.error('unpublishDestination error:', error.message)
    return { success: false, error: friendlyError(error.message) }
  }
  return { success: true }
}

export async function toggleFeatured(id: string, featured: boolean): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('destinations')
    .update({ is_featured: featured })
    .eq('id', id)

  if (error) {
    console.error('toggleFeatured error:', error.message)
    return { success: false, error: error.message }
  }
  return { success: true }
}

// ---- Admin: fetch all destinations ---------------------------------------

export async function fetchAllDestinationsAdmin(): Promise<DestinationWithDetails[]> {
  const { data, error } = await supabase
    .from('destinations')
    .select(
      '*, category:explore_categories(id, name, slug, icon), location:locations(id, name, municipality)',
    )
    .order('created_at', { ascending: false })

  if (error) {
    console.error('fetchAllDestinationsAdmin error:', error.message)
    return []
  }
  return (data ?? []) as DestinationWithDetails[]
}

// ---- Helpers -------------------------------------------------------------

function friendlyError(msg: string): string {
  if (msg.includes('row-level security')) {
    return 'You do not have permission to perform this action.'
  }
  if (msg.includes('duplicate')) {
    return 'This may already exist. Please check and try again.'
  }
  return msg
}
