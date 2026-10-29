import { useEffect, useState, useCallback } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  MapPin,
  Bike,
  Layers,
  AlertCircle,
  Bus,
  Clock,
  ShieldCheck,
  Loader2,
  Bookmark,
  BookmarkCheck,
  Navigation,
} from 'lucide-react'
import {
  fetchServiceArea,
  fetchFareZones,
  fetchConnectionsForServiceArea,
  fetchTricycleRoutes,
  saveTricycleJourney,
  unsaveTricycleJourney,
  fetchSavedTricycleJourneys,
  coverageTypeLabel,
  serviceTypeLabel,
} from '../lib/tricycleRoutes'
import { verificationClasses, VERIFICATION_LABELS, formatRelativeTime } from '../lib/labels'
import { formatPeso } from '../lib/fares'
import { useAuth } from '../lib/auth'
import type {
  TricycleServiceAreaWithMunicipality,
  TricycleFareZoneWithDetails,
  TricycleZoneConnectionWithDetails,
  SavedRouteRow,
} from '../lib/types'

type LoadState = 'loading' | 'done' | 'error'

export function TricycleServiceAreaDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()

  const [area, setArea] = useState<TricycleServiceAreaWithMunicipality | null>(null)
  const [zones, setZones] = useState<TricycleFareZoneWithDetails[]>([])
  const [connections, setConnections] = useState<TricycleZoneConnectionWithDetails[]>([])
  const [routes, setRoutes] = useState<{
    id: string
    route_name: string
    route_code: string | null
    origin_location: { id: string; name: string; municipality: string | null } | null
    destination_location: { id: string; name: string; municipality: string | null } | null
    estimated_duration_minutes: number | null
    verification_status: string
  }[]>([])
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [isSaved, setIsSaved] = useState(false)
  const [saveLoading, setSaveLoading] = useState(false)
  const [savedId, setSavedId] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    if (!id) return
    setLoadState('loading')
    const [areaData, allZones, conns, allRoutes] = await Promise.all([
      fetchServiceArea(id),
      fetchFareZones('all', id),
      fetchConnectionsForServiceArea(id),
      fetchTricycleRoutes(),
    ])
    setArea(areaData)
    setZones(allZones)
    setConnections(conns)
    setRoutes(allRoutes)
    setLoadState('done')

    if (user) {
      const saved = await fetchSavedTricycleJourneys()
      const existing = saved.find((s: SavedRouteRow) => s.origin_location_id === id || s.route_id === id)
      if (existing) {
        setIsSaved(true)
        setSavedId(existing.id)
      }
    }
  }, [id, user])

  useEffect(() => {
    void loadData().catch(() => setLoadState('error'))
  }, [loadData])

  const handleSaveToggle = async () => {
    if (!area || !user) return
    setSaveLoading(true)
    if (isSaved && savedId) {
      const ok = await unsaveTricycleJourney(savedId)
      if (ok) {
        setIsSaved(false)
        setSavedId(null)
      }
    } else {
      const ok = await saveTricycleJourney({
        originLocationId: area.id,
        customName: area.name,
      })
      if (ok) setIsSaved(true)
    }
    setSaveLoading(false)
  }

  if (loadState === 'loading') {
    return (
      <div className="app-shell">
        <header className="sticky top-0 z-30 bg-ocean-800 text-white shadow-card">
          <div className="flex items-center gap-3 px-4 py-4">
            <Link to="/tricycle-routes" className="grid h-9 w-9 place-items-center rounded-full bg-ocean-700 hover:bg-ocean-600">
              <ArrowLeft size={18} />
            </Link>
            <h1 className="text-lg font-bold">Service Area</h1>
          </div>
        </header>
        <main className="flex-1 px-4 py-5">
          <div className="card flex items-center gap-3">
            <Loader2 size={20} className="animate-spin text-ocean-500" />
            <p className="text-sm font-semibold text-ocean-700">Loading service area…</p>
          </div>
        </main>
      </div>
    )
  }

  if (loadState === 'error' || !area) {
    return (
      <div className="app-shell">
        <header className="sticky top-0 z-30 bg-ocean-800 text-white shadow-card">
          <div className="flex items-center gap-3 px-4 py-4">
            <Link to="/tricycle-routes" className="grid h-9 w-9 place-items-center rounded-full bg-ocean-700 hover:bg-ocean-600">
              <ArrowLeft size={18} />
            </Link>
            <h1 className="text-lg font-bold">Service Area</h1>
          </div>
        </header>
        <main className="flex-1 px-4 py-5">
          <div className="card flex flex-col items-center gap-3 text-center">
            <AlertCircle size={28} className="text-red-600" />
            <p className="text-sm font-semibold text-red-700">We couldn't load this service area.</p>
            <button type="button" onClick={() => void loadData()} className="btn-primary">Retry</button>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <header className="sticky top-0 z-30 bg-ocean-800 text-white shadow-card">
        <div className="flex items-center gap-3 px-4 py-4">
          <Link to="/tricycle-routes" className="grid h-9 w-9 place-items-center rounded-full bg-ocean-700 hover:bg-ocean-600">
            <ArrowLeft size={18} />
          </Link>
          <h1 className="text-lg font-bold">Service Area</h1>
        </div>
      </header>

      <main className="flex-1 space-y-5 px-4 py-5">
        {/* Header card */}
        <section className="card space-y-3">
          <div className="flex items-start justify-between gap-2">
            <p className="text-lg font-bold text-ocean-900">{area.name}</p>
            <span className={`pill text-[10px] ${verificationClasses(area.verification_status)}`}>
              {VERIFICATION_LABELS[area.verification_status]}
            </span>
          </div>
          {area.municipality && (
            <p className="flex items-center gap-1 text-sm text-ocean-700">
              <MapPin size={14} className="text-terra-500" /> {area.municipality.name}
            </p>
          )}
          {area.description && <p className="text-sm text-ocean-700">{area.description}</p>}
          <div className="flex flex-wrap gap-1.5">
            <span className="pill bg-ocean-100 text-ocean-800 text-[10px]">
              {coverageTypeLabel(area.coverage_type)}
            </span>
            {area.centroid_latitude != null && area.centroid_longitude != null && (
              <span className="pill bg-sand-200 text-ocean-700 text-[10px]">
                {area.centroid_latitude.toFixed(4)}, {area.centroid_longitude.toFixed(4)}
              </span>
            )}
          </div>
          {area.source_name && (
            <p className="text-xs text-ocean-500">Source: {area.source_name}</p>
          )}
          {area.verified_at && (
            <p className="flex items-center gap-1 text-xs text-ocean-500">
              <ShieldCheck size={12} /> Verified {formatRelativeTime(area.verified_at)}
            </p>
          )}

          {/* Save button */}
          {user && (
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

        {/* Fare zones in this area */}
        <section className="space-y-3">
          <h2 className="flex items-center gap-1.5 section-title">
            <Layers size={14} /> Fare Zones
          </h2>
          {zones.length === 0 ? (
            <div className="card text-center">
              <p className="text-sm text-ocean-600">No verified fare zones for this service area yet.</p>
            </div>
          ) : (
            zones.map((zone) => (
              <div key={zone.id} className="card space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-bold text-ocean-900">{zone.name}</p>
                  <span className={`pill text-[10px] ${verificationClasses(zone.verification_status)}`}>
                    {VERIFICATION_LABELS[zone.verification_status]}
                  </span>
                </div>
                {zone.description && <p className="text-xs text-ocean-600">{zone.description}</p>}
                {zone.source_name && <p className="text-xs text-ocean-500">Source: {zone.source_name}</p>}
              </div>
            ))
          )}
        </section>

        {/* Zone connections with fare info */}
        {connections.length > 0 && (
          <section className="space-y-3">
            <h2 className="flex items-center gap-1.5 section-title">
              <Navigation size={14} /> Available Connections & Fares
            </h2>
            {connections.map((c) => (
              <div key={c.id} className="card space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-bold text-ocean-900">
                    {c.origin_zone?.name ?? 'Origin'} → {c.destination_zone?.name ?? 'Destination'}
                  </p>
                  <span className={`pill text-[10px] ${verificationClasses(c.verification_status)}`}>
                    {VERIFICATION_LABELS[c.verification_status]}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <span className="pill bg-ocean-100 text-ocean-800 text-[10px]">
                    {serviceTypeLabel(c.service_type)}
                  </span>
                  {c.fare && (
                    <span className="pill bg-leaf-400/20 text-leaf-700 text-[10px]">
                      Pamasahe: {formatPeso(Number(c.fare.base_fare))}
                    </span>
                  )}
                </div>
                {!c.fare && <p className="text-xs text-ocean-500">Fare not yet verified</p>}
                {c.availability_notes && <p className="text-xs text-ocean-600">{c.availability_notes}</p>}
                {c.source_name && <p className="text-xs text-ocean-500">Source: {c.source_name}</p>}
              </div>
            ))}
          </section>
        )}

        {/* Routes serving this area */}
        {routes.length > 0 && (
          <section className="space-y-3">
            <h2 className="flex items-center gap-1.5 section-title">
              <Bus size={14} /> Routes Serving This Area
            </h2>
            {routes.map((r) => (
              <Link
                key={r.id}
                to={`/route-detail?routeId=${r.id}`}
                className="card block space-y-2 transition hover:shadow-cardHover active:scale-[0.99]"
              >
                <p className="font-bold text-ocean-900">{r.route_name}</p>
                <div className="flex items-center gap-2 text-sm text-ocean-800">
                  <MapPin size={14} className="text-terra-500" />
                  <span className="font-semibold">{r.origin_location?.name ?? 'Origin'}</span>
                  <span className="text-ocean-500">→</span>
                  <span className="font-semibold">{r.destination_location?.name ?? 'Destination'}</span>
                </div>
                {r.estimated_duration_minutes && (
                  <span className="pill bg-leaf-400/20 text-leaf-700 text-[10px]">
                    <Clock size={10} /> {r.estimated_duration_minutes} min
                  </span>
                )}
              </Link>
            ))}
          </section>
        )}

        {/* List-based alternative notice */}
        <section className="card">
          <p className="flex items-center gap-1.5 text-xs text-ocean-500">
            <Bike size={12} /> Location markers and route data are shown when available. No fabricated routes are drawn.
          </p>
        </section>
      </main>
    </div>
  )
}
