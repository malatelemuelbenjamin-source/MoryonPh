import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Compass,
  Map as MapIcon,
  Bookmark,
  Share2,
  Flag,
  ExternalLink,
  Tag,
  User,
  CheckCircle2,
  AlertCircle,
  Info,
  Clock,
} from 'lucide-react'
import {
  fetchEvent,
  verificationClasses,
  VERIFICATION_LABELS,
  statusClasses,
  STATUS_LABELS,
  ADMISSION_LABELS,
  categoryIcon,
  formatEventDate,
  toggleSaveEvent,
  submitEventReport,
  REPORT_CATEGORY_LABELS,
  registerForEvent,
  cancelRegistration,
  checkRegistration,
} from '../lib/cultureEvents'
import { formatRelativeTime } from '../lib/labels'
import type {
  CulturalEventWithDetails,
  EventReportCategory,
} from '../lib/types'

export function EventDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [event, setEvent] = useState<CulturalEventWithDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState(false)
  const [showReport, setShowReport] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)
  const [registered, setRegistered] = useState(false)

  useEffect(() => {
    if (!id) return
    void (async () => {
      const e = await fetchEvent(id)
      setEvent(e)
      setLoading(false)
      if (e) {
        setSaved(e.is_saved)
        setRegistered(await checkRegistration(e.id))
      }
    })()
  }, [id])

  async function handleSave() {
    if (!event) return
    const ok = await toggleSaveEvent(event.id, saved)
    if (ok) setSaved(!saved)
  }

  async function handleShare() {
    const url = window.location.href
    if (navigator.share) {
      try {
        await navigator.share({ title: event?.title ?? 'Event', url })
      } catch { /* user cancelled */ }
    } else {
      try {
        await navigator.clipboard.writeText(url)
        setShareCopied(true)
        setTimeout(() => setShareCopied(false), 2000)
      } catch { /* clipboard not available */ }
    }
  }

  async function handleRegister() {
    if (!event) return
    const { success } = await registerForEvent(event.id)
    if (success) setRegistered(true)
  }

  async function handleCancelReg() {
    if (!event) return
    const { success } = await cancelRegistration(event.id)
    if (success) setRegistered(false)
  }

  if (loading) {
    return (
      <div className="app-shell">
        <DetailHeader />
        <main className="flex-1 px-4 py-5">
          <div className="card flex items-center gap-3">
            <span className="h-3 w-3 animate-pulse rounded-full bg-ocean-400" />
            <p className="text-sm font-semibold text-ocean-700">Loading event…</p>
          </div>
        </main>
      </div>
    )
  }

  if (!event) {
    return (
      <div className="app-shell">
        <DetailHeader />
        <main className="flex-1 px-4 py-5">
          <div className="card flex flex-col items-center gap-3 text-center">
            <AlertCircle size={24} className="text-terra-600" />
            <p className="text-base font-bold text-ocean-900">Event not found</p>
            <p className="text-sm text-ocean-700">This event may have been removed or is not publicly available.</p>
            <Link to="/events" className="btn-secondary">Back to Events</Link>
          </div>
        </main>
      </div>
    )
  }

  const hasCoordinates = event.latitude != null && event.longitude != null
  const isCancelledOrPostponed = event.status === 'cancelled' || event.status === 'postponed'

  return (
    <div className="app-shell">
      <DetailHeader />

      <main className="flex-1 space-y-5 px-4 py-5">
        {isCancelledOrPostponed && (
          <div className={`card flex items-center gap-2 border-l-4 ${event.status === 'cancelled' ? 'border-red-400' : 'border-terra-300'}`}>
            <AlertCircle size={18} className={event.status === 'cancelled' ? 'text-red-600' : 'text-terra-600'} />
            <p className={`text-sm font-bold ${event.status === 'cancelled' ? 'text-red-700' : 'text-terra-700'}`}>
              {event.status === 'cancelled' ? 'This event has been cancelled.' : 'This event has been postponed.'}
            </p>
          </div>
        )}

        <section className="card space-y-3">
          <h2 className="text-xl font-bold text-ocean-900">{event.title}</h2>
          <div className="flex flex-wrap gap-1.5">
            {event.category && (
              <span className="pill bg-sand-200 text-ocean-800">
                {categoryIcon(event.category.slug)} {event.category.name}
              </span>
            )}
            <span className={`pill ${verificationClasses(event.verification_status)}`}>
              {VERIFICATION_LABELS[event.verification_status]}
            </span>
            <span className={`pill ${statusClasses(event.status)}`}>
              {STATUS_LABELS[event.status]}
            </span>
          </div>
        </section>

        {event.description && (
          <section className="card space-y-2">
            <h3 className="section-title">About</h3>
            <p className="text-sm text-ocean-800 whitespace-pre-line">{event.description}</p>
          </section>
        )}

        <section className="card space-y-3">
          <h3 className="section-title">Event Details</h3>
          <div className="space-y-2">
            <DetailRow icon={Calendar} label="Schedule" value={formatEventDate(event.start_at, event.end_at, event.is_all_day)} />
            {event.municipality && (
              <DetailRow icon={MapPin} label="Municipality" value={event.municipality} />
            )}
            {event.venue_name && (
              <DetailRow icon={MapPin} label="Venue" value={event.venue_name} />
            )}
            {event.venue_address && (
              <DetailRow icon={MapPin} label="Address" value={event.venue_address} />
            )}
            {event.organizer_name && (
              <DetailRow icon={User} label="Organizer" value={event.organizer_name} />
            )}
            <DetailRow icon={Tag} label="Admission" value={ADMISSION_LABELS[event.admission_type] + (event.admission_fee ? ` (${event.admission_fee})` : '')} />
            {event.registration_required !== null && (
              <DetailRow icon={CheckCircle2} label="Registration" value={event.registration_required ? 'Required' : 'Not required'} />
            )}
            {event.registration_deadline && (
              <DetailRow icon={Clock} label="Reg. Deadline" value={formatEventDate(event.registration_deadline, null, false)} />
            )}
          </div>
        </section>

        {event.official_source_url && (
          <a
            href={event.official_source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="card flex items-center gap-2 text-sm text-ocean-700 hover:underline"
          >
            <ExternalLink size={16} className="text-ocean-500" />
            <span>Official Source</span>
          </a>
        )}

        {event.verified_at && (
          <p className="flex items-center gap-1 text-xs text-ocean-500">
            <CheckCircle2 size={12} /> Last verified {formatRelativeTime(event.verified_at)}
          </p>
        )}

        {event.verification_status === 'pending_review' && (
          <div className="card flex items-start gap-2 border-l-4 border-terra-300">
            <Info size={14} className="mt-0.5 shrink-0 text-terra-600" />
            <p className="text-xs text-terra-800">
              This event is pending review. Information has not been officially verified yet.
            </p>
          </div>
        )}

        <section className="grid grid-cols-2 gap-2">
          {hasCoordinates && (
            <a
              href={`https://www.openstreetmap.org/?mlat=${event.latitude}&mlon=${event.longitude}#map=16/${event.latitude}/${event.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary text-xs"
            >
              <MapIcon size={14} /> View on Map
            </a>
          )}
          <Link to={`/plan?destination=${encodeURIComponent(event.venue_name ?? event.title)}`} className="btn-secondary text-xs">
            <Compass size={14} /> Plan a Trip
          </Link>
          <button type="button" onClick={handleSave} className="btn-secondary text-xs">
            <Bookmark size={14} /> {saved ? 'Saved' : 'Save Event'}
          </button>
          <button type="button" onClick={handleShare} className="btn-secondary text-xs">
            <Share2 size={14} /> {shareCopied ? 'Link Copied!' : 'Share'}
          </button>
          {event.registration_url && (
            <a
              href={event.registration_url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary text-xs col-span-2"
            >
              <ExternalLink size={14} /> Visit Registration Page
            </a>
          )}
          {event.registration_required === true && !event.registration_url && (
            <button type="button" onClick={registered ? handleCancelReg : handleRegister} className={registered ? 'btn-secondary text-xs col-span-2' : 'btn-primary text-xs col-span-2'}>
              {registered ? 'Cancel Registration' : 'Register'}
            </button>
          )}
          <button type="button" onClick={() => setShowReport(!showReport)} className="btn-secondary text-xs text-terra-700 col-span-2">
            <Flag size={14} /> Report Incorrect Information
          </button>
        </section>

        {showReport && <ReportForm eventId={event.id} onClose={() => setShowReport(false)} />}

        <p className="px-2 text-center text-[10px] text-ocean-400">
          Event information is reviewed by authorized MoryonGo reviewers.
          If details are missing, they have not been verified yet.
        </p>
      </main>
    </div>
  )

  function DetailHeader() {
    return (
      <header className="sticky top-0 z-30 bg-ocean-800 text-white shadow-card">
        <div className="flex items-center gap-3 px-4 py-4">
          <Link to="/events" className="grid h-9 w-9 place-items-center rounded-full bg-ocean-700 hover:bg-ocean-600">
            <ArrowLeft size={18} />
          </Link>
          <h1 className="text-lg font-bold truncate">Event</h1>
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

function ReportForm({ eventId, onClose }: { eventId: string; onClose: () => void }) {
  const [category, setCategory] = useState<EventReportCategory>('incorrect_date')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    setError(null)
    setSubmitting(true)
    const { success, error: err } = await submitEventReport(eventId, category, description)
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
          onChange={(e) => setCategory(e.target.value as EventReportCategory)}
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
