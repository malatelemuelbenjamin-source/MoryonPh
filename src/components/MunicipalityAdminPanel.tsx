import { useEffect, useState } from 'react'
import { MunicipalityBoundaryAdmin } from './MunicipalityBoundaryAdmin'
import { MunicipalityDetailsForm } from './MunicipalityDetailsForm'
import { formatRelativeTime } from '../lib/labels'
import type { GeographicBoundary } from '../lib/geographicBoundaries'
import {
  fetchMunicipalityRevisions,
  type MunicipalityRecord,
  type MunicipalityRevision,
} from '../lib/municipalities'

type PanelTab = 'details' | 'boundary' | 'history'

const TABS: { value: PanelTab; label: string }[] = [
  { value: 'details', label: 'Details' },
  { value: 'boundary', label: 'Boundary' },
  { value: 'history', label: 'History' },
]

const REVISION_TEXT: Record<string, string> = {
  details_updated: 'Updated municipality details',
}

function MunicipalityHistory({ municipalityId }: { municipalityId: string }) {
  const [revisions, setRevisions] = useState<MunicipalityRevision[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchMunicipalityRevisions(municipalityId)
      .then((rows) => {
        if (cancelled) return
        setRevisions(rows)
        setError(null)
      })
      .catch((err: Error) => {
        if (cancelled) return
        setError(err.message)
      })
    return () => {
      cancelled = true
    }
  }, [municipalityId])

  if (error) return <p role="alert" className="text-sm font-semibold text-red-700">{error}</p>
  if (!revisions) return <p className="text-sm text-ocean-700">Loading history…</p>
  if (revisions.length === 0) return <p className="text-sm text-ocean-700">No changes recorded yet.</p>

  return (
    <ul className="flex flex-col divide-y divide-ocean-100">
      {revisions.map((revision) => (
        <li key={`${revision.created_at}-${revision.action}`} className="flex flex-col gap-1 py-2 text-sm sm:flex-row sm:items-center sm:justify-between">
          <span className="font-semibold text-ocean-800">
            {REVISION_TEXT[revision.action] ?? 'Changed'}
            {revision.details.status === 'verified' ? ' · verified against source' : ' · not verified'}
          </span>
          <span className="text-xs text-ocean-600">{formatRelativeTime(revision.created_at)}</span>
        </li>
      ))}
    </ul>
  )
}

export function MunicipalityAdminPanel({
  record,
  versions,
  onChanged,
}: {
  record: MunicipalityRecord
  versions: GeographicBoundary[]
  onChanged: () => void
}) {
  const [tab, setTab] = useState<PanelTab>('details')

  return (
    <section className="card flex flex-col gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-ocean-600">{record.boundary_key}</p>
        <h2 className="text-lg font-bold text-ocean-900">{record.name}</h2>
      </div>

      <div className="flex gap-2 overflow-x-auto" role="group" aria-label="Municipality sections">
        {TABS.map((item) => (
          <button
            key={item.value}
            type="button"
            aria-pressed={tab === item.value}
            onClick={() => setTab(item.value)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${
              tab === item.value ? 'bg-ocean-700 text-white' : 'bg-ocean-50 text-ocean-800 hover:bg-ocean-100'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'details' && <MunicipalityDetailsForm key={record.id} record={record} onSaved={onChanged} />}
      {tab === 'boundary' && <MunicipalityBoundaryAdmin record={record} versions={versions} onChanged={onChanged} />}
      {tab === 'history' && <MunicipalityHistory municipalityId={record.id} />}
    </section>
  )
}
