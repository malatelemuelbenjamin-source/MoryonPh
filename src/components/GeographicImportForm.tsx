import { useState, type ChangeEvent, type FormEvent } from 'react'
import { AlertTriangle, CheckCircle2, Upload } from 'lucide-react'
import { importBoundary } from '../lib/geographicBoundaries'
import { validateBoundaryGeoJson, type ValidatedBoundary } from '../lib/geoJsonValidation'

const MAX_FILE_BYTES = 5 * 1024 * 1024
const KEY_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/

const KIND_OPTIONS = [
  { value: 'island_outline', label: 'Island coastline' },
  { value: 'municipal_boundary', label: 'Municipal boundaries' },
] as const

interface SourceFields {
  name: string
  publisher: string
  source_url: string
  license: string
  source_year: string
  last_updated_on: string
  notes: string
}

const EMPTY_SOURCE: SourceFields = {
  name: '',
  publisher: '',
  source_url: '',
  license: '',
  source_year: '',
  last_updated_on: '',
  notes: '',
}

interface PreparedFile {
  fileName: string
  validated: ValidatedBoundary
}

export function GeographicImportForm({ onImported }: { onImported: () => void }) {
  const [boundaryKey, setBoundaryKey] = useState('')
  const [label, setLabel] = useState('')
  const [kind, setKind] = useState<string>(KIND_OPTIONS[0].value)
  const [source, setSource] = useState<SourceFields>(EMPTY_SOURCE)
  const [prepared, setPrepared] = useState<PreparedFile | null>(null)
  const [fileErrors, setFileErrors] = useState<string[]>([])
  const [reading, setReading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    setPrepared(null)
    setFileErrors([])
    setSuccess(null)
    if (!file) return
    if (file.size > MAX_FILE_BYTES) {
      setFileErrors(['The file is larger than 5 MB. Upload a simplified GeoJSON file.'])
      return
    }
    setReading(true)
    try {
      const text = await file.text()
      const result = validateBoundaryGeoJson(text)
      if (result.ok) {
        setPrepared({ fileName: file.name, validated: result.value })
      } else {
        setFileErrors(result.errors)
      }
    } catch {
      setFileErrors(['The file could not be read. Choose the file again.'])
    } finally {
      setReading(false)
    }
  }

  function updateSource(field: keyof SourceFields, value: string) {
    setSource((previous) => ({ ...previous, [field]: value }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)
    setSuccess(null)

    const key = boundaryKey.trim()
    if (!KEY_PATTERN.test(key)) {
      setFormError('Dataset key must use lowercase letters, numbers and single hyphens, for example marinduque-island.')
      return
    }
    if (!label.trim()) {
      setFormError('Enter a display name for this dataset.')
      return
    }
    if (!prepared) {
      setFormError('Choose a valid GeoJSON file first.')
      return
    }
    if (!source.name.trim() || !source.publisher.trim() || !source.license.trim() || !source.source_url.trim()) {
      setFormError('Source name, publisher, source link and license are required.')
      return
    }
    if (source.source_year.trim() && !/^\d{4}$/.test(source.source_year.trim())) {
      setFormError('Source year must be a four-digit year.')
      return
    }

    setSubmitting(true)
    try {
      await importBoundary({
        boundaryKey: key,
        label: label.trim(),
        kind,
        source: {
          name: source.name.trim(),
          publisher: source.publisher.trim(),
          source_url: source.source_url.trim(),
          license: source.license.trim(),
          source_year: source.source_year.trim(),
          last_updated_on: source.last_updated_on.trim(),
          notes: source.notes.trim(),
        },
        geometry: prepared.validated.geometry,
        bbox: prepared.validated.bbox,
        featureCount: prepared.validated.polygonCount,
      })
      setSuccess('Saved as a draft version. It will not appear on the globe until it is verified and published.')
      setBoundaryKey('')
      setLabel('')
      setSource(EMPTY_SOURCE)
      setPrepared(null)
      onImported()
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'The dataset could not be saved.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card flex flex-col gap-4">
      <div>
        <h2 className="text-base font-bold text-ocean-900">Import a new dataset</h2>
        <p className="text-sm text-ocean-700">
          Upload a GeoJSON file (Polygon or MultiPolygon) from an official or citable source. Every import starts as an unverified draft.
        </p>
      </div>

      <label className="flex flex-col gap-2 text-sm font-semibold text-ocean-800">
        GeoJSON file
        <span className="flex items-center gap-3 rounded-xl border border-dashed border-ocean-300 bg-ocean-50 px-4 py-3 font-normal text-ocean-700">
          <Upload size={18} className="shrink-0 text-ocean-500" />
          <input type="file" accept=".geojson,.json,application/geo+json,application/json" onChange={handleFileChange} className="text-sm" />
        </span>
      </label>

      {reading && <p className="text-sm text-ocean-700">Checking the file…</p>}

      {prepared && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <p className="flex items-center gap-2 font-semibold">
            <CheckCircle2 size={16} /> {prepared.fileName} passed the checks
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>{prepared.validated.polygonCount} polygon parts</li>
            <li>
              Extent: longitude {prepared.validated.bbox.min_lon.toFixed(4)} to {prepared.validated.bbox.max_lon.toFixed(4)},
              latitude {prepared.validated.bbox.min_lat.toFixed(4)} to {prepared.validated.bbox.max_lat.toFixed(4)}
            </li>
          </ul>
          {prepared.validated.warnings.length > 0 && (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-amber-800">
              {prepared.validated.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {fileErrors.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          <p className="flex items-center gap-2 font-semibold">
            <AlertTriangle size={16} /> This file cannot be imported
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {fileErrors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-semibold text-ocean-800">
          Dataset key
          <input className="input-field" value={boundaryKey} onChange={(e) => setBoundaryKey(e.target.value)} placeholder="marinduque-island" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold text-ocean-800">
          Display name
          <input className="input-field" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Marinduque island" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold text-ocean-800">
          Dataset type
          <select className="input-field" value={kind} onChange={(e) => setKind(e.target.value)}>
            {KIND_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold text-ocean-800">
          Source name
          <input className="input-field" value={source.name} onChange={(e) => updateSource('name', e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold text-ocean-800">
          Publisher
          <input className="input-field" value={source.publisher} onChange={(e) => updateSource('publisher', e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold text-ocean-800">
          Source link
          <input className="input-field" type="url" value={source.source_url} onChange={(e) => updateSource('source_url', e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold text-ocean-800">
          License
          <input className="input-field" value={source.license} onChange={(e) => updateSource('license', e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold text-ocean-800">
          Source year
          <input className="input-field" inputMode="numeric" value={source.source_year} onChange={(e) => updateSource('source_year', e.target.value)} placeholder="2020" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold text-ocean-800">
          Source last updated
          <input className="input-field" type="date" value={source.last_updated_on} onChange={(e) => updateSource('last_updated_on', e.target.value)} />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm font-semibold text-ocean-800">
        Notes about the source
        <textarea className="input-field min-h-20" value={source.notes} onChange={(e) => updateSource('notes', e.target.value)} />
      </label>

      {formError && <p role="alert" className="text-sm font-semibold text-red-700">{formError}</p>}
      {success && <p className="text-sm font-semibold text-emerald-700">{success}</p>}

      <div className="flex justify-end">
        <button type="submit" className="btn-primary" disabled={submitting || !prepared}>
          {submitting ? 'Saving…' : 'Save as draft'}
        </button>
      </div>
    </form>
  )
}
