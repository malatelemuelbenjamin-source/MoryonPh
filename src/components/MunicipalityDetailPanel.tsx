import { useState } from 'react'
import { X } from 'lucide-react'
import { canShowOnGlobe, describeBoundaryStatus, type MunicipalityEntry } from '../lib/municipalities'

function formatArea(areaSqKm: number): string {
  return `${areaSqKm.toLocaleString('en-PH', { maximumFractionDigits: 2 })} sq km`
}

function formatCenter(lat: number, lon: number): string {
  return `${lat.toFixed(4)}, ${lon.toFixed(4)}`
}

export function MunicipalityDetailPanel({
  entry,
  onClear,
  onShowOnGlobe,
}: {
  entry: MunicipalityEntry
  onClear: () => void
  onShowOnGlobe: () => void
}) {
  const { record } = entry
  const [imageFailed, setImageFailed] = useState(false)
  const detailsVerified = record.details_verification_status === 'verified'
  const boundaryStatus = describeBoundaryStatus(entry)
  const sourceUrl = record.details_source_url?.startsWith('https://') ? record.details_source_url : null
  const showImage = detailsVerified && record.image_url && !imageFailed

  return (
    <article className="card flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <h3 className="text-lg font-bold text-ocean-900">{record.name}</h3>
          <span
            className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${
              boundaryStatus.verified ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900'
            }`}
          >
            {boundaryStatus.label}
          </span>
        </div>
        <button
          type="button"
          aria-label="Clear selection"
          onClick={onClear}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ocean-50 text-ocean-700 transition hover:bg-ocean-100"
        >
          <X size={16} />
        </button>
      </div>

      {showImage && (
        <img
          src={record.image_url ?? undefined}
          alt={`View of ${record.name}`}
          loading="lazy"
          onError={() => setImageFailed(true)}
          className="h-44 w-full rounded-xl object-cover"
        />
      )}

      {detailsVerified ? (
        <>
          {record.description && <p className="text-sm leading-relaxed text-ocean-800">{record.description}</p>}
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="font-semibold text-ocean-800">Official code</dt>
              <dd className="text-ocean-700">{record.official_code ?? 'Not recorded'}</dd>
            </div>
            <div>
              <dt className="font-semibold text-ocean-800">Area</dt>
              <dd className="text-ocean-700">
                {record.area_sq_km !== null ? formatArea(record.area_sq_km) : 'Not recorded'}
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-ocean-800">Map center (lat, lon)</dt>
              <dd className="text-ocean-700">
                {record.center_lat !== null && record.center_lon !== null
                  ? formatCenter(record.center_lat, record.center_lon)
                  : 'Not recorded'}
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-ocean-800">Source</dt>
              <dd className="text-ocean-700">
                {record.details_source_name ?? 'Not recorded'}
                {sourceUrl && (
                  <>
                    {' · '}
                    <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-ocean-700 underline">
                      Open source
                    </a>
                  </>
                )}
              </dd>
            </div>
          </dl>
        </>
      ) : (
        <p className="rounded-xl bg-ocean-50 p-3 text-sm text-ocean-800">
          Details for this municipality are still being verified against the official source, so they are not shown yet.
        </p>
      )}

      <p className="text-sm text-ocean-700">
        {entry.boundary
          ? `Boundary verified against ${entry.boundary.sourceName ?? 'its official source'}.`
          : 'The boundary has not been verified yet, so it is not drawn on the globe.'}
      </p>

      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={onShowOnGlobe}
          disabled={!canShowOnGlobe(entry)}
          className="btn-primary"
        >
          Show on globe
        </button>
      </div>
    </article>
  )
}
