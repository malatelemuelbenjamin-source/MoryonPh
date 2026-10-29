import { useEffect, useState, useCallback, useMemo } from 'react'
import { Link, useLocation as useRouterLocation } from 'react-router-dom'
import {
  ArrowLeft, ArrowDownUp, Plus, Trash2, Wallet, Calculator, Users,
  AlertTriangle, CheckCircle2, Info, Copy, RefreshCw, Save,
  Route as RouteIcon, X, Share2,
} from 'lucide-react'
import { useAuth } from '../lib/auth'
import { LocationSearchField } from '../components/LocationSearchField'
import { searchLocationsForRouting } from '../lib/routes'
import { passengerLabel } from '../lib/fares'
import {
  createEstimate, fetchMyEstimates, fetchEstimateDetail,
  updateEstimate, deleteEstimate, duplicateEstimate,
  addItem, deleteItem,
  calculateTripLegs, buildCostBreakdown, compareBudget,
  recalculateEstimate, saveEstimate, recalculateEstimateTotals,
  computeLineTotal, formatCurrency,
  EXPENSE_CATEGORIES, EXPENSE_CATEGORY_LABELS,
  CALC_TYPE_LABELS, SOURCE_TYPE_LABELS, STATUS_LABELS,
  sourceClasses,
} from '../lib/tripCostCalculator'
import type {
  TripCostEstimateRow, TripCostEstimateWithDetails,
  TripCostItemWithDetails, CostItemCalculationType, CostItemSourceType,
  PassengerType, LocationRow,
} from '../lib/types'

interface RouterState {
  estimateId?: string
  fromLocationId?: string
  toLocationId?: string
  itineraryId?: string
}

export function TripCostCalculatorPage() {
  const routerLoc = useRouterLocation()
  const initialState = (routerLoc.state ?? {}) as RouterState
  const { user } = useAuth()

  const [estimates, setEstimates] = useState<TripCostEstimateRow[]>([])
  const [activeEstimate, setActiveEstimate] = useState<TripCostEstimateWithDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  // Trip form state
  const [title, setTitle] = useState('')
  const [from, setFrom] = useState<LocationRow | null>(null)
  const [to, setTo] = useState<LocationRow | null>(null)
  const [intermediateStops, setIntermediateStops] = useState<LocationRow[]>([])
  const [tripDate, setTripDate] = useState('')
  const [returnDate, setReturnDate] = useState('')
  const [isRoundTrip, setIsRoundTrip] = useState(false)
  const [travelerCount, setTravelerCount] = useState(1)
  const [budget, setBudget] = useState('')
  const [passengerMix, setPassengerMix] = useState<Record<PassengerType, number>>({
    regular: 1, student: 0, senior: 0, pwd: 0,
  })

  // Calculation state
  const [calculating, setCalculating] = useState(false)
  const [legResults, setLegResults] = useState<ReturnType<typeof calculateTripLegs> extends Promise<infer T> ? T : never>([])
  const [additionalExpenses, setAdditionalExpenses] = useState<TripCostItemWithDetails[]>([])
  const [showAddExpense, setShowAddExpense] = useState(false)
  const [showSavedList, setShowSavedList] = useState(false)

  // Load estimates list
  const loadEstimates = useCallback(async () => {
    const list = await fetchMyEstimates()
    setEstimates(list)
  }, [])

  useEffect(() => {
    if (!user) { setLoading(false); return }
    void (async () => {
      setLoading(true)
      await loadEstimates()
      if (initialState.estimateId) {
        const detail = await fetchEstimateDetail(initialState.estimateId)
        if (detail) loadEstimateIntoForm(detail)
      }
      setLoading(false)
    })()
  }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  function loadEstimateIntoForm(est: TripCostEstimateWithDetails) {
    setActiveEstimate(est)
    setTitle(est.title)
    setTripDate(est.trip_date ?? '')
    setReturnDate(est.return_date ?? '')
    setIsRoundTrip(est.is_round_trip)
    setTravelerCount(est.traveler_count)
    setBudget(est.budget_amount != null ? String(est.budget_amount) : '')
    const transportItems = est.items.filter((i) => i.item_type === 'transport_leg')
    const expenseItems = est.items.filter((i) => i.item_type === 'additional_expense')
    setAdditionalExpenses(expenseItems)
    // Reconstruct leg results from saved items
    setLegResults(transportItems.map((item) => ({
      route: null,
      fareAmount: Number(item.amount),
      sourceType: item.source_type,
      sourceReference: item.source_reference,
      passengerType: item.passenger_type ?? 'regular',
      passengerCount: item.passenger_count,
      fromLocationId: item.from_location_id ?? '',
      toLocationId: item.to_location_id ?? '',
      lineTotal: Number(item.line_total),
      error: item.source_type === 'unavailable' ? 'No fare data' : null,
    })))
  }

  // Sync passenger mix total with traveler count
  useEffect(() => {
    const total = Object.values(passengerMix).reduce((a, b) => a + b, 0)
    if (total !== travelerCount && total > 0) {
      setTravelerCount(total)
    }
  }, [passengerMix]) // eslint-disable-line react-hooks/exhaustive-deps

  // Build journey legs from locations
  const journeyLegs = useMemo(() => {
    const points: { loc: LocationRow; pType: PassengerType; count: number }[] = []
    if (from) {
      points.push({ loc: from, pType: getDominantPassenger(passengerMix), count: travelerCount })
    }
    for (const stop of intermediateStops) {
      points.push({ loc: stop, pType: getDominantPassenger(passengerMix), count: travelerCount })
    }
    if (to) {
      points.push({ loc: to, pType: getDominantPassenger(passengerMix), count: travelerCount })
    }
    return points
  }, [from, to, intermediateStops, passengerMix, travelerCount])

  async function handleCalculate() {
    if (journeyLegs.length < 2) {
      setError('Select at least a starting point and destination.')
      return
    }
    setCalculating(true)
    setError(null)

    const legSpecs = []
    for (let i = 0; i < journeyLegs.length - 1; i++) {
      legSpecs.push({
        fromLocationId: journeyLegs[i].loc.id,
        toLocationId: journeyLegs[i + 1].loc.id,
        passengerType: journeyLegs[i].pType,
        passengerCount: journeyLegs[i].count,
      })
    }

    let allLegs = await calculateTripLegs(legSpecs)

    // Round trip: add return legs
    if (isRoundTrip) {
      const returnSpecs = []
      for (let i = journeyLegs.length - 1; i > 0; i--) {
        returnSpecs.push({
          fromLocationId: journeyLegs[i].loc.id,
          toLocationId: journeyLegs[i - 1].loc.id,
          passengerType: journeyLegs[i].pType,
          passengerCount: journeyLegs[i].count,
        })
      }
      const returnLegs = await calculateTripLegs(returnSpecs)
      allLegs = [...allLegs, ...returnLegs]
    }

    setLegResults(allLegs)
    setCalculating(false)
  }

  const costBreakdown = useMemo(() => {
    return buildCostBreakdown(legResults, additionalExpenses, travelerCount)
  }, [legResults, additionalExpenses, travelerCount])

  const budgetComparison = useMemo(() => {
    const budgetNum = budget ? parseFloat(budget) : null
    return compareBudget(budgetNum, costBreakdown.knownTotal)
  }, [budget, costBreakdown.knownTotal])

  async function handleSave() {
    setActionError(null)
    if (!title.trim()) {
      setActionError('Enter a name for this estimate.')
      return
    }

    const estInput = {
      title: title.trim(),
      origin_location_id: from?.id ?? null,
      destination_location_id: to?.id ?? null,
      trip_date: tripDate || null,
      return_date: returnDate || null,
      is_round_trip: isRoundTrip,
      traveler_count: travelerCount,
      budget_amount: budget ? parseFloat(budget) : null,
      itinerary_id: initialState.itineraryId ?? null,
    }

    if (activeEstimate) {
      // Update existing
      const { error: updErr } = await updateEstimate(activeEstimate.id, estInput)
      if (updErr) { setActionError(updErr); return }
      // Delete old items, re-add
      for (const item of activeEstimate.items) {
        await deleteItem(item.id)
      }
      await saveAllItems(activeEstimate.id)
      await saveEstimate(activeEstimate.id)
      const refreshed = await fetchEstimateDetail(activeEstimate.id)
      if (refreshed) loadEstimateIntoForm(refreshed)
    } else {
      // Create new
      const { success, id: newId, error: createErr } = await createEstimate(estInput)
      if (!success || !newId) { setActionError(createErr ?? 'Failed to save.'); return }
      await saveAllItems(newId)
      await saveEstimate(newId)
      const detail = await fetchEstimateDetail(newId)
      if (detail) loadEstimateIntoForm(detail)
    }
    await loadEstimates()
  }

  async function saveAllItems(estimateId: string) {
    let order = 0
    for (const leg of legResults) {
      await addItem(estimateId, {
        item_type: 'transport_leg',
        category: 'transport_leg',
        description: leg.route?.route_name ?? 'Transport leg',
        route_id: leg.route?.id ?? null,
        transport_mode_id: leg.route?.transport_mode_id ?? null,
        from_location_id: leg.fromLocationId || null,
        to_location_id: leg.toLocationId || null,
        passenger_type: leg.passengerType,
        passenger_count: leg.passengerCount,
        amount: leg.fareAmount ?? 0,
        line_total: leg.lineTotal,
        source_type: leg.sourceType,
        source_reference: leg.sourceReference,
        leg_order: order++,
      })
    }
    for (const exp of additionalExpenses) {
      await addItem(estimateId, {
        item_type: 'additional_expense',
        category: exp.category,
        description: exp.description,
        amount: Number(exp.amount),
        quantity: Number(exp.quantity),
        calculation_type: exp.calculation_type,
        line_total: Number(exp.line_total),
        source_type: exp.source_type,
        notes: exp.notes,
        leg_order: order++,
      })
    }
  }

  async function handleDuplicate() {
    if (!activeEstimate) return
    setActionError(null)
    const { success, newId, error } = await duplicateEstimate(activeEstimate.id)
    if (!success || !newId) { setActionError(error ?? 'Failed to duplicate.'); return }
    const detail = await fetchEstimateDetail(newId)
    if (detail) loadEstimateIntoForm(detail)
    await loadEstimates()
  }

  async function handleRecalculate() {
    if (!activeEstimate) return
    setActionError(null)
    setCalculating(true)
    const result = await recalculateEstimate(activeEstimate.id)
    setCalculating(false)
    if (!result.success) { setActionError(result.error ?? 'Recalculation failed.'); return }
    const detail = await fetchEstimateDetail(activeEstimate.id)
    if (detail) loadEstimateIntoForm(detail)
  }

  async function handleDelete() {
    if (!activeEstimate) return
    if (!confirm('Delete this estimate permanently? This cannot be undone.')) return
    setActionError(null)
    const { error: delErr } = await deleteEstimate(activeEstimate.id)
    if (delErr) { setActionError(delErr); return }
    setActiveEstimate(null)
    setTitle('')
    setLegResults([])
    setAdditionalExpenses([])
    await loadEstimates()
  }

  async function handleDeleteExpense(itemId: string) {
    setActionError(null)
    const { error: delErr } = await deleteItem(itemId)
    if (delErr) { setActionError(delErr); return }
    setAdditionalExpenses((prev) => prev.filter((e) => e.id !== itemId))
    if (activeEstimate) {
      await recalculateEstimateTotals(activeEstimate.id)
    }
  }

  function handleNewEstimate() {
    setActiveEstimate(null)
    setTitle('')
    setFrom(null)
    setTo(null)
    setIntermediateStops([])
    setTripDate('')
    setReturnDate('')
    setIsRoundTrip(false)
    setTravelerCount(1)
    setBudget('')
    setPassengerMix({ regular: 1, student: 0, senior: 0, pwd: 0 })
    setLegResults([])
    setAdditionalExpenses([])
    setError(null)
    setActionError(null)
  }

  if (!user) {
    return (
      <div className="app-shell">
        <HeaderBack title="Sign In Required" />
        <main className="flex-1 px-4 py-5">
          <div className="card flex flex-col items-center gap-3 text-center">
            <Calculator size={32} className="text-ocean-400" />
            <p className="font-bold text-ocean-900">Please sign in to save cost estimates</p>
            <Link to="/auth" className="btn-primary w-full">Sign In / Sign Up</Link>
          </div>
        </main>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="app-shell">
        <HeaderBack title="Loading…" />
        <main className="flex-1 px-4 py-5">
          <div className="card flex items-center gap-3">
            <span className="h-3 w-3 animate-pulse rounded-full bg-ocean-400" />
            <p className="text-sm font-semibold text-ocean-700">Loading cost estimates…</p>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <HeaderBack title="Trip Cost Calculator" />

      <main className="flex-1 space-y-5 px-4 py-5">
        {error && (
          <div className="card border border-red-200 bg-red-50">
            <p className="text-sm text-red-700 flex items-center gap-2"><AlertTriangle size={16} /> {error}</p>
          </div>
        )}
        {actionError && (
          <div className="card border border-red-200 bg-red-50">
            <p className="text-sm text-red-700 flex items-center gap-2"><AlertTriangle size={16} /> {actionError}</p>
          </div>
        )}

        {/* Saved Estimates List */}
        <section className="card space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="section-title flex items-center gap-2"><Save size={16} /> My Estimates</h2>
            <div className="flex gap-2">
              <button onClick={() => setShowSavedList(!showSavedList)} className="btn-ghost text-xs px-3 py-1.5">
                {estimates.length} saved
              </button>
              <button onClick={handleNewEstimate} className="btn-primary text-xs px-3 py-1.5">
                <Plus size={14} /> New
              </button>
            </div>
          </div>

          {showSavedList && estimates.length > 0 && (
            <div className="space-y-2 border-t border-sand-200 pt-2">
              {estimates.map((est) => (
                <button
                  key={est.id}
                  onClick={async () => {
                    const detail = await fetchEstimateDetail(est.id)
                    if (detail) { loadEstimateIntoForm(detail); setShowSavedList(false) }
                  }}
                  className="flex w-full items-center justify-between rounded-xl bg-sand-50 px-3 py-2.5 text-left hover:bg-sand-100"
                >
                  <div>
                    <p className="text-sm font-semibold text-ocean-900">{est.title}</p>
                    <p className="text-xs text-ocean-500">
                      {est.is_round_trip ? 'Round trip' : 'One way'} · {est.traveler_count} traveler(s) · {STATUS_LABELS[est.status]}
                    </p>
                  </div>
                  <span className="text-sm font-bold text-ocean-800">{formatCurrency(Number(est.known_total), est.currency_code)}</span>
                </button>
              ))}
            </div>
          )}

          {estimates.length === 0 && !activeEstimate && (
            <p className="text-sm text-ocean-500 text-center py-2">No saved estimates yet. Create one below.</p>
          )}
        </section>

        {/* Trip Details Form */}
        <section className="card space-y-3">
          <h2 className="section-title">Trip Details</h2>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-ocean-800">Estimate Name</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Boac to Gasan Trip"
              className="w-full rounded-xl border border-sand-200 bg-sand-50 px-3 py-2.5 text-sm text-ocean-900 placeholder:text-ocean-400 focus:border-ocean-400 focus:outline-none"
            />
          </div>

          <LocationSearchField
            label="From"
            placeholder="Starting point"
            value={from}
            onChange={setFrom}
          />
          <div className="flex justify-center">
            <button onClick={() => { const tmp = from; setFrom(to); setTo(tmp) }} className="grid h-10 w-10 place-items-center rounded-full bg-ocean-700 text-white hover:bg-ocean-800 active:scale-95">
              <ArrowDownUp size={18} />
            </button>
          </div>
          <LocationSearchField
            label="To"
            placeholder="Destination"
            value={to}
            onChange={setTo}
          />

          {/* Intermediate stops */}
          {intermediateStops.length > 0 && (
            <div className="space-y-2">
              {intermediateStops.map((stop, idx) => (
                <div key={stop.id} className="flex items-center gap-2 rounded-xl bg-sand-50 px-3 py-2">
                  <span className="text-xs font-bold text-ocean-500">{idx + 1}.</span>
                  <span className="flex-1 text-sm text-ocean-900">{stop.name}</span>
                  <button onClick={() => setIntermediateStops((prev) => prev.filter((_, i) => i !== idx))} className="text-red-500 hover:text-red-700">
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <IntermediateStopAdder onAdd={(loc) => setIntermediateStops((prev) => [...prev, loc])} />

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-ocean-800">Trip Date</label>
              <input type="date" value={tripDate} onChange={(e) => setTripDate(e.target.value)} className="w-full rounded-xl border border-sand-200 bg-sand-50 px-3 py-2.5 text-sm text-ocean-900 focus:border-ocean-400 focus:outline-none" />
            </div>
            {isRoundTrip && (
              <div className="space-y-2">
                <label className="text-sm font-semibold text-ocean-800">Return Date</label>
                <input type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} min={tripDate || undefined} className="w-full rounded-xl border border-sand-200 bg-sand-50 px-3 py-2.5 text-sm text-ocean-900 focus:border-ocean-400 focus:outline-none" />
              </div>
            )}
          </div>

          <label className="flex items-center gap-2 text-sm font-semibold text-ocean-800">
            <input type="checkbox" checked={isRoundTrip} onChange={(e) => setIsRoundTrip(e.target.checked)} className="rounded" />
            Round trip
          </label>

          {/* Passenger mix */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-ocean-800 flex items-center gap-1"><Users size={14} /> Passenger Categories</label>
            <div className="grid grid-cols-2 gap-2">
              {(['regular', 'student', 'senior', 'pwd'] as PassengerType[]).map((p) => (
                <div key={p} className="flex items-center gap-2 rounded-xl bg-sand-50 px-3 py-2">
                  <span className="text-xs font-semibold text-ocean-700 flex-1">{passengerLabel(p)}</span>
                  <input
                    type="number"
                    min={0}
                    value={passengerMix[p]}
                    onChange={(e) => setPassengerMix((prev) => ({ ...prev, [p]: Math.max(0, parseInt(e.target.value) || 0) }))}
                    className="w-16 rounded-lg border border-sand-200 bg-white px-2 py-1 text-sm text-ocean-900 focus:border-ocean-400 focus:outline-none"
                  />
                </div>
              ))}
            </div>
            <p className="text-xs text-ocean-500">Total travelers: {travelerCount}</p>
          </div>

          {/* Budget */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-ocean-800 flex items-center gap-1"><Wallet size={14} /> Budget (optional)</label>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-ocean-700">₱</span>
              <input type="number" min={0} value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="0.00" className="w-full rounded-xl border border-sand-200 bg-sand-50 px-3 py-2.5 text-sm text-ocean-900 placeholder:text-ocean-400 focus:border-ocean-400 focus:outline-none" />
            </div>
          </div>
        </section>

        {/* Calculate button */}
        <button onClick={() => void handleCalculate()} disabled={calculating || journeyLegs.length < 2} className="btn-primary w-full disabled:opacity-50">
          {calculating ? (
            <><span className="h-4 w-4 animate-pulse rounded-full bg-white" /> Calculating…</>
          ) : (
            <><Calculator size={18} /> Calculate Trip Cost</>
          )}
        </button>

        {/* Transport legs results */}
        {legResults.length > 0 && (
          <section className="card space-y-3">
            <h2 className="section-title flex items-center gap-2"><RouteIcon size={16} /> Transportation</h2>
            <div className="space-y-2">
              {legResults.map((leg, idx) => (
                <div key={idx} className="rounded-xl border border-sand-200 bg-sand-50 p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-ocean-900">Leg {idx + 1}</span>
                    <span className={`pill text-[10px] ${sourceClasses(leg.sourceType)}`}>
                      {SOURCE_TYPE_LABELS[leg.sourceType]}
                    </span>
                  </div>
                  {leg.route && (
                    <p className="text-xs text-ocean-600">{leg.route.route_name}</p>
                  )}
                  <div className="flex flex-wrap gap-3 text-xs text-ocean-600">
                    <span>{passengerLabel(leg.passengerType)} ×{leg.passengerCount}</span>
                    {leg.fareAmount != null && <span>Fare: {formatCurrency(leg.fareAmount)}</span>}
                    {leg.lineTotal > 0 && <span className="font-semibold text-ocean-900">Subtotal: {formatCurrency(leg.lineTotal)}</span>}
                  </div>
                  {leg.error && (
                    <p className="text-xs text-red-600 flex items-center gap-1"><AlertTriangle size={10} /> {leg.error}</p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Additional expenses */}
        <section className="card space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="section-title">Additional Expenses</h2>
            <button onClick={() => setShowAddExpense(!showAddExpense)} className="btn-ghost text-xs px-3 py-1.5">
              <Plus size={14} /> Add
            </button>
          </div>

          {additionalExpenses.length === 0 && !showAddExpense && (
            <p className="text-sm text-ocean-500 text-center py-2">No additional expenses added yet.</p>
          )}

          {additionalExpenses.length > 0 && (
            <div className="space-y-2">
              {additionalExpenses.map((exp) => (
                <div key={exp.id} className="rounded-xl border border-sand-200 bg-sand-50 p-3 space-y-1.5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-semibold text-ocean-900">{exp.description}</p>
                      <p className="text-xs text-ocean-500">
                        {EXPENSE_CATEGORY_LABELS[exp.category] ?? exp.category} · {CALC_TYPE_LABELS[exp.calculation_type]}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-ocean-900">{formatCurrency(Number(exp.line_total), exp.currency_code)}</p>
                      <span className={`pill text-[10px] ${sourceClasses(exp.source_type)}`}>{SOURCE_TYPE_LABELS[exp.source_type]}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-ocean-600">
                    <span>{formatCurrency(Number(exp.amount), exp.currency_code)} × {exp.quantity}</span>
                    <button onClick={() => void handleDeleteExpense(exp.id)} className="text-red-500 hover:text-red-700">
                      <Trash2 size={12} /> Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {showAddExpense && (
            <AddExpenseForm
              onAdd={async (input) => {
                if (activeEstimate) {
                  const { success, id, error } = await addItem(activeEstimate.id, { ...input, item_type: 'additional_expense' })
                  if (!success || !id) { setActionError(error ?? 'Failed to add.'); return }
                  const detail = await fetchEstimateDetail(activeEstimate.id)
                  if (detail) loadEstimateIntoForm(detail)
                } else {
                  // Temporary in-memory
                  const tempItem: TripCostItemWithDetails = {
                    id: `temp-${Date.now()}`,
                    estimate_id: 'temp',
                    item_type: 'additional_expense',
                    category: input.category ?? 'other',
                    description: input.description ?? '',
                    route_id: null, transport_mode_id: null,
                    from_location_id: null, to_location_id: null,
                    passenger_type: null, passenger_count: 0,
                    amount: input.amount ?? 0,
                    currency_code: input.currency_code ?? 'PHP',
                    quantity: input.quantity ?? 1,
                    calculation_type: input.calculation_type ?? 'per_person',
                    line_total: input.line_total ?? computeLineTotal(input.amount ?? 0, input.quantity ?? 1, input.calculation_type ?? 'per_person', 1, 0),
                    source_type: input.source_type ?? 'user_entered',
                    source_reference: input.source_reference ?? null,
                    notes: input.notes ?? null,
                    leg_order: 0,
                    created_at: '', updated_at: '',
                    route: null, transport_mode: null, from_location: null, to_location: null,
                  }
                  setAdditionalExpenses((prev) => [...prev, tempItem])
                }
                setShowAddExpense(false)
              }}
              onCancel={() => setShowAddExpense(false)}
            />
          )}
        </section>

        {/* Cost breakdown */}
        {legResults.length > 0 && (
          <section className="card space-y-3">
            <h2 className="section-title flex items-center gap-2"><Wallet size={16} /> Cost Summary</h2>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-ocean-700">Transportation</span>
                <span className="font-semibold text-ocean-900">{formatCurrency(costBreakdown.transportationTotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ocean-700">Additional Expenses</span>
                <span className="font-semibold text-ocean-900">{formatCurrency(costBreakdown.additionalExpensesTotal)}</span>
              </div>
              <div className="border-t border-sand-200 pt-2 flex justify-between">
                <span className="font-bold text-ocean-900">Known Total</span>
                <span className="font-bold text-lg text-ocean-900">{formatCurrency(costBreakdown.knownTotal)}</span>
              </div>
              {travelerCount > 1 && (
                <div className="flex justify-between text-sm">
                  <span className="text-ocean-600">Per Traveler ({travelerCount})</span>
                  <span className="text-ocean-700">{formatCurrency(costBreakdown.perTraveler)}</span>
                </div>
              )}
            </div>

            {!costBreakdown.isComplete && (
              <div className="rounded-xl bg-terra-50 px-3 py-2">
                <p className="text-xs text-terra-700 flex items-center gap-1">
                  <AlertTriangle size={12} /> {costBreakdown.notes[0] ?? 'Estimate is incomplete.'}
                </p>
                <p className="text-xs text-terra-600 mt-1">{costBreakdown.unavailableItems} item(s) have no price data and are excluded from the total.</p>
              </div>
            )}

            {costBreakdown.isComplete && costBreakdown.knownTotal > 0 && (
              <div className="rounded-xl bg-leaf-50 px-3 py-2">
                <p className="text-xs text-leaf-700 flex items-center gap-1">
                  <CheckCircle2 size={12} /> All items have known prices.
                </p>
              </div>
            )}
          </section>
        )}

        {/* Budget comparison */}
        {legResults.length > 0 && budgetComparison.budget != null && (
          <section className="card space-y-3">
            <h2 className="section-title">Budget Comparison</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-ocean-700">Your Budget</span>
                <span className="font-semibold text-ocean-900">{formatCurrency(budgetComparison.budget)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ocean-700">Known Cost</span>
                <span className="font-semibold text-ocean-900">{formatCurrency(budgetComparison.knownTotal)}</span>
              </div>
              {budgetComparison.percentUsed != null && (
                <>
                  <div className="flex justify-between">
                    <span className="text-ocean-700">% Used</span>
                    <span className={`font-semibold ${budgetComparison.status === 'over' ? 'text-red-600' : budgetComparison.status === 'near' ? 'text-terra-600' : 'text-leaf-600'}`}>
                      {budgetComparison.percentUsed}%
                    </span>
                  </div>
                  {/* Progress bar */}
                  <div className="h-2 rounded-full bg-sand-200 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        budgetComparison.status === 'over' ? 'bg-red-500' :
                        budgetComparison.status === 'near' ? 'bg-terra-500' : 'bg-leaf-500'
                      }`}
                      style={{ width: `${Math.min(100, budgetComparison.percentUsed)}%` }}
                    />
                  </div>
                  {budgetComparison.overBudget != null ? (
                    <p className="text-xs text-red-600 font-semibold">Over budget by {formatCurrency(budgetComparison.overBudget)}</p>
                  ) : (
                    <p className="text-xs text-leaf-600 font-semibold">{formatCurrency(budgetComparison.remaining ?? 0)} remaining</p>
                  )}
                </>
              )}
            </div>
          </section>
        )}

        {/* Actions */}
        <section className="card space-y-3">
          <h2 className="section-title">Actions</h2>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => void handleSave()} className="btn-primary text-xs px-3 py-2.5">
              <Save size={14} /> Save
            </button>
            <button onClick={() => void handleRecalculate()} disabled={!activeEstimate} className="btn-secondary text-xs px-3 py-2.5 disabled:opacity-50">
              <RefreshCw size={14} /> Recalculate
            </button>
            <button onClick={() => void handleDuplicate()} disabled={!activeEstimate} className="btn-secondary text-xs px-3 py-2.5 disabled:opacity-50">
              <Copy size={14} /> Duplicate
            </button>
            <button onClick={() => void handleDelete()} disabled={!activeEstimate} className="btn-secondary text-xs px-3 py-2.5 text-red-600 hover:bg-red-50 disabled:opacity-50">
              <Trash2 size={14} /> Delete
            </button>
          </div>
          {activeEstimate && (
            <Link
              to="/share"
              state={{ sourceType: 'cost_estimate', sourceId: activeEstimate.id, title: activeEstimate.title }}
              className="btn-secondary w-full text-xs px-3 py-2.5"
            >
              <Share2 size={14} /> Share This Estimate
            </Link>
          )}
          {activeEstimate && (
            <p className="text-center text-xs text-ocean-400">
              Created {new Date(activeEstimate.created_at).toLocaleDateString()} · Updated {new Date(activeEstimate.updated_at).toLocaleDateString()}
            </p>
          )}
        </section>

        {/* Info note */}
        <div className="card">
          <p className="text-xs text-ocean-500 flex items-start gap-2">
            <Info size={14} className="shrink-0 mt-0.5" />
            Cost estimates use verified fare records where available. Prices for food, accommodation, and other expenses are user-entered. Missing costs are labeled as unavailable, not shown as zero.
          </p>
        </div>
      </main>
    </div>
  )
}

// ---- Helper: get dominant passenger type ----------------------------------

function getDominantPassenger(mix: Record<PassengerType, number>): PassengerType {
  let max = 0
  let dominant: PassengerType = 'regular'
  for (const [type, count] of Object.entries(mix)) {
    if (count > max) { max = count; dominant = type as PassengerType }
  }
  return dominant
}

// ---- Header ---------------------------------------------------------------

function HeaderBack({ title }: { title: string }) {
  return (
    <header className="sticky top-0 z-30 bg-ocean-800 text-white shadow-card">
      <div className="flex items-center gap-3 px-4 py-4">
        <Link to="/" className="grid h-9 w-9 place-items-center rounded-full bg-ocean-700 hover:bg-ocean-600">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-lg font-bold">{title}</h1>
      </div>
    </header>
  )
}

// ---- Intermediate stop adder ----------------------------------------------

function IntermediateStopAdder({ onAdd }: { onAdd: (loc: LocationRow) => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<LocationRow[]>([])
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (!query.trim()) { setResults([]); return }
    let active = true
    void (async () => {
      const r = await searchLocationsForRouting(query, 5)
      if (active) { setResults(r); setShow(true) }
    })()
    return () => { active = false }
  }, [query])

  return (
    <div className="space-y-2">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Add intermediate stop…"
        className="w-full rounded-xl border border-dashed border-sand-300 bg-sand-50 px-3 py-2 text-sm text-ocean-900 placeholder:text-ocean-400 focus:border-ocean-400 focus:outline-none"
      />
      {show && results.length > 0 && (
        <div className="space-y-1 rounded-xl bg-white p-2 shadow-card">
          {results.map((loc) => (
            <button
              key={loc.id}
              onClick={() => { onAdd(loc); setQuery(''); setResults([]); setShow(false) }}
              className="block w-full rounded-lg px-3 py-2 text-left text-sm text-ocean-800 hover:bg-ocean-50"
            >
              {loc.name}{loc.municipality ? `, ${loc.municipality}` : ''}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ---- Add Expense Form -----------------------------------------------------

interface AddExpenseInput {
  category: string
  description: string
  amount: number
  currency_code?: string
  quantity?: number
  calculation_type?: CostItemCalculationType
  line_total?: number
  source_type?: CostItemSourceType
  source_reference?: string | null
  notes?: string | null
}

function AddExpenseForm({ onAdd, onCancel }: { onAdd: (input: AddExpenseInput) => void; onCancel: () => void }) {
  const [category, setCategory] = useState('food')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [calcType, setCalcType] = useState<CostItemCalculationType>('per_person')
  const [travelers, setTravelers] = useState(1)

  function handleSubmit() {
    if (!description.trim() || !amount) return
    const amt = parseFloat(amount) || 0
    const qty = parseFloat(quantity) || 1
    const lineTotal = computeLineTotal(amt, qty, calcType, travelers, calcType === 'per_person' ? travelers : 1)
    onAdd({
      category,
      description: description.trim(),
      amount: amt,
      quantity: qty,
      calculation_type: calcType,
      line_total: lineTotal,
      source_type: 'user_entered',
    })
  }

  return (
    <div className="space-y-3 rounded-xl border border-sand-200 bg-sand-50 p-3">
      <div className="space-y-2">
        <label className="text-xs font-semibold text-ocean-700">Category</label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full rounded-lg border border-sand-200 bg-white px-3 py-2 text-sm text-ocean-900 focus:border-ocean-400 focus:outline-none"
        >
          {EXPENSE_CATEGORIES.map((c) => (
            <option key={c} value={c}>{EXPENSE_CATEGORY_LABELS[c]}</option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-semibold text-ocean-700">Description</label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. Lunch at market"
          className="w-full rounded-lg border border-sand-200 bg-white px-3 py-2 text-sm text-ocean-900 placeholder:text-ocean-400 focus:border-ocean-400 focus:outline-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-2">
          <label className="text-xs font-semibold text-ocean-700">Amount (₱)</label>
          <input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="w-full rounded-lg border border-sand-200 bg-white px-3 py-2 text-sm text-ocean-900 focus:border-ocean-400 focus:outline-none" />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-semibold text-ocean-700">Quantity</label>
          <input type="number" min={0.1} step="0.1" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="w-full rounded-lg border border-sand-200 bg-white px-3 py-2 text-sm text-ocean-900 focus:border-ocean-400 focus:outline-none" />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-semibold text-ocean-700">Calculation Type</label>
        <select
          value={calcType}
          onChange={(e) => setCalcType(e.target.value as CostItemCalculationType)}
          className="w-full rounded-lg border border-sand-200 bg-white px-3 py-2 text-sm text-ocean-900 focus:border-ocean-400 focus:outline-none"
        >
          {Object.entries(CALC_TYPE_LABELS).map(([val, label]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </select>
      </div>

      {calcType === 'per_person' && (
        <div className="space-y-2">
          <label className="text-xs font-semibold text-ocean-700">Travelers</label>
          <input type="number" min={1} value={travelers} onChange={(e) => setTravelers(Math.max(1, parseInt(e.target.value) || 1))} className="w-full rounded-lg border border-sand-200 bg-white px-3 py-2 text-sm text-ocean-900 focus:border-ocean-400 focus:outline-none" />
        </div>
      )}

      <div className="flex gap-2">
        <button onClick={handleSubmit} className="btn-primary flex-1 text-xs py-2">Add Expense</button>
        <button onClick={onCancel} className="btn-ghost text-xs px-4 py-2">Cancel</button>
      </div>
    </div>
  )
}
