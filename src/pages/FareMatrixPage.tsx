import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Search as SearchIcon,
  Filter,
  Table2,
  Bus,
  MapPin,
  BadgeCheck,
  Clock,
} from 'lucide-react'
import { getTransportModes } from '../lib/routes'
import { fetchFareMatrices, fetchMunicipalitiesForMatrix, matrixTypeLabel, formatDate, isMatrixCurrent } from '../lib/fareMatrix'
import { verificationClasses, VERIFICATION_LABELS } from '../lib/labels'
import type { FareMatrixWithDetails, TransportModeRow } from '../lib/types'

export function FareMatrixPage() {
  const navigate = useNavigate()

  const [matrices, setMatrices] = useState<FareMatrixWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const [search, setSearch] = useState('')
  const [transportFilter, setTransportFilter] = useState<string>('all')
  const [municipalityFilter, setMunicipalityFilter] = useState<string>('all')
  const [passengerFilter, setPassengerFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const [transportModes, setTransportModes] = useState<TransportModeRow[]>([])
  const [municipalities, setMunicipalities] = useState<string[]>([])

  useEffect(() => {
    void (async () => {
      const [modes, munis, mats] = await Promise.all([
        getTransportModes(),
        fetchMunicipalitiesForMatrix(),
        fetchFareMatrices(),
      ])
      setTransportModes(modes)
      setMunicipalities(munis)
      setMatrices(mats.filter(isMatrixCurrent))
      setLoading(false)
    })().catch(() => {
      setError(true)
      setLoading(false)
    })
  }, [])

  const filtered = useMemo(() => {
    let list = matrices
    const term = search.trim().toLowerCase()
    if (term) {
      list = list.filter((m) => {
        const title = m.title.toLowerCase()
        const routeName = m.route?.route_name?.toLowerCase() ?? ''
        const routeCode = m.route?.route_code?.toLowerCase() ?? ''
        const mode = m.transport_mode?.name?.toLowerCase() ?? ''
        const origin = m.route?.origin_location?.name?.toLowerCase() ?? ''
        const dest = m.route?.destination_location?.name?.toLowerCase() ?? ''
        const originMuni = m.route?.origin_location?.municipality?.toLowerCase() ?? ''
        const destMuni = m.route?.destination_location?.municipality?.toLowerCase() ?? ''
        return (
          title.includes(term) ||
          routeName.includes(term) ||
          routeCode.includes(term) ||
          mode.includes(term) ||
          origin.includes(term) ||
          dest.includes(term) ||
          originMuni.includes(term) ||
          destMuni.includes(term)
        )
      })
    }
    if (transportFilter !== 'all') {
      list = list.filter((m) => m.transport_mode?.id === transportFilter)
    }
    if (municipalityFilter !== 'all') {
      list = list.filter((m) => {
        const originMuni = m.route?.origin_location?.municipality
        const destMuni = m.route?.destination_location?.municipality
        return originMuni === municipalityFilter || destMuni === municipalityFilter
      })
    }
    if (statusFilter !== 'all') {
      list = list.filter((m) => m.verification_status === statusFilter)
    }
    // passenger filter applies at entry level; we just keep the matrices visible
    // and the detail page / table will reflect it.
    return list
  }, [matrices, search, transportFilter, municipalityFilter, passengerFilter, statusFilter])

  return (
    <div className="app-shell">
      <header className="sticky top-0 z-30 bg-ocean-800 text-white shadow-card">
        <div className="flex items-center gap-3 px-4 py-4">
          <Link to="/" aria-label="Back to home" className="grid h-9 w-9 place-items-center rounded-full bg-ocean-700 hover:bg-ocean-600">
            <ArrowLeft size={18} />
          </Link>
          <h1 className="text-lg font-bold">Fare Matrix</h1>
        </div>
      </header>

      <main className="flex-1 space-y-5 px-4 py-5">
        {/* Search */}
        <section className="card">
          <div className="flex items-center gap-2 rounded-xl bg-ocean-50 px-3 py-2.5">
            <SearchIcon size={18} className="text-ocean-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search route, location, or transport"
              className="w-full bg-transparent text-sm text-ocean-900 placeholder:text-ocean-400 focus:outline-none"
            />
          </div>
        </section>

        {/* Filters */}
        <section className="card space-y-3">
          <h2 className="flex items-center gap-1.5 section-title">
            <Filter size={14} /> Filters
          </h2>

          <FilterGroup label="Transport">
            <FilterChip active={transportFilter === 'all'} onClick={() => setTransportFilter('all')} label="All" />
            {transportModes.map((m) => (
              <FilterChip key={m.id} active={transportFilter === m.id} onClick={() => setTransportFilter(m.id)} label={m.name} />
            ))}
          </FilterGroup>

          <FilterGroup label="Municipality">
            <FilterChip active={municipalityFilter === 'all'} onClick={() => setMunicipalityFilter('all')} label="All" />
            {municipalities.map((m) => (
              <FilterChip key={m} active={municipalityFilter === m} onClick={() => setMunicipalityFilter(m)} label={m} />
            ))}
          </FilterGroup>

          <FilterGroup label="Passenger Type">
            {(['all', 'regular', 'student', 'senior', 'pwd'] as const).map((p) => (
              <FilterChip
                key={p}
                active={passengerFilter === p}
                onClick={() => setPassengerFilter(p)}
                label={p === 'all' ? 'All' : p === 'senior' ? 'Senior' : p.charAt(0).toUpperCase() + p.slice(1)}
              />
            ))}
          </FilterGroup>

          <FilterGroup label="Verification">
            {(['all', 'official', 'verified', 'community'] as const).map((s) => (
              <FilterChip
                key={s}
                active={statusFilter === s}
                onClick={() => setStatusFilter(s)}
                label={s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
              />
            ))}
          </FilterGroup>
        </section>

        {/* Content */}
        {loading && (
          <div className="card flex items-center gap-3">
            <span className="h-3 w-3 animate-pulse rounded-full bg-ocean-400" />
            <p className="text-sm font-semibold text-ocean-700">Loading fare matrices…</p>
          </div>
        )}

        {error && (
          <div className="card flex flex-col items-center gap-2 text-center">
            <p className="text-sm font-semibold text-red-700">We couldn't load fare information. Please try again.</p>
            <button type="button" onClick={() => window.location.reload()} className="btn-primary mt-2">Retry</button>
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="card flex flex-col items-center gap-3 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-sand-200 text-ocean-700">
              <Table2 size={24} />
            </span>
            <p className="text-base font-bold text-ocean-900">
              {matrices.length === 0 ? 'Verified fare matrix not yet available.' : 'No fare matrices match your search.'}
            </p>
          </div>
        )}

        {/* Matrix cards */}
        {!loading && !error && filtered.length > 0 && (
          <section className="space-y-3">
            <h2 className="section-title">Fare Matrices</h2>
            {filtered.map((m) => (
              <div
                key={m.id}
                className="card space-y-3 transition hover:shadow-cardHover active:scale-[0.99] cursor-pointer"
                onClick={() => navigate(`/fare-matrix/${m.id}`)}
              >
                <div className="flex flex-wrap items-center gap-2">
                  {m.transport_mode && (
                    <span className="pill bg-ocean-100 text-ocean-800">
                      <Bus size={12} /> {m.transport_mode.name}
                    </span>
                  )}
                  <span className={`pill ${verificationClasses(m.verification_status)}`}>
                    {VERIFICATION_LABELS[m.verification_status]}
                  </span>
                  <span className="pill bg-sand-200 text-ocean-700">{matrixTypeLabel(m.matrix_type)}</span>
                </div>

                <div>
                  <p className="font-bold text-ocean-900">{m.title}</p>
                  {m.route?.route_name && (
                    <p className="text-sm text-ocean-700">{m.route.route_name}</p>
                  )}
                  {m.route?.origin_location?.name && m.route?.destination_location?.name && (
                    <p className="flex items-center gap-1 text-xs text-ocean-600">
                      <MapPin size={12} />
                      {m.route.origin_location.name} → {m.route.destination_location.name}
                    </p>
                  )}
                </div>

                {m.description && (
                  <p className="text-xs text-ocean-600">{m.description}</p>
                )}

                <div className="flex flex-wrap gap-3 text-xs text-ocean-600">
                  <span className="flex items-center gap-1">
                    <Clock size={12} /> Effective {formatDate(m.effective_from)}
                  </span>
                  {m.last_verified_at && (
                    <span className="flex items-center gap-1">
                      <BadgeCheck size={12} /> Verified {formatDate(m.last_verified_at)}
                    </span>
                  )}
                  {m.source && <span>Source: {m.source}</span>}
                </div>

                <button type="button" className="btn-secondary w-full" onClick={(e) => { e.stopPropagation(); navigate(`/fare-matrix/${m.id}`) }}>
                  View Fare Matrix
                </button>
              </div>
            ))}
          </section>
        )}
      </main>
    </div>
  )
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold text-ocean-600">{label}</p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
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
