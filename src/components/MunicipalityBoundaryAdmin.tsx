import { useState } from 'react'
import { GeographicBoundaryDetail } from './GeographicBoundaryDetail'
import { GeographicImportForm } from './GeographicImportForm'
import type { GeographicBoundary } from '../lib/geographicBoundaries'
import { MUNICIPAL_BOUNDARY_KIND, type MunicipalityRecord } from '../lib/municipalities'

const STATUS_LABEL = {
  draft: 'Draft',
  published: 'Published',
  archived: 'Archived',
} as const

const VERIFICATION_LABEL = {
  unverified: 'Not verified',
  verified: 'Verified',
  rejected: 'Rejected',
} as const

export function MunicipalityBoundaryAdmin({
  record,
  versions,
  onChanged,
}: {
  record: MunicipalityRecord
  versions: GeographicBoundary[]
  onChanged: () => void
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const selected = versions.find((version) => version.id === selectedId) ?? null

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ocean-700">
          Each upload is a new draft. Verify it against the source, then publish it to replace the boundary shown on the globe.
        </p>
        <button type="button" className="btn-secondary" onClick={() => setUploading((open) => !open)}>
          {uploading ? 'Close upload' : 'Upload a new version'}
        </button>
      </div>

      {uploading && (
        <GeographicImportForm
          fixedDataset={{
            boundaryKey: record.boundary_key,
            label: `${record.name} boundary`,
            kind: MUNICIPAL_BOUNDARY_KIND,
          }}
          onImported={() => {
            setUploading(false)
            onChanged()
          }}
        />
      )}

      {versions.length === 0 ? (
        <p className="card text-sm text-ocean-700">No boundary has been uploaded for {record.name} yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {versions.map((version) => (
            <li key={version.id}>
              <button
                type="button"
                aria-pressed={version.id === selectedId}
                onClick={() => setSelectedId(version.id)}
                className={`card flex w-full items-center justify-between gap-3 text-left transition hover:border-ocean-300 ${
                  version.id === selectedId ? 'ring-2 ring-ocean-500' : ''
                }`}
              >
                <span className="text-sm font-bold text-ocean-900">Version {version.version}</span>
                <span className="text-xs text-ocean-700">
                  {STATUS_LABEL[version.status]} · {VERIFICATION_LABEL[version.verification_status]}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {selected && (
        <GeographicBoundaryDetail key={selected.id} boundary={selected} onChanged={onChanged} />
      )}
    </div>
  )
}
