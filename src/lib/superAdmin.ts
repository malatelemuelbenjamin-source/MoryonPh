import { supabase } from './supabase'

export type AdminRole = 'super_admin' | 'admin' | 'moderator'

export interface RoleCheckResult {
  isSuperAdmin: boolean
  isAdmin: boolean
  isModerator: boolean
}

export async function checkRoles(): Promise<RoleCheckResult> {
  const [superRes, adminRes, modRes] = await Promise.all([
    supabase.rpc('is_super_admin'),
    supabase.rpc('is_admin'),
    supabase.rpc('is_moderator'),
  ])

  return {
    isSuperAdmin: superRes.data === true,
    isAdmin: adminRes.data === true,
    isModerator: modRes.data === true,
  }
}

export async function claimRootOwner(): Promise<string | null> {
  const { error } = await supabase.rpc('claim_root_owner')
  if (error) return error.message
  const { error: refreshError } = await supabase.auth.refreshSession()
  return refreshError?.message ?? null
}

// ---- Audit logging ---------------------------------------------------------

export async function logAction(
  action: string,
  entityType: string,
  entityId?: string | null,
  summary?: string | null,
  before?: Record<string, unknown> | null,
  after?: Record<string, unknown> | null,
): Promise<void> {
  const { error } = await supabase.rpc('log_admin_action', {
    p_action: action,
    p_entity_type: entityType,
    p_entity_id: entityId ?? null,
    p_summary: summary ?? null,
    p_before: before ?? null,
    p_after: after ?? null,
  })
  if (error) console.error('logAction error:', error.message)
}

// ---- Roles / administrator directory ---------------------------------------

export interface AdminRoleRow {
  user_id: string
  role: AdminRole
  granted: boolean
  granted_by: string | null
  granted_at: string
  user_name: string | null
  user_email: string | null
}

export async function fetchAdminRoles(): Promise<AdminRoleRow[]> {
  const { data, error } = await supabase
    .from('admin_roles')
    .select('user_id, role, granted, granted_by, granted_at, users!admin_roles_user_id_fkey(name, email)')
    .order('granted_at', { ascending: false })

  if (error) {
    console.error('fetchAdminRoles error:', error.message)
    return []
  }

  return (data ?? []).map((r: Record<string, unknown>) => {
    const u = r.users as { name: string | null; email: string | null } | null
    return {
      user_id: r.user_id as string,
      role: r.role as AdminRole,
      granted: r.granted as boolean,
      granted_by: r.granted_by as string | null,
      granted_at: r.granted_at as string,
      user_name: u?.name ?? null,
      user_email: u?.email ?? null,
    }
  })
}

export async function setUserRole(
  targetUserId: string,
  role: AdminRole,
  grant: boolean,
): Promise<{ success: boolean; error?: string }> {
  const { data, error } = await supabase.rpc('set_user_role', {
    p_target_user_id: targetUserId,
    p_role: role,
    p_grant: grant,
  })

  if (error) {
    console.error('setUserRole error:', error.message)
    return { success: false, error: error.message }
  }
  const result = data as { success?: boolean } | null
  if (!result?.success) return { success: false, error: 'Role change did not apply.' }
  return { success: true }
}

// ---- User directory ---------------------------------------------------------

export interface DirectoryUser {
  id: string
  name: string | null
  email: string | null
  username: string | null
  profile_photo: string | null
  home_municipality: string | null
  created_at: string
  registration_status: string | null
  roles: string[]
}

interface AdminRolesMap {
  [userId: string]: string[]
}

export async function fetchUserDirectory(
  query: string,
  statusFilter: string,
  page: number,
  pageSize = 25,
): Promise<{ rows: DirectoryUser[]; total: number }> {
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let builder = supabase
    .from('users')
    .select('id, name, email, username, profile_photo, home_municipality, created_at, user_registrations(status)', { count: 'exact' })

  if (query.trim()) {
    builder = builder.or(`name.ilike.%${query.trim()}%,email.ilike.%${query.trim()}%,username.ilike.%${query.trim()}%`)
  }
  if (statusFilter && statusFilter !== 'all') {
    builder = builder.eq('user_registrations.status', statusFilter)
  }

  const { data, error, count } = await builder
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) {
    console.error('fetchUserDirectory error:', error.message)
    return { rows: [], total: 0 }
  }

  const rolesMap = await fetchRolesMap()

  const rows = (data ?? []).map((r: Record<string, unknown>) => {
    const reg = r.user_registrations as { status: string } | null
    return {
      id: r.id as string,
      name: r.name as string | null,
      email: r.email as string | null,
      username: r.username as string | null,
      profile_photo: r.profile_photo as string | null,
      home_municipality: r.home_municipality as string | null,
      created_at: r.created_at as string,
      registration_status: reg?.status ?? null,
      roles: rolesMap[r.id as string] ?? [],
    }
  })

  return { rows, total: count ?? 0 }
}

async function fetchRolesMap(): Promise<AdminRolesMap> {
  const { data, error } = await supabase
    .from('admin_roles')
    .select('user_id, role, granted')

  const map: AdminRolesMap = {}
  if (error) return map
  for (const r of (data ?? []) as { user_id: string; role: string; granted: boolean }[]) {
    if (r.granted) {
      map[r.user_id] = [...(map[r.user_id] ?? []), r.role]
    }
  }
  return map
}

// ---- Registration review -----------------------------------------------------

export async function setRegistrationStatus(
  userId: string,
  status: 'approved' | 'rejected' | 'flagged',
  note: string | null,
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('user_registrations')
    .update({
      status,
      reviewed_by: (await supabase.auth.getUser()).data.user?.id,
      reviewed_at: new Date().toISOString(),
      decision_note: note,
    })
    .eq('user_id', userId)

  if (error) {
    console.error('setRegistrationStatus error:', error.message)
    return { success: false, error: error.message }
  }

  await logAction('registration_reviewed', 'user_registration', userId, `Registration ${status}`)
  return { success: true }
}

// ---- Media library -------------------------------------------------------------

export interface MediaAsset {
  id: string
  bucket: string
  storage_path: string
  media_type: 'photo' | 'video' | 'document'
  title: string
  alt_text: string | null
  description: string | null
  album: string | null
  mime_type: string | null
  size_bytes: number | null
  is_featured: boolean
  is_published: boolean
  uploaded_by: string | null
  created_at: string
}

export function publicMediaUrl(path: string): string {
  const { data } = supabase.storage.from('admin-media').getPublicUrl(path)
  return data.publicUrl
}

export async function fetchMedia(
  type?: 'photo' | 'video' | 'document',
  publishedOnly = false,
): Promise<MediaAsset[]> {
  let builder = supabase.from('media_assets').select('*').order('created_at', { ascending: false })
  if (type) builder = builder.eq('media_type', type)
  if (publishedOnly) builder = builder.eq('is_published', true)

  const { data, error } = await builder
  if (error) {
    console.error('fetchMedia error:', error.message)
    return []
  }
  return (data ?? []) as unknown as MediaAsset[]
}

const MAX_PHOTO_BYTES = 10 * 1024 * 1024
const MAX_VIDEO_BYTES = 100 * 1024 * 1024
const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm']

export async function uploadMedia(
  file: File,
  mediaType: 'photo' | 'video' | 'document',
  title: string,
  extras?: { altText?: string; album?: string },
): Promise<{ success: boolean; error?: string; asset?: MediaAsset }> {
  const isPhoto = mediaType === 'photo'
  const maxBytes = isPhoto ? MAX_PHOTO_BYTES : mediaType === 'video' ? MAX_VIDEO_BYTES : MAX_PHOTO_BYTES * 5

  if (file.size > maxBytes) {
    return { success: false, error: `File too large (max ${Math.round(maxBytes / 1024 / 1024)} MB).` }
  }

  if (isPhoto && !ALLOWED_PHOTO_TYPES.includes(file.type)) {
    return { success: false, error: 'Photos must be JPEG, PNG, or WebP.' }
  }
  if (mediaType === 'video' && !ALLOWED_VIDEO_TYPES.includes(file.type)) {
    return { success: false, error: 'Videos must be MP4 or WebM.' }
  }

  const user = (await supabase.auth.getUser()).data.user
  if (!user) return { success: false, error: 'Sign in required.' }

  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'bin'
  const path = `${user.id}/${Date.now()}-${crypto.randomUUID()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('admin-media')
    .upload(path, file, { contentType: file.type })

  if (uploadError) {
    console.error('uploadMedia storage error:', uploadError.message)
    return { success: false, error: uploadError.message }
  }

  const { data: asset, error: dbError } = await supabase
    .from('media_assets')
    .insert({
      bucket: 'admin-media',
      storage_path: path,
      media_type: mediaType,
      title,
      alt_text: extras?.altText ?? null,
      album: extras?.album ?? null,
      mime_type: file.type,
      size_bytes: file.size,
      uploaded_by: user.id,
      is_published: false,
    })
    .select('*')
    .maybeSingle()

  if (dbError || !asset) {
    console.error('uploadMedia db error:', dbError?.message)
    await supabase.storage.from('admin-media').remove([path])
    return { success: false, error: dbError?.message ?? 'Could not save media record.' }
  }

  await logAction('media_uploaded', 'media_asset', asset.id, `Uploaded ${mediaType}: ${title}`)
  return { success: true, asset: asset as unknown as MediaAsset }
}

export async function updateMedia(
  id: string,
  updates: Partial<Pick<MediaAsset, 'title' | 'alt_text' | 'description' | 'album' | 'is_featured' | 'is_published'>>,
  before?: MediaAsset | null,
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.from('media_assets').update(updates).eq('id', id)

  if (error) {
    console.error('updateMedia error:', error.message)
    return { success: false, error: error.message }
  }

  await logAction('media_updated', 'media_asset', id, `Updated ${updates.title ?? 'media'}`, before ? (before as unknown as Record<string, unknown>) : null, updates as Record<string, unknown>)
  return { success: true }
}

export async function deleteMedia(asset: MediaAsset): Promise<{ success: boolean; error?: string }> {
  const { error: storageError } = await supabase.storage.from(asset.bucket).remove([asset.storage_path])
  if (storageError) {
    console.error('deleteMedia storage error:', storageError.message)
    return { success: false, error: storageError.message }
  }

  const { error: dbError } = await supabase.from('media_assets').delete().eq('id', asset.id)
  if (dbError) {
    console.error('deleteMedia db error:', dbError.message)
    return { success: false, error: dbError.message }
  }

  await logAction('media_deleted', 'media_asset', asset.id, `Deleted: ${asset.title}`, asset as unknown as Record<string, unknown>, null)
  return { success: true }
}

// ---- CMS pages -----------------------------------------------------------------

export interface ContentPage {
  id: string
  slug: string
  title: string
  content: string | null
  excerpt: string | null
  status: 'draft' | 'published' | 'archived'
  publish_at: string | null
  hero_image_path: string | null
  created_at: string
  updated_at: string
}

export async function fetchPages(publishedOnly = false): Promise<ContentPage[]> {
  let builder = supabase.from('content_pages').select('*').order('updated_at', { ascending: false })
  if (publishedOnly) builder = builder.eq('status', 'published')

  const { data, error } = await builder
  if (error) {
    console.error('fetchPages error:', error.message)
    return []
  }
  return (data ?? []) as unknown as ContentPage[]
}

export async function fetchPageBySlug(slug: string): Promise<ContentPage | null> {
  const { data, error } = await supabase
    .from('content_pages')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle()

  if (error) {
    console.error('fetchPageBySlug error:', error.message)
    return null
  }
  return (data as unknown as ContentPage) ?? null
}

export async function savePage(
  page: Partial<ContentPage> & { slug: string; title: string },
): Promise<{ success: boolean; error?: string; page?: ContentPage }> {
  const user = (await supabase.auth.getUser()).data.user

  const payload = {
    ...page,
    created_by: user?.id,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('content_pages')
    .upsert(payload, { onConflict: 'slug' })
    .select('*')
    .maybeSingle()

  if (error || !data) {
    console.error('savePage error:', error?.message)
    return { success: false, error: error?.message ?? 'Could not save page.' }
  }

  await logAction('page_saved', 'content_page', (data as ContentPage).id, `Saved page: ${page.title}`)
  return { success: true, page: data as unknown as ContentPage }
}

export async function deletePage(id: string): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.from('content_pages').delete().eq('id', id)
  if (error) {
    console.error('deletePage error:', error.message)
    return { success: false, error: error.message }
  }
  await logAction('page_deleted', 'content_page', id, 'Page deleted')
  return { success: true }
}

// ---- Website settings ---------------------------------------------------------------

export async function fetchSettings(): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.from('site_settings').select('key, value')
  if (error) {
    console.error('fetchSettings error:', error.message)
    return {}
  }
  const merged: Record<string, unknown> = {}
  for (const row of (data ?? []) as { key: string; value: unknown }[]) {
    if (row.key === 'site' && typeof row.value === 'object' && row.value !== null) {
      Object.assign(merged, row.value)
    } else {
      merged[row.key] = row.value
    }
  }
  return merged
}

export async function saveSettings(
  values: Record<string, unknown>,
  existing?: Record<string, unknown> | null,
): Promise<{ success: boolean; error?: string }> {
  const user = (await supabase.auth.getUser()).data.user
  const merged = { ...(existing ?? {}), ...values }

  const { error } = await supabase
    .from('site_settings')
    .upsert({ key: 'site', value: merged, updated_by: user?.id, updated_at: new Date().toISOString() }, { onConflict: 'key' })

  if (error) {
    console.error('saveSettings error:', error.message)
    return { success: false, error: error.message }
  }

  await logAction('settings_updated', 'site_settings', null, 'Website settings updated', existing ?? null, merged)
  return { success: true }
}

// ---- Announcements / notifications -------------------------------------------------

export interface Announcement {
  id: string
  title: string
  body: string
  audience: 'all' | 'authenticated' | 'selected'
  selected_user_ids: string[] | null
  status: 'draft' | 'published' | 'archived'
  starts_at: string | null
  ends_at: string | null
  created_at: string
}

export async function fetchAnnouncements(publishedOnly = false): Promise<Announcement[]> {
  let builder = supabase.from('announcements').select('*').order('created_at', { ascending: false })
  if (publishedOnly) builder = builder.eq('status', 'published')

  const { data, error } = await builder
  if (error) {
    console.error('fetchAnnouncements error:', error.message)
    return []
  }
  return (data ?? []) as unknown as Announcement[]
}

export async function saveAnnouncement(
  a: Partial<Announcement> & { title: string; body: string },
): Promise<{ success: boolean; error?: string; announcement?: Announcement }> {
  const user = (await supabase.auth.getUser()).data.user
  const payload = { ...a, created_by: user?.id }

  const { data, error } = await supabase
    .from('announcements')
    .upsert(payload)
    .select('*')
    .maybeSingle()

  if (error || !data) {
    console.error('saveAnnouncement error:', error?.message)
    return { success: false, error: error?.message ?? 'Could not save announcement.' }
  }

  const saved = data as unknown as Announcement

  if (saved.status === 'published') {
    await fanOutAnnouncement(saved)
  }

  await logAction('announcement_saved', 'announcement', saved.id, `Announcement: ${saved.title}`)
  return { success: true, announcement: saved }
}

async function fanOutAnnouncement(a: Announcement): Promise<void> {
  let recipients: { id: string }[] = []

  if (a.audience === 'all') {
    const { data } = await supabase.from('users').select('id')
    recipients = (data ?? []) as { id: string }[]
  } else if (a.audience === 'selected') {
    recipients = (a.selected_user_ids ?? []).map((id) => ({ id }))
  }

  if (recipients.length === 0) return

  const rows = recipients.map((r) => ({
    user_id: r.id,
    announcement_id: a.id,
    title: a.title,
    body: a.body,
  }))

  const { error } = await supabase.from('user_notifications').insert(rows)
  if (error) console.error('fanOutAnnouncement error:', error.message)
}

export async function deleteAnnouncement(id: string): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.from('announcements').delete().eq('id', id)
  if (error) {
    console.error('deleteAnnouncement error:', error.message)
    return { success: false, error: error.message }
  }
  await logAction('announcement_deleted', 'announcement', id, 'Announcement deleted')
  return { success: true }
}

// ---- Moderation reports -------------------------------------------------------------

export interface ModerationReport {
  id: string
  reporter_id: string | null
  target_user_id: string | null
  target_media_id: string | null
  reason: string
  description: string
  status: 'open' | 'investigating' | 'resolved' | 'dismissed'
  internal_notes: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
}

export async function fetchModerationReports(): Promise<ModerationReport[]> {
  const { data, error } = await supabase
    .from('moderation_reports')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('fetchModerationReports error:', error.message)
    return []
  }
  return (data ?? []) as unknown as ModerationReport[]
}

export async function updateModerationReport(
  id: string,
  updates: Partial<Pick<ModerationReport, 'status' | 'internal_notes'>>,
): Promise<{ success: boolean; error?: string }> {
  const user = (await supabase.auth.getUser()).data.user
  const { error } = await supabase
    .from('moderation_reports')
    .update({
      ...updates,
      reviewed_by: user?.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) {
    console.error('updateModerationReport error:', error.message)
    return { success: false, error: error.message }
  }
  await logAction('moderation_report_updated', 'moderation_report', id, `Status: ${updates.status ?? 'note added'}`)
  return { success: true }
}

// ---- Analytics / monitoring -------------------------------------------------------------

export interface ControlCenterMetrics {
  totalUsers: number
  pendingRegistrations: number
  approvedRegistrations: number
  suspendedOrFlagged: number
  totalPhotos: number
  totalVideos: number
  publishedPages: number
  draftPages: number
  openReports: number
  publishedAnnouncements: number
  recentLogins: number
}

export async function fetchControlCenterMetrics(): Promise<ControlCenterMetrics> {
  const [
    usersRes,
    pendingRegRes,
    approvedRegRes,
    flaggedRes,
    photosRes,
    videosRes,
    publishedPagesRes,
    draftPagesRes,
    openReportsRes,
    announcementsRes,
    loginsRes,
  ] = await Promise.all([
    supabase.from('users').select('id', { count: 'exact', head: true }),
    supabase.from('user_registrations').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('user_registrations').select('id', { count: 'exact', head: true }).eq('status', 'approved'),
    supabase.from('user_registrations').select('id', { count: 'exact', head: true }).in('status', ['flagged', 'rejected']),
    supabase.from('media_assets').select('id', { count: 'exact', head: true }).eq('media_type', 'photo'),
    supabase.from('media_assets').select('id', { count: 'exact', head: true }).eq('media_type', 'video'),
    supabase.from('content_pages').select('id', { count: 'exact', head: true }).eq('status', 'published'),
    supabase.from('content_pages').select('id', { count: 'exact', head: true }).eq('status', 'draft'),
    supabase.from('moderation_reports').select('id', { count: 'exact', head: true }).in('status', ['open', 'investigating']),
    supabase.from('announcements').select('id', { count: 'exact', head: true }).eq('status', 'published'),
    supabase.from('login_audit').select('id', { count: 'exact', head: true }).gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
  ])

  const c = (r: { count: number | null }): number => r.count ?? 0

  return {
    totalUsers: c(usersRes),
    pendingRegistrations: c(pendingRegRes),
    approvedRegistrations: c(approvedRegRes),
    suspendedOrFlagged: c(flaggedRes),
    totalPhotos: c(photosRes),
    totalVideos: c(videosRes),
    publishedPages: c(publishedPagesRes),
    draftPages: c(draftPagesRes),
    openReports: c(openReportsRes),
    publishedAnnouncements: c(announcementsRes),
    recentLogins: c(loginsRes),
  }
}

export interface LoginAuditRow {
  id: string
  user_id: string | null
  email: string | null
  success: boolean
  failure_reason: string | null
  created_at: string
}

export async function fetchLoginAudit(limit = 50): Promise<LoginAuditRow[]> {
  const { data, error } = await supabase
    .from('login_audit')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('fetchLoginAudit error:', error.message)
    return []
  }
  return (data ?? []) as unknown as LoginAuditRow[]
}

export async function recordLoginAttempt(
  userId: string | null,
  email: string | null,
  success: boolean,
  failureReason?: string,
): Promise<void> {
  if (!userId) return
  const { error } = await supabase.from('login_audit').insert({
    user_id: userId,
    email,
    success,
    failure_reason: failureReason ?? null,
  })
  if (error) console.error('recordLoginAttempt error:', error.message)
}
