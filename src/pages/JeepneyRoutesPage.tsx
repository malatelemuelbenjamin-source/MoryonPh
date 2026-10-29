import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Search as SearchIcon,
  Filter,
  Bus,
  MapPin,
  Clock,
  AlertCircle,
  ChevronRight,
} from 'lucide-react'
import {
  fetchJeepneyRoutes,
  fetchJeepneyMunicipalities,
  fetchJeepneyDirections,
} from '../lib/jeepneyRoutes'
import { verificationClasses, VERIFICATION_LABELS, formatRelativeTime } from '../lib/labels'
import type { JeepneyRouteWithDetails } from '../lib/types'

type LoadState = 'loading' | 'done' | 'error'

export function JeepneyRoutesPage() {
  const navigate = useNavigate()

  const [routes, setRoutes] = useState<JeepneyRouteWithDetails[]>([])
  const [municipalities, setMunicipalities] = useState<string[]>([])
  const [directions, setDirections] = useState<string[]>([])
  const [loadState, setLoadState] = useState<LoadState>('loading')

  const [search, setSearch] = useState('')
  const [municipalityFilter, setMunicipalityFilter] = useState('all')
  const [directionFilter, setDirectionFilter] = useState('all')
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => {
    void (async () => {
      const [routesData, munis, dirs] = await Promise.all([
        fetchJeepneyRoutes(),
        fetchJeepneyMunicipalities(),
        fetchJeepneyDirections(),
      ])
      setRoutes(routesData)
      setMunicipalities(munis)
      setDirections(dirs)
      setLoadState('done')
    })().catch(() => setLoadState('error'))
  }, [])

  const filteredRoutes = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return routes
    return routes.filter((r) => {
      const name = r.route_name.toLowerCase()
      const code = r.route_code?.toLowerCase() ?? ''
      const origin = r.origin_location?.name.toLowerCase() ?? ''
      const dest = r.destination_location?.name.toLowerCase() ?? ''
      return name.includes(term) || code.includes(term) || origin.includes(term) || dest.includes(term)
    })
  }, [routes, search])

  return (
    <div className="app-shell">
      <header className="sticky top-0 z-30 bg-ocean-800 text-white shadow-card">
        <div className="flex items-center gap-3 px-4 py-4">
          <Link to="/" aria-label="Back to home" className="grid h-9 w-9 place-items-center rounded-full bg-ocean-700 hover:bg-ocean-600">
            <ArrowLeft size={18} />
          </Link>
          <h1 className="text-lg font-bold">Jeepney Routes</h1>
        </div>
      </header>

      <main className="flex-1 space-y-4 px-4 py-5">
        {/* Search */}
        <section className="card">
          <div className="flex items-center gap-2 rounded-xl bg-ocean-50 px-3 py-2.5">
            <SearchIcon size={18} className="text-ocean-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search routes, stops, destinations"
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

        {/* Filters */}
        {showFilters && (
          <section className="card space-y-3">
            {municipalities.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-semibold text-ocean-600">Municipality</p>
                <div className="flex flex-wrap gap-1.5">
                  <FilterChip active={municipalityFilter === 'all'} onClick={() => setMunicipalityFilter('all')} label="All" />
                  {municipalities.map((m) => (
                    <FilterChip key={m} active={municipalityFilter === m} onClick={() => setMunicipalityFilter(m)} label={m} />
                  ))}
                </div>
              </div>
            )}
            {directions.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-semibold text-ocean-600">Direction</p>
                <div className="flex flex-wrap gap-1.5">
                  <FilterChip active={directionFilter === 'all'} onClick={() => setDirectionFilter('all')} label="All" />
                  {directions.map((d) => (
                    <FilterChip key={d} active={directionFilter === d} onClick={() => setDirectionFilter(d)} label={d} />
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* Loading */}
        {loadState === 'loading' && (
          <div className="card flex items-center gap-3">
            <span className="h-3 w-3 animate-pulse rounded-full bg-ocean-400" />
            <p className="text-sm font-semibold text-ocean-700">Loading verified jeepney routes…</p>
          </div>
        )}

        {/* Error */}
        {loadState === 'error' && (
          <div className="card flex flex-col items-center gap-3 text-center">
            <AlertCircle size={28} className="text-red-600" />
            <p className="text-sm font-semibold text-red-700">We couldn't load route information. Please try again.</p>
            <button type="button" onClick={() => window.location.reload()} className="btn-primary">Retry</button>
          </div>
        )}

        {/* Empty */}
        {loadState === 'done' && filteredRoutes.length === 0 && (
          <div className="card flex flex-col items-center gap-3 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-sand-200 text-ocean-700">
              <Bus size={24} />
            </span>
            {routes.length === 0 ? (
              <p className="text-base font-bold text-ocean-900">Verified jeepney route information is not yet available.</p>
            ) : (
              <p className="text-base font-bold text-ocean-900">No routes match your search.</p>
            )}
          </div>
        )}

        {/* Route cards */}
        {loadState === 'done' && filteredRoutes.length > 0 && (
          <section className="space-y-3">
            {filteredRoutes.map((r) => (
              <div
                key={r.id}
                className="card cursor-pointer transition hover:shadow-cardHover active:scale-[0.99]"
                onClick={() => navigate(`/jeepney-routes/${r.id}`)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <p className="font-bold text-ocean-900">{r.route_name}</p>
                    {r.route_code && <p className="text-xs text-ocean-500">Code: {r.route_code}</p>}
                  </div>
                  <span className={`pill text-[10px] ${verificationClasses(r.verification_status)}`}>
                    {VERIFICATION_LABELS[r.verification_status]}
                  </span>
                </div>

                <div className="mt-2 flex items-center gap-2 text-sm text-ocean-800">
                  <MapPin size={14} className="text-terra-500" />
                  <span className="font-semibold">{r.origin_location?.name ?? 'Origin'}</span>
                  <span className="text-ocean-500">→</span>
                  <span className="font-semibold">{r.destination_location?.name ?? 'Destination'}</span>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="pill bg-ocean-100 text-ocean-800 text-[10px]">
                    {r.stop_count} {r.stop_count === 1 ? 'stop' : 'stops'}
                  </span>
                  {r.origin_location?.municipality && (
                    <span className="pill bg-sand-200 text-ocean-700 text-[10px]">
                      {r.origin_location.municipality}
                    </span>
                  )}
                  {r.estimated_duration_minutes && (
                    <span className="pill bg-leaf-400/20 text-leaf-700 text-[10px]">
                      <Clock size={10} /> {r.estimated_duration_minutes} min
                    </span>
                  )}
                </div>

                {r.last_verified_at && (
                  <p className="mt-1.5 text-xs text-ocean-500">
                    Last verified {formatRelativeTime(r.last_verified_at)}
                  </p>
                )}

                <div className="mt-2 flex justify-end">
                  <ChevronRight size={18} className="text-ocean-400" />
                </div>
              </div>
            ))}
          </section>
        )}
      </main>
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
