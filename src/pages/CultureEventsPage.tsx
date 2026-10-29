import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  Search as SearchIcon,
  Calendar,
  MapPin,
  Landmark,
  Users,
  Music,
  Info,
  RefreshCw,
  Clock,
  Sparkles,
} from 'lucide-react'
import {
  MUNICIPALITIES,
  fetchEventCategories,
  fetchEvents,
  searchEvents,
  categoryIcon,
  verificationClasses,
  VERIFICATION_LABELS,
  statusClasses,
  STATUS_LABELS,
  formatEventDate,
  isHappeningToday,
  isThisWeekend,
  isUpcoming,
  isPast,
} from '../lib/cultureEvents'
import type {
  EventCategoryRow,
  CulturalEventWithDetails,
} from '../lib/types'

const CATEGORY_ICONS: Record<string, typeof Landmark> = {
  culture_heritage: Landmark,
  community_education: Users,
  tourism_entertainment: Music,
}

export function CultureEventsPage() {
  const [categories, setCategories] = useState<EventCategoryRow[]>([])
  const [events, setEvents] = useState<CulturalEventWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [muniFilter, setMuniFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [searchResults, setSearchResults] = useState<CulturalEventWithDetails[] | null>(null)

  useEffect(() => {
    void (async () => {
      const [cats, evts] = await Promise.all([fetchEventCategories(), fetchEvents(50)])
      setCategories(cats)
      setEvents(evts)
      setLoading(false)
    })()
  }, [])

  async function handleRefresh() {
    setRefreshing(true)
    setEvents(await fetchEvents(50))
    setRefreshing(false)
  }

  useEffect(() => {
    if (search.trim() || muniFilter !== 'all' || categoryFilter !== 'all') {
      void (async () => {
        const results = await searchEvents(search, muniFilter, categoryFilter)
        setSearchResults(results)
      })()
    } else {
      setSearchResults(null)
    }
  }, [search, muniFilter, categoryFilter])

  const today = events.filter((e) => isHappeningToday(e.start_at, e.end_at))
  const weekend = events.filter((e) => isThisWeekend(e.start_at) && isUpcoming(e.start_at))
  const upcoming = events.filter((e) => isUpcoming(e.start_at))
  const pastEvents = events.filter((e) => isPast(e.end_at))

  return (
    <div className="app-shell">
      <header className="sticky top-0 z-30 bg-ocean-800 text-white shadow-card">
        <div className="flex items-center gap-3 px-4 py-4">
          <Link to="/" className="grid h-9 w-9 place-items-center rounded-full bg-ocean-700 hover:bg-ocean-600">
            <ArrowLeft size={18} />
          </Link>
          <span className="grid h-8 w-8 place-items-center rounded-full bg-ocean-600">
            <Calendar size={18} />
          </span>
          <h1 className="text-lg font-bold">Culture & Events</h1>
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
              placeholder="Search events, festivals, venues…"
              className="w-full bg-transparent text-sm text-ocean-900 placeholder:text-ocean-400 focus:outline-none"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Chip active={muniFilter === 'all'} onClick={() => setMuniFilter('all')} label="All Municipalities" />
            {MUNICIPALITIES.map((m) => (
              <Chip key={m} active={muniFilter === m} onClick={() => setMuniFilter(m)} label={m} />
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Chip active={categoryFilter === 'all'} onClick={() => setCategoryFilter('all')} label="All Categories" />
            {categories.map((c) => (
              <Chip key={c.id} active={categoryFilter === c.id} onClick={() => setCategoryFilter(c.id)} label={c.name} />
            ))}
          </div>
        </section>

        <button type="button" onClick={handleRefresh} disabled={refreshing} className="btn-secondary w-full">
          <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>

        {loading && (
          <div className="card flex items-center gap-3">
            <span className="h-3 w-3 animate-pulse rounded-full bg-ocean-400" />
            <p className="text-sm font-semibold text-ocean-700">Loading events…</p>
          </div>
        )}

        {searchResults !== null && !loading && (
          <section className="space-y-3">
            <h2 className="section-title">Search Results ({searchResults.length})</h2>
            {searchResults.length === 0 ? (
              <div className="card flex flex-col items-center gap-2 text-center">
                <SearchIcon size={24} className="text-ocean-400" />
                <p className="text-sm font-bold text-ocean-900">No events found</p>
                <p className="text-sm text-ocean-600">Try different keywords or filters.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {searchResults.map((e) => <EventCard key={e.id} event={e} />)}
              </div>
            )}
          </section>
        )}

        {searchResults === null && !loading && (
          <>
            {today.length > 0 && (
              <section className="space-y-3">
                <h2 className="section-title flex items-center gap-2">
                  <Clock size={16} className="text-leaf-600" /> Happening Today
                </h2>
                <div className="grid grid-cols-1 gap-3">
                  {today.map((e) => <EventCard key={e.id} event={e} />)}
                </div>
              </section>
            )}

            {weekend.length > 0 && (
              <section className="space-y-3">
                <h2 className="section-title">Events This Weekend</h2>
                <div className="grid grid-cols-1 gap-3">
                  {weekend.map((e) => <EventCard key={e.id} event={e} />)}
                </div>
              </section>
            )}

            {upcoming.length > 0 && (
              <section className="space-y-3">
                <h2 className="section-title flex items-center gap-2">
                  <Sparkles size={16} className="text-terra-600" /> Upcoming Events
                </h2>
                <div className="grid grid-cols-1 gap-3">
                  {upcoming.map((e) => <EventCard key={e.id} event={e} />)}
                </div>
              </section>
            )}

            <section className="space-y-3">
              <h2 className="section-title">Browse by Category</h2>
              <div className="grid grid-cols-2 gap-3">
                {categories.map((c) => {
                  const Icon = CATEGORY_ICONS[c.slug] ?? Calendar
                  return (
                    <Link
                      key={c.id}
                      to={`/events/category/${c.id}`}
                      className="card flex flex-col items-center gap-2 text-center hover:shadow-cardHover transition active:scale-95"
                    >
                      <span className="grid h-12 w-12 place-items-center rounded-full bg-ocean-50 text-ocean-700">
                        <Icon size={22} />
                      </span>
                      <p className="text-sm font-bold text-ocean-900">{c.name}</p>
                      {c.description && (
                        <p className="text-[10px] text-ocean-600 line-clamp-2">{c.description}</p>
                      )}
                    </Link>
                  )
                })}
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="section-title">Explore by Municipality</h2>
              <div className="grid grid-cols-2 gap-3">
                {MUNICIPALITIES.map((m) => (
                  <Link
                    key={m}
                    to={`/events/municipality/${m}`}
                    className="card flex items-center gap-3 hover:shadow-cardHover transition active:scale-95"
                  >
                    <span className="grid h-10 w-10 place-items-center rounded-full bg-terra-100 text-terra-700">
                      <MapPin size={18} />
                    </span>
                    <p className="text-sm font-bold text-ocean-900">{m}</p>
                  </Link>
                ))}
              </div>
            </section>

            {events.length === 0 && (
              <div className="card flex flex-col items-center gap-2 text-center">
                <Info size={24} className="text-ocean-400" />
                <p className="text-sm font-bold text-ocean-900">No events yet</p>
                <p className="text-sm text-ocean-600">
                  Cultural events and community activities will appear here once they are added and reviewed.
                </p>
              </div>
            )}

            {pastEvents.length > 0 && (
              <section className="space-y-3">
                <h2 className="section-title">Past Events</h2>
                <div className="grid grid-cols-1 gap-3">
                  {pastEvents.slice(0, 10).map((e) => <EventCard key={e.id} event={e} />)}
                </div>
              </section>
            )}
          </>
        )}

        <section className="card flex items-start gap-2">
          <Info size={16} className="mt-0.5 shrink-0 text-ocean-500" />
          <p className="text-xs text-ocean-600">
            Events are reviewed by authorized MoryonGo reviewers before publishing.
            Pending submissions are labeled and not yet verified. If you find incorrect
            information, use the "Report" button on any event page.
          </p>
        </section>
      </main>
    </div>
  )
}

function EventCard({ event }: { event: CulturalEventWithDetails }) {
  return (
    <Link
      to={`/events/${event.id}`}
      className="card space-y-2 block hover:shadow-cardHover transition active:scale-[0.98]"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-bold text-ocean-900">{event.title}</p>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className={`pill text-[10px] ${statusClasses(event.status)}`}>
            {STATUS_LABELS[event.status]}
          </span>
        </div>
      </div>
      {event.description && (
        <p className="text-sm text-ocean-700 line-clamp-2">{event.description}</p>
      )}
      <div className="flex flex-wrap gap-2 text-xs text-ocean-600">
        {event.category && (
          <span className="flex items-center gap-1">{categoryIcon(event.category.slug)} {event.category.name}</span>
        )}
        {event.municipality && (
          <span className="flex items-center gap-1"><MapPin size={12} /> {event.municipality}</span>
        )}
        <span className="flex items-center gap-1"><Calendar size={12} /> {formatEventDate(event.start_at, event.end_at, event.is_all_day)}</span>
        <span className={`pill text-[10px] ${verificationClasses(event.verification_status)}`}>
          {VERIFICATION_LABELS[event.verification_status]}
        </span>
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
