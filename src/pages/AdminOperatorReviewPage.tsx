import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  ShieldCheck,
  Building2,
  ClipboardList,
  Check,
  X,
  MessageSquare,
  Clock,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { useAuth } from '../lib/auth'
import { isAlertAdmin } from '../lib/transportAlerts'
import {
  fetchAllOperators,
  fetchAllSubmissions,
  fetchAllAuditLogs,
  adminUpdateOperatorStatus,
  adminReviewSubmission,
  OPERATOR_STATUS_LABELS,
  SUBMISSION_STATUS_LABELS,
  SUBMISSION_TYPE_LABELS,
  operatorStatusColor,
  submissionStatusColor,
} from '../lib/operatorPortal'
import { formatRelativeTime } from '../lib/labels'
import type {
  TransportOperatorWithMode,
  TransportServiceSubmissionWithDetails,
  TransportOperatorAuditLogRow,
  TransportOperatorVerificationStatus,
  TransportSubmissionStatus,
} from '../lib/types'

type Tab = 'operators' | 'submissions' | 'audit'

export function AdminOperatorReviewPage() {
  const { user } = useAuth()
  const [adminCheck, setAdminCheck] = useState<boolean | null>(null)
  const [operators, setOperators] = useState<TransportOperatorWithMode[]>([])
  const [submissions, setSubmissions] = useState<TransportServiceSubmissionWithDetails[]>([])
  const [auditLogs, setAuditLogs] = useState<TransportOperatorAuditLogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('operators')
  const [expandedOp, setExpandedOp] = useState<string | null>(null)
  const [expandedSub, setExpandedSub] = useState<string | null>(null)
  const [reviewingId, setReviewingId] = useState<string | null>(null)
  const [reviewStatus, setReviewStatus] = useState<TransportSubmissionStatus>('under_review')
  const [reviewFeedback, setReviewFeedback] = useState('')
  const [opStatus, setOpStatus] = useState<TransportOperatorVerificationStatus>('approved')
  const [opNotes, setOpNotes] = useState('')
  const [actingOpId, setActingOpId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }
    void (async () => {
      const isAdmin = await isAlertAdmin()
      setAdminCheck(isAdmin)
      if (!isAdmin) {
        setLoading(false)
        return
      }
      const [ops, subs, logs] = await Promise.all([
        fetchAllOperators(),
        fetchAllSubmissions(),
        fetchAllAuditLogs(),
      ])
      setOperators(ops)
      setSubmissions(subs)
      setAuditLogs(logs)
      setLoading(false)
    })()
  }, [user])

  const pendingOperators = useMemo(
    () => operators.filter((o) => o.verification_status === 'pending_review' || o.verification_status === 'needs_more_information'),
    [operators],
  )
  const pendingSubmissions = useMemo(
    () => submissions.filter((s) => s.status === 'pending_review' || s.status === 'under_review' || s.status === 'needs_more_information'),
    [submissions],
  )

  if (!user) {
    return (
      <div className="app-shell">
        <Header />
        <main className="flex-1 px-4 py-6">
          <div className="card text-center">
            <p className="text-sm font-semibold text-ocean-900">Sign in to access the admin dashboard.</p>
            <Link to="/auth" className="btn-primary mt-3">Sign In</Link>
          </div>
        </main>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="app-shell">
        <Header />
        <main className="flex-1 px-4 py-6">
          <div className="card flex items-center gap-3">
            <Loader2 size={20} className="animate-spin text-ocean-600" />
            <p className="text-sm text-ocean-700">Loading admin dashboard…</p>
          </div>
        </main>
      </div>
    )
  }

  if (adminCheck === false) {
    return (
      <div className="app-shell">
        <Header />
        <main className="flex-1 px-4 py-6">
          <div className="card text-center space-y-3">
            <ShieldCheck size={28} className="mx-auto text-ocean-400" />
            <p className="text-sm font-semibold text-ocean-900">Admin access required.</p>
            <p className="text-xs text-ocean-600">You need community reviewer privileges to access this page.</p>
            <Link to="/profile" className="btn-secondary">Back to Profile</Link>
          </div>
        </main>
      </div>
    )
  }

  const handleReviewSubmission = async (subId: string) => {
    setBusy(true)
    setError(null)
    const result = await adminReviewSubmission(subId, reviewStatus, reviewFeedback)
    if (!result.success) {
      setError(result.error || 'Failed to review submission.')
      setBusy(false)
      return
    }
    setReviewingId(null)
    setReviewFeedback('')
    const subs = await fetchAllSubmissions()
    setSubmissions(subs)
    const logs = await fetchAllAuditLogs()
    setAuditLogs(logs)
    setBusy(false)
  }

  const handleUpdateOperator = async (opId: string) => {
    setBusy(true)
    setError(null)
    const result = await adminUpdateOperatorStatus(opId, opStatus, opNotes)
    if (!result.success) {
      setError(result.error || 'Failed to update operator.')
      setBusy(false)
      return
    }
    setActingOpId(null)
    setOpNotes('')
    const ops = await fetchAllOperators()
    setOperators(ops)
    const logs = await fetchAllAuditLogs()
    setAuditLogs(logs)
    setBusy(false)
  }

  return (
    <div className="app-shell">
      <Header />
      <main className="flex-1 space-y-4 px-4 py-5">
        {/* Summary cards */}
        <section className="grid grid-cols-2 gap-2">
          <div className="card text-center">
            <p className="text-lg font-bold text-ocean-900">{pendingOperators.length}</p>
            <p className="text-[10px] text-ocean-600">Pending Operators</p>
          </div>
          <div className="card text-center">
            <p className="text-lg font-bold text-ocean-900">{pendingSubmissions.length}</p>
            <p className="text-[10px] text-ocean-600">Pending Submissions</p>
          </div>
        </section>

        {/* Tabs */}
        <div className="flex gap-2">
          {(['operators', 'submissions', 'audit'] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`flex-1 rounded-xl px-3 py-2 text-xs font-semibold capitalize transition ${
                tab === t ? 'bg-ocean-600 text-white' : 'bg-ocean-50 text-ocean-600'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-xs text-red-700">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {/* Operators tab */}
        {tab === 'operators' && (
          <section className="space-y-2">
            {operators.length === 0 ? (
              <div className="card text-center">
                <Building2 size={28} className="mx-auto text-ocean-300" />
                <p className="mt-2 text-sm text-ocean-600">No operator applications.</p>
              </div>
            ) : (
              operators.map((op) => (
                <div key={op.id} className="card space-y-2">
                  <button
                    type="button"
                    onClick={() => setExpandedOp(expandedOp === op.id ? null : op.id)}
                    className="flex w-full items-start justify-between gap-2 text-left"
                  >
                    <div>
                      <p className="text-sm font-semibold text-ocean-900">{op.organization_name}</p>
                      <p className="text-xs text-ocean-600">{op.contact_name} • {op.service_category}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`pill text-[10px] ${operatorStatusColor(op.verification_status)}`}>
                        {OPERATOR_STATUS_LABELS[op.verification_status]}
                      </span>
                      {expandedOp === op.id ? <ChevronUp size={14} className="text-ocean-400" /> : <ChevronDown size={14} className="text-ocean-400" />}
                    </div>
                  </button>

                  {expandedOp === op.id && (
                    <div className="space-y-3 border-t border-ocean-100 pt-3">
                      <dl className="space-y-1 text-xs">
                        <div className="flex justify-between">
                          <dt className="text-ocean-600">Email:</dt>
                          <dd className="text-ocean-900">{op.contact_email}</dd>
                        </div>
                        {op.contact_phone && (
                          <div className="flex justify-between">
                            <dt className="text-ocean-600">Phone:</dt>
                            <dd className="text-ocean-900">{op.contact_phone}</dd>
                          </div>
                        )}
                        {op.municipality && (
                          <div className="flex justify-between">
                            <dt className="text-ocean-600">Municipality:</dt>
                            <dd className="text-ocean-900">{op.municipality}</dd>
                          </div>
                        )}
                        {op.transport_mode && (
                          <div className="flex justify-between">
                            <dt className="text-ocean-600">Mode:</dt>
                            <dd className="text-ocean-900">{op.transport_mode.name}</dd>
                          </div>
                        )}
                        {op.supporting_info && (
                          <div>
                            <dt className="text-ocean-600">Info:</dt>
                            <dd className="mt-1 text-ocean-700">{op.supporting_info}</dd>
                          </div>
                        )}
                        {op.reviewer_notes && (
                          <div>
                            <dt className="text-ocean-600">Previous notes:</dt>
                            <dd className="mt-1 text-ocean-700">{op.reviewer_notes}</dd>
                          </div>
                        )}
                      </dl>

                      {actingOpId === op.id ? (
                        <div className="space-y-2 rounded-xl bg-ocean-50 p-3">
                          <label className="form-label">New Status</label>
                          <select
                            value={opStatus}
                            onChange={(e) => setOpStatus(e.target.value as TransportOperatorVerificationStatus)}
                            className="input-field"
                          >
                            <option value="approved">Approve</option>
                            <option value="needs_more_information">Request More Info</option>
                            <option value="rejected">Reject</option>
                            <option value="suspended">Suspend</option>
                          </select>
                          <label className="form-label">Reviewer Notes</label>
                          <textarea
                            value={opNotes}
                            onChange={(e) => setOpNotes(e.target.value)}
                            rows={2}
                            className="input-field"
                            placeholder="Notes for the operator…"
                          />
                          <div className="flex gap-2">
                            <button type="button" onClick={() => handleUpdateOperator(op.id)} disabled={busy} className="btn-primary flex-1">
                              {busy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                              Submit
                            </button>
                            <button type="button" onClick={() => setActingOpId(null)} className="btn-secondary flex-1">
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setActingOpId(op.id)
                            setOpStatus(op.verification_status === 'approved' ? 'approved' : 'approved')
                            setOpNotes(op.reviewer_notes || '')
                          }}
                          className="btn-secondary w-full"
                        >
                          <ShieldCheck size={16} /> Review / Update Status
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </section>
        )}

        {/* Submissions tab */}
        {tab === 'submissions' && (
          <section className="space-y-2">
            {submissions.length === 0 ? (
              <div className="card text-center">
                <ClipboardList size={28} className="mx-auto text-ocean-300" />
                <p className="mt-2 text-sm text-ocean-600">No submissions.</p>
              </div>
            ) : (
              submissions.map((sub) => (
                <div key={sub.id} className="card space-y-2">
                  <button
                    type="button"
                    onClick={() => setExpandedSub(expandedSub === sub.id ? null : sub.id)}
                    className="flex w-full items-start justify-between gap-2 text-left"
                  >
                    <div>
                      <p className="text-sm font-semibold text-ocean-900">
                        {SUBMISSION_TYPE_LABELS[sub.submission_type]}
                      </p>
                      <p className="text-xs text-ocean-600">
                        {sub.operator?.organization_name || 'Unknown operator'}
                      </p>
                      {sub.related_route && (
                        <p className="text-[10px] text-ocean-500">{sub.related_route.route_name}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`pill text-[10px] ${submissionStatusColor(sub.status)}`}>
                        {SUBMISSION_STATUS_LABELS[sub.status]}
                      </span>
                      {expandedSub === sub.id ? <ChevronUp size={14} className="text-ocean-400" /> : <ChevronDown size={14} className="text-ocean-400" />}
                    </div>
                  </button>

                  {expandedSub === sub.id && (
                    <div className="space-y-3 border-t border-ocean-100 pt-3">
                      <dl className="space-y-1 text-xs">
                        {Object.entries(sub.proposed_data as Record<string, unknown>).map(([key, value]) => (
                          <div key={key} className="flex justify-between gap-2">
                            <dt className="capitalize text-ocean-600">{key.replace(/_/g, ' ')}:</dt>
                            <dd className="text-right text-ocean-900 break-words">{String(value)}</dd>
                          </div>
                        ))}
                      </dl>
                      {sub.proposed_effective_date && (
                        <p className="text-xs text-ocean-600">
                          Effective: {new Date(sub.proposed_effective_date).toLocaleDateString()}
                        </p>
                      )}
                      {sub.supporting_notes && (
                        <p className="text-xs text-ocean-700">{sub.supporting_notes}</p>
                      )}
                      {sub.reviewer_feedback && (
                        <div className="rounded-lg bg-terra-50 p-2 text-xs text-terra-700">
                          <p className="font-semibold">Previous feedback:</p>
                          <p>{sub.reviewer_feedback}</p>
                        </div>
                      )}

                      {reviewingId === sub.id ? (
                        <div className="space-y-2 rounded-xl bg-ocean-50 p-3">
                          <label className="form-label">Decision</label>
                          <select
                            value={reviewStatus}
                            onChange={(e) => setReviewStatus(e.target.value as TransportSubmissionStatus)}
                            className="input-field"
                          >
                            <option value="under_review">Mark Under Review</option>
                            <option value="needs_more_information">Request More Info</option>
                            <option value="approved">Approve</option>
                            <option value="rejected">Reject</option>
                            <option value="published">Publish</option>
                          </select>
                          <label className="form-label">Feedback</label>
                          <textarea
                            value={reviewFeedback}
                            onChange={(e) => setReviewFeedback(e.target.value)}
                            rows={3}
                            className="input-field"
                            placeholder="Feedback for the operator…"
                          />
                          <div className="flex gap-2">
                            <button type="button" onClick={() => handleReviewSubmission(sub.id)} disabled={busy} className="btn-primary flex-1">
                              {busy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                              Submit Review
                            </button>
                            <button type="button" onClick={() => setReviewingId(null)} className="btn-secondary flex-1">
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setReviewingId(sub.id)
                            setReviewStatus('under_review')
                            setReviewFeedback(sub.reviewer_feedback || '')
                          }}
                          className="btn-secondary w-full"
                        >
                          <MessageSquare size={16} /> Review Submission
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </section>
        )}

        {/* Audit tab */}
        {tab === 'audit' && (
          <section className="space-y-2">
            {auditLogs.length === 0 ? (
              <div className="card text-center">
                <Clock size={28} className="mx-auto text-ocean-300" />
                <p className="mt-2 text-sm text-ocean-600">No audit activity yet.</p>
              </div>
            ) : (
              <div className="card divide-y divide-ocean-50">
                {auditLogs.slice(0, 50).map((log) => (
                  <div key={log.id} className="py-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2">
                        <span className={
                          log.new_status === 'approved' || log.new_status === 'published' ? 'text-leaf-600'
                            : log.new_status === 'rejected' ? 'text-red-500'
                            : 'text-ocean-400'
                        }>
                          {log.new_status === 'rejected' ? <X size={12} /> : <Check size={12} />}
                        </span>
                        <div>
                          <p className="text-xs font-medium text-ocean-800">{log.action.replace(/_/g, ' ')}</p>
                          {log.summary && <p className="text-[10px] text-ocean-600">{log.summary}</p>}
                        </div>
                      </div>
                      <p className="text-[10px] text-ocean-400">{formatRelativeTime(log.created_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  )
}

function Header() {
  return (
    <header className="sticky top-0 z-30 bg-ocean-800 text-white shadow-card">
      <div className="flex items-center gap-3 px-4 py-4">
        <Link to="/profile" className="grid h-9 w-9 place-items-center rounded-full bg-ocean-700 hover:bg-ocean-600">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-lg font-bold">Admin: Operator Review</h1>
      </div>
    </header>
  )
}
