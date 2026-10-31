import { useState } from 'react'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import {
  archiveBoundary,
  publishBoundary,
  reviewBoundary,
  type GeographicBoundary,
} from '../lib/geographicBoundaries'

const STATUS_TEXT = {
  draft: 'Draft (not shown on the globe)',
  published: 'Published (shown on the globe)',
  archived: 'Archived',
} as const

const VERIFICATION_TEXT = {
  unverified: 'Unverified',
  verified: 'Verified against the source',
  rejected: 'Rejected',
} as const

function formatDate(value: string | null): string {
  if (!value) return 'Not recorded'
  return new Date(value).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
}

export function GeographicBoundaryDetail({
  boundary,
  onChanged,
}: {
  boundary: GeographicBoundary
  onChanged: () => void
}) {
  const [sourceChecked, setSourceChecked] = useState(false)
  const [reviewNote, setReviewNote] = useState('')
  const [archiveNote, setArchiveNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const isDraft = boundary.status === 'draft'
  const canReview = isDraft && boundary.verification_status === 'unverified'
  const canPublish = isDraft && boundary.verification_status !== 'rejected'
  const canArchive = boundary.status !== 'archived'
  const source = boundary.source

  async function run(action: () => Promise<void>, message: string) {
    setBusy(true)
    setError(null)
    setSuccess(null)
    try {
      await action()
      setSuccess(message)
      setSourceChecked(false)
      setReviewNote('')
      setArchiveNote('')
      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The change could not be saved.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card flex flex-col gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-ocean-600">
          Version {boundary.version} · {boundary.boundary_key}
        </p>
        <h2 className="text-lg font-bold text-ocean-900">{boundary.label}</h2>
      </div>

      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="font-semibold text-ocean-800">Status</dt>
          <dd className="text-ocean-700">{STATUS_TEXT[boundary.status]}</dd>
        </div>
        <div>
          <dt className="font-semibold text-ocean-800">Verification</dt>
          <dd className="text-ocean-700">{VERIFICATION_TEXT[boundary.verification_status]}</dd>
        </div>
        <div>
          <dt className="font-semibold text-ocean-800">Source</dt>
          <dd className="text-ocean-700">{source?.name ?? 'No source recorded'}</dd>
        </div>
        <div>
          <dt className="font-semibold text-ocean-800">Publisher and license</dt>
          <dd className="text-ocean-700">
            {source ? `${source.publisher} · ${source.license}` : 'Not recorded'}
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-ocean-800">Shape</dt>
          <dd className="text-ocean-700">
            {boundary.geometry_type} · {boundary.feature_count} polygon parts · {boundary.crs}
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-ocean-800">Source link checked</dt>
          <dd className="text-ocean-700">
            {source?.origin_checked ? `Yes, ${formatDate(source.origin_checked_at)}` : 'Not yet'}
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-ocean-800">Published</dt>
          <dd className="text-ocean-700">{formatDate(boundary.published_at)}</dd>
        </div>
        <div>
          <dt className="font-semibold text-ocean-800">Last review note</dt>
          <dd className="text-ocean-700">{boundary.review_note || 'None'}</dd>
        </div>
      </dl>

      {boundary.verification_status !== 'verified' && boundary.status !== 'archived' && (
        <p className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          This dataset has not been verified against its original source. Do not publish it as an official boundary.
        </p>
      )}

      {canReview && (
        <div className="flex flex-col gap-3 border-t border-ocean-100 pt-4">
          <h3 className="text-sm font-bold text-ocean-900">Verify against the source</h3>
          <label className="flex items-start gap-2 text-sm text-ocean-800">
            <input
              type="checkbox"
              className="mt-1"
              checked={sourceChecked}
              onChange={(e) => setSourceChecked(e.target.checked)}
            />
            I opened the original source and confirmed this file matches it.
          </label>
          <textarea
            className="input-field min-h-20"
            placeholder="Review note (which source, which version, what you checked)"
            value={reviewNote}
            onChange={(e) => setReviewNote(e.target.value)}
          />
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              className="btn-secondary"
              disabled={busy}
              onClick={() =>
                run(() => reviewBoundary(boundary.id, 'rejected', false, reviewNote.trim()), 'Dataset rejected.')
              }
            >
              Reject
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={busy || !sourceChecked}
              onClick={() =>
                run(() => reviewBoundary(boundary.id, 'verified', true, reviewNote.trim()), 'Dataset marked as verified.')
              }
            >
              Mark verified
            </button>
          </div>
        </div>
      )}

      {canPublish && (
        <div className="flex flex-col gap-2 border-t border-ocean-100 pt-4">
          <h3 className="text-sm font-bold text-ocean-900">Publish to the globe</h3>
          <p className="text-sm text-ocean-700">
            Publishing replaces the currently shown version. Unverified datasets can only be published when no version is shown yet.
          </p>
          <div className="flex justify-end">
            <button
              type="button"
              className="btn-primary"
              disabled={busy}
              onClick={() => run(() => publishBoundary(boundary.id), 'Dataset published.')}
            >
              Publish
            </button>
          </div>
        </div>
      )}

      {canArchive && (
        <div className="flex flex-col gap-2 border-t border-ocean-100 pt-4">
          <h3 className="text-sm font-bold text-ocean-900">Archive this version</h3>
          <p className="text-sm text-ocean-700">Archived versions are kept in the history but are no longer shown on the globe.</p>
          <input
            className="input-field"
            placeholder="Reason for archiving"
            value={archiveNote}
            onChange={(e) => setArchiveNote(e.target.value)}
          />
          <div className="flex justify-end">
            <button
              type="button"
              className="btn-secondary"
              disabled={busy || !archiveNote.trim()}
              onClick={() => run(() => archiveBoundary(boundary.id, archiveNote.trim()), 'Version archived.')}
            >
              Archive
            </button>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="flex items-center gap-2 text-sm font-semibold text-red-700">
          <AlertTriangle size={16} /> {error}
        </p>
      )}
      {success && (
        <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
          <CheckCircle2 size={16} /> {success}
        </p>
      )}
    </section>
  )
}
