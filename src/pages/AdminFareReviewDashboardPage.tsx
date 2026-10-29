import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Search as SearchIcon,
  Filter,
  Eye,
  HelpCircle,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  MapPin,
  Bus,
  Route as RouteIcon,
  User as UserIcon,
  Calendar,
  Loader2,
  ArrowRightCircle,
  AlertTriangle,
  Receipt,
  Lock,
} from 'lucide-react'
import {
  fetchAllFareConcerns,
  fetchFareConcern,
  fetchAllFareConcernComments,
  fetchFareConcernAuditLogs,
  fetchFareConcernAttachments,
  getFareConcernAttachmentUrl,
  fetchTransportModes,
  isCommunityReviewer,
  markFareConcernUnderReview,
  requestFareConcernMoreInfo,
  resolveFareConcern,
  rejectFareConcern,
  closeFareConcern,
  forwardFareConcernToVerification,
  addFareConcernReviewerComment,
  statusLabel,
  statusClasses,
  categoryLabel,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  TIMELINE_ACTION_LABELS,
  PASSENGER_CATEGORY_LABELS,
} from '../lib/fareConcerns'
import { formatRelativeTime } from '../lib/labels'
import type {
  FareConcernWithDetails,
  FareConcernCommentWithAuthor,
  FareConcernAuditLogRow,
  FareConcernAttachmentRow,
  FareConcernStatus,
  TransportModeRow,
} from '../lib/types'

const MUNICIPALITIES = ['Boac', 'Buenavista', 'Gasan', 'Mogpog', 'Santa Cruz', 'Torrijos']

export function AdminFareReviewDashboardPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  if (id) return <AdminFareDetail reportId={id} />

  const [reports, setReports] = useState<FareConcernWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [authorized, setAuthorized] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [muniFilter, setMuniFilter] = useState<string>('all')
  const [transportFilter, setTransportFilter] = useState<string>('all')
  const [transportModes, setTransportModes] = useState<TransportModeRow[]>([])

  useEffect(() => {
    void (async () => {
      const [reviewer, modes] = await Promise.all([isCommunityReviewer(), fetchTransportModes()])
      setAuthorized(reviewer)
      setTransportModes(modes)
      setAuthChecked(true)
      if (reviewer) {
        const all = await fetchAllFareConcerns()
        setReports(all)
      }
      setLoading(false)
    })()
  }, [])

  const filtered = useMemo(() => {
    let list = reports
    const term = search.trim().toLowerCase()
    if (term) {
      list = list.filter(
        (r) =>
          r.title.toLowerCase().includes(term) ||
          r.report_reference.toLowerCase().includes(term) ||
          (r.reporter?.name?.toLowerCase().includes(term) ?? false),
      )
    }
    if (statusFilter !== 'all') list = list.filter((r) => r.status === statusFilter)
    if (categoryFilter !== 'all') list = list.filter((r) => r.category === categoryFilter)
    if (muniFilter !== 'all') list = list.filter((r) => r.municipality === muniFilter)
    if (transportFilter !== 'all') list = list.filter((r) => r.transport_mode_id === transportFilter)
    return list
  }, [reports, search, statusFilter, categoryFilter, muniFilter, transportFilter])

  if (!authChecked || loading) {
    return (
      <div className="app-shell">
        <ReviewHeader />
        <main className="flex-1 px-4 py-6">
          <div className="card flex items-center gap-3">
            <span className="h-3 w-3 animate-pulse rounded-full bg-ocean-400" />
            <p className="text-sm font-semibold text-ocean-700">Loading…</p>
          </div>
        </main>
      </div>
    )
  }

  if (!authorized) {
    return (
      <div className="app-shell">
        <ReviewHeader />
        <main className="flex-1 px-4 py-6">
          <div className="card flex flex-col items-center gap-3 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-red-100 text-red-700">
              <ShieldAlert size={24} />
            </span>
            <p className="text-base font-bold text-ocean-900">Access Denied</p>
            <p className="text-sm text-ocean-700">You do not have reviewer permissions for fare concerns.</p>
            <Link to="/fare-concerns" className="btn-secondary w-full">Back to Fare Concerns</Link>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <ReviewHeader />
      <main className="flex-1 space-y-5 px-4 py-5">
        <div className="card flex items-center gap-2">
          <ShieldAlert size={18} className="text-terra-600" />
          <p className="text-sm font-semibold text-ocean-900">Fare Review Dashboard</p>
          <span className="ml-auto text-xs text-ocean-500">{filtered.length} reports</span>
        </div>

        <section className="card space-y-3">
          <div className="flex items-center gap-2 rounded-xl bg-ocean-50 px-3 py-2.5">
            <SearchIcon size={18} className="text-ocean-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by title, reference, or reporter"
              className="w-full bg-transparent text-sm text-ocean-900 placeholder:text-ocean-400 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-1.5 text-xs font-semibold text-ocean-600">
            <Filter size={14} /> Filters
          </div>

          <div className="flex flex-wrap gap-1.5">
            <Chip active={statusFilter === 'all'} onClick={() => setStatusFilter('all')} label="All Status" />
            {(['submitted', 'under_review', 'needs_more_info', 'resolved', 'rejected', 'closed'] as FareConcernStatus[]).map((s) => (
              <Chip key={s} active={statusFilter === s} onClick={() => setStatusFilter(s)} label={statusLabel(s)} />
            ))}
          </div>

          <div className="flex flex-wrap gap-1.5">
            <Chip active={categoryFilter === 'all'} onClick={() => setCategoryFilter('all')} label="All Categories" />
            {CATEGORY_ORDER.map((c) => (
              <Chip key={c} active={categoryFilter === c} onClick={() => setCategoryFilter(c)} label={CATEGORY_LABELS[c]} />
            ))}
          </div>

          <div className="flex flex-wrap gap-1.5">
            <Chip active={muniFilter === 'all'} onClick={() => setMuniFilter('all')} label="All Municipalities" />
            {MUNICIPALITIES.map((m) => (
              <Chip key={m} active={muniFilter === m} onClick={() => setMuniFilter(m)} label={m} />
            ))}
          </div>

          <div className="flex flex-wrap gap-1.5">
            <Chip active={transportFilter === 'all'} onClick={() => setTransportFilter('all')} label="All Transport" />
            {transportModes.map((m) => (
              <Chip key={m.id} active={transportFilter === m.id} onClick={() => setTransportFilter(m.id)} label={m.name} />
            ))}
          </div>
        </section>

        {filtered.length === 0 && (
          <div className="card flex flex-col items-center gap-3 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-sand-200 text-ocean-700">
              <SearchIcon size={24} />
            </span>
            <p className="text-base font-bold text-ocean-900">No fare concerns match your filters</p>
          </div>
        )}

        {filtered.map((r) => (
          <div key={r.id} className="card space-y-2 cursor-pointer active:scale-[0.98] transition" onClick={() => navigate(`/fare-concerns/admin/${r.id}`)} role="button">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`pill ${statusClasses(r.status)}`}>{statusLabel(r.status)}</span>
              <span className="pill bg-sand-200 text-ocean-800">{categoryLabel(r.category)}</span>
              <span className="font-mono text-xs text-ocean-500">{r.report_reference}</span>
            </div>
            <p className="font-bold text-ocean-900">{r.title}</p>
            <div className="flex flex-wrap gap-3 text-xs text-ocean-600">
              <span className="flex items-center gap-1"><MapPin size={12} /> {r.municipality}</span>
              {r.transport_mode && <span className="flex items-center gap-1"><Bus size={12} /> {r.transport_mode.name}</span>}
              <span className="flex items-center gap-1"><Calendar size={12} /> {formatRelativeTime(r.created_at)}</span>
            </div>
            {(r.amount_charged != null || r.expected_fare_amount != null) && (
              <div className="flex gap-3 text-xs text-ocean-700">
                {r.amount_charged != null && <span>Charged: ₱{r.amount_charged}</span>}
                {r.expected_fare_amount != null && <span>Expected: ₱{r.expected_fare_amount}</span>}
              </div>
            )}
            {r.reporter && (
              <p className="flex items-center gap-1 text-xs text-ocean-500">
                <UserIcon size={12} /> {r.reporter.name ?? r.reporter.email ?? 'Unknown'}
              </p>
            )}
          </div>
        ))}
      </main>
    </div>
  )
}

function AdminFareDetail({ reportId }: { reportId: string }) {
  const [report, setReport] = useState<FareConcernWithDetails | null>(null)
  const [comments, setComments] = useState<FareConcernCommentWithAuthor[]>([])
  const [auditLogs, setAuditLogs] = useState<FareConcernAuditLogRow[]>([])
  const [attachments, setAttachments] = useState<FareConcernAttachmentRow[]>([])
  const [attachmentUrls, setAttachmentUrls] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [authorized, setAuthorized] = useState(false)

  const [reviewerNotes, setReviewerNotes] = useState('')
  const [moreInfoMsg, setMoreInfoMsg] = useState('')
  const [resolutionSummary, setResolutionSummary] = useState('')
  const [rejectionReason, setRejectionReason] = useState('')
  const [closeNote, setCloseNote] = useState('')
  const [reviewerComment, setReviewerComment] = useState('')
  const [commentVisible, setCommentVisible] = useState(true)

  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [confirmAction, setConfirmAction] = useState<string | null>(null)

  const loadAll = useCallback(async () => {
    const [r, cmts, logs, atts] = await Promise.all([
      fetchFareConcern(reportId),
      fetchAllFareConcernComments(reportId),
      fetchFareConcernAuditLogs(reportId),
      fetchFareConcernAttachments(reportId),
    ])
    setReport(r)
    setComments(cmts)
    setAuditLogs(logs)
    setAttachments(atts)

    const urlMap: Record<string, string> = {}
    for (const a of atts) {
      const url = await getFareConcernAttachmentUrl(a.storage_path)
      if (url) urlMap[a.id] = url
    }
    setAttachmentUrls(urlMap)
    setLoading(false)
  }, [reportId])

  useEffect(() => {
    void (async () => {
      const reviewer = await isCommunityReviewer()
      setAuthorized(reviewer)
      if (reviewer) await loadAll()
      else setLoading(false)
    })()
  }, [loadAll])

  function clearAction() {
    setReviewerNotes('')
    setMoreInfoMsg('')
    setResolutionSummary('')
    setRejectionReason('')
    setCloseNote('')
    setConfirmAction(null)
  }

  async function doAction(action: string) {
    if (!report) return
    setActionLoading(true)
    setError(null)
    let result: { success: boolean; error?: string }

    switch (action) {
      case 'under_review':
        result = await markFareConcernUnderReview(report.id, reviewerNotes)
        break
      case 'needs_more_info':
        result = await requestFareConcernMoreInfo(report.id, moreInfoMsg)
        break
      case 'resolve':
        result = await resolveFareConcern(report.id, resolutionSummary, reviewerNotes)
        break
      case 'reject':
        result = await rejectFareConcern(report.id, rejectionReason, reviewerNotes)
        break
      case 'close':
        result = await closeFareConcern(report.id, closeNote)
        break
      case 'forward':
        result = await forwardFareConcernToVerification(report.id)
        break
      default:
        return
    }

    setActionLoading(false)
    if (!result.success) {
      setError(result.error ?? 'Action failed.')
      return
    }
    setSuccessMsg(`Report ${action.replace(/_/g, ' ')} successful.`)
    clearAction()
    await loadAll()
    setTimeout(() => setSuccessMsg(null), 3000)
  }

  async function handleAddComment() {
    if (!report || !reviewerComment.trim()) return
    setActionLoading(true)
    setError(null)
    const { success, error: err } = await addFareConcernReviewerComment(report.id, reviewerComment, commentVisible)
    setActionLoading(false)
    if (!success) {
      setError(err ?? 'Failed to add comment.')
      return
    }
    setReviewerComment('')
    await loadAll()
  }

  if (loading) {
    return (
      <div className="app-shell">
        <ReviewHeader backTo="/fare-concerns/admin" />
        <main className="flex-1 px-4 py-6">
          <div className="card flex items-center gap-3">
            <span className="h-3 w-3 animate-pulse rounded-full bg-ocean-400" />
            <p className="text-sm font-semibold text-ocean-700">Loading…</p>
          </div>
        </main>
      </div>
    )
  }

  if (!authorized) {
    return (
      <div className="app-shell">
        <ReviewHeader backTo="/fare-concerns/admin" />
        <main className="flex-1 px-4 py-6">
          <div className="card flex flex-col items-center gap-3 text-center">
            <ShieldAlert size={32} className="text-red-600" />
            <p className="text-base font-bold text-ocean-900">Access Denied</p>
            <Link to="/fare-concerns" className="btn-secondary w-full">Back to Fare Concerns</Link>
          </div>
        </main>
      </div>
    )
  }

  if (!report) {
    return (
      <div className="app-shell">
        <ReviewHeader backTo="/fare-concerns/admin" />
        <main className="flex-1 px-4 py-6">
          <div className="card flex flex-col items-center gap-3 text-center">
            <AlertTriangle size={24} className="text-ocean-600" />
            <p className="text-base font-bold text-ocean-900">Report not found</p>
            <Link to="/fare-concerns/admin" className="btn-secondary w-full">Back to Dashboard</Link>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <ReviewHeader backTo="/fare-concerns/admin" />
      <main className="flex-1 space-y-4 px-4 py-5">
        {/* Status and ref */}
        <div className="card flex items-center gap-3">
          <span className={`grid h-10 w-10 place-items-center rounded-full ${statusClasses(report.status)}`}>
            <StatusIcon status={report.status} />
          </span>
          <div className="flex-1">
            <p className="text-sm font-bold text-ocean-900">{statusLabel(report.status)}</p>
            <p className="font-mono text-xs text-ocean-600">Ref: {report.report_reference}</p>
          </div>
        </div>

        {/* Report info */}
        <div className="card space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="pill bg-sand-200 text-ocean-800">{categoryLabel(report.category)}</span>
            {report.transport_mode && <span className="pill bg-ocean-100 text-ocean-800"><Bus size={12} /> {report.transport_mode.name}</span>}
            {report.passenger_category && <span className="pill bg-leaf-100 text-leaf-700">{PASSENGER_CATEGORY_LABELS[report.passenger_category]}</span>}
          </div>
          <h2 className="text-lg font-bold text-ocean-900">{report.title}</h2>
          <div className="flex flex-wrap gap-3 text-xs text-ocean-600">
            <span className="flex items-center gap-1"><MapPin size={12} /> {report.municipality}</span>
            {report.route && <span className="flex items-center gap-1"><RouteIcon size={12} /> {report.route.route_name}</span>}
            {report.boarding_location && <span>From: {report.boarding_location.name}</span>}
            {report.destination_location && <span>To: {report.destination_location.name}</span>}
            <span className="flex items-center gap-1"><Calendar size={12} /> {formatRelativeTime(report.created_at)}</span>
            {report.incident_at && <span>Incident: {new Date(report.incident_at).toLocaleString()}</span>}
          </div>
          {(report.amount_charged != null || report.expected_fare_amount != null) && (
            <div className="flex gap-3 text-sm">
              {report.amount_charged != null && <span className="rounded-lg bg-terra-50 px-2 py-1 font-semibold text-terra-800">Charged: ₱{report.amount_charged}</span>}
              {report.expected_fare_amount != null && <span className="rounded-lg bg-leaf-50 px-2 py-1 font-semibold text-leaf-800">Expected: ₱{report.expected_fare_amount}</span>}
            </div>
          )}
          {report.fare_record_id && (
            <p className="text-xs text-ocean-500">Fare record referenced: {report.fare_record_id.slice(0, 8)}</p>
          )}
          {report.reporter && (
            <p className="flex items-center gap-1 text-xs text-ocean-500">
              <UserIcon size={12} /> Reporter: {report.reporter.name ?? 'Unknown'} ({report.reporter.email ?? 'no email'})
            </p>
          )}
        </div>

        {/* Description */}
        <div className="card space-y-2">
          <h3 className="section-title">Description</h3>
          <p className="whitespace-pre-wrap text-sm text-ocean-900">{report.description}</p>
        </div>

        {/* Fare comparison guidance */}
        <div className="card flex items-start gap-2 rounded-xl bg-sand-50">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-terra-600" />
          <p className="text-xs text-terra-800">
            Compare the reported amount with the applicable verified fare record and its effective date.
            A fare record may be outdated, incomplete, or inapplicable to the reported journey.
            Do not conclude a violation occurred based only on a difference.
          </p>
        </div>

        {/* Attachments */}
        {attachments.length > 0 && (
          <div className="card space-y-3">
            <h3 className="section-title">Evidence Photos</h3>
            <div className="grid grid-cols-3 gap-2">
              {attachments.map((a) => (
                <div key={a.id}>
                  {attachmentUrls[a.id] ? (
                    <img src={attachmentUrls[a.id]} alt={a.file_name} className="h-24 w-full rounded-lg object-cover" />
                  ) : (
                    <div className="grid h-24 w-full place-items-center rounded-lg bg-ocean-50">
                      <Loader2 size={16} className="animate-spin text-ocean-300" />
                    </div>
                  )}
                  <p className="mt-1 truncate text-xs text-ocean-500">{a.file_name}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Comments */}
        {comments.length > 0 && (
          <div className="card space-y-3">
            <h3 className="section-title">All Comments</h3>
            {comments.map((c) => (
              <div key={c.id} className={`rounded-xl px-3 py-2.5 ${c.author_role === 'reviewer' ? 'bg-terra-50' : 'bg-ocean-50'}`}>
                <div className="flex items-center gap-2">
                  <span className={`pill ${c.author_role === 'reviewer' ? 'bg-terra-100 text-terra-700' : 'bg-ocean-100 text-ocean-700'}`}>
                    {c.author_role === 'reviewer' ? 'Reviewer' : 'Reporter'}
                  </span>
                  {!c.is_visible_to_reporter && <span className="text-xs text-ocean-400">(private)</span>}
                  <span className="text-xs text-ocean-400">{formatRelativeTime(c.created_at)}</span>
                </div>
                <p className="mt-1.5 text-sm text-ocean-900">{c.body}</p>
              </div>
            ))}
          </div>
        )}

        {/* Add reviewer comment */}
        <div className="card space-y-3">
          <h3 className="section-title">Add Comment</h3>
          <textarea
            value={reviewerComment}
            onChange={(e) => setReviewerComment(e.target.value.slice(0, 2000))}
            placeholder="Write a comment…"
            rows={3}
            className="w-full rounded-xl bg-ocean-50 px-3 py-2.5 text-sm text-ocean-900 placeholder:text-ocean-400 focus:outline-none focus:ring-2 focus:ring-ocean-400"
          />
          <label className="flex items-center gap-2 text-sm text-ocean-700">
            <input type="checkbox" checked={commentVisible} onChange={(e) => setCommentVisible(e.target.checked)} className="h-4 w-4 rounded border-ocean-300" />
            Visible to reporter
          </label>
          <button type="button" onClick={handleAddComment} disabled={!reviewerComment.trim() || actionLoading} className="btn-secondary w-full">
            Add Comment
          </button>
        </div>

        {/* Reviewer actions */}
        <div className="card space-y-3">
          <h3 className="section-title">Review Actions</h3>

          {/* Mark under review */}
          {report.status === 'submitted' && (
            <div className="space-y-2">
              <button type="button" onClick={() => doAction('under_review')} disabled={actionLoading} className="btn-secondary w-full">
                <Eye size={16} /> Mark Under Review
              </button>
            </div>
          )}

          {/* Request more info */}
          {(report.status === 'submitted' || report.status === 'under_review') && (
            <div className="space-y-2">
              <button type="button" onClick={() => setConfirmAction('needs_more_info')} className="btn-secondary w-full">
                <HelpCircle size={16} /> Request More Information
              </button>
              {confirmAction === 'needs_more_info' && (
                <div className="space-y-2 rounded-xl bg-sand-50 p-3">
                  <textarea value={moreInfoMsg} onChange={(e) => setMoreInfoMsg(e.target.value.slice(0, 2000))}
                    placeholder="What information do you need from the reporter?" rows={3}
                    className="w-full rounded-xl bg-white px-3 py-2.5 text-sm text-ocean-900 placeholder:text-ocean-400 focus:outline-none focus:ring-2 focus:ring-ocean-400" />
                  <div className="flex gap-2">
                    <button type="button" onClick={clearAction} className="btn-ghost flex-1">Cancel</button>
                    <button type="button" onClick={() => doAction('needs_more_info')} disabled={!moreInfoMsg.trim() || actionLoading} className="btn-primary flex-1">
                      Confirm
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Forward to verification */}
          {!report.forwarded_to_verification && report.status !== 'rejected' && (
            <button type="button" onClick={() => setConfirmAction('forward')} className="btn-secondary w-full">
              <ArrowRightCircle size={16} /> Forward to Data Verification
            </button>
          )}
          {confirmAction === 'forward' && (
            <div className="space-y-2 rounded-xl bg-sand-50 p-3">
              <p className="text-sm text-ocean-700">Forward this report to the Data Verification workflow for fare data checking?</p>
              <div className="flex gap-2">
                <button type="button" onClick={clearAction} className="btn-ghost flex-1">Cancel</button>
                <button type="button" onClick={() => doAction('forward')} disabled={actionLoading} className="btn-primary flex-1">
                  Confirm Forward
                </button>
              </div>
            </div>
          )}

          {/* Resolve */}
          {report.status !== 'resolved' && report.status !== 'rejected' && report.status !== 'closed' && (
            <div className="space-y-2">
              <button type="button" onClick={() => setConfirmAction('resolve')}
                className="w-full rounded-xl bg-leaf-600 px-4 py-3 text-base font-semibold text-white transition active:scale-[0.98] hover:bg-leaf-700">
                <CheckCircle2 size={16} /> Resolve Report
              </button>
              {confirmAction === 'resolve' && (
                <div className="space-y-2 rounded-xl bg-leaf-50 p-3">
                  <textarea value={resolutionSummary} onChange={(e) => setResolutionSummary(e.target.value.slice(0, 2000))}
                    placeholder="Resolution summary (required, shown to reporter)" rows={3}
                    className="w-full rounded-xl bg-white px-3 py-2.5 text-sm text-ocean-900 placeholder:text-ocean-400 focus:outline-none focus:ring-2 focus:ring-leaf-400" />
                  <textarea value={reviewerNotes} onChange={(e) => setReviewerNotes(e.target.value.slice(0, 2000))}
                    placeholder="Internal notes (optional, private)" rows={2}
                    className="w-full rounded-xl bg-white px-3 py-2.5 text-sm text-ocean-900 placeholder:text-ocean-400 focus:outline-none focus:ring-2 focus:ring-ocean-400" />
                  <div className="flex gap-2">
                    <button type="button" onClick={clearAction} className="btn-ghost flex-1">Cancel</button>
                    <button type="button" onClick={() => doAction('resolve')} disabled={!resolutionSummary.trim() || actionLoading}
                      className="w-full rounded-xl bg-leaf-600 px-4 py-3 text-base font-semibold text-white transition active:scale-[0.98] hover:bg-leaf-700 disabled:opacity-50">
                      Confirm Resolve
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Reject */}
          {report.status !== 'rejected' && report.status !== 'resolved' && report.status !== 'closed' && (
            <div className="space-y-2">
              <button type="button" onClick={() => setConfirmAction('reject')}
                className="w-full rounded-xl bg-red-500 px-4 py-3 text-base font-semibold text-white transition active:scale-[0.98] hover:bg-red-600">
                <XCircle size={16} /> Reject Report
              </button>
              {confirmAction === 'reject' && (
                <div className="space-y-2 rounded-xl bg-red-50 p-3">
                  <textarea value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value.slice(0, 2000))}
                    placeholder="Rejection reason (required, shown to reporter)" rows={3}
                    className="w-full rounded-xl bg-white px-3 py-2.5 text-sm text-ocean-900 placeholder:text-ocean-400 focus:outline-none focus:ring-2 focus:ring-red-400" />
                  <textarea value={reviewerNotes} onChange={(e) => setReviewerNotes(e.target.value.slice(0, 2000))}
                    placeholder="Internal notes (optional, private)" rows={2}
                    className="w-full rounded-xl bg-white px-3 py-2.5 text-sm text-ocean-900 placeholder:text-ocean-400 focus:outline-none focus:ring-2 focus:ring-ocean-400" />
                  <div className="flex gap-2">
                    <button type="button" onClick={clearAction} className="btn-ghost flex-1">Cancel</button>
                    <button type="button" onClick={() => doAction('reject')} disabled={!rejectionReason.trim() || actionLoading}
                      className="w-full rounded-xl bg-red-500 px-4 py-3 text-base font-semibold text-white transition active:scale-[0.98] hover:bg-red-600 disabled:opacity-50">
                      Confirm Reject
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Close */}
          {report.status !== 'closed' && report.status !== 'submitted' && (
            <div className="space-y-2">
              <button type="button" onClick={() => setConfirmAction('close')}
                className="w-full rounded-xl bg-ocean-600 px-4 py-3 text-base font-semibold text-white transition active:scale-[0.98] hover:bg-ocean-700">
                <Lock size={16} /> Close Report
              </button>
              {confirmAction === 'close' && (
                <div className="space-y-2 rounded-xl bg-ocean-50 p-3">
                  <textarea value={closeNote} onChange={(e) => setCloseNote(e.target.value.slice(0, 2000))}
                    placeholder="Closing note (optional, private)" rows={2}
                    className="w-full rounded-xl bg-white px-3 py-2.5 text-sm text-ocean-900 placeholder:text-ocean-400 focus:outline-none focus:ring-2 focus:ring-ocean-400" />
                  <div className="flex gap-2">
                    <button type="button" onClick={clearAction} className="btn-ghost flex-1">Cancel</button>
                    <button type="button" onClick={() => doAction('close')} disabled={actionLoading}
                      className="w-full rounded-xl bg-ocean-600 px-4 py-3 text-base font-semibold text-white transition active:scale-[0.98] hover:bg-ocean-700 disabled:opacity-50">
                      Confirm Close
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Audit log */}
        {auditLogs.length > 0 && (
          <div className="card space-y-3">
            <div className="flex items-center gap-2">
              <ShieldAlert size={18} className="text-terra-600" />
              <h3 className="section-title">Audit History</h3>
            </div>
            {auditLogs.map((log) => (
              <div key={log.id} className="border-b border-ocean-50 pb-2 last:border-0">
                <p className="text-sm font-semibold text-ocean-900">{TIMELINE_ACTION_LABELS[log.action] ?? log.action}</p>
                <p className="text-xs text-ocean-500">{new Date(log.created_at).toLocaleString()}</p>
                {log.previous_status && log.new_status && (
                  <p className="text-xs text-ocean-600">{statusLabel(log.previous_status)} → {statusLabel(log.new_status)}</p>
                )}
                {log.internal_note && (
                  <p className="mt-1 text-xs text-terra-700"><span className="font-semibold">Note:</span> {log.internal_note}</p>
                )}
              </div>
            ))}
          </div>
        )}

        {successMsg && (
          <div className="card flex items-center gap-2 border-l-4 border-leaf-500">
            <CheckCircle2 size={18} className="text-leaf-700" />
            <p className="text-sm text-leaf-800">{successMsg}</p>
          </div>
        )}
        {error && (
          <div className="card flex items-start gap-2 border-l-4 border-red-400">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-red-600" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <Link to="/fare-concerns/admin" className="btn-secondary w-full">Back to Dashboard</Link>
      </main>
    </div>
  )
}

function ReviewHeader({ backTo = '/fare-concerns' }: { backTo?: string }) {
  return (
    <header className="sticky top-0 z-30 bg-terra-700 text-white shadow-card">
      <div className="flex items-center gap-3 px-4 py-4">
        <Link to={backTo} className="grid h-9 w-9 place-items-center rounded-full bg-terra-600 hover:bg-terra-500">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-lg font-bold">Fare Review Dashboard</h1>
      </div>
    </header>
  )
}

function Chip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition active:scale-95 ${
        active ? 'bg-ocean-700 text-white' : 'bg-ocean-50 text-ocean-700 hover:bg-ocean-100'
      }`}>
      {label}
    </button>
  )
}

function StatusIcon({ status }: { status: FareConcernStatus }) {
  switch (status) {
    case 'submitted': return <Receipt size={18} />
    case 'under_review': return <Eye size={18} />
    case 'needs_more_info': return <HelpCircle size={18} />
    case 'resolved': return <CheckCircle2 size={18} />
    case 'rejected': return <XCircle size={18} />
    case 'closed': return <Lock size={18} />
  }
}
