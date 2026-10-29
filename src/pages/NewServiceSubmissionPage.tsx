import { useEffect, useState, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Loader2,
  Send,
  AlertCircle,
  MapPin,
  Route as RouteIcon,
} from 'lucide-react'
import { useAuth } from '../lib/auth'
import {
  fetchMyOperator,
  fetchTransportModesForForms,
  fetchRoutesForForms,
  fetchLocationsForForms,
  createSubmission,
  SUBMISSION_TYPE_LABELS,
} from '../lib/operatorPortal'
import type { TransportOperatorWithMode, TransportSubmissionType } from '../lib/types'

const SUBMISSION_TYPES: TransportSubmissionType[] = [
  'new_route',
  'route_update',
  'fare_change',
  'schedule_update',
  'service_interruption',
  'contact_update',
]

interface Option {
  id: string
  label: string
}

export function NewServiceSubmissionPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [operator, setOperator] = useState<TransportOperatorWithMode | null | undefined>(undefined)
  const [modes, setModes] = useState<Option[]>([])
  const [routes, setRoutes] = useState<Option[]>([])
  const [locations, setLocations] = useState<Option[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [submissionType, setSubmissionType] = useState<TransportSubmissionType>('new_route')
  const [relatedRouteId, setRelatedRouteId] = useState('')
  const [transportModeId, setTransportModeId] = useState('')
  const [originLocationId, setOriginLocationId] = useState('')
  const [destinationLocationId, setDestinationLocationId] = useState('')
  const [proposedEffectiveDate, setProposedEffectiveDate] = useState('')
  const [supportingNotes, setSupportingNotes] = useState('')

  // Dynamic proposed_data fields
  const [routeName, setRouteName] = useState('')
  const [routeCode, setRouteCode] = useState('')
  const [fareAmount, setFareAmount] = useState('')
  const [scheduleDetails, setScheduleDetails] = useState('')
  const [interruptionReason, setInterruptionReason] = useState('')
  const [interruptionDuration, setInterruptionDuration] = useState('')
  const [contactDetails, setContactDetails] = useState('')

  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }
    void (async () => {
      const [op, modeList, routeList, locList] = await Promise.all([
        fetchMyOperator(),
        fetchTransportModesForForms(),
        fetchRoutesForForms(),
        fetchLocationsForForms(),
      ])
      setOperator(op)
      setModes(modeList.map((m) => ({ id: m.id, label: m.name })))
      setRoutes(routeList.map((r) => ({ id: r.id, label: r.route_name })))
      setLocations(locList.map((l) => ({ id: l.id, label: l.municipality ? `${l.name} (${l.municipality})` : l.name })))
      if (op?.transport_mode_id) setTransportModeId(op.transport_mode_id)
      setLoading(false)
    })()
  }, [user])

  const showRouteField = useMemo(
    () => submissionType === 'route_update' || submissionType === 'fare_change' || submissionType === 'schedule_update' || submissionType === 'service_interruption',
    [submissionType],
  )
  const showLocationFields = useMemo(
    () => submissionType === 'new_route',
    [submissionType],
  )
  const showRouteDetails = useMemo(
    () => submissionType === 'new_route',
    [submissionType],
  )
  const showFareField = useMemo(() => submissionType === 'fare_change', [submissionType])
  const showScheduleField = useMemo(() => submissionType === 'schedule_update', [submissionType])
  const showInterruptionFields = useMemo(() => submissionType === 'service_interruption', [submissionType])
  const showContactField = useMemo(() => submissionType === 'contact_update', [submissionType])

  if (!user) {
    return (
      <div className="app-shell">
        <Header />
        <main className="flex-1 px-4 py-6">
          <div className="card text-center">
            <p className="text-sm font-semibold text-ocean-900">Sign in to create a submission.</p>
            <Link to="/auth" className="btn-primary mt-3">Sign In</Link>
          </div>
        </main>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="app-shell">
        <Header />
        <main className="flex-1 px-4 py-6">
          <div className="card flex items-center gap-3">
            <Loader2 size={20} className="animate-spin text-ocean-600" />
            <p className="text-sm text-ocean-700">Loading…</p>
          </div>
        </main>
      </div>
    )
  }

  if (!operator) {
    return (
      <div className="app-shell">
        <Header />
        <main className="flex-1 px-4 py-6">
          <div className="card text-center space-y-3">
            <AlertCircle size={28} className="mx-auto text-terra-500" />
            <p className="text-sm font-semibold text-ocean-900">No operator application found.</p>
            <p className="text-xs text-ocean-600">You need to register as a transport partner first.</p>
            <Link to="/operator/register" className="btn-primary">Register Now</Link>
          </div>
        </main>
      </div>
    )
  }

  if (operator.verification_status !== 'approved') {
    return (
      <div className="app-shell">
        <Header />
        <main className="flex-1 px-4 py-6">
          <div className="card text-center space-y-3">
            <AlertCircle size={28} className="mx-auto text-terra-500" />
            <p className="text-sm font-semibold text-ocean-900">Your operator application must be approved before you can submit service changes.</p>
            <p className="text-xs text-ocean-600">Current status: {operator.verification_status.replace(/_/g, ' ')}</p>
            <Link to="/operator-portal" className="btn-secondary">Back to Portal</Link>
          </div>
        </main>
      </div>
    )
  }

  const handleSubmit = async () => {
    setError(null)
    setSaving(true)

    const proposedData: Record<string, unknown> = {}
    if (showRouteDetails) {
      if (routeName.trim()) proposedData.route_name = routeName.trim()
      if (routeCode.trim()) proposedData.route_code = routeCode.trim()
    }
    if (showFareField && fareAmount.trim()) {
      const parsed = parseFloat(fareAmount)
      if (isNaN(parsed) || parsed < 0) {
        setError('Fare amount must be a valid positive number.')
        setSaving(false)
        return
      }
      proposedData.proposed_fare = parsed
    }
    if (showScheduleField && scheduleDetails.trim()) {
      proposedData.schedule_details = scheduleDetails.trim()
    }
    if (showInterruptionFields) {
      if (interruptionReason.trim()) proposedData.interruption_reason = interruptionReason.trim()
      if (interruptionDuration.trim()) proposedData.expected_duration = interruptionDuration.trim()
    }
    if (showContactField && contactDetails.trim()) {
      proposedData.contact_details = contactDetails.trim()
    }

    if (Object.keys(proposedData).length === 0) {
      setError('Please provide proposed changes in the form fields.')
      setSaving(false)
      return
    }

    const result = await createSubmission({
      operator_id: operator.id,
      submission_type: submissionType,
      related_route_id: relatedRouteId || undefined,
      transport_mode_id: transportModeId || undefined,
      origin_location_id: originLocationId || undefined,
      destination_location_id: destinationLocationId || undefined,
      proposed_data: proposedData,
      proposed_effective_date: proposedEffectiveDate || undefined,
      supporting_notes: supportingNotes || undefined,
    })

    if (!result.success) {
      setError(result.error || 'Failed to create submission.')
      setSaving(false)
      return
    }

    setSaving(false)
    navigate(`/operator/submission/${result.id}`)
  }

  return (
    <div className="app-shell">
      <Header />
      <main className="flex-1 space-y-4 px-4 py-5">
        {/* Submission type selector */}
        <section className="card space-y-3">
          <label className="form-label">Submission Type *</label>
          <div className="grid grid-cols-2 gap-2">
            {SUBMISSION_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setSubmissionType(t)}
                className={`rounded-xl border p-3 text-xs font-semibold transition active:scale-[0.98] ${
                  submissionType === t
                    ? 'border-ocean-600 bg-ocean-50 text-ocean-800'
                    : 'border-ocean-200 bg-white text-ocean-600'
                }`}
              >
                {SUBMISSION_TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </section>

        {/* Related route */}
        {showRouteField && (
          <section className="card space-y-3">
            <div>
              <label className="form-label">Related Route</label>
              <select
                value={relatedRouteId}
                onChange={(e) => setRelatedRouteId(e.target.value)}
                className="input-field"
              >
                <option value="">Select route…</option>
                {routes.map((r) => (
                  <option key={r.id} value={r.id}>{r.label}</option>
                ))}
              </select>
            </div>
          </section>
        )}

        {/* Location fields for new route */}
        {showLocationFields && (
          <section className="card space-y-3">
            <div>
              <label className="form-label flex items-center gap-1">
                <MapPin size={12} /> Origin Location
              </label>
              <select
                value={originLocationId}
                onChange={(e) => setOriginLocationId(e.target.value)}
                className="input-field"
              >
                <option value="">Select origin…</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>{l.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label flex items-center gap-1">
                <MapPin size={12} /> Destination Location
              </label>
              <select
                value={destinationLocationId}
                onChange={(e) => setDestinationLocationId(e.target.value)}
                className="input-field"
              >
                <option value="">Select destination…</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>{l.label}</option>
                ))}
              </select>
            </div>
          </section>
        )}

        {/* Route details for new route */}
        {showRouteDetails && (
          <section className="card space-y-3">
            <div>
              <label className="form-label flex items-center gap-1">
                <RouteIcon size={12} /> Proposed Route Name
              </label>
              <input
                type="text"
                value={routeName}
                onChange={(e) => setRouteName(e.target.value)}
                className="input-field"
                placeholder="e.g. Boac - Gasan via Highway"
              />
            </div>
            <div>
              <label className="form-label">Proposed Route Code</label>
              <input
                type="text"
                value={routeCode}
                onChange={(e) => setRouteCode(e.target.value)}
                className="input-field"
                placeholder="e.g. BG-01"
              />
            </div>
          </section>
        )}

        {/* Fare change field */}
        {showFareField && (
          <section className="card space-y-3">
            <div>
              <label className="form-label">Proposed Fare (PHP) *</label>
              <input
                type="number"
                step="0.50"
                min="0"
                value={fareAmount}
                onChange={(e) => setFareAmount(e.target.value)}
                className="input-field"
                placeholder="0.00"
              />
            </div>
          </section>
        )}

        {/* Schedule update */}
        {showScheduleField && (
          <section className="card space-y-3">
            <div>
              <label className="form-label">Schedule Details *</label>
              <textarea
                value={scheduleDetails}
                onChange={(e) => setScheduleDetails(e.target.value)}
                rows={4}
                className="input-field"
                placeholder="e.g. First trip 5:00 AM, last trip 7:00 PM, every 30 minutes"
              />
            </div>
          </section>
        )}

        {/* Service interruption */}
        {showInterruptionFields && (
          <section className="card space-y-3">
            <div>
              <label className="form-label">Reason for Interruption *</label>
              <input
                type="text"
                value={interruptionReason}
                onChange={(e) => setInterruptionReason(e.target.value)}
                className="input-field"
                placeholder="e.g. Road maintenance, typhoon, mechanical issue"
              />
            </div>
            <div>
              <label className="form-label">Expected Duration</label>
              <input
                type="text"
                value={interruptionDuration}
                onChange={(e) => setInterruptionDuration(e.target.value)}
                className="input-field"
                placeholder="e.g. 2 days, until further notice"
              />
            </div>
          </section>
        )}

        {/* Contact update */}
        {showContactField && (
          <section className="card space-y-3">
            <div>
              <label className="form-label">Updated Contact Details *</label>
              <textarea
                value={contactDetails}
                onChange={(e) => setContactDetails(e.target.value)}
                rows={3}
                className="input-field"
                placeholder="New phone, email, or booking information"
              />
            </div>
          </section>
        )}

        {/* Transport mode + effective date */}
        <section className="card space-y-3">
          <div>
            <label className="form-label">Transport Mode</label>
            <select
              value={transportModeId}
              onChange={(e) => setTransportModeId(e.target.value)}
              className="input-field"
            >
              <option value="">Select transport mode…</option>
              {modes.map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">Proposed Effective Date</label>
            <input
              type="date"
              value={proposedEffectiveDate}
              onChange={(e) => setProposedEffectiveDate(e.target.value)}
              className="input-field"
            />
          </div>
        </section>

        {/* Supporting notes */}
        <section className="card space-y-3">
          <div>
            <label className="form-label">Supporting Notes</label>
            <textarea
              value={supportingNotes}
              onChange={(e) => setSupportingNotes(e.target.value)}
              rows={4}
              maxLength={4000}
              className="input-field"
              placeholder="Any additional context for the reviewer…"
            />
            <p className="mt-1 text-[10px] text-ocean-400">{supportingNotes.length}/4000</p>
          </div>
        </section>

        {error && (
          <div className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-xs text-red-700">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <button type="button" onClick={handleSubmit} disabled={saving} className="btn-primary w-full">
          {saving ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          Submit for Review
        </button>
      </main>
    </div>
  )
}

function Header() {
  return (
    <header className="sticky top-0 z-30 bg-ocean-800 text-white shadow-card">
      <div className="flex items-center gap-3 px-4 py-4">
        <Link to="/operator-portal" className="grid h-9 w-9 place-items-center rounded-full bg-ocean-700 hover:bg-ocean-600">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-lg font-bold">New Submission</h1>
      </div>
    </header>
  )
}
