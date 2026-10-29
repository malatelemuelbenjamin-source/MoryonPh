import { supabase } from './supabase'
import type {
  EventCategoryRow,
  CulturalEventWithDetails,
  EventImageRow,
  EventReportCategory,
  EventVerification,
  EventStatus,
  EventAdmissionType,
} from './types'

// ---- Constants -----------------------------------------------------------

export const MUNICIPALITIES = ['Boac', 'Buenavista', 'Gasan', 'Mogpog', 'Santa Cruz', 'Torrijos'] as const

export const VERIFICATION_LABELS: Record<EventVerification, string> = {
  unverified: 'Unverified',
  pending_review: 'Pending Review',
  verified: 'Verified',
  needs_update: 'Needs Update',
  rejected: 'Rejected',
}

export function verificationClasses(v: EventVerification): string {
  switch (v) {
    case 'verified': return 'bg-leaf-100 text-leaf-700'
    case 'pending_review': return 'bg-sand-200 text-terra-800'
    case 'unverified': return 'bg-ocean-50 text-ocean-600'
    case 'rejected': return 'bg-red-100 text-red-700'
    case 'needs_update': return 'bg-terra-100 text-terra-700'
  }
}

export const STATUS_LABELS: Record<EventStatus, string> = {
  draft: 'Draft',
  pending_review: 'Pending Review',
  published: 'Published',
  postponed: 'Postponed',
  cancelled: 'Cancelled',
  completed: 'Completed',
  archived: 'Archived',
}

export function statusClasses(s: EventStatus): string {
  switch (s) {
    case 'published': return 'bg-leaf-100 text-leaf-700'
    case 'postponed': return 'bg-sand-200 text-terra-800'
    case 'cancelled': return 'bg-red-100 text-red-700'
    case 'completed': return 'bg-ocean-50 text-ocean-600'
    case 'archived': return 'bg-ocean-50 text-ocean-500'
    case 'draft': return 'bg-ocean-50 text-ocean-600'
    case 'pending_review': return 'bg-sand-200 text-terra-800'
  }
}

export const ADMISSION_LABELS: Record<EventAdmissionType, string> = {
  free: 'Free Admission',
  paid: 'Paid Admission',
  unknown: 'Admission Unknown',
}

export const REPORT_CATEGORY_LABELS: Record<EventReportCategory, string> = {
  incorrect_date: 'Incorrect Date or Time',
  incorrect_venue: 'Incorrect Venue',
  incorrect_fee: 'Incorrect Fee',
  inaccurate_description: 'Inaccurate Description',
  cancelled_event: 'Event Cancelled',
  inappropriate_content: 'Inappropriate Content',
  other_concern: 'Other Concern',
}

export function categoryIcon(slug: string | null | undefined): string {
  if (!slug) return '📅'
  switch (slug) {
    case 'culture_heritage': return '🏛️'
    case 'community_education': return '👥'
    case 'tourism_entertainment': return '🎭'
    default: return '📅'
  }
}

// ---- Date helpers --------------------------------------------------------

export function formatEventDate(start: string | null, end: string | null, isAllDay: boolean): string {
  if (!start) return 'Date not confirmed'
  const s = new Date(start)
  const opts: Intl.DateTimeFormatOptions = {
    month: 'short', day: 'numeric', year: 'numeric',
  }
  if (!isAllDay) {
    opts.hour = 'numeric'
    opts.minute = '2-digit'
  }
  if (end) {
    const e = new Date(end)
    if (s.toDateString() === e.toDateString()) {
      if (!isAllDay) {
        return `${s.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}, ${s.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })} – ${e.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })}`
      }
      return s.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
    }
    return `${s.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })} – ${e.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}`
  }
  return s.toLocaleDateString('en-PH', opts)
}

export function isHappeningToday(start: string | null, end: string | null): boolean {
  if (!start) return false
  const now = new Date()
  const s = new Date(start)
  const e = end ? new Date(end) : new Date(start)
  const todayStr = now.toDateString()
  const startStr = s.toDateString()
  const endStr = e.toDateString()
  return (startStr <= todayStr && endStr >= todayStr)
}

export function isThisWeekend(start: string | null): boolean {
  if (!start) return false
  const s = new Date(start)
  const day = s.getDay()
  return day === 0 || day === 6
}

export function isUpcoming(start: string | null): boolean {
  if (!start) return false
  return new Date(start) > new Date()
}

export function isPast(end: string | null): boolean {
  if (!end) return false
  return new Date(end) < new Date()
}

// ---- Fetch categories ----------------------------------------------------

export async function fetchEventCategories(): Promise<EventCategoryRow[]> {
  const { data, error } = await supabase
    .from('event_categories')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  if (error) {
    console.error('fetchEventCategories error:', error.message)
    return []
  }
  return (data ?? []) as EventCategoryRow[]
}

// ---- Fetch events --------------------------------------------------------

export async function fetchEvents(limit = 50): Promise<CulturalEventWithDetails[]> {
  const { data, error } = await supabase
    .from('cultural_events')
    .select(
      '*, category:event_categories(id, name, slug, icon), location:locations(id, name, municipality)',
    )
    .eq('status', 'published')
    .in('verification_status', ['verified', 'pending_review'])
    .order('start_at', { ascending: true, nullsFirst: false })
    .limit(limit)

  if (error) {
    console.error('fetchEvents error:', error.message)
    return []
  }
  return (data ?? []) as CulturalEventWithDetails[]
}

export async function fetchFeaturedEvents(limit = 10): Promise<CulturalEventWithDetails[]> {
  const { data, error } = await supabase
    .from('cultural_events')
    .select(
      '*, category:event_categories(id, name, slug, icon), location:locations(id, name, municipality)',
    )
    .eq('status', 'published')
    .in('verification_status', ['verified', 'pending_review'])
    .or('start_at.gte.' + new Date().toISOString() + ',start_at.is.null')
    .order('start_at', { ascending: true, nullsFirst: false })
    .limit(limit)

  if (error) {
    console.error('fetchFeaturedEvents error:', error.message)
    return []
  }
  return (data ?? []) as CulturalEventWithDetails[]
}

export async function fetchEventsByMunicipality(municipality: string): Promise<CulturalEventWithDetails[]> {
  const { data, error } = await supabase
    .from('cultural_events')
    .select(
      '*, category:event_categories(id, name, slug, icon), location:locations(id, name, municipality)',
    )
    .eq('status', 'published')
    .eq('municipality', municipality)
    .in('verification_status', ['verified', 'pending_review'])
    .order('start_at', { ascending: true, nullsFirst: false })

  if (error) {
    console.error('fetchEventsByMunicipality error:', error.message)
    return []
  }
  return (data ?? []) as CulturalEventWithDetails[]
}

export async function fetchEventsByCategory(categoryId: string): Promise<CulturalEventWithDetails[]> {
  const { data, error } = await supabase
    .from('cultural_events')
    .select(
      '*, category:event_categories(id, name, slug, icon), location:locations(id, name, municipality)',
    )
    .eq('status', 'published')
    .eq('category_id', categoryId)
    .in('verification_status', ['verified', 'pending_review'])
    .order('start_at', { ascending: true, nullsFirst: false })

  if (error) {
    console.error('fetchEventsByCategory error:', error.message)
    return []
  }
  return (data ?? []) as CulturalEventWithDetails[]
}

export async function searchEvents(
  query: string,
  municipality?: string,
  categoryId?: string,
): Promise<CulturalEventWithDetails[]> {
  let q = supabase
    .from('cultural_events')
    .select(
      '*, category:event_categories(id, name, slug, icon), location:locations(id, name, municipality)',
    )
    .eq('status', 'published')
    .in('verification_status', ['verified', 'pending_review'])

  const term = query.trim()
  if (term) {
    q = q.or(`title.ilike.%${term}%,description.ilike.%${term}%,venue_name.ilike.%${term}%,organizer_name.ilike.%${term}%`)
  }
  if (municipality && municipality !== 'all') {
    q = q.eq('municipality', municipality)
  }
  if (categoryId && categoryId !== 'all') {
    q = q.eq('category_id', categoryId)
  }

  const { data, error } = await q.order('start_at', { ascending: true, nullsFirst: false }).limit(50)

  if (error) {
    console.error('searchEvents error:', error.message)
    return []
  }
  return (data ?? []) as CulturalEventWithDetails[]
}

// ---- Fetch single event --------------------------------------------------

export async function fetchEvent(id: string): Promise<CulturalEventWithDetails | null> {
  const { data, error } = await supabase
    .from('cultural_events')
    .select(
      '*, category:event_categories(id, name, slug, icon), location:locations(id, name, municipality, latitude, longitude)',
    )
    .eq('id', id)
    .maybeSingle()

  if (error) {
    console.error('fetchEvent error:', error.message)
    return null
  }
  if (!data) return null

  const event = data as CulturalEventWithDetails

  const { data: imgData } = await supabase
    .from('event_images')
    .select('*')
    .eq('event_id', id)
    .order('sort_order', { ascending: true })
  event.images = (imgData ?? []) as EventImageRow[]

  const { data: saveData } = await supabase
    .from('saved_events')
    .select('id')
    .eq('event_id', id)
    .maybeSingle()
  event.is_saved = !!saveData

  return event
}

// ---- Saved events --------------------------------------------------------

export async function toggleSaveEvent(eventId: string, currentlySaved: boolean): Promise<boolean> {
  if (currentlySaved) {
    const { error } = await supabase.from('saved_events').delete().eq('event_id', eventId)
    if (error) {
      console.error('toggleSaveEvent delete error:', error.message)
      return false
    }
    return true
  }
  const { error } = await supabase.from('saved_events').insert({ event_id: eventId })
  if (error) {
    if (error.code === '23505') return true
    console.error('toggleSaveEvent insert error:', error.message)
    return false
  }
  return true
}

export async function fetchSavedEventIds(): Promise<Set<string>> {
  const { data, error } = await supabase.from('saved_events').select('event_id')
  if (error) {
    console.error('fetchSavedEventIds error:', error.message)
    return new Set()
  }
  return new Set((data ?? []).map((r: { event_id: string }) => r.event_id))
}

// ---- Event reports -------------------------------------------------------

export async function submitEventReport(
  eventId: string,
  category: EventReportCategory,
  description: string,
): Promise<{ success: boolean; error?: string }> {
  if (description.trim().length < 10) {
    return { success: false, error: 'Description must be at least 10 characters.' }
  }

  const { error } = await supabase.from('event_reports').insert({
    event_id: eventId,
    category,
    description: description.trim(),
  })

  if (error) {
    console.error('submitEventReport error:', error.message)
    return { success: false, error: friendlyError(error.message) }
  }
  return { success: true }
}

// ---- Event registration --------------------------------------------------

export async function registerForEvent(eventId: string): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.from('event_registrations').insert({ event_id: eventId })
  if (error) {
    if (error.code === '23505') return { success: false, error: 'You are already registered.' }
    console.error('registerForEvent error:', error.message)
    return { success: false, error: friendlyError(error.message) }
  }
  return { success: true }
}

export async function cancelRegistration(eventId: string): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('event_registrations')
    .update({ registration_status: 'cancelled' })
    .eq('event_id', eventId)
  if (error) {
    console.error('cancelRegistration error:', error.message)
    return { success: false, error: friendlyError(error.message) }
  }
  return { success: true }
}

export async function checkRegistration(eventId: string): Promise<boolean> {
  const { data } = await supabase
    .from('event_registrations')
    .select('registration_status')
    .eq('event_id', eventId)
    .maybeSingle()
  return (data as { registration_status: string } | null)?.registration_status === 'registered'
}

// ---- Admin: submit event -------------------------------------------------

export interface NewEventInput {
  title: string
  description?: string
  category_id?: string | null
  municipality?: string | null
  venue_name?: string
  venue_address?: string
  start_at?: string | null
  end_at?: string | null
  is_all_day?: boolean
  organizer_name?: string
  official_source_url?: string
  admission_type?: EventAdmissionType
  admission_fee?: string
  registration_required?: boolean | null
  registration_url?: string
}

export async function submitEvent(
  input: NewEventInput,
): Promise<{ success: boolean; id?: string; error?: string }> {
  const slug = input.title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

  const { data, error } = await supabase
    .from('cultural_events')
    .insert({
      title: input.title.trim(),
      slug: slug || `event-${Date.now()}`,
      description: input.description?.trim() || null,
      category_id: input.category_id ?? null,
      municipality: input.municipality ?? null,
      venue_name: input.venue_name?.trim() || null,
      venue_address: input.venue_address?.trim() || null,
      start_at: input.start_at ?? null,
      end_at: input.end_at ?? null,
      is_all_day: input.is_all_day ?? false,
      organizer_name: input.organizer_name?.trim() || null,
      official_source_url: input.official_source_url?.trim() || null,
      admission_type: input.admission_type ?? 'unknown',
      admission_fee: input.admission_fee?.trim() || null,
      registration_required: input.registration_required ?? null,
      registration_url: input.registration_url?.trim() || null,
      status: 'pending_review',
      verification_status: 'unverified',
    })
    .select('id')
    .maybeSingle()

  if (error) {
    console.error('submitEvent error:', error.message)
    return { success: false, error: friendlyError(error.message) }
  }
  return { success: true, id: (data as { id: string } | null)?.id }
}

// ---- Admin: publish / verify ---------------------------------------------

export async function publishEvent(id: string): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('cultural_events')
    .update({ status: 'published', published_at: new Date().toISOString() })
    .eq('id', id)

  if (error) {
    console.error('publishEvent error:', error.message)
    return { success: false, error: friendlyError(error.message) }
  }
  return { success: true }
}

export async function verifyEvent(id: string): Promise<{ success: boolean; error?: string }> {
  const userId = (await supabase.auth.getUser()).data.user?.id ?? null
  const { error } = await supabase
    .from('cultural_events')
    .update({
      verification_status: 'verified',
      reviewed_by: userId,
      verified_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) {
    console.error('verifyEvent error:', error.message)
    return { success: false, error: friendlyError(error.message) }
  }
  return { success: true }
}

export async function updateEventStatus(id: string, status: EventStatus): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('cultural_events')
    .update({ status })
    .eq('id', id)

  if (error) {
    console.error('updateEventStatus error:', error.message)
    return { success: false, error: friendlyError(error.message) }
  }
  return { success: true }
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
