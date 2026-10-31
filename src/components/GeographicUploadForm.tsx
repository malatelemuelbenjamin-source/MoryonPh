import { useEffect, useMemo, useState, type DragEvent, type ChangeEvent, type FormEvent } from 'react'
import { AlertTriangle, CheckCircle2, Upload } from 'lucide-react'
import { GeographicUploadReport } from './GeographicUploadReport'
import { UPLOAD_CATEGORIES, isBoundaryCategory, type UploadCategory } from '../lib/geographicCategories'
import { parseGeographicFile, type ParsedDataset } from '../lib/geographicFileParsers'
import { inspectDataset, suggestFieldMapping, type FieldMapping } from '../lib/geographicInspection'
import { fetchMunicipalityRecords, type MunicipalityRecord } from '../lib/municipalities'
import {
  buildStoragePath,
  createUploadJob,
  sha256Hex,
  storeOriginalFile,
  type UploadMetadata,
} from '../lib/geographicUploads'

const KEY_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/

const EMPTY_METADATA: UploadMetadata = {
  title: '',
  description: '',
  coverage: '',
  source_organization: '',
  source_url: '',
  source_reference: '',
  license: '',
  dataset_version: '',
  notes: '',
  boundary_key: '',
}

const METADATA_FIELDS: { key: keyof UploadMetadata; label: string; required?: boolean; type?: string }[] = [
  { key: 'title', label: 'Dataset title', required: true },
  { key: 'source_organization', label: 'Source organization', required: true },
  { key: 'license', label: 'License', required: true },
  { key: 'source_url', label: 'Original source link (https)', type: 'url' },
  { key: 'source_reference', label: 'Source reference or document' },
  { key: 'dataset_version', label: 'Dataset version' },
  { key: 'coverage', label: 'Geographic coverage' },
  { key: 'description', label: 'Description' },
  { key: 'notes', label: 'Optional notes' },
]

const ACCEPTED_TYPES = '.geojson,.json,.kml,.csv'

const FIELD_CLASS = 'flex flex-col gap-1 text-sm font-semibold text-ocean-800'

export function GeographicUploadForm({ onSaved }: { onSaved: () => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [fileKey, setFileKey] = useState(0)
  const [parseErrors, setParseErrors] = useState<string[]>([])
  const [reading, setReading] = useState(false)
  const [dataset, setDataset] = useState<ParsedDataset | null>(null)
  const [category, setCategory] = useState<UploadCategory>('island_boundary')
  const [mapping, setMapping] = useState<FieldMapping>({ nameField: null, codeField: null })
  const [csvCrsConfirmed, setCsvCrsConfirmed] = useState(false)
  const [municipalityId, setMunicipalityId] = useState('')
  const [municipalities, setMunicipalities] = useState<MunicipalityRecord[]>([])
  const [metadata, setMetadata] = useState<UploadMetadata>(EMPTY_METADATA)
  const [dragging, setDragging] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    fetchMunicipalityRecords()
      .then(setMunicipalities)
      .catch(() => setMunicipalities([]))
  }, [])

  const report = useMemo(
    () => (dataset ? inspectDataset(dataset, { category, csvCrsConfirmed, mapping }) : null),
    [dataset, category, csvCrsConfirmed, mapping],
  )
  const isBoundary = isBoundaryCategory(category)

  async function acceptFile(next: File) {
    setFile(next)
    setDataset(null)
    setParseErrors([])
    setFormError(null)
    setSuccess(null)
    setCsvCrsConfirmed(false)
    setReading(true)
    const result = await parseGeographicFile(next)
    setReading(false)
    if (!result.ok) {
      setParseErrors(result.errors)
      return
    }
    setDataset(result.dataset)
    setMapping(suggestFieldMapping(result.dataset.fields))
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.files?.[0]
    if (next) void acceptFile(next)
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault()
    setDragging(false)
    const next = event.dataTransfer.files[0]
    if (next) void acceptFile(next)
  }

  function reset() {
    setFile(null)
    setFileKey((key) => key + 1)
    setDataset(null)
    setParseErrors([])
    setMapping({ nameField: null, codeField: null })
    setCsvCrsConfirmed(false)
    setMunicipalityId('')
    setMetadata(EMPTY_METADATA)
  }

  function validateMetadata(): string | null {
    if (METADATA_FIELDS.some((field) => field.required && !metadata[field.key].trim())) {
      return 'Dataset title, source organization and license are required.'
    }
    if (metadata.source_url.trim() && !/^https:\/\//i.test(metadata.source_url.trim())) {
      return 'The source link must start with https://.'
    }
    if (isBoundary && !KEY_PATTERN.test(metadata.boundary_key.trim())) {
      return 'Boundary key must use lowercase letters, numbers and single hyphens, for example marinduque-island.'
    }
    if (category === 'barangay_boundary' && !municipalityId) {
      return 'Choose the municipality that this barangay belongs to.'
    }
    return null
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)
    setSuccess(null)
    if (!file || !dataset || !report) {
      setFormError('Choose a file that passes the format check first.')
      return
    }
    const problem = validateMetadata()
    if (problem) {
      setFormError(problem)
      return
    }

    setSubmitting(true)
    try {
      const sha256 = await sha256Hex(file)
      const storagePath = buildStoragePath(file.name)
      await storeOriginalFile(file, storagePath)
      await createUploadJob({
        fileName: file.name,
        format: dataset.format,
        sizeBytes: file.size,
        sha256,
        storagePath,
        category,
        municipalityId: municipalityId || null,
        metadata: {
          ...metadata,
          title: metadata.title.trim(),
          source_organization: metadata.source_organization.trim(),
          license: metadata.license.trim(),
          boundary_key: metadata.boundary_key.trim(),
        },
        mapping,
        report,
      })
      setSuccess(
        report.criticalErrors.length > 0
          ? 'Saved. The file has critical problems, so it is recorded as a failed validation and cannot be approved.'
          : 'Saved and sent for review. Approve it in the review queue below.',
      )
      reset()
      onSaved()
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'The upload could not be saved.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card flex flex-col gap-5">
      <div>
        <h2 className="text-base font-bold text-ocean-900">Upload geographic data</h2>
        <p className="text-sm text-ocean-700">
          Accepted: GeoJSON, KML and CSV with latitude and longitude columns. The original file is kept private and checked before anything is saved.
        </p>
      </div>

      <label
        onDragOver={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-center text-sm transition ${
          dragging ? 'border-ocean-500 bg-ocean-100' : 'border-ocean-300 bg-ocean-50 hover:border-ocean-400'
        }`}
      >
        <Upload size={22} className="text-ocean-500" />
        <span className="font-semibold text-ocean-800">
          {file ? file.name : 'Drag a file here or click to choose one'}
        </span>
        <span className="text-xs text-ocean-600">Up to 10 MB</span>
        <input
          key={fileKey}
          type="file"
          accept={ACCEPTED_TYPES}
          className="sr-only"
          onChange={handleInputChange}
        />
      </label>

      {reading && <p className="text-sm text-ocean-700">Checking the file…</p>}

      {parseErrors.length > 0 && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          <p className="flex items-center gap-2 font-semibold">
            <AlertTriangle size={16} /> This file cannot be read
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {parseErrors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      {dataset && (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={FIELD_CLASS}>
            Dataset category
            <select className="input-field" value={category} onChange={(e) => setCategory(e.target.value as UploadCategory)}>
              {UPLOAD_CATEGORIES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className={FIELD_CLASS}>
            Municipality {category === 'barangay_boundary' ? '' : '(optional)'}
            <select className="input-field" value={municipalityId} onChange={(e) => setMunicipalityId(e.target.value)}>
              <option value="">Not linked to one municipality</option>
              {municipalities.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </select>
          </label>
          {isBoundary && (
            <label className={FIELD_CLASS}>
              Boundary key
              <input
                className="input-field"
                value={metadata.boundary_key}
                onChange={(e) => setMetadata((prev) => ({ ...prev, boundary_key: e.target.value }))}
                placeholder="marinduque-island"
              />
            </label>
          )}
          <label className={FIELD_CLASS}>
            Name field (from the file)
            <select
              className="input-field"
              value={mapping.nameField ?? ''}
              onChange={(e) => setMapping((prev) => ({ ...prev, nameField: e.target.value || null }))}
            >
              <option value="">Not mapped</option>
              {dataset.fields.map((field) => (
                <option key={field} value={field}>
                  {field}
                </option>
              ))}
            </select>
          </label>
          <label className={FIELD_CLASS}>
            Official code field (from the file)
            <select
              className="input-field"
              value={mapping.codeField ?? ''}
              onChange={(e) => setMapping((prev) => ({ ...prev, codeField: e.target.value || null }))}
            >
              <option value="">Not mapped</option>
              {dataset.fields.map((field) => (
                <option key={field} value={field}>
                  {field}
                </option>
              ))}
            </select>
          </label>
          {dataset.format === 'csv' && (
            <label className="flex items-start gap-2 text-sm text-ocean-800 sm:col-span-2">
              <input
                type="checkbox"
                className="mt-1"
                checked={csvCrsConfirmed}
                onChange={(e) => setCsvCrsConfirmed(e.target.checked)}
              />
              I confirm these latitude and longitude values are WGS 84 (EPSG:4326), the standard used by the map.
            </label>
          )}
        </div>
      )}

      {report && (
        <div className="border-t border-ocean-100 pt-4">
          <GeographicUploadReport summary={report} geometry={report.boundaryGeometry && report.bbox
            ? { coordinates: report.boundaryGeometry.coordinates, bbox: report.bbox }
            : null} />
        </div>
      )}

      {dataset && (
        <div className="grid gap-3 border-t border-ocean-100 pt-4 sm:grid-cols-2">
          {METADATA_FIELDS.map((field) => (
            <label key={field.key} className={FIELD_CLASS}>
              {field.label}
              {field.required ? ' *' : ''}
              <input
                className="input-field"
                type={field.type ?? 'text'}
                value={metadata[field.key]}
                onChange={(e) => setMetadata((prev) => ({ ...prev, [field.key]: e.target.value }))}
              />
            </label>
          ))}
        </div>
      )}

      {formError && <p role="alert" className="text-sm font-semibold text-red-700">{formError}</p>}
      {success && (
        <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
          <CheckCircle2 size={16} /> {success}
        </p>
      )}

      {dataset && (
        <div className="flex justify-end gap-3">
          <button
            type="button"
            className="btn-secondary"
            disabled={submitting}
            onClick={() => {
              setFormError(null)
              setSuccess(null)
              reset()
            }}
          >
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={submitting || !report}>
            {submitting ? 'Saving…' : 'Save and send for review'}
          </button>
        </div>
      )}
    </form>
  )
}
