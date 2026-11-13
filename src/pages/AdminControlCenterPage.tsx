import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Users, UserCheck, ShieldCheck, Image, Film, FileText,
  FilePlus2, Flag, Bell, BarChart3, Settings, Lock, ScrollText, Database,
  Activity, UserCircle, LogOut, Loader2, Upload, Trash2, Star, Eye, EyeOff,
  Search, CheckCircle, XCircle, AlertTriangle, Send, X,
} from 'lucide-react'
import { useAuth } from '../lib/auth'
import {
  checkRoles, type RoleCheckResult,
  fetchUserDirectory, setUserRole, setRegistrationStatus, type DirectoryUser,
  fetchMedia, uploadMedia, updateMedia, deleteMedia, publicMediaUrl, type MediaAsset,
  fetchPages, savePage, deletePage, type ContentPage,
  fetchSettings, saveSettings,
  fetchAnnouncements, saveAnnouncement, deleteAnnouncement, type Announcement,
  fetchModerationReports, updateModerationReport, type ModerationReport,
  fetchControlCenterMetrics, type ControlCenterMetrics,
  fetchAdminRoles, type AdminRoleRow,
  fetchLoginAudit, type LoginAuditRow,
} from '../lib/superAdmin'

type Section =
  | 'overview' | 'users' | 'registrations' | 'admins'
  | 'media' | 'photos' | 'videos' | 'pages' | 'moderation'
  | 'notifications' | 'analytics' | 'settings' | 'security' | 'audit' | 'profile'

const SECTIONS: { id: Section; label: string; icon: typeof Users; superOnly?: boolean }[] = [
  { id: 'overview', label: 'Dashboard Overview', icon: LayoutDashboard },
  { id: 'users', label: 'User Directory', icon: Users },
  { id: 'registrations', label: 'Pending Registrations', icon: UserCheck },
  { id: 'admins', label: 'Administrator Directory', icon: ShieldCheck, superOnly: true },
  { id: 'media', label: 'Media Library', icon: Image },
  { id: 'photos', label: 'Photo Management', icon: Image },
  { id: 'videos', label: 'Video Management', icon: Film },
  { id: 'pages', label: 'Pages & Publishing', icon: FileText },
  { id: 'moderation', label: 'Reports & Moderation', icon: Flag },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'analytics', label: 'Analytics & Reports', icon: BarChart3 },
  { id: 'settings', label: 'Website Configuration', icon: Settings, superOnly: true },
  { id: 'security', label: 'Security Center', icon: Lock, superOnly: true },
  { id: 'audit', label: 'Audit Logs', icon: ScrollText },
]

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    approved: 'bg-green-100 text-green-700',
    published: 'bg-green-100 text-green-700',
    resolved: 'bg-green-100 text-green-700',
    pending: 'bg-amber-100 text-amber-700',
    draft: 'bg-gray-100 text-gray-600',
    open: 'bg-red-100 text-red-700',
    investigating: 'bg-amber-100 text-amber-700',
    rejected: 'bg-red-100 text-red-700',
    flagged: 'bg-orange-100 text-orange-700',
    dismissed: 'bg-gray-100 text-gray-600',
  }
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${styles[status] ?? 'bg-sand-200 text-ocean-700'}`}>
      {status}
    </span>
  )
}

function ConfirmDialog({ title, message, onConfirm, onCancel }: {
  title: string
  message: string
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
        <h3 className="text-lg font-bold text-ocean-900">{title}</h3>
        <p className="mt-2 text-sm text-ocean-700">{message}</p>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onCancel} className="btn-secondary">Cancel</button>
          <button onClick={onConfirm} className="btn-primary bg-red-600">Confirm</button>
        </div>
      </div>
    </div>
  )
}

function MetricCard({ label, value, icon: Icon }: { label: string; value: number; icon: typeof Users }) {
  return (
    <div className="card flex items-center gap-3 p-4">
      <span className="grid h-10 w-10 place-items-center rounded-full bg-leaf-400/20 text-leaf-700">
        <Icon size={20} />
      </span>
      <div>
        <div className="text-2xl font-bold text-ocean-900">{value}</div>
        <div className="text-xs text-ocean-600">{label}</div>
      </div>
    </div>
  )
}

export function AdminControlCenterPage() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [roles, setRoles] = useState<RoleCheckResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [section, setSection] = useState<Section>('overview')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    void (async () => {
      const r = await checkRoles()
      setRoles(r)
      setLoading(false)
    })()
  }, [])

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="animate-spin text-ocean-600" size={32} />
      </div>
    )
  }

  if (!roles?.isAdmin) {
    return (
      <div className="grid min-h-screen place-items-center p-6 text-center">
        <div>
          <Lock className="mx-auto text-ocean-400" size={40} />
          <h1 className="mt-3 text-xl font-bold text-ocean-900">Restricted Area</h1>
          <p className="mt-1 text-sm text-ocean-600">
            This control center requires administrator access. Your account does not have permission.
          </p>
          <button onClick={() => navigate('/')} className="btn-secondary mt-4">Back to Home</button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-sand-50">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 transform overflow-y-auto bg-ocean-900 text-white transition-transform lg:static lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between p-4">
          <span className="text-lg font-bold">Control Center</span>
          <button className="lg:hidden" onClick={() => setSidebarOpen(false)}><X size={20} /></button>
        </div>
        <nav className="px-2 pb-6">
          {SECTIONS.filter((s) => !s.superOnly || roles.isSuperAdmin).map((s) => (
            <button
              key={s.id}
              onClick={() => { setSection(s.id); setSidebarOpen(false) }}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm ${
                section === s.id ? 'bg-white/15 font-semibold' : 'text-white/80 hover:bg-white/10'
              }`}
            >
              <s.icon size={18} />
              {s.label}
            </button>
          ))}
          <div className="my-3 border-t border-white/20" />
          <button
            onClick={() => setSection('profile')}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm ${
              section === 'profile' ? 'bg-white/15 font-semibold' : 'text-white/80 hover:bg-white/10'
            }`}
          >
            <UserCircle size={18} /> Admin Profile
          </button>
          <button
            onClick={() => void signOut()}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-white/80 hover:bg-white/10"
          >
            <LogOut size={18} /> Logout
          </button>
        </nav>
      </aside>

      {/* Main */}
      <main className="flex-1 p-4 lg:p-8">
        <div className="mb-6 flex items-center justify-between">
          <button className="lg:hidden btn-secondary" onClick={() => setSidebarOpen(true)}>Menu</button>
          <h1 className="text-2xl font-bold text-ocean-900">
            {SECTIONS.find((s) => s.id === section)?.label ?? 'Admin Profile'}
          </h1>
          <span className="hidden rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700 sm:inline">
            {roles.isSuperAdmin ? 'Super Admin' : roles.isAdmin ? 'Admin' : 'Moderator'}
          </span>
        </div>

        {section === 'overview' && <OverviewSection onNavigate={setSection} />}
        {section === 'users' && <UsersSection isSuperAdmin={roles.isSuperAdmin} />}
        {section === 'registrations' && <RegistrationsSection />}
        {section === 'admins' && <AdminsSection isSuperAdmin={roles.isSuperAdmin} currentUserId={user?.id} />}
        {section === 'media' && <MediaSection mediaType={undefined} />}
        {section === 'photos' && <MediaSection mediaType="photo" />}
        {section === 'videos' && <MediaSection mediaType="video" />}
        {section === 'pages' && <PagesSection />}
        {section === 'moderation' && <ModerationSection />}
        {section === 'notifications' && <NotificationsSection />}
        {section === 'analytics' && <AnalyticsSection />}
        {section === 'settings' && <SettingsSection />}
        {section === 'security' && <SecuritySection />}
        {section === 'audit' && <AuditSection />}
        {section === 'profile' && <ProfileSection />}
      </main>
    </div>
  )
}

// ---- Overview -----------------------------------------------------------------

function OverviewSection({ onNavigate }: { onNavigate: (s: Section) => void }) {
  const [metrics, setMetrics] = useState<ControlCenterMetrics | null>(null)

  useEffect(() => {
    void fetchControlCenterMetrics().then(setMetrics)
  }, [])

  if (!metrics) return <Loader2 className="animate-spin text-ocean-600" />

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <MetricCard label="Registered Users" value={metrics.totalUsers} icon={Users} />
      <MetricCard label="Pending Registrations" value={metrics.pendingRegistrations} icon={UserCheck} />
      <MetricCard label="Photos" value={metrics.totalPhotos} icon={Image} />
      <MetricCard label="Videos" value={metrics.totalVideos} icon={Film} />
      <MetricCard label="Published Pages" value={metrics.publishedPages} icon={FileText} />
      <MetricCard label="Open Reports" value={metrics.openReports} icon={Flag} />
      <MetricCard label="Published Announcements" value={metrics.publishedAnnouncements} icon={Bell} />
      <MetricCard label="Logins (24h)" value={metrics.recentLogins} icon={Activity} />
      <button onClick={() => onNavigate('registrations')} className="btn-secondary text-left">
        Review registrations ({metrics.pendingRegistrations} pending)
      </button>
      <button onClick={() => onNavigate('moderation')} className="btn-secondary text-left">
        Moderate reports ({metrics.openReports} open)
      </button>
    </div>
  )
}

// ---- Users ---------------------------------------------------------------------

function UsersSection({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<{ rows: DirectoryUser[]; total: number }>({ rows: [], total: 0 })
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const result = await fetchUserDirectory(query, statusFilter, page)
    setData(result)
    setLoading(false)
  }, [query, statusFilter, page])

  useEffect(() => { void load() }, [load])

  const totalPages = Math.max(1, Math.ceil(data.total / 25))

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute left-3 top-2.5 text-ocean-400" size={16} />
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(1) }}
            placeholder="Search name, email, username…"
            className="w-full rounded-lg border border-sand-300 py-2 pl-9 pr-3 text-sm"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
          className="rounded-lg border border-sand-300 px-3 py-2 text-sm"
        >
          <option value="all">All statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="flagged">Flagged</option>
        </select>
      </div>

      {loading ? <Loader2 className="animate-spin text-ocean-600" /> : data.rows.length === 0 ? (
        <p className="text-sm text-ocean-600">No users match your filters.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-sand-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-sand-100 text-xs uppercase text-ocean-600">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Roles</th>
                <th className="px-4 py-3">Registered</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((u) => (
                <tr key={u.id} className="border-t border-sand-200">
                  <td className="px-4 py-3 font-medium text-ocean-900">{u.name ?? '—'}</td>
                  <td className="px-4 py-3 text-ocean-700">{u.email ?? '—'}</td>
                  <td className="px-4 py-3">{u.registration_status ? <StatusPill status={u.registration_status} /> : '—'}</td>
                  <td className="px-4 py-3 text-xs text-ocean-600">{u.roles.length ? u.roles.join(', ') : 'user'}</td>
                  <td className="px-4 py-3 text-xs text-ocean-600">{new Date(u.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center justify-between border-t border-sand-200 px-4 py-2 text-xs text-ocean-600">
            <span>Page {page} of {totalPages} · {data.total} users</span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="btn-secondary px-2 py-1 disabled:opacity-40">Prev</button>
              <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="btn-secondary px-2 py-1 disabled:opacity-40">Next</button>
            </div>
          </div>
        </div>
      )}
      {!isSuperAdmin && (
        <p className="mt-3 text-xs text-ocean-500">Role changes are available to super admins only.</p>
      )}
    </div>
  )
}

// ---- Registrations ----------------------------------------------------------------

function RegistrationsSection() {
  const [rows, setRows] = useState<DirectoryUser[]>([])
  const [loading, setLoading] = useState(true)
  const [confirm, setConfirm] = useState<{ userId: string; status: 'approved' | 'rejected' | 'flagged' } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const result = await fetchUserDirectory('', 'pending', 1, 100)
    setRows(result.rows)
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  const apply = async () => {
    if (!confirm) return
    await setRegistrationStatus(confirm.userId, confirm.status, null)
    setConfirm(null)
    void load()
  }

  return (
    <div>
      {loading ? <Loader2 className="animate-spin text-ocean-600" /> : rows.length === 0 ? (
        <p className="text-sm text-ocean-600">No pending registrations.</p>
      ) : (
        <div className="space-y-3">
          {rows.map((u) => (
            <div key={u.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <div className="font-medium text-ocean-900">{u.name ?? 'Unnamed'}</div>
                <div className="text-sm text-ocean-600">{u.email}</div>
                <div className="text-xs text-ocean-500">Registered {new Date(u.created_at).toLocaleDateString()}</div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setConfirm({ userId: u.id, status: 'approved' })} className="btn-primary px-3 py-1.5 text-sm">
                  <CheckCircle size={16} /> Approve
                </button>
                <button onClick={() => setConfirm({ userId: u.id, status: 'flagged' })} className="btn-secondary px-3 py-1.5 text-sm">
                  <AlertTriangle size={16} /> Flag
                </button>
                <button onClick={() => setConfirm({ userId: u.id, status: 'rejected' })} className="btn-secondary px-3 py-1.5 text-sm text-red-600">
                  <XCircle size={16} /> Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {confirm && (
        <ConfirmDialog
          title="Confirm registration decision"
          message={`Set this registration to "${confirm.status}"?`}
          onConfirm={() => void apply()}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  )
}

// ---- Administrators ------------------------------------------------------------------

function AdminsSection({ isSuperAdmin, currentUserId }: { isSuperAdmin: boolean; currentUserId?: string }) {
  const [rows, setRows] = useState<AdminRoleRow[]>([])
  const [loading, setLoading] = useState(true)
  const [roleChange, setRoleChange] = useState<{ userId: string; role: 'admin' | 'moderator'; grant: boolean } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setRows(await fetchAdminRoles())
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  const applyRoleChange = async () => {
    if (!roleChange) return
    await setUserRole(roleChange.userId, roleChange.role, roleChange.grant)
    setRoleChange(null)
    void load()
  }

  if (!isSuperAdmin) {
    return <p className="text-sm text-ocean-600">Only super admins can manage administrator roles.</p>
  }

  return (
    <div>
      <p className="mb-4 text-sm text-ocean-600">
        Grant or revoke the admin and moderator roles. Super admin is granted directly in the database by the root owner only.
      </p>
      {loading ? <Loader2 className="animate-spin text-ocean-600" /> : rows.length === 0 ? (
        <p className="text-sm text-ocean-600">No role assignments recorded yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-sand-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-sand-100 text-xs uppercase text-ocean-600">
              <tr>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">State</th>
                <th className="px-4 py-3">Granted At</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.user_id}-${r.role}`} className="border-t border-sand-200">
                  <td className="px-4 py-3">
                    <div className="font-medium text-ocean-900">{r.user_name ?? '—'}</div>
                    <div className="text-xs text-ocean-500">{r.user_email}</div>
                  </td>
                  <td className="px-4 py-3">{r.role}</td>
                  <td className="px-4 py-3">{r.granted ? <StatusPill status="approved" /> : <StatusPill status="dismissed" />}</td>
                  <td className="px-4 py-3 text-xs text-ocean-600">{new Date(r.granted_at).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    {r.role !== 'super_admin' && (
                      <button
                        onClick={() => setRoleChange({ userId: r.user_id, role: r.role as 'admin' | 'moderator', grant: !r.granted })}
                        className="btn-secondary px-2 py-1 text-xs"
                      >
                        {r.granted ? 'Revoke' : 'Re-grant'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {roleChange && (
        <ConfirmDialog
          title="Confirm role change"
          message={`${roleChange.grant ? 'Grant' : 'Revoke'} the "${roleChange.role}" role?`}
          onConfirm={() => void applyRoleChange()}
          onCancel={() => setRoleChange(null)}
        />
      )}
      {currentUserId && <p className="mt-3 text-xs text-ocean-500">Signed in as {currentUserId}</p>}
    </div>
  )
}

// ---- Media ---------------------------------------------------------------------------

function MediaSection({ mediaType }: { mediaType?: 'photo' | 'video' | 'document' }) {
  const [assets, setAssets] = useState<MediaAsset[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<MediaAsset | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setAssets(await fetchMedia(mediaType))
    setLoading(false)
  }, [mediaType])

  useEffect(() => { void load() }, [load])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError(null)
    const result = await uploadMedia(file, mediaType ?? 'photo', file.name.replace(/\.[^.]+$/, ''))
    if (!result.success) setError(result.error ?? 'Upload failed.')
    setUploading(false)
    void load()
  }

  const togglePublish = async (a: MediaAsset) => {
    await updateMedia(a.id, { is_published: !a.is_published }, a)
    void load()
  }

  const toggleFeatured = async (a: MediaAsset) => {
    await updateMedia(a.id, { is_featured: !a.is_featured }, a)
    void load()
  }

  const applyDelete = async () => {
    if (!confirmDelete) return
    await deleteMedia(confirmDelete)
    setConfirmDelete(null)
    void load()
  }

  const accept = mediaType === 'video' ? 'video/mp4,video/webm' : 'image/jpeg,image/png,image/webp'

  return (
    <div>
      <label className="btn-primary mb-4 inline-flex cursor-pointer items-center gap-2">
        {uploading ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}
        {uploading ? 'Uploading…' : `Upload ${mediaType ?? 'media'}`}
        <input type="file" accept={accept} onChange={(e) => void handleUpload(e)} className="hidden" disabled={uploading} />
      </label>
      {error && <p className="mb-3 rounded bg-red-50 p-2 text-sm text-red-600">{error}</p>}

      {loading ? <Loader2 className="animate-spin text-ocean-600" /> : assets.length === 0 ? (
        <p className="text-sm text-ocean-600">No media uploaded yet.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {assets.map((a) => (
            <div key={a.id} className="card overflow-hidden">
              {a.media_type === 'photo' ? (
                <img src={publicMediaUrl(a.storage_path)} alt={a.alt_text ?? a.title} className="h-40 w-full object-cover" />
              ) : a.media_type === 'video' ? (
                <video src={publicMediaUrl(a.storage_path)} controls className="h-40 w-full bg-black object-contain" />
              ) : (
                <div className="grid h-40 place-items-center bg-sand-100 text-ocean-600">
                  <FileText size={32} />
                </div>
              )}
              <div className="p-3">
                <div className="truncate font-medium text-ocean-900">{a.title}</div>
                <div className="mt-1 flex items-center gap-2 text-xs text-ocean-500">
                  {a.is_published ? <StatusPill status="published" /> : <StatusPill status="draft" />}
                  {a.is_featured && <Star size={12} className="text-amber-500" fill="currentColor" />}
                  <span>{a.size_bytes ? `${Math.round(a.size_bytes / 1024)} KB` : ''}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button onClick={() => void togglePublish(a)} className="btn-secondary px-2 py-1 text-xs">
                    {a.is_published ? <><EyeOff size={12} /> Unpublish</> : <><Eye size={12} /> Publish</>}
                  </button>
                  <button onClick={() => void toggleFeatured(a)} className="btn-secondary px-2 py-1 text-xs">
                    <Star size={12} /> {a.is_featured ? 'Unfeature' : 'Feature'}
                  </button>
                  <button onClick={() => setConfirmDelete(a)} className="btn-secondary px-2 py-1 text-xs text-red-600">
                    <Trash2 size={12} /> Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="Delete media"
          message={`Permanently delete "${confirmDelete.title}"? This also removes the stored file.`}
          onConfirm={() => void applyDelete()}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  )
}

// ---- Pages (CMS) -------------------------------------------------------------------------

function PagesSection() {
  const [pages, setPages] = useState<ContentPage[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Partial<ContentPage> | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<ContentPage | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setPages(await fetchPages())
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  const handleSave = async () => {
    if (!editing?.slug || !editing?.title) {
      setError('Slug and title are required.')
      return
    }
    const result = await savePage({ slug: editing.slug, title: editing.title, content: editing.content ?? '', excerpt: editing.excerpt ?? null, status: editing.status ?? 'draft' })
    if (!result.success) {
      setError(result.error ?? 'Save failed.')
      return
    }
    setEditing(null)
    setError(null)
    void load()
  }

  return (
    <div>
      <button onClick={() => setEditing({ status: 'draft' })} className="btn-primary mb-4 inline-flex items-center gap-2">
        <FilePlus2 size={16} /> New Page
      </button>
      {error && <p className="mb-3 rounded bg-red-50 p-2 text-sm text-red-600">{error}</p>}

      {editing ? (
        <div className="card space-y-3 p-4">
          <input
            value={editing.slug ?? ''}
            onChange={(e) => setEditing({ ...editing, slug: e.target.value })}
            placeholder="page-slug"
            className="w-full rounded-lg border border-sand-300 px-3 py-2 text-sm"
            disabled={!!editing.id}
          />
          <input
            value={editing.title ?? ''}
            onChange={(e) => setEditing({ ...editing, title: e.target.value })}
            placeholder="Page Title"
            className="w-full rounded-lg border border-sand-300 px-3 py-2 text-sm"
          />
          <textarea
            value={editing.content ?? ''}
            onChange={(e) => setEditing({ ...editing, content: e.target.value })}
            rows={10}
            placeholder="Page content…"
            className="w-full rounded-lg border border-sand-300 px-3 py-2 text-sm"
          />
          <select
            value={editing.status ?? 'draft'}
            onChange={(e) => setEditing({ ...editing, status: e.target.value as ContentPage['status'] })}
            className="rounded-lg border border-sand-300 px-3 py-2 text-sm"
          >
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
          <div className="flex gap-2">
            <button onClick={() => void handleSave()} className="btn-primary">Save</button>
            <button onClick={() => setEditing(null)} className="btn-secondary">Cancel</button>
          </div>
        </div>
      ) : loading ? (
        <Loader2 className="animate-spin text-ocean-600" />
      ) : pages.length === 0 ? (
        <p className="text-sm text-ocean-600">No pages yet. Create your first page.</p>
      ) : (
        <div className="space-y-2">
          {pages.map((p) => (
            <div key={p.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <div className="font-medium text-ocean-900">{p.title}</div>
                <div className="text-xs text-ocean-500">/{p.slug}</div>
              </div>
              <div className="flex items-center gap-2">
                <StatusPill status={p.status} />
                <button onClick={() => setEditing(p)} className="btn-secondary px-2 py-1 text-xs">Edit</button>
                <button onClick={() => setConfirmDelete(p)} className="btn-secondary px-2 py-1 text-xs text-red-600">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="Delete page"
          message={`Permanently delete "${confirmDelete.title}"?`}
          onConfirm={async () => {
            await deletePage(confirmDelete.id)
            setConfirmDelete(null)
            void load()
          }}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  )
}

// ---- Moderation ------------------------------------------------------------------------------

function ModerationSection() {
  const [reports, setReports] = useState<ModerationReport[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setReports(await fetchModerationReports())
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  const setStatus = async (id: string, status: ModerationReport['status']) => {
    await updateModerationReport(id, { status })
    void load()
  }

  if (loading) return <Loader2 className="animate-spin text-ocean-600" />
  if (reports.length === 0) return <p className="text-sm text-ocean-600">No reports to review.</p>

  return (
    <div className="space-y-3">
      {reports.map((r) => (
        <div key={r.id} className="card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="rounded bg-sand-200 px-2 py-0.5 text-xs text-ocean-700">{r.reason.replace(/_/g, ' ')}</span>
              <span className="ml-2 text-xs text-ocean-500">{new Date(r.created_at).toLocaleString()}</span>
            </div>
            <StatusPill status={r.status} />
          </div>
          <p className="mt-2 text-sm text-ocean-800">{r.description}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={() => void setStatus(r.id, 'investigating')} className="btn-secondary px-2 py-1 text-xs">Investigating</button>
            <button onClick={() => void setStatus(r.id, 'resolved')} className="btn-secondary px-2 py-1 text-xs">Resolve</button>
            <button onClick={() => void setStatus(r.id, 'dismissed')} className="btn-secondary px-2 py-1 text-xs">Dismiss</button>
          </div>
        </div>
      ))}
    </div>
  )
}

// ---- Notifications ------------------------------------------------------------------------------

function NotificationsSection() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Partial<Announcement> | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setAnnouncements(await fetchAnnouncements())
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  const handleSave = async () => {
    if (!editing?.title || !editing?.body) {
      setError('Title and body are required.')
      return
    }
    const result = await saveAnnouncement({ title: editing.title, body: editing.body, audience: editing.audience ?? 'all', status: editing.status ?? 'draft' })
    if (!result.success) {
      setError(result.error ?? 'Save failed.')
      return
    }
    setEditing(null)
    setError(null)
    void load()
  }

  return (
    <div>
      <button onClick={() => setEditing({ audience: 'all', status: 'draft' })} className="btn-primary mb-4 inline-flex items-center gap-2">
        <Send size={16} /> New Announcement
      </button>
      {error && <p className="mb-3 rounded bg-red-50 p-2 text-sm text-red-600">{error}</p>}

      {editing ? (
        <div className="card space-y-3 p-4">
          <input
            value={editing.title ?? ''}
            onChange={(e) => setEditing({ ...editing, title: e.target.value })}
            placeholder="Announcement title"
            className="w-full rounded-lg border border-sand-300 px-3 py-2 text-sm"
          />
          <textarea
            value={editing.body ?? ''}
            onChange={(e) => setEditing({ ...editing, body: e.target.value })}
            rows={5}
            placeholder="Message body…"
            className="w-full rounded-lg border border-sand-300 px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <select
              value={editing.audience ?? 'all'}
              onChange={(e) => setEditing({ ...editing, audience: e.target.value as Announcement['audience'] })}
              className="rounded-lg border border-sand-300 px-3 py-2 text-sm"
            >
              <option value="all">All visitors</option>
              <option value="authenticated">Signed-in users</option>
            </select>
            <select
              value={editing.status ?? 'draft'}
              onChange={(e) => setEditing({ ...editing, status: e.target.value as Announcement['status'] })}
              className="rounded-lg border border-sand-300 px-3 py-2 text-sm"
            >
              <option value="draft">Draft</option>
              <option value="published">Publish now</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={() => void handleSave()} className="btn-primary">Save</button>
            <button onClick={() => setEditing(null)} className="btn-secondary">Cancel</button>
          </div>
        </div>
      ) : loading ? (
        <Loader2 className="animate-spin text-ocean-600" />
      ) : announcements.length === 0 ? (
        <p className="text-sm text-ocean-600">No announcements yet.</p>
      ) : (
        <div className="space-y-2">
          {announcements.map((a) => (
            <div key={a.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <div className="font-medium text-ocean-900">{a.title}</div>
                <div className="text-xs text-ocean-500">{a.audience} · {new Date(a.created_at).toLocaleDateString()}</div>
              </div>
              <div className="flex items-center gap-2">
                <StatusPill status={a.status} />
                <button
                  onClick={async () => { await deleteAnnouncement(a.id); void load() }}
                  className="btn-secondary px-2 py-1 text-xs text-red-600"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ---- Analytics --------------------------------------------------------------------------------

function AnalyticsSection() {
  const [metrics, setMetrics] = useState<ControlCenterMetrics | null>(null)
  const [logins, setLogins] = useState<LoginAuditRow[]>([])

  useEffect(() => {
    void fetchControlCenterMetrics().then(setMetrics)
    void fetchLoginAudit(30).then(setLogins)
  }, [])

  if (!metrics) return <Loader2 className="animate-spin text-ocean-600" />

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Total Users" value={metrics.totalUsers} icon={Users} />
        <MetricCard label="Approved" value={metrics.approvedRegistrations} icon={CheckCircle} />
        <MetricCard label="Flagged / Rejected" value={metrics.suspendedOrFlagged} icon={AlertTriangle} />
        <MetricCard label="Draft Pages" value={metrics.draftPages} icon={FileText} />
      </div>
      <h3 className="mt-6 mb-2 font-semibold text-ocean-900">Recent Login Activity</h3>
      {logins.length === 0 ? (
        <p className="text-sm text-ocean-600">No login records yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-sand-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-sand-100 text-xs uppercase text-ocean-600">
              <tr>
                <th className="px-4 py-2">Email</th>
                <th className="px-4 py-2">Result</th>
                <th className="px-4 py-2">When</th>
              </tr>
            </thead>
            <tbody>
              {logins.map((l) => (
                <tr key={l.id} className="border-t border-sand-200">
                  <td className="px-4 py-2">{l.email ?? '—'}</td>
                  <td className="px-4 py-2">
                    {l.success ? <StatusPill status="approved" /> : <span className="text-xs text-red-600">{l.failure_reason ?? 'failed'}</span>}
                  </td>
                  <td className="px-4 py-2 text-xs text-ocean-600">{new Date(l.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ---- Settings --------------------------------------------------------------------------------

function SettingsSection() {
  const [settings, setSettings] = useState<Record<string, unknown>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    void fetchSettings().then((s) => { setSettings(s); setLoading(false) })
  }, [])

  const update = (key: string, value: unknown) => setSettings({ ...settings, [key]: value })

  const handleSave = async () => {
    setSaving(true)
    await saveSettings(settings)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (loading) return <Loader2 className="animate-spin text-ocean-600" />

  return (
    <div className="card max-w-xl space-y-3 p-4">
      <div>
        <label className="text-xs font-medium text-ocean-700">Website Name</label>
        <input
          value={(settings.site_name as string) ?? ''}
          onChange={(e) => update('site_name', e.target.value)}
          className="mt-1 w-full rounded-lg border border-sand-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-ocean-700">Tagline</label>
        <input
          value={(settings.tagline as string) ?? ''}
          onChange={(e) => update('tagline', e.target.value)}
          className="mt-1 w-full rounded-lg border border-sand-300 px-3 py-2 text-sm"
        />
      </div>
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={(settings.maintenance_mode as boolean) ?? false}
          onChange={(e) => update('maintenance_mode', e.target.checked)}
          className="h-4 w-4"
        />
        <label className="text-sm text-ocean-800">Maintenance mode (show notice to visitors)</label>
      </div>
      <div>
        <label className="text-xs font-medium text-ocean-700">Registration Mode</label>
        <select
          value={(settings.registration_mode as string) ?? 'open'}
          onChange={(e) => update('registration_mode', e.target.value)}
          className="mt-1 w-full rounded-lg border border-sand-300 px-3 py-2 text-sm"
        >
          <option value="open">Open registration</option>
          <option value="email_verification">Email verification required</option>
          <option value="admin_approval">Admin approval required</option>
        </select>
      </div>
      <div className="flex items-center gap-3">
        <button onClick={() => void handleSave()} className="btn-primary" disabled={saving}>
          {saving ? 'Saving…' : 'Save Settings'}
        </button>
        {saved && <span className="text-sm text-green-600">Saved — live on the site.</span>}
      </div>
    </div>
  )
}

// ---- Security --------------------------------------------------------------------------------

function SecuritySection() {
  const [logins, setLogins] = useState<LoginAuditRow[]>([])
  const [metrics, setMetrics] = useState<ControlCenterMetrics | null>(null)

  useEffect(() => {
    void fetchLoginAudit(100).then(setLogins)
    void fetchControlCenterMetrics().then(setMetrics)
  }, [])

  const failed = logins.filter((l) => !l.success)

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard label="Logins (24h)" value={metrics?.recentLogins ?? 0} icon={Activity} />
        <MetricCard label="Failed Attempts" value={failed.length} icon={AlertTriangle} />
        <MetricCard label="Pending Approvals" value={metrics?.pendingRegistrations ?? 0} icon={UserCheck} />
      </div>
      <h3 className="mt-6 mb-2 font-semibold text-ocean-900">Login Security Log</h3>
      {logins.length === 0 ? (
        <p className="text-sm text-ocean-600">No login activity recorded yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-sand-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-sand-100 text-xs uppercase text-ocean-600">
              <tr>
                <th className="px-4 py-2">Email</th>
                <th className="px-4 py-2">Result</th>
                <th className="px-4 py-2">When</th>
              </tr>
            </thead>
            <tbody>
              {logins.map((l) => (
                <tr key={l.id} className="border-t border-sand-200">
                  <td className="px-4 py-2">{l.email ?? '—'}</td>
                  <td className="px-4 py-2">{l.success ? 'Success' : l.failure_reason ?? 'Failed'}</td>
                  <td className="px-4 py-2 text-xs text-ocean-600">{new Date(l.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ---- Audit -------------------------------------------------------------------------------------

function AuditSection() {
  const [rows, setRows] = useState<{ id: string; action: string; entity_type: string; summary: string | null; created_at: string }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      const { adminDashboard } = await import('../lib/adminDashboard')
      const result = await adminDashboard.fetchAllAdminAuditLogs(1, 50)
      setRows(result.rows.map((r) => ({ id: r.id, action: r.action, entity_type: r.entity_type, summary: r.summary, created_at: r.created_at })))
      setLoading(false)
    })()
  }, [])

  if (loading) return <Loader2 className="animate-spin text-ocean-600" />
  if (rows.length === 0) return <p className="text-sm text-ocean-600">No audit entries yet.</p>

  return (
    <div className="overflow-x-auto rounded-lg border border-sand-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="bg-sand-100 text-xs uppercase text-ocean-600">
          <tr>
            <th className="px-4 py-2">Action</th>
            <th className="px-4 py-2">Entity</th>
            <th className="px-4 py-2">Summary</th>
            <th className="px-4 py-2">When</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-sand-200">
              <td className="px-4 py-2 font-medium text-ocean-900">{r.action}</td>
              <td className="px-4 py-2 text-xs text-ocean-600">{r.entity_type}</td>
              <td className="px-4 py-2 text-ocean-700">{r.summary ?? '—'}</td>
              <td className="px-4 py-2 text-xs text-ocean-600">{new Date(r.created_at).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---- Profile -------------------------------------------------------------------------------------

function ProfileSection() {
  const { user, profile } = useAuth()
  const { signOut } = useAuth()

  return (
    <div className="card max-w-md p-4">
      <div className="text-lg font-bold text-ocean-900">{profile?.name ?? user?.email}</div>
      <div className="text-sm text-ocean-600">{user?.email}</div>
      <button onClick={() => void signOut()} className="btn-secondary mt-4">
        <LogOut size={16} /> Sign Out
      </button>
    </div>
  )
}
