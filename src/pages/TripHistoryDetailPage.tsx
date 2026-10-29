import { useEffect, useState, useCallback } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  MapPin,
  Clock,
  Calendar,
  Navigation as NavIcon,
  Bookmark,
  Trash2,
  Loader2,
  AlertCircle,
  Check,
  Edit3,
  X,
  Footprints,
  Share2,
} from 'lucide-react'
import { fetchTripById, updateTrip, deleteTrip, TRIP_STATUS_LABELS, tripStatusColor } from '../lib/tripHistory'
import { saveJourney } from '../lib/savedRoutes'
import { formatRelativeTime } from '../lib/labels'
import type { TripHistoryWithDetails, TripStatus } from '../lib/types'

export function TripHistoryDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [trip, setTrip] = useState<TripHistoryWithDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [editingNotes, setEditingNotes] = useState(false)
  const [notes, setNotes] = useState('')
  const [actualFare, setActualFare] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [statusMsg, setStatusMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    const data = await fetchTripById(id)
    if (!data) {
      setNotFound(true)
    } else {
      setTrip(data)
      setNotes(data.notes ?? '')
      setActualFare(data.actual_fare != null ? String(data.actual_fare) : '')
    }
    setLoading(false)
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  async function handleStatusChange(newStatus: TripStatus) {
    if (!trip) return
    setStatusMsg(null)
    const res = await updateTrip(trip.id, { trip_status: newStatus })
    if (res.success) {
      await load()
      setStatusMsg(`Trip marked as ${TRIP_STATUS_LABELS[newStatus]}.`)
      setTimeout(() => setStatusMsg(null), 3000)
    } else {
      setStatusMsg(res.error ?? 'Failed to update status.')
    }
  }

  async function handleSaveNotes() {
    if (!trip) return
    setSaving(true)
    const res = await updateTrip(trip.id, { notes })
    setSaving(false)
    if (res.success) {
      setEditingNotes(false)
      await load()
    }
  }

  async function handleSaveActualFare() {
    if (!trip) return
    const fareVal = actualFare.trim() === '' ? null : parseFloat(actualFare)
    if (fareVal != null && fareVal < 0) {
      setStatusMsg('Actual fare cannot be negative.')
      return
    }
    setSaving(true)
    const res = await updateTrip(trip.id, { actual_fare: fareVal })
    setSaving(false)
    if (res.success) {
      await load()
      setStatusMsg('Actual fare saved.')
      setTimeout(() => setStatusMsg(null), 3000)
    }
  }

  async function handleDelete() {
    if (!trip) return
    const res = await deleteTrip(trip.id)
    if (res.success) {
      navigate('/trip-history')
    }
  }

  async function handleSaveAsSavedRoute() {
    if (!trip) return
    const originName = trip.origin_location?.name ?? 'Origin'
    const destName = trip.destination_location?.name ?? 'Destination'
    const res = await saveJourney({
      customName: `${originName} to ${destName}`,
      originLocationId: trip.origin_location_id ?? undefined,
      destinationLocationId: trip.destination_location_id ?? undefined,
      routeId: trip.route_id ?? undefined,
      preferredTransportModeId: trip.transport_mode_id ?? undefined,
      category: 'other',
      notes: trip.notes ?? undefined,
    })
    if (res.success) {
      setStatusMsg('Saved to Saved Routes.')
      setTimeout(() => setStatusMsg(null), 3000)
    } else {
      setStatusMsg(res.error ?? 'Failed to save.')
    }
  }

  if (loading) {
    return (
      <div className="app-shell">
        <header className="sticky top-0 z-30 bg-ocean-800 text-white shadow-card">
          <div className="flex items-center gap-3 px-4 py-4">
            <Link to="/trip-history" className="grid h-9 w-9 place-items-center rounded-full bg-ocean-700">
              <ArrowLeft size={18} />
            </Link>
            <h1 className="text-lg font-bold">Trip Details</h1>
          </div>
        </header>
        <main className="flex-1 px-4 py-6">
          <div className="card flex items-center gap-3">
            <Loader2 size={20} className="animate-spin text-ocean-600" />
            <p className="text-sm text-ocean-700">Loading trip…</p>
          </div>
        </main>
      </div>
    )
  }

  if (notFound || !trip) {
    return (
      <div className="app-shell">
        <header className="sticky top-0 z-30 bg-ocean-800 text-white shadow-card">
          <div className="flex items-center gap-3 px-4 py-4">
            <Link to="/trip-history" className="grid h-9 w-9 place-items-center rounded-full bg-ocean-700">
              <ArrowLeft size={18} />
            </Link>
            <h1 className="text-lg font-bold">Trip Details</h1>
          </div>
        </header>
        <main className="flex-1 px-4 py-6">
          <div className="card flex flex-col items-center gap-3 text-center">
            <AlertCircle size={28} className="text-ocean-400" />
            <p className="text-sm font-semibold text-ocean-800">This trip could not be found.</p>
            <Link to="/trip-history" className="btn-primary w-full">Back to Trip History</Link>
          </div>
        </main>
      </div>
    )
  }

  const originName = trip.origin_location?.name ?? 'Origin'
  const destName = trip.destination_location?.name ?? 'Destination'
  const segments = trip.trip_history_segments

  return (
    <div className="app-shell">
      <header className="sticky top-0 z-30 bg-ocean-800 text-white shadow-card">
        <div className="flex items-center gap-3 px-4 py-4">
          <Link to="/trip-history" className="grid h-9 w-9 place-items-center rounded-full bg-ocean-700 hover:bg-ocean-600">
            <ArrowLeft size={18} />
          </Link>
          <h1 className="text-lg font-bold">Trip Details</h1>
        </div>
      </header>

      <main className="flex-1 space-y-4 px-4 py-5">
        {/* Header card */}
        <section className="card space-y-3">
          <div className="flex items-center gap-2">
            <MapPin size={16} className="text-terra-500" />
            <span className="text-sm font-bold text-ocean-900">{originName}</span>
            <span className="text-ocean-400">→</span>
            <span className="text-sm font-bold text-ocean-900">{destName}</span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`pill ${tripStatusColor(trip.trip_status)}`}>
              {TRIP_STATUS_LABELS[trip.trip_status]}
            </span>
            {trip.transport_mode && (
              <span className="pill bg-ocean-50 text-ocean-700">{trip.transport_mode.name}</span>
            )}
          </div>

          <div className="space-y-1 text-xs text-ocean-600">
            {trip.planned_departure_at && (
              <p className="flex items-center gap-1.5">
                <Calendar size={12} />
                Planned departure: {new Date(trip.planned_departure_at).toLocaleString()}
              </p>
            )}
            {trip.started_at && (
              <p className="flex items-center gap-1.5">
                <Clock size={12} />
                Started: {new Date(trip.started_at).toLocaleString()}
              </p>
            )}
            {trip.completed_at && (
              <p className="flex items-center gap-1.5">
                <Check size={12} />
                Completed: {new Date(trip.completed_at).toLocaleString()}
              </p>
            )}
            <p className="flex items-center gap-1.5">
              <Clock size={12} />
              Updated {formatRelativeTime(trip.updated_at)}
            </p>
          </div>
        </section>

        {statusMsg && (
          <p className="rounded-lg bg-leaf-50 px-3 py-2 text-xs text-leaf-700 flex items-center gap-1">
            <Check size={12} /> {statusMsg}
          </p>
        )}

        {/* Status actions */}
        <section className="card space-y-3">
          <h2 className="section-title">Change Trip Status</h2>
          <p className="text-xs text-ocean-600">
            Only you can change the status. Route searches and fare views do not automatically mark trips as completed.
          </p>
          <div className="flex flex-wrap gap-2">
            {(['planned', 'saved', 'started', 'completed', 'cancelled'] as TripStatus[]).map((s) => (
              <button
                key={s}
                type="button"
                disabled={trip.trip_status === s}
                onClick={() => void handleStatusChange(s)}
                className={`rounded-xl px-3 py-2 text-xs font-semibold transition active:scale-95 ${
                  trip.trip_status === s
                    ? tripStatusColor(s)
                    : 'bg-ocean-50 text-ocean-700 hover:bg-ocean-100'
                }`}
              >
                {TRIP_STATUS_LABELS[s]}
              </button>
            ))}
          </div>
        </section>

        {/* Route summary */}
        {(trip.route || segments.length > 0) && (
          <section className="card space-y-3">
            <h2 className="section-title">Route Summary</h2>
            {trip.route && (
              <div className="rounded-xl bg-ocean-50 px-3 py-2 text-sm">
                <p className="font-semibold text-ocean-900">{trip.route.route_name}</p>
                {trip.route.route_code && (
                  <p className="text-xs text-ocean-600">Code: {trip.route.route_code}</p>
                )}
              </div>
            )}
            {segments.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-ocean-600">
                  {segments.length} segment{segments.length > 1 ? 's' : ''}
                </p>
                {segments.map((seg) => (
                  <div key={seg.id} className="rounded-xl bg-ocean-50 p-3 text-sm">
                    <div className="flex items-center gap-1.5 text-ocean-800">
                      <span className="text-xs font-bold text-ocean-500">#{seg.segment_order}</span>
                      <span className="font-semibold">{seg.origin_location?.name ?? 'Origin'}</span>
                      <span className="text-ocean-400">→</span>
                      <span className="font-semibold">{seg.destination_location?.name ?? 'Destination'}</span>
                    </div>
                    {seg.transport_mode && (
                      <p className="mt-1 text-xs text-ocean-600">{seg.transport_mode.name}</p>
                    )}
                    {seg.route && (
                      <p className="text-xs text-ocean-500">{seg.route.route_name}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
            <p className="text-[10px] text-ocean-400">
              Route details were captured when this trip was created. Current route information may differ.
            </p>
          </section>
        )}

        {/* Fare information */}
        <section className="card space-y-3">
          <h2 className="section-title">Fare</h2>

          {trip.estimated_fare != null && (
            <div className="rounded-xl bg-ocean-50 p-3">
              <p className="text-xs font-semibold text-ocean-600">Estimated Fare (at time of planning)</p>
              <p className="text-lg font-bold text-ocean-900">
                {trip.currency_code} {trip.estimated_fare.toFixed(2)}
              </p>
              <p className="text-[10px] text-ocean-400">
                This is an estimate captured when the trip was planned, not proof of the amount paid.
              </p>
            </div>
          )}

          {trip.fare_snapshot && (
            <div className="rounded-xl bg-sand-50 p-3 text-xs text-ocean-600">
              <p className="font-semibold">Fare snapshot (historical)</p>
              <pre className="mt-1 whitespace-pre-wrap break-words text-[10px]">
                {JSON.stringify(trip.fare_snapshot, null, 2)}
              </pre>
            </div>
          )}

          {/* Actual fare input */}
          <div>
            <label className="text-xs font-semibold text-ocean-700">Actual Fare Paid (you enter this)</label>
            <div className="mt-1 flex gap-2">
              <input
                type="number"
                min="0"
                step="0.01"
                value={actualFare}
                onChange={(e) => setActualFare(e.target.value)}
                placeholder="Enter amount you paid"
                className="input flex-1"
              />
              <button
                type="button"
                onClick={() => void handleSaveActualFare()}
                disabled={saving}
                className="btn-secondary px-4"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              </button>
            </div>
            <p className="mt-1 text-[10px] text-ocean-400">
              User-entered. This is not an official transport fare.
            </p>
          </div>
        </section>

        {/* Notes */}
        <section className="card space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="section-title">Notes</h2>
            {!editingNotes && (
              <button type="button" onClick={() => setEditingNotes(true)} className="text-ocean-600">
                <Edit3 size={16} />
              </button>
            )}
          </div>
          {editingNotes ? (
            <div className="space-y-2">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={1000}
                rows={3}
                placeholder="Add a private note (e.g. Bring an umbrella)"
                className="input"
              />
              <div className="flex gap-2">
                <button type="button" onClick={() => void handleSaveNotes()} disabled={saving} className="btn-primary flex-1 text-sm">
                  {saving ? <Loader2 size={14} className="animate-spin" /> : 'Save'}
                </button>
                <button type="button" onClick={() => { setEditingNotes(false); setNotes(trip.notes ?? '') }} className="btn-secondary flex-1 text-sm">
                  <X size={14} /> Cancel
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-ocean-700">
              {trip.notes ?? <span className="text-ocean-400">No notes added.</span>}
            </p>
          )}
        </section>

        {/* Actions */}
        <section className="card space-y-2">
          <button
            type="button"
            onClick={() =>
              navigate('/plan', {
                state: {
                  fromId: trip.origin_location_id,
                  toId: trip.destination_location_id,
                },
              })
            }
            className="btn-primary w-full text-sm"
          >
            <NavIcon size={16} /> Reopen in Route Planner
          </button>
          <button type="button" onClick={() => void handleSaveAsSavedRoute()} className="btn-secondary w-full text-sm">
            <Bookmark size={16} /> Save to Saved Routes
          </button>
          <Link to="/transport-map" className="btn-secondary w-full text-sm">
            <MapPin size={16} /> View on Map
          </Link>
          <Link to={`/share?source=trip_history&id=${trip.id}`} className="btn-secondary w-full text-sm">
            <Share2 size={16} /> Share This Trip
          </Link>
        </section>

        {/* Delete */}
        <section className="card border-red-200">
          {!confirmDelete ? (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="flex w-full items-center gap-2 text-sm font-semibold text-red-700"
            >
              <Trash2 size={16} /> Delete This Trip
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-sm font-bold text-red-700">Delete this trip record?</p>
              <p className="text-xs text-ocean-600">This action cannot be undone.</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => void handleDelete()} className="flex-1 rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white">
                  Delete
                </button>
                <button type="button" onClick={() => setConfirmDelete(false)} className="flex-1 rounded-xl bg-ocean-50 px-4 py-2 text-sm font-semibold text-ocean-700">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Verification info */}
        <p className="flex items-center gap-1.5 px-2 text-[10px] text-ocean-400">
          <Footprints size={10} />
          Trip history records your planned and confirmed journeys. They do not verify that transportation operated as described.
        </p>
      </main>
    </div>
  )
}
