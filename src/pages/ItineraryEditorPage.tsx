import { useEffect, useState, useCallback } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  MapPin,
  Users,
  Wallet,
  Save,
  Search as SearchIcon,
  Calendar,
  Luggage,
} from 'lucide-react'
import { useAuth } from '../lib/auth'
import {
  createItinerary,
  updateItinerary,
  fetchItineraryDetail,
  searchLocationsForItinerary,
  MUNICIPALITIES,
} from '../lib/touristPlanner'
import type { LocationRow } from '../lib/types'

export function ItineraryEditorPage() {
  const { id } = useParams<{ id: string }>()
  const isEdit = !!id
  const navigate = useNavigate()
  const { user } = useAuth()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [travelerCount, setTravelerCount] = useState(1)
  const [budget, setBudget] = useState('')
  const [startingLocationId, setStartingLocationId] = useState<string | null>(null)
  const [startingLocationName, setStartingLocationName] = useState('')
  const [locationSearch, setLocationSearch] = useState('')
  const [locationResults, setLocationResults] = useState<LocationRow[]>([])

  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadItinerary = useCallback(async () => {
    if (!id) return
    const iti = await fetchItineraryDetail(id)
    if (!iti) {
      setError('Itinerary not found.')
      setLoading(false)
      return
    }
    setTitle(iti.title)
    setDescription(iti.description ?? '')
    setStartDate(iti.start_date ?? '')
    setEndDate(iti.end_date ?? '')
    setTravelerCount(iti.traveler_count)
    setBudget(iti.budget_amount ? String(iti.budget_amount) : '')
    setStartingLocationId(iti.starting_location_id)
    setStartingLocationName(iti.starting_location?.name ?? '')
    setLoading(false)
  }, [id])

  useEffect(() => {
    if (isEdit) void loadItinerary()
  }, [isEdit, loadItinerary])

  useEffect(() => {
    if (!locationSearch.trim()) {
      setLocationResults([])
      return
    }
    let active = true
    void (async () => {
      const results = await searchLocationsForItinerary(locationSearch)
      if (active) setLocationResults(results)
    })()
    return () => { active = false }
  }, [locationSearch])

  async function handleSave() {
    setError(null)

    if (!title.trim()) {
      setError('Trip name is required.')
      return
    }
    if (startDate && endDate && endDate < startDate) {
      setError('End date cannot be before start date.')
      return
    }
    if (travelerCount < 1) {
      setError('Number of travelers must be at least 1.')
      return
    }

    setSaving(true)

    const input = {
      title: title.trim(),
      description: description.trim() || undefined,
      start_date: startDate || null,
      end_date: endDate || null,
      starting_location_id: startingLocationId,
      traveler_count: travelerCount,
      budget_amount: budget ? parseFloat(budget) : 0,
    }

    if (isEdit && id) {
      const { error: updErr } = await updateItinerary(id, input)
      setSaving(false)
      if (updErr) {
        setError(updErr)
        return
      }
      navigate(`/tourist-planner/${id}`)
    } else {
      const { success, id: newId, error: createErr } = await createItinerary(input)
      setSaving(false)
      if (!success || !newId) {
        setError(createErr ?? 'Failed to create itinerary.')
        return
      }
      navigate(`/tourist-planner/${newId}`)
    }
  }

  if (!user) {
    return (
      <div className="app-shell">
        <header className="sticky top-0 z-30 bg-ocean-800 text-white shadow-card">
          <div className="flex items-center gap-3 px-4 py-4">
            <Link to="/tourist-planner" className="grid h-9 w-9 place-items-center rounded-full bg-ocean-700 hover:bg-ocean-600">
              <ArrowLeft size={18} />
            </Link>
            <h1 className="text-lg font-bold">Sign In Required</h1>
          </div>
        </header>
        <main className="flex-1 px-4 py-5">
          <div className="card flex flex-col items-center gap-3 text-center">
            <Luggage size={32} className="text-ocean-400" />
            <p className="font-bold text-ocean-900">Please sign in to create itineraries</p>
            <Link to="/auth" className="btn-primary w-full">Sign In / Sign Up</Link>
          </div>
        </main>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="app-shell">
        <header className="sticky top-0 z-30 bg-ocean-800 text-white shadow-card">
          <div className="flex items-center gap-3 px-4 py-4">
            <Link to="/tourist-planner" className="grid h-9 w-9 place-items-center rounded-full bg-ocean-700">
              <ArrowLeft size={18} />
            </Link>
            <h1 className="text-lg font-bold">Loading…</h1>
          </div>
        </header>
        <main className="flex-1 px-4 py-5">
          <div className="card flex items-center gap-3">
            <span className="h-3 w-3 animate-pulse rounded-full bg-ocean-400" />
            <p className="text-sm font-semibold text-ocean-700">Loading itinerary…</p>
          </div>
        </main>
      </div>
    )
  }

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
          <h1 className="text-lg font-bold">{isEdit ? 'Edit Trip' : 'New Trip'}</h1>
        </div>
      </header>

      <main className="flex-1 space-y-5 px-4 py-5">
        {error && (
          <div className="card border border-red-200 bg-red-50">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Trip Name */}
        <section className="card space-y-3">
          <h2 className="section-title">Trip Details</h2>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-ocean-800">Trip Name *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Marinduque Weekend Adventure"
              className="w-full rounded-xl border border-sand-200 bg-sand-50 px-3 py-2.5 text-sm text-ocean-900 placeholder:text-ocean-400 focus:border-ocean-400 focus:outline-none"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-ocean-800">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What kind of trip are you planning?"
              rows={3}
              className="w-full rounded-xl border border-sand-200 bg-sand-50 px-3 py-2.5 text-sm text-ocean-900 placeholder:text-ocean-400 focus:border-ocean-400 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-ocean-800 flex items-center gap-1">
                <Calendar size={14} /> Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-xl border border-sand-200 bg-sand-50 px-3 py-2.5 text-sm text-ocean-900 focus:border-ocean-400 focus:outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-ocean-800 flex items-center gap-1">
                <Calendar size={14} /> End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate || undefined}
                className="w-full rounded-xl border border-sand-200 bg-sand-50 px-3 py-2.5 text-sm text-ocean-900 focus:border-ocean-400 focus:outline-none"
              />
            </div>
          </div>

          {startDate && endDate && endDate < startDate && (
            <p className="text-xs text-red-600">End date cannot be before start date.</p>
          )}
        </section>

        {/* Travelers & Budget */}
        <section className="card space-y-3">
          <h2 className="section-title">Travelers & Budget</h2>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-ocean-800 flex items-center gap-1">
              <Users size={14} /> Number of Travelers
            </label>
            <input
              type="number"
              min={1}
              value={travelerCount}
              onChange={(e) => setTravelerCount(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-full rounded-xl border border-sand-200 bg-sand-50 px-3 py-2.5 text-sm text-ocean-900 focus:border-ocean-400 focus:outline-none"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-ocean-800 flex items-center gap-1">
              <Wallet size={14} /> Estimated Budget (optional)
            </label>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-ocean-700">₱</span>
              <input
                type="number"
                min={0}
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-xl border border-sand-200 bg-sand-50 px-3 py-2.5 text-sm text-ocean-900 placeholder:text-ocean-400 focus:border-ocean-400 focus:outline-none"
              />
            </div>
          </div>
        </section>

        {/* Starting Location */}
        <section className="card space-y-3">
          <h2 className="section-title">Starting Location (optional)</h2>

          {startingLocationId && startingLocationName ? (
            <div className="flex items-center justify-between rounded-xl bg-ocean-50 px-3 py-2.5">
              <span className="flex items-center gap-2 text-sm font-semibold text-ocean-800">
                <MapPin size={16} /> {startingLocationName}
              </span>
              <button
                onClick={() => { setStartingLocationId(null); setStartingLocationName('') }}
                className="text-xs text-red-600 hover:underline"
              >
                Remove
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2 rounded-xl bg-ocean-50 px-3 py-2.5">
                <SearchIcon size={18} className="text-ocean-500" />
                <input
                  type="text"
                  value={locationSearch}
                  onChange={(e) => setLocationSearch(e.target.value)}
                  placeholder="Search for a starting point…"
                  className="w-full bg-transparent text-sm text-ocean-900 placeholder:text-ocean-400 focus:outline-none"
                />
              </div>
              {locationResults.length > 0 && (
                <div className="space-y-1">
                  {locationResults.map((loc) => (
                    <button
                      key={loc.id}
                      onClick={() => {
                        setStartingLocationId(loc.id)
                        setStartingLocationName(loc.name)
                        setLocationSearch('')
                        setLocationResults([])
                      }}
                      className="flex w-full items-center gap-2 rounded-lg border border-sand-200 px-3 py-2 text-left text-sm hover:bg-ocean-50"
                    >
                      <MapPin size={14} className="text-ocean-500" />
                      <span className="font-semibold text-ocean-900">{loc.name}</span>
                      {loc.municipality && <span className="text-xs text-ocean-600">{loc.municipality}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <p className="text-xs text-ocean-500">
            Your GPS location is not required. You can search for a terminal, port, or municipality as your starting point.
          </p>
        </section>

        {/* Preferred Municipalities */}
        <section className="card space-y-3">
          <h2 className="section-title">Preferred Municipalities (optional)</h2>
          <p className="text-xs text-ocean-600">
            You can add destinations from these municipalities after creating the trip.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {MUNICIPALITIES.map((m) => (
              <Link
                key={m}
                to={`/explore/municipality/${m}`}
                className="pill bg-ocean-50 text-ocean-700 hover:bg-ocean-100"
              >
                <MapPin size={12} /> {m}
              </Link>
            ))}
          </div>
        </section>

        {/* Save */}
        <button onClick={() => void handleSave()} disabled={saving} className="btn-primary w-full">
          <Save size={18} /> {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Trip'}
        </button>

        <p className="text-center text-xs text-ocean-500">
          You can add destinations, plan transport, and estimate costs after creating the trip.
        </p>
      </main>
    </div>
  )
}
