import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { GeometryPreview } from './GeometryPreview'
import type { BoundaryBbox, MultiPolygonCoordinates } from '../lib/geoJsonValidation'
import type { StoredValidation } from '../lib/geographicUploads'

export interface ReportGeometry {
  coordinates: MultiPolygonCoordinates
  bbox: BoundaryBbox
}

export function GeographicUploadReport({
  summary,
  geometry,
}: {
  summary: StoredValidation
  geometry: ReportGeometry | null
}) {
  const typeEntries = Object.entries(summary.countsByType)
  const hasErrors = summary.criticalErrors.length > 0

  return (
    <div className="flex flex-col gap-4 text-sm text-ocean-800">
      <dl className="grid gap-2 sm:grid-cols-2">
        <div>
          <dt className="font-semibold text-ocean-900">Format</dt>
          <dd>{summary.format.toUpperCase()}</dd>
        </div>
        <div>
          <dt className="font-semibold text-ocean-900">Coordinate system</dt>
          <dd>{summary.crsNote}</dd>
        </div>
        <div>
          <dt className="font-semibold text-ocean-900">Features</dt>
          <dd>{summary.featureCount}</dd>
        </div>
        <div>
          <dt className="font-semibold text-ocean-900">Geometry types</dt>
          <dd>
            {typeEntries.length === 0
              ? 'None'
              : typeEntries.map(([type, count]) => `${type} ${count}`).join(' · ')}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="font-semibold text-ocean-900">Fields found</dt>
          <dd>{summary.fields.length === 0 ? 'No attribute fields' : summary.fields.join(', ')}</dd>
        </div>
      </dl>

      {hasErrors ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-900">
          <p className="flex items-center gap-2 font-semibold">
            <AlertTriangle size={16} /> Critical problems (this file cannot be published)
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {summary.criticalErrors.map((error, index) => (
              <li key={`${index}-${error}`}>{error}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 font-semibold text-emerald-900">
          <CheckCircle2 size={16} /> No critical problems found.
        </p>
      )}

      {summary.warnings.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
          <p className="font-semibold">Warnings to review</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {summary.warnings.map((warning, index) => (
              <li key={`${index}-${warning}`}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      {geometry && <GeometryPreview coordinates={geometry.coordinates} bbox={geometry.bbox} />}

      {summary.sampleRecords.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="font-semibold text-ocean-900">
            Records {summary.sampleRecords.length < summary.featureCount
              ? `(first ${summary.sampleRecords.length} of ${summary.featureCount})`
              : `(${summary.featureCount})`}
          </p>
          <div className="max-h-72 overflow-auto rounded-xl border border-ocean-100">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-ocean-50 text-ocean-900">
                <tr>
                  <th className="px-3 py-2 font-semibold">#</th>
                  <th className="px-3 py-2 font-semibold">Shape</th>
                  <th className="px-3 py-2 font-semibold">Name</th>
                  <th className="px-3 py-2 font-semibold">Official code</th>
                </tr>
              </thead>
              <tbody>
                {summary.sampleRecords.map((record) => (
                  <tr key={record.index} className="border-t border-ocean-100">
                    <td className="px-3 py-2">{record.index}</td>
                    <td className="px-3 py-2">{record.geometryType}</td>
                    <td className="px-3 py-2">{record.name || 'Not recorded'}</td>
                    <td className="px-3 py-2">{record.code || 'Not recorded'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
