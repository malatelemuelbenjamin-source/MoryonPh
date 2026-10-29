import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  MapPin,
  Route as RouteIcon,
  Bus,
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Eye,
  ShieldAlert,
  Flag,
  Send,
  Trash2,
  Camera,
  Image as ImageIcon,
  Loader2,
  ArrowRightCircle,
} from 'lucide-react'
import { useAuth } from '../lib/auth'
import {
  fetchReport,
  fetchAttachments,
  fetchComments,
  fetchStatusTimeline,
  fetchAuditLogs,
  getAttachmentUrlAsync,
  deleteAttachment,
  addReporterComment,
  deleteReport,
  uploadReportPhoto,
  validateImageFile,
  isCommunityReviewer,
  statusLabel,
  statusClasses,
  categoryLabel,
  TIMELINE_ACTION_LABELS,
} from '../lib/communityReports'
import { formatRelativeTime } from '../lib/labels'
import type {
  CommunityReportWithDetails,
  CommunityReportAttachmentRow,
  CommunityReportCommentWithAuthor,
  CommunityReportStatusTimelineRow,
  CommunityReportAuditLogRow,
  CommunityReportStatus,
} from '../lib/types'

export function CommunityReportDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [report, setReport] = useState<CommunityReportWithDetails | null>(null)
  const [attachments, setAttachments] = useState<CommunityReportAttachmentRow[]>([])
  const [attachmentUrls, setAttachmentUrls] = useState<Record<string, string>>({})
  const [comments, setComments] = useState<CommunityReportCommentWithAuthor[]>([])
  const [timeline, setTimeline] = useState<CommunityReportStatusTimelineRow[]>([])
  const [auditLogs, setAuditLogs] = useState<CommunityReportAuditLogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [isReviewer, setIsReviewer] = useState(false)

  const [followupText, setFollowupText] = useState('')
  const [submittingFollowup, setSubmittingFollowup] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const loadAll = useCallback(async () => {
    if (!id) return
    const [r, atts, cmts, tl] = await Promise.all([
      fetchReport(id),
      fetchAttachments(id),
      fetchComments(id),
      fetchStatusTimeline(id),
    ])
    setReport(r)
    setAttachments(atts)
    setComments(cmts)
    setTimeline(tl)
    setLoading(false)

    // Load signed URLs for attachments
    const urlMap: Record<string, string> = {}
    for (const a of atts) {
      const url = await getAttachmentUrlAsync(a.storage_path)
      if (url) urlMap[a.id] = url
    }
    setAttachmentUrls(urlMap)

    // Check reviewer status and load audit logs if reviewer
    const reviewer = await isCommunityReviewer()
    setIsReviewer(reviewer)
    if (reviewer) {
      const logs = await fetchAuditLogs(id)
      setAuditLogs(logs)
    }
  }, [id])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  const isOwner = report && user && report.reporter_id === user.id

  async function handleFollowup() {
    if (!id || !followupText.trim()) return
    setSubmittingFollowup(true)
    setError(null)
    const { success, error: err } = await addReporterComment(id, followupText)
    if (!success) {
      setError(err ?? 'Failed to send message.')
      setSubmittingFollowup(false)
      return
    }
    setFollowupText('')
    setSuccessMsg('Your follow-up was sent.')
    setSubmittingFollowup(false)
    await loadAll()
    setTimeout(() => setSuccessMsg(null), 3000)
  }

  async function handleDeleteReport() {
    if (!id || !report) return
    if (!confirm('Delete this report? This cannot be undone.')) return
    const { success, error: err } = await deleteReport(id)
    if (!success) {
      setError(err ?? 'Failed to delete report.')
      return
    }
    navigate('/community-reports')
  }

  async function handleAddPhoto(file: File) {
    if (!id) return
    setError(null)
    const valErr = validateImageFile(file)
    if (valErr) {
      setError(valErr)
      return
    }
    const { success, error: err } = await uploadReportPhoto(id, file)
    if (!success) {
      setError(err ?? 'Failed to upload photo.')
      return
    }
    await loadAll()
  }

  async function handleDeleteAttachment(attId: string, storagePath: string) {
    if (!confirm('Remove this photo?')) return
    const ok = await deleteAttachment(attId, storagePath)
    if (!ok) {
      setError('Failed to remove photo.')
      return
    }
    await loadAll()
  }

  if (loading) {
    return (
      <div className="app-shell">
        <header className="sticky top-0 z-30 bg-ocean-800 text-white shadow-card">
          <div className="flex items-center gap-3 px-4 py-4">
            <Link to="/community-reports" className="grid h-9 w-9 place-items-center rounded-full bg-ocean-700 hover:bg-ocean-600">
              <ArrowLeft size={18} />
            </Link>
            <h1 className="text-lg font-bold">Report Details</h1>
          </div>
        </header>
        <main className="flex-1 px-4 py-6">
          <div className="card flex items-center gap-3">
            <span className="h-3 w-3 animate-pulse rounded-full bg-ocean-400" />
            <p className="text-sm font-semibold text-ocean-700">Loading report…</p>
          </div>
        </main>
      </div>
    )
  }

  if (!report) {
    return (
      <div className="app-shell">
        <header className="sticky top-0 z-30 bg-ocean-800 text-white shadow-card">
          <div className="flex items-center gap-3 px-4 py-4">
            <Link to="/community-reports" className="grid h-9 w-9 place-items-center rounded-full bg-ocean-700 hover:bg-ocean-600">
              <ArrowLeft size={18} />
            </Link>
            <h1 className="text-lg font-bold">Report Details</h1>
          </div>
        </header>
        <main className="flex-1 px-4 py-6">
          <div className="card flex flex-col items-center gap-3 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-sand-200 text-ocean-700">
              <AlertTriangle size={24} />
            </span>
            <p className="text-base font-bold text-ocean-900">Report not found</p>
            <p className="text-sm text-ocean-700">This report may have been removed or you do not have access.</p>
            <Link to="/community-reports" className="btn-secondary w-full">Back to Community Reports</Link>
          </div>
        </main>
      </div>
    )
  }

  const showFollowup = isOwner && report.status === 'needs_more_info'
  const canDelete = isOwner && report.status === 'submitted'
  const canAddPhotos = isOwner && (report.status === 'submitted' || report.status === 'needs_more_info')

  return (
    <div className="app-shell">
      <header className="sticky top-0 z-30 bg-ocean-800 text-white shadow-card">
        <div className="flex items-center gap-3 px-4 py-4">
          <Link to="/community-reports" className="grid h-9 w-9 place-items-center rounded-full bg-ocean-700 hover:bg-ocean-600">
            <ArrowLeft size={18} />
          </Link>
          <h1 className="text-lg font-bold">Report Details</h1>
        </div>
      </header>

      <main className="flex-1 space-y-4 px-4 py-5">
        {/* Status banner */}
        <div className={`card flex items-center gap-3 ${report.status === 'rejected' ? 'border-l-4 border-red-400' : report.status === 'resolved' ? 'border-l-4 border-leaf-500' : ''}`}>
          <span className={`grid h-10 w-10 place-items-center rounded-full ${statusClasses(report.status)}`}>
            <StatusIcon status={report.status} />
          </span>
          <div className="flex-1">
            <p className="text-sm font-bold text-ocean-900">{statusLabel(report.status)}</p>
            <p className="text-xs text-ocean-600">Reference: {report.id.slice(0, 8).toUpperCase()}</p>
          </div>
          {report.status !== 'resolved' && report.status !== 'rejected' && (
            <span className="pill bg-sand-200 text-ocean-700">Unverified</span>
          )}
        </div>

        {/* Title and category */}
        <div className="card space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="pill bg-sand-200 text-ocean-800">{categoryLabel(report.category)}</span>
            {report.transport_mode && (
              <span className="pill bg-ocean-100 text-ocean-800">
                <Bus size={12} /> {report.transport_mode.name}
              </span>
            )}
          </div>
          <h2 className="text-lg font-bold text-ocean-900">{report.title}</h2>
          <p className="flex items-center gap-1 text-xs text-ocean-600">
            <MapPin size={12} /> {report.municipality}
            {report.location && <span> · {report.location.name}</span>}
          </p>
          {report.route && (
            <p className="flex items-center gap-1 text-xs text-ocean-600">
              <RouteIcon size={12} /> {report.route.route_name}
            </p>
          )}
          <div className="flex flex-wrap gap-3 text-xs text-ocean-600">
            <span className="flex items-center gap-1">
              <Clock size={12} /> Submitted {formatRelativeTime(report.created_at)}
            </span>
            {report.observed_at && (
              <span className="flex items-center gap-1">
                <Calendar size={12} /> Observed {new Date(report.observed_at).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>

        {/* Description */}
        <div className="card space-y-2">
          <h3 className="section-title">Description</h3>
          <p className="text-sm text-ocean-900 whitespace-pre-wrap">{report.description}</p>
          {report.urgency && (
            <p className="text-xs text-ocean-600">
              <span className="font-semibold">Urgency note:</span> {report.urgency}
            </p>
          )}
          {report.latitude != null && report.longitude != null && (
            <p className="text-xs text-ocean-600">
              <span className="font-semibold">Coordinates:</span> {report.latitude}, {report.longitude}
            </p>
          )}
        </div>

        {/* Reviewer response */}
        {report.status === 'needs_more_info' && (
          <div className="card space-y-2 border-l-4 border-terra-400">
            <div className="flex items-center gap-2">
              <HelpCircle size={18} className="text-terra-600" />
              <p className="text-sm font-bold text-terra-800">More information requested</p>
            </div>
            <p className="text-sm text-ocean-700">
              A reviewer needs more details about your report. Please provide a follow-up response below.
            </p>
          </div>
        )}

        {report.status === 'resolved' && report.resolution_summary && (
          <div className="card space-y-2 border-l-4 border-leaf-500">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={18} className="text-leaf-700" />
              <p className="text-sm font-bold text-leaf-800">Resolution</p>
            </div>
            <p className="text-sm text-ocean-900">{report.resolution_summary}</p>
            {report.reviewer && (
              <p className="text-xs text-ocean-500">Reviewed by {report.reviewer.name ?? 'Reviewer'}</p>
            )}
          </div>
        )}

        {report.status === 'rejected' && report.rejection_reason && (
          <div className="card space-y-2 border-l-4 border-red-400">
            <div className="flex items-center gap-2">
              <XCircle size={18} className="text-red-600" />
              <p className="text-sm font-bold text-red-700">Report Rejected</p>
            </div>
            <p className="text-sm text-ocean-900">{report.rejection_reason}</p>
            {report.reviewer && (
              <p className="text-xs text-ocean-500">Reviewed by {report.reviewer.name ?? 'Reviewer'}</p>
            )}
          </div>
        )}

        {report.forwarded_to_verification && (
          <div className="card flex items-center gap-2 border-l-4 border-ocean-400">
            <ArrowRightCircle size={18} className="text-ocean-600" />
            <p className="text-sm font-semibold text-ocean-800">
              Forwarded to Data Verification workflow
            </p>
          </div>
        )}

        {/* Photos */}
        <div className="card space-y-3">
          <div className="flex items-center gap-2">
            <Camera size={18} className="text-ocean-600" />
            <h3 className="section-title">Photo Evidence</h3>
          </div>
          {attachments.length === 0 && (
            <p className="text-sm text-ocean-600">No photos attached.</p>
          )}
          {attachments.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {attachments.map((a) => (
                <div key={a.id} className="relative">
                  {attachmentUrls[a.id] ? (
                    <img src={attachmentUrls[a.id]} alt={a.file_name} className="h-24 w-full rounded-lg object-cover" />
                  ) : (
                    <div className="grid h-24 w-full place-items-center rounded-lg bg-ocean-50">
                      <ImageIcon size={20} className="text-ocean-300" />
                    </div>
                  )}
                  {canAddPhotos && (
                    <button
                      type="button"
                      onClick={() => handleDeleteAttachment(a.id, a.storage_path)}
                      className="absolute -right-1 -top-1 grid h-6 w-6 place-items-center rounded-full bg-red-500 text-white shadow"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          {canAddPhotos && attachments.length < 5 && (
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-ocean-200 px-3 py-3 text-sm text-ocean-600 hover:bg-ocean-50">
              <Camera size={16} /> Add Photo
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => { if (e.target.files?.[0]) handleAddPhoto(e.target.files[0]) }}
              />
            </label>
          )}
        </div>

        {/* Status timeline */}
        <div className="card space-y-3">
          <h3 className="section-title">Status Timeline</h3>
          {timeline.length === 0 && (
            <p className="text-sm text-ocean-600">No status events recorded yet.</p>
          )}
          <div className="space-y-3">
            {timeline.map((event, idx) => (
              <div key={event.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span className={`grid h-7 w-7 place-items-center rounded-full ${statusClasses(event.new_status ?? 'submitted')}`}>
                    <TimelineIcon action={event.action} />
                  </span>
                  {idx < timeline.length - 1 && (
                    <span className="h-full w-0.5 flex-1 bg-ocean-100" />
                  )}
                </div>
                <div className="pb-2">
                  <p className="text-sm font-semibold text-ocean-900">
                    {TIMELINE_ACTION_LABELS[event.action] ?? event.action}
                  </p>
                  <p className="text-xs text-ocean-500">
                    {new Date(event.created_at).toLocaleString()}
                  </p>
                  {event.new_status && event.new_status !== event.previous_status && (
                    <p className="text-xs text-ocean-600">
                      {event.previous_status ? statusLabel(event.previous_status) : 'New'} → {statusLabel(event.new_status)}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Comments / follow-up */}
        {comments.length > 0 && (
          <div className="card space-y-3">
            <h3 className="section-title">Messages</h3>
            {comments.map((c) => (
              <div key={c.id} className={`rounded-xl px-3 py-2.5 ${c.author_role === 'reviewer' ? 'bg-terra-50' : 'bg-ocean-50'}`}>
                <div className="flex items-center gap-2">
                  <span className={`pill ${c.author_role === 'reviewer' ? 'bg-terra-100 text-terra-700' : 'bg-ocean-100 text-ocean-700'}`}>
                    {c.author_role === 'reviewer' ? 'Reviewer' : 'You'}
                  </span>
                  <span className="text-xs text-ocean-400">{formatRelativeTime(c.created_at)}</span>
                </div>
                <p className="mt-1.5 text-sm text-ocean-900">{c.body}</p>
              </div>
            ))}
          </div>
        )}

        {/* Follow-up form */}
        {showFollowup && (
          <div className="card space-y-3">
            <h3 className="section-title">Provide Follow-up</h3>
            <textarea
              value={followupText}
              onChange={(e) => setFollowupText(e.target.value.slice(0, 2000))}
              placeholder="Add details or clarifications the reviewer requested…"
              rows={4}
              className="w-full rounded-xl bg-ocean-50 px-3 py-2.5 text-sm text-ocean-900 placeholder:text-ocean-400 focus:outline-none focus:ring-2 focus:ring-ocean-400"
            />
            <button
              type="button"
              onClick={handleFollowup}
              disabled={!followupText.trim() || submittingFollowup}
              className="btn-primary w-full"
            >
              {submittingFollowup ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
              Send Follow-up
            </button>
          </div>
        )}

        {/* Reviewer audit log (reviewer only) */}
        {isReviewer && auditLogs.length > 0 && (
          <div className="card space-y-3">
            <div className="flex items-center gap-2">
              <ShieldAlert size={18} className="text-terra-600" />
              <h3 className="section-title">Audit Log (Reviewer)</h3>
            </div>
            {auditLogs.map((log) => (
              <div key={log.id} className="border-b border-ocean-50 pb-2 last:border-0">
                <p className="text-sm font-semibold text-ocean-900">
                  {TIMELINE_ACTION_LABELS[log.action] ?? log.action}
                </p>
                <p className="text-xs text-ocean-500">{new Date(log.created_at).toLocaleString()}</p>
                {log.internal_note && (
                  <p className="mt-1 text-xs text-terra-700">
                    <span className="font-semibold">Note:</span> {log.internal_note}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Success message */}
        {successMsg && (
          <div className="card flex items-center gap-2 border-l-4 border-leaf-500">
            <CheckCircle2 size={18} className="text-leaf-700" />
            <p className="text-sm text-leaf-800">{successMsg}</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="card flex items-start gap-2 border-l-4 border-red-400">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-red-600" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Delete (owner only, while submitted) */}
        {canDelete && (
          <button type="button" onClick={handleDeleteReport} className="btn-ghost w-full text-red-600 hover:bg-red-50">
            <Trash2 size={16} /> Delete Report
          </button>
        )}

        {/* Not authorized notice */}
        {!isOwner && !isReviewer && (
          <div className="card flex flex-col items-center gap-3 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-sand-200 text-ocean-700">
              <Flag size={24} />
            </span>
            <p className="text-sm font-semibold text-ocean-900">You can view this report's public details</p>
            <p className="text-xs text-ocean-600">Private information is not shown.</p>
          </div>
        )}

        {/* Reviewer link */}
        {isReviewer && (
          <Link to={`/community-reports/admin/${report.id}`} className="btn-secondary w-full">
            <Eye size={16} /> Open in Review Dashboard
          </Link>
        )}
      </main>
    </div>
  )
}

function StatusIcon({ status }: { status: CommunityReportStatus }) {
  switch (status) {
    case 'submitted': return <Flag size={18} />
    case 'under_review': return <Eye size={18} />
    case 'needs_more_info': return <HelpCircle size={18} />
    case 'resolved': return <CheckCircle2 size={18} />
    case 'rejected': return <XCircle size={18} />
  }
}

function TimelineIcon({ action }: { action: string }) {
  switch (action) {
    case 'submitted': return <Flag size={14} />
    case 'marked_under_review': return <Eye size={14} />
    case 'requested_info': return <HelpCircle size={14} />
    case 'resolved': return <CheckCircle2 size={14} />
    case 'rejected': return <XCircle size={14} />
    case 'forwarded_to_verification': return <ArrowRightCircle size={14} />
    case 'reporter_followed_up': return <Send size={14} />
    default: return <Flag size={14} />
  }
}
