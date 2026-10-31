import { supabase } from './supabase'

// ---- Types -----------------------------------------------------------------

export interface DashboardMetrics {
  totalUsers: number
  totalRoutes: number
  activeTransportModes: number
  publishedFares: number
  pendingOperatorSubmissions: number
  pendingCommunityReports: number
  pendingFareConcerns: number
  activeTransportAlerts: number
  upcomingEvents: number
  pendingDestinationVerifications: number
  pendingEventVerifications: number
  totalDestinations: number
  totalOperators: number
}

export interface AdminAuditLogRow {
  id: string
  actor_user_id: string | null
  action: string
  entity_type: string
  entity_id: string | null
  summary: string | null
  before_data: Record<string, unknown> | null
  after_data: Record<string, unknown> | null
  created_at: string
}

export interface ModuleLink {
  to: string
  label: string
  description: string
  metricKey?: keyof DashboardMetrics
  icon: string
}

// ---- Module links ---------------------------------------------------------

export const ADMIN_MODULES: ModuleLink[] = [
  { to: '/admin/routes', label: 'Transportation Routes', description: 'Manage routes, stops, connections', icon: 'route' },
  { to: '/admin/fares', label: 'Fare Management', description: 'Fares, rules, discounts, updates', icon: 'fare', metricKey: 'publishedFares' },
  { to: '/admin/fare-matrix', label: 'Fare Matrices', description: 'Fare matrix entries and publication', icon: 'matrix' },
  { to: '/admin/locations', label: 'Locations & Municipalities', description: 'Towns, terminals, ports, landmarks', icon: 'map' },
  { to: '/admin/municipalities', label: 'Municipality Explorer', description: 'Six municipality details and verified boundaries', icon: 'map' },
  { to: '/admin/tricycle', label: 'Tricycle Service Areas', description: 'Zones, fare zones, connections', icon: 'tricycle' },
  { to: '/admin/ports', label: 'Ports & Sea Transport', description: 'Ferry, RORO, boat schedules', icon: 'port' },
  { to: '/operator-portal/admin', label: 'Operator Submissions', description: 'Review operator applications & service changes', icon: 'operator', metricKey: 'pendingOperatorSubmissions' },
  { to: '/community-reports/admin', label: 'Community Reports', description: 'Transport reports from commuters', icon: 'report', metricKey: 'pendingCommunityReports' },
  { to: '/fare-concerns/admin', label: 'Fare Concerns', description: 'Overcharging and fare violation reports', icon: 'concern', metricKey: 'pendingFareConcerns' },
  { to: '/transport-alerts/admin', label: 'Transport Alerts', description: 'Create, publish, expire advisories', icon: 'alert', metricKey: 'activeTransportAlerts' },
  { to: '/admin/weather', label: 'Weather Information', description: 'Weather cache and advisory sources', icon: 'weather' },
  { to: '/admin/destinations', label: 'Explore Destinations', description: 'Tourism destinations and verification', icon: 'destination', metricKey: 'pendingDestinationVerifications' },
  { to: '/admin/events', label: 'Culture & Events', description: 'Cultural events and schedules', icon: 'event', metricKey: 'pendingEventVerifications' },
  { to: '/admin/nearby-places', label: 'Nearby Places', description: 'Services and place details', icon: 'nearby' },
  { to: '/admin/emergency', label: 'Emergency & Safety', description: 'Contacts, guides, safety info', icon: 'emergency' },
  { to: '/admin/users', label: 'User Accounts & Roles', description: 'Search users, review account status', icon: 'users', metricKey: 'totalUsers' },
  { to: '/admin/audit-logs', label: 'Audit Logs', description: 'Centralized administrative action history', icon: 'audit' },
  { to: '/admin/verification', label: 'Data Verification', description: 'Review, verify, and publish records', icon: 'verify' },
  { to: '/admin/settings', label: 'Application Settings', description: 'Offline datasets and system config', icon: 'settings' },
]

// ---- Metrics ---------------------------------------------------------------

export async function fetchDashboardMetrics(): Promise<DashboardMetrics> {
  const [
    usersRes,
    routesRes,
    modesRes,
    faresRes,
    operatorSubsRes,
    communityReportsRes,
    fareConcernsRes,
    alertsRes,
    eventsRes,
    destinationsRes,
    eventVerifRes,
    operatorsRes,
  ] = await Promise.all([
    supabase.from('users').select('id', { count: 'exact', head: true }),
    supabase.from('routes').select('id', { count: 'exact', head: true }).eq('route_status', 'active'),
    supabase.from('transport_modes').select('id', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('fares').select('id', { count: 'exact', head: true }).in('verification_status', ['official', 'verified']),
    supabase.from('transport_service_submissions').select('id', { count: 'exact', head: true }).in('status', ['pending_review', 'under_review', 'needs_more_information']),
    supabase.from('community_transport_reports').select('id', { count: 'exact', head: true }).in('status', ['submitted', 'under_review', 'needs_more_info']),
    supabase.from('fare_concern_reports').select('id', { count: 'exact', head: true }).in('status', ['submitted', 'under_review', 'needs_more_info']),
    supabase.from('transport_alerts').select('id', { count: 'exact', head: true }).eq('status', 'published'),
    supabase.from('cultural_events').select('id', { count: 'exact', head: true }).eq('status', 'published').gte('start_at', new Date().toISOString()),
    supabase.from('destinations').select('id', { count: 'exact', head: true }),
    supabase.from('cultural_events').select('id', { count: 'exact', head: true }).in('verification_status', ['unverified', 'pending_review']),
    supabase.from('transport_operators').select('id', { count: 'exact', head: true }),
  ])

  const count = (r: { count: number | null }): number => r.count ?? 0

  return {
    totalUsers: count(usersRes),
    totalRoutes: count(routesRes),
    activeTransportModes: count(modesRes),
    publishedFares: count(faresRes),
    pendingOperatorSubmissions: count(operatorSubsRes),
    pendingCommunityReports: count(communityReportsRes),
    pendingFareConcerns: count(fareConcernsRes),
    activeTransportAlerts: count(alertsRes),
    upcomingEvents: count(eventsRes),
    totalDestinations: count(destinationsRes),
    pendingEventVerifications: count(eventVerifRes),
    pendingDestinationVerifications: 0,
    totalOperators: count(operatorsRes),
  }
}

// ---- Audit logs ------------------------------------------------------------

export async function fetchAdminAuditLogs(limit = 20): Promise<AdminAuditLogRow[]> {
  const { data, error } = await supabase
    .from('admin_audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('fetchAdminAuditLogs error:', error.message)
    return []
  }
  return (data ?? []) as unknown as AdminAuditLogRow[]
}

export async function fetchAllAdminAuditLogs(page = 1, pageSize = 50): Promise<{ rows: AdminAuditLogRow[]; total: number }> {
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  const [dataRes, countRes] = await Promise.all([
    supabase.from('admin_audit_logs').select('*').order('created_at', { ascending: false }).range(from, to),
    supabase.from('admin_audit_logs').select('id', { count: 'exact', head: true }),
  ])

  if (dataRes.error) {
    console.error('fetchAllAdminAuditLogs error:', dataRes.error.message)
    return { rows: [], total: 0 }
  }

  return {
    rows: (dataRes.data ?? []) as unknown as AdminAuditLogRow[],
    total: countRes.count ?? 0,
  }
}

// ---- Recent activity from existing per-module audit tables -----------------

export interface RecentActivityItem {
  id: string
  action: string
  entity_type: string
  summary: string | null
  created_at: string
}

export async function fetchRecentActivity(limit = 10): Promise<RecentActivityItem[]> {
  const [fareAudits, communityAudits, fareConcernAudits, alertAudits, operatorAudits] = await Promise.all([
    supabase.from('fare_update_audit_logs').select('id, action, reason, created_at').order('created_at', { ascending: false }).limit(limit),
    supabase.from('community_report_audit_logs').select('id, action, internal_note, created_at').order('created_at', { ascending: false }).limit(limit),
    supabase.from('fare_concern_audit_logs').select('id, action, internal_note, created_at').order('created_at', { ascending: false }).limit(limit),
    supabase.from('transport_alert_audit_logs').select('id, action, note, created_at').order('created_at', { ascending: false }).limit(limit),
    supabase.from('transport_operator_audit_logs').select('id, action, summary, created_at').order('created_at', { ascending: false }).limit(limit),
  ])

  const items: RecentActivityItem[] = []

  for (const r of (fareAudits.data ?? [])) {
    items.push({ id: r.id, action: r.action, entity_type: 'fare_update', summary: r.reason, created_at: r.created_at })
  }
  for (const r of (communityAudits.data ?? [])) {
    items.push({ id: r.id, action: r.action, entity_type: 'community_report', summary: r.internal_note, created_at: r.created_at })
  }
  for (const r of (fareConcernAudits.data ?? [])) {
    items.push({ id: r.id, action: r.action, entity_type: 'fare_concern', summary: r.internal_note, created_at: r.created_at })
  }
  for (const r of (alertAudits.data ?? [])) {
    items.push({ id: r.id, action: r.action, entity_type: 'transport_alert', summary: r.note, created_at: r.created_at })
  }
  for (const r of (operatorAudits.data ?? [])) {
    items.push({ id: r.id, action: r.action, entity_type: 'operator', summary: r.summary, created_at: r.created_at })
  }

  items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  return items.slice(0, limit)
}

// ---- User search (admin only) ---------------------------------------------

export interface AdminUserRow {
  id: string
  name: string | null
  email: string | null
  username: string | null
  home_municipality: string | null
  preferred_language: string | null
  created_at: string
}

export async function searchUsers(query: string, page = 1, pageSize = 20): Promise<{ rows: AdminUserRow[]; total: number }> {
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let queryBuilder = supabase.from('users').select('*', { count: 'exact' })

  if (query.trim()) {
    queryBuilder = queryBuilder.or(`name.ilike.%${query.trim()}%,email.ilike.%${query.trim()}%,username.ilike.%${query.trim()}%`)
  }

  const { data, error, count } = await queryBuilder.order('created_at', { ascending: false }).range(from, to)

  if (error) {
    console.error('searchUsers error:', error.message)
    return { rows: [], total: 0 }
  }

  return {
    rows: (data ?? []) as unknown as AdminUserRow[],
    total: count ?? 0,
  }
}
