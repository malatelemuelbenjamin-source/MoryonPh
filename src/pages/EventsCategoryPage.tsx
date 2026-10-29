import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Search as SearchIcon,
  MapPin,
  Calendar,
  Landmark,
  Users,
  Music,
  Info,
  Compass,
} from 'lucide-react'
import {
  fetchEventCategories,
  fetchEventsByCategory,
  searchEvents,
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

const CATEGORY_ICONS: Record<string, typeof Landmark> = {
  culture_heritage: Landmark,
  community_education: Users,
  tourism_entertainment: Music,
}

export function EventsCategoryPage() {
  const { categoryId } = useParams<{ categoryId: string }>()
  const [category, setCategory] = useState<EventCategoryRow | null>(null)
  const [events, setEvents] = useState<CulturalEventWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!categoryId) return
    void (async () => {
      const cats = await fetchEventCategories()
      setCategory(cats.find((c) => c.id === categoryId) ?? null)
      setEvents(await fetchEventsByCategory(categoryId))
      setLoading(false)
    })()
  }, [categoryId])

  useEffect(() => {
    if (!categoryId) return
    if (search.trim()) {
      void (async () => {
        setEvents(await searchEvents(search, undefined, categoryId))
      })()
    } else {
      void (async () => {
        setEvents(await fetchEventsByCategory(categoryId))
      })()
    }
  }, [search, categoryId])

  const Icon = category ? (CATEGORY_ICONS[category.slug] ?? Calendar) : Calendar

  return (
    <div className="app-shell">
      <header className="sticky top-0 z-30 bg-ocean-800 text-white shadow-card">
        <div className="flex items-center gap-3 px-4 py-4">
          <Link to="/events" className="grid h-9 w-9 place-items-center rounded-full bg-ocean-700 hover:bg-ocean-600">
            <ArrowLeft size={18} />
          </Link>
          <span className="grid h-8 w-8 place-items-center rounded-full bg-ocean-600">
            <Icon size={18} />
          </span>
          <h1 className="text-lg font-bold truncate">{category?.name ?? 'Category'}</h1>
        </div>
      </header>

      <main className="flex-1 space-y-5 px-4 py-5">
        {category?.description && (
          <section className="card">
            <p className="text-sm text-ocean-700">{category.description}</p>
          </section>
        )}

        <section className="card space-y-3">
          <div className="flex items-center gap-2 rounded-xl bg-ocean-50 px-3 py-2.5">
            <SearchIcon size={18} className="text-ocean-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search events…"
              className="w-full bg-transparent text-sm text-ocean-900 placeholder:text-ocean-400 focus:outline-none"
            />
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
              <Info size={24} />
            </span>
            <p className="text-base font-bold text-ocean-900">No events in this category yet</p>
            <p className="text-sm text-ocean-600">
              Events will appear here once they are added and reviewed.
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
                  {e.municipality && (
                    <span className="flex items-center gap-1"><MapPin size={12} /> {e.municipality}</span>
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
