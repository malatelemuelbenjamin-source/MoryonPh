import { Link, useLocation as useRouterLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import {
  ArrowLeft,
  Circle,
  MapPin,
  Footprints,
  ArrowRight,
  Map as MapIcon,
  Clock,
  Building2,
  Wallet,
  Table2,
  Share2,
} from 'lucide-react'
import type { LocationRow, PlannedRoute, FareCalculationResult } from '../lib/types'
import { verificationClasses, VERIFICATION_LABELS, formatRelativeTime } from '../lib/labels'
import { calculateFare, formatPeso, fareTypeLabel, passengerLabel } from '../lib/fares'

interface RouteDetailLocationState {
  plannedRoute?: PlannedRoute
  from?: LocationRow
  to?: LocationRow
}

export function RouteDetailPage() {
  const routerLoc = useRouterLocation()
  const state = (routerLoc.state ?? {}) as RouteDetailLocationState
  const { plannedRoute, from, to } = state

  if (!plannedRoute) {
    return (
      <div className="app-shell">
        <header className="sticky top-0 z-30 bg-ocean-800 text-white shadow-card">
          <div className="flex items-center gap-3 px-4 py-4">
            <Link
              to="/plan"
              aria-label="Back"
              className="grid h-9 w-9 place-items-center rounded-full bg-ocean-700 hover:bg-ocean-600"
            >
              <ArrowLeft size={18} />
            </Link>
            <h1 className="text-lg font-bold">Route Details</h1>
          </div>
        </header>
        <main className="flex-1 px-4 py-6">
          <div className="card text-center">
            <p className="text-sm font-semibold text-ocean-800">
              No route selected. Please plan a trip first.
            </p>
            <Link to="/plan" className="btn-primary mt-4 inline-flex">
              Go to Route Planner
            </Link>
          </div>
        </main>
      </div>
    )
  }

  const firstLeg = plannedRoute.legs[0]
  const lastLeg = plannedRoute.legs[plannedRoute.legs.length - 1]
  const originName = from?.name ?? firstLeg.route.origin_location?.name ?? 'Origin'
  const destName = to?.name ?? lastLeg.route.destination_location?.name ?? 'Destination'

  // Build a flat ordered timeline of steps from all legs.
  const steps = buildTimeline(plannedRoute)

  return (
    <div className="app-shell">
      <header className="sticky top-0 z-30 bg-ocean-800 text-white shadow-card">
        <div className="flex items-center gap-3 px-4 py-4">
          <Link
            to="/plan"
            aria-label="Back"
            className="grid h-9 w-9 place-items-center rounded-full bg-ocean-700 hover:bg-ocean-600"
          >
            <ArrowLeft size={18} />
          </Link>
          <h1 className="text-lg font-bold">Route Details</h1>
        </div>
      </header>

      <main className="flex-1 space-y-5 px-4 py-5">
        {/* Trip summary */}
        <section className="card space-y-3">
          <h2 className="section-title">Trip Summary</h2>
          <div className="flex items-center gap-2 text-sm">
            <MapPin size={16} className="text-terra-500" />
            <span className="font-semibold text-ocean-900">From:</span>
            <span className="text-ocean-800">{originName}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <MapPin size={16} className="text-ocean-600" />
            <span className="font-semibold text-ocean-900">To:</span>
            <span className="text-ocean-800">{destName}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="pill bg-ocean-100 text-ocean-800">
              <Clock size={12} />
              {plannedRoute.estimatedDurationMinutes
                ? `${plannedRoute.estimatedDurationMinutes} min`
                : 'Est. time N/A'}
            </span>
            <span className="pill bg-terra-100 text-terra-700">
              {plannedRoute.transfers === 0
                ? 'Direct'
                : `${plannedRoute.transfers} transfer${plannedRoute.transfers > 1 ? 's' : ''}`}
            </span>
            <span className={`pill ${verificationClasses(plannedRoute.verificationStatus)}`}>
              {VERIFICATION_LABELS[plannedRoute.verificationStatus]}
            </span>
          </div>
        </section>

        {/* Route steps timeline */}
        <section>
          <h2 className="section-title mb-3">Route Steps</h2>
          <div className="card">
            <ol className="relative">
              {steps.map((s, i) => (
                <li key={i} className="relative flex gap-3 pb-5 last:pb-0">
                  {/* Vertical line */}
                  {i < steps.length - 1 && (
                    <span
                      className="absolute left-[14px] top-7 h-full w-0.5 bg-ocean-100"
                      aria-hidden="true"
                    />
                  )}
                  <StepIcon type={s.kind} />
                  <div className="flex-1">
                    <p className="text-sm font-bold text-ocean-900">{s.title}</p>
                    {s.subtitle && (
                      <p className="text-xs text-ocean-700">{s.subtitle}</p>
                    )}
                    {s.locationName && (
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-ocean-600">
                        <MapPin size={12} /> {s.locationName}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Map placeholder */}
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
                  Detailed route geometry is not yet available.
                </p>
              </div>

              {/* Stop pins overlay */}
              <div className="absolute right-3 top-3 flex flex-col gap-1">
                {plannedRoute.legs.flatMap((l) => l.stops).slice(0, 5).map((stop) => (
                  <span
                    key={stop.id}
                    className="flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-xs font-semibold text-ocean-800 shadow-card"
                  >
                    <MapPin size={10} className="text-terra-500" />
                    {stop.location?.name ?? 'Stop'}
                  </span>
                ))}
              </div>
            </div>
            <p className="mt-2 text-xs text-ocean-600">
              Origin and destination markers are prepared for future map integration.
            </p>
          </div>
        </section>

        {/* Fare */}
        <RouteFareSection routeId={firstLeg.route.id} />

        {/* Verification / source */}
        <section className="card">
          <p className="text-sm font-semibold text-ocean-900">Verification</p>
          <p className="mt-1 text-xs text-ocean-600">
            Status: {VERIFICATION_LABELS[plannedRoute.verificationStatus]}
          </p>
          {firstLeg.route.source && (
            <p className="mt-0.5 text-xs text-ocean-600">
              Source: {firstLeg.route.source}
            </p>
          )}
          {firstLeg.route.last_verified_at && (
            <p className="mt-0.5 text-xs text-ocean-600">
              Last verified: {formatRelativeTime(firstLeg.route.last_verified_at)}
            </p>
          )}
        </section>

        {/* Share */}
        <section className="card space-y-2">
          <h2 className="section-title">Share</h2>
          <p className="text-xs text-ocean-600">
            Create a shareable link for this route with configurable privacy and expiration.
          </p>
          <Link
            to="/share"
            state={{
              sourceType: 'route',
              sourceId: firstLeg.route.id,
              title: firstLeg.route.route_name,
            }}
            className="btn-primary w-full text-xs"
          >
            <Share2 size={14} /> Share This Route
          </Link>
        </section>
      </main>
    </div>
  )
}

// ---- Timeline builder ---------------------------------------------------

interface StepEntry {
  kind: 'walk' | 'ride' | 'transfer' | 'stop'
  title: string
  subtitle?: string | null
  locationName?: string | null
  modeName?: string
}

function buildTimeline(route: PlannedRoute): StepEntry[] {
  const steps: StepEntry[] = []

  // Opening walk to pickup (placeholder step — only show if there are stops).
  steps.push({
    kind: 'walk',
    title: 'Walk to pickup point',
    subtitle: 'Start of your trip',
  })

  route.legs.forEach((leg, legIndex) => {
    const legMode = leg.route.transport_mode?.name ?? 'Transport'
    const routeName = leg.route.route_name
    const operator = leg.route.operator_name

    if (legIndex > 0) {
      const transferStop = leg.stops[0]
      steps.push({
        kind: 'transfer',
        title: 'Transfer',
        subtitle: `Change to ${legMode.toLowerCase()}`,
        locationName: transferStop?.location?.name ?? null,
      })
    }

    const orderedStops = leg.stops.slice().sort((a, b) => a.stop_sequence - b.stop_sequence)
    const rideStop = orderedStops.find((s) => s.stop_type !== 'origin') ?? orderedStops[0]
    steps.push({
      kind: 'ride',
      title: `Ride ${legMode}`,
      subtitle: [routeName, operator ? `· ${operator}` : null].filter(Boolean).join(' '),
      locationName: rideStop?.location?.name ?? null,
    })

    // Intermediate stops
    for (const stop of orderedStops) {
      if (stop.stop_type === 'origin' || stop.stop_type === 'destination') continue
      if (stop.stop_type === 'transfer' && legIndex > 0 && stop === orderedStops[0]) continue
      steps.push({
        kind: 'stop',
        title: 'Stop',
        subtitle: stop.notes,
        locationName: stop.location?.name ?? null,
      })
    }
  })

  // Final walk to destination
  steps.push({
    kind: 'walk',
    title: 'Walk to destination',
    subtitle: 'End of your trip',
  })

  return steps
}

function StepIcon({
  type,
}: {
  type: StepEntry['kind']
}) {
  const base = 'relative z-10 grid h-7 w-7 shrink-0 place-items-center rounded-full'
  if (type === 'walk') {
    return (
      <span className={`${base} bg-leaf-400/30 text-leaf-700`}>
        <Footprints size={14} />
      </span>
    )
  }
  if (type === 'transfer') {
    return (
      <span className={`${base} bg-terra-100 text-terra-700`}>
        <ArrowRight size={14} />
      </span>
    )
  }
  if (type === 'stop') {
    return (
      <span className={`${base} bg-ocean-100 text-ocean-700`}>
        <Circle size={10} fill="currentColor" />
      </span>
    )
  }
  // ride
  return (
    <span className={`${base} bg-ocean-700 text-white`}>
      <Building2 size={14} />
    </span>
  )
}

// ---- Fare section (fetches via existing Fare Calculator logic) ----------

function RouteFareSection({ routeId }: { routeId: string }) {
  const [result, setResult] = useState<FareCalculationResult | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      const res = await calculateFare(routeId, 'regular')
      setResult(res)
      setLoading(false)
    })()
  }, [routeId])

  if (loading) {
    return (
      <section className="card flex items-center gap-2">
        <Wallet size={18} className="text-ocean-600" />
        <p className="text-sm font-semibold text-ocean-700">Checking verified fare…</p>
      </section>
    )
  }

  if (!result || !result.hasFare) {
    return (
      <section className="card">
        <p className="text-sm font-semibold text-ocean-900">Current Fare</p>
        <p className="mt-1 text-sm text-ocean-700">
          {result?.expired
            ? 'Current fare information is not yet available.'
            : 'Fare information not yet available.'}
        </p>
        <Link to="/fare-matrix" state={{ routeId }} className="btn-secondary mt-3 w-full flex items-center justify-center gap-2">
          <Table2 size={18} /> View Fare Matrix
        </Link>
      </section>
    )
  }

  const fare = result.fare!
  return (
    <section className="card space-y-2">
      <p className="text-sm font-semibold text-ocean-900">Current Fare</p>
      <p className="text-2xl font-bold text-ocean-900">{formatPeso(result.totalAmount)}</p>
      <p className="text-xs text-ocean-600">
        {fare.transport_mode?.name ?? 'Transport'} · {fareTypeLabel(fare.fare_type)} · {passengerLabel('regular')}
      </p>
      {fare.last_verified_at && (
        <p className="text-xs text-ocean-500">Last verified: {formatRelativeTime(fare.last_verified_at)}</p>
      )}
      <Link to="/fare-matrix" state={{ routeId }} className="btn-secondary mt-2 w-full flex items-center justify-center gap-2">
        <Table2 size={18} /> View Fare Matrix
      </Link>
    </section>
  )
}
