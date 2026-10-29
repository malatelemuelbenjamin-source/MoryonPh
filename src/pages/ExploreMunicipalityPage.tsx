import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  MapPin,
  Search as SearchIcon,
  Palmtree,
  Info,
  Compass,
} from 'lucide-react'
import {
  fetchDestinationsByMunicipality,
  fetchCategories,
  searchDestinations,
  categoryIcon,
  verificationClasses,
  VERIFICATION_LABELS,
} from '../lib/explore'
import { formatRelativeTime } from '../lib/labels'
import type {
  ExploreCategoryRow,
  DestinationWithDetails,
} from '../lib/types'

export function ExploreMunicipalityPage() {
  const { municipality } = useParams<{ municipality: string }>()
  const [destinations, setDestinations] = useState<DestinationWithDetails[]>([])
  const [categories, setCategories] = useState<ExploreCategoryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')

  useEffect(() => {
    if (!municipality) return
    void (async () => {
      const [dests, cats] = await Promise.all([
        fetchDestinationsByMunicipality(municipality),
        fetchCategories(),
      ])
      setDestinations(dests)
      setCategories(cats)
      setLoading(false)
    })()
  }, [municipality])

  async function handleSearch() {
    if (!municipality) return
    const results = await searchDestinations(search, municipality, categoryFilter)
    setDestinations(results)
  }

  useEffect(() => {
    if (!municipality) return
    if (search.trim() || categoryFilter !== 'all') {
      void handleSearch()
    } else {
      void (async () => {
        setDestinations(await fetchDestinationsByMunicipality(municipality))
      })()
    }
  }, [search, categoryFilter, municipality])

  if (!municipality) {
    return (
      <div className="app-shell">
        <header className="sticky top-0 z-30 bg-ocean-800 text-white shadow-card">
          <div className="flex items-center gap-3 px-4 py-4">
            <Link to="/explore" className="grid h-9 w-9 place-items-center rounded-full bg-ocean-700">
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
          <Link to="/explore" className="grid h-9 w-9 place-items-center rounded-full bg-ocean-700 hover:bg-ocean-600">
            <ArrowLeft size={18} />
          </Link>
          <span className="grid h-8 w-8 place-items-center rounded-full bg-ocean-600">
            <MapPin size={18} />
          </span>
          <h1 className="text-lg font-bold">{municipality}, Marinduque</h1>
        </div>
      </header>

      <main className="flex-1 space-y-5 px-4 py-5">
        {/* Search and filter */}
        <section className="card space-y-3">
          <div className="flex items-center gap-2 rounded-xl bg-ocean-50 px-3 py-2.5">
            <SearchIcon size={18} className="text-ocean-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search destinations in ${municipality}…`}
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

        {/* Loading */}
        {loading && (
          <div className="card flex items-center gap-3">
            <span className="h-3 w-3 animate-pulse rounded-full bg-ocean-400" />
            <p className="text-sm font-semibold text-ocean-700">Loading destinations…</p>
          </div>
        )}

        {/* Empty state */}
        {!loading && destinations.length === 0 && (
          <div className="card flex flex-col items-center gap-3 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-ocean-50 text-ocean-400">
              <Palmtree size={24} />
            </span>
            <p className="text-base font-bold text-ocean-900">No destinations in {municipality} yet</p>
            <p className="text-sm text-ocean-600">
              Verified destinations for {municipality} will appear here once they are added and reviewed.
            </p>
          </div>
        )}

        {/* Destinations */}
        {!loading && destinations.length > 0 && (
          <section className="space-y-3">
            <p className="text-sm text-ocean-600">{destinations.length} destination(s)</p>
            {destinations.map((d) => (
              <Link
                key={d.id}
                to={`/explore/destination/${d.id}`}
                className="card space-y-2 block hover:shadow-cardHover transition active:scale-[0.98]"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-bold text-ocean-900">{d.name}</p>
                  <span className={`pill shrink-0 text-[10px] ${verificationClasses(d.verification_status)}`}>
                    {VERIFICATION_LABELS[d.verification_status]}
                  </span>
                </div>
                {d.description && (
                  <p className="text-sm text-ocean-700 line-clamp-2">{d.description}</p>
                )}
                <div className="flex flex-wrap gap-2 text-xs text-ocean-600">
                  {d.category && (
                    <span className="flex items-center gap-1">
                      {categoryIcon(d.category.slug)} {d.category.name}
                    </span>
                  )}
                  <span className="text-ocean-400">Added {formatRelativeTime(d.created_at)}</span>
                </div>
              </Link>
            ))}
          </section>
        )}

        {/* Info */}
        <section className="card flex items-start gap-2">
          <Info size={16} className="mt-0.5 shrink-0 text-ocean-500" />
          <p className="text-xs text-ocean-600">
            Destinations are verified by authorized reviewers. Pending destinations are labeled
            accordingly. Use the route planner to plan your trip to any destination.
          </p>
        </section>

        {/* Plan a trip */}
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
