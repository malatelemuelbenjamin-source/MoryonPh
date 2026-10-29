import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowDownUp,
  Crosshair,
  MapPin,
  Clock,
  Footprints,
  Search as SearchIcon,
  AlertCircle,
  Navigation as NavigationIcon,
  Route as RouteIcon,
  Wallet,
  Table2,
  Bookmark,
  X,
  Check,
  Loader2,
  History,
} from 'lucide-react'
import { LocationSearchField } from '../components/LocationSearchField'
import { useLocation } from '../lib/location'
import { searchLocationsForRouting, planRoutes } from '../lib/routes'
import { useAuth } from '../lib/auth'
import { saveJourney, ROUTE_CATEGORY_LABELS } from '../lib/savedRoutes'
import { createTrip } from '../lib/tripHistory'
import type { LocationRow, PlannedRoute, SavedRouteCategory } from '../lib/types'
import { verificationClasses, VERIFICATION_LABELS } from '../lib/labels'

type SearchState = 'idle' | 'loading' | 'done' | 'error'

export function RoutePlannerPage() {
  const navigate = useNavigate()
  const { status, requestPermission, coords } = useLocation()
  const { user } = useAuth()

  const [from, setFrom] = useState<LocationRow | null>(null)
  const [to, setTo] = useState<LocationRow | null>(null)
  const [searchState, setSearchState] = useState<SearchState>('idle')
  const [results, setResults] = useState<PlannedRoute[]>([])
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [savingTrip, setSavingTrip] = useState<PlannedRoute | null>(null)
  const [planningTrip, setPlanningTrip] = useState<PlannedRoute | null>(null)

  function swap() {
    setFrom(to)
    setTo(from)
  }

  async function useCurrentLocation() {
    if (status !== 'granted') {
      await requestPermission()
      return
    }
    if (!coords) return
    // Find nearest verified location to current coordinates.
    const nearby = await searchLocationsForRouting('', 50)
    if (nearby.length === 0) return
    let best = nearby[0]
    let bestDist = Infinity
    for (const loc of nearby) {
      if (loc.latitude == null || loc.longitude == null) continue
      const d =
        (loc.latitude - coords.lat) ** 2 + (loc.longitude - coords.lng) ** 2
      if (d < bestDist) {
        bestDist = d
        best = loc
      }
    }
    setFrom(best)
  }

  function findRoutes() {
    setErrorMsg(null)
    if (!from) {
      setErrorMsg('Please select your starting location.')
      return
    }
    if (!to) {
      setErrorMsg('Please select your destination.')
      return
    }
    if (from.id === to.id) {
      setErrorMsg('Your starting point and destination are the same.')
      return
    }
    setSearchState('loading')
    setResults([])
    void (async () => {
      const res = await planRoutes(from, to)
      if (res.error) {
        setSearchState('error')
        setErrorMsg('Route information is temporarily unavailable. Please try again.')
        return
      }
      setResults(res.routes)
      setSearchState('done')
    })()
  }

  return (
    <div className="app-shell">
      <header className="sticky top-0 z-30 bg-ocean-800 text-white shadow-card">
        <div className="flex items-center gap-3 px-4 py-4">
          <Link
            to="/"
            aria-label="Back to home"
            className="grid h-9 w-9 place-items-center rounded-full bg-ocean-700 hover:bg-ocean-600"
          >
            <ArrowLeft size={18} />
          </Link>
          <h1 className="text-lg font-bold">Plan Your Trip</h1>
          <span
            className={`ml-auto flex items-center gap-1 text-xs ${
              status === 'granted' ? 'text-leaf-400' : 'text-terra-300'
            }`}
          >
            <Crosshair size={14} />
            {status === 'granted' ? 'GPS on' : 'GPS off'}
          </span>
        </div>
      </header>

      <main className="flex-1 space-y-5 px-4 py-5">
        {/* From / To */}
        <section className="card space-y-3">
          <LocationSearchField
            label="From"
            placeholder="Where are you starting?"
            value={from}
            onChange={setFrom}
            allowCurrentLocation
            onUseCurrentLocation={useCurrentLocation}
          />

          <div className="flex justify-center">
            <button
              type="button"
              onClick={swap}
              aria-label="Swap from and to"
              className="grid h-10 w-10 place-items-center rounded-full bg-ocean-700 text-white shadow-card hover:bg-ocean-800 active:scale-95"
            >
              <ArrowDownUp size={18} />
            </button>
          </div>

          <LocationSearchField
            label="To"
            placeholder="Where are you going?"
            value={to}
            onChange={setTo}
          />

          {errorMsg && (
            <p className="flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
              <AlertCircle size={16} /> {errorMsg}
            </p>
          )}

          <button
            type="button"
            onClick={findRoutes}
            disabled={searchState === 'loading'}
            className="btn-primary w-full text-lg"
          >
            <SearchIcon size={20} />
            {searchState === 'loading' ? 'Finding routes…' : 'Find Routes'}
          </button>
        </section>

        {/* Results */}
        {searchState === 'idle' && (
          <div className="card flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-ocean-100 text-ocean-700">
              <NavigationIcon size={20} />
            </span>
            <p className="text-sm font-semibold text-ocean-800">
              Enter your starting point and destination.
            </p>
          </div>
        )}

        {searchState === 'loading' && (
          <div className="card">
            <div className="flex items-center gap-3">
              <span className="h-3 w-3 animate-pulse rounded-full bg-ocean-400" />
              <p className="text-sm font-semibold text-ocean-700">
                Searching verified routes…
              </p>
            </div>
            <div className="mt-3 space-y-3">
              {[0, 1].map((i) => (
                <div
                  key={i}
                  className="h-24 animate-pulse rounded-xl bg-ocean-50"
                  aria-hidden="true"
                />
              ))}
            </div>
          </div>
        )}

        {searchState === 'error' && (
          <div className="card flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-red-100 text-red-700">
              <AlertCircle size={20} />
            </span>
            <p className="text-sm font-semibold text-ocean-800">
              Route information is temporarily unavailable. Please try again.
            </p>
          </div>
        )}

        {searchState === 'done' && results.length === 0 && (
          <div className="card flex flex-col items-center gap-3 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-sand-200 text-ocean-700">
              <RouteIcon size={24} />
            </span>
            <p className="text-base font-bold text-ocean-900">
              No verified route found.
            </p>
            <p className="text-sm text-ocean-700">
              Try another starting point or destination.
            </p>
          </div>
        )}

        {searchState === 'done' && results.length > 0 && (
          <section className="space-y-3">
            <h2 className="section-title">Available Routes</h2>
            {results.map((r) => (
              <RouteResultCard
                key={r.id}
                route={r}
                onView={() => {
                  navigate('/route-detail', {
                    state: { plannedRoute: r, from, to },
                  })
                }}
                onCheckFare={() => {
                  const firstRouteId = r.legs[0]?.route.id
                  navigate('/fare', {
                    state: {
                      routeId: firstRouteId,
                      fromName: from?.name,
                      toName: to?.name,
                    },
                  })
                }}
                onViewMatrix={() => {
                  const firstRouteId = r.legs[0]?.route.id
                  navigate('/fare-matrix', { state: { routeId: firstRouteId } })
                }}
                onSaveTrip={user ? () => setSavingTrip(r) : undefined}
                onSavePlannedTrip={user ? () => setPlanningTrip(r) : undefined}
              />
            ))}
          </section>
        )}
      </main>

      {savingTrip && from && to && (
        <SaveTripModal
          plannedRoute={savingTrip}
          originLocationId={from.id}
          destinationLocationId={to.id}
          originName={from.name}
          destinationName={to.name}
          onClose={() => setSavingTrip(null)}
          onSaved={() => setSavingTrip(null)}
        />
      )}

      {planningTrip && from && to && (
        <SavePlannedTripModal
          plannedRoute={planningTrip}
          originLocationId={from.id}
          destinationLocationId={to.id}
          originName={from.name}
          destinationName={to.name}
          onClose={() => setPlanningTrip(null)}
          onSaved={() => setPlanningTrip(null)}
        />
      )}
    </div>
  )
}

interface RouteResultCardProps {
  route: PlannedRoute
  onView: () => void
  onCheckFare: () => void
  onViewMatrix: () => void
  onSaveTrip?: () => void
  onSavePlannedTrip?: () => void
}

function RouteResultCard({ route, onView, onCheckFare, onViewMatrix, onSaveTrip, onSavePlannedTrip }: RouteResultCardProps) {
  const firstLeg = route.legs[0]
  const lastLeg = route.legs[route.legs.length - 1]
  const transportChain = route.legs
    .map((l) => l.route.transport_mode?.name ?? 'Transport')
    .join(' → ')

  return (
    <div className="card space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="pill bg-ocean-100 text-ocean-800">
          <Clock size={12} />
          {route.estimatedDurationMinutes
            ? `${route.estimatedDurationMinutes} min`
            : 'Est. time N/A'}
        </span>
        <span className="pill bg-terra-100 text-terra-700">
          {route.transfers === 0 ? 'Direct' : `${route.transfers} transfer${route.transfers > 1 ? 's' : ''}`}
        </span>
        {route.walkingMinutes != null && route.walkingMinutes > 0 && (
          <span className="pill bg-leaf-400/30 text-leaf-700">
            <Footprints size={12} /> {route.walkingMinutes} min walk
          </span>
        )}
        <span className={`pill ${verificationClasses(route.verificationStatus)}`}>
          {VERIFICATION_LABELS[route.verificationStatus]}
        </span>
      </div>

      <div className="flex items-center gap-2 text-sm text-ocean-800">
        <MapPin size={16} className="text-terra-500" />
        <span className="font-semibold">
          {firstLeg.route.origin_location?.name ?? 'Origin'}
        </span>
        <span className="text-ocean-500">→</span>
        <span className="font-semibold">
          {lastLeg.route.destination_location?.name ?? 'Destination'}
        </span>
      </div>

      <div className="rounded-xl bg-ocean-50 px-3 py-2 text-sm text-ocean-800">
        <span className="font-semibold">Transport:</span> {transportChain}
      </div>

      <button type="button" onClick={onView} className="btn-primary w-full">
        View Route
      </button>
      <button type="button" onClick={onCheckFare} className="btn-secondary w-full">
        <Wallet size={18} />
        Check Fare
      </button>
      <button type="button" onClick={onViewMatrix} className="btn-secondary w-full">
        <Table2 size={18} />
        Fare Matrix
      </button>
      {onSaveTrip && (
        <button type="button" onClick={onSaveTrip} className="btn-secondary w-full">
          <Bookmark size={18} />
          I-save ang Biyahe (Save Trip)
        </button>
      )}
      {onSavePlannedTrip && (
        <button type="button" onClick={onSavePlannedTrip} className="btn-secondary w-full">
          <History size={18} />
          Add to Trip History
        </button>
      )}
    </div>
  )
}

// ---- Save Trip Modal ----------------------------------------------------

function SaveTripModal({
  plannedRoute,
  originLocationId,
  destinationLocationId,
  originName,
  destinationName,
  onClose,
  onSaved,
}: {
  plannedRoute: PlannedRoute
  originLocationId: string
  destinationLocationId: string
  originName: string
  destinationName: string
  onClose: () => void
  onSaved: () => void
}) {
  const defaultName = `${originName} to ${destinationName}`
  const [customName, setCustomName] = useState(defaultName)
  const [category, setCategory] = useState<SavedRouteCategory>('commute')
  const [notes, setNotes] = useState('')
  const [isFavorite, setIsFavorite] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const firstRouteId = plannedRoute.legs[0]?.route.id
  const preferredModeId = plannedRoute.legs[0]?.route.transport_mode_id ?? null

  const handleSave = async () => {
    setSaving(true)
    setError(null)

    const segments = plannedRoute.legs.map((leg, idx) => ({
      sequenceNumber: idx + 1,
      routeId: leg.route.id,
      transportModeId: leg.route.transport_mode_id ?? undefined,
      originLocationId: leg.route.origin_location_id,
      destinationLocationId: leg.route.destination_location_id,
    }))

    const snapshot: Record<string, unknown> = {
      legs: plannedRoute.legs.map((leg) => ({
        routeId: leg.route.id,
        routeName: leg.route.route_name,
        transportMode: leg.route.transport_mode?.name ?? null,
        origin: leg.route.origin_location?.name ?? null,
        destination: leg.route.destination_location?.name ?? null,
        estimatedDurationMinutes: leg.route.estimated_duration_minutes ?? null,
      })),
      transfers: plannedRoute.transfers,
      estimatedDurationMinutes: plannedRoute.estimatedDurationMinutes,
      savedAt: new Date().toISOString(),
    }

    const result = await saveJourney({
      customName,
      originLocationId,
      destinationLocationId,
      routeId: plannedRoute.legs.length === 1 ? firstRouteId : undefined,
      preferredTransportModeId: preferredModeId ?? undefined,
      category,
      notes: notes || undefined,
      isFavorite,
      journeySnapshot: snapshot,
      segments,
    })

    setSaving(false)
    if (result.success) {
      onSaved()
    } else {
      setError(result.error ?? 'Failed to save trip.')
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="max-h-[85vh] w-full max-w-md overflow-auto rounded-2xl bg-white p-5 shadow-cardHover">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-ocean-900">I-save ang Biyahe</h3>
          <button type="button" onClick={onClose} className="text-ocean-500">
            <X size={20} />
          </button>
        </div>

        {/* Journey summary */}
        <div className="mt-3 rounded-xl bg-ocean-50 p-3 space-y-1.5">
          <div className="flex items-center gap-2 text-sm text-ocean-800">
            <MapPin size={14} className="text-terra-500" />
            <span className="font-semibold">{originName}</span>
            <span className="text-ocean-400">→</span>
            <span className="font-semibold">{destinationName}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <span className="pill bg-ocean-100 text-ocean-800 text-[10px]">
              <Clock size={10} />
              {plannedRoute.estimatedDurationMinutes
                ? `${plannedRoute.estimatedDurationMinutes} min`
                : 'Est. time N/A'}
            </span>
            <span className="pill bg-terra-100 text-terra-700 text-[10px]">
              {plannedRoute.transfers === 0
                ? 'Direct'
                : `${plannedRoute.transfers} transfer${plannedRoute.transfers > 1 ? 's' : ''}`}
            </span>
          </div>
          <div className="text-xs text-ocean-600">
            {plannedRoute.legs.map((l) => l.route.transport_mode?.name ?? 'Transport').join(' → ')}
          </div>
          <p className="text-[10px] text-ocean-400">
            Fare and schedule will be refreshed when you reopen this trip.
          </p>
        </div>

        {/* Form fields */}
        <div className="mt-4 space-y-3">
          <div>
            <label className="text-xs font-semibold text-ocean-600">Trip Name</label>
            <input
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              maxLength={100}
              placeholder="e.g. Home to School"
              className="mt-1 w-full rounded-xl bg-ocean-50 px-3 py-2.5 text-sm text-ocean-900 placeholder:text-ocean-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-ocean-600">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as SavedRouteCategory)}
              className="mt-1 w-full rounded-xl bg-ocean-50 px-3 py-2.5 text-sm text-ocean-900 focus:outline-none"
            >
              {Object.entries(ROUTE_CATEGORY_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-ocean-600">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Private notes about this trip"
              maxLength={500}
              rows={2}
              className="mt-1 w-full rounded-xl bg-ocean-50 px-3 py-2.5 text-sm text-ocean-900 placeholder:text-ocean-400 focus:outline-none"
            />
          </div>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isFavorite}
              onChange={(e) => setIsFavorite(e.target.checked)}
              className="h-4 w-4 rounded accent-terra-500"
            />
            <span className="text-sm text-ocean-700">Mark as favorite</span>
          </label>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !customName.trim()}
            className="btn-primary w-full"
          >
            {saving ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
            Save Trip
          </button>
        </div>
      </div>
    </div>
  )
}

// ---- Save Planned Trip Modal (adds to trip_history) --------------------

function SavePlannedTripModal({
  plannedRoute,
  originLocationId,
  destinationLocationId,
  originName,
  destinationName,
  onClose,
  onSaved,
}: {
  plannedRoute: PlannedRoute
  originLocationId: string
  destinationLocationId: string
  originName: string
  destinationName: string
  onClose: () => void
  onSaved: () => void
}) {
  const [plannedDate, setPlannedDate] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const firstRouteId = plannedRoute.legs[0]?.route.id
  const preferredModeId = plannedRoute.legs[0]?.route.transport_mode_id ?? null

  const handleSave = async () => {
    setSaving(true)
    setError(null)

    const segments = plannedRoute.legs.map((leg, idx) => ({
      segmentOrder: idx + 1,
      routeId: leg.route.id,
      transportModeId: leg.route.transport_mode_id ?? null,
      originLocationId: leg.route.origin_location_id,
      destinationLocationId: leg.route.destination_location_id,
    }))

    const snapshot: Record<string, unknown> = {
      legs: plannedRoute.legs.map((leg) => ({
        routeId: leg.route.id,
        routeName: leg.route.route_name,
        transportMode: leg.route.transport_mode?.name ?? null,
        origin: leg.route.origin_location?.name ?? null,
        destination: leg.route.destination_location?.name ?? null,
        estimatedDurationMinutes: leg.route.estimated_duration_minutes ?? null,
      })),
      transfers: plannedRoute.transfers,
      estimatedDurationMinutes: plannedRoute.estimatedDurationMinutes,
      savedAt: new Date().toISOString(),
    }

    const result = await createTrip({
      originLocationId,
      destinationLocationId,
      routeId: plannedRoute.legs.length === 1 ? firstRouteId : null,
      transportModeId: preferredModeId,
      tripStatus: 'planned',
      plannedDepartureAt: plannedDate ? `${plannedDate}T09:00:00` : null,
      fareSnapshot: snapshot,
      notes: notes || undefined,
      segments,
    })

    setSaving(false)
    if (result.success) {
      setSuccess(true)
      setTimeout(() => onSaved(), 1200)
    } else {
      setError(result.error ?? 'Failed to save planned trip.')
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="max-h-[85vh] w-full max-w-md overflow-auto rounded-2xl bg-white p-5 shadow-cardHover">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-lg font-bold text-ocean-900">
            <History size={20} /> Add to Trip History
          </h3>
          <button type="button" onClick={onClose} className="text-ocean-500">
            <X size={20} />
          </button>
        </div>

        <div className="mt-3 rounded-xl bg-ocean-50 p-3 space-y-1.5">
          <div className="flex items-center gap-2 text-sm text-ocean-800">
            <MapPin size={14} className="text-terra-500" />
            <span className="font-semibold">{originName}</span>
            <span className="text-ocean-400">→</span>
            <span className="font-semibold">{destinationName}</span>
          </div>
          <p className="text-[10px] text-ocean-400">
            This creates a planned trip record. It stays planned until you change its status.
          </p>
        </div>

        {success ? (
          <div className="mt-4 flex flex-col items-center gap-3 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-leaf-100 text-leaf-700">
              <Check size={24} />
            </span>
            <p className="text-sm font-semibold text-ocean-900">Trip saved to your history.</p>
            <Link to="/trip-history" className="btn-primary w-full">View Trip History</Link>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <div>
              <label className="text-xs font-semibold text-ocean-600">Planned Travel Date (optional)</label>
              <input
                type="date"
                value={plannedDate}
                onChange={(e) => setPlannedDate(e.target.value)}
                className="mt-1 w-full rounded-xl bg-ocean-50 px-3 py-2.5 text-sm text-ocean-900 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-ocean-600">Notes (optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Bring an umbrella"
                maxLength={1000}
                rows={2}
                className="mt-1 w-full rounded-xl bg-ocean-50 px-3 py-2.5 text-sm text-ocean-900 placeholder:text-ocean-400 focus:outline-none"
              />
            </div>

            {error && <p className="text-xs text-red-600">{error}</p>}

            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="btn-primary w-full"
            >
              {saving ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
              Save as Planned Trip
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
