import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Search as SearchIcon,
  Filter,
  TrendingUp,
  TrendingDown,
  BadgeCheck,
  Bus,
  Clock,
  MapPin,
} from 'lucide-react'
import { getTransportModes } from '../lib/routes'
import { fetchMunicipalities, fetchFareUpdates, isUpcomingUpdate, isCurrentUpdate, updateTypeLabel, updateStatusLabel, updateStatusClasses, formatChange, formatDate } from '../lib/fareUpdates'
import { formatPeso } from '../lib/fares'
import type { FareUpdateWithDetails, TransportModeRow } from '../lib/types'

type StatusFilter = 'current' | 'upcoming' | 'recent'

export function FareUpdatesPage() {
  const navigate = useNavigate()

  const [updates, setUpdates] = useState<FareUpdateWithDetails[]>([])
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState('')
  const [transportFilter, setTransportFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('current')
  const [municipalityFilter, setMunicipalityFilter] = useState<string>('all')

  const [transportModes, setTransportModes] = useState<TransportModeRow[]>([])
  const [municipalities, setMunicipalities] = useState<string[]>([])

  useEffect(() => {
    void (async () => {
      const [modes, munis, upds] = await Promise.all([
        getTransportModes(),
        fetchMunicipalities(),
        fetchFareUpdates(),
      ])
      setTransportModes(modes)
      setMunicipalities(munis)
      setUpdates(upds)
      setLoading(false)
    })()
  }, [])

  const filtered = useMemo(() => {
    let list = updates
    const term = search.trim().toLowerCase()
    if (term) {
      list = list.filter((u) => {
        const routeName = u.route?.route_name?.toLowerCase() ?? ''
        const routeCode = u.route?.route_code?.toLowerCase() ?? ''
        const mode = u.route?.transport_mode?.name?.toLowerCase() ?? ''
        const origin = u.route?.origin_location?.name?.toLowerCase() ?? ''
        const dest = u.route?.destination_location?.name?.toLowerCase() ?? ''
        const originMuni = u.route?.origin_location?.municipality?.toLowerCase() ?? ''
        const destMuni = u.route?.destination_location?.municipality?.toLowerCase() ?? ''
        return (
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
      list = list.filter((u) => u.route?.transport_mode?.id === transportFilter)
    }
    if (municipalityFilter !== 'all') {
      list = list.filter((u) => {
        const originMuni = u.route?.origin_location?.municipality
        const destMuni = u.route?.destination_location?.municipality
        return originMuni === municipalityFilter || destMuni === municipalityFilter
      })
    }
    if (statusFilter === 'current') {
      list = list.filter(isCurrentUpdate)
    } else if (statusFilter === 'upcoming') {
      list = list.filter(isUpcomingUpdate)
    } else if (statusFilter === 'recent') {
      list = list.filter(isCurrentUpdate)
    }
    return list
  }, [updates, search, transportFilter, municipalityFilter, statusFilter])

  const upcoming = filtered.filter(isUpcomingUpdate)
  const current = filtered.filter(isCurrentUpdate)

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
          <h1 className="text-lg font-bold">Fare Updates</h1>
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
              placeholder="Search route or transport"
              className="w-full bg-transparent text-sm text-ocean-900 placeholder:text-ocean-400 focus:outline-none"
            />
          </div>
        </section>

        {/* Filters */}
        <section className="card space-y-3">
          <h2 className="flex items-center gap-1.5 section-title">
            <Filter size={14} /> Filters
          </h2>

          {/* Transport */}
          <div>
            <p className="mb-1.5 text-xs font-semibold text-ocean-600">Transport</p>
            <div className="flex flex-wrap gap-1.5">
              <FilterChip
                active={transportFilter === 'all'}
                onClick={() => setTransportFilter('all')}
                label="All"
              />
              {transportModes.map((m) => (
                <FilterChip
                  key={m.id}
                  active={transportFilter === m.id}
                  onClick={() => setTransportFilter(m.id)}
                  label={m.name}
                />
              ))}
            </div>
          </div>

          {/* Status */}
          <div>
            <p className="mb-1.5 text-xs font-semibold text-ocean-600">Status</p>
            <div className="flex flex-wrap gap-1.5">
              {(['current', 'upcoming', 'recent'] as StatusFilter[]).map((s) => (
                <FilterChip
                  key={s}
                  active={statusFilter === s}
                  onClick={() => setStatusFilter(s)}
                  label={s === 'current' ? 'Current' : s === 'upcoming' ? 'Upcoming' : 'Recently Updated'}
                />
              ))}
            </div>
          </div>

          {/* Municipality */}
          <div>
            <p className="mb-1.5 text-xs font-semibold text-ocean-600">Municipality</p>
            <div className="flex flex-wrap gap-1.5">
              <FilterChip
                active={municipalityFilter === 'all'}
                onClick={() => setMunicipalityFilter('all')}
                label="All"
              />
              {municipalities.map((m) => (
                <FilterChip
                  key={m}
                  active={municipalityFilter === m}
                  onClick={() => setMunicipalityFilter(m)}
                  label={m}
                />
              ))}
            </div>
          </div>
        </section>

        {/* Content */}
        {loading && (
          <div className="card flex items-center gap-3">
            <span className="h-3 w-3 animate-pulse rounded-full bg-ocean-400" />
            <p className="text-sm font-semibold text-ocean-700">
              Loading fare updates…
            </p>
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="card flex flex-col items-center gap-3 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-sand-200 text-ocean-700">
              <SearchIcon size={24} />
            </span>
            <p className="text-base font-bold text-ocean-900">
              No fare updates match your search.
            </p>
            <p className="text-sm text-ocean-700">
              Try different filters or check back later.
            </p>
          </div>
        )}

        {/* Upcoming fares */}
        {!loading && upcoming.length > 0 && (
          <section className="space-y-3">
            <h2 className="section-title">Upcoming Fare Changes</h2>
            {upcoming.map((u) => (
              <UpcomingFareCard key={u.id} update={u} onClick={() => navigate(`/fare-update/${u.id}`)} />
            ))}
          </section>
        )}

        {/* Current / recent fares */}
        {!loading && current.length > 0 && (
          <section className="space-y-3">
            <h2 className="section-title">
              {statusFilter === 'recent' ? 'Recently Updated' : 'Current Fares'}
            </h2>
            {current.map((u) => (
              <FareUpdateCard key={u.id} update={u} onClick={() => navigate(`/fare-update/${u.id}`)} />
            ))}
          </section>
        )}
      </main>
    </div>
  )
}

function FilterChip({
  active,
  onClick,
  label,
}: {
  active: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition active:scale-95 ${
        active
          ? 'bg-ocean-700 text-white'
          : 'bg-ocean-50 text-ocean-700 hover:bg-ocean-100'
      }`}
    >
      {label}
    </button>
  )
}

function FareUpdateCard({
  update,
  onClick,
}: {
  update: FareUpdateWithDetails
  onClick: () => void
}) {
  return (
    <div className="card space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="pill bg-ocean-100 text-ocean-800">
          <Bus size={12} /> {update.route?.transport_mode?.name ?? 'Transport'}
        </span>
        <span className={`pill ${updateStatusClasses(update.verification_status)}`}>
          {updateStatusLabel(update.verification_status)}
        </span>
      </div>

      <p className="font-bold text-ocean-900">{update.route?.route_name ?? 'Route'}</p>
      {update.route?.origin_location?.name && update.route?.destination_location?.name && (
        <p className="flex items-center gap-1 text-xs text-ocean-600">
          <MapPin size={12} />
          {update.route.origin_location.name} → {update.route.destination_location.name}
        </p>
      )}

      <div className="flex items-baseline justify-between">
        <div>
          <p className="text-xs text-ocean-600">Current fare</p>
          <p className="text-2xl font-bold text-ocean-900">{formatPeso(update.new_amount)}</p>
        </div>
        {update.previous_amount != null && update.change_amount !== 0 && (
          <div className="text-right">
            <p className="text-xs text-ocean-600">{updateTypeLabel(update.update_type)}</p>
            <p
              className={`text-sm font-bold ${
                update.change_amount > 0 ? 'text-terra-600' : 'text-leaf-700'
              }`}
            >
              {formatChange(update.change_amount)}
            </p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-ocean-600">
        <span className="flex items-center gap-1">
          <Clock size={12} /> Effective {formatDate(update.effective_from)}
        </span>
        {update.source && <span>Source: {update.source}</span>}
      </div>

      <button type="button" onClick={onClick} className="btn-secondary w-full">
        View Fare Details
      </button>
    </div>
  )
}

function UpcomingFareCard({
  update,
  onClick,
}: {
  update: FareUpdateWithDetails
  onClick: () => void
}) {
  return (
    <div className="card space-y-3 border-l-4 border-terra-500">
      <div className="flex flex-wrap items-center gap-2">
        <span className="pill bg-terra-100 text-terra-700">
          <Clock size={12} /> Upcoming
        </span>
        <span className={`pill ${updateStatusClasses(update.verification_status)}`}>
          {updateStatusLabel(update.verification_status)}
        </span>
      </div>

      <p className="font-bold text-ocean-900">{update.route?.route_name ?? 'Route'}</p>
      {update.route?.origin_location?.name && update.route?.destination_location?.name && (
        <p className="flex items-center gap-1 text-xs text-ocean-600">
          <MapPin size={12} />
          {update.route.origin_location.name} → {update.route.destination_location.name}
        </p>
      )}

      <div className="flex items-center justify-between rounded-xl bg-sand-100 px-3 py-2.5">
        {update.previous_amount != null ? (
          <>
            <div className="text-center">
              <p className="text-xs text-ocean-600">Current</p>
              <p className="text-lg font-bold text-ocean-700">{formatPeso(update.previous_amount)}</p>
            </div>
            {update.change_amount > 0 ? (
              <TrendingUp size={20} className="text-terra-600" />
            ) : update.change_amount < 0 ? (
              <TrendingDown size={20} className="text-leaf-700" />
            ) : (
              <BadgeCheck size={20} className="text-ocean-600" />
            )}
            <div className="text-center">
              <p className="text-xs text-ocean-600">New fare</p>
              <p className="text-lg font-bold text-ocean-900">{formatPeso(update.new_amount)}</p>
            </div>
          </>
        ) : (
          <div className="text-center w-full">
            <p className="text-xs text-ocean-600">New fare</p>
            <p className="text-lg font-bold text-ocean-900">{formatPeso(update.new_amount)}</p>
          </div>
        )}
      </div>

      <p className="text-xs text-ocean-600">
        Effective {formatDate(update.effective_from)}
      </p>

      <button type="button" onClick={onClick} className="btn-secondary w-full">
        View Fare Details
      </button>
    </div>
  )
}
