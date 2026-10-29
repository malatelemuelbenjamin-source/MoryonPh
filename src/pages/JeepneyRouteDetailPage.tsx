import { useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Bus,
  MapPin,
  Circle,
  Clock,
  Wallet,
  Navigation,
  Map as MapIcon,
  Bookmark,
  BookmarkCheck,
  AlertCircle,
  Building2,
  ShieldCheck,
  Flag,
} from 'lucide-react'
import { getRouteDetail } from '../lib/routes'
import {
  fetchRouteStops,
  fetchRouteServiceDetails,
  isRouteSaved,
  saveRoute,
  unsaveRoute,
} from '../lib/jeepneyRoutes'
import { calculateFare, formatPeso } from '../lib/fares'
import { verificationClasses, VERIFICATION_LABELS, formatRelativeTime } from '../lib/labels'
import { useAuth } from '../lib/auth'
import type {
  RouteWithDetails,
  RouteStopWithLocation,
  RouteServiceDetailsRow,
  FareCalculationResult,
} from '../lib/types'

type LoadState = 'loading' | 'done' | 'error'

export function JeepneyRouteDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [route, setRoute] = useState<RouteWithDetails | null>(null)
  const [stops, setStops] = useState<RouteStopWithLocation[]>([])
  const [serviceDetails, setServiceDetails] = useState<RouteServiceDetailsRow | null>(null)
  const [fareResult, setFareResult] = useState<FareCalculationResult | null>(null)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loadState, setLoadState] = useState<LoadState>('loading')

  useEffect(() => {
    if (!id) return
    void (async () => {
      const [r, s, sd, fare] = await Promise.all([
        getRouteDetail(id),
        fetchRouteStops(id),
        fetchRouteServiceDetails(id),
        calculateFare(id, 'regular'),
      ])
      setRoute(r)
      setStops(s)
      setServiceDetails(sd)
      setFareResult(fare)
      if (user) {
        setSaved(await isRouteSaved(id))
      }
      setLoadState('done')
    })().catch(() => setLoadState('error'))
  }, [id, user])

  async function toggleSave() {
    if (!id || !user) return
    setSaving(true)
    if (saved) {
      await unsaveRoute(id)
      setSaved(false)
    } else {
      await saveRoute(id)
      setSaved(true)
    }
    setSaving(false)
  }

  if (loadState === 'loading') {
    return (
      <div className="app-shell">
        <DetailHeader />
        <main className="flex-1 px-4 py-5">
          <div className="card flex items-center gap-3">
            <span className="h-3 w-3 animate-pulse rounded-full bg-ocean-400" />
            <p className="text-sm font-semibold text-ocean-700">Loading route information…</p>
          </div>
        </main>
      </div>
    )
  }

  if (loadState === 'error' || !route) {
    return (
      <div className="app-shell">
        <DetailHeader />
        <main className="flex-1 px-4 py-5">
          <div className="card flex flex-col items-center gap-3 text-center">
            <AlertCircle size={28} className="text-red-600" />
            <p className="text-base font-bold text-ocean-900">We couldn't load route information. Please try again.</p>
            <Link to="/jeepney-routes" className="btn-primary">Back to Routes</Link>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <DetailHeader />
      <main className="flex-1 space-y-5 px-4 py-5">
        {/* Route info */}
        <section className="card space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-lg font-bold text-ocean-900">{route.route_name}</p>
              {route.route_code && <p className="text-xs text-ocean-500">Code: {route.route_code}</p>}
            </div>
            <span className={`pill text-[10px] ${verificationClasses(route.verification_status)}`}>
              {VERIFICATION_LABELS[route.verification_status]}
            </span>
          </div>

          <div className="flex items-center gap-2 text-sm text-ocean-800">
            <MapPin size={16} className="text-terra-500" />
            <span className="font-semibold">{route.origin_location?.name ?? 'Origin'}</span>
            <span className="text-ocean-500">→</span>
            <span className="font-semibold">{route.destination_location?.name ?? 'Destination'}</span>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="pill bg-ocean-100 text-ocean-800 text-[10px]">
              <Bus size={10} /> {route.transport_mode?.name ?? 'Jeepney'}
            </span>
            {route.direction && (
              <span className="pill bg-sand-200 text-ocean-700 text-[10px]">{route.direction}</span>
            )}
            {route.estimated_duration_minutes && (
              <span className="pill bg-leaf-400/20 text-leaf-700 text-[10px]">
                <Clock size={10} /> {route.estimated_duration_minutes} min
              </span>
            )}
          </div>

          {route.description && (
            <p className="text-sm text-ocean-700">{route.description}</p>
          )}

          {route.operator_name ? (
            <div className="flex items-center gap-2 text-sm text-ocean-700">
              <Building2 size={14} /> Operator: {route.operator_name}
            </div>
          ) : (
            <p className="text-sm text-ocean-500">Operator information is not yet available.</p>
          )}

          {route.last_verified_at && (
            <p className="flex items-center gap-1 text-xs text-ocean-500">
              <ShieldCheck size={12} /> Last verified {formatRelativeTime(route.last_verified_at)}
            </p>
          )}
        </section>

        {/* Stops */}
        <section>
          <h2 className="section-title mb-3">Route Stops</h2>
          {stops.length === 0 ? (
            <div className="card">
              <p className="text-sm text-ocean-700">Stop information is not yet available.</p>
            </div>
          ) : (
            <div className="card">
              <ol className="relative">
                {stops.map((s, i) => (
                  <li key={s.id} className="relative flex gap-3 pb-4 last:pb-0">
                    {i < stops.length - 1 && (
                      <span className="absolute left-[14px] top-7 h-full w-0.5 bg-ocean-100" aria-hidden="true" />
                    )}
                    <StopIcon type={s.stop_type} />
                    <div className="flex-1">
                      <p className="text-sm font-bold text-ocean-900">
                        {s.location?.name ?? `Stop ${s.stop_sequence}`}
                      </p>
                      {s.location?.municipality && (
                        <p className="flex items-center gap-1 text-xs text-ocean-600">
                          <MapPin size={10} /> {s.location.municipality}
                        </p>
                      )}
                      {s.notes && <p className="text-xs text-ocean-500">{s.notes}</p>}
                      <div className="mt-0.5 flex gap-2">
                        {s.pickup_allowed === false && (
                          <span className="text-[10px] font-semibold text-terra-600">No pickup</span>
                        )}
                        {s.dropoff_allowed === false && (
                          <span className="text-[10px] font-semibold text-terra-600">No drop-off</span>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </section>

        {/* Service details */}
        {serviceDetails && (
          <section className="card space-y-2">
            <h2 className="section-title">Service Information</h2>
            {serviceDetails.operating_days && (
              <DetailRow label="Operating days" value={serviceDetails.operating_days} />
            )}
            {serviceDetails.first_trip_time && (
              <DetailRow label="First trip" value={serviceDetails.first_trip_time} />
            )}
            {serviceDetails.last_trip_time && (
              <DetailRow label="Last trip" value={serviceDetails.last_trip_time} />
            )}
            {serviceDetails.service_frequency_minutes && (
              <DetailRow label="Frequency" value={`~${serviceDetails.service_frequency_minutes} min`} />
            )}
            {serviceDetails.boarding_instructions && (
              <p className="text-sm text-ocean-700">{serviceDetails.boarding_instructions}</p>
            )}
            {serviceDetails.accessibility_notes && (
              <p className="text-sm text-ocean-700">{serviceDetails.accessibility_notes}</p>
            )}
            {serviceDetails.service_notes && (
              <p className="text-sm text-ocean-700">{serviceDetails.service_notes}</p>
            )}
            {serviceDetails.verification_status === 'community' && (
              <p className="rounded-lg bg-sand-100 px-3 py-2 text-xs text-ocean-700">
                This service information is community-submitted and has not been verified as official.
              </p>
            )}
          </section>
        )}

        {!serviceDetails && (
          <section className="card">
            <p className="text-sm text-ocean-700">Schedule information is not yet available.</p>
          </section>
        )}

        {/* Map */}
        <section>
          <h2 className="section-title mb-3">Route Map</h2>
          <div className="card">
            <div className="relative flex h-44 items-center justify-center overflow-hidden rounded-xl bg-ocean-50">
              <div
                className="absolute inset-0 opacity-40"
                style={{
                  backgroundImage:
                    'radial-gradient(circle at 30% 40%, #a6dde8 0, transparent 40%), radial-gradient(circle at 70% 60%, #d2eef3 0, transparent 40%)',
                }}
                aria-hidden="true"
              />
              <div className="relative flex flex-col items-center gap-2 text-center">
                <MapIcon size={28} className="text-ocean-600" />
                <p className="text-sm font-semibold text-ocean-800">
                  Detailed route path is not yet available.
                </p>
              </div>
              {stops.length > 0 && (
                <div className="absolute right-3 top-3 flex flex-col gap-1">
                  {stops.slice(0, 5).map((stop) => (
                    <span key={stop.id} className="flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-xs font-semibold text-ocean-800 shadow-card">
                      <MapPin size={10} className="text-terra-500" />
                      {stop.location?.name ?? 'Stop'}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Fare */}
        <section className="card space-y-2">
          <h2 className="section-title">Fare Information</h2>
          {fareResult?.hasFare ? (
            <>
              <p className="text-2xl font-bold text-ocean-900">
                {formatPeso(fareResult.totalAmount)}
              </p>
              <Link to="/fare" state={{ routeId: route.id }} className="btn-primary w-full flex items-center justify-center gap-2">
                <Wallet size={18} /> View Fare
              </Link>
            </>
          ) : (
            <p className="text-sm text-ocean-700">Fare information not yet available.</p>
          )}
          <Link to="/fare-matrix" state={{ routeId: route.id }} className="btn-secondary w-full flex items-center justify-center gap-2">
            <Bus size={16} /> Fare Matrix
          </Link>
        </section>

        {/* Actions */}
        <section className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => navigate('/plan', { state: { routeId: route.id } })}
            className="btn-primary flex items-center justify-center gap-2"
          >
            <Navigation size={18} /> Plan a Trip
          </button>
          {user ? (
            <button
              type="button"
              onClick={toggleSave}
              disabled={saving}
              className="btn-secondary flex items-center justify-center gap-2"
            >
              {saved ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}
              {saved ? 'Saved' : 'Save Route'}
            </button>
          ) : (
            <Link to="/auth" className="btn-secondary flex items-center justify-center gap-2">
              <Bookmark size={18} /> Sign in to Save
            </Link>
          )}
        </section>

        {/* Report a problem */}
        <Link
          to={`/community-reports/new?route_id=${route.id}&route_name=${encodeURIComponent(route.route_name)}&transport_mode_id=${route.transport_mode_id ?? ''}`}
          className="btn-ghost w-full text-terra-700 hover:bg-terra-50"
        >
          <Flag size={16} /> Report a Problem with This Route
        </Link>

        {/* Report a fare concern */}
        <Link
          to={`/fare-concerns/new?route_id=${route.id}&route_name=${encodeURIComponent(route.route_name)}&transport_mode_id=${route.transport_mode_id ?? ''}`}
          className="btn-ghost w-full text-terra-700 hover:bg-terra-50"
        >
          <Flag size={16} /> Report a Fare Concern
        </Link>
      </main>
    </div>
  )
}

function DetailHeader() {
  return (
    <header className="sticky top-0 z-30 bg-ocean-800 text-white shadow-card">
      <div className="flex items-center gap-3 px-4 py-4">
        <Link to="/jeepney-routes" className="grid h-9 w-9 place-items-center rounded-full bg-ocean-700 hover:bg-ocean-600">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-lg font-bold">Jeepney Route</h1>
      </div>
    </header>
  )
}

function StopIcon({ type }: { type: string }) {
  const base = 'relative z-10 grid h-7 w-7 shrink-0 place-items-center rounded-full'
  if (type === 'origin') {
    return (
      <span className={`${base} bg-terra-100 text-terra-700`}>
        <MapPin size={14} />
      </span>
    )
  }
  if (type === 'destination') {
    return (
      <span className={`${base} bg-ocean-100 text-ocean-700`}>
        <MapPin size={14} />
      </span>
    )
  }
  return (
    <span className={`${base} bg-ocean-100 text-ocean-700`}>
      <Circle size={10} fill="currentColor" />
    </span>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-ocean-600">{label}</span>
      <span className="font-semibold text-ocean-900">{value}</span>
    </div>
  )
}
