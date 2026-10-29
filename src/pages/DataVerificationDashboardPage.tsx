import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  Loader2,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  FileWarning,
  Search,
  ChevronLeft,
  ChevronRight,
  X,
  FileText,
  History,
  ClipboardCheck,
} from 'lucide-react'
import { useAuth } from '../lib/auth'
import { isAlertAdmin } from '../lib/transportAlerts'
import { formatRelativeTime } from '../lib/labels'
import {
  fetchVerificationSummary,
  fetchVerificationQueue,
  fetchEntityDetail,
  fetchEvidence,
  fetchQualityChecks,
  fetchReviews,
  fetchRecordVersions,
  submitReview,
  updateVerificationStatus,
  addEvidence,
  entityLabel,
  type VerificationSummary,
  type QueueItem,
  type QueueFilter,
  type VerificationEvidenceRow,
  type DataQualityCheckRow,
  type DataVerificationReviewRow,
  type DataRecordVersionRow,
  type VerificationDecision,
} from '../lib/dataVerification'

const STATUS_COLORS: Record<string, string> = {
  official: 'bg-leaf-100 text-leaf-700',
  verified: 'bg-leaf-100 text-leaf-700',
  community: 'bg-terra-100 text-terra-700',
  estimated: 'bg-terra-100 text-terra-700',
  unverified: 'bg-terra-100 text-terra-700',
  pending_review: 'bg-ocean-100 text-ocean-700',
  pending: 'bg-ocean-100 text-ocean-700',
  under_review: 'bg-ocean-100 text-ocean-700',
  needs_more_information: 'bg-terra-100 text-terra-700',
  needs_more_info: 'bg-terra-100 text-terra-700',
  rejected: 'bg-red-100 text-red-700',
  archived: 'bg-sand-200 text-sand-800',
  approved: 'bg-leaf-100 text-leaf-700',
  disputed: 'bg-terra-100 text-terra-700',
}

function statusBadge(status: string): string {
  return STATUS_COLORS[status] ?? 'bg-sand-100 text-sand-700'
}

const ENTITY_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'route', label: 'Routes' },
  { value: 'fare', label: 'Fares' },
  { value: 'location', label: 'Locations' },
  { value: 'destination', label: 'Destinations' },
  { value: 'cultural_event', label: 'Events' },
  { value: 'transport_operator', label: 'Operators' },
  { value: 'transport_alert', label: 'Alerts' },
  { value: 'emergency_contact', label: 'Emergency' },
]

const MUNICIPALITIES = ['', 'Boac', 'Buenavista', 'Gasan', 'Mogpog', 'Santa Cruz', 'Torrijos']

export function DataVerificationDashboardPage() {
  const { user } = useAuth()
  const [adminCheck, setAdminCheck] = useState<boolean | null>(null)
  const [summary, setSummary] = useState<VerificationSummary | null>(null)
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [queueTotal, setQueueTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [filter, setFilter] = useState<QueueFilter>({})
  const [searchInput, setSearchInput] = useState('')
  const [selectedItem, setSelectedItem] = useState<QueueItem | null>(null)

  const loadAll = useCallback(async (p: number, f: QueueFilter) => {
    setLoading(true)
    const [s, q] = await Promise.all([
      fetchVerificationSummary(),
      fetchVerificationQueue(f, p, 25),
    ])
    setSummary(s)
    setQueue(q.items)
    setQueueTotal(q.total)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }
    void (async () => {
      const isAdmin = await isAlertAdmin()
      setAdminCheck(isAdmin)
      if (isAdmin) {
        await loadAll(page, filter)
      } else {
        setLoading(false)
      }
    })()
  }, [user, page, filter, loadAll])

  function applySearch() {
    setFilter((f) => ({ ...f, search: searchInput.trim() || undefined }))
    setPage(1)
  }

  function updateFilter(key: keyof QueueFilter, value: string) {
    setFilter((f) => ({ ...f, [key]: value || undefined }))
    setPage(1)
  }

  if (!user || adminCheck === false) {
    return (
      <div className="app-shell">
        <Header />
        <main className="flex-1 px-4 py-6">
          <div className="card text-center space-y-3">
            <ShieldCheck size={28} className="mx-auto text-ocean-400" />
            <p className="text-sm font-semibold text-ocean-900">
              {user ? 'Admin access required.' : 'Sign in to access verification.'}
            </p>
            {!user && <Link to="/auth" className="btn-primary">Sign In</Link>}
          </div>
        </main>
      </div>
    )
  }

  const summaryCards = summary ? [
    { label: 'Awaiting Verification', value: summary.totalPending, icon: Clock, color: 'text-terra-700 bg-terra-50' },
    { label: 'Newly Submitted', value: summary.newlySubmitted, icon: AlertCircle, color: 'text-ocean-700 bg-ocean-50' },
    { label: 'Under Review', value: summary.underReview, icon: ClipboardCheck, color: 'text-ocean-700 bg-ocean-50' },
    { label: 'Needs More Info', value: summary.needsMoreInfo, icon: FileWarning, color: 'text-terra-700 bg-terra-50' },
    { label: 'Verified', value: summary.verified, icon: CheckCircle2, color: 'text-leaf-700 bg-leaf-50' },
    { label: 'Rejected', value: summary.rejected, icon: XCircle, color: 'text-red-700 bg-red-50' },
    { label: 'Published Needs Review', value: summary.publishedNeedsReview, icon: AlertTriangle, color: 'text-terra-700 bg-terra-50' },
    { label: 'Expired', value: summary.expired, icon: Clock, color: 'text-sand-700 bg-sand-100' },
    { label: 'Conflicting', value: summary.conflicting, icon: AlertTriangle, color: 'text-terra-700 bg-terra-50' },
    { label: 'Missing Info', value: summary.missingInfo, icon: FileWarning, color: 'text-terra-700 bg-terra-50' },
  ] : []

  const totalPages = Math.ceil(queueTotal / 25)

  return (
    <div className="app-shell">
      <Header />
      <main className="flex-1 space-y-4 px-4 py-5">
        {/* Summary cards */}
        <section>
          <h2 className="mb-2 text-sm font-bold text-ocean-900">Verification Overview</h2>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-5">
            {summaryCards.map((card) => {
              const Icon = card.icon
              return (
                <div key={card.label} className="card flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className={`grid h-8 w-8 place-items-center rounded-full ${card.color}`}>
                      <Icon size={14} />
                    </span>
                    <span className="text-lg font-bold text-ocean-900">{card.value}</span>
                  </div>
                  <p className="text-[10px] font-medium text-ocean-600">{card.label}</p>
                </div>
              )
            })}
          </div>
        </section>

        {/* Filters */}
        <section className="card space-y-3">
          <div className="flex items-center gap-2">
            <Search size={16} className="text-ocean-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && applySearch()}
              placeholder="Search records…"
              className="input-field flex-1 py-1.5 text-sm"
            />
            <button type="button" onClick={applySearch} className="btn-primary py-1.5 text-xs">
              Search
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              value={filter.entityType ?? ''}
              onChange={(e) => updateFilter('entityType', e.target.value)}
              className="input-field max-w-[140px] py-1.5 text-xs"
            >
              {ENTITY_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <select
              value={filter.municipality ?? ''}
              onChange={(e) => updateFilter('municipality', e.target.value)}
              className="input-field max-w-[140px] py-1.5 text-xs"
            >
              {MUNICIPALITIES.map((m) => (
                <option key={m} value={m}>{m || 'All Municipalities'}</option>
              ))}
            </select>
          </div>
        </section>

        {/* Review queue */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-ocean-900">Review Queue</h2>
            <p className="text-xs text-ocean-600">{queueTotal} records</p>
          </div>

          {loading ? (
            <div className="card flex items-center gap-3">
              <Loader2 size={20} className="animate-spin text-ocean-600" />
              <p className="text-sm text-ocean-700">Loading queue…</p>
            </div>
          ) : queue.length === 0 ? (
            <div className="card text-center">
              <CheckCircle2 size={28} className="mx-auto text-leaf-400" />
              <p className="mt-2 text-sm text-ocean-600">No records awaiting verification.</p>
            </div>
          ) : (
            <div className="card divide-y divide-ocean-50">
              {queue.map((item) => (
                <button
                  key={`${item.entity_type}-${item.id}`}
                  type="button"
                  onClick={() => setSelectedItem(item)}
                  className="flex w-full items-start justify-between gap-2 py-2.5 text-left hover:bg-ocean-25 transition"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ocean-900 truncate">{item.title}</p>
                    <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                      <span className="text-[10px] text-ocean-500">{entityLabel(item.entity_type)}</span>
                      {item.municipality && (
                        <span className="text-[10px] text-ocean-500">• {item.municipality}</span>
                      )}
                      {item.subtitle && (
                        <span className="text-[10px] text-ocean-500">• {item.subtitle}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusBadge(item.verification_status)}`}>
                      {item.verification_status.replace(/_/g, ' ')}
                    </span>
                    <span className="text-[10px] text-ocean-400">{formatRelativeTime(item.updated_at)}</span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="grid h-8 w-8 place-items-center rounded-full bg-ocean-50 text-ocean-700 disabled:opacity-30"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-xs text-ocean-600">Page {page} of {totalPages}</span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="grid h-8 w-8 place-items-center rounded-full bg-ocean-50 text-ocean-700 disabled:opacity-30"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </section>
      </main>

      {/* Detail drawer */}
      {selectedItem && (
        <DetailDrawer
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </div>
  )
}

// ---- Detail Drawer ---------------------------------------------------------

function DetailDrawer({ item, onClose }: { item: QueueItem; onClose: () => void }) {
  const [tab, setTab] = useState<'detail' | 'evidence' | 'checks' | 'reviews' | 'versions'>('detail')
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null)
  const [evidence, setEvidence] = useState<VerificationEvidenceRow[]>([])
  const [checks, setChecks] = useState<DataQualityCheckRow[]>([])
  const [reviews, setReviews] = useState<DataVerificationReviewRow[]>([])
  const [versions, setVersions] = useState<DataRecordVersionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [reviewNotes, setReviewNotes] = useState('')
  const [rejectionReason, setRejectionReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null)

  // Add evidence form state
  const [evSource, setEvSource] = useState('community_submission')
  const [evTitle, setEvTitle] = useState('')
  const [evUrl, setEvUrl] = useState('')
  const [evOrg, setEvOrg] = useState('')
  const [evDesc, setEvDesc] = useState('')
  const [evSubmitting, setEvSubmitting] = useState(false)

  useEffect(() => {
    void (async () => {
      setLoading(true)
      const [d, ev, ch, rv, vn] = await Promise.all([
        fetchEntityDetail(item.entity_type, item.entity_id),
        fetchEvidence(item.entity_type, item.entity_id),
        fetchQualityChecks(item.entity_type, item.entity_id),
        fetchReviews(item.entity_type, item.entity_id),
        fetchRecordVersions(item.entity_type, item.entity_id),
      ])
      setDetail(d)
      setEvidence(ev)
      setChecks(ch)
      setReviews(rv)
      setVersions(vn)
      setLoading(false)
    })()
  }, [item.entity_type, item.entity_id])

  async function handleDecision(decision: VerificationDecision) {
    if (decision === 'rejected' && !rejectionReason.trim()) {
      setFeedback({ ok: false, msg: 'A rejection reason is required.' })
      return
    }

    setSubmitting(true)
    setFeedback(null)

    const newStatus = decision === 'verified' ? 'verified' : decision === 'rejected' ? 'rejected' : item.verification_status

    const reviewResult = await submitReview(
      item.entity_type,
      item.entity_id,
      decision,
      reviewNotes.trim() || undefined,
      decision === 'rejected' ? rejectionReason.trim() : undefined,
      item.verification_status,
      newStatus,
    )

    if (!reviewResult.ok) {
      setFeedback({ ok: false, msg: reviewResult.error ?? 'Failed to record review.' })
      setSubmitting(false)
      return
    }

    if (decision === 'verified' || decision === 'rejected') {
      const statusResult = await updateVerificationStatus(item.entity_type, item.entity_id, newStatus)
      if (!statusResult.ok) {
        setFeedback({ ok: false, msg: `Review recorded, but status update failed: ${statusResult.error}` })
        setSubmitting(false)
        return
      }
    }

    setFeedback({ ok: true, msg: `Review recorded: ${decision.replace(/_/g, ' ')}` })
    setSubmitting(false)

    // Refresh reviews
    const rv = await fetchReviews(item.entity_type, item.entity_id)
    setReviews(rv)
  }

  async function handleAddEvidence() {
    if (!evTitle.trim()) {
      setFeedback({ ok: false, msg: 'Source title is required.' })
      return
    }
    setEvSubmitting(true)
    setFeedback(null)
    const result = await addEvidence(
      item.entity_type,
      item.entity_id,
      evSource,
      evTitle.trim(),
      evUrl.trim() || undefined,
      evOrg.trim() || undefined,
      evDesc.trim() || undefined,
    )
    if (result.ok) {
      setEvTitle('')
      setEvUrl('')
      setEvOrg('')
      setEvDesc('')
      const ev = await fetchEvidence(item.entity_type, item.entity_id)
      setEvidence(ev)
      setFeedback({ ok: true, msg: 'Evidence added.' })
    } else {
      setFeedback({ ok: false, msg: result.error ?? 'Failed to add evidence.' })
    }
    setEvSubmitting(false)
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />
      <div className="fixed right-0 top-0 z-50 h-full w-full max-w-md overflow-y-auto bg-sand-50 shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between bg-ocean-900 px-4 py-3 text-white">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-ocean-200">{entityLabel(item.entity_type)}</p>
            <h3 className="truncate text-sm font-bold">{item.title}</h3>
          </div>
          <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full bg-ocean-800 hover:bg-ocean-700">
            <X size={16} />
          </button>
        </div>

        {/* Feedback */}
        {feedback && (
          <div className={`mx-4 mt-3 rounded-xl px-3 py-2 text-xs font-medium ${feedback.ok ? 'bg-leaf-100 text-leaf-700' : 'bg-red-100 text-red-700'}`}>
            {feedback.msg}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 border-b border-ocean-100 px-4 pt-3">
          {([
            ['detail', 'Detail'],
            ['evidence', 'Evidence'],
            ['checks', 'Checks'],
            ['reviews', 'Reviews'],
            ['versions', 'Versions'],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`rounded-t-lg px-3 py-1.5 text-xs font-semibold transition ${
                tab === key ? 'bg-white text-ocean-900 border-b-2 border-ocean-600' : 'text-ocean-500 hover:text-ocean-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="px-4 py-4">
          {loading ? (
            <div className="flex items-center gap-2">
              <Loader2 size={16} className="animate-spin text-ocean-600" />
              <p className="text-xs text-ocean-600">Loading…</p>
            </div>
          ) : tab === 'detail' ? (
            <DetailTab detail={detail} item={item} />
          ) : tab === 'evidence' ? (
            <EvidenceTab
              evidence={evidence}
              evSource={evSource}
              setEvSource={setEvSource}
              evTitle={evTitle}
              setEvTitle={setEvTitle}
              evUrl={evUrl}
              setEvUrl={setEvUrl}
              evOrg={evOrg}
              setEvOrg={setEvOrg}
              evDesc={evDesc}
              setEvDesc={setEvDesc}
              onAdd={handleAddEvidence}
              submitting={evSubmitting}
            />
          ) : tab === 'checks' ? (
            <ChecksTab checks={checks} />
          ) : tab === 'reviews' ? (
            <ReviewsTab
              reviews={reviews}
              notes={reviewNotes}
              setNotes={setReviewNotes}
              rejectionReason={rejectionReason}
              setRejectionReason={setRejectionReason}
              onDecision={handleDecision}
              submitting={submitting}
            />
          ) : (
            <VersionsTab versions={versions} />
          )}
        </div>
      </div>
    </>
  )
}

function DetailTab({ detail, item }: { detail: Record<string, unknown> | null; item: QueueItem }) {
  if (!detail) {
    return <p className="text-xs text-ocean-600">No detail available for this record.</p>
  }
  const displayKeys = Object.keys(detail).filter(
    (k) => !['id', 'geometry_data', 'coverage_geojson', 'boundary_geojson', 'journey_snapshot', 'fare_snapshot', 'opening_hours', 'amenities', 'accessibility_information', 'proposed_data', 'snapshot_data'].includes(k)
  )
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusBadge(item.verification_status)}`}>
          {item.verification_status.replace(/_/g, ' ')}
        </span>
        {item.municipality && <span className="text-[10px] text-ocean-500">{item.municipality}</span>}
      </div>
      <div className="card space-y-1.5">
        {displayKeys.map((key) => {
          const val = detail[key]
          if (val === null || val === undefined) return null
          let display: string
          if (typeof val === 'boolean') display = val ? 'Yes' : 'No'
          else if (typeof val === 'object') display = JSON.stringify(val).slice(0, 100)
          else display = String(val)
          if (display.length > 120) display = display.slice(0, 120) + '…'
          if (key.includes('_at') || key.includes('_date')) {
            try { display = new Date(display).toLocaleDateString() } catch { /* keep */ }
          }
          return (
            <div key={key} className="flex justify-between gap-2 text-xs">
              <span className="text-ocean-500 capitalize">{key.replace(/_/g, ' ')}</span>
              <span className="text-ocean-800 text-right">{display}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function EvidenceTab({
  evidence,
  evSource,
  setEvSource,
  evTitle,
  setEvTitle,
  evUrl,
  setEvUrl,
  evOrg,
  setEvOrg,
  evDesc,
  setEvDesc,
  onAdd,
  submitting,
}: {
  evidence: VerificationEvidenceRow[]
  evSource: string
  setEvSource: (v: string) => void
  evTitle: string
  setEvTitle: (v: string) => void
  evUrl: string
  setEvUrl: (v: string) => void
  evOrg: string
  setEvOrg: (v: string) => void
  evDesc: string
  setEvDesc: (v: string) => void
  onAdd: () => void
  submitting: boolean
}) {
  const sourceTypes = [
    { value: 'official_government', label: 'Official Government' },
    { value: 'authorized_operator', label: 'Authorized Operator' },
    { value: 'official_announcement', label: 'Official Announcement' },
    { value: 'published_fare_matrix', label: 'Published Fare Matrix' },
    { value: 'direct_confirmation', label: 'Direct Confirmation' },
    { value: 'field_observation', label: 'Field Observation' },
    { value: 'community_submission', label: 'Community Submission' },
    { value: 'other', label: 'Other' },
  ]

  return (
    <div className="space-y-3">
      {evidence.length === 0 ? (
        <p className="text-xs text-ocean-600">No evidence recorded yet.</p>
      ) : (
        <div className="space-y-2">
          {evidence.map((ev) => (
            <div key={ev.id} className="card space-y-1">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-ocean-900">{ev.source_title}</p>
                <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${statusBadge(ev.review_status)}`}>
                  {ev.review_status}
                </span>
              </div>
              <p className="text-[10px] text-ocean-500 capitalize">{ev.source_type.replace(/_/g, ' ')}</p>
              {ev.source_organization && <p className="text-[10px] text-ocean-600">{ev.source_organization}</p>}
              {ev.source_url && (
                <a href={ev.source_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-ocean-600 underline break-all">
                  {ev.source_url}
                </a>
              )}
              {ev.evidence_description && <p className="text-[10px] text-ocean-600">{ev.evidence_description}</p>}
              <p className="text-[10px] text-ocean-400">{formatRelativeTime(ev.created_at)}</p>
            </div>
          ))}
        </div>
      )}

      {/* Add evidence form */}
      <div className="card space-y-2 border-t-2 border-ocean-100 pt-3">
        <p className="text-xs font-bold text-ocean-900">Add Evidence</p>
        <select value={evSource} onChange={(e) => setEvSource(e.target.value)} className="input-field py-1.5 text-xs">
          {sourceTypes.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <input type="text" value={evTitle} onChange={(e) => setEvTitle(e.target.value)} placeholder="Source title" className="input-field py-1.5 text-xs" />
        <input type="url" value={evUrl} onChange={(e) => setEvUrl(e.target.value)} placeholder="Source URL (optional)" className="input-field py-1.5 text-xs" />
        <input type="text" value={evOrg} onChange={(e) => setEvOrg(e.target.value)} placeholder="Organization (optional)" className="input-field py-1.5 text-xs" />
        <textarea value={evDesc} onChange={(e) => setEvDesc(e.target.value)} placeholder="Description (optional)" rows={2} className="input-field py-1.5 text-xs" />
        <button type="button" onClick={onAdd} disabled={submitting} className="btn-primary w-full py-1.5 text-xs disabled:opacity-50">
          {submitting ? 'Adding…' : 'Add Evidence'}
        </button>
      </div>
    </div>
  )
}

function ChecksTab({ checks }: { checks: DataQualityCheckRow[] }) {
  if (checks.length === 0) {
    return (
      <div className="text-center space-y-1">
        <FileText size={24} className="mx-auto text-ocean-300" />
        <p className="text-xs text-ocean-600">No automated checks have been run yet.</p>
        <p className="text-[10px] text-ocean-500">Quality checks run when records are submitted or updated.</p>
      </div>
    )
  }
  return (
    <div className="space-y-2">
      {checks.map((check) => {
        const Icon = check.result === 'pass' ? CheckCircle2 : check.result === 'warning' ? AlertTriangle : XCircle
        const color = check.result === 'pass' ? 'text-leaf-600' : check.result === 'warning' ? 'text-terra-600' : 'text-red-600'
        return (
          <div key={check.id} className="card flex items-start gap-2">
            <Icon size={14} className={`mt-0.5 shrink-0 ${color}`} />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-ocean-900">{check.check_name.replace(/_/g, ' ')}</p>
              <p className="text-[10px] text-ocean-500 capitalize">{check.check_category}</p>
              {check.explanation && <p className="text-[10px] text-ocean-600 mt-0.5">{check.explanation}</p>}
              <p className="text-[10px] text-ocean-400 mt-0.5">{formatRelativeTime(check.evaluated_at)}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ReviewsTab({
  reviews,
  notes,
  setNotes,
  rejectionReason,
  setRejectionReason,
  onDecision,
  submitting,
}: {
  reviews: DataVerificationReviewRow[]
  notes: string
  setNotes: (v: string) => void
  rejectionReason: string
  setRejectionReason: (v: string) => void
  onDecision: (d: VerificationDecision) => void
  submitting: boolean
}) {
  return (
    <div className="space-y-3">
      {/* Existing reviews */}
      {reviews.length === 0 ? (
        <p className="text-xs text-ocean-600">No reviews recorded yet.</p>
      ) : (
        <div className="space-y-2">
          {reviews.map((rv) => (
            <div key={rv.id} className="card space-y-1">
              <div className="flex items-center justify-between">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusBadge(rv.decision)}`}>
                  {rv.decision.replace(/_/g, ' ')}
                </span>
                <span className="text-[10px] text-ocean-400">{formatRelativeTime(rv.created_at)}</span>
              </div>
              {rv.notes && <p className="text-[10px] text-ocean-600">{rv.notes}</p>}
              {rv.rejection_reason && <p className="text-[10px] text-red-600">Reason: {rv.rejection_reason}</p>}
              {rv.previous_verification_status && rv.new_verification_status && (
                <p className="text-[10px] text-ocean-500">
                  {rv.previous_verification_status} → {rv.new_verification_status}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* New review form */}
      <div className="card space-y-2 border-t-2 border-ocean-100 pt-3">
        <p className="text-xs font-bold text-ocean-900">Record Review Decision</p>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Internal review notes" rows={2} className="input-field py-1.5 text-xs" />
        <textarea value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} placeholder="Rejection reason (required if rejecting)" rows={2} className="input-field py-1.5 text-xs" />
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => onDecision('verified')} disabled={submitting} className="btn-primary py-1.5 text-xs disabled:opacity-50">
            <CheckCircle2 size={12} className="inline mr-1" /> Verify
          </button>
          <button type="button" onClick={() => onDecision('rejected')} disabled={submitting} className="rounded-xl bg-red-600 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
            <XCircle size={12} className="inline mr-1" /> Reject
          </button>
          <button type="button" onClick={() => onDecision('under_review')} disabled={submitting} className="rounded-xl bg-ocean-100 py-1.5 text-xs font-semibold text-ocean-700 disabled:opacity-50">
            <Clock size={12} className="inline mr-1" /> Under Review
          </button>
          <button type="button" onClick={() => onDecision('needs_more_info')} disabled={submitting} className="rounded-xl bg-terra-100 py-1.5 text-xs font-semibold text-terra-700 disabled:opacity-50">
            <FileWarning size={12} className="inline mr-1" /> Need Info
          </button>
          <button type="button" onClick={() => onDecision('disputed')} disabled={submitting} className="rounded-xl bg-terra-100 py-1.5 text-xs font-semibold text-terra-700 disabled:opacity-50">
            <AlertTriangle size={12} className="inline mr-1" /> Disputed
          </button>
        </div>
      </div>
    </div>
  )
}

function VersionsTab({ versions }: { versions: DataRecordVersionRow[] }) {
  if (versions.length === 0) {
    return (
      <div className="text-center space-y-1">
        <History size={24} className="mx-auto text-ocean-300" />
        <p className="text-xs text-ocean-600">No version history recorded yet.</p>
        <p className="text-[10px] text-ocean-500">Snapshots are saved when records are published.</p>
      </div>
    )
  }
  return (
    <div className="space-y-2">
      {versions.map((v) => (
        <div key={v.id} className="card space-y-1">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-ocean-900">Version {v.version_number}</p>
            <span className="text-[10px] text-ocean-400">{formatRelativeTime(v.published_at)}</span>
          </div>
          {v.superseded_at && <p className="text-[10px] text-ocean-500">Superseded {formatRelativeTime(v.superseded_at)}</p>}
          <details className="mt-1">
            <summary className="text-[10px] text-ocean-600 cursor-pointer">View snapshot</summary>
            <pre className="mt-1 text-[10px] text-ocean-700 overflow-x-auto bg-ocean-25 p-2 rounded">
              {JSON.stringify(v.snapshot_data, null, 2)}
            </pre>
          </details>
        </div>
      ))}
    </div>
  )
}

function Header() {
  return (
    <header className="sticky top-0 z-30 bg-ocean-900 text-white shadow-card">
      <div className="flex items-center gap-3 px-4 py-4">
        <Link to="/admin" className="grid h-9 w-9 place-items-center rounded-full bg-ocean-800 hover:bg-ocean-700">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="flex items-center gap-2 text-lg font-bold">
          <ShieldCheck size={18} />
          Data Verification
        </h1>
      </div>
    </header>
  )
}
