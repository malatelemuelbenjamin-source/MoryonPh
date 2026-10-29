import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation as useRouterLocation } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowDownUp,
  Crosshair,
  Wallet,
  AlertCircle,
  User,
  Bus,
  CheckCircle2,
  Info,
} from 'lucide-react'
import { LocationSearchField } from '../components/LocationSearchField'
import { useLocation } from '../lib/location'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { searchLocationsForRouting, fetchRoutesBetween, getRouteDetail } from '../lib/routes'
import { calculateFare, formatPeso, fareTypeLabel, passengerLabel } from '../lib/fares'
import { verificationClasses, formatRelativeTime } from '../lib/labels'
import type {
  FareCalculationResult,
  LocationRow,
  PassengerType,
  RouteWithDetails,
} from '../lib/types'

interface FareRouterState {
  routeId?: string
  fromName?: string
  toName?: string
}

type CalcState = 'idle' | 'loading' | 'done' | 'error'

export function FareCalculatorPage() {
  const routerLoc = useRouterLocation()
  const initialState = (routerLoc.state ?? {}) as FareRouterState

  const { status, requestPermission, coords } = useLocation()
  const { profile } = useAuth()

  const [from, setFrom] = useState<LocationRow | null>(null)
  const [to, setTo] = useState<LocationRow | null>(null)
  const [routes, setRoutes] = useState<RouteWithDetails[]>([])
  const [selectedRoute, setSelectedRoute] = useState<RouteWithDetails | null>(null)
  const [passengerType, setPassengerType] = useState<PassengerType>('regular')
  const [findingRoutes, setFindingRoutes] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const [calcState, setCalcState] = useState<CalcState>('idle')
  const [result, setResult] = useState<FareCalculationResult | null>(null)

  // Preselect passenger type from profile preference.
  useEffect(() => {
    if (!profile?.preferred_passenger_category_id) return
    // Map category to PassengerType — only the four the calculator supports.
    void (async () => {
      const { data } = await supabase
        .from('passenger_categories')
        .select('code')
        .eq('id', profile.preferred_passenger_category_id)
        .maybeSingle()
      if (data && ['regular', 'student', 'senior', 'pwd'].includes(data.code)) {
        setPassengerType(data.code as PassengerType)
      }
    })()
  }, [profile?.preferred_passenger_category_id])

  // Entry Point B: arrived from Route Planner with a route_id.
  useEffect(() => {
    const routeId = initialState.routeId
    if (!routeId) return
    void (async () => {
      const r = await getRouteDetail(routeId)
      if (r) {
        setSelectedRoute(r)
        // Try to populate from/to from the route's locations.
        if (r.origin_location) {
          setFrom({
            id: r.origin_location.id,
            name: r.origin_location.name,
            normalized_name: r.origin_location.name.toLowerCase(),
            municipality: r.origin_location.municipality,
            barangay: r.origin_location.barangay,
            province: 'Marinduque',
            latitude: null,
            longitude: null,
            address: null,
            description: null,
            is_searchable: true,
            verification_status: 'verified',
            source: null,
            last_verified_at: null,
            created_at: '',
            updated_at: '',
          } as LocationRow)
        }
        if (r.destination_location) {
          setTo({
            id: r.destination_location.id,
            name: r.destination_location.name,
            normalized_name: r.destination_location.name.toLowerCase(),
            municipality: r.destination_location.municipality,
            barangay: r.destination_location.barangay,
            province: 'Marinduque',
            latitude: null,
            longitude: null,
            address: null,
            description: null,
            is_searchable: true,
            verification_status: 'verified',
            source: null,
            last_verified_at: null,
            created_at: '',
            updated_at: '',
          } as LocationRow)
        }
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialState.routeId])

  // When both locations are set and differ, find matching routes.
  useEffect(() => {
    if (!from || !to || from.id === to.id) {
      setRoutes([])
      setSelectedRoute(null)
      return
    }
    setFindingRoutes(true)
    setErrorMsg(null)
    void (async () => {
      const r = await fetchRoutesBetween(from.id, to.id)
      setRoutes(r)
      setSelectedRoute(r[0] ?? null)
      setFindingRoutes(false)
    })()
  }, [from, to])

  // When a route and passenger type are selected, calculate the fare.
  useEffect(() => {
    if (!selectedRoute) {
      setCalcState('idle')
      setResult(null)
      return
    }
    setCalcState('loading')
    setResult(null)
    void (async () => {
      const res = await calculateFare(selectedRoute.id, passengerType)
      setResult(res)
      setCalcState('done')
    })()
  }, [selectedRoute, passengerType])

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
    const nearby = await searchLocationsForRouting('', 50)
    if (nearby.length === 0) return
    let best = nearby[0]
    let bestDist = Infinity
    for (const loc of nearby) {
      if (loc.latitude == null || loc.longitude == null) continue
      const d = (loc.latitude - coords.lat) ** 2 + (loc.longitude - coords.lng) ** 2
      if (d < bestDist) {
        bestDist = d
        best = loc
      }
    }
    setFrom(best)
  }

  const showNoRouteMsg = useMemo(
    () =>
      from &&
      to &&
      from.id !== to.id &&
      !findingRoutes &&
      routes.length === 0,
    [from, to, findingRoutes, routes.length],
  )

  return (
    <div className="app-shell">
      <header className="sticky top-0 z-30 bg-ocean-800 text-white shadow-card">
        <div className="flex items-center gap-3 px-4 py-4">
          <Link
            to={initialState.routeId ? '/plan' : '/'}
            aria-label="Back"
            className="grid h-9 w-9 place-items-center rounded-full bg-ocean-700 hover:bg-ocean-600"
          >
            <ArrowLeft size={18} />
          </Link>
          <h1 className="text-lg font-bold">Fare Calculator</h1>
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
            placeholder="Starting point"
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
            placeholder="Destination"
            value={to}
            onChange={setTo}
          />
          {errorMsg && (
            <p className="flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
              <AlertCircle size={16} /> {errorMsg}
            </p>
          )}
        </section>

        {/* Transport selection */}
        {from && to && from.id !== to.id && (
          <section className="card space-y-3">
            <h2 className="section-title">Transport</h2>
            {findingRoutes && (
              <p className="text-sm font-semibold text-ocean-700">Finding verified routes…</p>
            )}
            {!findingRoutes && routes.length === 0 && (
              <p className="text-sm font-semibold text-ocean-800">No verified route found.</p>
            )}
            {routes.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {routes.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setSelectedRoute(r)}
                    className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition active:scale-95 ${
                      selectedRoute?.id === r.id
                        ? 'bg-ocean-700 text-white'
                        : 'bg-ocean-50 text-ocean-800 hover:bg-ocean-100'
                    }`}
                  >
                    <Bus size={16} />
                    {r.transport_mode?.name ?? 'Transport'}
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Passenger type */}
        {selectedRoute && (
          <section className="card space-y-3">
            <h2 className="section-title">Passenger Type</h2>
            <div className="grid grid-cols-2 gap-2">
              {(['regular', 'student', 'senior', 'pwd'] as PassengerType[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPassengerType(p)}
                  className={`flex items-center gap-2 rounded-xl px-3 py-3 text-sm font-semibold transition active:scale-95 ${
                    passengerType === p
                      ? 'bg-leaf-600 text-white'
                      : 'bg-leaf-400/20 text-leaf-700 hover:bg-leaf-400/30'
                  }`}
                >
                  <User size={16} />
                  {passengerLabel(p)}
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Loading */}
        {calcState === 'loading' && selectedRoute && (
          <div className="card flex items-center gap-3">
            <span className="h-3 w-3 animate-pulse rounded-full bg-ocean-400" />
            <p className="text-sm font-semibold text-ocean-700">
              Checking verified fare information…
            </p>
          </div>
        )}

        {/* Result */}
        {calcState === 'done' && result && selectedRoute && (
          <FareResultCard result={result} route={selectedRoute} />
        )}

        {/* Idle hint */}
        {calcState === 'idle' && !selectedRoute && !showNoRouteMsg && (
          <div className="card flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-leaf-400/30 text-leaf-700">
              <Wallet size={20} />
            </span>
            <p className="text-sm font-semibold text-ocean-800">
              Select a starting point and destination to check fares.
            </p>
          </div>
        )}
      </main>
    </div>
  )
}

// ---- Result card --------------------------------------------------------

interface FareResultCardProps {
  result: FareCalculationResult
  route: RouteWithDetails
}

function FareResultCard({ result, route }: FareResultCardProps) {
  if (!result.hasFare) {
    return (
      <section className="card space-y-4">
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-sand-200 text-ocean-700">
            <Info size={24} />
          </span>
          <p className="text-base font-bold text-ocean-900">
            {result.expired
              ? 'Current fare information is not yet available.'
              : 'Fare information not yet available.'}
          </p>
          <p className="text-sm text-ocean-700">
            Route: {route.route_name}
          </p>
        </div>
        <Link
          to={`/fare-concerns/new?route_id=${route.id}&route_name=${encodeURIComponent(route.route_name)}&transport_mode_id=${route.transport_mode_id ?? ''}`}
          className="btn-secondary w-full"
        >
          Report a Fare Concern
        </Link>
      </section>
    )
  }

  const fare = result.fare!
  const statusLabel =
    fare.verification_status === 'official'
      ? 'OFFICIAL FARE'
      : fare.verification_status === 'verified'
        ? 'VERIFIED FARE'
        : 'Community-submitted information'

  return (
    <section className="space-y-4">
      {/* Big fare card */}
      <div className="card space-y-3 text-center">
        <p className="section-title">Your Fare</p>
        <p className="text-4xl font-bold text-ocean-900">
          {formatPeso(result.totalAmount)}
        </p>
        <span className={`pill ${verificationClasses(fare.verification_status)}`}>
          {fare.verification_status === 'official' ? <CheckCircle2 size={12} /> : null}
          {statusLabel}
        </span>
      </div>

      {/* Fare details */}
      <div className="card space-y-2">
        <DetailRow label="Transport" value={fare.transport_mode?.name ?? '—'} />
        <DetailRow label="Route" value={route.route_name} />
        <DetailRow label="Passenger" value={passengerLabel(result.passengerType)} />
        <DetailRow label="Fare Type" value={fareTypeLabel(fare.fare_type)} />
        {fare.last_verified_at && (
          <DetailRow label="Last verified" value={formatRelativeTime(fare.last_verified_at)} />
        )}
        {fare.source && <DetailRow label="Source" value={fare.source} />}
      </div>

      {/* Breakdown */}
      {result.breakdown.length > 1 && (
        <div className="card space-y-2">
          <h3 className="section-title">Fare Breakdown</h3>
          {result.breakdown.map((item, i) => (
            <div key={i} className="flex justify-between text-sm">
              <span className="text-ocean-700">{item.label}</span>
              <span className={item.amount < 0 ? 'font-semibold text-leaf-700' : 'font-semibold text-ocean-900'}>
                {item.amount < 0 ? '-' : ''}
                {formatPeso(Math.abs(item.amount))}
              </span>
            </div>
          ))}
          <div className="mt-2 flex justify-between border-t border-ocean-100 pt-2 text-base font-bold">
            <span className="text-ocean-900">Total</span>
            <span className="text-ocean-900">{formatPeso(result.totalAmount)}</span>
          </div>
        </div>
      )}

      {/* Discount note */}
      {result.discount && (
        <div className="card">
          <p className="text-sm font-semibold text-ocean-900">
            {passengerLabel(result.passengerType)} discount applied
          </p>
          <p className="mt-1 text-xs text-ocean-600">
            {result.discount.discount_type === 'percentage'
              ? `${result.discount.discount_value}% discount`
              : `${formatPeso(result.discount.discount_value)} off`}
            {result.discount.required_document
              ? ` · Required: ${result.discount.required_document}`
              : ''}
          </p>
        </div>
      )}

      {/* No discount info */}
      {!result.discount && result.passengerType !== 'regular' && (
        <div className="card space-y-2">
          <p className="text-sm font-semibold text-ocean-700">
            We couldn't verify the discount for this route.
          </p>
          <p className="text-xs text-ocean-500">
            Please confirm with the transport provider.
          </p>
          <Link to="/discounts" className="btn-secondary w-full text-sm">
            View Passenger Discounts
          </Link>
        </div>
      )}

      {/* Report a fare concern */}
      <Link
        to={`/fare-concerns/new?route_id=${route.id}&route_name=${encodeURIComponent(route.route_name)}&transport_mode_id=${route.transport_mode_id ?? ''}&expected_fare=${result.totalAmount}`}
        className="btn-secondary w-full text-sm"
      >
        Report a Fare Concern
      </Link>
    </section>
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
