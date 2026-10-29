import { useEffect, useMemo, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  Search as SearchIcon,
  Filter,
  MapPin,
  Sailboat,
  AlertCircle,
  ChevronRight,
  Clock,
  Anchor,
  Loader2,
  Waves,
} from 'lucide-react'
import {
  fetchPorts,
  fetchSeaTransportRoutes,
  fetchSchedules,
  portTypeLabel,
  operatingStatusLabel,
  operatingStatusClass,
  scheduleTypeLabel,
  scheduleStatusLabel,
  scheduleStatusClass,
  formatDateTime,
} from '../lib/seaTransport'
import { verificationClasses, VERIFICATION_LABELS, formatRelativeTime } from '../lib/labels'
import type {
  PortWithLocation,
  SeaRouteWithDetails,
  ScheduleWithDetails,
} from '../lib/types'

type LoadState = 'loading' | 'done' | 'error'

export function PortsSeaTransportPage() {
  const [ports, setPorts] = useState<PortWithLocation[]>([])
  const [routes, setRoutes] = useState<SeaRouteWithDetails[]>([])
  const [schedules, setSchedules] = useState<ScheduleWithDetails[]>([])
  const [loadState, setLoadState] = useState<LoadState>('loading')

  const [search, setSearch] = useState('')
  const [modeFilter, setModeFilter] = useState<'all' | 'ferry' | 'roro'>('all')
  const [portFilter, setPortFilter] = useState('all')
  const [showFilters, setShowFilters] = useState(false)

  const loadData = useCallback(async () => {
    setLoadState('loading')
    const [portsData, routesData, schedulesData] = await Promise.all([
      fetchPorts(),
      fetchSeaTransportRoutes(),
      fetchSchedules(),
    ])
    setPorts(portsData)
    setRoutes(routesData)
    setSchedules(schedulesData)
    setLoadState('done')
  }, [])

  useEffect(() => {
    void loadData().catch(() => setLoadState('error'))
  }, [loadData])

  const filteredPorts = useMemo(() => {
    const term = search.trim().toLowerCase()
    let list = ports
    if (portFilter !== 'all') {
      list = list.filter((p) => p.id === portFilter)
    }
    if (term) {
      list = list.filter((p) => {
        return (
          p.port_name.toLowerCase().includes(term) ||
          p.location?.name.toLowerCase().includes(term) ||
          p.location?.municipality?.toLowerCase().includes(term)
        )
      })
    }
    return list
  }, [ports, search, portFilter])

  const filteredRoutes = useMemo(() => {
    let list = routes
    if (modeFilter !== 'all') {
      list = list.filter((r) => r.transport_mode?.code === modeFilter)
    }
    if (portFilter !== 'all') {
      list = list.filter(
        (r) => r.origin_port?.id === portFilter || r.destination_port?.id === portFilter,
      )
    }
    const term = search.trim().toLowerCase()
    if (term) {
      list = list.filter(
        (r) =>
          r.route_name.toLowerCase().includes(term) ||
          r.origin_location?.name.toLowerCase().includes(term) ||
          r.destination_location?.name.toLowerCase().includes(term) ||
          r.operator_name?.toLowerCase().includes(term),
      )
    }
    return list
  }, [routes, modeFilter, portFilter, search])

  const filteredSchedules = useMemo(() => {
    let list = schedules
    if (modeFilter !== 'all') {
      list = list.filter((s) => {
        const route = routes.find((r) => r.id === s.route_id)
        return route?.transport_mode?.code === modeFilter
      })
    }
    if (portFilter !== 'all') {
      list = list.filter(
        (s) => s.departure_port?.id === portFilter || s.arrival_port?.id === portFilter,
      )
    }
    return list
  }, [schedules, modeFilter, portFilter, routes])

  return (
    <div className="app-shell">
      <header className="sticky top-0 z-30 bg-ocean-800 text-white shadow-card">
        <div className="flex items-center gap-3 px-4 py-4">
          <Link to="/" aria-label="Back to home" className="grid h-9 w-9 place-items-center rounded-full bg-ocean-700 hover:bg-ocean-600">
            <ArrowLeft size={18} />
          </Link>
          <h1 className="text-lg font-bold">Ports & Sea Transport</h1>
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
              placeholder="Search ports, routes, operators"
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
            <div>
              <p className="mb-1.5 text-xs font-semibold text-ocean-600">Transport Mode</p>
              <div className="flex flex-wrap gap-1.5">
                <FilterChip active={modeFilter === 'all'} onClick={() => setModeFilter('all')} label="All" />
                <FilterChip active={modeFilter === 'ferry'} onClick={() => setModeFilter('ferry')} label="Ferry" />
                <FilterChip active={modeFilter === 'roro'} onClick={() => setModeFilter('roro')} label="RORO" />
              </div>
            </div>
            {ports.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-semibold text-ocean-600">Port</p>
                <div className="flex flex-wrap gap-1.5">
                  <FilterChip active={portFilter === 'all'} onClick={() => setPortFilter('all')} label="All Ports" />
                  {ports.map((p) => (
                    <FilterChip key={p.id} active={portFilter === p.id} onClick={() => setPortFilter(p.id)} label={p.port_name} />
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* Loading */}
        {loadState === 'loading' && (
          <div className="card flex items-center gap-3">
            <Loader2 size={18} className="animate-spin text-ocean-500" />
            <p className="text-sm font-semibold text-ocean-700">Loading port and sea transport information…</p>
          </div>
        )}

        {/* Error */}
        {loadState === 'error' && (
          <div className="card flex flex-col items-center gap-3 text-center">
            <AlertCircle size={28} className="text-red-600" />
            <p className="text-sm font-semibold text-red-700">We couldn't load sea transport information. Please try again.</p>
            <button type="button" onClick={() => void loadData()} className="btn-primary">Retry</button>
          </div>
        )}

        {loadState === 'done' && (
          <>
            {/* Ports */}
            <section className="space-y-3">
              <h2 className="flex items-center gap-1.5 section-title">
                <Anchor size={14} /> Mga Pantalan (Ports)
              </h2>
              {filteredPorts.length === 0 ? (
                <div className="card flex flex-col items-center gap-2 text-center">
                  <span className="grid h-12 w-12 place-items-center rounded-full bg-sand-200 text-ocean-700">
                    <Anchor size={24} />
                  </span>
                  <p className="text-sm font-semibold text-ocean-700">
                    {ports.length === 0
                      ? 'No verified port information is available yet.'
                      : 'No ports match your search.'}
                  </p>
                </div>
              ) : (
                filteredPorts.map((port) => (
                  <Link
                    key={port.id}
                    to={`/ports/${port.id}`}
                    className="card block space-y-2 transition hover:shadow-cardHover active:scale-[0.99]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-bold text-ocean-900">{port.port_name}</p>
                      <span className={`pill text-[10px] ${verificationClasses(port.verification_status)}`}>
                        {VERIFICATION_LABELS[port.verification_status]}
                      </span>
                    </div>
                    {port.location && (
                      <p className="flex items-center gap-1 text-xs text-ocean-600">
                        <MapPin size={12} /> {port.location.name}
                        {port.location.municipality && <span> · {port.location.municipality}</span>}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-1.5">
                      <span className="pill bg-ocean-100 text-ocean-800 text-[10px]">
                        {portTypeLabel(port.port_type)}
                      </span>
                      <span className={`pill text-[10px] ${operatingStatusClass(port.operating_status)}`}>
                        {operatingStatusLabel(port.operating_status)}
                      </span>
                    </div>
                    {port.verified_at && (
                      <p className="text-xs text-ocean-500">Verified {formatRelativeTime(port.verified_at)}</p>
                    )}
                    <div className="flex justify-end">
                      <ChevronRight size={18} className="text-ocean-400" />
                    </div>
                  </Link>
                ))
              )}
            </section>

            {/* Sea transport routes */}
            {filteredRoutes.length > 0 && (
              <section className="space-y-3">
                <h2 className="flex items-center gap-1.5 section-title">
                  <Sailboat size={14} /> Ferry & RORO Routes
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
                      <span className="font-semibold">{r.origin_port?.port_name ?? r.origin_location?.name ?? 'Origin'}</span>
                      <span className="text-ocean-500">→</span>
                      <span className="font-semibold">{r.destination_port?.port_name ?? r.destination_location?.name ?? 'Destination'}</span>
                    </div>
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
                      <span className={`pill text-[10px] ${verificationClasses(r.verification_status)}`}>
                        {VERIFICATION_LABELS[r.verification_status]}
                      </span>
                    </div>
                  </Link>
                ))}
              </section>
            )}

            {/* Schedules */}
            {filteredSchedules.length > 0 && (
              <section className="space-y-3">
                <h2 className="flex items-center gap-1.5 section-title">
                  <Clock size={14} /> Oras ng Biyahe (Schedules)
                </h2>
                {filteredSchedules.map((s) => (
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

            {/* Empty overall state */}
            {ports.length === 0 && routes.length === 0 && schedules.length === 0 && (
              <div className="card flex flex-col items-center gap-3 text-center">
                <span className="grid h-14 w-14 place-items-center rounded-full bg-sand-200 text-ocean-700">
                  <Waves size={28} />
                </span>
                <p className="text-base font-bold text-ocean-900">
                  Verified sea transport information is not yet available.
                </p>
                <p className="text-sm text-ocean-600">
                  Port records, ferry routes, and schedules will appear here once verified.
                </p>
              </div>
            )}
          </>
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
