import { useEffect, useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Search as SearchIcon,
  Filter,
  History,
  MapPin,
  Clock,
  Trash2,
  X,
  Loader2,
  Calendar,
  ChevronRight,
} from 'lucide-react'
import { useAuth } from '../lib/auth'
import {
  fetchTripHistory,
  fetchTransportModesForFilter,
  deleteTrips,
  TRIP_STATUS_LABELS,
  TRIP_STATUS_ORDER,
  tripStatusColor,
  type TripHistoryFilter,
} from '../lib/tripHistory'
import { formatRelativeTime } from '../lib/labels'
import type { TripHistoryWithDetails, TripStatus } from '../lib/types'

export function TripHistoryPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [trips, setTrips] = useState<TripHistoryWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [statusFilter, setStatusFilter] = useState<TripStatus | 'all'>('all')
  const [modeFilter, setModeFilter] = useState<string>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sort, setSort] = useState<'recent' | 'oldest'>('recent')
  const [transportModes, setTransportModes] = useState<Array<{ id: string; name: string; code: string }>>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const filter: TripHistoryFilter = {
      search: search || undefined,
      status: statusFilter,
      transportModeId: modeFilter,
      dateFrom: dateFrom || null,
      dateTo: dateTo || null,
      sort,
    }
    const data = await fetchTripHistory(filter)
    setTrips(data)
    setLoading(false)
  }, [search, statusFilter, modeFilter, dateFrom, dateTo, sort])

  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }
    void load()
  }, [user, load])

  useEffect(() => {
    void (async () => {
      const modes = await fetchTransportModesForFilter()
      setTransportModes(modes)
    })()
  }, [])

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleBulkDelete() {
    setDeleting(true)
    const res = await deleteTrips(Array.from(selectedIds))
    setDeleting(false)
    if (res.success) {
      setSelectedIds(new Set())
      setBulkDeleteOpen(false)
      await load()
    }
  }

  function clearFilters() {
    setSearch('')
    setStatusFilter('all')
    setModeFilter('all')
    setDateFrom('')
    setDateTo('')
    setSort('recent')
  }

  if (!user) {
    return (
      <div className="app-shell">
        <header className="sticky top-0 z-30 bg-ocean-800 text-white shadow-card">
          <div className="flex items-center gap-3 px-4 py-4">
            <Link to="/" className="grid h-9 w-9 place-items-center rounded-full bg-ocean-700 hover:bg-ocean-600">
              <ArrowLeft size={18} />
            </Link>
            <h1 className="text-lg font-bold">My Trip History</h1>
          </div>
        </header>
        <main className="flex-1 px-4 py-6">
          <div className="card flex flex-col items-center gap-4 text-center">
            <p className="text-sm font-semibold text-ocean-900">Please sign in to view your trip history.</p>
            <Link to="/auth" className="btn-primary w-full">Sign In</Link>
          </div>
        </main>
      </div>
    )
  }

  const hasActiveFilters = search || statusFilter !== 'all' || modeFilter !== 'all' || dateFrom || dateTo

  return (
    <div className="app-shell">
      <header className="sticky top-0 z-30 bg-ocean-800 text-white shadow-card">
        <div className="flex items-center gap-3 px-4 py-4">
          <Link to="/profile" className="grid h-9 w-9 place-items-center rounded-full bg-ocean-700 hover:bg-ocean-600">
            <ArrowLeft size={18} />
          </Link>
          <h1 className="text-lg font-bold">My Trip History</h1>
        </div>
      </header>

      <main className="flex-1 space-y-4 px-4 py-5">
        {/* Search + filter toggle */}
        <section className="card space-y-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <SearchIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ocean-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search origin or destination"
                className="w-full rounded-xl bg-ocean-50 py-2.5 pl-9 pr-3 text-sm text-ocean-900 placeholder:text-ocean-400 focus:outline-none"
              />
            </div>
            <button
              type="button"
              onClick={() => setShowFilters((v) => !v)}
              className={`grid h-10 w-10 place-items-center rounded-xl transition active:scale-95 ${
                showFilters || hasActiveFilters ? 'bg-ocean-700 text-white' : 'bg-ocean-50 text-ocean-700'
              }`}
            >
              <Filter size={18} />
            </button>
          </div>

          {showFilters && (
            <div className="space-y-3 rounded-xl bg-ocean-50 p-3">
              <div>
                <label className="text-xs font-semibold text-ocean-600">Trip Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as TripStatus | 'all')}
                  className="input mt-1"
                >
                  <option value="all">All statuses</option>
                  {TRIP_STATUS_ORDER.map((s) => (
                    <option key={s} value={s}>{TRIP_STATUS_LABELS[s]}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-ocean-600">Transport Mode</label>
                <select
                  value={modeFilter}
                  onChange={(e) => setModeFilter(e.target.value)}
                  className="input mt-1"
                >
                  <option value="all">All modes</option>
                  {transportModes.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-ocean-600">Date From</label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="input mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-ocean-600">Date To</label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="input mt-1"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-ocean-600">Sort</label>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as 'recent' | 'oldest')}
                  className="input mt-1"
                >
                  <option value="recent">Most recent</option>
                  <option value="oldest">Oldest first</option>
                </select>
              </div>

              {hasActiveFilters && (
                <button type="button" onClick={clearFilters} className="flex items-center gap-1 text-xs font-semibold text-ocean-600">
                  <X size={12} /> Clear all filters
                </button>
              )}
            </div>
          )}
        </section>

        {/* Bulk actions */}
        {selectedIds.size > 0 && (
          <div className="card flex items-center justify-between gap-2 border-red-200">
            <span className="text-sm font-semibold text-ocean-800">{selectedIds.size} selected</span>
            <button
              type="button"
              onClick={() => setBulkDeleteOpen(true)}
              className="flex items-center gap-1 rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-700"
            >
              <Trash2 size={14} /> Delete Selected
            </button>
          </div>
        )}

        {/* List */}
        {loading ? (
          <div className="card flex items-center gap-3">
            <Loader2 size={20} className="animate-spin text-ocean-600" />
            <p className="text-sm font-semibold text-ocean-700">Loading your trips…</p>
          </div>
        ) : trips.length === 0 ? (
          <div className="card flex flex-col items-center gap-3 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-full bg-sand-200 text-ocean-600">
              <History size={28} />
            </span>
            <p className="text-base font-bold text-ocean-900">No trips recorded yet</p>
            <p className="text-sm text-ocean-600">
              Plan a route and save it to your history. Your planned, started, and completed trips will appear here.
            </p>
            <Link to="/plan" className="btn-primary w-full">Plan a Trip</Link>
          </div>
        ) : (
          <div className="space-y-3">
            {trips.map((trip) => (
              <TripCard
                key={trip.id}
                trip={trip}
                selected={selectedIds.has(trip.id)}
                onToggle={() => toggleSelect(trip.id)}
                onOpen={() => navigate(`/trip-history/${trip.id}`)}
              />
            ))}
          </div>
        )}
      </main>

      {/* Bulk delete confirmation */}
      {bulkDeleteOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-cardHover">
            <h3 className="text-lg font-bold text-red-700">Delete {selectedIds.size} trips?</h3>
            <p className="mt-2 text-sm text-ocean-600">
              This will permanently remove the selected trip records. This action cannot be undone.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => void handleBulkDelete()}
                disabled={deleting}
                className="flex-1 rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white"
              >
                {deleting ? <Loader2 size={16} className="animate-spin" /> : 'Delete'}
              </button>
              <button
                type="button"
                onClick={() => setBulkDeleteOpen(false)}
                className="flex-1 rounded-xl bg-ocean-50 px-4 py-2 text-sm font-semibold text-ocean-700"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function TripCard({
  trip,
  selected,
  onToggle,
  onOpen,
}: {
  trip: TripHistoryWithDetails
  selected: boolean
  onToggle: () => void
  onOpen: () => void
}) {
  const originName = trip.origin_location?.name ?? 'Origin'
  const destName = trip.destination_location?.name ?? 'Destination'
  const modeName = trip.transport_mode?.name ?? (trip.trip_history_segments.length > 0 ? 'Multi-segment' : 'Transport')
  const segCount = trip.trip_history_segments.length

  return (
    <div className={`card space-y-3 transition ${selected ? 'ring-2 ring-ocean-500' : ''}`}>
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          className="mt-1 h-4 w-4 rounded accent-ocean-600"
        />
        <button type="button" onClick={onOpen} className="flex-1 text-left">
          <div className="flex items-center gap-2 text-sm text-ocean-800">
            <MapPin size={14} className="shrink-0 text-terra-500" />
            <span className="font-semibold">{originName}</span>
            <span className="text-ocean-400">→</span>
            <span className="font-semibold">{destName}</span>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span className={`pill text-[10px] ${tripStatusColor(trip.trip_status)}`}>
              {TRIP_STATUS_LABELS[trip.trip_status]}
            </span>
            <span className="pill bg-ocean-50 text-ocean-700 text-[10px]">{modeName}</span>
            {segCount > 0 && (
              <span className="pill bg-sand-200 text-ocean-800 text-[10px]">
                {segCount} segment{segCount > 1 ? 's' : ''}
              </span>
            )}
            {trip.estimated_fare != null && (
              <span className="pill bg-leaf-100 text-leaf-700 text-[10px]">
                ~₱{trip.estimated_fare}
              </span>
            )}
          </div>
          <div className="mt-1.5 flex items-center gap-2 text-xs text-ocean-500">
            {trip.planned_departure_at && (
              <span className="flex items-center gap-1">
                <Calendar size={10} />
                {new Date(trip.planned_departure_at).toLocaleDateString()}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Clock size={10} />
              {formatRelativeTime(trip.updated_at)}
            </span>
          </div>
        </button>
        <ChevronRight size={18} className="text-ocean-300" />
      </div>
    </div>
  )
}
