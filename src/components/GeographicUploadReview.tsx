import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, ExternalLink } from 'lucide-react'
import { GeographicUploadReport, type ReportGeometry } from './GeographicUploadReport'
import { categoryLabel, isBoundaryCategory } from '../lib/geographicCategories'
import type { GeographicBoundary } from '../lib/geographicBoundaries'
import {
  createOriginalFileUrl,
  fetchUploadGeometry,
  reviewUploadJob,
  type UploadJob,
  type UploadStatus,
} from '../lib/geographicUploads'

const STATUS_TEXT: Record<UploadStatus, string> = {
  uploaded: 'Uploaded',
  processing: 'Processing',
  validation_failed: 'Validation failed',
  needs_review: 'Needs review',
  approved: 'Approved as a draft version',
  published: 'Published',
  rejected: 'Rejected',
  archived: 'Archived',
}

export function effectiveStatusText(job: UploadJob, boundary: GeographicBoundary | null): string {
  if (boundary?.status === 'published') return STATUS_TEXT.published
  if (boundary?.status === 'archived') return STATUS_TEXT.archived
  return STATUS_TEXT[job.status]
}

export function GeographicUploadReview({
  job,
  boundary,
  onChanged,
}: {
  job: UploadJob
  boundary: GeographicBoundary | null
  onChanged: () => void
}) {
  const [geometry, setGeometry] = useState<ReportGeometry | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const approvable = isBoundaryCategory(job.category)
  const canDecide = job.status === 'needs_review'

  useEffect(() => {
    let cancelled = false
    setGeometry(null)
    fetchUploadGeometry(job.id)
      .then((row) => {
        if (cancelled) return
        if (row.geometry_data && row.bbox) {
          setGeometry({ coordinates: row.geometry_data.coordinates, bbox: row.bbox })
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'The map preview could not be loaded.')
      })
    return () => {
      cancelled = true
    }
  }, [job.id])

  async function openOriginal() {
    setError(null)
    try {
      const url = await createOriginalFileUrl(job.storage_path)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The original file could not be opened.')
    }
  }

  async function decide(decision: 'approve' | 'reject') {
    setBusy(true)
    setError(null)
    setSuccess(null)
    try {
      await reviewUploadJob(job.id, decision, note.trim())
      setSuccess(
        decision === 'approve'
          ? 'Approved. It is now a draft version. Verify it against its source and publish it in the versions list below.'
          : 'Rejected. The original file is kept for the record.',
      )
      setNote('')
      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The decision could not be saved.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card flex flex-col gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-ocean-600">
          {categoryLabel(job.category)} · {job.file_format.toUpperCase()} · {job.file_name}
        </p>
        <h2 className="text-lg font-bold text-ocean-900">{job.title}</h2>
        <p className="text-sm text-ocean-700">
          Status: <span className="font-semibold">{effectiveStatusText(job, boundary)}</span>
        </p>
      </div>

      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="font-semibold text-ocean-900">Source organization</dt>
          <dd className="text-ocean-700">{job.source_organization}</dd>
        </div>
        <div>
          <dt className="font-semibold text-ocean-900">License</dt>
          <dd className="text-ocean-700">{job.license}</dd>
        </div>
        <div>
          <dt className="font-semibold text-ocean-900">Source link</dt>
          <dd className="text-ocean-700">{job.source_url ?? 'Not recorded'}</dd>
        </div>
        <div>
          <dt className="font-semibold text-ocean-900">Dataset version</dt>
          <dd className="text-ocean-700">{job.dataset_version ?? 'Not recorded'}</dd>
        </div>
        <div>
          <dt className="font-semibold text-ocean-900">Coverage</dt>
          <dd className="text-ocean-700">{job.coverage ?? 'Not recorded'}</dd>
        </div>
        <div>
          <dt className="font-semibold text-ocean-900">Official code field</dt>
          <dd className="text-ocean-700">{job.field_mapping.codeField ?? 'Not mapped'}</dd>
        </div>
      </dl>

      <button type="button" className="btn-secondary self-start" onClick={openOriginal}>
        <ExternalLink size={16} /> Open original file
      </button>

      <GeographicUploadReport summary={job.validation} geometry={geometry} />

      {job.review_note && (
        <p className="text-sm text-ocean-700">
          <span className="font-semibold text-ocean-900">Review note:</span> {job.review_note}
        </p>
      )}

      {canDecide && (
        <div className="flex flex-col gap-3 border-t border-ocean-100 pt-4">
          <h3 className="text-sm font-bold text-ocean-900">Decision</h3>
          {!approvable && (
            <p className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              This category can be checked and kept, but it cannot be approved yet. Only island, municipality and barangay boundaries can be approved in this version.
            </p>
          )}
          {job.validation.criticalErrors.length > 0 && (
            <p className="text-sm text-red-700">Critical problems are listed above. This file cannot be approved.</p>
          )}
          <textarea
            className="input-field min-h-20"
            placeholder="Review note (what you checked in the file and the source)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className="btn-secondary" disabled={busy || !note.trim()} onClick={() => decide('reject')}>
              Reject
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={busy || !note.trim() || !approvable || job.validation.criticalErrors.length > 0}
              onClick={() => decide('approve')}
            >
              Approve as draft
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
