import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  MapPin,
  Compass,
  Map as MapIcon,
  Bookmark,
  Share2,
  Flag,
  ExternalLink,
  Tag,
  Phone,
  Globe,
  Accessibility,
  CheckCircle2,
  AlertCircle,
  Info,
} from 'lucide-react'
import {
  fetchDestination,
  verificationClasses,
  VERIFICATION_LABELS,
  categoryIcon,
  submitDestinationReport,
  REPORT_CATEGORY_LABELS,
} from '../lib/explore'
import { saveVerifiedLocation, checkIfSaved, saveCustomPlace } from '../lib/savedPlaces'
import { formatRelativeTime } from '../lib/labels'
import type {
  DestinationWithDetails,
  DestinationReportCategory,
} from '../lib/types'

export function DestinationDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [dest, setDest] = useState<DestinationWithDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState(false)
  const [showReport, setShowReport] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)

  useEffect(() => {
    if (!id) return
    void (async () => {
      const d = await fetchDestination(id)
      setDest(d)
      setLoading(false)
      if (d?.location_id) {
        const { saved: isSaved } = await checkIfSaved(d.location_id)
        setSaved(isSaved)
      }
    })()
  }, [id])

  async function handleSave() {
    if (!dest) return
    if (dest.location_id) {
      const { success } = await saveVerifiedLocation({
        locationId: dest.location_id,
        customName: dest.name,
        category: 'favorite',
        isFavorite: true,
      })
      if (success) setSaved(true)
    } else {
      const { success } = await saveCustomPlace({
        customName: dest.name,
        customAddress: dest.address ?? undefined,
        latitude: dest.latitude ?? undefined,
        longitude: dest.longitude ?? undefined,
        category: 'favorite',
        isFavorite: true,
      })
      if (success) setSaved(true)
    }
  }

  async function handleShare() {
    const url = window.location.href
    if (navigator.share) {
      try {
        await navigator.share({ title: dest?.name ?? 'Destination', url })
      } catch { /* user cancelled */ }
    } else {
      try {
        await navigator.clipboard.writeText(url)
        setShareCopied(true)
        setTimeout(() => setShareCopied(false), 2000)
      } catch { /* clipboard not available */ }
    }
  }

  if (loading) {
    return (
      <div className="app-shell">
        <DetailHeader />
        <main className="flex-1 px-4 py-5">
          <div className="card flex items-center gap-3">
            <span className="h-3 w-3 animate-pulse rounded-full bg-ocean-400" />
            <p className="text-sm font-semibold text-ocean-700">Loading destination…</p>
          </div>
        </main>
      </div>
    )
  }

  if (!dest) {
    return (
      <div className="app-shell">
        <DetailHeader />
        <main className="flex-1 px-4 py-5">
          <div className="card flex flex-col items-center gap-3 text-center">
            <AlertCircle size={24} className="text-terra-600" />
            <p className="text-base font-bold text-ocean-900">Destination not found</p>
            <p className="text-sm text-ocean-700">This destination may have been removed or is not publicly available.</p>
            <Link to="/explore" className="btn-secondary">Back to Explore</Link>
          </div>
        </main>
      </div>
    )
  }

  const hasCoordinates = dest.latitude != null && dest.longitude != null

  return (
    <div className="app-shell">
      <DetailHeader />

      <main className="flex-1 space-y-5 px-4 py-5">
        {/* Title and verification */}
        <section className="card space-y-3">
          <h2 className="text-xl font-bold text-ocean-900">{dest.name}</h2>
          <div className="flex flex-wrap gap-1.5">
            {dest.category && (
              <span className="pill bg-sand-200 text-ocean-800">
                {categoryIcon(dest.category.slug)} {dest.category.name}
              </span>
            )}
            <span className={`pill ${verificationClasses(dest.verification_status)}`}>
              {VERIFICATION_LABELS[dest.verification_status]}
            </span>
          </div>
          {dest.municipality && (
            <p className="flex items-center gap-1 text-sm text-ocean-700">
              <MapPin size={16} className="text-ocean-500" /> {dest.municipality}, Marinduque
            </p>
          )}
        </section>

        {/* Description */}
        {dest.description && (
          <section className="card space-y-2">
            <h3 className="section-title">About</h3>
            <p className="text-sm text-ocean-800 whitespace-pre-line">{dest.description}</p>
          </section>
        )}

        {/* Details grid */}
        <section className="card space-y-3">
          <h3 className="section-title">Details</h3>
          <div className="space-y-2">
            {dest.address && (
              <DetailRow icon={MapPin} label="Address" value={dest.address} />
            )}
            {dest.entrance_fee && (
              <DetailRow icon={Tag} label="Entrance Fee" value={dest.entrance_fee} />
            )}
            {dest.contact_information && (
              <DetailRow icon={Phone} label="Contact" value={dest.contact_information} />
            )}
            {dest.official_website && (
              <a
                href={dest.official_website}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-ocean-700 hover:underline"
              >
                <Globe size={16} className="text-ocean-500" />
                <span>Website</span>
                <ExternalLink size={12} className="text-ocean-400" />
              </a>
            )}
            {dest.accessibility_information && (
              <DetailRow
                icon={Accessibility}
                label="Accessibility"
                value={JSON.stringify(dest.accessibility_information)}
              />
            )}
          </div>
          {!dest.address && !dest.entrance_fee && !dest.contact_information && !dest.official_website && (
            <p className="text-sm text-ocean-600">Detailed information is not yet available for this destination.</p>
          )}
        </section>

        {/* Verification info */}
        {dest.verified_at && (
          <p className="flex items-center gap-1 text-xs text-ocean-500">
            <CheckCircle2 size={12} /> Last verified {formatRelativeTime(dest.verified_at)}
          </p>
        )}
        {dest.verification_status === 'pending_review' && (
          <div className="card flex items-start gap-2 border-l-4 border-terra-300">
            <Info size={14} className="mt-0.5 shrink-0 text-terra-600" />
            <p className="text-xs text-terra-800">
              This destination is pending review. Information has not been officially verified yet.
            </p>
          </div>
        )}

        {/* Action buttons */}
        <section className="grid grid-cols-2 gap-2">
          {hasCoordinates && (
            <a
              href={`https://www.openstreetmap.org/?mlat=${dest.latitude}&mlon=${dest.longitude}#map=16/${dest.latitude}/${dest.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary text-xs"
            >
              <MapIcon size={14} /> View on Map
            </a>
          )}
          <Link to={`/plan?destination=${encodeURIComponent(dest.name)}`} className="btn-secondary text-xs">
            <Compass size={14} /> Plan a Trip
          </Link>
          <button
            type="button"
            onClick={handleSave}
            disabled={saved}
            className={saved ? 'btn-secondary text-xs opacity-60' : 'btn-secondary text-xs'}
          >
            <Bookmark size={14} /> {saved ? 'Saved' : 'Save'}
          </button>
          <button type="button" onClick={handleShare} className="btn-secondary text-xs">
            <Share2 size={14} /> {shareCopied ? 'Link Copied!' : 'Share'}
          </button>
          <button type="button" onClick={() => setShowReport(!showReport)} className="btn-secondary text-xs text-terra-700 col-span-2">
            <Flag size={14} /> Report Incorrect Information
          </button>
        </section>

        {/* Report form */}
        {showReport && (
          <ReportForm destinationId={dest.id} onClose={() => setShowReport(false)} />
        )}

        {/* Disclaimer */}
        <p className="px-2 text-center text-[10px] text-ocean-400">
          Destination information is reviewed by authorized MoryonGo reviewers.
          If details are missing, they have not been verified yet.
        </p>
      </main>
    </div>
  )

  function DetailHeader() {
    return (
      <header className="sticky top-0 z-30 bg-ocean-800 text-white shadow-card">
        <div className="flex items-center gap-3 px-4 py-4">
          <Link to="/explore" className="grid h-9 w-9 place-items-center rounded-full bg-ocean-700 hover:bg-ocean-600">
            <ArrowLeft size={18} />
          </Link>
          <h1 className="text-lg font-bold truncate">Destination</h1>
        </div>
      </header>
    )
  }
}

function DetailRow({ icon: Icon, label, value }: { icon: typeof MapPin; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <Icon size={16} className="mt-0.5 shrink-0 text-ocean-500" />
      <div>
        <p className="text-[10px] font-semibold text-ocean-500">{label}</p>
        <p className="text-ocean-800">{value}</p>
      </div>
    </div>
  )
}

function ReportForm({ destinationId, onClose }: { destinationId: string; onClose: () => void }) {
  const [category, setCategory] = useState<DestinationReportCategory>('incorrect_address')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    setError(null)
    setSubmitting(true)
    const { success, error: err } = await submitDestinationReport(destinationId, category, description)
    setSubmitting(false)
    if (success) {
      setSuccess(true)
      setTimeout(() => onClose(), 2000)
    } else {
      setError(err ?? 'Failed to submit report.')
    }
  }

  if (success) {
    return (
      <div className="card flex flex-col items-center gap-2 text-center">
        <CheckCircle2 size={24} className="text-leaf-600" />
        <p className="text-sm font-bold text-ocean-900">Report submitted</p>
        <p className="text-xs text-ocean-600">Thank you. Our team will review your report.</p>
      </div>
    )
  }

  return (
    <section className="card space-y-3">
      <div className="flex items-center gap-2">
        <Flag size={16} className="text-terra-600" />
        <h3 className="text-sm font-bold text-ocean-900">Report Incorrect Information</h3>
      </div>
      <div>
        <label className="block text-xs font-semibold text-ocean-700 mb-1">Issue Type</label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as DestinationReportCategory)}
          className="input-field"
        >
          {Object.entries(REPORT_CATEGORY_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-semibold text-ocean-700 mb-1">Description *</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          maxLength={4000}
          className="input-field"
          placeholder="Describe what is incorrect and what the correct information should be."
        />
      </div>
      {error && <p className="text-xs text-terra-700 font-semibold">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={handleSubmit} disabled={submitting} className="btn-primary flex-1 text-xs">
          {submitting ? 'Submitting…' : 'Submit Report'}
        </button>
        <button type="button" onClick={onClose} className="btn-secondary text-xs">Cancel</button>
      </div>
    </section>
  )
}
