import { useEffect, useState, useCallback } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  MapPin,
  Anchor,
  AlertCircle,
  Clock,
  ShieldCheck,
  Loader2,
  Bookmark,
  BookmarkCheck,
  Sailboat,
  Phone,
  Globe,
  Waves,
  Siren,
  Flag,
} from 'lucide-react'
import {
  fetchPort,
  fetchSeaTransportRoutes,
  fetchSchedulesForPort,
  fetchFaresForRoute,
  fetchAlertsForLocation,
  saveSeaJourney,
  unsaveSeaJourney,
  fetchSavedSeaJourneys,
  portTypeLabel,
  operatingStatusLabel,
  operatingStatusClass,
  scheduleTypeLabel,
  scheduleStatusLabel,
  scheduleStatusClass,
  formatDateTime,
  formatFare,
} from '../lib/seaTransport'
import { verificationClasses, VERIFICATION_LABELS, formatRelativeTime } from '../lib/labels'
import { useAuth } from '../lib/auth'
import type {
  PortWithLocation,
  SeaRouteWithDetails,
  ScheduleWithDetails,
  FareRow,
  SavedRouteRow,
} from '../lib/types'

type LoadState = 'loading' | 'done' | 'error'

interface AlertRow {
  id: string
  title: string
  description: string | null
  category: string
  priority: string
  start_at: string | null
  end_at: string | null
  verification_status: string
  source: string | null
}

export function PortDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()

  const [port, setPort] = useState<PortWithLocation | null>(null)
  const [routes, setRoutes] = useState<SeaRouteWithDetails[]>([])
  const [schedules, setSchedules] = useState<ScheduleWithDetails[]>([])
  const [faresByRoute, setFaresByRoute] = useState<Record<string, FareRow[]>>({})
  const [alerts, setAlerts] = useState<AlertRow[]>([])
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [isSaved, setIsSaved] = useState(false)
  const [saveLoading, setSaveLoading] = useState(false)
  const [savedId, setSavedId] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    if (!id) return
    setLoadState('loading')
    const portData = await fetchPort(id)
    setPort(portData)

    if (portData) {
      const [allRoutes, scheds, alertData] = await Promise.all([
        fetchSeaTransportRoutes(),
        fetchSchedulesForPort(id),
        portData.location_id ? fetchAlertsForLocation(portData.location_id) : Promise.resolve([]),
      ])

      const portRoutes = allRoutes.filter(
        (r) => r.origin_port?.id === id || r.destination_port?.id === id,
      )
      setRoutes(portRoutes)
      setSchedules(scheds)
      setAlerts(alertData as AlertRow[])

      const faresMap: Record<string, FareRow[]> = {}
      await Promise.all(
        portRoutes.map(async (r) => {
          const fares = await fetchFaresForRoute(r.id)
          faresMap[r.id] = fares
        }),
      )
      setFaresByRoute(faresMap)

      if (user) {
        const saved = await fetchSavedSeaJourneys()
        const existing = saved.find((s: SavedRouteRow) =>
          portRoutes.some((r) => r.id === s.route_id),
        )
        if (existing) {
          setIsSaved(true)
          setSavedId(existing.id)
        }
      }
    }
    setLoadState('done')
  }, [id, user])

  useEffect(() => {
    void loadData().catch(() => setLoadState('error'))
  }, [loadData])

  const handleSaveToggle = async () => {
    if (!port || !user || routes.length === 0) return
    setSaveLoading(true)
    if (isSaved && savedId) {
      const ok = await unsaveSeaJourney(savedId)
      if (ok) {
        setIsSaved(false)
        setSavedId(null)
      }
    } else {
      const firstRoute = routes[0]
      const ok = await saveSeaJourney({
        routeId: firstRoute.id,
        customName: port.port_name,
      })
      if (ok) setIsSaved(true)
    }
    setSaveLoading(false)
  }

  if (loadState === 'loading') {
    return (
      <div className="app-shell">
        <DetailHeader />
        <main className="flex-1 px-4 py-5">
          <div className="card flex items-center gap-3">
            <Loader2 size={20} className="animate-spin text-ocean-500" />
            <p className="text-sm font-semibold text-ocean-700">Loading port details…</p>
          </div>
        </main>
      </div>
    )
  }

  if (loadState === 'error' || !port) {
    return (
      <div className="app-shell">
        <DetailHeader />
        <main className="flex-1 px-4 py-5">
          <div className="card flex flex-col items-center gap-3 text-center">
            <AlertCircle size={28} className="text-red-600" />
            <p className="text-sm font-semibold text-red-700">We couldn't load this port.</p>
            <button type="button" onClick={() => void loadData()} className="btn-primary">Retry</button>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <DetailHeader />
      <main className="flex-1 space-y-5 px-4 py-5">
        {/* Header card */}
        <section className="card space-y-3">
          <div className="flex items-start justify-between gap-2">
            <p className="text-lg font-bold text-ocean-900">{port.port_name}</p>
            <span className={`pill text-[10px] ${verificationClasses(port.verification_status)}`}>
              {VERIFICATION_LABELS[port.verification_status]}
            </span>
          </div>
          {port.location && (
            <p className="flex items-center gap-1 text-sm text-ocean-700">
              <MapPin size={14} className="text-terra-500" /> {port.location.name}
              {port.location.municipality && <span> · {port.location.municipality}</span>}
            </p>
          )}
          {port.description && <p className="text-sm text-ocean-700">{port.description}</p>}
          <div className="flex flex-wrap gap-1.5">
            <span className="pill bg-ocean-100 text-ocean-800 text-[10px]">
              {portTypeLabel(port.port_type)}
            </span>
            <span className={`pill text-[10px] ${operatingStatusClass(port.operating_status)}`}>
              {operatingStatusLabel(port.operating_status)}
            </span>
            {port.latitude != null && port.longitude != null && (
              <span className="pill bg-sand-200 text-ocean-700 text-[10px]">
                {port.latitude.toFixed(4)}, {port.longitude.toFixed(4)}
              </span>
            )}
          </div>
          {port.contact_number && (
            <p className="flex items-center gap-1.5 text-xs text-ocean-600">
              <Phone size={12} /> {port.contact_number}
            </p>
          )}
          {port.official_website && (
            <a
              href={port.official_website}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-ocean-600 underline"
            >
              <Globe size={12} /> Official website
            </a>
          )}
          {port.source_name && <p className="text-xs text-ocean-500">Source: {port.source_name}</p>}
          {port.verified_at && (
            <p className="flex items-center gap-1 text-xs text-ocean-500">
              <ShieldCheck size={12} /> Verified {formatRelativeTime(port.verified_at)}
            </p>
          )}

          {/* Save button */}
          {user && routes.length > 0 && (
            <button
              type="button"
              onClick={handleSaveToggle}
              disabled={saveLoading}
              className="btn-secondary w-full"
            >
              {isSaved ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
              {isSaved ? 'Saved' : 'Save Journey'}
            </button>
          )}
          {!user && (
            <Link to="/auth" className="btn-secondary w-full text-center">
              Sign in to save this journey
            </Link>
          )}
        </section>

        {/* Travel advisories */}
        {alerts.length > 0 && (
          <section className="space-y-3">
            <h2 className="flex items-center gap-1.5 section-title">
              <Siren size={14} /> Abiso sa Biyahe (Advisories)
            </h2>
            {alerts.map((a) => (
              <div key={a.id} className="card space-y-2 border-l-4 border-terra-400">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-bold text-ocean-900">{a.title}</p>
                  <span className={`pill text-[10px] ${verificationClasses(a.verification_status as never)}`}>
                    {VERIFICATION_LABELS[a.verification_status as never] ?? a.verification_status}
                  </span>
                </div>
                {a.description && <p className="text-xs text-ocean-700">{a.description}</p>}
                {a.source && <p className="text-xs text-ocean-500">Source: {a.source}</p>}
              </div>
            ))}
          </section>
        )}

        {/* Routes from this port */}
        {routes.length > 0 && (
          <section className="space-y-3">
            <h2 className="flex items-center gap-1.5 section-title">
              <Sailboat size={14} /> Available Routes
            </h2>
            {routes.map((r) => (
              <div key={r.id} className="card space-y-2">
                <Link to={`/route-detail?routeId=${r.id}`} className="block">
                  <p className="font-bold text-ocean-900">{r.route_name}</p>
                  <div className="flex items-center gap-2 text-sm text-ocean-800">
                    <MapPin size={14} className="text-terra-500" />
                    <span className="font-semibold">{r.origin_port?.port_name ?? r.origin_location?.name ?? 'Origin'}</span>
                    <span className="text-ocean-500">→</span>
                    <span className="font-semibold">{r.destination_port?.port_name ?? r.destination_location?.name ?? 'Destination'}</span>
                  </div>
                </Link>
                <div className="flex flex-wrap gap-1.5">
                  {r.transport_mode && (
                    <span className="pill bg-ocean-100 text-ocean-800 text-[10px]">
                      {r.transport_mode.name}
                    </span>
                  )}
                  {r.operator_name && (
                    <span className="pill bg-sand-200 text-ocean-700 text-[10px]">
                      {r.operator_name}
                    </span>
                  )}
                  {r.estimated_duration_minutes && (
                    <span className="pill bg-leaf-400/20 text-leaf-700 text-[10px]">
                      <Clock size={10} /> {r.estimated_duration_minutes} min
                    </span>
                  )}
                </div>

                {/* Fares for this route */}
                {faresByRoute[r.id] && faresByRoute[r.id].length > 0 && (
                  <div className="mt-2 space-y-1">
                    <p className="text-xs font-semibold text-ocean-600">Pamasahe (Fares):</p>
                    {faresByRoute[r.id].map((f) => (
                      <div key={f.id} className="flex items-center justify-between rounded-lg bg-ocean-50 px-2 py-1.5">
                        <span className="text-xs text-ocean-700">
                          {f.fare_category ?? 'Passenger'}
                        </span>
                        <span className="text-sm font-bold text-ocean-900">
                          {formatFare(Number(f.base_fare))}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {(!faresByRoute[r.id] || faresByRoute[r.id].length === 0) && (
                  <p className="text-xs text-ocean-500">Fare not yet verified</p>
                )}
              </div>
            ))}
          </section>
        )}

        {/* Schedules for this port */}
        {schedules.length > 0 && (
          <section className="space-y-3">
            <h2 className="flex items-center gap-1.5 section-title">
              <Clock size={14} /> Oras ng Biyahe (Schedules)
            </h2>
            {schedules.map((s) => (
              <div key={s.id} className="card space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-bold text-ocean-900">
                    {s.departure_port?.port_name ?? 'Departure'} → {s.arrival_port?.port_name ?? 'Arrival'}
                  </p>
                  <span className={`pill text-[10px] ${scheduleStatusClass(s.status)}`}>
                    {scheduleStatusLabel(s.status)}
                  </span>
                </div>
                <div className="space-y-1 text-xs text-ocean-700">
                  <p className="flex items-center gap-1">
                    <Clock size={12} className="text-ocean-500" />
                    Alis: {formatDateTime(s.departure_datetime)}
                  </p>
                  <p className="flex items-center gap-1">
                    <Clock size={12} className="text-ocean-500" />
                    Dating: {formatDateTime(s.arrival_datetime)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <span className="pill bg-ocean-100 text-ocean-800 text-[10px]">
                    {scheduleTypeLabel(s.schedule_type)}
                  </span>
                  {s.operator_name && (
                    <span className="pill bg-sand-200 text-ocean-700 text-[10px]">
                      {s.operator_name}
                    </span>
                  )}
                  <span className={`pill text-[10px] ${verificationClasses(s.verification_status)}`}>
                    {VERIFICATION_LABELS[s.verification_status]}
                  </span>
                </div>
                {s.source_name && <p className="text-xs text-ocean-500">Source: {s.source_name}</p>}
              </div>
            ))}
          </section>
        )}

        {/* No routes empty state */}
        {routes.length === 0 && schedules.length === 0 && (
          <div className="card flex flex-col items-center gap-2 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-sand-200 text-ocean-700">
              <Waves size={24} />
            </span>
            <p className="text-sm font-semibold text-ocean-700">
              No verified routes or schedules for this port yet.
            </p>
          </div>
        )}

        {/* List-based alternative notice */}
        <section className="card">
          <p className="flex items-center gap-1.5 text-xs text-ocean-500">
            <Anchor size={12} /> Port markers and route data are shown when available. No fabricated routes are drawn.
          </p>
        </section>

        {/* Report a problem */}
        <Link
          to={`/community-reports/new?location_id=${port.location_id ?? ''}&location_name=${encodeURIComponent(port.port_name)}${port.location?.municipality ? `&municipality=${encodeURIComponent(port.location.municipality)}` : ''}`}
          className="btn-ghost w-full text-terra-700 hover:bg-terra-50"
        >
          <Flag size={16} /> Report a Problem with This Port
        </Link>
      </main>
    </div>
  )
}

function DetailHeader() {
  return (
    <header className="sticky top-0 z-30 bg-ocean-800 text-white shadow-card">
      <div className="flex items-center gap-3 px-4 py-4">
        <Link to="/ports" className="grid h-9 w-9 place-items-center rounded-full bg-ocean-700 hover:bg-ocean-600">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-lg font-bold">Port Details</h1>
      </div>
    </header>
  )
}
