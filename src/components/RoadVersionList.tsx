import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import type { MunicipalityEntry } from '../lib/municipalities'
import { activateRoadVersion, type RoadDatasetVersion } from '../lib/roadNetwork'
import { RoadVersionPreview } from './RoadVersionPreview'

interface RoadVersionListProps {
  versions: RoadDatasetVersion[]
  municipalities: MunicipalityEntry[]
  onChanged: () => void
}

const STATUS_LABEL: Record<RoadDatasetVersion['status'], string> = {
  importing: 'Importing',
  staging: 'Ready for review',
  published: 'Live on the public map',
  archived: 'Archived',
  failed: 'Failed',
}

const ACTION_LABEL: Partial<Record<RoadDatasetVersion['status'], { idle: string; confirm: string }>> = {
  staging: { idle: 'Publish this version', confirm: 'Confirm publish' },
  archived: { idle: 'Restore this version', confirm: 'Confirm restore' },
}

export function RoadVersionList({ versions, municipalities, onChanged }: RoadVersionListProps) {
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const published = versions.find((version) => version.status === 'published') ?? null

  const handleActivate = async (version: RoadDatasetVersion) => {
    setBusyId(version.id)
    setActionError(null)
    try {
      await activateRoadVersion(version.id)
      setConfirmingId(null)
      onChanged()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'The version could not be published. Try again.')
    } finally {
      setBusyId(null)
    }
  }

  if (versions.length === 0) {
    return (
      <section className="card">
        <h2 className="text-base font-bold text-ocean-900">Road versions</h2>
        <p className="text-sm text-ocean-700">No road data has been imported yet.</p>
      </section>
    )
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-base font-bold text-ocean-900">Road versions</h2>
      {actionError && <p role="alert" className="card text-sm font-semibold text-red-700">{actionError}</p>}
      <ul className="flex flex-col gap-3">
        {versions.map((version) => {
          const action = ACTION_LABEL[version.status]
          const isConfirming = confirmingId === version.id
          const delta = published && version.status !== 'published' && version.status !== 'failed'
            ? version.road_count - published.road_count
            : null
          return (
            <li key={version.id} className="card flex flex-col gap-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-bold text-ocean-900">Version {version.version} · {STATUS_LABEL[version.status]}</p>
                  <p className="text-xs text-ocean-600">{version.source_attribution}</p>
                </div>
                <p className="text-xs text-ocean-600">
                  {version.source_fetched_at ? `Fetched ${new Date(version.source_fetched_at).toLocaleString()}` : 'Not fetched yet'}
                </p>
              </div>

              {version.status === 'failed' ? (
                <p className="text-sm text-red-700">{version.failure_reason ?? 'The import failed.'}</p>
              ) : (
                <dl className="grid grid-cols-2 gap-2 text-sm text-ocean-800 sm:grid-cols-4">
                  <div><dt className="text-xs text-ocean-600">Roads</dt><dd className="font-bold">{version.road_count.toLocaleString()}</dd></div>
                  <div><dt className="text-xs text-ocean-600">Skipped as invalid</dt><dd className="font-bold">{version.invalid_count.toLocaleString()}</dd></div>
                  <div><dt className="text-xs text-ocean-600">Duplicates</dt><dd className="font-bold">{version.duplicate_count.toLocaleString()}</dd></div>
                  <div>
                    <dt className="text-xs text-ocean-600">Compared with live</dt>
                    <dd className="font-bold">
                      {delta === null ? 'Not applicable' : `${delta >= 0 ? '+' : ''}${delta.toLocaleString()} roads`}
                    </dd>
                  </div>
                </dl>
              )}

              {version.status !== 'failed' && version.municipality_coverage.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-ocean-700">Roads per municipality</p>
                  <ul className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-ocean-800 sm:grid-cols-3">
                    {version.municipality_coverage.map((entry) => (
                      <li key={entry.municipality ?? 'unassigned'} className="flex justify-between gap-2">
                        <span>{entry.municipality ?? 'Outside municipalities'}</span>
                        <span className="font-semibold">{entry.roadCount.toLocaleString()}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {version.status !== 'failed' && version.status !== 'importing' && (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn-secondary text-xs"
                    onClick={() => setPreviewId(previewId === version.id ? null : version.id)}
                  >
                    {previewId === version.id ? 'Hide preview' : 'Preview roads'}
                  </button>
                  {action && (
                    isConfirming ? (
                      <>
                        <button
                          type="button"
                          className="btn-primary inline-flex items-center gap-2 text-xs"
                          disabled={busyId === version.id}
                          onClick={() => void handleActivate(version)}
                        >
                          {busyId === version.id && <Loader2 size={14} className="animate-spin" />}
                          {action.confirm}
                        </button>
                        <button type="button" className="btn-secondary text-xs" onClick={() => setConfirmingId(null)}>
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button type="button" className="btn-primary text-xs" onClick={() => setConfirmingId(version.id)}>
                        {action.idle}
                      </button>
                    )
                  )}
                </div>
              )}

              {isConfirming && version.status === 'staging' && (
                <p className="text-xs text-ocean-700">
                  Publishing replaces the live roads with this version. The current version is archived and can be restored.
                </p>
              )}

              {previewId === version.id && <RoadVersionPreview versionId={version.id} municipalities={municipalities} />}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
