import { supabase } from './supabase'
import type {
  TransportAlertCategory,
  TransportAlertSeverity,
  TransportAlertStatus,
  TransportAlertVerification,
  TransportAlertWithDetails,
  TransportAlertAuditLogRow,
  TransportAlertAuditAction,
  TransportAlertSubscriptionRow,
  TransportModeRow,
  LocationRow,
  RouteRow,
} from './types'

// ---- Constants -----------------------------------------------------------

export const MUNICIPALITIES = ['Boac', 'Buenavista', 'Gasan', 'Mogpog', 'Santa Cruz', 'Torrijos'] as const

export const CATEGORY_LABELS: Record<TransportAlertCategory, string> = {
  route_closure: 'Route Closure or Change',
  service_interruption: 'Service Interruption',
  schedule_change: 'Schedule Change',
  jeepney_advisory: 'Jeepney Service Advisory',
  tricycle_advisory: 'Tricycle Service Advisory',
  ferry_roro_advisory: 'Ferry or RORO Advisory',
  boat_island_advisory: 'Boat & Island Travel Advisory',
  port_advisory: 'Port Advisory',
  weather_transport: 'Weather-Related Transport Advisory',
  terminal_stop_advisory: 'Terminal or Stop Advisory',
  road_access_traffic: 'Road Access or Traffic Advisory',
  emergency_transport: 'Emergency Transport Advisory',
  general_announcement: 'General Transport Announcement',
}

export const CATEGORY_ORDER: TransportAlertCategory[] = [
  'route_closure',
  'service_interruption',
  'schedule_change',
  'jeepney_advisory',
  'tricycle_advisory',
  'ferry_roro_advisory',
  'boat_island_advisory',
  'port_advisory',
  'weather_transport',
  'terminal_stop_advisory',
  'road_access_traffic',
  'emergency_transport',
  'general_announcement',
]

export const SEVERITY_LABELS: Record<TransportAlertSeverity, string> = {
  info: 'Info',
  low: 'Low',
  moderate: 'Moderate',
  high: 'High',
  critical: 'Critical',
}

export const SEVERITY_ORDER: TransportAlertSeverity[] = ['critical', 'high', 'moderate', 'low', 'info']

export const STATUS_LABELS: Record<TransportAlertStatus, string> = {
  draft: 'Draft',
  pending_review: 'Pending Review',
  published: 'Published',
  updated: 'Updated',
  resolved: 'Resolved',
  expired: 'Expired',
  rejected: 'Rejected',
}

export const VERIFICATION_LABELS: Record<TransportAlertVerification, string> = {
  verified: 'Verified Alert',
  application_advisory: 'Application Advisory',
  unverified: 'Unverified',
  rejected: 'Rejected',
}

export function severityClasses(severity: TransportAlertSeverity): string {
  switch (severity) {
    case 'critical': return 'bg-red-100 text-red-700'
    case 'high': return 'bg-terra-100 text-terra-700'
    case 'moderate': return 'bg-sand-200 text-terra-800'
    case 'low': return 'bg-ocean-100 text-ocean-800'
    case 'info': return 'bg-ocean-50 text-ocean-600'
  }
}

export function statusClasses(status: TransportAlertStatus): string {
  switch (status) {
    case 'published': return 'bg-leaf-100 text-leaf-700'
    case 'updated': return 'bg-ocean-100 text-ocean-800'
    case 'resolved': return 'bg-sand-200 text-ocean-700'
    case 'expired': return 'bg-ocean-50 text-ocean-500'
    case 'rejected': return 'bg-red-100 text-red-700'
    case 'draft': return 'bg-sand-200 text-ocean-600'
    case 'pending_review': return 'bg-terra-100 text-terra-700'
  }
}

export function verificationClasses(v: TransportAlertVerification): string {
  switch (v) {
    case 'verified': return 'bg-leaf-600 text-white'
    case 'application_advisory': return 'bg-ocean-700 text-white'
    case 'unverified': return 'bg-sand-300 text-ocean-900'
    case 'rejected': return 'bg-red-100 text-red-700'
  }
}

export function categoryLabel(c: TransportAlertCategory): string {
  return CATEGORY_LABELS[c] ?? c
}

export function severityLabel(s: TransportAlertSeverity): string {
  return SEVERITY_LABELS[s] ?? s
}

export function statusLabel(s: TransportAlertStatus): string {
  return STATUS_LABELS[s] ?? s
}

// ---- Fetch transport modes & locations & routes (reuse from communityReports) ----

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

export async function fetchMunicipalities(): Promise<{ id: string; name: string }[]> {
  const { data, error } = await supabase
    .from('locations')
    .select('id, name')
    .eq('type', 'municipality')
    .order('name', { ascending: true })
  if (error) {
    console.error('fetchMunicipalities error:', error.message)
    return []
  }
  return (data ?? []) as { id: string; name: string }[]
}

export async function searchLocations(query: string): Promise<Pick<LocationRow, 'id' | 'name' | 'municipality' | 'type'>[]> {
  const term = query.trim().toLowerCase()
  if (!term) return []
  const { data, error } = await supabase
    .from('locations')
    .select('id, name, municipality, type')
    .eq('is_searchable', true)
    .or(`name.ilike.%${term}%,normalized_name.ilike.%${term}%`)
    .order('name', { ascending: true })
    .limit(15)
  if (error) {
    console.error('searchLocations error:', error.message)
    return []
  }
  return (data ?? []) as Pick<LocationRow, 'id' | 'name' | 'municipality' | 'type'>[]
}

export async function searchRoutes(query: string): Promise<Pick<RouteRow, 'id' | 'route_name' | 'route_code'>[]> {
  const term = query.trim().toLowerCase()
  if (!term) return []
  const { data, error } = await supabase
    .from('routes')
    .select('id, route_name, route_code')
    .or(`route_name.ilike.%${term}%,route_code.ilike.%${term}%`)
    .order('route_name', { ascending: true })
    .limit(15)
  if (error) {
    console.error('searchRoutes error:', error.message)
    return []
  }
  return (data ?? []) as Pick<RouteRow, 'id' | 'route_name' | 'route_code'>[]
}

// ---- Fetch published alerts (public) -------------------------------------

export async function fetchPublishedAlerts(limit = 50): Promise<TransportAlertWithDetails[]> {
  const { data, error } = await supabase
    .from('transport_alerts')
    .select(
      '*, location:locations(id, name, municipality), route:routes(id, route_name, route_code), transport_mode:transport_modes(id, name, code, icon)',
    )
    .in('status', ['published', 'updated'])
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(limit)

  if (error) {
    console.error('fetchPublishedAlerts error:', error.message)
    return []
  }
  return (data ?? []) as TransportAlertWithDetails[]
}

export async function fetchResolvedAlerts(limit = 10): Promise<TransportAlertWithDetails[]> {
  const { data, error } = await supabase
    .from('transport_alerts')
    .select(
      '*, location:locations(id, name, municipality), route:routes(id, route_name, route_code), transport_mode:transport_modes(id, name, code, icon)',
    )
    .eq('status', 'resolved')
    .order('resolved_at', { ascending: false, nullsFirst: false })
    .limit(limit)

  if (error) {
    console.error('fetchResolvedAlerts error:', error.message)
    return []
  }
  return (data ?? []) as TransportAlertWithDetails[]
}

export async function fetchAlert(id: string): Promise<TransportAlertWithDetails | null> {
  const { data, error } = await supabase
    .from('transport_alerts')
    .select(
      '*, location:locations(id, name, municipality), route:routes(id, route_name, route_code), transport_mode:transport_modes(id, name, code, icon), publisher:users!transport_alerts_published_by_fkey(id, name), reviewer:users!transport_alerts_reviewed_by_fkey(id, name)',
    )
    .eq('id', id)
    .maybeSingle()

  if (error) {
    console.error('fetchAlert error:', error.message)
    return null
  }
  return data as TransportAlertWithDetails | null
}

// ---- Fetch alerts by route or municipality (for integration) -------------

export async function fetchAlertsForRoute(routeId: string): Promise<TransportAlertWithDetails[]> {
  const { data, error } = await supabase
    .from('transport_alerts')
    .select(
      '*, location:locations(id, name, municipality), route:routes(id, route_name, route_code), transport_mode:transport_modes(id, name, code, icon)',
    )
    .eq('route_id', routeId)
    .in('status', ['published', 'updated'])
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(10)

  if (error) {
    console.error('fetchAlertsForRoute error:', error.message)
    return []
  }
  return (data ?? []) as TransportAlertWithDetails[]
}

export async function fetchAlertsForMunicipality(municipality: string): Promise<TransportAlertWithDetails[]> {
  const { data, error } = await supabase
    .from('transport_alerts')
    .select(
      '*, location:locations(id, name, municipality), route:routes(id, route_name, route_code), transport_mode:transport_modes(id, name, code, icon)',
    )
    .eq('municipality', municipality)
    .in('status', ['published', 'updated'])
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(10)

  if (error) {
    console.error('fetchAlertsForMunicipality error:', error.message)
    return []
  }
  return (data ?? []) as TransportAlertWithDetails[]
}

// ---- Admin: fetch all alerts ---------------------------------------------

export async function fetchAllAlerts(): Promise<TransportAlertWithDetails[]> {
  const { data, error } = await supabase
    .from('transport_alerts')
    .select(
      '*, location:locations(id, name, municipality), route:routes(id, route_name, route_code), transport_mode:transport_modes(id, name, code, icon), publisher:users!transport_alerts_published_by_fkey(id, name), reviewer:users!transport_alerts_reviewed_by_fkey(id, name)',
    )
    .order('created_at', { ascending: false })

  if (error) {
    console.error('fetchAllAlerts error:', error.message)
    return []
  }
  return (data ?? []) as TransportAlertWithDetails[]
}

// ---- Admin: create alert -------------------------------------------------

export interface NewAlertInput {
  title: string
  description: string
  category: TransportAlertCategory
  severity: TransportAlertSeverity
  verification: TransportAlertVerification
  municipality?: string | null
  location_id?: string | null
  route_id?: string | null
  transport_mode_id?: string | null
  source_name?: string | null
  source_url?: string | null
  source_reference?: string | null
  recommended_actions?: string | null
  starts_at?: string | null
  ends_at?: string | null
}

export async function createAlert(
  input: NewAlertInput,
): Promise<{ success: boolean; id?: string; error?: string }> {
  const userId = (await supabase.auth.getUser()).data.user?.id ?? null

  const { data, error } = await supabase
    .from('transport_alerts')
    .insert({
      title: input.title.trim(),
      description: input.description.trim(),
      category: input.category,
      severity: input.severity,
      status: 'draft',
      verification: input.verification,
      municipality: input.municipality ?? null,
      location_id: input.location_id ?? null,
      route_id: input.route_id ?? null,
      transport_mode_id: input.transport_mode_id ?? null,
      source_name: input.source_name?.trim() || null,
      source_url: input.source_url?.trim() || null,
      source_reference: input.source_reference?.trim() || null,
      recommended_actions: input.recommended_actions?.trim() || null,
      starts_at: input.starts_at || null,
      ends_at: input.ends_at || null,
      published_by: null,
      reviewed_by: userId,
    })
    .select('id')
    .maybeSingle()

  if (error) {
    console.error('createAlert error:', error.message)
    return { success: false, error: friendlyError(error.message) }
  }

  const alertId = (data as { id: string } | null)?.id
  if (alertId) {
    void logAudit(alertId, 'created', null, 'draft')
  }

  return { success: true, id: alertId }
}

// ---- Admin: update alert -------------------------------------------------

export async function updateAlert(
  id: string,
  fields: Partial<NewAlertInput>,
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('transport_alerts')
    .update({
      title: fields.title?.trim(),
      description: fields.description?.trim(),
      category: fields.category,
      severity: fields.severity,
      verification: fields.verification,
      municipality: fields.municipality ?? null,
      location_id: fields.location_id ?? null,
      route_id: fields.route_id ?? null,
      transport_mode_id: fields.transport_mode_id ?? null,
      source_name: fields.source_name?.trim() || null,
      source_url: fields.source_url?.trim() || null,
      source_reference: fields.source_reference?.trim() || null,
      recommended_actions: fields.recommended_actions?.trim() || null,
      starts_at: fields.starts_at || null,
      ends_at: fields.ends_at || null,
    })
    .eq('id', id)

  if (error) {
    console.error('updateAlert error:', error.message)
    return { success: false, error: friendlyError(error.message) }
  }

  void logAudit(id, 'updated', null, null, 'Alert fields updated')
  return { success: true }
}

// ---- Admin: lifecycle actions --------------------------------------------

export async function submitForReview(id: string): Promise<{ success: boolean; error?: string }> {
  const { data: current } = await supabase
    .from('transport_alerts')
    .select('status')
    .eq('id', id)
    .maybeSingle()

  const prevStatus = (current as { status: TransportAlertStatus } | null)?.status ?? null

  const { error } = await supabase
    .from('transport_alerts')
    .update({ status: 'pending_review' })
    .eq('id', id)

  if (error) {
    console.error('submitForReview error:', error.message)
    return { success: false, error: friendlyError(error.message) }
  }

  void logAudit(id, 'submitted_for_review', prevStatus, 'pending_review')
  return { success: true }
}

export async function publishAlert(id: string): Promise<{ success: boolean; error?: string }> {
  const { data: current } = await supabase
    .from('transport_alerts')
    .select('status, source_name')
    .eq('id', id)
    .maybeSingle()

  const row = current as { status: TransportAlertStatus; source_name: string | null } | null
  if (!row) return { success: false, error: 'Alert not found.' }
  if (!row.source_name) {
    return { success: false, error: 'A source is required before publishing.' }
  }

  const userId = (await supabase.auth.getUser()).data.user?.id ?? null
  const now = new Date().toISOString()

  const { error } = await supabase
    .from('transport_alerts')
    .update({
      status: 'published',
      published_by: userId,
      published_at: now,
    })
    .eq('id', id)

  if (error) {
    console.error('publishAlert error:', error.message)
    return { success: false, error: friendlyError(error.message) }
  }

  void logAudit(id, 'published', row.status, 'published')
  return { success: true }
}

export async function resolveAlert(id: string, note?: string): Promise<{ success: boolean; error?: string }> {
  const { data: current } = await supabase
    .from('transport_alerts')
    .select('status')
    .eq('id', id)
    .maybeSingle()

  const prevStatus = (current as { status: TransportAlertStatus } | null)?.status ?? null

  const { error } = await supabase
    .from('transport_alerts')
    .update({
      status: 'resolved',
      resolved_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) {
    console.error('resolveAlert error:', error.message)
    return { success: false, error: friendlyError(error.message) }
  }

  void logAudit(id, 'resolved', prevStatus, 'resolved', note)
  return { success: true }
}

export async function expireAlert(id: string): Promise<{ success: boolean; error?: string }> {
  const { data: current } = await supabase
    .from('transport_alerts')
    .select('status')
    .eq('id', id)
    .maybeSingle()

  const prevStatus = (current as { status: TransportAlertStatus } | null)?.status ?? null

  const { error } = await supabase
    .from('transport_alerts')
    .update({ status: 'expired' })
    .eq('id', id)

  if (error) {
    console.error('expireAlert error:', error.message)
    return { success: false, error: friendlyError(error.message) }
  }

  void logAudit(id, 'expired', prevStatus, 'expired')
  return { success: true }
}

export async function rejectAlert(id: string, note?: string): Promise<{ success: boolean; error?: string }> {
  const { data: current } = await supabase
    .from('transport_alerts')
    .select('status')
    .eq('id', id)
    .maybeSingle()

  const prevStatus = (current as { status: TransportAlertStatus } | null)?.status ?? null

  const { error } = await supabase
    .from('transport_alerts')
    .update({ status: 'rejected', verification: 'rejected' })
    .eq('id', id)

  if (error) {
    console.error('rejectAlert error:', error.message)
    return { success: false, error: friendlyError(error.message) }
  }

  void logAudit(id, 'rejected', prevStatus, 'rejected', note)
  return { success: true }
}

// ---- Audit log helper ----------------------------------------------------

async function logAudit(
  alertId: string,
  action: TransportAlertAuditAction,
  prevStatus: TransportAlertStatus | null,
  newStatus: TransportAlertStatus | null,
  note?: string,
): Promise<void> {
  const userId = (await supabase.auth.getUser()).data.user?.id ?? null
  await supabase.from('transport_alert_audit_logs').insert({
    alert_id: alertId,
    actor_id: userId,
    action,
    previous_status: prevStatus,
    new_status: newStatus,
    note: note?.trim() || null,
  })
}

export async function fetchAuditLogs(alertId: string): Promise<TransportAlertAuditLogRow[]> {
  const { data, error } = await supabase
    .from('transport_alert_audit_logs')
    .select('*')
    .eq('alert_id', alertId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('fetchAuditLogs error:', error.message)
    return []
  }
  return (data ?? []) as TransportAlertAuditLogRow[]
}

// ---- Admin check ---------------------------------------------------------

export async function isAlertAdmin(): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_alert_admin')
  if (error) {
    console.error('isAlertAdmin error:', error.message)
    return false
  }
  return data === true
}

// ---- Subscriptions -------------------------------------------------------

export async function fetchSubscriptions(): Promise<TransportAlertSubscriptionRow[]> {
  const { data, error } = await supabase
    .from('transport_alert_subscriptions')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('fetchSubscriptions error:', error.message)
    return []
  }
  return (data ?? []) as TransportAlertSubscriptionRow[]
}

export async function createSubscription(
  input: Omit<TransportAlertSubscriptionRow, 'id' | 'user_id' | 'created_at' | 'updated_at'>,
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.from('transport_alert_subscriptions').insert({
    municipality: input.municipality ?? null,
    route_id: input.route_id ?? null,
    transport_mode_id: input.transport_mode_id ?? null,
    categories: input.categories,
    minimum_severity: input.minimum_severity,
    enabled: input.enabled,
  })

  if (error) {
    console.error('createSubscription error:', error.message)
    return { success: false, error: friendlyError(error.message) }
  }
  return { success: true }
}

export async function toggleSubscription(id: string, enabled: boolean): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('transport_alert_subscriptions')
    .update({ enabled })
    .eq('id', id)

  if (error) {
    console.error('toggleSubscription error:', error.message)
    return { success: false, error: error.message }
  }
  return { success: true }
}

export async function deleteSubscription(id: string): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('transport_alert_subscriptions')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('deleteSubscription error:', error.message)
    return { success: false, error: error.message }
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
