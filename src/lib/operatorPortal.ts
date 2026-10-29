import { supabase } from './supabase'
import { isAlertAdmin } from './transportAlerts'
import type {
  TransportOperatorVerificationStatus,
  TransportOperatorRow,
  TransportOperatorWithMode,
  TransportServiceSubmissionRow,
  TransportServiceSubmissionWithDetails,
  TransportSubmissionStatus,
  TransportSubmissionType,
  TransportOperatorAuditLogRow,
} from './types'

// ---- Status labels --------------------------------------------------------

export const OPERATOR_STATUS_LABELS: Record<TransportOperatorVerificationStatus, string> = {
  not_submitted: 'Not Submitted',
  pending_review: 'Pending Review',
  needs_more_information: 'Needs More Info',
  approved: 'Approved',
  rejected: 'Rejected',
  suspended: 'Suspended',
}

export const SUBMISSION_STATUS_LABELS: Record<TransportSubmissionStatus, string> = {
  pending_review: 'Pending Review',
  under_review: 'Under Review',
  needs_more_information: 'Needs More Info',
  approved: 'Approved',
  rejected: 'Rejected',
  published: 'Published',
}

export const SUBMISSION_TYPE_LABELS: Record<TransportSubmissionType, string> = {
  new_route: 'New Route',
  route_update: 'Route Update',
  fare_change: 'Fare Change',
  schedule_update: 'Schedule Update',
  service_interruption: 'Service Interruption',
  contact_update: 'Contact Update',
}

export function operatorStatusColor(status: TransportOperatorVerificationStatus): string {
  switch (status) {
    case 'approved':
      return 'bg-leaf-600 text-white'
    case 'pending_review':
      return 'bg-ocean-100 text-ocean-800'
    case 'needs_more_information':
      return 'bg-terra-100 text-terra-700'
    case 'rejected':
      return 'bg-red-100 text-red-700'
    case 'suspended':
      return 'bg-red-700 text-white'
    case 'not_submitted':
      return 'bg-sand-200 text-ocean-700'
  }
}

export function submissionStatusColor(status: TransportSubmissionStatus): string {
  switch (status) {
    case 'pending_review':
      return 'bg-ocean-100 text-ocean-800'
    case 'under_review':
      return 'bg-terra-100 text-terra-700'
    case 'needs_more_information':
      return 'bg-sand-200 text-ocean-800'
    case 'approved':
      return 'bg-leaf-100 text-leaf-700'
    case 'published':
      return 'bg-leaf-600 text-white'
    case 'rejected':
      return 'bg-red-100 text-red-700'
  }
}

// ---- Operator CRUD --------------------------------------------------------

export async function fetchMyOperator(): Promise<TransportOperatorWithMode | null> {
  const { data, error } = await supabase
    .from('transport_operators')
    .select(
      `*,
      transport_mode:transport_modes!transport_operators_transport_mode_id_fkey(id, name, code, icon)`,
    )
    .maybeSingle()

  if (error) {
    console.error('fetchMyOperator error:', error.message)
    return null
  }
  return (data as unknown as TransportOperatorWithMode) ?? null
}

export async function fetchAllOperators(): Promise<TransportOperatorWithMode[]> {
  const { data, error } = await supabase
    .from('transport_operators')
    .select(
      `*,
      transport_mode:transport_modes!transport_operators_transport_mode_id_fkey(id, name, code, icon)`,
    )
    .order('created_at', { ascending: false })

  if (error) {
    console.error('fetchAllOperators error:', error.message)
    return []
  }
  return (data ?? []) as unknown as TransportOperatorWithMode[]
}

export interface CreateOperatorInput {
  organization_name: string
  contact_name: string
  contact_email: string
  contact_phone?: string
  municipality?: string
  transport_mode_id?: string
  service_category: string
  supporting_info?: string
}

export async function createOperatorApplication(
  input: CreateOperatorInput,
): Promise<{ success: boolean; error?: string; id?: string }> {
  if (!input.organization_name.trim() || input.organization_name.length > 200) {
    return { success: false, error: 'Organization name is required (2-200 characters).' }
  }
  if (!input.contact_name.trim() || input.contact_name.length > 200) {
    return { success: false, error: 'Contact name is required (2-200 characters).' }
  }
  if (!input.contact_email.trim()) {
    return { success: false, error: 'Contact email is required.' }
  }
  if (!input.service_category.trim() || input.service_category.length > 100) {
    return { success: false, error: 'Service category is required.' }
  }

  const row: Record<string, unknown> = {
    organization_name: input.organization_name.trim(),
    contact_name: input.contact_name.trim(),
    contact_email: input.contact_email.trim(),
    contact_phone: input.contact_phone?.trim() || null,
    municipality: input.municipality || null,
    transport_mode_id: input.transport_mode_id || null,
    service_category: input.service_category.trim(),
    supporting_info: input.supporting_info?.trim() || null,
    verification_status: 'pending_review',
  }

  const { data, error } = await supabase
    .from('transport_operators')
    .insert(row)
    .select('id')
    .single()

  if (error) {
    console.error('createOperatorApplication error:', error.message)
    return { success: false, error: error.message }
  }

  const operatorId = (data as { id: string }).id

  await supabase.from('transport_operator_audit_logs').insert({
    operator_id: operatorId,
    action: 'application_submitted',
    new_status: 'pending_review',
    summary: `Application submitted by ${input.contact_name} for ${input.organization_name}`,
  })

  return { success: true, id: operatorId }
}

export async function updateMyOperator(
  id: string,
  updates: Partial<Pick<
    TransportOperatorRow,
    'organization_name' | 'contact_name' | 'contact_email' | 'contact_phone' | 'municipality' | 'transport_mode_id' | 'service_category' | 'supporting_info'
  >>,
): Promise<{ success: boolean; error?: string }> {
  const clean: Record<string, unknown> = {}
  if (updates.organization_name !== undefined) clean.organization_name = updates.organization_name.trim()
  if (updates.contact_name !== undefined) clean.contact_name = updates.contact_name.trim()
  if (updates.contact_email !== undefined) clean.contact_email = updates.contact_email.trim()
  if (updates.contact_phone !== undefined) clean.contact_phone = updates.contact_phone?.trim() || null
  if (updates.municipality !== undefined) clean.municipality = updates.municipality || null
  if (updates.transport_mode_id !== undefined) clean.transport_mode_id = updates.transport_mode_id || null
  if (updates.service_category !== undefined) clean.service_category = updates.service_category.trim()
  if (updates.supporting_info !== undefined) clean.supporting_info = updates.supporting_info?.trim() || null

  const { error } = await supabase.from('transport_operators').update(clean).eq('id', id)
  if (error) {
    console.error('updateMyOperator error:', error.message)
    return { success: false, error: error.message }
  }
  return { success: true }
}

// ---- Admin: update operator verification status ---------------------------

export async function adminUpdateOperatorStatus(
  id: string,
  status: TransportOperatorVerificationStatus,
  reviewerNotes?: string,
): Promise<{ success: boolean; error?: string }> {
  const isAdmin = await isAlertAdmin()
  if (!isAdmin) return { success: false, error: 'Not authorized.' }

  const { data: existing } = await supabase
    .from('transport_operators')
    .select('verification_status, organization_name')
    .eq('id', id)
    .maybeSingle()
  if (!existing) return { success: false, error: 'Operator not found.' }

  const updates: Record<string, unknown> = {
    verification_status: status,
    verified_by: (await supabase.auth.getUser()).data.user?.id ?? null,
    verified_at: new Date().toISOString(),
  }
  if (reviewerNotes !== undefined) updates.reviewer_notes = reviewerNotes.trim() || null

  const { error } = await supabase.from('transport_operators').update(updates).eq('id', id)
  if (error) {
    console.error('adminUpdateOperatorStatus error:', error.message)
    return { success: false, error: error.message }
  }

  const actionMap: Record<TransportOperatorVerificationStatus, string> = {
    approved: 'operator_verified',
    rejected: 'operator_rejected',
    suspended: 'operator_suspended',
    needs_more_information: 'info_requested',
    pending_review: 'info_requested',
    not_submitted: 'info_requested',
  }

  await supabase.from('transport_operator_audit_logs').insert({
    operator_id: id,
    action: actionMap[status] as TransportOperatorAuditLogRow['action'],
    previous_status: (existing as { verification_status: string }).verification_status,
    new_status: status,
    summary: reviewerNotes?.trim() || `Operator status changed to ${status}`,
  })

  return { success: true }
}

// ---- Submissions ----------------------------------------------------------

const SUBMISSION_SELECT = `
  *,
  operator:transport_operators!transport_service_submissions_operator_id_fkey(id, organization_name, verification_status),
  related_route:routes!transport_service_submissions_related_route_id_fkey(id, route_name, route_code),
  transport_mode:transport_modes!transport_service_submissions_transport_mode_id_fkey(id, name, code, icon),
  origin_location:locations!transport_service_submissions_origin_location_id_fkey(id, name, municipality),
  destination_location:locations!transport_service_submissions_destination_location_id_fkey(id, name, municipality),
  reviewer:users!transport_service_submissions_reviewed_by_fkey(id, name, email)
`

export async function fetchMySubmissions(): Promise<TransportServiceSubmissionWithDetails[]> {
  const { data, error } = await supabase
    .from('transport_service_submissions')
    .select(SUBMISSION_SELECT)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('fetchMySubmissions error:', error.message)
    return []
  }
  return (data ?? []) as unknown as TransportServiceSubmissionWithDetails[]
}

export async function fetchAllSubmissions(): Promise<TransportServiceSubmissionWithDetails[]> {
  const { data, error } = await supabase
    .from('transport_service_submissions')
    .select(SUBMISSION_SELECT)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('fetchAllSubmissions error:', error.message)
    return []
  }
  return (data ?? []) as unknown as TransportServiceSubmissionWithDetails[]
}

export async function fetchSubmissionById(
  id: string,
): Promise<TransportServiceSubmissionWithDetails | null> {
  const { data, error } = await supabase
    .from('transport_service_submissions')
    .select(SUBMISSION_SELECT)
    .eq('id', id)
    .maybeSingle()

  if (error) {
    console.error('fetchSubmissionById error:', error.message)
    return null
  }
  return (data as unknown as TransportServiceSubmissionWithDetails) ?? null
}

export interface CreateSubmissionInput {
  operator_id: string
  submission_type: TransportSubmissionType
  related_route_id?: string
  transport_mode_id?: string
  origin_location_id?: string
  destination_location_id?: string
  proposed_data: Record<string, unknown>
  proposed_effective_date?: string
  supporting_notes?: string
}

export async function createSubmission(
  input: CreateSubmissionInput,
): Promise<{ success: boolean; error?: string; id?: string }> {
  if (input.supporting_notes && input.supporting_notes.length > 4000) {
    return { success: false, error: 'Supporting notes must be 4000 characters or fewer.' }
  }
  if (!input.proposed_data || Object.keys(input.proposed_data).length === 0) {
    return { success: false, error: 'Proposed data is required.' }
  }

  const row: Record<string, unknown> = {
    operator_id: input.operator_id,
    submission_type: input.submission_type,
    related_route_id: input.related_route_id || null,
    transport_mode_id: input.transport_mode_id || null,
    origin_location_id: input.origin_location_id || null,
    destination_location_id: input.destination_location_id || null,
    proposed_data: input.proposed_data,
    proposed_effective_date: input.proposed_effective_date || null,
    supporting_notes: input.supporting_notes?.trim() || null,
    status: 'pending_review',
  }

  const { data, error } = await supabase
    .from('transport_service_submissions')
    .insert(row)
    .select('id')
    .single()

  if (error) {
    console.error('createSubmission error:', error.message)
    return { success: false, error: error.message }
  }

  const submissionId = (data as { id: string }).id
  const auditAction = input.submission_type === 'fare_change' ? 'fare_proposed' : 'service_submitted'

  await supabase.from('transport_operator_audit_logs').insert({
    operator_id: input.operator_id,
    submission_id: submissionId,
    action: auditAction,
    new_status: 'pending_review',
    summary: `Submission: ${SUBMISSION_TYPE_LABELS[input.submission_type]}`,
  })

  return { success: true, id: submissionId }
}

export async function updateSubmission(
  id: string,
  updates: Partial<Pick<TransportServiceSubmissionRow, 'proposed_data' | 'supporting_notes' | 'proposed_effective_date'>>,
): Promise<{ success: boolean; error?: string }> {
  const clean: Record<string, unknown> = {}
  if (updates.proposed_data !== undefined) clean.proposed_data = updates.proposed_data
  if (updates.supporting_notes !== undefined) clean.supporting_notes = updates.supporting_notes?.trim() || null
  if (updates.proposed_effective_date !== undefined) clean.proposed_effective_date = updates.proposed_effective_date || null

  const { error } = await supabase.from('transport_service_submissions').update(clean).eq('id', id)
  if (error) {
    console.error('updateSubmission error:', error.message)
    return { success: false, error: error.message }
  }
  return { success: true }
}

export async function deleteSubmission(id: string): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.from('transport_service_submissions').delete().eq('id', id)
  if (error) {
    console.error('deleteSubmission error:', error.message)
    return { success: false, error: error.message }
  }
  return { success: true }
}

// ---- Admin: review submission ---------------------------------------------

export async function adminReviewSubmission(
  id: string,
  status: TransportSubmissionStatus,
  feedback: string,
): Promise<{ success: boolean; error?: string }> {
  const isAdmin = await isAlertAdmin()
  if (!isAdmin) return { success: false, error: 'Not authorized.' }

  const { data: existing } = await supabase
    .from('transport_service_submissions')
    .select('status, operator_id')
    .eq('id', id)
    .maybeSingle()
  if (!existing) return { success: false, error: 'Submission not found.' }

  const userId = (await supabase.auth.getUser()).data.user?.id ?? null

  const { error } = await supabase
    .from('transport_service_submissions')
    .update({
      status,
      reviewer_feedback: feedback.trim() || null,
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) {
    console.error('adminReviewSubmission error:', error.message)
    return { success: false, error: error.message }
  }

  const actionMap: Record<TransportSubmissionStatus, string> = {
    approved: 'submission_approved',
    rejected: 'submission_rejected',
    published: 'submission_published',
    needs_more_information: 'info_requested',
    under_review: 'info_requested',
    pending_review: 'info_requested',
  }

  await supabase.from('transport_operator_audit_logs').insert({
    operator_id: (existing as { operator_id: string }).operator_id,
    submission_id: id,
    action: actionMap[status] as TransportOperatorAuditLogRow['action'],
    previous_status: (existing as { status: string }).status,
    new_status: status,
    summary: feedback.trim() || `Submission ${status}`,
  })

  return { success: true }
}

// ---- Audit logs -----------------------------------------------------------

export async function fetchMyAuditLogs(
  operatorId: string,
): Promise<TransportOperatorAuditLogRow[]> {
  const { data, error } = await supabase
    .from('transport_operator_audit_logs')
    .select('*')
    .eq('operator_id', operatorId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('fetchMyAuditLogs error:', error.message)
    return []
  }
  return (data ?? []) as TransportOperatorAuditLogRow[]
}

export async function fetchAllAuditLogs(): Promise<TransportOperatorAuditLogRow[]> {
  const { data, error } = await supabase
    .from('transport_operator_audit_logs')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('fetchAllAuditLogs error:', error.message)
    return []
  }
  return (data ?? []) as TransportOperatorAuditLogRow[]
}

// ---- Transport modes for forms -------------------------------------------

export async function fetchTransportModesForForms(): Promise<
  Array<{ id: string; name: string; code: string }>
> {
  const { data, error } = await supabase
    .from('transport_modes')
    .select('id, name, code')
    .eq('is_active', true)
    .order('name')
  if (error) {
    console.error('fetchTransportModesForForms error:', error.message)
    return []
  }
  return (data ?? []) as Array<{ id: string; name: string; code: string }>
}

// ---- Routes for forms ----------------------------------------------------

export async function fetchRoutesForForms(): Promise<
  Array<{ id: string; route_name: string; route_code: string | null }>
> {
  const { data, error } = await supabase
    .from('routes')
    .select('id, route_name, route_code')
    .order('route_name')
    .limit(200)
  if (error) {
    console.error('fetchRoutesForForms error:', error.message)
    return []
  }
  return (data ?? []) as Array<{ id: string; route_name: string; route_code: string | null }>
}

// ---- Locations for forms --------------------------------------------------

export async function fetchLocationsForForms(): Promise<
  Array<{ id: string; name: string; municipality: string | null }>
> {
  const { data, error } = await supabase
    .from('locations')
    .select('id, name, municipality')
    .eq('is_searchable', true)
    .order('name')
    .limit(200)
  if (error) {
    console.error('fetchLocationsForForms error:', error.message)
    return []
  }
  return (data ?? []) as Array<{ id: string; name: string; municipality: string | null }>
}
