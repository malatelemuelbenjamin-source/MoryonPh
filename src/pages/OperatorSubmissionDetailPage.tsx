import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Loader2,
  Trash2,
  AlertCircle,
  Clock,
  User,
  MessageSquare,
  Save,
  Calendar,
} from 'lucide-react'
import { useAuth } from '../lib/auth'
import {
  fetchSubmissionById,
  updateSubmission,
  deleteSubmission,
  SUBMISSION_TYPE_LABELS,
  SUBMISSION_STATUS_LABELS,
  submissionStatusColor,
} from '../lib/operatorPortal'
import { formatRelativeTime } from '../lib/labels'
import type { TransportServiceSubmissionWithDetails } from '../lib/types'

export function OperatorSubmissionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [submission, setSubmission] = useState<TransportServiceSubmissionWithDetails | null | undefined>(undefined)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const [supportingNotes, setSupportingNotes] = useState('')

  const load = async () => {
    if (!id) return
    setLoading(true)
    const sub = await fetchSubmissionById(id)
    setSubmission(sub)
    if (sub) setSupportingNotes(sub.supporting_notes || '')
    setLoading(false)
  }

  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }
    void load()
  }, [user, id])

  if (!user) {
    return (
      <div className="app-shell">
        <Header />
        <main className="flex-1 px-4 py-6">
          <div className="card text-center">
            <p className="text-sm font-semibold text-ocean-900">Sign in to view this submission.</p>
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
            <p className="text-sm text-ocean-700">Loading…</p>
          </div>
        </main>
      </div>
    )
  }

  if (!submission) {
    return (
      <div className="app-shell">
        <Header />
        <main className="flex-1 px-4 py-6">
          <div className="card text-center space-y-3">
            <AlertCircle size={28} className="mx-auto text-ocean-400" />
            <p className="text-sm font-semibold text-ocean-900">Submission not found.</p>
            <Link to="/operator-portal" className="btn-secondary">Back to Portal</Link>
          </div>
        </main>
      </div>
    )
  }

  const canEdit = submission.status === 'pending_review' || submission.status === 'needs_more_information'
  const canDelete = canEdit
  const proposedData = submission.proposed_data as Record<string, unknown>

  const handleSave = async () => {
    if (!id) return
    setSaving(true)
    setError(null)
    const result = await updateSubmission(id, { supporting_notes: supportingNotes })
    if (!result.success) {
      setError(result.error || 'Failed to update notes.')
    } else {
      setEditing(false)
      void load()
    }
    setSaving(false)
  }

  const handleDelete = async () => {
    if (!id) return
    setDeleting(true)
    const result = await deleteSubmission(id)
    if (result.success) {
      navigate('/operator-portal')
    } else {
      setError(result.error || 'Failed to delete submission.')
    }
    setDeleting(false)
  }

  return (
    <div className="app-shell">
      <Header />
      <main className="flex-1 space-y-4 px-4 py-5">
        {/* Type + status header */}
        <section className="card space-y-2">
          <div className="flex items-start justify-between gap-2">
            <p className="text-base font-bold text-ocean-900">
              {SUBMISSION_TYPE_LABELS[submission.submission_type]}
            </p>
            <span className={`pill text-xs ${submissionStatusColor(submission.status)}`}>
              {SUBMISSION_STATUS_LABELS[submission.status]}
            </span>
          </div>
          {submission.related_route && (
            <p className="text-xs text-ocean-600">Route: {submission.related_route.route_name}</p>
          )}
          {submission.transport_mode && (
            <p className="text-xs text-ocean-500">{submission.transport_mode.name}</p>
          )}
          {submission.origin_location && submission.destination_location && (
            <p className="text-xs text-ocean-500">
              {submission.origin_location.name} → {submission.destination_location.name}
            </p>
          )}
          <p className="flex items-center gap-1 text-[10px] text-ocean-400">
            <Clock size={10} /> Submitted {formatRelativeTime(submission.created_at)}
          </p>
        </section>

        {/* Proposed data */}
        <section className="card space-y-2">
          <h2 className="section-title">Proposed Changes</h2>
          {Object.keys(proposedData).length === 0 ? (
            <p className="text-xs text-ocean-500">No detailed data provided.</p>
          ) : (
            <dl className="space-y-1.5">
              {Object.entries(proposedData).map(([key, value]) => (
                <div key={key} className="flex items-start justify-between gap-2">
                  <dt className="text-xs font-medium capitalize text-ocean-600">
                    {key.replace(/_/g, ' ')}:
                  </dt>
                  <dd className="text-right text-xs text-ocean-900 break-words">
                    {String(value)}
                  </dd>
                </div>
              ))}
            </dl>
          )}
          {submission.proposed_effective_date && (
            <p className="flex items-center gap-1 pt-1 text-xs text-ocean-600">
              <Calendar size={12} /> Effective: {new Date(submission.proposed_effective_date).toLocaleDateString()}
            </p>
          )}
        </section>

        {/* Reviewer feedback */}
        {submission.reviewer_feedback && (
          <section className="card space-y-2 bg-terra-50">
            <div className="flex items-center gap-2">
              <MessageSquare size={14} className="text-terra-600" />
              <h2 className="text-sm font-semibold text-terra-800">Reviewer Feedback</h2>
            </div>
            <p className="text-xs text-terra-700">{submission.reviewer_feedback}</p>
            {submission.reviewer && (
              <p className="flex items-center gap-1 text-[10px] text-terra-600">
                <User size={10} /> {submission.reviewer.name || submission.reviewer.email}
              </p>
            )}
          </section>
        )}

        {/* Supporting notes (editable) */}
        <section className="card space-y-2">
          <h2 className="section-title">Supporting Notes</h2>
          {editing ? (
            <>
              <textarea
                value={supportingNotes}
                onChange={(e) => setSupportingNotes(e.target.value)}
                rows={4}
                maxLength={4000}
                className="input-field"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="btn-primary flex-1"
                >
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditing(false)
                    setSupportingNotes(submission.supporting_notes || '')
                  }}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-xs text-ocean-700">
                {submission.supporting_notes || 'No supporting notes provided.'}
              </p>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="text-xs font-semibold text-ocean-600 underline"
                >
                  Edit notes
                </button>
              )}
            </>
          )}
        </section>

        {error && (
          <div className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-xs text-red-700">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {/* Delete */}
        {canDelete && !confirmDelete && (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="btn-secondary w-full text-red-600"
          >
            <Trash2 size={16} /> Delete Submission
          </button>
        )}
        {confirmDelete && (
          <div className="card space-y-3 border border-red-200">
            <p className="text-sm font-semibold text-red-700">Delete this submission?</p>
            <p className="text-xs text-ocean-600">This action cannot be undone.</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="btn-primary flex-1 bg-red-600 hover:bg-red-700"
              >
                {deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                Confirm Delete
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

function Header() {
  return (
    <header className="sticky top-0 z-30 bg-ocean-800 text-white shadow-card">
      <div className="flex items-center gap-3 px-4 py-4">
        <Link to="/operator-portal" className="grid h-9 w-9 place-items-center rounded-full bg-ocean-700 hover:bg-ocean-600">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-lg font-bold">Submission Details</h1>
      </div>
    </header>
  )
}
