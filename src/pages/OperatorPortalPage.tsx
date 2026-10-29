import { useEffect, useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Building2,
  ClipboardList,
  Clock,
  Plus,
  Loader2,
  Check,
  X,
  ShieldCheck,
} from 'lucide-react'
import { useAuth } from '../lib/auth'
import { isAlertAdmin } from '../lib/transportAlerts'
import {
  fetchMyOperator,
  fetchMySubmissions,
  fetchMyAuditLogs,
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
} from '../lib/types'

export function OperatorPortalPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [operator, setOperator] = useState<TransportOperatorWithMode | null>(null)
  const [submissions, setSubmissions] = useState<TransportServiceSubmissionWithDetails[]>([])
  const [auditLogs, setAuditLogs] = useState<TransportOperatorAuditLogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [op, adminStatus] = await Promise.all([fetchMyOperator(), isAlertAdmin()])
    setOperator(op)
    setIsAdmin(adminStatus)
    const subs = await fetchMySubmissions()
    setSubmissions(subs)
    if (op) {
      const logs = await fetchMyAuditLogs(op.id)
      setAuditLogs(logs)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }
    void load()
  }, [user, load])

  if (!user) {
    return (
      <div className="app-shell">
        <Header />
        <main className="flex-1 px-4 py-6">
          <div className="card flex flex-col items-center gap-4 text-center">
            <Building2 size={32} className="text-ocean-400" />
            <p className="text-sm font-semibold text-ocean-900">Sign in to access the Transport Partner Portal.</p>
            <Link to="/auth" className="btn-primary w-full">Sign In</Link>
          </div>
        </main>
      </div>
    )
  }

  const isApproved = operator?.verification_status === 'approved'
  const isSuspended = operator?.verification_status === 'suspended'

  const pendingCount = submissions.filter(
    (s) => s.status === 'pending_review' || s.status === 'under_review' || s.status === 'needs_more_information',
  ).length
  const approvedCount = submissions.filter((s) => s.status === 'approved' || s.status === 'published').length
  const rejectedCount = submissions.filter((s) => s.status === 'rejected').length

  return (
    <div className="app-shell">
      <Header />
      <main className="flex-1 space-y-4 px-4 py-5">
        {loading ? (
          <div className="card flex items-center gap-3">
            <Loader2 size={20} className="animate-spin text-ocean-600" />
            <p className="text-sm text-ocean-700">Loading portal…</p>
          </div>
        ) : !operator ? (
          <div className="card flex flex-col items-center gap-4 text-center">
            <Building2 size={32} className="text-ocean-400" />
            <p className="text-base font-bold text-ocean-900">No Operator Application</p>
            <p className="text-sm text-ocean-600">
              You haven't applied for portal access yet. Register as a transport partner to submit routes, fares, and service updates.
            </p>
            <button type="button" onClick={() => navigate('/operator/register')} className="btn-primary w-full">
              <Plus size={18} /> Register as Transport Partner
            </button>
          </div>
        ) : (
          <>
            {/* Operator card */}
            <section className="card space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-base font-bold text-ocean-900">{operator.organization_name}</p>
                  <p className="text-xs text-ocean-600">{operator.service_category}</p>
                  {operator.transport_mode && (
                    <p className="text-xs text-ocean-500">{operator.transport_mode.name}</p>
                  )}
                  {operator.municipality && (
                    <p className="text-xs text-ocean-500">{operator.municipality}</p>
                  )}
                </div>
                <span className={`pill text-xs ${operatorStatusColor(operator.verification_status)}`}>
                  {OPERATOR_STATUS_LABELS[operator.verification_status]}
                </span>
              </div>

              {operator.verification_status === 'needs_more_information' && operator.reviewer_notes && (
                <div className="rounded-xl bg-terra-50 p-3 text-xs text-terra-800">
                  <p className="font-semibold">Reviewer requests more information:</p>
                  <p className="mt-1">{operator.reviewer_notes}</p>
                  <button type="button" onClick={() => navigate('/operator/register')} className="mt-2 font-semibold underline">
                    Update your application
                  </button>
                </div>
              )}

              {isSuspended && (
                <div className="rounded-xl bg-red-50 p-3 text-xs text-red-800">
                  <p className="font-semibold">Your portal access is suspended.</p>
                  <p className="mt-1">Contact the administrator for more information.</p>
                </div>
              )}

              {operator.verified_at && (
                <p className="flex items-center gap-1 text-xs text-ocean-500">
                  <ShieldCheck size={12} />
                  Verified {formatRelativeTime(operator.verified_at)}
                </p>
              )}
            </section>

            {/* Submission stats */}
            <section className="grid grid-cols-3 gap-2">
              <div className="card text-center">
                <p className="text-lg font-bold text-ocean-900">{pendingCount}</p>
                <p className="text-[10px] text-ocean-600">Pending</p>
              </div>
              <div className="card text-center">
                <p className="text-lg font-bold text-leaf-700">{approvedCount}</p>
                <p className="text-[10px] text-ocean-600">Approved</p>
              </div>
              <div className="card text-center">
                <p className="text-lg font-bold text-red-600">{rejectedCount}</p>
                <p className="text-[10px] text-ocean-600">Rejected</p>
              </div>
            </section>

            {/* New submission button */}
            {isApproved && (
              <button
                type="button"
                onClick={() => navigate('/operator/new-submission')}
                className="btn-primary w-full"
              >
                <Plus size={18} /> New Submission
              </button>
            )}

            {/* My Submissions */}
            <section className="space-y-2">
              <h2 className="section-title">My Submissions</h2>
              {submissions.length === 0 ? (
                <div className="card text-center">
                  <ClipboardList size={28} className="mx-auto text-ocean-300" />
                  <p className="mt-2 text-sm text-ocean-600">No submissions yet.</p>
                </div>
              ) : (
                submissions.map((sub) => (
                  <Link
                    key={sub.id}
                    to={`/operator/submission/${sub.id}`}
                    className="card space-y-1.5 hover:shadow-cardHover transition active:scale-[0.98]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-ocean-900">
                        {SUBMISSION_TYPE_LABELS[sub.submission_type]}
                      </p>
                      <span className={`pill text-[10px] ${submissionStatusColor(sub.status)}`}>
                        {SUBMISSION_STATUS_LABELS[sub.status]}
                      </span>
                    </div>
                    {sub.related_route && (
                      <p className="text-xs text-ocean-600">{sub.related_route.route_name}</p>
                    )}
                    {sub.reviewer_feedback && (
                      <p className="text-[10px] text-terra-700 truncate">Feedback: {sub.reviewer_feedback}</p>
                    )}
                    <p className="flex items-center gap-1 text-[10px] text-ocean-400">
                      <Clock size={10} /> {formatRelativeTime(sub.updated_at)}
                    </p>
                  </Link>
                ))
              )}
            </section>

            {/* Recent audit activity */}
            {auditLogs.length > 0 && (
              <section className="space-y-2">
                <h2 className="section-title">Recent Activity</h2>
                <div className="card space-y-2">
                  {auditLogs.slice(0, 5).map((log) => (
                    <div key={log.id} className="flex items-start gap-2 text-xs text-ocean-700">
                      <span className={`mt-0.5 ${log.new_status === 'approved' || log.new_status === 'published' ? 'text-leaf-600' : 'text-ocean-400'}`}>
                        {log.new_status === 'rejected' ? <X size={12} /> : <Check size={12} />}
                      </span>
                      <div>
                        <p>{log.summary || log.action.replace(/_/g, ' ')}</p>
                        <p className="text-[10px] text-ocean-400">{formatRelativeTime(log.created_at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {!isApproved && !isSuspended && operator.verification_status !== 'rejected' && (
              <p className="text-center text-[10px] text-ocean-400">
                Your application is under review. You can submit service information once approved.
              </p>
            )}

            {isAdmin && (
              <Link to="/operator-portal/admin" className="card flex items-center gap-3 border border-leaf-200 bg-leaf-50 hover:shadow-cardHover transition active:scale-[0.98]">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-leaf-600 text-white">
                  <ShieldCheck size={18} />
                </span>
                <div>
                  <p className="text-sm font-semibold text-leaf-800">Admin Review Dashboard</p>
                  <p className="text-xs text-leaf-700">Review operator applications and service submissions</p>
                </div>
              </Link>
            )}
          </>
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
        <h1 className="text-lg font-bold">Transport Partner Portal</h1>
      </div>
    </header>
  )
}
