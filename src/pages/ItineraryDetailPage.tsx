import { useEffect, useState, useCallback } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft, ArrowUp, ArrowDown, Trash2, Plus, MapPin, Clock, Calendar,
  Users, Wallet, Share2, Printer, Copy, Archive, RefreshCw, Route as RouteIcon,
  Search as SearchIcon, X, Info, AlertTriangle, CloudSun, ChevronDown,
  Luggage, Navigation, FileText, Coffee, CheckCircle2,
} from 'lucide-react'
import { useAuth } from '../lib/auth'
import {
  fetchItineraryDetail,
  updateItinerary,
  deleteItinerary,
  archiveItinerary,
  duplicateItinerary,
  addStop, deleteStop, reorderStops,
  addDay, deleteDay, duplicateDay,
  autoGenerateLegs, deleteLeg,
  addExpense, deleteExpense,
  calculateTripCost, formatCurrency,
  suggestOptimizedOrder,
  enableSharing, disableSharing,
  fetchWeatherForItinerary, fetchAlertsForItinerary,
  searchDestinationsForItinerary,
  STATUS_LABELS, statusClasses,
  FARE_SOURCE_LABELS,
  EXPENSE_CATEGORY_LABELS, EXPENSE_SOURCE_LABELS,
  checkOpeningHoursConflict,
  MUNICIPALITIES,
} from '../lib/touristPlanner'
import { fetchWeather, generateAdvisories, weatherIcon } from '../lib/weather'
import type {
  TouristItineraryWithDetails,
  ItineraryStopWithDetails,
  ItineraryLegWithDetails,
  ItineraryExpenseWithStop,
  ItineraryStatus,
  ItineraryExpenseCategory,
  ItineraryExpenseSource,
  DestinationWithDetails,
  TransportAlertWithDetails,
} from '../lib/types'

export function ItineraryDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [itinerary, setItinerary] = useState<TouristItineraryWithDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  // Panels
  const [showCostBreakdown, setShowCostBreakdown] = useState(false)
  const [showWeather, setShowWeather] = useState(false)
  const [showAlerts, setShowAlerts] = useState(false)
  const [showShare, setShowShare] = useState(false)
  const [showAddStop, setShowAddStop] = useState(false)
  const [showAddDay, setShowAddDay] = useState(false)
  const [showAddExpense, setShowAddExpense] = useState(false)
  const [showOptimize, setShowOptimize] = useState(false)

  // Weather & alerts
  const [weatherData, setWeatherData] = useState<{ data: Awaited<ReturnType<typeof fetchWeather>>['data']; error: string | null } | null>(null)
  const [alerts, setAlerts] = useState<TransportAlertWithDetails[]>([])
  const [weatherLoading, setWeatherLoading] = useState(false)

  // Share
  const [shareToken, setShareToken] = useState<string | null>(null)

  const loadItinerary = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    const iti = await fetchItineraryDetail(id)
    if (!iti) {
      setError('Itinerary not found. It may have been deleted or you may not have access.')
      setLoading(false)
      return
    }
    setItinerary(iti)
    setShareToken(iti.is_shared ? iti.share_token : null)
    setLoading(false)
  }, [id])

  useEffect(() => {
    void loadItinerary()
  }, [loadItinerary])

  // ---- Actions ----

  async function handleStatusChange(newStatus: ItineraryStatus) {
    if (!itinerary) return
    setActionError(null)
    const { error } = await updateItinerary(itinerary.id, { status: newStatus })
    if (error) { setActionError(error); return }
    await loadItinerary()
  }

  async function handleDelete() {
    if (!itinerary) return
    if (!confirm('Delete this itinerary permanently? This cannot be undone.')) return
    setActionError(null)
    const { error } = await deleteItinerary(itinerary.id)
    if (error) { setActionError(error); return }
    navigate('/tourist-planner')
  }

  async function handleArchive() {
    if (!itinerary) return
    setActionError(null)
    const { error } = await archiveItinerary(itinerary.id)
    if (error) { setActionError(error); return }
    navigate('/tourist-planner')
  }

  async function handleDuplicate() {
    if (!itinerary) return
    setActionError(null)
    const { success, newId, error } = await duplicateItinerary(itinerary.id)
    if (!success || !newId) { setActionError(error ?? 'Failed to duplicate.'); return }
    navigate(`/tourist-planner/${newId}`)
  }

  async function handleGenerateLegs() {
    if (!itinerary) return
    setActionError(null)
    const result = await autoGenerateLegs(itinerary.id)
    if (!result.success) { setActionError(result.error ?? 'Failed to generate transport legs.'); return }
    await loadItinerary()
  }

  async function handleEnableShare() {
    if (!itinerary) return
    setActionError(null)
    const { success, token, error } = await enableSharing(itinerary.id)
    if (!success || !token) { setActionError(error ?? 'Failed to create share link.'); return }
    setShareToken(token)
    await loadItinerary()
  }

  async function handleDisableShare() {
    if (!itinerary) return
    setActionError(null)
    const { error } = await disableSharing(itinerary.id)
    if (error) { setActionError(error); return }
    setShareToken(null)
    await loadItinerary()
  }

  async function handleLoadWeather() {
    if (!itinerary) return
    setWeatherLoading(true)
    // Use the first municipality from destinations, or default to Boac
    const municipalities = new Set<string>()
    for (const day of itinerary.days) {
      for (const stop of day.stops) {
        if (stop.destination?.municipality) municipalities.add(stop.destination.municipality)
        if (stop.location?.municipality) municipalities.add(stop.location.municipality)
      }
    }
    const muni = municipalities.size > 0 ? Array.from(municipalities)[0] : 'Boac'
    const result = await fetchWeatherForItinerary(muni)
    setWeatherData(result)
    setWeatherLoading(false)
    setShowWeather(true)
  }

  async function handleLoadAlerts() {
    if (!itinerary) return
    const municipalities = new Set<string>()
    for (const day of itinerary.days) {
      for (const stop of day.stops) {
        if (stop.destination?.municipality) municipalities.add(stop.destination.municipality)
        if (stop.location?.municipality) municipalities.add(stop.location.municipality)
      }
    }
    if (itinerary.starting_location?.municipality) municipalities.add(itinerary.starting_location.municipality)
    const result = await fetchAlertsForItinerary(Array.from(municipalities))
    setAlerts(result)
    setShowAlerts(true)
  }

  async function handleDeleteStop(stopId: string) {
    if (!confirm('Remove this stop from the itinerary?')) return
    setActionError(null)
    const { error } = await deleteStop(stopId)
    if (error) { setActionError(error); return }
    await loadItinerary()
  }

  async function handleMoveStop(stopId: string, direction: 'up' | 'down', dayStops: ItineraryStopWithDetails[]) {
    const idx = dayStops.findIndex((s) => s.id === stopId)
    if (idx < 0) return
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= dayStops.length) return
    const newOrder = [...dayStops]
    ;[newOrder[idx], newOrder[swapIdx]] = [newOrder[swapIdx], newOrder[idx]]
    setActionError(null)
    const { error } = await reorderStops(itinerary!.id, newOrder.map((s) => s.id))
    if (error) { setActionError(error); return }
    await loadItinerary()
  }

  async function handleAddDay(dayNumber: number, tripDate?: string) {
    if (!itinerary) return
    setActionError(null)
    const { error } = await addDay(itinerary.id, dayNumber, tripDate ?? null)
    if (error) { setActionError(error); return }
    setShowAddDay(false)
    await loadItinerary()
  }

  async function handleDeleteDay(dayId: string) {
    if (!confirm('Delete this day and all its stops?')) return
    setActionError(null)
    const { error } = await deleteDay(dayId)
    if (error) { setActionError(error); return }
    await loadItinerary()
  }

  async function handleDuplicateDay(dayId: string) {
    if (!itinerary) return
    setActionError(null)
    const { error } = await duplicateDay(itinerary.id, dayId)
    if (error) { setActionError(error); return }
    await loadItinerary()
  }

  async function handleDeleteLeg(legId: string) {
    setActionError(null)
    const { error } = await deleteLeg(legId)
    if (error) { setActionError(error); return }
    await loadItinerary()
  }

  async function handleDeleteExpense(expenseId: string) {
    setActionError(null)
    const { error } = await deleteExpense(expenseId)
    if (error) { setActionError(error); return }
    await loadItinerary()
  }

  async function handleOptimize() {
    if (!itinerary) return
    const allStops = itinerary.days.flatMap((d) => d.stops)
    const result = suggestOptimizedOrder(allStops)
    if (!result) {
      setActionError('Not enough stops with coordinates to suggest an optimized order.')
      return
    }
    if (!confirm(`${result.method}: Reorder stops by proximity?\n\n${result.note}`)) return
    setActionError(null)
    const { error } = await reorderStops(itinerary.id, result.optimizedOrder)
    if (error) { setActionError(error); return }
    setShowOptimize(false)
    await loadItinerary()
  }

  // ---- Render ----

  if (loading) {
    return (
      <div className="app-shell">
        <HeaderBack title="Loading…" />
        <main className="flex-1 px-4 py-5">
          <div className="card flex items-center gap-3">
            <span className="h-3 w-3 animate-pulse rounded-full bg-ocean-400" />
            <p className="text-sm font-semibold text-ocean-700">Loading itinerary…</p>
          </div>
        </main>
      </div>
    )
  }

  if (error || !itinerary) {
    return (
      <div className="app-shell">
        <HeaderBack title="Itinerary" />
        <main className="flex-1 px-4 py-5">
          <div className="card flex flex-col items-center gap-3 text-center">
            <AlertTriangle size={24} className="text-red-400" />
            <p className="text-sm font-bold text-ocean-900">{error ?? 'Itinerary not found'}</p>
            <Link to="/tourist-planner" className="btn-secondary">Back to Planner</Link>
          </div>
        </main>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="app-shell">
        <HeaderBack title="Sign In Required" />
        <main className="flex-1 px-4 py-5">
          <div className="card flex flex-col items-center gap-3 text-center">
            <Luggage size={32} className="text-ocean-400" />
            <p className="font-bold text-ocean-900">Please sign in to view itineraries</p>
            <Link to="/auth" className="btn-primary w-full">Sign In / Sign Up</Link>
          </div>
        </main>
      </div>
    )
  }

  const cost = calculateTripCost(itinerary)
  const startDate = itinerary.start_date ? new Date(itinerary.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null
  const endDate = itinerary.end_date ? new Date(itinerary.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null
  const totalStops = itinerary.days.reduce((sum, d) => sum + d.stops.length, 0)

  return (
    <div className="app-shell">
      <header className="sticky top-0 z-30 bg-ocean-800 text-white shadow-card">
        <div className="flex items-center gap-3 px-4 py-4">
          <Link to="/tourist-planner" className="grid h-9 w-9 place-items-center rounded-full bg-ocean-700 hover:bg-ocean-600">
            <ArrowLeft size={18} />
          </Link>
          <span className="grid h-8 w-8 place-items-center rounded-full bg-ocean-600">
            <Luggage size={18} />
          </span>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold truncate">{itinerary.title}</h1>
            <div className="flex items-center gap-2 text-xs text-ocean-200">
              <span className={`pill text-[10px] ${statusClasses(itinerary.status)}`}>{STATUS_LABELS[itinerary.status]}</span>
              <span>{totalStops} stop{totalStops !== 1 ? 's' : ''}</span>
            </div>
          </div>
          <button onClick={() => void loadItinerary()} className="grid h-9 w-9 place-items-center rounded-full bg-ocean-700 hover:bg-ocean-600" aria-label="Refresh">
            <RefreshCw size={16} />
          </button>
        </div>
      </header>

      <main className="flex-1 space-y-5 px-4 py-5">
        {actionError && (
          <div className="card border border-red-200 bg-red-50">
            <p className="text-sm text-red-700">{actionError}</p>
          </div>
        )}

        {/* Trip Summary */}
        <section className="card space-y-3">
          {itinerary.description && <p className="text-sm text-ocean-700">{itinerary.description}</p>}
          <div className="flex flex-wrap gap-3 text-xs text-ocean-600">
            {startDate && (
              <span className="flex items-center gap-1"><Calendar size={12} /> {startDate}{endDate && endDate !== startDate ? ` – ${endDate}` : ''}</span>
            )}
            <span className="flex items-center gap-1"><Users size={12} /> {itinerary.traveler_count} traveler{itinerary.traveler_count > 1 ? 's' : ''}</span>
            {itinerary.starting_location && (
              <span className="flex items-center gap-1"><MapPin size={12} /> From {itinerary.starting_location.name}</span>
            )}
            {itinerary.budget_amount > 0 && (
              <span className="flex items-center gap-1"><Wallet size={12} /> Budget {formatCurrency(Number(itinerary.budget_amount))}</span>
            )}
          </div>
          <Link to={`/tourist-planner/${itinerary.id}/edit`} className="btn-secondary text-xs px-3 py-1.5">
            <FileText size={14} /> Edit Details
          </Link>
        </section>

        {/* Quick Actions */}
        <section className="grid grid-cols-2 gap-2">
          <button onClick={() => setShowAddStop(true)} className="btn-secondary text-xs px-3 py-2.5">
            <Plus size={16} /> Add Stop
          </button>
          <button onClick={() => setShowAddDay(true)} className="btn-secondary text-xs px-3 py-2.5">
            <Calendar size={16} /> Add Day
          </button>
          <button onClick={() => void handleGenerateLegs()} className="btn-secondary text-xs px-3 py-2.5">
            <RouteIcon size={16} /> Auto Transport
          </button>
          <button onClick={() => setShowOptimize(true)} className="btn-secondary text-xs px-3 py-2.5">
            <Navigation size={16} /> Optimize Order
          </button>
          <button onClick={() => setShowCostBreakdown(!showCostBreakdown)} className="btn-secondary text-xs px-3 py-2.5">
            <Wallet size={16} /> Cost Estimate
          </button>
          <button onClick={() => setShowAddExpense(true)} className="btn-secondary text-xs px-3 py-2.5">
            <Plus size={16} /> Add Expense
          </button>
          <button onClick={() => void handleLoadWeather()} className="btn-secondary text-xs px-3 py-2.5">
            <CloudSun size={16} /> Weather
          </button>
          <button onClick={() => void handleLoadAlerts()} className="btn-secondary text-xs px-3 py-2.5">
            <AlertTriangle size={16} /> Alerts
          </button>
        </section>

        {/* Cost Summary */}
        {showCostBreakdown && <CostBreakdownPanel cost={cost} itinerary={itinerary} />}

        {/* Weather */}
        {showWeather && weatherData && (
          <WeatherPanel data={weatherData.data} error={weatherData.error} loading={weatherLoading} />
        )}

        {/* Alerts */}
        {showAlerts && <AlertsPanel alerts={alerts} />}

        {/* Itinerary Days & Stops */}
        <section className="space-y-4">
          <h2 className="section-title">Itinerary</h2>

          {itinerary.days.length === 0 || (itinerary.days.length === 1 && itinerary.days[0].day_number === 0 && itinerary.days[0].stops.length === 0) ? (
            <div className="card flex flex-col items-center gap-2 text-center">
              <MapPin size={24} className="text-ocean-400" />
              <p className="text-sm font-bold text-ocean-900">No stops yet</p>
              <p className="text-sm text-ocean-600">Add destinations to start building your itinerary.</p>
              <button onClick={() => setShowAddStop(true)} className="btn-primary text-xs px-4 py-2">
                <Plus size={14} /> Add First Stop
              </button>
            </div>
          ) : (
            itinerary.days.map((day) => (
              <DaySection
                key={day.id}
                day={day}
                onDeleteDay={() => void handleDeleteDay(day.id)}
                onDuplicateDay={() => void handleDuplicateDay(day.id)}
                onDeleteStop={(stopId) => void handleDeleteStop(stopId)}
                onMoveStop={(stopId, dir) => void handleMoveStop(stopId, dir, day.stops)}
                onAddStop={() => setShowAddStop(true)}
              />
            ))
          )}
        </section>

        {/* Transport Legs */}
        {itinerary.legs.length > 0 && (
          <section className="space-y-3">
            <h2 className="section-title flex items-center gap-2">
              <RouteIcon size={16} /> Transport Legs
            </h2>
            <div className="space-y-2">
              {itinerary.legs.map((leg) => (
                <LegCard
                  key={leg.id}
                  leg={leg}
                  onDelete={() => void handleDeleteLeg(leg.id)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Expenses */}
        {itinerary.expenses.length > 0 && (
          <section className="space-y-3">
            <h2 className="section-title flex items-center gap-2">
              <Wallet size={16} /> Expenses
            </h2>
            <div className="space-y-2">
              {itinerary.expenses.map((exp) => (
                <ExpenseCard
                  key={exp.id}
                  expense={exp}
                  onDelete={() => void handleDeleteExpense(exp.id)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Status Management */}
        <section className="card space-y-3">
          <h2 className="section-title">Trip Status</h2>
          <div className="flex flex-wrap gap-2">
            {(['draft', 'planned', 'in_progress', 'completed'] as ItineraryStatus[]).map((s) => (
              <button
                key={s}
                onClick={() => void handleStatusChange(s)}
                className={`pill text-xs ${itinerary.status === s ? statusClasses(s) : 'bg-sand-100 text-ocean-600 hover:bg-sand-200'}`}
              >
                {itinerary.status === s && <CheckCircle2 size={12} />}
                {STATUS_LABELS[s]}
              </button>
            ))}
          </div>
          <p className="text-xs text-ocean-500">
            Only mark as completed when you have finished the trip. This is not done automatically.
          </p>
        </section>

        {/* Share & Manage */}
        <section className="card space-y-3">
          <h2 className="section-title">Share & Manage</h2>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setShowShare(!showShare)} className="btn-secondary text-xs px-3 py-2.5">
              <Share2 size={14} /> Share
            </button>
            <button onClick={() => window.print()} className="btn-secondary text-xs px-3 py-2.5">
              <Printer size={14} /> Print
            </button>
            <button onClick={() => void handleDuplicate()} className="btn-secondary text-xs px-3 py-2.5">
              <Copy size={14} /> Duplicate
            </button>
            <button onClick={() => void handleArchive()} className="btn-secondary text-xs px-3 py-2.5">
              <Archive size={14} /> Archive
            </button>
            <button onClick={() => void handleDelete()} className="btn-secondary text-xs px-3 py-2.5 text-red-600 hover:bg-red-50">
              <Trash2 size={14} /> Delete
            </button>
          </div>

          {showShare && (
            <div className="space-y-3 border-t border-sand-200 pt-3">
              <p className="text-xs text-ocean-600">
                Sharing creates a link that anyone with the link can use to view your itinerary.
                Private notes and personal information are included — review before sharing.
              </p>
              <Link
                to="/share"
                state={{ sourceType: 'itinerary', sourceId: itinerary.id, title: itinerary.title }}
                className="btn-primary text-xs px-4 py-2.5 w-full"
              >
                <Share2 size={14} /> Share with Options
              </Link>
              <p className="text-xs text-ocean-500">
                Choose what to include, set an expiration, and manage the link from the share page.
              </p>
              {shareToken ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 rounded-xl bg-leaf-50 px-3 py-2.5">
                    <CheckCircle2 size={16} className="text-leaf-600" />
                    <span className="text-sm font-semibold text-leaf-700">This trip is shared</span>
                  </div>
                  <div className="rounded-xl border border-sand-200 bg-sand-50 px-3 py-2.5">
                    <p className="text-xs text-ocean-600 break-all">
                      {window.location.origin}/#/tourist-planner/shared/{shareToken}
                    </p>
                  </div>
                  <button onClick={() => void handleDisableShare()} className="btn-ghost text-xs text-red-600 px-3 py-2">
                    Disable Share Link
                  </button>
                </div>
              ) : (
                <button onClick={() => void handleEnableShare()} className="btn-secondary text-xs px-4 py-2.5">
                  <Share2 size={14} /> Quick Share Link
                </button>
              )}
            </div>
          )}
        </section>

        <p className="text-center text-xs text-ocean-400">
          Created {new Date(itinerary.created_at).toLocaleDateString()} · Updated {new Date(itinerary.updated_at).toLocaleDateString()}
        </p>
      </main>

      {/* Modals */}
      {showAddStop && itinerary && (
        <AddStopModal
          itineraryId={itinerary.id}
          days={itinerary.days.filter((d) => d.day_number > 0)}
          onClose={() => setShowAddStop(false)}
          onAdded={async () => { setShowAddStop(false); await loadItinerary() }}
        />
      )}

      {showAddDay && itinerary && (
        <AddDayModal
          maxDayNumber={Math.max(...itinerary.days.map((d) => d.day_number), 0)}
          onClose={() => setShowAddDay(false)}
          onAdd={handleAddDay}
        />
      )}

      {showAddExpense && itinerary && (
        <AddExpenseModal
          itineraryId={itinerary.id}
          stops={itinerary.days.flatMap((d) => d.stops)}
          onClose={() => setShowAddExpense(false)}
          onAdded={async () => { setShowAddExpense(false); await loadItinerary() }}
        />
      )}

      {showOptimize && (
        <OptimizeModal
          onStopCount={itinerary.days.reduce((s, d) => s + d.stops.length, 0)}
          onConfirm={() => void handleOptimize()}
          onClose={() => setShowOptimize(false)}
        />
      )}
    </div>
  )
}

// ---- Shared Header ----

function HeaderBack({ title }: { title: string }) {
  return (
    <header className="sticky top-0 z-30 bg-ocean-800 text-white shadow-card">
      <div className="flex items-center gap-3 px-4 py-4">
        <Link to="/tourist-planner" className="grid h-9 w-9 place-items-center rounded-full bg-ocean-700 hover:bg-ocean-600">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-lg font-bold">{title}</h1>
      </div>
    </header>
  )
}

// ---- Day Section ----

function DaySection({
  day, onDeleteDay, onDuplicateDay, onDeleteStop, onMoveStop, onAddStop,
}: {
  day: TouristItineraryWithDetails['days'][number]
  onDeleteDay: () => void
  onDuplicateDay: () => void
  onDeleteStop: (stopId: string) => void
  onMoveStop: (stopId: string, direction: 'up' | 'down') => void
  onAddStop: () => void
}) {
  const [showDayActions, setShowDayActions] = useState(false)
  const isUnassigned = day.day_number === 0
  const dayDate = day.trip_date ? new Date(day.trip_date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }) : null

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {!isUnassigned && (
            <span className="grid h-8 w-8 place-items-center rounded-full bg-ocean-100 text-ocean-800 text-sm font-bold">
              {day.day_number}
            </span>
          )}
          <div>
            <p className="font-bold text-ocean-900">
              {isUnassigned ? 'Unassigned Stops' : `Day ${day.day_number}`}
            </p>
            {dayDate && <p className="text-xs text-ocean-600">{dayDate}</p>}
          </div>
        </div>
        {!isUnassigned && (
          <button onClick={() => setShowDayActions(!showDayActions)} className="grid h-8 w-8 place-items-center rounded-full bg-sand-100 hover:bg-sand-200">
            <ChevronDown size={16} className="text-ocean-600" />
          </button>
        )}
      </div>

      {showDayActions && !isUnassigned && (
        <div className="flex flex-wrap gap-2 border-t border-sand-200 pt-2">
          <button onClick={onDuplicateDay} className="btn-ghost text-xs px-3 py-1.5">
            <Copy size={12} /> Duplicate Day
          </button>
          <button onClick={onDeleteDay} className="btn-ghost text-xs px-3 py-1.5 text-red-600">
            <Trash2 size={12} /> Delete Day
          </button>
        </div>
      )}

      {day.notes && <p className="text-sm text-ocean-600 italic">{day.notes}</p>}

      {/* Stops */}
      <div className="space-y-2">
        {day.stops.length === 0 ? (
          <p className="text-sm text-ocean-400 text-center py-2">No stops for this day.</p>
        ) : (
          day.stops.map((stop, idx) => (
            <StopCard
              key={stop.id}
              stop={stop}
              isFirst={idx === 0}
              isLast={idx === day.stops.length - 1}
              onDelete={() => onDeleteStop(stop.id)}
              onMoveUp={() => onMoveStop(stop.id, 'up')}
              onMoveDown={() => onMoveStop(stop.id, 'down')}
            />
          ))
        )}
      </div>

      <button onClick={onAddStop} className="btn-ghost text-xs w-full py-2 border border-dashed border-sand-300">
        <Plus size={14} /> Add Stop
      </button>
    </div>
  )
}

// ---- Stop Card ----

function StopCard({
  stop, isFirst, isLast, onDelete, onMoveUp, onMoveDown,
}: {
  stop: ItineraryStopWithDetails
  isFirst: boolean
  isLast: boolean
  onDelete: () => void
  onMoveUp: () => void
  onMoveDown: () => void
}) {
  const [showActions, setShowActions] = useState(false)

  const name = stop.is_rest_break
    ? stop.custom_title ?? 'Rest / Meal Break'
    : stop.destination?.name ?? stop.location?.name ?? stop.custom_title ?? 'Custom Stop'

  const municipality = stop.destination?.municipality ?? stop.location?.municipality ?? null
  const isCustom = !stop.destination_id && !stop.location_id && !stop.is_rest_break

  const hoursWarning = stop.destination?.opening_hours
    ? checkOpeningHoursConflict(stop.destination.opening_hours, stop.planned_arrival_time)
    : null

  return (
    <div className="rounded-xl border border-sand-200 bg-sand-50 p-3 space-y-1.5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {stop.is_rest_break ? (
              <Coffee size={16} className="text-terra-600 shrink-0" />
            ) : (
              <MapPin size={16} className="text-ocean-600 shrink-0" />
            )}
            <p className="font-semibold text-sm text-ocean-900 truncate">{name}</p>
          </div>
          {municipality && (
            <p className="text-xs text-ocean-600 ml-6">{municipality}</p>
          )}
          {isCustom && !stop.is_rest_break && (
            <p className="text-xs text-terra-600 ml-6">Custom stop (not a verified destination)</p>
          )}
        </div>
        <button onClick={() => setShowActions(!showActions)} className="shrink-0 grid h-7 w-7 place-items-center rounded-full bg-white hover:bg-sand-100">
          <ChevronDown size={14} className="text-ocean-600" />
        </button>
      </div>

      {/* Time & Duration */}
      <div className="flex flex-wrap gap-3 text-xs text-ocean-600 ml-6">
        {stop.planned_arrival_time && (
          <span className="flex items-center gap-1"><Clock size={10} /> Arrive {stop.planned_arrival_time.slice(0, 5)}</span>
        )}
        {stop.planned_departure_time && (
          <span className="flex items-center gap-1"><Clock size={10} /> Depart {stop.planned_departure_time.slice(0, 5)}</span>
        )}
        {stop.estimated_duration_minutes != null && (
          <span className="flex items-center gap-1"><Clock size={10} /> ~{stop.estimated_duration_minutes}min (user-provided)</span>
        )}
      </div>

      {stop.user_notes && (
        <p className="text-xs text-ocean-600 ml-6 italic">{stop.user_notes}</p>
      )}

      {hoursWarning && (
        <p className="text-xs text-terra-600 ml-6 flex items-center gap-1">
          <AlertTriangle size={10} /> {hoursWarning}
        </p>
      )}

      {showActions && (
        <div className="flex flex-wrap gap-2 border-t border-sand-200 pt-2 ml-0">
          {!isFirst && (
            <button onClick={onMoveUp} className="btn-ghost text-xs px-2 py-1">
              <ArrowUp size={12} /> Up
            </button>
          )}
          {!isLast && (
            <button onClick={onMoveDown} className="btn-ghost text-xs px-2 py-1">
              <ArrowDown size={12} /> Down
            </button>
          )}
          {stop.destination_id && (
            <Link to={`/explore/destination/${stop.destination_id}`} className="btn-ghost text-xs px-2 py-1">
              <Info size={12} /> Details
            </Link>
          )}
          <button onClick={onDelete} className="btn-ghost text-xs px-2 py-1 text-red-600">
            <Trash2 size={12} /> Remove
          </button>
        </div>
      )}
    </div>
  )
}

// ---- Leg Card ----

function LegCard({ leg, onDelete }: { leg: ItineraryLegWithDetails; onDelete: () => void }) {
  const fareLabel = leg.estimated_fare != null
    ? formatCurrency(Number(leg.estimated_fare), leg.currency_code)
    : 'No fare data'

  return (
    <div className="card space-y-2 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {leg.transport_mode?.icon && <span>{leg.transport_mode.icon}</span>}
          <span className="text-sm font-semibold text-ocean-900">
            {leg.route?.route_name ?? 'Transport leg'}
          </span>
        </div>
        <span className={`pill text-[10px] ${
          leg.fare_source_status === 'verified' ? 'bg-leaf-100 text-leaf-700' :
          leg.fare_source_status === 'estimated' ? 'bg-sand-200 text-terra-800' :
          leg.fare_source_status === 'user_entered' ? 'bg-ocean-100 text-ocean-800' :
          'bg-red-100 text-red-700'
        }`}>
          {FARE_SOURCE_LABELS[leg.fare_source_status]}
        </span>
      </div>
      <div className="flex flex-wrap gap-3 text-xs text-ocean-600">
        <span>{fareLabel}</span>
        {leg.estimated_duration_minutes != null && <span>~{leg.estimated_duration_minutes}min</span>}
        {leg.transport_mode && <span>{leg.transport_mode.name}</span>}
      </div>
      {leg.fare_source_status === 'unavailable' && (
        <p className="text-xs text-red-600 flex items-center gap-1">
          <AlertTriangle size={10} /> Route information unavailable. Check the Route Planner for possible connections.
        </p>
      )}
      {leg.route_id && (
        <Link to="/plan" className="text-xs text-ocean-600 hover:underline">Open in Route Planner →</Link>
      )}
      <button onClick={onDelete} className="btn-ghost text-xs text-red-600 px-2 py-1">
        <Trash2 size={12} /> Remove Leg
      </button>
    </div>
  )
}

// ---- Expense Card ----

function ExpenseCard({ expense, onDelete }: { expense: ItineraryExpenseWithStop; onDelete: () => void }) {
  return (
    <div className="card space-y-1 py-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-ocean-900">
            {EXPENSE_CATEGORY_LABELS[expense.category]}
          </p>
          {expense.description && <p className="text-xs text-ocean-600">{expense.description}</p>}
        </div>
        <div className="text-right">
          <p className="text-sm font-bold text-ocean-900">{formatCurrency(Number(expense.amount), expense.currency_code)}</p>
          <span className="text-[10px] text-ocean-500">{EXPENSE_SOURCE_LABELS[expense.source_type]}</span>
        </div>
      </div>
      <button onClick={onDelete} className="btn-ghost text-xs text-red-600 px-2 py-1">
        <Trash2 size={12} /> Remove
      </button>
    </div>
  )
}

// ---- Cost Breakdown Panel ----

function CostBreakdownPanel({ cost, itinerary }: { cost: ReturnType<typeof calculateTripCost>; itinerary: TouristItineraryWithDetails }) {
  return (
    <section className="card space-y-3">
      <h2 className="section-title flex items-center gap-2">
        <Wallet size={16} /> Cost Estimate
      </h2>

      <div className="space-y-2 text-sm">
        <CostRow label="Transportation (from routes + user-entered)" amount={cost.transportationTotal} currency={cost.currency} />
        <CostRow label="Entrance Fees" amount={cost.entranceFeesTotal} currency={cost.currency} />
        <CostRow label="Accommodation" amount={cost.accommodationTotal} currency={cost.currency} />
        <CostRow label="Food & Dining" amount={cost.foodTotal} currency={cost.currency} />
        <CostRow label="Other" amount={cost.otherTotal} currency={cost.currency} />
      </div>

      <div className="border-t border-sand-200 pt-2 space-y-1">
        <div className="flex items-center justify-between">
          <span className="font-bold text-ocean-900">Estimated Total</span>
          <span className="font-bold text-lg text-ocean-900">{formatCurrency(cost.grandTotal, cost.currency)}</span>
        </div>
        {itinerary.traveler_count > 1 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-ocean-600">Per Traveler ({itinerary.traveler_count})</span>
            <span className="text-ocean-700">{formatCurrency(cost.perTraveler, cost.currency)}</span>
          </div>
        )}
      </div>

      {/* Per-leg fares */}
      {cost.legs.length > 0 && (
        <div className="space-y-1 border-t border-sand-200 pt-2">
          <p className="text-xs font-semibold text-ocean-700">Per Leg Fares:</p>
          {cost.legs.map((leg) => (
            <div key={leg.id} className="flex items-center justify-between text-xs">
              <span className="text-ocean-600">{leg.label}</span>
              <span className={leg.fare != null ? 'text-ocean-800' : 'text-red-500'}>
                {leg.fare != null ? formatCurrency(leg.fare, cost.currency) : FARE_SOURCE_LABELS[leg.fareSource]}
              </span>
            </div>
          ))}
        </div>
      )}

      {cost.incomplete && (
        <div className="rounded-xl bg-terra-50 px-3 py-2">
          <p className="text-xs text-terra-700 flex items-center gap-1">
            <AlertTriangle size={12} /> This estimate is incomplete. Some costs could not be determined.
          </p>
        </div>
      )}

      {cost.notes.map((note, i) => (
        <p key={i} className="text-xs text-ocean-500">{note}</p>
      ))}

      <p className="text-xs text-ocean-400">
        Fares from verified route data are labeled. User-entered amounts are marked. Missing data is shown as unavailable, not as zero.
      </p>
    </section>
  )
}

function CostRow({ label, amount, currency }: { label: string; amount: number; currency: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-ocean-700">{label}</span>
      <span className="font-semibold text-ocean-900">{formatCurrency(amount, currency)}</span>
    </div>
  )
}

// ---- Weather Panel ----

function WeatherPanel({ data, error, loading }: { data: Awaited<ReturnType<typeof fetchWeather>>['data']; error: string | null; loading: boolean }) {
  if (loading) {
    return (
      <section className="card flex items-center gap-3">
        <span className="h-3 w-3 animate-pulse rounded-full bg-ocean-400" />
        <p className="text-sm font-semibold text-ocean-700">Loading weather…</p>
      </section>
    )
  }

  if (error) {
    return (
      <section className="card">
        <p className="text-sm text-red-600">{error}</p>
      </section>
    )
  }

  if (!data) return null

  if (!data.configured) {
    return (
      <section className="card space-y-2">
        <h2 className="section-title flex items-center gap-2"><CloudSun size={16} /> Weather</h2>
        <p className="text-sm text-ocean-600">
          Weather information is not yet available. The weather provider has not been configured.
        </p>
        <p className="text-xs text-ocean-400">Reliable forecasts require an active weather data provider.</p>
      </section>
    )
  }

  const advisories = data.current ? generateAdvisories(data.current, data.hourly) : []

  return (
    <section className="card space-y-3">
      <h2 className="section-title flex items-center gap-2">
        <CloudSun size={16} /> Weather Forecast
      </h2>

      {data.current && (
        <div className="flex items-center gap-3">
          <span className="text-3xl">{weatherIcon(data.current.icon)}</span>
          <div>
            <p className="text-2xl font-bold text-ocean-900">
              {data.current.temperature != null ? `${Math.round(data.current.temperature)}°C` : '—'}
            </p>
            <p className="text-sm text-ocean-600">{data.current.description ?? 'No description'}</p>
          </div>
        </div>
      )}

      {data.daily.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-semibold text-ocean-700">Forecast:</p>
          {data.daily.slice(0, 5).map((d) => (
            <div key={d.date} className="flex items-center justify-between text-sm">
              <span className="text-ocean-600">{new Date(d.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
              <span className="flex items-center gap-2">
                {weatherIcon(d.icon)}
                <span className="text-ocean-800">
                  {d.temp_max != null ? Math.round(d.temp_max) : '—'}° / {d.temp_min != null ? Math.round(d.temp_min) : '—'}°
                </span>
                {d.precipitation_chance != null && (
                  <span className="text-xs text-ocean-500">{Math.round(d.precipitation_chance)}%</span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}

      {advisories.length > 0 && (
        <div className="space-y-1 border-t border-sand-200 pt-2">
          <p className="text-xs font-semibold text-ocean-700">Advisories:</p>
          {advisories.map((a) => (
            <div key={a.id} className="flex items-start gap-2 text-xs">
              <span>{a.icon}</span>
              <div>
                <p className="font-semibold text-ocean-800">{a.title}</p>
                <p className="text-ocean-600">{a.description}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-ocean-400">
        Provider: {data.provider} · Fetched: {new Date(data.fetched_at).toLocaleString()}
        {data.cached && ' (cached)'}
        {data.stale && ' (may be stale)'}
        Forecasts are informational and not guarantees.
      </p>
    </section>
  )
}

// ---- Alerts Panel ----

function AlertsPanel({ alerts }: { alerts: TransportAlertWithDetails[] }) {
  return (
    <section className="card space-y-3">
      <h2 className="section-title flex items-center gap-2">
        <AlertTriangle size={16} /> Transport Alerts
      </h2>

      {alerts.length === 0 ? (
        <div className="flex flex-col items-center gap-2 text-center py-2">
          <CheckCircle2 size={24} className="text-leaf-600" />
          <p className="text-sm font-semibold text-ocean-900">No active alerts</p>
          <p className="text-xs text-ocean-600">No published transport alerts affect your itinerary destinations.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {alerts.map((alert) => (
            <Link
              key={alert.id}
              to={`/transport-alerts/${alert.id}`}
              className="block rounded-xl border border-sand-200 p-3 hover:bg-sand-50"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-sm text-ocean-900">{alert.title}</p>
                <span className={`pill text-[10px] shrink-0 ${
                  alert.severity === 'critical' ? 'bg-red-100 text-red-700' :
                  alert.severity === 'high' ? 'bg-terra-100 text-terra-700' :
                  alert.severity === 'moderate' ? 'bg-sand-200 text-terra-800' :
                  'bg-ocean-100 text-ocean-800'
                }`}>
                  {alert.severity}
                </span>
              </div>
              <p className="text-xs text-ocean-600 line-clamp-2 mt-1">{alert.description}</p>
              {alert.municipality && <p className="text-xs text-ocean-500 mt-1">{alert.municipality}</p>}
            </Link>
          ))}
        </div>
      )}
      <p className="text-xs text-ocean-400">
        Alerts are sourced from published transport advisories. Always check with operators for the latest information.
      </p>
    </section>
  )
}

// ---- Add Stop Modal ----

function AddStopModal({
  itineraryId, days, onClose, onAdded,
}: {
  itineraryId: string
  days: { id: string; day_number: number; trip_date: string | null }[]
  onClose: () => void
  onAdded: () => void
}) {
  const [mode, setMode] = useState<'destination' | 'custom' | 'rest'>('destination')
  const [search, setSearch] = useState('')
  const [muniFilter, setMuniFilter] = useState('all')
  const [results, setResults] = useState<DestinationWithDetails[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedDay, setSelectedDay] = useState<string | null>(days.length > 0 ? days[0].id : null)

  // Custom stop fields
  const [customTitle, setCustomTitle] = useState('')
  const [customDesc, setCustomDesc] = useState('')
  const [customLat, setCustomLat] = useState('')
  const [customLng, setCustomLng] = useState('')
  const [arrivalTime, setArrivalTime] = useState('')
  const [departureTime, setDepartureTime] = useState('')
  const [duration, setDuration] = useState('')
  const [notes, setNotes] = useState('')

  // Rest break fields
  const [restTitle, setRestTitle] = useState('')

  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (mode !== 'destination') return
    let active = true
    setSearching(true)
    void (async () => {
      const res = await searchDestinationsForItinerary(search, muniFilter)
      if (active) { setResults(res); setSearching(false) }
    })()
    return () => { active = false }
  }, [search, muniFilter, mode])

  async function handleAddDestination(dest: DestinationWithDetails) {
    setError(null)
    setSaving(true)
    const { error } = await addStop(itineraryId, {
      itinerary_day_id: selectedDay,
      destination_id: dest.id,
      location_id: dest.location_id,
    })
    setSaving(false)
    if (error) { setError(error); return }
    await onAdded()
  }

  async function handleAddCustom() {
    if (!customTitle.trim()) { setError('Custom stop name is required.'); return }
    setError(null)
    setSaving(true)
    const { error } = await addStop(itineraryId, {
      itinerary_day_id: selectedDay,
      custom_title: customTitle,
      custom_location_description: customDesc || undefined,
      custom_latitude: customLat ? parseFloat(customLat) : null,
      custom_longitude: customLng ? parseFloat(customLng) : null,
      planned_arrival_time: arrivalTime || null,
      planned_departure_time: departureTime || null,
      estimated_duration_minutes: duration ? parseInt(duration) : null,
      user_notes: notes || undefined,
    })
    setSaving(false)
    if (error) { setError(error); return }
    await onAdded()
  }

  async function handleAddRest() {
    setError(null)
    setSaving(true)
    const { error } = await addStop(itineraryId, {
      itinerary_day_id: selectedDay,
      is_rest_break: true,
      custom_title: restTitle || 'Rest / Meal Break',
    })
    setSaving(false)
    if (error) { setError(error); return }
    await onAdded()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white w-full max-w-md max-h-[85vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-sand-200 px-4 py-3 flex items-center justify-between">
          <h2 className="font-bold text-ocean-900">Add Stop</h2>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full bg-sand-100 hover:bg-sand-200">
            <X size={16} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Mode tabs */}
          <div className="flex gap-2">
            {(['destination', 'custom', 'rest'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`flex-1 rounded-lg py-2 text-xs font-semibold ${
                  mode === m ? 'bg-ocean-700 text-white' : 'bg-sand-100 text-ocean-600'
                }`}
              >
                {m === 'destination' ? 'Destination' : m === 'custom' ? 'Custom Place' : 'Rest Break'}
              </button>
            ))}
          </div>

          {/* Day selector */}
          {days.length > 0 && (
            <div className="space-y-1">
              <label className="text-xs font-semibold text-ocean-700">Assign to Day</label>
              <select
                value={selectedDay ?? ''}
                onChange={(e) => setSelectedDay(e.target.value || null)}
                className="w-full rounded-lg border border-sand-200 bg-sand-50 px-3 py-2 text-sm text-ocean-900"
              >
                <option value="">Unassigned</option>
                {days.map((d) => (
                  <option key={d.id} value={d.id}>
                    Day {d.day_number}{d.trip_date ? ` — ${new Date(d.trip_date).toLocaleDateString()}` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          {mode === 'destination' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 rounded-xl bg-ocean-50 px-3 py-2.5">
                <SearchIcon size={18} className="text-ocean-500" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search destinations…"
                  className="w-full bg-transparent text-sm text-ocean-900 placeholder:text-ocean-400 focus:outline-none"
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button onClick={() => setMuniFilter('all')} className={`pill text-[10px] ${muniFilter === 'all' ? 'bg-ocean-700 text-white' : 'bg-sand-100 text-ocean-600'}`}>All</button>
                {MUNICIPALITIES.map((m) => (
                  <button key={m} onClick={() => setMuniFilter(m)} className={`pill text-[10px] ${muniFilter === m ? 'bg-ocean-700 text-white' : 'bg-sand-100 text-ocean-600'}`}>{m}</button>
                ))}
              </div>

              {searching ? (
                <p className="text-sm text-ocean-500 text-center py-4">Searching…</p>
              ) : results.length === 0 ? (
                <p className="text-sm text-ocean-500 text-center py-4">No destinations found. Try a different search or add a custom place.</p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {results.map((d) => (
                    <button
                      key={d.id}
                      onClick={() => void handleAddDestination(d)}
                      disabled={saving}
                      className="w-full text-left rounded-xl border border-sand-200 p-3 hover:bg-ocean-50 disabled:opacity-50"
                    >
                      <p className="font-semibold text-sm text-ocean-900">{d.name}</p>
                      <p className="text-xs text-ocean-600">{d.municipality ?? 'Municipality not set'}</p>
                      {d.description && <p className="text-xs text-ocean-500 line-clamp-1">{d.description}</p>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {mode === 'custom' && (
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-ocean-700">Place Name *</label>
                <input type="text" value={customTitle} onChange={(e) => setCustomTitle(e.target.value)} placeholder="e.g. Friend's house, scenic viewpoint"
                  className="w-full rounded-lg border border-sand-200 bg-sand-50 px-3 py-2 text-sm text-ocean-900" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-ocean-700">Location Description</label>
                <input type="text" value={customDesc} onChange={(e) => setCustomDesc(e.target.value)} placeholder="Address or directions"
                  className="w-full rounded-lg border border-sand-200 bg-sand-50 px-3 py-2 text-sm text-ocean-900" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-ocean-700">Latitude (optional)</label>
                  <input type="number" step="any" value={customLat} onChange={(e) => setCustomLat(e.target.value)} placeholder="13.4"
                    className="w-full rounded-lg border border-sand-200 bg-sand-50 px-3 py-2 text-sm text-ocean-900" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-ocean-700">Longitude (optional)</label>
                  <input type="number" step="any" value={customLng} onChange={(e) => setCustomLng(e.target.value)} placeholder="121.9"
                    className="w-full rounded-lg border border-sand-200 bg-sand-50 px-3 py-2 text-sm text-ocean-900" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-ocean-700">Arrival Time</label>
                  <input type="time" value={arrivalTime} onChange={(e) => setArrivalTime(e.target.value)}
                    className="w-full rounded-lg border border-sand-200 bg-sand-50 px-3 py-2 text-sm text-ocean-900" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-ocean-700">Departure Time</label>
                  <input type="time" value={departureTime} onChange={(e) => setDepartureTime(e.target.value)}
                    className="w-full rounded-lg border border-sand-200 bg-sand-50 px-3 py-2 text-sm text-ocean-900" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-ocean-700">Estimated Duration (minutes)</label>
                <input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="60"
                  className="w-full rounded-lg border border-sand-200 bg-sand-50 px-3 py-2 text-sm text-ocean-900" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-ocean-700">Notes</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Optional notes"
                  className="w-full rounded-lg border border-sand-200 bg-sand-50 px-3 py-2 text-sm text-ocean-900" />
              </div>
              <p className="text-xs text-terra-600">Custom stops are not verified destinations. They are clearly labeled in your itinerary.</p>
              <button onClick={() => void handleAddCustom()} disabled={saving} className="btn-primary w-full text-sm">
                <Plus size={16} /> {saving ? 'Adding…' : 'Add Custom Stop'}
              </button>
            </div>
          )}

          {mode === 'rest' && (
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-ocean-700">Break Title (optional)</label>
                <input type="text" value={restTitle} onChange={(e) => setRestTitle(e.target.value)} placeholder="e.g. Lunch break, Rest stop"
                  className="w-full rounded-lg border border-sand-200 bg-sand-50 px-3 py-2 text-sm text-ocean-900" />
              </div>
              <button onClick={() => void handleAddRest()} disabled={saving} className="btn-primary w-full text-sm">
                <Coffee size={16} /> {saving ? 'Adding…' : 'Add Rest Break'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ---- Add Day Modal ----

function AddDayModal({ maxDayNumber, onClose, onAdd }: { maxDayNumber: number; onClose: () => void; onAdd: (dayNumber: number, tripDate?: string) => void }) {
  const [tripDate, setTripDate] = useState('')

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white w-full max-w-md rounded-t-2xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="border-b border-sand-200 px-4 py-3 flex items-center justify-between">
          <h2 className="font-bold text-ocean-900">Add Day</h2>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full bg-sand-100">
            <X size={16} />
          </button>
        </div>
        <div className="p-4 space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-ocean-700">Date (optional)</label>
            <input type="date" value={tripDate} onChange={(e) => setTripDate(e.target.value)}
              className="w-full rounded-lg border border-sand-200 bg-sand-50 px-3 py-2 text-sm text-ocean-900" />
          </div>
          <p className="text-sm text-ocean-600">
            Day {maxDayNumber + 1} will be added to your itinerary.
          </p>
          <button onClick={() => onAdd(maxDayNumber + 1, tripDate || undefined)} className="btn-primary w-full text-sm">
            <Plus size={16} /> Add Day {maxDayNumber + 1}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---- Add Expense Modal ----

function AddExpenseModal({
  itineraryId, stops, onClose, onAdded,
}: {
  itineraryId: string
  stops: ItineraryStopWithDetails[]
  onClose: () => void
  onAdded: () => void
}) {
  const [category, setCategory] = useState<ItineraryExpenseCategory>('other')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [stopId, setStopId] = useState<string | null>(null)
  const [sourceType, setSourceType] = useState<ItineraryExpenseSource>('user_entered')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleAdd() {
    if (!amount || parseFloat(amount) < 0) { setError('Amount must be a non-negative number.'); return }
    setError(null)
    setSaving(true)
    const { error } = await addExpense(itineraryId, {
      category,
      amount: parseFloat(amount),
      description: description || undefined,
      stop_id: stopId,
      source_type: sourceType,
    })
    setSaving(false)
    if (error) { setError(error); return }
    await onAdded()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white w-full max-w-md max-h-[85vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="border-b border-sand-200 px-4 py-3 flex items-center justify-between">
          <h2 className="font-bold text-ocean-900">Add Expense</h2>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full bg-sand-100">
            <X size={16} />
          </button>
        </div>
        <div className="p-4 space-y-3">
          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="space-y-1">
            <label className="text-xs font-semibold text-ocean-700">Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value as ItineraryExpenseCategory)}
              className="w-full rounded-lg border border-sand-200 bg-sand-50 px-3 py-2 text-sm text-ocean-900">
              {Object.entries(EXPENSE_CATEGORY_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-ocean-700">Amount (₱)</label>
            <input type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00"
              className="w-full rounded-lg border border-sand-200 bg-sand-50 px-3 py-2 text-sm text-ocean-900" />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-ocean-700">Description</label>
            <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is this expense for?"
              className="w-full rounded-lg border border-sand-200 bg-sand-50 px-3 py-2 text-sm text-ocean-900" />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-ocean-700">Source Type</label>
            <select value={sourceType} onChange={(e) => setSourceType(e.target.value as ItineraryExpenseSource)}
              className="w-full rounded-lg border border-sand-200 bg-sand-50 px-3 py-2 text-sm text-ocean-900">
              <option value="user_entered">User-Entered</option>
              <option value="estimated">Estimated</option>
              <option value="verified">Verified</option>
            </select>
          </div>

          {stops.length > 0 && (
            <div className="space-y-1">
              <label className="text-xs font-semibold text-ocean-700">Related Stop (optional)</label>
              <select value={stopId ?? ''} onChange={(e) => setStopId(e.target.value || null)}
                className="w-full rounded-lg border border-sand-200 bg-sand-50 px-3 py-2 text-sm text-ocean-900">
                <option value="">None</option>
                {stops.map((s) => {
                  const name = s.destination?.name ?? s.location?.name ?? s.custom_title ?? 'Stop'
                  return <option key={s.id} value={s.id}>{name}</option>
                })}
              </select>
            </div>
          )}

          <button onClick={() => void handleAdd()} disabled={saving} className="btn-primary w-full text-sm">
            <Plus size={16} /> {saving ? 'Adding…' : 'Add Expense'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---- Optimize Modal ----

function OptimizeModal({ onStopCount, onConfirm, onClose }: { onStopCount: number; onConfirm: () => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white w-full max-w-md rounded-t-2xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="border-b border-sand-200 px-4 py-3 flex items-center justify-between">
          <h2 className="font-bold text-ocean-900">Optimize Stop Order</h2>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full bg-sand-100">
            <X size={16} />
          </button>
        </div>
        <div className="p-4 space-y-3">
          {onStopCount < 3 ? (
            <p className="text-sm text-ocean-600">At least 3 stops with coordinates are needed to suggest an optimized order.</p>
          ) : (
            <>
              <div className="rounded-xl bg-terra-50 p-3 space-y-2">
                <p className="text-sm font-semibold text-terra-800">Geographic Nearest-Neighbor</p>
                <p className="text-xs text-terra-700">
                  This tool suggests a more efficient stop order based on straight-line distance between destination coordinates.
                  It does NOT use road distance, travel time, or transport availability.
                </p>
                <p className="text-xs text-terra-700">
                  Your current order will be preserved — you can compare and revert if needed.
                </p>
              </div>
              <button onClick={onConfirm} className="btn-primary w-full text-sm">
                <Navigation size={16} /> Suggest Optimized Order
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
