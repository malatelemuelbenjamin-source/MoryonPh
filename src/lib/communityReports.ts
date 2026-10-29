import { supabase } from './supabase'
import type {
  CommunityReportCategory,
  CommunityReportStatus,
  CommunityReportWithDetails,
  CommunityReportAttachmentRow,
  CommunityReportCommentWithAuthor,
  CommunityReportStatusTimelineRow,
  CommunityReportAuditLogRow,
  TransportModeRow,
  LocationRow,
  RouteRow,
} from './types'

// ---- Constants -----------------------------------------------------------

export const MUNICIPALITIES = ['Boac', 'Buenavista', 'Gasan', 'Mogpog', 'Santa Cruz', 'Torrijos'] as const

export const CATEGORY_LABELS: Record<CommunityReportCategory, string> = {
  missing_route: 'Missing Route',
  missing_stop_or_terminal: 'Missing Stop or Terminal',
  incorrect_location_info: 'Incorrect Location Information',
  transport_service_issue: 'Transport Service Issue',
  missing_or_incorrect_schedule: 'Missing or Incorrect Schedule',
  accessibility_concern: 'Accessibility Concern',
  passenger_info_concern: 'Passenger Information Concern',
  safety_concern: 'Safety Concern',
  other_transport_concern: 'Other Transport Concern',
}

export const CATEGORY_ORDER: CommunityReportCategory[] = [
  'missing_route',
  'missing_stop_or_terminal',
  'incorrect_location_info',
  'transport_service_issue',
  'missing_or_incorrect_schedule',
  'accessibility_concern',
  'passenger_info_concern',
  'safety_concern',
  'other_transport_concern',
]

export const STATUS_LABELS: Record<CommunityReportStatus, string> = {
  submitted: 'Submitted',
  under_review: 'Under Review',
  needs_more_info: 'Needs More Information',
  resolved: 'Resolved',
  rejected: 'Rejected',
}

export const STATUS_ORDER: CommunityReportStatus[] = [
  'submitted',
  'under_review',
  'needs_more_info',
  'resolved',
  'rejected',
]

export function statusClasses(status: CommunityReportStatus): string {
  switch (status) {
    case 'submitted':
      return 'bg-ocean-100 text-ocean-800'
    case 'under_review':
      return 'bg-terra-100 text-terra-700'
    case 'needs_more_info':
      return 'bg-sand-200 text-terra-800'
    case 'resolved':
      return 'bg-leaf-100 text-leaf-700'
    case 'rejected':
      return 'bg-red-100 text-red-700'
  }
}

export function categoryLabel(cat: CommunityReportCategory): string {
  return CATEGORY_LABELS[cat] ?? cat
}

export function statusLabel(s: CommunityReportStatus): string {
  return STATUS_LABELS[s] ?? s
}

export const TIMELINE_ACTION_LABELS: Record<string, string> = {
  submitted: 'Report Submitted',
  marked_under_review: 'Marked Under Review',
  requested_info: 'More Information Requested',
  resolved: 'Report Resolved',
  rejected: 'Report Rejected',
  forwarded_to_verification: 'Forwarded to Data Verification',
  reporter_followed_up: 'Reporter Provided Follow-up',
}

// ---- Fetch municipalities -----------------------------------------------

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

// ---- Fetch transport modes ----------------------------------------------

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

// ---- Search locations for report form -----------------------------------

export async function searchLocations(query: string): Promise<Pick<LocationRow, 'id' | 'name' | 'municipality' | 'type'>[]> {
  const term = query.trim().toLowerCase()
  if (!term) return []
  const { data, error } = await supabase
    .from('locations')
    .select('id, name, municipality, type')
    .eq('is_searchable', true)
    .in('verification_status', ['official', 'verified', 'community'])
    .or(`name.ilike.%${term}%,normalized_name.ilike.%${term}%`)
    .order('name', { ascending: true })
    .limit(15)

  if (error) {
    console.error('searchLocations error:', error.message)
    return []
  }
  return (data ?? []) as Pick<LocationRow, 'id' | 'name' | 'municipality' | 'type'>[]
}

// ---- Search routes for report form --------------------------------------

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

// ---- Fetch my reports ---------------------------------------------------

export async function fetchMyReports(): Promise<CommunityReportWithDetails[]> {
  const { data, error } = await supabase
    .from('community_transport_reports')
    .select(
      '*, location:locations(id, name, municipality), route:routes(id, route_name, route_code), transport_mode:transport_modes(id, name, code, icon)',
    )
    .order('created_at', { ascending: false })

  if (error) {
    console.error('fetchMyReports error:', error.message)
    return []
  }
  return (data ?? []) as CommunityReportWithDetails[]
}

// ---- Fetch public resolved reports (community feed) --------------------

export async function fetchPublicReports(limit = 20): Promise<CommunityReportWithDetails[]> {
  const { data, error } = await supabase
    .from('community_transport_reports')
    .select(
      '*, location:locations(id, name, municipality), route:routes(id, route_name, route_code), transport_mode:transport_modes(id, name, code, icon)',
    )
    .eq('status', 'resolved')
    .order('resolved_at', { ascending: false, nullsFirst: false })
    .limit(limit)

  if (error) {
    console.error('fetchPublicReports error:', error.message)
    return []
  }
  return (data ?? []) as CommunityReportWithDetails[]
}

// ---- Fetch all reports (reviewer) --------------------------------------

export async function fetchAllReports(): Promise<CommunityReportWithDetails[]> {
  const { data, error } = await supabase
    .from('community_transport_reports')
    .select(
      '*, location:locations(id, name, municipality), route:routes(id, route_name, route_code), transport_mode:transport_modes(id, name, code, icon), reporter:users!community_transport_reports_reporter_id_fkey(id, name, email), reviewer:users!community_transport_reports_reviewer_id_fkey(id, name, email)',
    )
    .order('created_at', { ascending: false })

  if (error) {
    console.error('fetchAllReports error:', error.message)
    return []
  }
  return (data ?? []) as CommunityReportWithDetails[]
}

// ---- Fetch single report -----------------------------------------------

export async function fetchReport(id: string): Promise<CommunityReportWithDetails | null> {
  const { data, error } = await supabase
    .from('community_transport_reports')
    .select(
      '*, location:locations(id, name, municipality), route:routes(id, route_name, route_code), transport_mode:transport_modes(id, name, code, icon), reporter:users!community_transport_reports_reporter_id_fkey(id, name, email), reviewer:users!community_transport_reports_reviewer_id_fkey(id, name, email)',
    )
    .eq('id', id)
    .maybeSingle()

  if (error) {
    console.error('fetchReport error:', error.message)
    return null
  }
  return data as CommunityReportWithDetails | null
}

// ---- Create report ------------------------------------------------------

export interface NewReportInput {
  category: CommunityReportCategory
  title: string
  description: string
  municipality: string
  location_id?: string | null
  route_id?: string | null
  transport_mode_id?: string | null
  latitude?: number | null
  longitude?: number | null
  observed_at?: string | null
  urgency?: string | null
  reporter_followup_preference?: string | null
}

export async function createReport(
  input: NewReportInput,
): Promise<{ success: boolean; id?: string; error?: string }> {
  const { data, error } = await supabase
    .from('community_transport_reports')
    .insert({
      category: input.category,
      title: input.title.trim(),
      description: input.description.trim(),
      municipality: input.municipality,
      location_id: input.location_id ?? null,
      route_id: input.route_id ?? null,
      transport_mode_id: input.transport_mode_id ?? null,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      observed_at: input.observed_at ?? null,
      urgency: input.urgency?.trim() || null,
      reporter_followup_preference: input.reporter_followup_preference?.trim() || null,
    })
    .select('id')
    .maybeSingle()

  if (error) {
    console.error('createReport error:', error.message)
    return { success: false, error: friendlyError(error.message) }
  }
  return { success: true, id: (data as { id: string } | null)?.id }
}

// ---- Delete own report (only while submitted) --------------------------

export async function deleteReport(id: string): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.from('community_transport_reports').delete().eq('id', id)
  if (error) {
    console.error('deleteReport error:', error.message)
    return { success: false, error: error.message }
  }
  return { success: true }
}

// ---- Photo attachments --------------------------------------------------

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp']
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

export function validateImageFile(file: File): string | null {
  if (!ALLOWED_MIME.includes(file.type)) {
    return 'Only JPEG, PNG, and WebP images are allowed.'
  }
  if (file.size > MAX_FILE_SIZE) {
    return 'Image must be 10 MB or smaller.'
  }
  return null
}

export async function uploadReportPhoto(
  reportId: string,
  file: File,
  onProgress?: (pct: number) => void,
): Promise<{ success: boolean; attachment?: CommunityReportAttachmentRow; error?: string }> {
  const validationError = validateImageFile(file)
  if (validationError) return { success: false, error: validationError }

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'You must be signed in to upload.' }

  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200)
  const path = `${user.id}/${reportId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

  // Upload with progress (supabase-js v2 doesn't support progress natively,
  // so we simulate a basic progress indicator)
  onProgress?.(10)

  const { error: uploadError } = await supabase.storage
    .from('community-report-attachments')
    .upload(path, file, { contentType: file.type, upsert: false })

  if (uploadError) {
    console.error('uploadReportPhoto error:', uploadError.message)
    return { success: false, error: friendlyError(uploadError.message) }
  }

  onProgress?.(80)

  const { data, error } = await supabase
    .from('community_report_attachments')
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
    console.error('uploadReportPhoto metadata error:', error.message)
    // Best-effort cleanup of orphaned storage object
    await supabase.storage.from('community-report-attachments').remove([path])
    return { success: false, error: friendlyError(error.message) }
  }

  onProgress?.(100)
  return { success: true, attachment: data as CommunityReportAttachmentRow }
}

export async function fetchAttachments(reportId: string): Promise<CommunityReportAttachmentRow[]> {
  const { data, error } = await supabase
    .from('community_report_attachments')
    .select('*')
    .eq('report_id', reportId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('fetchAttachments error:', error.message)
    return []
  }
  return (data ?? []) as CommunityReportAttachmentRow[]
}

export async function getAttachmentUrl(storagePath: string): Promise<string | null> {
  const { data } = await supabase.storage.from('community-report-attachments').createSignedUrl(storagePath, 3600)
  return data?.signedUrl ?? null
}

export async function getAttachmentUrlAsync(storagePath: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from('community-report-attachments')
    .createSignedUrl(storagePath, 3600)
  if (error) {
    console.error('getAttachmentUrlAsync error:', error.message)
    return null
  }
  return data?.signedUrl ?? null
}

export async function deleteAttachment(id: string, storagePath: string): Promise<boolean> {
  const { error: dbError } = await supabase.from('community_report_attachments').delete().eq('id', id)
  if (dbError) {
    console.error('deleteAttachment db error:', dbError.message)
    return false
  }
  await supabase.storage.from('community-report-attachments').remove([storagePath])
  return true
}

// ---- Comments / follow-up responses ------------------------------------

export async function fetchComments(reportId: string): Promise<CommunityReportCommentWithAuthor[]> {
  const { data, error } = await supabase
    .from('community_report_comments')
    .select('*, author:users!community_report_comments_author_id_fkey(id, name)')
    .eq('report_id', reportId)
    .eq('is_visible_to_reporter', true)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('fetchComments error:', error.message)
    return []
  }
  return (data ?? []) as CommunityReportCommentWithAuthor[]
}

export async function fetchAllComments(reportId: string): Promise<CommunityReportCommentWithAuthor[]> {
  const { data, error } = await supabase
    .from('community_report_comments')
    .select('*, author:users!community_report_comments_author_id_fkey(id, name)')
    .eq('report_id', reportId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('fetchAllComments error:', error.message)
    return []
  }
  return (data ?? []) as CommunityReportCommentWithAuthor[]
}

export async function addReporterComment(reportId: string, body: string): Promise<{ success: boolean; error?: string }> {
  if (!body.trim()) return { success: false, error: 'Message cannot be empty.' }
  const { error } = await supabase.from('community_report_comments').insert({
    report_id: reportId,
    author_role: 'reporter',
    body: body.trim(),
    is_visible_to_reporter: true,
  })
  if (error) {
    console.error('addReporterComment error:', error.message)
    return { success: false, error: friendlyError(error.message) }
  }
  return { success: true }
}

export async function addReviewerComment(reportId: string, body: string, visibleToReporter: boolean): Promise<{ success: boolean; error?: string }> {
  if (!body.trim()) return { success: false, error: 'Message cannot be empty.' }
  const { error } = await supabase.from('community_report_comments').insert({
    report_id: reportId,
    author_role: 'reviewer',
    body: body.trim(),
    is_visible_to_reporter: visibleToReporter,
  })
  if (error) {
    console.error('addReviewerComment error:', error.message)
    return { success: false, error: friendlyError(error.message) }
  }
  return { success: true }
}

// ---- Status timeline (reporter-safe) -----------------------------------

export async function fetchStatusTimeline(reportId: string): Promise<CommunityReportStatusTimelineRow[]> {
  const { data, error } = await supabase
    .from('community_report_status_timeline')
    .select('*')
    .eq('report_id', reportId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('fetchStatusTimeline error:', error.message)
    return []
  }
  return (data ?? []) as CommunityReportStatusTimelineRow[]
}

// ---- Audit logs (reviewer only) ----------------------------------------

export async function fetchAuditLogs(reportId: string): Promise<CommunityReportAuditLogRow[]> {
  const { data, error } = await supabase
    .from('community_report_audit_logs')
    .select('*')
    .eq('report_id', reportId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('fetchAuditLogs error:', error.message)
    return []
  }
  return (data ?? []) as CommunityReportAuditLogRow[]
}

// ---- Reviewer actions ---------------------------------------------------

export async function markUnderReview(id: string, reviewerNotes?: string): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('community_transport_reports')
    .update({
      status: 'under_review',
      reviewer_id: (await supabase.auth.getUser()).data.user?.id ?? null,
      reviewed_at: new Date().toISOString(),
      reviewer_notes: reviewerNotes?.trim() || null,
    })
    .eq('id', id)

  if (error) {
    console.error('markUnderReview error:', error.message)
    return { success: false, error: friendlyError(error.message) }
  }
  return { success: true }
}

export async function requestMoreInfo(id: string, reviewerNotes: string): Promise<{ success: boolean; error?: string }> {
  if (!reviewerNotes.trim()) return { success: false, error: 'A message for the reporter is required.' }
  const userId = (await supabase.auth.getUser()).data.user?.id ?? null
  const { error: updateError } = await supabase
    .from('community_transport_reports')
    .update({
      status: 'needs_more_info',
      reviewer_id: userId,
      reviewed_at: new Date().toISOString(),
      reviewer_notes: reviewerNotes.trim(),
    })
    .eq('id', id)

  if (updateError) {
    console.error('requestMoreInfo error:', updateError.message)
    return { success: false, error: friendlyError(updateError.message) }
  }

  // Also post a visible comment so the reporter sees the request
  const { error: commentError } = await supabase.from('community_report_comments').insert({
    report_id: id,
    author_role: 'reviewer',
    body: reviewerNotes.trim(),
    is_visible_to_reporter: true,
  })

  if (commentError) {
    console.error('requestMoreInfo comment error:', commentError.message)
  }

  return { success: true }
}

export async function resolveReport(id: string, resolutionSummary: string, reviewerNotes?: string): Promise<{ success: boolean; error?: string }> {
  if (!resolutionSummary.trim()) return { success: false, error: 'A resolution summary is required.' }
  const userId = (await supabase.auth.getUser()).data.user?.id ?? null
  const { error } = await supabase
    .from('community_transport_reports')
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
    console.error('resolveReport error:', error.message)
    return { success: false, error: friendlyError(error.message) }
  }
  return { success: true }
}

export async function rejectReport(id: string, rejectionReason: string, reviewerNotes?: string): Promise<{ success: boolean; error?: string }> {
  if (!rejectionReason.trim()) return { success: false, error: 'A rejection reason is required.' }
  const userId = (await supabase.auth.getUser()).data.user?.id ?? null
  const { error } = await supabase
    .from('community_transport_reports')
    .update({
      status: 'rejected',
      reviewer_id: userId,
      reviewed_at: new Date().toISOString(),
      rejection_reason: rejectionReason.trim(),
      reviewer_notes: reviewerNotes?.trim() || null,
    })
    .eq('id', id)

  if (error) {
    console.error('rejectReport error:', error.message)
    return { success: false, error: friendlyError(error.message) }
  }
  return { success: true }
}

export async function forwardToVerification(id: string): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('community_transport_reports')
    .update({
      forwarded_to_verification: true,
      verification_forwarded_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) {
    console.error('forwardToVerification error:', error.message)
    return { success: false, error: friendlyError(error.message) }
  }
  return { success: true }
}

// ---- Check if current user is a reviewer -------------------------------

export async function isCommunityReviewer(): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_community_reviewer')
  if (error) {
    console.error('isCommunityReviewer error:', error.message)
    return false
  }
  return data === true
}

// ---- Helpers ------------------------------------------------------------

function friendlyError(msg: string): string {
  if (msg.includes('row-level security')) {
    return 'You do not have permission to perform this action.'
  }
  if (msg.includes('duplicate')) {
    return 'This may already exist. Please check and try again.'
  }
  return msg
}
