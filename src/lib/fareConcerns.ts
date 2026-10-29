import { supabase } from './supabase'
import {
  MUNICIPALITIES,
  fetchTransportModes,
  searchLocations,
  searchRoutes,
  validateImageFile,
  isCommunityReviewer,
} from './communityReports'
import type {
  FareConcernCategory,
  FareConcernStatus,
  FareConcernWithDetails,
  FareConcernAttachmentRow,
  FareConcernCommentWithAuthor,
  FareConcernStatusTimelineRow,
  FareConcernAuditLogRow,
  FareConcernPassengerCategory,
} from './types'

export { MUNICIPALITIES, fetchTransportModes, searchLocations, searchRoutes, validateImageFile, isCommunityReviewer }

export const CATEGORY_LABELS: Record<FareConcernCategory, string> = {
  suspected_overcharging: 'Suspected Overcharging',
  fare_differs_from_matrix: 'Fare Different from Published Fare Matrix',
  student_discount_concern: 'Student Discount Concern',
  senior_discount_concern: 'Senior Citizen Discount Concern',
  pwd_discount_concern: 'PWD Discount Concern',
  fare_calculation_concern: 'Fare Calculation Concern',
  inconsistent_fare_collection: 'Inconsistent Fare Collection',
  unclear_or_unposted_fare: 'Unclear or Unposted Fare Information',
  additional_fare_or_surcharge: 'Additional Fare or Surcharge Concern',
  other_fare_concern: 'Other Fare-Related Concern',
}

export const CATEGORY_ORDER: FareConcernCategory[] = [
  'suspected_overcharging',
  'fare_differs_from_matrix',
  'student_discount_concern',
  'senior_discount_concern',
  'pwd_discount_concern',
  'fare_calculation_concern',
  'inconsistent_fare_collection',
  'unclear_or_unposted_fare',
  'additional_fare_or_surcharge',
  'other_fare_concern',
]

export const STATUS_LABELS: Record<FareConcernStatus, string> = {
  submitted: 'Submitted',
  under_review: 'Under Review',
  needs_more_info: 'Needs More Information',
  resolved: 'Resolved',
  rejected: 'Rejected',
  closed: 'Closed',
}

export const STATUS_ORDER: FareConcernStatus[] = [
  'submitted',
  'under_review',
  'needs_more_info',
  'resolved',
  'rejected',
  'closed',
]

export const PASSENGER_CATEGORY_LABELS: Record<FareConcernPassengerCategory, string> = {
  regular: 'Regular',
  student: 'Student',
  senior: 'Senior Citizen',
  pwd: 'PWD',
}

export function statusClasses(status: FareConcernStatus): string {
  switch (status) {
    case 'submitted': return 'bg-ocean-100 text-ocean-800'
    case 'under_review': return 'bg-terra-100 text-terra-700'
    case 'needs_more_info': return 'bg-sand-200 text-terra-800'
    case 'resolved': return 'bg-leaf-100 text-leaf-700'
    case 'rejected': return 'bg-red-100 text-red-700'
    case 'closed': return 'bg-ocean-200 text-ocean-700'
  }
}

export function categoryLabel(cat: FareConcernCategory): string {
  return CATEGORY_LABELS[cat] ?? cat
}

export function statusLabel(s: FareConcernStatus): string {
  return STATUS_LABELS[s] ?? s
}

export const TIMELINE_ACTION_LABELS: Record<string, string> = {
  submitted: 'Report Submitted',
  marked_under_review: 'Marked Under Review',
  requested_info: 'More Information Requested',
  resolved: 'Report Resolved',
  rejected: 'Report Rejected',
  closed: 'Report Closed',
  forwarded_to_verification: 'Forwarded to Data Verification',
  reporter_followed_up: 'Reporter Provided Follow-up',
}

// ---- Fetch my fare reports ------------------------------------------------

export async function fetchMyFareConcerns(): Promise<FareConcernWithDetails[]> {
  const { data, error } = await supabase
    .from('fare_concern_reports')
    .select(
      '*, route:routes(id, route_name, route_code), transport_mode:transport_modes(id, name, code, icon), boarding_location:locations!fare_concern_reports_boarding_location_id_fkey(id, name, municipality), destination_location:locations!fare_concern_reports_destination_location_id_fkey(id, name, municipality), reporter:users!fare_concern_reports_reporter_id_fkey(id, name, email), reviewer:users!fare_concern_reports_reviewer_id_fkey(id, name, email)',
    )
    .order('created_at', { ascending: false })

  if (error) {
    console.error('fetchMyFareConcerns error:', error.message)
    return []
  }
  return (data ?? []) as FareConcernWithDetails[]
}

// ---- Fetch all fare concerns (reviewer) -----------------------------------

export async function fetchAllFareConcerns(): Promise<FareConcernWithDetails[]> {
  const { data, error } = await supabase
    .from('fare_concern_reports')
    .select(
      '*, route:routes(id, route_name, route_code), transport_mode:transport_modes(id, name, code, icon), boarding_location:locations!fare_concern_reports_boarding_location_id_fkey(id, name, municipality), destination_location:locations!fare_concern_reports_destination_location_id_fkey(id, name, municipality), reporter:users!fare_concern_reports_reporter_id_fkey(id, name, email), reviewer:users!fare_concern_reports_reviewer_id_fkey(id, name, email)',
    )
    .order('created_at', { ascending: false })

  if (error) {
    console.error('fetchAllFareConcerns error:', error.message)
    return []
  }
  return (data ?? []) as FareConcernWithDetails[]
}

// ---- Fetch single fare concern --------------------------------------------

export async function fetchFareConcern(id: string): Promise<FareConcernWithDetails | null> {
  const { data, error } = await supabase
    .from('fare_concern_reports')
    .select(
      '*, route:routes(id, route_name, route_code), transport_mode:transport_modes(id, name, code, icon), boarding_location:locations!fare_concern_reports_boarding_location_id_fkey(id, name, municipality), destination_location:locations!fare_concern_reports_destination_location_id_fkey(id, name, municipality), reporter:users!fare_concern_reports_reporter_id_fkey(id, name, email), reviewer:users!fare_concern_reports_reviewer_id_fkey(id, name, email)',
    )
    .eq('id', id)
    .maybeSingle()

  if (error) {
    console.error('fetchFareConcern error:', error.message)
    return null
  }
  return data as FareConcernWithDetails | null
}

// ---- Create fare concern ---------------------------------------------------

export interface NewFareConcernInput {
  category: FareConcernCategory
  title: string
  description: string
  municipality: string
  route_id?: string | null
  transport_mode_id?: string | null
  boarding_location_id?: string | null
  destination_location_id?: string | null
  incident_at?: string | null
  amount_charged?: number | null
  expected_fare_amount?: number | null
  passenger_category?: FareConcernPassengerCategory | null
  fare_record_id?: string | null
}

export async function createFareConcern(
  input: NewFareConcernInput,
): Promise<{ success: boolean; id?: string; reportReference?: string; error?: string }> {
  const { data, error } = await supabase
    .from('fare_concern_reports')
    .insert({
      category: input.category,
      title: input.title.trim(),
      description: input.description.trim(),
      municipality: input.municipality,
      route_id: input.route_id ?? null,
      transport_mode_id: input.transport_mode_id ?? null,
      boarding_location_id: input.boarding_location_id ?? null,
      destination_location_id: input.destination_location_id ?? null,
      incident_at: input.incident_at ?? null,
      amount_charged: input.amount_charged ?? null,
      expected_fare_amount: input.expected_fare_amount ?? null,
      passenger_category: input.passenger_category ?? null,
      fare_record_id: input.fare_record_id ?? null,
    })
    .select('id, report_reference')
    .maybeSingle()

  if (error) {
    console.error('createFareConcern error:', error.message)
    return { success: false, error: friendlyError(error.message) }
  }
  const row = data as { id: string; report_reference: string } | null
  return { success: true, id: row?.id, reportReference: row?.report_reference }
}

// ---- Delete own fare concern (only while submitted) -----------------------

export async function deleteFareConcern(id: string): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.from('fare_concern_reports').delete().eq('id', id)
  if (error) {
    console.error('deleteFareConcern error:', error.message)
    return { success: false, error: error.message }
  }
  return { success: true }
}

// ---- Photo attachments -----------------------------------------------------

export async function uploadFareConcernPhoto(
  reportId: string,
  file: File,
  onProgress?: (pct: number) => void,
): Promise<{ success: boolean; attachment?: FareConcernAttachmentRow; error?: string }> {
  const validationError = validateImageFile(file)
  if (validationError) return { success: false, error: validationError }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'You must be signed in to upload.' }

  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200)
  const path = `${user.id}/${reportId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

  onProgress?.(10)
  const { error: uploadError } = await supabase.storage
    .from('fare-concern-attachments')
    .upload(path, file, { contentType: file.type, upsert: false })

  if (uploadError) {
    console.error('uploadFareConcernPhoto error:', uploadError.message)
    return { success: false, error: friendlyError(uploadError.message) }
  }

  onProgress?.(80)
  const { data, error } = await supabase
    .from('fare_concern_attachments')
    .insert({
      report_id: reportId,
      storage_path: path,
      file_name: safeName,
      mime_type: file.type,
      file_size: file.size,
    })
    .select('*')
    .maybeSingle()

  if (error) {
    console.error('uploadFareConcernPhoto metadata error:', error.message)
    await supabase.storage.from('fare-concern-attachments').remove([path])
    return { success: false, error: friendlyError(error.message) }
  }

  onProgress?.(100)
  return { success: true, attachment: data as FareConcernAttachmentRow }
}

export async function fetchFareConcernAttachments(reportId: string): Promise<FareConcernAttachmentRow[]> {
  const { data, error } = await supabase
    .from('fare_concern_attachments')
    .select('*')
    .eq('report_id', reportId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('fetchFareConcernAttachments error:', error.message)
    return []
  }
  return (data ?? []) as FareConcernAttachmentRow[]
}

export async function getFareConcernAttachmentUrl(storagePath: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from('fare-concern-attachments')
    .createSignedUrl(storagePath, 3600)
  if (error) {
    console.error('getFareConcernAttachmentUrl error:', error.message)
    return null
  }
  return data?.signedUrl ?? null
}

export async function deleteFareConcernAttachment(id: string, storagePath: string): Promise<boolean> {
  const { error: dbError } = await supabase.from('fare_concern_attachments').delete().eq('id', id)
  if (dbError) {
    console.error('deleteFareConcernAttachment db error:', dbError.message)
    return false
  }
  await supabase.storage.from('fare-concern-attachments').remove([storagePath])
  return true
}

// ---- Comments / follow-up responses ---------------------------------------

export async function fetchFareConcernComments(reportId: string): Promise<FareConcernCommentWithAuthor[]> {
  const { data, error } = await supabase
    .from('fare_concern_comments')
    .select('*, author:users!fare_concern_comments_author_id_fkey(id, name)')
    .eq('report_id', reportId)
    .eq('is_visible_to_reporter', true)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('fetchFareConcernComments error:', error.message)
    return []
  }
  return (data ?? []) as FareConcernCommentWithAuthor[]
}

export async function fetchAllFareConcernComments(reportId: string): Promise<FareConcernCommentWithAuthor[]> {
  const { data, error } = await supabase
    .from('fare_concern_comments')
    .select('*, author:users!fare_concern_comments_author_id_fkey(id, name)')
    .eq('report_id', reportId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('fetchAllFareConcernComments error:', error.message)
    return []
  }
  return (data ?? []) as FareConcernCommentWithAuthor[]
}

export async function addFareConcernReporterComment(reportId: string, body: string): Promise<{ success: boolean; error?: string }> {
  if (!body.trim()) return { success: false, error: 'Message cannot be empty.' }
  const { error } = await supabase.from('fare_concern_comments').insert({
    report_id: reportId,
    author_role: 'reporter',
    body: body.trim(),
    is_visible_to_reporter: true,
  })
  if (error) {
    console.error('addFareConcernReporterComment error:', error.message)
    return { success: false, error: friendlyError(error.message) }
  }
  return { success: true }
}

export async function addFareConcernReviewerComment(reportId: string, body: string, visibleToReporter: boolean): Promise<{ success: boolean; error?: string }> {
  if (!body.trim()) return { success: false, error: 'Message cannot be empty.' }
  const { error } = await supabase.from('fare_concern_comments').insert({
    report_id: reportId,
    author_role: 'reviewer',
    body: body.trim(),
    is_visible_to_reporter: visibleToReporter,
  })
  if (error) {
    console.error('addFareConcernReviewerComment error:', error.message)
    return { success: false, error: friendlyError(error.message) }
  }
  return { success: true }
}

// ---- Status timeline (reporter-safe) --------------------------------------

export async function fetchFareConcernTimeline(reportId: string): Promise<FareConcernStatusTimelineRow[]> {
  const { data, error } = await supabase
    .from('fare_concern_status_timeline')
    .select('*')
    .eq('report_id', reportId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('fetchFareConcernTimeline error:', error.message)
    return []
  }
  return (data ?? []) as FareConcernStatusTimelineRow[]
}

// ---- Audit logs (reviewer only) -------------------------------------------

export async function fetchFareConcernAuditLogs(reportId: string): Promise<FareConcernAuditLogRow[]> {
  const { data, error } = await supabase
    .from('fare_concern_audit_logs')
    .select('*')
    .eq('report_id', reportId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('fetchFareConcernAuditLogs error:', error.message)
    return []
  }
  return (data ?? []) as FareConcernAuditLogRow[]
}

// ---- Reviewer actions ------------------------------------------------------

export async function markFareConcernUnderReview(id: string, reviewerNotes?: string): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('fare_concern_reports')
    .update({
      status: 'under_review',
      reviewer_id: (await supabase.auth.getUser()).data.user?.id ?? null,
      reviewed_at: new Date().toISOString(),
      reviewer_notes: reviewerNotes?.trim() || null,
    })
    .eq('id', id)

  if (error) {
    console.error('markFareConcernUnderReview error:', error.message)
    return { success: false, error: friendlyError(error.message) }
  }
  return { success: true }
}

export async function requestFareConcernMoreInfo(id: string, reviewerNotes: string): Promise<{ success: boolean; error?: string }> {
  if (!reviewerNotes.trim()) return { success: false, error: 'A message for the reporter is required.' }
  const userId = (await supabase.auth.getUser()).data.user?.id ?? null
  const { error: updateError } = await supabase
    .from('fare_concern_reports')
    .update({
      status: 'needs_more_info',
      reviewer_id: userId,
      reviewed_at: new Date().toISOString(),
      reviewer_notes: reviewerNotes.trim(),
    })
    .eq('id', id)

  if (updateError) {
    console.error('requestFareConcernMoreInfo error:', updateError.message)
    return { success: false, error: friendlyError(updateError.message) }
  }

  const { error: commentError } = await supabase.from('fare_concern_comments').insert({
    report_id: id,
    author_role: 'reviewer',
    body: reviewerNotes.trim(),
    is_visible_to_reporter: true,
  })

  if (commentError) {
    console.error('requestFareConcernMoreInfo comment error:', commentError.message)
  }

  return { success: true }
}

export async function resolveFareConcern(id: string, resolutionSummary: string, reviewerNotes?: string): Promise<{ success: boolean; error?: string }> {
  if (!resolutionSummary.trim()) return { success: false, error: 'A resolution summary is required.' }
  const userId = (await supabase.auth.getUser()).data.user?.id ?? null
  const { error } = await supabase
    .from('fare_concern_reports')
    .update({
      status: 'resolved',
      reviewer_id: userId,
      reviewed_at: new Date().toISOString(),
      resolved_at: new Date().toISOString(),
      resolution_summary: resolutionSummary.trim(),
      reviewer_notes: reviewerNotes?.trim() || null,
    })
    .eq('id', id)

  if (error) {
    console.error('resolveFareConcern error:', error.message)
    return { success: false, error: friendlyError(error.message) }
  }
  return { success: true }
}

export async function rejectFareConcern(id: string, rejectionReason: string, reviewerNotes?: string): Promise<{ success: boolean; error?: string }> {
  if (!rejectionReason.trim()) return { success: false, error: 'A rejection reason is required.' }
  const userId = (await supabase.auth.getUser()).data.user?.id ?? null
  const { error } = await supabase
    .from('fare_concern_reports')
    .update({
      status: 'rejected',
      reviewer_id: userId,
      reviewed_at: new Date().toISOString(),
      rejection_reason: rejectionReason.trim(),
      reviewer_notes: reviewerNotes?.trim() || null,
    })
    .eq('id', id)

  if (error) {
    console.error('rejectFareConcern error:', error.message)
    return { success: false, error: friendlyError(error.message) }
  }
  return { success: true }
}

export async function closeFareConcern(id: string, reviewerNotes?: string): Promise<{ success: boolean; error?: string }> {
  const userId = (await supabase.auth.getUser()).data.user?.id ?? null
  const { error } = await supabase
    .from('fare_concern_reports')
    .update({
      status: 'closed',
      reviewer_id: userId,
      reviewed_at: new Date().toISOString(),
      reviewer_notes: reviewerNotes?.trim() || null,
    })
    .eq('id', id)

  if (error) {
    console.error('closeFareConcern error:', error.message)
    return { success: false, error: friendlyError(error.message) }
  }
  return { success: true }
}

export async function forwardFareConcernToVerification(id: string): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('fare_concern_reports')
    .update({
      forwarded_to_verification: true,
      verification_forwarded_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) {
    console.error('forwardFareConcernToVerification error:', error.message)
    return { success: false, error: friendlyError(error.message) }
  }
  return { success: true }
}

// ---- Helpers ---------------------------------------------------------------

function friendlyError(msg: string): string {
  if (msg.includes('row-level security')) {
    return 'You do not have permission to perform this action.'
  }
  if (msg.includes('duplicate')) {
    return 'This may already exist. Please check and try again.'
  }
  return msg
}
