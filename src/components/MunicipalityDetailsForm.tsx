import { useState, type FormEvent } from 'react'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { saveMunicipalityDetails, type MunicipalityRecord } from '../lib/municipalities'

const CODE_PATTERN = /^\d+$/

interface DetailsFields {
  officialCode: string
  description: string
  imageUrl: string
  centerLon: string
  centerLat: string
  areaSqKm: string
  sourceName: string
  sourceUrl: string
}

function fieldsFrom(record: MunicipalityRecord): DetailsFields {
  return {
    officialCode: record.official_code ?? '',
    description: record.description ?? '',
    imageUrl: record.image_url ?? '',
    centerLon: record.center_lon?.toString() ?? '',
    centerLat: record.center_lat?.toString() ?? '',
    areaSqKm: record.area_sq_km?.toString() ?? '',
    sourceName: record.details_source_name ?? '',
    sourceUrl: record.details_source_url ?? '',
  }
}

function optionalNumber(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : Number.NaN
}

export function MunicipalityDetailsForm({
  record,
  onSaved,
}: {
  record: MunicipalityRecord
  onSaved: () => void
}) {
  const [fields, setFields] = useState<DetailsFields>(() => fieldsFrom(record))
  const [sourceChecked, setSourceChecked] = useState(record.details_verification_status === 'verified')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  function update(field: keyof DetailsFields, value: string) {
    setFields((previous) => ({ ...previous, [field]: value }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)
    setSuccess(null)

    const officialCode = fields.officialCode.trim()
    const imageUrl = fields.imageUrl.trim()
    const sourceName = fields.sourceName.trim()
    const sourceUrl = fields.sourceUrl.trim()
    const centerLon = optionalNumber(fields.centerLon)
    const centerLat = optionalNumber(fields.centerLat)
    const areaSqKm = optionalNumber(fields.areaSqKm)

    if (officialCode && !CODE_PATTERN.test(officialCode)) {
      setFormError('The official code must contain digits only.')
      return
    }
    if (imageUrl && !imageUrl.startsWith('https://')) {
      setFormError('The image link must start with https://.')
      return
    }
    if ((centerLon === null) !== (centerLat === null)) {
      setFormError('Enter both longitude and latitude, or leave both empty.')
      return
    }
    if (Number.isNaN(centerLon) || Number.isNaN(centerLat)) {
      setFormError('Longitude and latitude must be numbers.')
      return
    }
    if (
      (centerLon !== null && (centerLon < -180 || centerLon > 180)) ||
      (centerLat !== null && (centerLat < -90 || centerLat > 90))
    ) {
      setFormError('Longitude must be between -180 and 180, and latitude between -90 and 90.')
      return
    }
    if (areaSqKm !== null && (Number.isNaN(areaSqKm) || areaSqKm <= 0)) {
      setFormError('The area must be a number greater than zero.')
      return
    }
    if (sourceChecked && (!sourceName || !sourceUrl)) {
      setFormError('Name the source and give its link before marking the details as verified.')
      return
    }

    setSubmitting(true)
    try {
      await saveMunicipalityDetails({
        municipalityId: record.id,
        officialCode,
        description: fields.description.trim(),
        imageUrl,
        centerLon,
        centerLat,
        areaSqKm,
        sourceName,
        sourceUrl,
        sourceChecked,
      })
      setSuccess(
        sourceChecked
          ? 'Details saved and marked as verified. They now appear in the public explorer.'
          : 'Details saved as unverified. They stay hidden from the public explorer.',
      )
      onSaved()
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'The details could not be saved.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-semibold text-ocean-800">
          Official code
          <input className="input-field" inputMode="numeric" value={fields.officialCode} onChange={(e) => update('officialCode', e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold text-ocean-800">
          Area (sq km)
          <input className="input-field" inputMode="decimal" value={fields.areaSqKm} onChange={(e) => update('areaSqKm', e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold text-ocean-800">
          Center longitude
          <input className="input-field" inputMode="decimal" value={fields.centerLon} onChange={(e) => update('centerLon', e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold text-ocean-800">
          Center latitude
          <input className="input-field" inputMode="decimal" value={fields.centerLat} onChange={(e) => update('centerLat', e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold text-ocean-800 sm:col-span-2">
          Image link (https)
          <input className="input-field" type="url" value={fields.imageUrl} onChange={(e) => update('imageUrl', e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold text-ocean-800">
          Source name
          <input className="input-field" value={fields.sourceName} onChange={(e) => update('sourceName', e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold text-ocean-800">
          Source link
          <input className="input-field" type="url" value={fields.sourceUrl} onChange={(e) => update('sourceUrl', e.target.value)} />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm font-semibold text-ocean-800">
        Description
        <textarea className="input-field min-h-24" value={fields.description} onChange={(e) => update('description', e.target.value)} />
      </label>

      <label className="flex items-start gap-2 text-sm text-ocean-800">
        <input type="checkbox" className="mt-1" checked={sourceChecked} onChange={(e) => setSourceChecked(e.target.checked)} />
        I opened the official source and confirmed these details match it. Unchecking this hides the details from the public explorer.
      </label>

      {formError && (
        <p role="alert" className="flex items-center gap-2 text-sm font-semibold text-red-700">
          <AlertTriangle size={16} /> {formError}
        </p>
      )}
      {success && (
        <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
          <CheckCircle2 size={16} /> {success}
        </p>
      )}

      <div className="flex justify-end">
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? 'Saving…' : 'Save details'}
        </button>
      </div>
    </form>
  )
}
