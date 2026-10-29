import { useEffect, useMemo, useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Search as SearchIcon,
  Filter,
  MapPin,
  AlertCircle,
  ChevronRight,
  Navigation,
  Bus,
  Bike,
  Sailboat,
  Anchor,
  Layers,
  LocateFixed,
  Bookmark,
  BookmarkCheck,
  Compass,
  Wallet,
  Siren,
  Loader2,
  Route as RouteIcon,
} from 'lucide-react'
import {
  fetchMapLocations,
  fetchMapRoutes,
  fetchMapAlerts,
  searchMapLocations,
  saveMapPlace,
  unsaveMapPlace,
  isPlaceSaved,
  type MapLocation,
  type MapRoute,
  type MapAlert,
} from '../lib/transportMap'
import { verificationClasses, VERIFICATION_LABELS, formatRelativeTime } from '../lib/labels'
import { useAuth } from '../lib/auth'
import type { LocationRow } from '../lib/types'

type LoadState = 'loading' | 'done' | 'error'

type ModeFilterKey = 'all' | 'jeepney' | 'tricycle' | 'ferry' | 'roro' | 'boat'

interface ModeFilter {
  key: ModeFilterKey
  label: string
  icon: typeof Bus
}

const MODE_FILTERS: ModeFilter[] = [
  { key: 'all', label: 'All', icon: Layers },
  { key: 'jeepney', label: 'Jeepney', icon: Bus },
  { key: 'tricycle', label: 'Tricycle', icon: Bike },
  { key: 'ferry', label: 'Ferry', icon: Sailboat },
  { key: 'roro', label: 'RORO', icon: Anchor },
  { key: 'boat', label: 'Boat', icon: Sailboat },
]

function locationTypeIcon(type: string): typeof MapPin {
  switch (type) {
    case 'port': return Anchor
    case 'terminal': return Compass
    case 'tourist_destination': return MapPin
    default: return MapPin
  }
}

export function TransportMapPage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [locations, setLocations] = useState<MapLocation[]>([])
  const [routes, setRoutes] = useState<MapRoute[]>([])
  const [alerts, setAlerts] = useState<MapAlert[]>([])
  const [loadState, setLoadState] = useState<LoadState>('loading')

  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState<LocationRow[]>([])
  const [showSearchResults, setShowSearchResults] = useState(false)
  const [modeFilter, setModeFilter] = useState<ModeFilterKey>('all')
  const [showFilters, setShowFilters] = useState(false)
  const [showRoutesOnly, setShowRoutesOnly] = useState(false)
  const [selectedLocation, setSelectedLocation] = useState<MapLocation | null>(null)
  const [savedPlaceId, setSavedPlaceId] = useState<string | null>(null)
  const [savingPlace, setSavingPlace] = useState(false)
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'loading' | 'granted' | 'denied'>('idle')
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [viewMode, setViewMode] = useState<'map' | 'list'>('list')

  const loadData = useCallback(async () => {
    setLoadState('loading')
    const [locs, rts, alts] = await Promise.all([
      fetchMapLocations(),
      fetchMapRoutes(),
      fetchMapAlerts(),
    ])
    setLocations(locs)
    setRoutes(rts)
    setAlerts(alts)
    setLoadState('done')
  }, [])

  useEffect(() => {
    void loadData().catch(() => setLoadState('error'))
  }, [loadData])

  // Debounced search
  useEffect(() => {
    if (!search.trim()) {
      setSearchResults([])
      setShowSearchResults(false)
      return
    }
    const timer = setTimeout(() => {
      void (async () => {
        const results = await searchMapLocations(search)
        setSearchResults(results)
        setShowSearchResults(true)
      })()
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  // Filter locations by transport mode
  const filteredLocations = useMemo(() => {
    if (modeFilter === 'all') return locations
    const modeRouteLocationIds = new Set<string>()
    for (const r of routes) {
      if (r.transport_mode?.code === modeFilter) {
        if (r.origin_location?.id) modeRouteLocationIds.add(r.origin_location.id)
        if (r.destination_location?.id) modeRouteLocationIds.add(r.destination_location.id)
      }
    }
    return locations.filter((l) => modeRouteLocationIds.has(l.id))
  }, [locations, routes, modeFilter])

  const filteredRoutes = useMemo(() => {
    if (modeFilter === 'all') return routes
    return routes.filter((r) => r.transport_mode?.code === modeFilter)
  }, [routes, modeFilter])

  // Alerts for selected location
  const alertsForLocation = useMemo(() => {
    if (!selectedLocation) return []
    return alerts.filter((a) => a.affected_location_id === selectedLocation.id)
  }, [alerts, selectedLocation])

  // Routes serving selected location
  const routesForLocation = useMemo(() => {
    if (!selectedLocation) return []
    return routes.filter(
      (r) => r.origin_location?.id === selectedLocation.id || r.destination_location?.id === selectedLocation.id,
    )
  }, [routes, selectedLocation])

  const handleLocationSelect = async (loc: MapLocation) => {
    setSelectedLocation(loc)
    setSavedPlaceId(null)
    if (user) {
      const { id } = await isPlaceSaved(loc.id)
      setSavedPlaceId(id)
    }
  }

  const handleRouteSelect = (route: MapRoute) => {
    if (route.origin_location?.latitude != null && route.origin_location?.longitude != null) {
      handleLocationSelect({
        id: route.origin_location.id,
        name: route.origin_location.name,
        type: 'terminal',
        municipality: null,
        barangay: null,
        latitude: route.origin_location.latitude,
        longitude: route.origin_location.longitude,
        verification_status: route.verification_status,
      })
    }
  }

  const handleSavePlace = async () => {
    if (!selectedLocation || !user) return
    setSavingPlace(true)
    if (savedPlaceId) {
      const ok = await unsaveMapPlace(savedPlaceId)
      if (ok) setSavedPlaceId(null)
    } else {
      const ok = await saveMapPlace({ locationId: selectedLocation.id, customName: selectedLocation.name })
      if (ok) {
        const { id } = await isPlaceSaved(selectedLocation.id)
        setSavedPlaceId(id)
      }
    }
    setSavingPlace(false)
  }

  const handleGps = () => {
    setGpsStatus('loading')
    if (!navigator.geolocation) {
      setGpsStatus('denied')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setGpsStatus('granted')
      },
      () => setGpsStatus('denied'),
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  const handleSearchResultClick = (loc: LocationRow) => {
    if (loc.latitude != null && loc.longitude != null) {
      handleLocationSelect({
        id: loc.id,
        name: loc.name,
        type: loc.type,
        municipality: loc.municipality,
        barangay: loc.barangay,
        latitude: loc.latitude,
        longitude: loc.longitude,
        verification_status: loc.verification_status,
      })
    }
    setShowSearchResults(false)
    setSearch('')
  }

  const passToRoutePlanner = (locationId: string, role: 'origin' | 'destination') => {
    navigate(`/plan?${role}=${locationId}`)
  }

  return (
    <div className="app-shell">
      <header className="sticky top-0 z-30 bg-ocean-800 text-white shadow-card">
        <div className="flex items-center gap-3 px-4 py-4">
          <Link to="/" aria-label="Back to home" className="grid h-9 w-9 place-items-center rounded-full bg-ocean-700 hover:bg-ocean-600">
            <ArrowLeft size={18} />
          </Link>
          <h1 className="text-lg font-bold">Mapa ng Transportasyon</h1>
        </div>
      </header>

      <main className="flex-1 space-y-4 px-4 py-5">
        {/* Search bar */}
        <section className="card">
          <div className="relative">
            <div className="flex items-center gap-2 rounded-xl bg-ocean-50 px-3 py-2.5">
              <SearchIcon size={18} className="text-ocean-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onFocus={() => searchResults.length > 0 && setShowSearchResults(true)}
                placeholder="Hanapin ang Lugar (Search location)"
                className="w-full bg-transparent text-sm text-ocean-900 placeholder:text-ocean-400 focus:outline-none"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => { setSearch(''); setShowSearchResults(false) }}
                  className="text-xs text-ocean-500"
                >
                  Clear
                </button>
              )}
            </div>
            {showSearchResults && searchResults.length > 0 && (
              <ul className="absolute z-20 mt-1 w-full max-h-60 overflow-auto rounded-xl bg-white shadow-cardHover">
                {searchResults.map((loc) => (
                  <li key={loc.id}>
                    <button
                      type="button"
                      className="w-full px-3 py-2 text-left text-sm text-ocean-900 hover:bg-ocean-50"
                      onClick={() => handleSearchResultClick(loc)}
                    >
                      <span className="font-semibold">{loc.name}</span>
                      {loc.municipality && <span className="text-xs text-ocean-500"> · {loc.municipality}</span>}
                      {loc.latitude == null && <span className="text-xs text-terra-600"> · No coordinates</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {showSearchResults && searchResults.length === 0 && search.trim() && (
              <div className="absolute z-20 mt-1 w-full rounded-xl bg-white shadow-cardHover p-3">
                <p className="text-sm text-ocean-600">No matching locations found.</p>
              </div>
            )}
          </div>

          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-1.5 text-sm font-semibold text-ocean-700"
            >
              <Filter size={16} /> {showFilters ? 'Hide' : 'Filters'}
            </button>
            <div className="ml-auto flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setViewMode(viewMode === 'map' ? 'list' : 'map')}
                className="flex items-center gap-1.5 text-sm font-semibold text-ocean-700"
              >
                <Layers size={16} /> {viewMode === 'map' ? 'List View' : 'Map View'}
              </button>
            </div>
          </div>
        </section>

        {/* Transport mode filters */}
        {showFilters && (
          <section className="card space-y-3">
            <div>
              <p className="mb-1.5 text-xs font-semibold text-ocean-600">Transport Mode</p>
              <div className="flex flex-wrap gap-1.5">
                {MODE_FILTERS.map((m) => (
                  <FilterChip
                    key={m.key}
                    active={modeFilter === m.key}
                    onClick={() => setModeFilter(m.key)}
                    label={m.label}
                    icon={m.icon}
                  />
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowRoutesOnly(!showRoutesOnly)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  showRoutesOnly ? 'bg-ocean-700 text-white' : 'bg-ocean-50 text-ocean-700'
                }`}
              >
                Routes Only
              </button>
            </div>
          </section>
        )}

        {/* GPS controls */}
        <section className="card flex items-center gap-3">
          <button
            type="button"
            onClick={handleGps}
            disabled={gpsStatus === 'loading'}
            className="flex items-center gap-2 rounded-xl bg-ocean-50 px-3 py-2 text-sm font-semibold text-ocean-700 hover:bg-ocean-100"
          >
            {gpsStatus === 'loading' ? <Loader2 size={16} className="animate-spin" /> : <LocateFixed size={16} />}
            Current Location
          </button>
          {gpsStatus === 'granted' && gpsCoords && (
            <span className="text-xs text-leaf-700">
              {gpsCoords.lat.toFixed(4)}, {gpsCoords.lng.toFixed(4)}
            </span>
          )}
          {gpsStatus === 'denied' && (
            <span className="text-xs text-terra-600">Location permission denied. You can still search manually.</span>
          )}
        </section>

        {/* Loading */}
        {loadState === 'loading' && (
          <div className="card flex items-center gap-3">
            <Loader2 size={18} className="animate-spin text-ocean-500" />
            <p className="text-sm font-semibold text-ocean-700">Loading transport map data…</p>
          </div>
        )}

        {/* Error */}
        {loadState === 'error' && (
          <div className="card flex flex-col items-center gap-3 text-center">
            <AlertCircle size={28} className="text-red-600" />
            <p className="text-sm font-semibold text-red-700">We couldn't load map data. Please try again.</p>
            <button type="button" onClick={() => void loadData()} className="btn-primary">Retry</button>
          </div>
        )}

        {loadState === 'done' && (
          <>
            {/* Active alerts banner */}
            {alerts.length > 0 && (
              <section className="card border-l-4 border-terra-400">
                <h2 className="flex items-center gap-1.5 section-title">
                  <Siren size={14} /> Abiso (Alerts)
                </h2>
                <div className="mt-2 space-y-2">
                  {alerts.slice(0, 3).map((a) => (
                    <div key={a.id} className="rounded-lg bg-terra-50 px-3 py-2">
                      <p className="text-sm font-bold text-ocean-900">{a.title}</p>
                      {a.description && <p className="text-xs text-ocean-600">{a.description}</p>}
                      <div className="mt-1 flex items-center gap-2">
                        <span className={`pill text-[10px] ${verificationClasses(a.verification_status as never)}`}>
                          {a.verification_status}
                        </span>
                        {a.end_at && <span className="text-xs text-ocean-500">Until {formatRelativeTime(a.end_at)}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Map view (visual marker representation) */}
            {viewMode === 'map' && (
              <section className="card">
                <div className="relative h-80 overflow-hidden rounded-xl bg-ocean-50">
                  {/* Simple coordinate-based visual map */}
                  <div className="absolute inset-0 grid grid-cols-8 grid-rows-6 opacity-30">
                    {Array.from({ length: 48 }).map((_, i) => (
                      <div key={i} className="border border-ocean-200" />
                    ))}
                  </div>
                  {filteredLocations.slice(0, 30).map((loc) => {
                    const Icon = locationTypeIcon(loc.type)
                    const left = ((loc.longitude ?? 121.8) - 121.5) * 200 + 30
                    const top = (13.7 - (loc.latitude ?? 13.5)) * 200 + 30
                    const isSelected = selectedLocation?.id === loc.id
                    return (
                      <button
                        key={loc.id}
                        type="button"
                        onClick={() => handleLocationSelect(loc)}
                        className={`absolute grid h-8 w-8 place-items-center rounded-full shadow-card transition hover:scale-110 ${
                          isSelected ? 'bg-ocean-700 text-white ring-2 ring-ocean-300' : 'bg-white text-ocean-700'
                        }`}
                        style={{ left: `${Math.max(2, Math.min(88, left))}%`, top: `${Math.max(2, Math.min(88, top))}%` }}
                        title={loc.name}
                      >
                        <Icon size={14} />
                      </button>
                    )
                  })}
                  {gpsCoords && (
                    <div
                      className="absolute grid h-8 w-8 place-items-center rounded-full bg-leaf-600 text-white shadow-card ring-2 ring-leaf-300"
                      style={{
                        left: `${Math.max(2, Math.min(88, ((gpsCoords.lng - 121.5) * 200 + 30)))}%`,
                        top: `${Math.max(2, Math.min(88, (13.7 - gpsCoords.lat) * 200 + 30))}%`,
                      }}
                      title="Your location"
                    >
                      <LocateFixed size={14} />
                    </div>
                  )}
                  <div className="absolute bottom-2 left-2 rounded-lg bg-white/90 px-2 py-1 text-xs text-ocean-600">
                    Marinduque · {filteredLocations.length} locations
                  </div>
                </div>
                <p className="mt-2 text-xs text-ocean-500">
                  Markers show verified locations with coordinates. Tap a marker for details.
                </p>
              </section>
            )}

            {/* Routes section */}
            {filteredRoutes.length > 0 && (
              <section className="space-y-3">
                <h2 className="flex items-center gap-1.5 section-title">
                  <RouteIcon size={14} /> Mga Ruta ({filteredRoutes.length})
                </h2>
                {filteredRoutes.map((r) => (
                  <div
                    key={r.id}
                    className="card cursor-pointer space-y-2 transition hover:shadow-cardHover active:scale-[0.99]"
                    onClick={() => handleRouteSelect(r)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-bold text-ocean-900">{r.route_name}</p>
                      <span className={`pill text-[10px] ${verificationClasses(r.verification_status)}`}>
                        {VERIFICATION_LABELS[r.verification_status]}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-ocean-800">
                      <MapPin size={14} className="text-terra-500" />
                      <span className="font-semibold">{r.origin_location?.name ?? 'Origin'}</span>
                      <span className="text-ocean-500">→</span>
                      <span className="font-semibold">{r.destination_location?.name ?? 'Destination'}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {r.transport_mode && (
                        <span className="pill bg-ocean-100 text-ocean-800 text-[10px]">{r.transport_mode.name}</span>
                      )}
                      {r.operator_name && (
                        <span className="pill bg-sand-200 text-ocean-700 text-[10px]">{r.operator_name}</span>
                      )}
                    </div>
                  </div>
                ))}
              </section>
            )}

            {/* Location list (default view and fallback) */}
            {!showRoutesOnly && (
              <section className="space-y-3">
                <h2 className="flex items-center gap-1.5 section-title">
                  <MapPin size={14} /> Mga Sakayan ({filteredLocations.length})
                </h2>
                {filteredLocations.length === 0 ? (
                  <div className="card flex flex-col items-center gap-2 text-center">
                    <span className="grid h-12 w-12 place-items-center rounded-full bg-sand-200 text-ocean-700">
                      <MapPin size={24} />
                    </span>
                    <p className="text-sm font-semibold text-ocean-700">
                      No verified locations with coordinates for this filter.
                    </p>
                  </div>
                ) : (
                  filteredLocations.map((loc) => {
                    const Icon = locationTypeIcon(loc.type)
                    return (
                      <div
                        key={loc.id}
                        className="card cursor-pointer space-y-2 transition hover:shadow-cardHover active:scale-[0.99]"
                        onClick={() => handleLocationSelect(loc)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Icon size={16} className="text-ocean-600" />
                            <p className="font-bold text-ocean-900">{loc.name}</p>
                          </div>
                          <span className={`pill text-[10px] ${verificationClasses(loc.verification_status)}`}>
                            {VERIFICATION_LABELS[loc.verification_status]}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 text-xs text-ocean-600">
                          {loc.municipality && <span>{loc.municipality}</span>}
                          {loc.barangay && <span>· {loc.barangay}</span>}
                          {loc.latitude != null && loc.longitude != null && (
                            <span className="text-ocean-400">
                              · {loc.latitude.toFixed(4)}, {loc.longitude.toFixed(4)}
                            </span>
                          )}
                        </div>
                        <div className="flex justify-end">
                          <ChevronRight size={18} className="text-ocean-400" />
                        </div>
                      </div>
                    )
                  })
                )}
              </section>
            )}

            {/* Empty overall state */}
            {locations.length === 0 && routes.length === 0 && (
              <div className="card flex flex-col items-center gap-3 text-center">
                <span className="grid h-14 w-14 place-items-center rounded-full bg-sand-200 text-ocean-700">
                  <MapPin size={28} />
                </span>
                <p className="text-base font-bold text-ocean-900">
                  No verified transport map data is available yet.
                </p>
                <p className="text-sm text-ocean-600">
                  Location markers and routes will appear here once verified coordinates are added.
                </p>
              </div>
            )}
          </>
        )}

        {/* Selected location detail panel */}
        {selectedLocation && (
          <div className="fixed inset-x-0 bottom-0 z-40 rounded-t-2xl bg-white shadow-cardHover">
            <div className="max-h-[60vh] overflow-auto px-4 py-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-lg font-bold text-ocean-900">{selectedLocation.name}</p>
                  <p className="text-xs text-ocean-600">
                    {selectedLocation.municipality}
                    {selectedLocation.barangay && ` · ${selectedLocation.barangay}`}
                  </p>
                  {selectedLocation.latitude != null && selectedLocation.longitude != null && (
                    <p className="text-xs text-ocean-400 mt-0.5">
                      {selectedLocation.latitude.toFixed(4)}, {selectedLocation.longitude.toFixed(4)}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedLocation(null)}
                  className="text-sm text-ocean-500"
                >
                  Close
                </button>
              </div>

              <span className={`pill text-[10px] ${verificationClasses(selectedLocation.verification_status)}`}>
                {VERIFICATION_LABELS[selectedLocation.verification_status]}
              </span>

              {/* Alerts for this location */}
              {alertsForLocation.length > 0 && (
                <div className="space-y-2">
                  {alertsForLocation.map((a) => (
                    <div key={a.id} className="rounded-lg bg-terra-50 px-3 py-2">
                      <p className="text-sm font-bold text-ocean-900">{a.title}</p>
                      {a.description && <p className="text-xs text-ocean-600">{a.description}</p>}
                    </div>
                  ))}
                </div>
              )}

              {/* Routes serving this location */}
              {routesForLocation.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-ocean-600">Serving Routes:</p>
                  {routesForLocation.map((r) => (
                    <Link
                      key={r.id}
                      to={`/route-detail?routeId=${r.id}`}
                      className="block rounded-lg bg-ocean-50 px-3 py-2 text-sm text-ocean-800 hover:bg-ocean-100"
                    >
                      {r.route_name} · {r.transport_mode?.name}
                    </Link>
                  ))}
                </div>
              )}

              {/* Actions */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => passToRoutePlanner(selectedLocation.id, 'origin')}
                  className="btn-primary flex items-center justify-center gap-1.5 text-xs"
                >
                  <Compass size={14} /> Set as Origin
                </button>
                <button
                  type="button"
                  onClick={() => passToRoutePlanner(selectedLocation.id, 'destination')}
                  className="btn-secondary flex items-center justify-center gap-1.5 text-xs"
                >
                  <Navigation size={14} /> Set as Destination
                </button>
                <Link
                  to={`/fare?locationId=${selectedLocation.id}`}
                  className="btn-secondary flex items-center justify-center gap-1.5 text-xs"
                >
                  <Wallet size={14} /> Check Fare
                </Link>
                {user && (
                  <button
                    type="button"
                    onClick={handleSavePlace}
                    disabled={savingPlace}
                    className="btn-secondary flex items-center justify-center gap-1.5 text-xs"
                  >
                    {savedPlaceId ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
                    {savedPlaceId ? 'Saved' : 'Save Place'}
                  </button>
                )}
              </div>

              {!user && (
                <Link to="/auth" className="block text-center text-xs text-ocean-600 underline">
                  Sign in to save this place
                </Link>
              )}
              {user && (
                <Link to="/saved-places" className="block text-center text-xs text-ocean-600 underline">
                  View all saved places
                </Link>
              )}
              <Link
                to={`/community-reports/new?location_id=${selectedLocation.id}&location_name=${encodeURIComponent(selectedLocation.name)}${selectedLocation.municipality ? `&municipality=${encodeURIComponent(selectedLocation.municipality)}` : ''}`}
                className="mt-1 block text-center text-xs text-terra-600 underline"
              >
                Report a Problem with This Location
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

function FilterChip({ active, onClick, label, icon: Icon }: { active: boolean; onClick: () => void; label: string; icon: typeof Bus }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition active:scale-95 ${
        active ? 'bg-ocean-700 text-white' : 'bg-ocean-50 text-ocean-700 hover:bg-ocean-100'
      }`}
    >
      <Icon size={12} /> {label}
    </button>
  )
}
