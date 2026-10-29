import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  MapPin,
  Search as SearchIcon,
  Calendar,
  Info,
  Compass,
} from 'lucide-react'
import {
  fetchEventsByMunicipality,
  fetchEventCategories,
  searchEvents,
  categoryIcon,
  verificationClasses,
  VERIFICATION_LABELS,
  statusClasses,
  STATUS_LABELS,
  formatEventDate,
} from '../lib/cultureEvents'
import type {
  EventCategoryRow,
  CulturalEventWithDetails,
} from '../lib/types'

export function EventsMunicipalityPage() {
  const { municipality } = useParams<{ municipality: string }>()
  const [events, setEvents] = useState<CulturalEventWithDetails[]>([])
  const [categories, setCategories] = useState<EventCategoryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')

  useEffect(() => {
    if (!municipality) return
    void (async () => {
      const [evts, cats] = await Promise.all([
        fetchEventsByMunicipality(municipality),
        fetchEventCategories(),
      ])
      setEvents(evts)
      setCategories(cats)
      setLoading(false)
    })()
  }, [municipality])

  useEffect(() => {
    if (!municipality) return
    if (search.trim() || categoryFilter !== 'all') {
      void (async () => {
        setEvents(await searchEvents(search, municipality, categoryFilter))
      })()
    } else {
      void (async () => {
        setEvents(await fetchEventsByMunicipality(municipality))
      })()
    }
  }, [search, categoryFilter, municipality])

  if (!municipality) {
    return (
      <div className="app-shell">
        <header className="sticky top-0 z-30 bg-ocean-800 text-white shadow-card">
          <div className="flex items-center gap-3 px-4 py-4">
            <Link to="/events" className="grid h-9 w-9 place-items-center rounded-full bg-ocean-700">
              <ArrowLeft size={18} />
            </Link>
            <h1 className="text-lg font-bold">Municipality</h1>
          </div>
        </header>
        <main className="flex-1 px-4 py-5">
          <div className="card text-center">
            <p className="text-sm text-ocean-700">No municipality selected.</p>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <header className="sticky top-0 z-30 bg-ocean-800 text-white shadow-card">
        <div className="flex items-center gap-3 px-4 py-4">
          <Link to="/events" className="grid h-9 w-9 place-items-center rounded-full bg-ocean-700 hover:bg-ocean-600">
            <ArrowLeft size={18} />
          </Link>
          <span className="grid h-8 w-8 place-items-center rounded-full bg-ocean-600">
            <MapPin size={18} />
          </span>
          <h1 className="text-lg font-bold">{municipality} Events</h1>
        </div>
      </header>

      <main className="flex-1 space-y-5 px-4 py-5">
        <section className="card space-y-3">
          <div className="flex items-center gap-2 rounded-xl bg-ocean-50 px-3 py-2.5">
            <SearchIcon size={18} className="text-ocean-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search events in ${municipality}…`}
              className="w-full bg-transparent text-sm text-ocean-900 placeholder:text-ocean-400 focus:outline-none"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Chip active={categoryFilter === 'all'} onClick={() => setCategoryFilter('all')} label="All Categories" />
            {categories.map((c) => (
              <Chip key={c.id} active={categoryFilter === c.id} onClick={() => setCategoryFilter(c.id)} label={c.name} />
            ))}
          </div>
        </section>

        {loading && (
          <div className="card flex items-center gap-3">
            <span className="h-3 w-3 animate-pulse rounded-full bg-ocean-400" />
            <p className="text-sm font-semibold text-ocean-700">Loading events…</p>
          </div>
        )}

        {!loading && events.length === 0 && (
          <div className="card flex flex-col items-center gap-3 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-ocean-50 text-ocean-400">
              <Calendar size={24} />
            </span>
            <p className="text-base font-bold text-ocean-900">No events in {municipality} yet</p>
            <p className="text-sm text-ocean-600">
              Cultural events and community activities for {municipality} will appear here once they are added and reviewed.
            </p>
          </div>
        )}

        {!loading && events.length > 0 && (
          <section className="space-y-3">
            <p className="text-sm text-ocean-600">{events.length} event(s)</p>
            {events.map((e) => (
              <Link
                key={e.id}
                to={`/events/${e.id}`}
                className="card space-y-2 block hover:shadow-cardHover transition active:scale-[0.98]"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-bold text-ocean-900">{e.title}</p>
                  <span className={`pill shrink-0 text-[10px] ${statusClasses(e.status)}`}>
                    {STATUS_LABELS[e.status]}
                  </span>
                </div>
                {e.description && <p className="text-sm text-ocean-700 line-clamp-2">{e.description}</p>}
                <div className="flex flex-wrap gap-2 text-xs text-ocean-600">
                  {e.category && (
                    <span className="flex items-center gap-1">{categoryIcon(e.category.slug)} {e.category.name}</span>
                  )}
                  <span className="flex items-center gap-1"><Calendar size={12} /> {formatEventDate(e.start_at, e.end_at, e.is_all_day)}</span>
                  <span className={`pill text-[10px] ${verificationClasses(e.verification_status)}`}>
                    {VERIFICATION_LABELS[e.verification_status]}
                  </span>
                </div>
              </Link>
            ))}
          </section>
        )}

        <section className="card flex items-start gap-2">
          <Info size={16} className="mt-0.5 shrink-0 text-ocean-500" />
          <p className="text-xs text-ocean-600">
            Events are verified by authorized reviewers. Use the route planner to plan your trip to any event venue.
          </p>
        </section>

        <Link to="/plan" className="card flex items-center gap-3 hover:shadow-cardHover">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-leaf-100 text-leaf-700">
            <Compass size={18} />
          </span>
          <div>
            <p className="text-sm font-semibold text-ocean-900">Plan a Trip</p>
            <p className="text-xs text-ocean-600">Use the route planner to get directions</p>
          </div>
        </Link>
      </main>
    </div>
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
