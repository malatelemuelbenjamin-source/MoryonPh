import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  MapPin,
  Navigation,
  Bookmark,
  BookmarkCheck,
  AlertCircle,
  Phone,
  Clock,
  Info,
  Map as MapIcon,
  Compass,
  Shield,
} from 'lucide-react'
import { fetchNearbyPlace, getPlaceCategory, CATEGORY_LABELS, formatDistance } from '../lib/nearbyPlaces'
import { checkIfSaved, saveVerifiedLocation } from '../lib/savedPlaces'
import { useLocation as useGpsLocation } from '../lib/location'
import { formatRelativeTime } from '../lib/labels'
import { supabase } from '../lib/supabase'
import type { NearbyPlace } from '../lib/types'

export function NearbyPlaceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const gps = useGpsLocation()

  const [place, setPlace] = useState<NearbyPlace | null>(null)
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [reporting, setReporting] = useState(false)
  const [reportText, setReportText] = useState('')
  const [reportResult, setReportResult] = useState<{ success: boolean; error?: string } | null>(null)

  useEffect(() => {
    if (!id) return
    void (async () => {
      setLoading(true)
      const p = await fetchNearbyPlace(id)
      setPlace(p)
      setLoading(false)
      if (p) {
        const { saved: isSaved } = await checkIfSaved(p.id)
        setSaved(isSaved)
      }
    })()
  }, [id])

  const userLat = gps.coords?.lat ?? null
  const userLng = gps.coords?.lng ?? null
  let distance: number | null = null
  if (place && userLat !== null && userLng !== null && place.latitude && place.longitude) {
    const R = 6371
    const dLat = ((place.latitude - userLat) * Math.PI) / 180
    const dLng = ((place.longitude - userLng) * Math.PI) / 180
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((userLat * Math.PI) / 180) *
        Math.cos((place.latitude * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2
    distance = 2 * R * Math.asin(Math.sqrt(a))
  }

  async function handleSave() {
    if (!place || saving) return
    setSaving(true)
    if (!saved) {
      const res = await saveVerifiedLocation({ locationId: place.id, isFavorite: true })
      if (res.success) setSaved(true)
    }
    setSaving(false)
  }

  async function handleReport() {
    if (!place || !reportText.trim() || reportText.trim().length < 10) return
    setReporting(true)
    setReportResult(null)
    const { error } = await supabase.from('community_transport_reports').insert({
      category: 'other',
      title: `Place correction: ${place.name}`,
      description: reportText.trim(),
      location_id: place.id,
      municipality: place.municipality ?? null,
    })
    setReporting(false)
    if (error) {
      setReportResult({ success: false, error: error.message })
    } else {
      setReportResult({ success: true })
      setReportText('')
    }
  }

  if (loading) {
    return (
      <div className="app-shell">
        <header className="sticky top-0 z-30 bg-ocean-800 text-white shadow-card">
          <div className="flex items-center gap-3 px-4 py-4">
            <Link to="/nearby-places" className="grid h-9 w-9 place-items-center rounded-full bg-ocean-700 hover:bg-ocean-600">
              <ArrowLeft size={18} />
            </Link>
            <h1 className="text-lg font-bold">Place Details</h1>
          </div>
        </header>
        <main className="flex-1 px-4 py-5">
          <div className="card flex items-center gap-3">
            <span className="h-3 w-3 animate-pulse rounded-full bg-ocean-400" />
            <p className="text-sm font-semibold text-ocean-700">Loading place…</p>
          </div>
        </main>
      </div>
    )
  }

  if (!place) {
    return (
      <div className="app-shell">
        <header className="sticky top-0 z-30 bg-ocean-800 text-white shadow-card">
          <div className="flex items-center gap-3 px-4 py-4">
            <Link to="/nearby-places" className="grid h-9 w-9 place-items-center rounded-full bg-ocean-700 hover:bg-ocean-600">
              <ArrowLeft size={18} />
            </Link>
            <h1 className="text-lg font-bold">Place Details</h1>
          </div>
        </header>
        <main className="flex-1 px-4 py-5">
          <div className="card flex flex-col items-center gap-2 text-center">
            <AlertCircle size={24} className="text-ocean-400" />
            <p className="text-sm font-bold text-ocean-900">Place not found</p>
            <p className="text-sm text-ocean-600">This place may have been removed or is no longer available.</p>
            <Link to="/nearby-places" className="btn-primary text-xs mt-2">Back to Nearby Places</Link>
          </div>
        </main>
      </div>
    )
  }

  const cat = getPlaceCategory(place)
  const catLabel = cat ? CATEGORY_LABELS[cat] : null
  const details = place.nearby_details
  const hasCoords = place.latitude !== null && place.longitude !== null

  return (
    <div className="app-shell">
      <header className="sticky top-0 z-30 bg-ocean-800 text-white shadow-card">
        <div className="flex items-center gap-3 px-4 py-4">
          <Link to="/nearby-places" className="grid h-9 w-9 place-items-center rounded-full bg-ocean-700 hover:bg-ocean-600">
            <ArrowLeft size={18} />
          </Link>
          <h1 className="text-lg font-bold truncate">{place.name}</h1>
        </div>
      </header>

      <main className="flex-1 space-y-4 px-4 py-5">
        {/* Place info */}
        <section className="card space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-bold text-ocean-900">{place.name}</p>
              {catLabel && <p className="text-sm text-ocean-600">{catLabel}</p>}
            </div>
            <span className={`pill shrink-0 text-[10px] ${
              place.verification_status === 'official' || place.verification_status === 'verified'
                ? 'bg-leaf-100 text-leaf-700'
                : place.verification_status === 'community'
                ? 'bg-ocean-50 text-ocean-600'
                : 'bg-sand-200 text-terra-700'
            }`}>
              {place.verification_status}
            </span>
          </div>

          {details?.description && (
            <p className="text-sm text-ocean-700">{details.description}</p>
          )}
          {place.description && !details?.description && (
            <p className="text-sm text-ocean-700">{place.description}</p>
          )}

          {/* Distance */}
          {distance !== null && (
            <div className="flex items-center gap-1.5 text-sm text-leaf-700 font-semibold">
              <Navigation size={14} />
              {formatDistance(distance)}
            </div>
          )}

          {/* Location info */}
          <div className="space-y-1 text-sm text-ocean-600">
            {place.municipality && (
              <p className="flex items-center gap-1.5"><MapPin size={14} /> {place.municipality}{place.barangay ? `, ${place.barangay}` : ''}</p>
            )}
            {place.address && (
              <p className="text-xs text-ocean-500">{place.address}</p>
            )}
          </div>

          {/* Phone */}
          {details?.phone_number && (
            <a
              href={`tel:${details.phone_number}`}
              className="flex items-center gap-1.5 text-sm text-ocean-700 hover:text-ocean-900"
            >
              <Phone size={14} /> {details.phone_number}
            </a>
          )}

          {/* Operating hours */}
          <div className="flex items-center gap-1.5 text-xs text-ocean-500">
            <Clock size={12} />
            {details?.operating_hours ? 'Hours available' : 'Hours not available'}
          </div>

          {/* Source & verification */}
          <div className="border-t border-sand-100 pt-2 text-xs text-ocean-500">
            {details?.data_source && <p>Source: {details.data_source}</p>}
            {place.source && <p>Location source: {place.source}</p>}
            {place.last_verified_at && (
              <p>Last verified: {formatRelativeTime(place.last_verified_at)}</p>
            )}
          </div>
        </section>

        {/* Map preview */}
        {hasCoords && (
          <section className="card space-y-2">
            <h2 className="section-title flex items-center gap-1.5"><MapIcon size={16} /> Map Location</h2>
            <div className="relative h-48 overflow-hidden rounded-xl bg-ocean-50">
              <iframe
                title="Place map"
                width="100%"
                height="100%"
                loading="lazy"
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${place.longitude! - 0.01},${place.latitude! - 0.01},${place.longitude! + 0.01},${place.latitude! + 0.01}&marker=${place.latitude},${place.longitude}`}
                className="border-0"
              />
            </div>
            <a
              href={`https://www.openstreetmap.org/?mlat=${place.latitude}&mlon=${place.longitude}#map=16/${place.latitude}/${place.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-ocean-600 hover:text-ocean-800 underline"
            >
              Open in full map
            </a>
          </section>
        )}

        {!hasCoords && (
          <section className="card flex items-start gap-2">
            <Info size={16} className="mt-0.5 shrink-0 text-ocean-500" />
            <p className="text-xs text-ocean-600">
              Map preview not available — verified coordinates are not on record for this place.
            </p>
          </section>
        )}

        {/* Actions */}
        <section className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="card flex flex-col items-center gap-1.5 py-3 transition active:scale-95 hover:shadow-cardHover"
          >
            {saved ? <BookmarkCheck size={22} className="text-leaf-600" /> : <Bookmark size={22} className="text-ocean-600" />}
            <span className="text-xs font-semibold text-ocean-900">{saved ? 'Saved' : 'Save Place'}</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/plan', { state: { destinationId: place.id, destinationName: place.name } })}
            className="card flex flex-col items-center gap-1.5 py-3 transition active:scale-95 hover:shadow-cardHover"
          >
            <Compass size={22} className="text-ocean-600" />
            <span className="text-xs font-semibold text-ocean-900">Plan Route</span>
          </button>

          {hasCoords && (
            <Link
              to="/transport-map"
              className="card flex flex-col items-center gap-1.5 py-3 transition active:scale-95 hover:shadow-cardHover"
            >
              <MapIcon size={22} className="text-ocean-600" />
              <span className="text-xs font-semibold text-ocean-900">Open Map</span>
            </Link>
          )}

          {details?.phone_number && (
            <a
              href={`tel:${details.phone_number}`}
              className="card flex flex-col items-center gap-1.5 py-3 transition active:scale-95 hover:shadow-cardHover"
            >
              <Phone size={22} className="text-ocean-600" />
              <span className="text-xs font-semibold text-ocean-900">Contact</span>
            </a>
          )}
        </section>

        {/* Report incorrect info */}
        <section className="card space-y-3">
          <div className="flex items-center gap-2">
            <Shield size={16} className="text-terra-600" />
            <h2 className="text-sm font-bold text-ocean-900">Report Incorrect Information</h2>
          </div>
          <p className="text-xs text-ocean-600">
            Found wrong details? Let us know. Your report will be reviewed before any changes are made.
          </p>
          <textarea
            value={reportText}
            onChange={(e) => setReportText(e.target.value)}
            placeholder="Describe what's incorrect (at least 10 characters)…"
            className="input min-h-[60px]"
            maxLength={500}
          />
          {reportResult?.success && (
            <div className="rounded-lg bg-leaf-50 px-3 py-2 text-sm text-leaf-700">
              Thank you! Your report has been submitted for review.
            </div>
          )}
          {reportResult && !reportResult.success && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {reportResult.error || 'Report failed. Please try again.'}
            </div>
          )}
          <button
            type="button"
            onClick={() => void handleReport()}
            disabled={reporting || reportText.trim().length < 10}
            className="btn-secondary w-full text-sm"
          >
            {reporting ? 'Submitting…' : 'Submit Report'}
          </button>
        </section>

        {/* Verification note */}
        <section className="card flex items-start gap-2">
          <Info size={16} className="mt-0.5 shrink-0 text-ocean-500" />
          <p className="text-xs text-ocean-600">
            Place information comes from verified MoryonGo records and community submissions.
            Community-submitted places remain unverified until reviewed by an authorized reviewer.
            Do not assume a place is operational without current confirmation.
          </p>
        </section>
      </main>
    </div>
  )
}
