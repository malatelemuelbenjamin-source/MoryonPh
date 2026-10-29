import { supabase } from './supabase'

// ---- Types -----------------------------------------------------------------

export type VerificationDecision =
  | 'pending_review'
  | 'under_review'
  | 'needs_more_info'
  | 'verified'
  | 'rejected'
  | 'disputed'

export type CheckResult = 'pass' | 'warning' | 'fail'
export type CheckCategory = 'completeness' | 'consistency' | 'duplicate' | 'freshness' | 'relationship'

export interface VerificationEvidenceRow {
  id: string
  entity_type: string
  entity_id: string
  source_type: string
  source_title: string
  source_url: string | null
  source_organization: string | null
  evidence_description: string | null
  submitted_by: string | null
  reviewed_by: string | null
  review_status: string
  created_at: string
  reviewed_at: string | null
}

export interface DataQualityCheckRow {
  id: string
  entity_type: string
  entity_id: string
  check_category: CheckCategory
  check_name: string
  result: CheckResult
  explanation: string | null
  evaluated_at: string
}

export interface DataVerificationReviewRow {
  id: string
  entity_type: string
  entity_id: string
  reviewer_id: string | null
  decision: VerificationDecision
  notes: string | null
  rejection_reason: string | null
  previous_verification_status: string | null
  new_verification_status: string | null
  created_at: string
  decided_at: string | null
}

export interface DataRecordVersionRow {
  id: string
  entity_type: string
  entity_id: string
  version_number: number
  snapshot_data: Record<string, unknown>
  published_by: string | null
  published_at: string
  superseded_at: string | null
}

export interface VerificationSummary {
  totalPending: number
  newlySubmitted: number
  underReview: number
  needsMoreInfo: number
  verified: number
  rejected: number
  publishedNeedsReview: number
  expired: number
  conflicting: number
  missingInfo: number
}

export interface QueueItem {
  id: string
  entity_type: string
  entity_id: string
  title: string
  subtitle: string | null
  municipality: string | null
  verification_status: string
  created_at: string
  updated_at: string
  last_verified_at: string | null
}

// ---- Summary metrics -------------------------------------------------------

export async function fetchVerificationSummary(): Promise<VerificationSummary> {
  const { data, error } = await supabase.rpc('get_verification_summary')
  if (error || !data) {
    return await fetchVerificationSummaryClient()
  }
  return data as VerificationSummary
}

// Fallback: client-side aggregation from existing tables
async function fetchVerificationSummaryClient(): Promise<VerificationSummary> {
  const [
    routesPending, routesVerified, routesRejected,
    faresPending, faresVerified, faresExpired,
    locationsPending, locationsVerified,
    destinationsPending, eventsPending,
    operatorsPending,
    alertsPublished,
  ] = await Promise.all([
    supabase.from('routes').select('id', { count: 'exact', head: true }).in('verification_status', ['community', 'estimated']),
    supabase.from('routes').select('id', { count: 'exact', head: true }).in('verification_status', ['verified', 'official']),
    supabase.from('routes').select('id', { count: 'exact', head: true }).eq('verification_status', 'rejected'),
    supabase.from('fares').select('id', { count: 'exact', head: true }).in('verification_status', ['community', 'estimated']),
    supabase.from('fares').select('id', { count: 'exact', head: true }).in('verification_status', ['verified', 'official']),
    supabase.from('fares').select('id', { count: 'exact', head: true }).eq('verification_status', 'archived').lt('effective_until', new Date().toISOString().split('T')[0]),
    supabase.from('locations').select('id', { count: 'exact', head: true }).in('verification_status', ['community', 'estimated']),
    supabase.from('locations').select('id', { count: 'exact', head: true }).in('verification_status', ['verified', 'official']),
    supabase.from('destinations').select('id', { count: 'exact', head: true }).in('verification_status', ['unverified', 'pending_review']),
    supabase.from('cultural_events').select('id', { count: 'exact', head: true }).in('verification_status', ['unverified', 'pending_review']),
    supabase.from('transport_operators').select('id', { count: 'exact', head: true }).in('verification_status', ['pending_review', 'needs_more_information']),
    supabase.from('transport_alerts').select('id', { count: 'exact', head: true }).eq('status', 'published'),
  ])

  const c = (r: { count: number | null }): number => r.count ?? 0
  const totalPending = c(routesPending) + c(faresPending) + c(locationsPending) + c(destinationsPending) + c(eventsPending) + c(operatorsPending)

  return {
    totalPending,
    newlySubmitted: c(operatorsPending) + c(destinationsPending),
    underReview: 0,
    needsMoreInfo: 0,
    verified: c(routesVerified) + c(faresVerified) + c(locationsVerified),
    rejected: c(routesRejected),
    publishedNeedsReview: c(alertsPublished),
    expired: c(faresExpired),
    conflicting: 0,
    missingInfo: 0,
  }
}

// ---- Review queue ----------------------------------------------------------

const ENTITY_LABELS: Record<string, string> = {
  route: 'Route',
  fare: 'Fare',
  location: 'Location',
  destination: 'Destination',
  cultural_event: 'Event',
  transport_operator: 'Operator',
  transport_alert: 'Alert',
  emergency_contact: 'Emergency Contact',
}

export function entityLabel(entityType: string): string {
  return ENTITY_LABELS[entityType] ?? entityType.replace(/_/g, ' ')
}

export interface QueueFilter {
  entityType?: string
  verificationStatus?: string
  municipality?: string
  search?: string
}

export async function fetchVerificationQueue(
  filter: QueueFilter = {},
  page = 1,
  pageSize = 25
): Promise<{ items: QueueItem[]; total: number }> {
  const items: QueueItem[] = []
  const from = (page - 1) * pageSize
  const limit = pageSize

  const tables: Array<{ name: string; entityType: string; titleCol: string; subtitleCol: string | null; muniCol: string | null }> = [
    { name: 'routes', entityType: 'route', titleCol: 'route_name', subtitleCol: 'route_code', muniCol: null },
    { name: 'fares', entityType: 'fare', titleCol: 'fare_category', subtitleCol: 'fare_type', muniCol: null },
    { name: 'locations', entityType: 'location', titleCol: 'name', subtitleCol: 'type', muniCol: 'municipality' },
    { name: 'destinations', entityType: 'destination', titleCol: 'name', subtitleCol: 'municipality', muniCol: 'municipality' },
    { name: 'cultural_events', entityType: 'cultural_event', titleCol: 'title', subtitleCol: 'municipality', muniCol: 'municipality' },
    { name: 'transport_operators', entityType: 'transport_operator', titleCol: 'organization_name', subtitleCol: 'municipality', muniCol: 'municipality' },
    { name: 'transport_alerts', entityType: 'transport_alert', titleCol: 'title', subtitleCol: 'municipality', muniCol: 'municipality' },
    { name: 'emergency_contacts', entityType: 'emergency_contact', titleCol: 'agency_name', subtitleCol: 'municipality', muniCol: 'municipality' },
  ]

  const filteredTables = tables.filter((t) => !filter.entityType || filter.entityType === t.entityType)
  let total = 0

  for (const t of filteredTables) {
    const selectCols = `id,${t.titleCol}${t.subtitleCol ? `,${t.subtitleCol}` : ''}${t.muniCol ? `,${t.muniCol}` : ''},verification_status,created_at,updated_at,last_verified_at`
    let q = supabase.from(t.name).select(selectCols, { count: 'exact' })
    q = q.not('verification_status', 'in', '("official","verified")')
    if (filter.municipality && t.muniCol) {
      q = q.eq(t.muniCol, filter.municipality)
    }
    if (filter.search) {
      q = q.ilike(t.titleCol, `%${filter.search}%`)
    }
    const { data, error, count } = await q.order('updated_at', { ascending: false }).limit(limit)
    if (error || !data) continue
    total += count ?? data.length
    for (const row of data) {
      const r = row as unknown as Record<string, unknown>
      items.push({
        id: r.id as string,
        entity_type: t.entityType,
        entity_id: r.id as string,
        title: (r[t.titleCol] as string) ?? 'Untitled',
        subtitle: t.subtitleCol ? (r[t.subtitleCol] as string) ?? null : null,
        municipality: t.muniCol ? (r[t.muniCol] as string) ?? null : null,
        verification_status: (r.verification_status as string) ?? 'community',
        created_at: (r.created_at as string) ?? new Date().toISOString(),
        updated_at: (r.updated_at as string) ?? new Date().toISOString(),
        last_verified_at: (r.last_verified_at as string) ?? null,
      })
    }
  }

  items.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
  return { items: items.slice(from, from + limit), total }
}

// ---- Evidence --------------------------------------------------------------

export async function fetchEvidence(entityType: string, entityId: string): Promise<VerificationEvidenceRow[]> {
  const { data, error } = await supabase
    .from('verification_evidence')
    .select('*')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('fetchEvidence error:', error.message)
    return []
  }
  return (data ?? []) as unknown as VerificationEvidenceRow[]
}

export async function addEvidence(
  entityType: string,
  entityId: string,
  sourceType: string,
  sourceTitle: string,
  sourceUrl?: string,
  sourceOrganization?: string,
  description?: string
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from('verification_evidence')
    .insert({
      entity_type: entityType,
      entity_id: entityId,
      source_type: sourceType,
      source_title: sourceTitle,
      source_url: sourceUrl ?? null,
      source_organization: sourceOrganization ?? null,
      evidence_description: description ?? null,
      submitted_by: (await supabase.auth.getUser()).data.user?.id ?? null,
    })

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

// ---- Quality checks --------------------------------------------------------

export async function fetchQualityChecks(entityType: string, entityId: string): Promise<DataQualityCheckRow[]> {
  const { data, error } = await supabase
    .from('data_quality_checks')
    .select('*')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('evaluated_at', { ascending: false })

  if (error) {
    console.error('fetchQualityChecks error:', error.message)
    return []
  }
  return (data ?? []) as unknown as DataQualityCheckRow[]
}

export async function fetchAllQualityChecks(limit = 50): Promise<DataQualityCheckRow[]> {
  const { data, error } = await supabase
    .from('data_quality_checks')
    .select('*')
    .order('evaluated_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('fetchAllQualityChecks error:', error.message)
    return []
  }
  return (data ?? []) as unknown as DataQualityCheckRow[]
}

// ---- Reviews ---------------------------------------------------------------

export async function fetchReviews(entityType: string, entityId: string): Promise<DataVerificationReviewRow[]> {
  const { data, error } = await supabase
    .from('data_verification_reviews')
    .select('*')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('fetchReviews error:', error.message)
    return []
  }
  return (data ?? []) as unknown as DataVerificationReviewRow[]
}

export async function submitReview(
  entityType: string,
  entityId: string,
  decision: VerificationDecision,
  notes?: string,
  rejectionReason?: string,
  previousStatus?: string,
  newStatus?: string
): Promise<{ ok: boolean; error?: string }> {
  const user = (await supabase.auth.getUser()).data.user
  if (!user) return { ok: false, error: 'Not authenticated' }

  const { error } = await supabase
    .from('data_verification_reviews')
    .insert({
      entity_type: entityType,
      entity_id: entityId,
      reviewer_id: user.id,
      decision,
      notes: notes ?? null,
      rejection_reason: rejectionReason ?? null,
      previous_verification_status: previousStatus ?? null,
      new_verification_status: newStatus ?? null,
      decided_at: decision === 'pending_review' ? null : new Date().toISOString(),
    })

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

// ---- Version history -------------------------------------------------------

export async function fetchRecordVersions(entityType: string, entityId: string): Promise<DataRecordVersionRow[]> {
  const { data, error } = await supabase
    .from('data_record_versions')
    .select('*')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('version_number', { ascending: false })

  if (error) {
    console.error('fetchRecordVersions error:', error.message)
    return []
  }
  return (data ?? []) as unknown as DataRecordVersionRow[]
}

export async function saveRecordVersion(
  entityType: string,
  entityId: string,
  snapshotData: Record<string, unknown>
): Promise<{ ok: boolean; error?: string }> {
  const existing = await fetchRecordVersions(entityType, entityId)
  const nextVersion = (existing.length > 0 ? Math.max(...existing.map((v) => v.version_number)) : 0) + 1

  const user = (await supabase.auth.getUser()).data.user
  const { error } = await supabase
    .from('data_record_versions')
    .insert({
      entity_type: entityType,
      entity_id: entityId,
      version_number: nextVersion,
      snapshot_data: snapshotData,
      published_by: user?.id ?? null,
    })

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

// ---- Entity detail fetchers ------------------------------------------------

export async function fetchEntityDetail(entityType: string, entityId: string): Promise<Record<string, unknown> | null> {
  const tableMap: Record<string, string> = {
    route: 'routes',
    fare: 'fares',
    location: 'locations',
    destination: 'destinations',
    cultural_event: 'cultural_events',
    transport_operator: 'transport_operators',
    transport_alert: 'transport_alerts',
    emergency_contact: 'emergency_contacts',
  }

  const table = tableMap[entityType]
  if (!table) return null

  const { data, error } = await supabase
    .from(table)
    .select('*')
    .eq('id', entityId)
    .maybeSingle()

  if (error) {
    console.error('fetchEntityDetail error:', error.message)
    return null
  }
  return data as Record<string, unknown> | null
}

// ---- Status update (updates the underlying table's verification_status) ----

export async function updateVerificationStatus(
  entityType: string,
  entityId: string,
  newStatus: string
): Promise<{ ok: boolean; error?: string }> {
  const tableMap: Record<string, string> = {
    route: 'routes',
    fare: 'fares',
    location: 'locations',
    destination: 'destinations',
    cultural_event: 'cultural_events',
    transport_operator: 'transport_operators',
    transport_alert: 'transport_alerts',
    emergency_contact: 'emergency_contacts',
  }

  const table = tableMap[entityType]
  if (!table) return { ok: false, error: 'Unknown entity type' }

  const updatePayload: Record<string, unknown> = {
    verification_status: newStatus,
    last_verified_at: newStatus === 'verified' || newStatus === 'official' ? new Date().toISOString() : null,
  }

  if (table === 'destinations') {
    updatePayload.verified_at = newStatus === 'verified' ? new Date().toISOString() : null
  }
  if (table === 'transport_operators') {
    updatePayload.verified_at = newStatus === 'approved' ? new Date().toISOString() : null
  }

  const { error } = await supabase
    .from(table)
    .update(updatePayload)
    .eq('id', entityId)

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}
