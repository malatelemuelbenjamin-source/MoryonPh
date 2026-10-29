import { useEffect, useMemo, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  Search as SearchIcon,
  Filter,
  MapPin,
  Bike,
  AlertCircle,
  ChevronRight,
  Navigation,
  Clock,
  Layers,
  Loader2,
} from 'lucide-react'
import {
  fetchTricycleMunicipalities,
  fetchServiceAreas,
  fetchFareZones,
  fetchTricycleRoutes,
  searchTricycleLocations,
  fetchZoneConnections,
  coverageTypeLabel,
  serviceTypeLabel,
} from '../lib/tricycleRoutes'
import { verificationClasses, VERIFICATION_LABELS, formatRelativeTime } from '../lib/labels'
import { formatPeso } from '../lib/fares'
import type {
  LocationRow,
  TricycleServiceAreaWithMunicipality,
  TricycleFareZoneWithDetails,
  TricycleZoneConnectionWithDetails,
} from '../lib/types'

type LoadState = 'loading' | 'done' | 'error'

export function TricycleRoutesPage() {
  const [municipalities, setMunicipalities] = useState<LocationRow[]>([])
  const [serviceAreas, setServiceAreas] = useState<TricycleServiceAreaWithMunicipality[]>([])
  const [fareZones, setFareZones] = useState<TricycleFareZoneWithDetails[]>([])
  const [tricycleRoutes, setTricycleRoutes] = useState<{
    id: string
    route_name: string
    route_code: string | null
    origin_location: { id: string; name: string; municipality: string | null } | null
    destination_location: { id: string; name: string; municipality: string | null } | null
    estimated_duration_minutes: number | null
    verification_status: string
  }[]>([])
  const [connections, setConnections] = useState<TricycleZoneConnectionWithDetails[]>([])
  const [loadState, setLoadState] = useState<LoadState>('loading')

  const [search, setSearch] = useState('')
  const [muniFilter, setMuniFilter] = useState('all')
  const [showFilters, setShowFilters] = useState(false)

  // Origin / destination search
  const [originQuery, setOriginQuery] = useState('')
  const [destQuery, setDestQuery] = useState('')
  const [originResults, setOriginResults] = useState<LocationRow[]>([])
  const [destResults, setDestResults] = useState<LocationRow[]>([])
  const [selectedOrigin, setSelectedOrigin] = useState<LocationRow | null>(null)
  const [selectedDest, setSelectedDest] = useState<LocationRow | null>(null)
  const [searchResults, setSearchResults] = useState<TricycleZoneConnectionWithDetails[]>([])
  const [searching, setSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

  const loadData = useCallback(async () => {
    setLoadState('loading')
    const [munis, areas, zones, routes] = await Promise.all([
      fetchTricycleMunicipalities(),
      fetchServiceAreas(),
      fetchFareZones(),
      fetchTricycleRoutes(),
    ])
    setMunicipalities(munis)
    setServiceAreas(areas)
    setFareZones(zones)
    setTricycleRoutes(routes)
    const conns = await fetchZoneConnections()
    setConnections(conns)
    setLoadState('done')
  }, [])

  useEffect(() => {
    void loadData().catch(() => setLoadState('error'))
  }, [loadData])

  // Origin search
  useEffect(() => {
    if (!originQuery.trim() || selectedOrigin) return
    const timer = setTimeout(() => {
      void (async () => {
        const results = await searchTricycleLocations(originQuery, muniFilter)
        setOriginResults(results)
      })()
    }, 300)
    return () => clearTimeout(timer)
  }, [originQuery, selectedOrigin, muniFilter])

  // Destination search
  useEffect(() => {
    if (!destQuery.trim() || selectedDest) return
    const timer = setTimeout(() => {
      void (async () => {
        const results = await searchTricycleLocations(destQuery, muniFilter)
        setDestResults(results)
      })()
    }, 300)
    return () => clearTimeout(timer)
  }, [destQuery, selectedDest, muniFilter])

  const handleSearch = async () => {
    if (!selectedOrigin || !selectedDest) return
    setSearching(true)
    setHasSearched(true)
    const conns = await fetchZoneConnections()
    const matched = conns.filter((c) => {
      const originMatch =
        c.origin_zone?.name?.toLowerCase().includes(selectedOrigin.name.toLowerCase()) ||
        c.origin_zone?.name?.toLowerCase().includes(selectedOrigin.municipality?.toLowerCase() ?? '')
      const destMatch =
        c.destination_zone?.name?.toLowerCase().includes(selectedDest.name.toLowerCase()) ||
        c.destination_zone?.name?.toLowerCase().includes(selectedDest.municipality?.toLowerCase() ?? '')
      return originMatch || destMatch
    })
    setSearchResults(matched)
    setSearching(false)
  }

  const filteredAreas = useMemo(() => {
    const term = search.trim().toLowerCase()
    let list = serviceAreas
    if (muniFilter !== 'all') {
      list = list.filter((a) => a.municipality_id === muniFilter)
    }
    if (term) {
      list = list.filter((a) => {
        return (
          a.name.toLowerCase().includes(term) ||
          a.municipality?.name.toLowerCase().includes(term) ||
          a.description?.toLowerCase().includes(term)
        )
      })
    }
    return list
  }, [serviceAreas, search, muniFilter])

  const filteredZones = useMemo(() => {
    let list = fareZones
    if (muniFilter !== 'all') {
      list = list.filter((z) => z.municipality_id === muniFilter)
    }
    return list
  }, [fareZones, muniFilter])

  const filteredRoutes = useMemo(() => {
    let list = tricycleRoutes
    if (muniFilter !== 'all') {
      list = list.filter(
        (r) =>
          r.origin_location?.municipality === municipalities.find((m) => m.id === muniFilter)?.name ||
          r.destination_location?.municipality === municipalities.find((m) => m.id === muniFilter)?.name,
      )
    }
    const term = search.trim().toLowerCase()
    if (term) {
      list = list.filter(
        (r) =>
          r.route_name.toLowerCase().includes(term) ||
          r.origin_location?.name.toLowerCase().includes(term) ||
          r.destination_location?.name.toLowerCase().includes(term),
      )
    }
    return list
  }, [tricycleRoutes, muniFilter, search, municipalities])

  return (
    <div className="app-shell">
      <header className="sticky top-0 z-30 bg-ocean-800 text-white shadow-card">
        <div className="flex items-center gap-3 px-4 py-4">
          <Link to="/" aria-label="Back to home" className="grid h-9 w-9 place-items-center rounded-full bg-ocean-700 hover:bg-ocean-600">
            <ArrowLeft size={18} />
          </Link>
          <h1 className="text-lg font-bold">Tricycle Routes</h1>
        </div>
      </header>

      <main className="flex-1 space-y-5 px-4 py-5">
        {/* Search origin/destination */}
        <section className="card space-y-3">
          <h2 className="flex items-center gap-1.5 section-title">
            <Navigation size={14} /> Hanapin ang Trip
          </h2>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-ocean-600">Pinanggalingan (Origin)</label>
            <div className="relative">
              <div className="flex items-center gap-2 rounded-xl bg-ocean-50 px-3 py-2.5">
                <MapPin size={16} className="text-terra-500" />
                <input
                  type="text"
                  value={selectedOrigin ? selectedOrigin.name : originQuery}
                  onChange={(e) => {
                    setOriginQuery(e.target.value)
                    setSelectedOrigin(null)
                  }}
                  placeholder="Barangay, terminal, o landmark"
                  className="w-full bg-transparent text-sm text-ocean-900 placeholder:text-ocean-400 focus:outline-none"
                />
              </div>
              {!selectedOrigin && originQuery && originResults.length > 0 && (
                <ul className="absolute z-20 mt-1 w-full rounded-xl bg-white shadow-cardHover">
                  {originResults.map((loc) => (
                    <li key={loc.id}>
                      <button
                        type="button"
                        className="w-full px-3 py-2 text-left text-sm text-ocean-900 hover:bg-ocean-50"
                        onClick={() => {
                          setSelectedOrigin(loc)
                          setOriginQuery('')
                          setOriginResults([])
                        }}
                      >
                        {loc.name}
                        {loc.municipality && <span className="text-xs text-ocean-500"> · {loc.municipality}</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-ocean-600">Patutunguhan (Destination)</label>
            <div className="relative">
              <div className="flex items-center gap-2 rounded-xl bg-ocean-50 px-3 py-2.5">
                <MapPin size={16} className="text-leaf-600" />
                <input
                  type="text"
                  value={selectedDest ? selectedDest.name : destQuery}
                  onChange={(e) => {
                    setDestQuery(e.target.value)
                    setSelectedDest(null)
                  }}
                  placeholder="Barangay, terminal, o landmark"
                  className="w-full bg-transparent text-sm text-ocean-900 placeholder:text-ocean-400 focus:outline-none"
                />
              </div>
              {!selectedDest && destQuery && destResults.length > 0 && (
                <ul className="absolute z-20 mt-1 w-full rounded-xl bg-white shadow-cardHover">
                  {destResults.map((loc) => (
                    <li key={loc.id}>
                      <button
                        type="button"
                        className="w-full px-3 py-2 text-left text-sm text-ocean-900 hover:bg-ocean-50"
                        onClick={() => {
                          setSelectedDest(loc)
                          setDestQuery('')
                          setDestResults([])
                        }}
                      >
                        {loc.name}
                        {loc.municipality && <span className="text-xs text-ocean-500"> · {loc.municipality}</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={handleSearch}
            disabled={!selectedOrigin || !selectedDest || searching}
            className="btn-primary w-full disabled:opacity-50"
          >
            {searching ? <Loader2 size={16} className="animate-spin" /> : 'Tingnan ang Ruta'}
          </button>
        </section>

        {/* Search results */}
        {hasSearched && (
          <section className="space-y-3">
            <h2 className="section-title">Search Results</h2>
            {searchResults.length === 0 ? (
              <div className="card flex flex-col items-center gap-2 text-center">
                <AlertCircle size={24} className="text-ocean-400" />
                <p className="text-sm font-semibold text-ocean-700">
                  No verified tricycle route information is available for this journey yet.
                </p>
              </div>
            ) : (
              searchResults.map((c) => <ZoneConnectionCard key={c.id} conn={c} />)
            )}
          </section>
        )}

        {/* Text search + filters */}
        <section className="card">
          <div className="flex items-center gap-2 rounded-xl bg-ocean-50 px-3 py-2.5">
            <SearchIcon size={18} className="text-ocean-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search service areas, zones, routes"
              className="w-full bg-transparent text-sm text-ocean-900 placeholder:text-ocean-400 focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-ocean-700"
          >
            <Filter size={16} /> {showFilters ? 'Hide Filters' : 'Show Filters'}
          </button>
        </section>

        {/* Municipality filter */}
        {showFilters && (
          <section className="card space-y-3">
            <div>
              <p className="mb-1.5 text-xs font-semibold text-ocean-600">Municipality</p>
              <div className="flex flex-wrap gap-1.5">
                <FilterChip active={muniFilter === 'all'} onClick={() => setMuniFilter('all')} label="All" />
                {municipalities.map((m) => (
                  <FilterChip key={m.id} active={muniFilter === m.id} onClick={() => setMuniFilter(m.id)} label={m.name} />
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Loading */}
        {loadState === 'loading' && (
          <div className="card flex items-center gap-3">
            <span className="h-3 w-3 animate-pulse rounded-full bg-ocean-400" />
            <p className="text-sm font-semibold text-ocean-700">Loading verified tricycle information…</p>
          </div>
        )}

        {/* Error */}
        {loadState === 'error' && (
          <div className="card flex flex-col items-center gap-3 text-center">
            <AlertCircle size={28} className="text-red-600" />
            <p className="text-sm font-semibold text-red-700">We couldn't load tricycle information. Please try again.</p>
            <button type="button" onClick={() => void loadData()} className="btn-primary">Retry</button>
          </div>
        )}

        {loadState === 'done' && (
          <>
            {/* Service areas */}
            <section className="space-y-3">
              <h2 className="flex items-center gap-1.5 section-title">
                <Bike size={14} /> Service Areas
              </h2>
              {filteredAreas.length === 0 ? (
                <div className="card flex flex-col items-center gap-2 text-center">
                  <span className="grid h-12 w-12 place-items-center rounded-full bg-sand-200 text-ocean-700">
                    <Bike size={24} />
                  </span>
                  <p className="text-sm font-semibold text-ocean-700">
                    {serviceAreas.length === 0
                      ? 'No verified tricycle service areas are available yet.'
                      : 'No service areas match your filters.'}
                  </p>
                </div>
              ) : (
                filteredAreas.map((area) => (
                  <Link
                    key={area.id}
                    to={`/tricycle-routes/${area.id}`}
                    className="card block space-y-2 transition hover:shadow-cardHover active:scale-[0.99]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-bold text-ocean-900">{area.name}</p>
                      <span className={`pill text-[10px] ${verificationClasses(area.verification_status)}`}>
                        {VERIFICATION_LABELS[area.verification_status]}
                      </span>
                    </div>
                    {area.municipality && (
                      <p className="flex items-center gap-1 text-xs text-ocean-600">
                        <MapPin size={12} /> {area.municipality.name}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-1.5">
                      <span className="pill bg-ocean-100 text-ocean-800 text-[10px]">
                        {coverageTypeLabel(area.coverage_type)}
                      </span>
                    </div>
                    {area.verified_at && (
                      <p className="text-xs text-ocean-500">Verified {formatRelativeTime(area.verified_at)}</p>
                    )}
                    <div className="flex justify-end">
                      <ChevronRight size={18} className="text-ocean-400" />
                    </div>
                  </Link>
                ))
              )}
            </section>

            {/* Fare zones */}
            {filteredZones.length > 0 && (
              <section className="space-y-3">
                <h2 className="flex items-center gap-1.5 section-title">
                  <Layers size={14} /> Fare Zones
                </h2>
                {filteredZones.map((zone) => (
                  <div key={zone.id} className="card space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-bold text-ocean-900">{zone.name}</p>
                      <span className={`pill text-[10px] ${verificationClasses(zone.verification_status)}`}>
                        {VERIFICATION_LABELS[zone.verification_status]}
                      </span>
                    </div>
                    {zone.municipality && (
                      <p className="flex items-center gap-1 text-xs text-ocean-600">
                        <MapPin size={12} /> {zone.municipality.name}
                      </p>
                    )}
                    {zone.service_area && (
                      <p className="text-xs text-ocean-500">Area: {zone.service_area.name}</p>
                    )}
                    {zone.description && <p className="text-xs text-ocean-600">{zone.description}</p>}
                  </div>
                ))}
              </section>
            )}

            {/* Tricycle routes */}
            {filteredRoutes.length > 0 && (
              <section className="space-y-3">
                <h2 className="flex items-center gap-1.5 section-title">
                  <Bike size={14} /> Verified Tricycle Routes
                </h2>
                {filteredRoutes.map((r) => (
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

            {/* Zone connections with fare info */}
            {connections.length > 0 && (
              <section className="space-y-3">
                <h2 className="flex items-center gap-1.5 section-title">
                  <Layers size={14} /> Zone Connections & Fares
                </h2>
                {connections.map((c) => (
                  <ZoneConnectionCard key={c.id} conn={c} />
                ))}
              </section>
            )}

            {/* Empty overall state */}
            {serviceAreas.length === 0 && fareZones.length === 0 && tricycleRoutes.length === 0 && connections.length === 0 && (
              <div className="card flex flex-col items-center gap-3 text-center">
                <span className="grid h-14 w-14 place-items-center rounded-full bg-sand-200 text-ocean-700">
                  <Bike size={28} />
                </span>
                <p className="text-base font-bold text-ocean-900">
                  Verified tricycle route information is not yet available.
                </p>
                <p className="text-sm text-ocean-600">
                  Service areas, fare zones, and route data will appear here once verified.
                </p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}

function ZoneConnectionCard({ conn }: { conn: TricycleZoneConnectionWithDetails }) {
  return (
    <div className="card space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <p className="font-bold text-ocean-900">
            {conn.origin_zone?.name ?? 'Origin Zone'} → {conn.destination_zone?.name ?? 'Destination Zone'}
          </p>
        </div>
        <span className={`pill text-[10px] ${verificationClasses(conn.verification_status)}`}>
          {VERIFICATION_LABELS[conn.verification_status]}
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <span className="pill bg-ocean-100 text-ocean-800 text-[10px]">
          {serviceTypeLabel(conn.service_type)}
        </span>
        {conn.fare && (
          <span className="pill bg-leaf-400/20 text-leaf-700 text-[10px]">
            Pamasahe: {formatPeso(Number(conn.fare.base_fare))}
          </span>
        )}
      </div>

      {!conn.fare && <p className="text-xs text-ocean-500">Fare not yet verified</p>}

      {conn.availability_notes && <p className="text-xs text-ocean-600">{conn.availability_notes}</p>}
      {conn.source_name && <p className="text-xs text-ocean-500">Source: {conn.source_name}</p>}
    </div>
  )
}

function FilterChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition active:scale-95 ${
        active ? 'bg-ocean-700 text-white' : 'bg-ocean-50 text-ocean-700 hover:bg-ocean-100'
      }`}
    >
      {label}
    </button>
  )
}
