import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  Search as SearchIcon,
  MapPin,
  Palmtree,
  Landmark,
  Utensils,
  Bed,
  Map as MapIcon,
  RefreshCw,
  Info,
  Sparkles,
} from 'lucide-react'
import {
  MUNICIPALITIES,
  fetchCategories,
  fetchFeaturedDestinations,
  fetchDestinations,
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

const CATEGORY_ICONS: Record<string, typeof Palmtree> = {
  nature_outdoor: Palmtree,
  historical_cultural: Landmark,
  food_dining: Utensils,
  accommodation_recreation: Bed,
  other_places: MapIcon,
}

export function ExploreMarinduquePage() {
  const [categories, setCategories] = useState<ExploreCategoryRow[]>([])
  const [featured, setFeatured] = useState<DestinationWithDetails[]>([])
  const [recent, setRecent] = useState<DestinationWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState<DestinationWithDetails[] | null>(null)
  const [muniFilter, setMuniFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')

  useEffect(() => {
    void (async () => {
      const [cats, feat, dests] = await Promise.all([
        fetchCategories(),
        fetchFeaturedDestinations(10),
        fetchDestinations(20),
      ])
      setCategories(cats)
      setFeatured(feat)
      setRecent(dests)
      setLoading(false)
    })()
  }, [])

  async function handleRefresh() {
    setRefreshing(true)
    const [feat, dests] = await Promise.all([
      fetchFeaturedDestinations(10),
      fetchDestinations(20),
    ])
    setFeatured(feat)
    setRecent(dests)
    setRefreshing(false)
  }

  async function handleSearch() {
    if (!search.trim() && muniFilter === 'all' && categoryFilter === 'all') {
      setSearchResults(null)
      return
    }
    const results = await searchDestinations(search, muniFilter, categoryFilter)
    setSearchResults(results)
  }

  useEffect(() => {
    if (search.trim() || muniFilter !== 'all' || categoryFilter !== 'all') {
      void handleSearch()
    } else {
      setSearchResults(null)
    }
  }, [search, muniFilter, categoryFilter])

  return (
    <div className="app-shell">
      <header className="sticky top-0 z-30 bg-ocean-800 text-white shadow-card">
        <div className="flex items-center gap-3 px-4 py-4">
          <Link to="/" aria-label="Back to home" className="grid h-9 w-9 place-items-center rounded-full bg-ocean-700 hover:bg-ocean-600">
            <ArrowLeft size={18} />
          </Link>
          <span className="grid h-8 w-8 place-items-center rounded-full bg-ocean-600">
            <Palmtree size={18} />
          </span>
          <h1 className="text-lg font-bold">Explore Marinduque</h1>
        </div>
      </header>

      <main className="flex-1 space-y-5 px-4 py-5">
        {/* Search bar */}
        <section className="card space-y-3">
          <div className="flex items-center gap-2 rounded-xl bg-ocean-50 px-3 py-2.5">
            <SearchIcon size={18} className="text-ocean-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search destinations, beaches, restaurants…"
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

        {/* Refresh */}
        <button type="button" onClick={handleRefresh} disabled={refreshing} className="btn-secondary w-full">
          <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>

        {/* Loading */}
        {loading && (
          <div className="card flex items-center gap-3">
            <span className="h-3 w-3 animate-pulse rounded-full bg-ocean-400" />
            <p className="text-sm font-semibold text-ocean-700">Loading destinations…</p>
          </div>
        )}

        {/* Search results */}
        {searchResults !== null && !loading && (
          <section className="space-y-3">
            <h2 className="section-title">Search Results ({searchResults.length})</h2>
            {searchResults.length === 0 ? (
              <div className="card flex flex-col items-center gap-2 text-center">
                <SearchIcon size={24} className="text-ocean-400" />
                <p className="text-sm font-bold text-ocean-900">No destinations found</p>
                <p className="text-sm text-ocean-600">Try different keywords or filters.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {searchResults.map((d) => (
                  <DestinationCard key={d.id} dest={d} />
                ))}
              </div>
            )}
          </section>
        )}

        {/* Default browse view */}
        {searchResults === null && !loading && (
          <>
            {/* Featured */}
            {featured.length > 0 && (
              <section className="space-y-3">
                <h2 className="section-title flex items-center gap-2">
                  <Sparkles size={16} className="text-terra-600" /> Featured Destinations
                </h2>
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {featured.map((d) => (
                    <FeaturedCard key={d.id} dest={d} />
                  ))}
                </div>
              </section>
            )}

            {/* Browse by Category */}
            <section className="space-y-3">
              <h2 className="section-title">Browse by Category</h2>
              <div className="grid grid-cols-2 gap-3">
                {categories.map((c) => {
                  const Icon = CATEGORY_ICONS[c.slug] ?? MapIcon
                  return (
                    <Link
                      key={c.id}
                      to={`/explore/category/${c.id}`}
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

            {/* Explore by Municipality */}
            <section className="space-y-3">
              <h2 className="section-title">Explore by Municipality</h2>
              <div className="grid grid-cols-2 gap-3">
                {MUNICIPALITIES.map((m) => (
                  <Link
                    key={m}
                    to={`/explore/municipality/${m}`}
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

            {/* Recently Added */}
            <section className="space-y-3">
              <h2 className="section-title">Recently Added</h2>
              {recent.length === 0 ? (
                <div className="card flex flex-col items-center gap-2 text-center">
                  <Info size={24} className="text-ocean-400" />
                  <p className="text-sm font-bold text-ocean-900">No destinations yet</p>
                  <p className="text-sm text-ocean-600">
                    Verified destinations will appear here once they are added and reviewed.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {recent.map((d) => (
                    <DestinationCard key={d.id} dest={d} />
                  ))}
                </div>
              )}
            </section>
          </>
        )}

        {/* Info notice */}
        <section className="card flex items-start gap-2">
          <Info size={16} className="mt-0.5 shrink-0 text-ocean-500" />
          <p className="text-xs text-ocean-600">
            Destinations are reviewed by authorized MoryonGo reviewers before publishing.
            Pending submissions are labeled and not yet verified. If you find incorrect
            information, use the "Report" button on any destination page.
          </p>
        </section>
      </main>
    </div>
  )
}

// ---- Destination Card ----------------------------------------------------

function DestinationCard({ dest }: { dest: DestinationWithDetails }) {
  return (
    <Link
      to={`/explore/destination/${dest.id}`}
      className="card space-y-2 block hover:shadow-cardHover transition active:scale-[0.98]"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-bold text-ocean-900">{dest.name}</p>
        <span className={`pill shrink-0 text-[10px] ${verificationClasses(dest.verification_status)}`}>
          {VERIFICATION_LABELS[dest.verification_status]}
        </span>
      </div>

      {dest.description && (
        <p className="text-sm text-ocean-700 line-clamp-2">{dest.description}</p>
      )}

      <div className="flex flex-wrap gap-2 text-xs text-ocean-600">
        {dest.category && (
          <span className="flex items-center gap-1">
            {categoryIcon(dest.category.slug)} {dest.category.name}
          </span>
        )}
        {dest.municipality && (
          <span className="flex items-center gap-1"><MapPin size={12} /> {dest.municipality}</span>
        )}
        <span className="text-ocean-400">Added {formatRelativeTime(dest.created_at)}</span>
      </div>
    </Link>
  )
}

// ---- Featured Card (horizontal scroll) -----------------------------------

function FeaturedCard({ dest }: { dest: DestinationWithDetails }) {
  return (
    <Link
      to={`/explore/destination/${dest.id}`}
      className="card min-w-[200px] space-y-2 block hover:shadow-cardHover transition active:scale-[0.98]"
    >
      <p className="font-bold text-ocean-900 line-clamp-1">{dest.name}</p>
      {dest.description && (
        <p className="text-xs text-ocean-700 line-clamp-2">{dest.description}</p>
      )}
      <div className="flex flex-wrap gap-2 text-xs text-ocean-600">
        {dest.category && (
          <span className="flex items-center gap-1">{categoryIcon(dest.category.slug)}</span>
        )}
        {dest.municipality && (
          <span className="flex items-center gap-1"><MapPin size={12} /> {dest.municipality}</span>
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
