import { useState } from 'react'
import { FileText } from 'lucide-react'
import { GeographicUploadReview, effectiveStatusText } from './GeographicUploadReview'
import { categoryLabel } from '../lib/geographicCategories'
import type { GeographicBoundary } from '../lib/geographicBoundaries'
import type { UploadJob } from '../lib/geographicUploads'
import { formatRelativeTime } from '../lib/labels'

export function GeographicUploadQueue({
  jobs,
  boundaries,
  onChanged,
}: {
  jobs: UploadJob[]
  boundaries: GeographicBoundary[]
  onChanged: () => void
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = jobs.find((job) => job.id === selectedId) ?? null
  const boundaryFor = (job: UploadJob) => boundaries.find((row) => row.id === job.boundary_id) ?? null

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-base font-bold text-ocean-900">Upload queue</h2>
      {jobs.length === 0 ? (
        <p className="card text-sm text-ocean-700">No files have been uploaded yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {jobs.map((job) => (
            <li key={job.id}>
              <button
                type="button"
                onClick={() => setSelectedId(job.id)}
                className={`card flex w-full items-center justify-between gap-3 text-left transition hover:border-ocean-300 ${
                  job.id === selectedId ? 'ring-2 ring-ocean-500' : ''
                }`}
              >
                <span className="flex items-center gap-3">
                  <FileText size={18} className="shrink-0 text-ocean-500" />
                  <span>
                    <span className="block text-sm font-bold text-ocean-900">{job.title}</span>
                    <span className="block text-xs text-ocean-700">
                      {categoryLabel(job.category)} · {job.file_name} · {effectiveStatusText(job, boundaryFor(job))}
                    </span>
                  </span>
                </span>
                <span className="shrink-0 text-xs text-ocean-600">{formatRelativeTime(job.created_at)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {selected && (
        <GeographicUploadReview
          key={selected.id}
          job={selected}
          boundary={boundaryFor(selected)}
          onChanged={onChanged}
        />
      )}
    </section>
  )
}
