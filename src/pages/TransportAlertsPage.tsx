import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  AlertTriangle,
  Search as SearchIcon,
  Filter,
  RefreshCw,
  Clock,
  MapPin,
  Bus,
  CheckCircle2,
  ShieldAlert,
  Info,
} from 'lucide-react'
import { useAuth } from '../lib/auth'
import {
  MUNICIPALITIES,
  fetchPublishedAlerts,
  fetchResolvedAlerts,
  isAlertAdmin,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  SEVERITY_LABELS,
  SEVERITY_ORDER,
  severityClasses,
  severityLabel,
  categoryLabel,
  fetchTransportModes,
} from '../lib/transportAlerts'
import { formatRelativeTime } from '../lib/labels'
import type {
  TransportAlertWithDetails,
  TransportModeRow,
} from '../lib/types'

export function TransportAlertsPage() {
  const { user } = useAuth()
  const [active, setActive] = useState<TransportAlertWithDetails[]>([])
  const [resolved, setResolved] = useState<TransportAlertWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [admin, setAdmin] = useState(false)
  const [transportModes, setTransportModes] = useState<TransportModeRow[]>([])

  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [severityFilter, setSeverityFilter] = useState<string>('all')
  const [muniFilter, setMuniFilter] = useState<string>('all')
  const [transportFilter, setTransportFilter] = useState<string>('all')
  const [showResolved, setShowResolved] = useState(false)

  useEffect(() => {
    void (async () => {
      const [isAdmin, modes, activeAlerts, resolvedAlerts] = await Promise.all([
        isAlertAdmin(),
        fetchTransportModes(),
        fetchPublishedAlerts(50),
        fetchResolvedAlerts(10),
      ])
      setAdmin(isAdmin)
      setTransportModes(modes)
      setActive(activeAlerts)
      setResolved(resolvedAlerts)
      setLoading(false)
    })()
  }, [])

  async function handleRefresh() {
    setRefreshing(true)
    const [activeAlerts, resolvedAlerts] = await Promise.all([
      fetchPublishedAlerts(50),
      fetchResolvedAlerts(10),
    ])
    setActive(activeAlerts)
    setResolved(resolvedAlerts)
    setRefreshing(false)
  }

  const filtered = useMemo(() => {
    let list = showResolved ? [...active, ...resolved] : active
    const term = search.trim().toLowerCase()
    if (term) {
      list = list.filter(
        (a) =>
          a.title.toLowerCase().includes(term) ||
          a.description.toLowerCase().includes(term) ||
          (a.source_name ?? '').toLowerCase().includes(term),
      )
    }
    if (categoryFilter !== 'all') list = list.filter((a) => a.category === categoryFilter)
    if (severityFilter !== 'all') list = list.filter((a) => a.severity === severityFilter)
    if (muniFilter !== 'all') list = list.filter((a) => a.municipality === muniFilter)
    if (transportFilter !== 'all') list = list.filter((a) => a.transport_mode_id === transportFilter)
    return list
  }, [active, resolved, showResolved, search, categoryFilter, severityFilter, muniFilter, transportFilter])

  const activeCount = active.length
  const resolvedCount = resolved.length

  return (
    <div className="app-shell">
      <header className="sticky top-0 z-30 bg-ocean-800 text-white shadow-card">
        <div className="flex items-center gap-3 px-4 py-4">
          <Link to="/" aria-label="Back to home" className="grid h-9 w-9 place-items-center rounded-full bg-ocean-700 hover:bg-ocean-600">
            <ArrowLeft size={18} />
          </Link>
          <span className="grid h-8 w-8 place-items-center rounded-full bg-ocean-600">
            <AlertTriangle size={18} />
          </span>
          <h1 className="text-lg font-bold">Transport Alerts</h1>
        </div>
      </header>

      <main className="flex-1 space-y-5 px-4 py-5">
        {/* Summary */}
        <section className="grid grid-cols-2 gap-2">
          <div className="card flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-terra-100 text-terra-700">
              <AlertTriangle size={18} />
            </span>
            <div>
              <p className="text-2xl font-bold text-ocean-900">{activeCount}</p>
              <p className="text-xs text-ocean-600">Active Alerts</p>
            </div>
          </div>
          <div className="card flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-leaf-100 text-leaf-700">
              <CheckCircle2 size={18} />
            </span>
            <div>
              <p className="text-2xl font-bold text-ocean-900">{resolvedCount}</p>
              <p className="text-xs text-ocean-600">Recently Resolved</p>
            </div>
          </div>
        </section>

        {/* Refresh */}
        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          className="btn-secondary w-full"
        >
          <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          {refreshing ? 'Refreshing…' : 'Refresh Alerts'}
        </button>

        {/* Search and filters */}
        <section className="card space-y-3">
          <div className="flex items-center gap-2 rounded-xl bg-ocean-50 px-3 py-2.5">
            <SearchIcon size={18} className="text-ocean-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search alerts by title or description"
              className="w-full bg-transparent text-sm text-ocean-900 placeholder:text-ocean-400 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-1.5 text-xs font-semibold text-ocean-600">
            <Filter size={14} /> Filters
          </div>

          <div className="flex flex-wrap gap-1.5">
            <Chip active={categoryFilter === 'all'} onClick={() => setCategoryFilter('all')} label="All Categories" />
            {CATEGORY_ORDER.map((c) => (
              <Chip key={c} active={categoryFilter === c} onClick={() => setCategoryFilter(c)} label={CATEGORY_LABELS[c]} />
            ))}
          </div>

          <div className="flex flex-wrap gap-1.5">
            <Chip active={severityFilter === 'all'} onClick={() => setSeverityFilter('all')} label="All Severities" />
            {SEVERITY_ORDER.map((s) => (
              <Chip key={s} active={severityFilter === s} onClick={() => setSeverityFilter(s)} label={SEVERITY_LABELS[s]} />
            ))}
          </div>

          <div className="flex flex-wrap gap-1.5">
            <Chip active={muniFilter === 'all'} onClick={() => setMuniFilter('all')} label="All Municipalities" />
            {MUNICIPALITIES.map((m) => (
              <Chip key={m} active={muniFilter === m} onClick={() => setMuniFilter(m)} label={m} />
            ))}
          </div>

          {transportModes.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              <Chip active={transportFilter === 'all'} onClick={() => setTransportFilter('all')} label="All Transport" />
              {transportModes.map((m) => (
                <Chip key={m.id} active={transportFilter === m.id} onClick={() => setTransportFilter(m.id)} label={m.name} />
              ))}
            </div>
          )}

          <label className="flex items-center gap-2 text-sm font-semibold text-ocean-700">
            <input
              type="checkbox"
              checked={showResolved}
              onChange={(e) => setShowResolved(e.target.checked)}
              className="h-4 w-4 rounded border-ocean-300"
            />
            Show resolved alerts
          </label>
        </section>

        {/* Loading */}
        {loading && (
          <div className="card flex items-center gap-3">
            <span className="h-3 w-3 animate-pulse rounded-full bg-ocean-400" />
            <p className="text-sm font-semibold text-ocean-700">Loading transport alerts…</p>
          </div>
        )}

        {/* Empty state */}
        {!loading && filtered.length === 0 && (
          <div className="card flex flex-col items-center gap-3 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-leaf-100 text-leaf-700">
              <CheckCircle2 size={24} />
            </span>
            <p className="text-base font-bold text-ocean-900">No active transport alerts</p>
            <p className="text-sm text-ocean-700">
              {active.length === 0
                ? 'There are no published transport alerts at this time.'
                : 'No alerts match your filters. Try adjusting your search.'}
            </p>
          </div>
        )}

        {/* Alert list */}
        {!loading && filtered.map((a) => (
          <AlertCard key={a.id} alert={a} />
        ))}

        {/* Admin link */}
        {user && admin && (
          <Link to="/transport-alerts/admin" className="card flex items-center gap-3 hover:shadow-cardHover">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-terra-100 text-terra-700">
              <ShieldAlert size={18} />
            </span>
            <div>
              <p className="text-sm font-semibold text-ocean-900">Alert Management Dashboard</p>
              <p className="text-xs text-ocean-600">Create, publish, resolve, and manage transport alerts</p>
            </div>
          </Link>
        )}

        {/* Verification notice */}
        <section className="card flex items-start gap-2">
          <Info size={16} className="mt-0.5 shrink-0 text-ocean-500" />
          <p className="text-xs text-ocean-600">
            Transport alerts are published by authorized reviewers after verification.
            Community-submitted reports are reviewed before becoming official alerts.
            Application advisories are labeled as such and are not government announcements.
          </p>
        </section>
      </main>
    </div>
  )
}

function AlertCard({ alert }: { alert: TransportAlertWithDetails }) {
  const isResolved = alert.status === 'resolved'

  return (
    <Link
      to={`/transport-alerts/${alert.id}`}
      className="card space-y-2 block hover:shadow-cardHover transition active:scale-[0.98]"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-bold text-ocean-900">{alert.title}</p>
        <span className={`pill shrink-0 ${severityClasses(alert.severity)}`}>
          {severityLabel(alert.severity)}
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <span className="pill bg-sand-200 text-ocean-800">{categoryLabel(alert.category)}</span>
        {alert.verification === 'application_advisory' && (
          <span className="pill bg-ocean-700 text-white text-[10px]">App Advisory</span>
        )}
        {alert.verification === 'verified' && (
          <span className="pill bg-leaf-600 text-white text-[10px]">Verified</span>
        )}
        {isResolved && (
          <span className="pill bg-leaf-100 text-leaf-700 text-[10px]">Resolved</span>
        )}
      </div>

      <p className="text-sm text-ocean-700 line-clamp-2">{alert.description}</p>

      <div className="flex flex-wrap gap-3 text-xs text-ocean-600">
        {alert.municipality && (
          <span className="flex items-center gap-1"><MapPin size={12} /> {alert.municipality}</span>
        )}
        {alert.transport_mode && (
          <span className="flex items-center gap-1"><Bus size={12} /> {alert.transport_mode.name}</span>
        )}
        {alert.published_at && (
          <span className="flex items-center gap-1"><Clock size={12} /> {formatRelativeTime(alert.published_at)}</span>
        )}
        {alert.source_name && (
          <span>Source: {alert.source_name}</span>
        )}
      </div>
    </Link>
  )
}

function Chip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-semibold transition active:scale-95 ${
        active ? 'bg-ocean-700 text-white' : 'bg-ocean-50 text-ocean-700 hover:bg-ocean-100'
      }`}
    >
      {label}
    </button>
  )
}
