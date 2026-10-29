import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  MapPin,
  Plus,
  Calendar,
  Palmtree,
  Landmark,
  Utensils,
  Bed,
  Users,
  Archive,
  Trash2,
  Copy,
  Info,
  Sparkles,
  RefreshCw,
  Luggage,
} from 'lucide-react'
import { useAuth } from '../lib/auth'
import {
  fetchMyItineraries,
  fetchArchivedItineraries,
  deleteItinerary,
  archiveItinerary,
  duplicateItinerary,
  restoreItinerary,
  STATUS_LABELS,
  statusClasses,
  MUNICIPALITIES,
} from '../lib/touristPlanner'
import { fetchFeaturedDestinations, fetchCategories, categoryIcon } from '../lib/explore'
import type { TouristItineraryRow, DestinationWithDetails, ExploreCategoryRow } from '../lib/types'

export function TouristPlannerPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [itineraries, setItineraries] = useState<TouristItineraryRow[]>([])
  const [archived, setArchived] = useState<TouristItineraryRow[]>([])
  const [featured, setFeatured] = useState<DestinationWithDetails[]>([])
  const [categories, setCategories] = useState<ExploreCategoryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showArchived, setShowArchived] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    void loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    const [itis, arch, feat, cats] = await Promise.all([
      fetchMyItineraries(),
      fetchArchivedItineraries(),
      fetchFeaturedDestinations(6),
      fetchCategories(),
    ])
    setItineraries(itis)
    setArchived(arch)
    setFeatured(feat)
    setCategories(cats)
    setLoading(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this itinerary permanently? This cannot be undone.')) return
    setActionError(null)
    const { error } = await deleteItinerary(id)
    if (error) {
      setActionError(error)
      return
    }
    await loadData()
  }

  async function handleArchive(id: string) {
    setActionError(null)
    const { error } = await archiveItinerary(id)
    if (error) {
      setActionError(error)
      return
    }
    await loadData()
  }

  async function handleRestore(id: string) {
    setActionError(null)
    const { error } = await restoreItinerary(id)
    if (error) {
      setActionError(error)
      return
    }
    await loadData()
  }

  async function handleDuplicate(id: string) {
    setActionError(null)
    const { success, newId, error } = await duplicateItinerary(id)
    if (!success || !newId) {
      setActionError(error ?? 'Failed to duplicate.')
      return
    }
    navigate(`/tourist-planner/${newId}`)
  }

  if (!user) {
    return (
      <div className="app-shell">
        <header className="sticky top-0 z-30 bg-ocean-800 text-white shadow-card">
          <div className="flex items-center gap-3 px-4 py-4">
            <Link to="/" aria-label="Back to home" className="grid h-9 w-9 place-items-center rounded-full bg-ocean-700 hover:bg-ocean-600">
              <ArrowLeft size={18} />
            </Link>
            <span className="grid h-8 w-8 place-items-center rounded-full bg-ocean-600">
              <Luggage size={18} />
            </span>
            <h1 className="text-lg font-bold">Tourist Trip Planner</h1>
          </div>
        </header>
        <main className="flex-1 space-y-5 px-4 py-5">
          <div className="card flex flex-col items-center gap-3 text-center">
            <Luggage size={32} className="text-ocean-400" />
            <p className="font-bold text-ocean-900">Sign in to start planning</p>
            <p className="text-sm text-ocean-600">
              Create and save multi-day itineraries for your Marinduque trip. Sign in to get started.
            </p>
            <Link to="/auth" className="btn-primary w-full">Sign In / Sign Up</Link>
          </div>

          <section className="space-y-3">
            <h2 className="section-title">Suggested Places to Visit</h2>
            {featured.length === 0 ? (
              <div className="card flex flex-col items-center gap-2 text-center">
                <Info size={24} className="text-ocean-400" />
                <p className="text-sm font-bold text-ocean-900">No destinations yet</p>
                <p className="text-sm text-ocean-600">Verified destinations will appear here once available.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {featured.map((d) => (
                  <Link
                    key={d.id}
                    to={`/explore/destination/${d.id}`}
                    className="card space-y-1 block hover:shadow-cardHover transition active:scale-[0.98]"
                  >
                    <p className="font-bold text-ocean-900">{d.name}</p>
                    {d.municipality && (
                      <p className="text-sm text-ocean-600 flex items-center gap-1">
                        <MapPin size={12} /> {d.municipality}
                      </p>
                    )}
                    {d.description && (
                      <p className="text-sm text-ocean-700 line-clamp-2">{d.description}</p>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </section>

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

          <section className="space-y-3">
            <h2 className="section-title">Browse Categories</h2>
            <div className="grid grid-cols-2 gap-3">
              {categories.map((c) => (
                <Link
                  key={c.id}
                  to={`/explore/category/${c.id}`}
                  className="card flex flex-col items-center gap-2 text-center hover:shadow-cardHover transition active:scale-95"
                >
                  <span className="text-2xl">{categoryIcon(c.slug)}</span>
                  <p className="text-sm font-bold text-ocean-900">{c.name}</p>
                </Link>
              ))}
            </div>
          </section>
        </main>
      </div>
    )
  }

  const displayItineraries = showArchived ? archived : itineraries

  return (
    <div className="app-shell">
      <header className="sticky top-0 z-30 bg-ocean-800 text-white shadow-card">
        <div className="flex items-center gap-3 px-4 py-4">
          <Link to="/" aria-label="Back to home" className="grid h-9 w-9 place-items-center rounded-full bg-ocean-700 hover:bg-ocean-600">
            <ArrowLeft size={18} />
          </Link>
          <span className="grid h-8 w-8 place-items-center rounded-full bg-ocean-600">
            <Luggage size={18} />
          </span>
          <h1 className="text-lg font-bold">Tourist Trip Planner</h1>
          <button
            onClick={() => void loadData()}
            className="ml-auto grid h-9 w-9 place-items-center rounded-full bg-ocean-700 hover:bg-ocean-600"
            aria-label="Refresh"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </header>

      <main className="flex-1 space-y-5 px-4 py-5">
        {/* Create New Trip */}
        <Link to="/tourist-planner/new" className="btn-primary w-full">
          <Plus size={20} /> Create New Trip
        </Link>

        {actionError && (
          <div className="card border border-red-200 bg-red-50">
            <p className="text-sm text-red-700">{actionError}</p>
          </div>
        )}

        {/* My Itineraries / Archived toggle */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="section-title">{showArchived ? 'Archived Itineraries' : 'My Itineraries'}</h2>
            <button
              onClick={() => setShowArchived(!showArchived)}
              className="text-xs font-semibold text-ocean-600 hover:text-ocean-800"
            >
              {showArchived ? 'Show Active' : `Archived (${archived.length})`}
            </button>
          </div>

          {loading ? (
            <div className="card flex items-center gap-3">
              <span className="h-3 w-3 animate-pulse rounded-full bg-ocean-400" />
              <p className="text-sm font-semibold text-ocean-700">Loading itineraries…</p>
            </div>
          ) : displayItineraries.length === 0 ? (
            <div className="card flex flex-col items-center gap-2 text-center">
              <Calendar size={24} className="text-ocean-400" />
              <p className="text-sm font-bold text-ocean-900">
                {showArchived ? 'No archived itineraries' : 'No itineraries yet'}
              </p>
              <p className="text-sm text-ocean-600">
                {showArchived ? 'Archived trips will appear here.' : 'Create your first Marinduque trip plan to get started.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {displayItineraries.map((iti) => (
                <ItineraryCard
                  key={iti.id}
                  iti={iti}
                  isArchived={showArchived}
                  onDelete={() => void handleDelete(iti.id)}
                  onArchive={() => void handleArchive(iti.id)}
                  onRestore={() => void handleRestore(iti.id)}
                  onDuplicate={() => void handleDuplicate(iti.id)}
                />
              ))}
            </div>
          )}
        </section>

        {/* Suggested Places to Visit */}
        <section className="space-y-3">
          <h2 className="section-title flex items-center gap-2">
            <Sparkles size={16} className="text-terra-600" /> Suggested Places to Visit
          </h2>
          {featured.length === 0 ? (
            <div className="card flex flex-col items-center gap-2 text-center">
              <Info size={24} className="text-ocean-400" />
              <p className="text-sm text-ocean-600">Verified destinations will appear here once available.</p>
            </div>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-2">
              {featured.map((d) => (
                <Link
                  key={d.id}
                  to={`/explore/destination/${d.id}`}
                  className="card w-44 shrink-0 space-y-1 hover:shadow-cardHover transition active:scale-95"
                >
                  <p className="font-bold text-sm text-ocean-900 line-clamp-1">{d.name}</p>
                  {d.municipality && (
                    <p className="text-xs text-ocean-600 flex items-center gap-1">
                      <MapPin size={10} /> {d.municipality}
                    </p>
                  )}
                  {d.description && (
                    <p className="text-xs text-ocean-700 line-clamp-2">{d.description}</p>
                  )}
                </Link>
              ))}
            </div>
          )}
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

        {/* Trip Categories */}
        <section className="space-y-3">
          <h2 className="section-title">Trip Ideas by Category</h2>
          <div className="grid grid-cols-2 gap-3">
            {categories.length > 0 ? (
              categories.map((c) => (
                <Link
                  key={c.id}
                  to={`/explore/category/${c.id}`}
                  className="card flex flex-col items-center gap-2 text-center hover:shadow-cardHover transition active:scale-95"
                >
                  <span className="text-2xl">{categoryIcon(c.slug)}</span>
                  <p className="text-sm font-bold text-ocean-900">{c.name}</p>
                </Link>
              ))
            ) : (
              <>
                <PlaceholderCategory icon={Palmtree} label="Beach & Nature" to="/explore" />
                <PlaceholderCategory icon={Landmark} label="Historical & Cultural" to="/explore" />
                <PlaceholderCategory icon={Utensils} label="Food & Local" to="/explore" />
                <PlaceholderCategory icon={Bed} label="Accommodation" to="/explore" />
              </>
            )}
          </div>
        </section>

        <section className="card flex items-start gap-2">
          <Info size={16} className="mt-0.5 shrink-0 text-ocean-500" />
          <p className="text-xs text-ocean-600">
            Build multi-day itineraries with verified destinations, transport routes, and cost estimates.
            Information labeled as verified comes from reviewed data; estimates are clearly marked.
            No reservations or bookings are made through this planner.
          </p>
        </section>
      </main>
    </div>
  )
}

function PlaceholderCategory({ icon: Icon, label, to }: { icon: typeof Palmtree; label: string; to: string }) {
  return (
    <Link to={to} className="card flex flex-col items-center gap-2 text-center hover:shadow-cardHover transition active:scale-95">
      <span className="grid h-12 w-12 place-items-center rounded-full bg-ocean-50 text-ocean-700">
        <Icon size={22} />
      </span>
      <p className="text-sm font-bold text-ocean-900">{label}</p>
    </Link>
  )
}

function ItineraryCard({
  iti,
  isArchived,
  onDelete,
  onArchive,
  onRestore,
  onDuplicate,
}: {
  iti: TouristItineraryRow
  isArchived: boolean
  onDelete: () => void
  onArchive: () => void
  onRestore: () => void
  onDuplicate: () => void
}) {
  const startDate = iti.start_date ? new Date(iti.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null
  const endDate = iti.end_date ? new Date(iti.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null

  return (
    <div className="card space-y-3">
      <Link to={`/tourist-planner/${iti.id}`} className="block space-y-1">
        <div className="flex items-start justify-between gap-2">
          <p className="font-bold text-ocean-900">{iti.title}</p>
          <span className={`pill shrink-0 text-[10px] ${statusClasses(iti.status)}`}>
            {STATUS_LABELS[iti.status]}
          </span>
        </div>
        {iti.description && (
          <p className="text-sm text-ocean-700 line-clamp-2">{iti.description}</p>
        )}
        <div className="flex flex-wrap gap-3 text-xs text-ocean-600">
          {startDate && (
            <span className="flex items-center gap-1"><Calendar size={12} /> {startDate}{endDate && endDate !== startDate ? ` – ${endDate}` : ''}</span>
          )}
          <span className="flex items-center gap-1"><Users size={12} /> {iti.traveler_count} traveler{iti.traveler_count > 1 ? 's' : ''}</span>
          <span className="text-ocean-400">Updated {new Date(iti.updated_at).toLocaleDateString()}</span>
        </div>
      </Link>
      <div className="flex flex-wrap gap-2 border-t border-sand-200 pt-3">
        <Link to={`/tourist-planner/${iti.id}`} className="btn-secondary text-xs px-3 py-1.5">
          Open
        </Link>
        <button onClick={onDuplicate} className="btn-ghost text-xs px-3 py-1.5">
          <Copy size={14} /> Duplicate
        </button>
        {isArchived ? (
          <button onClick={onRestore} className="btn-ghost text-xs px-3 py-1.5">
            <Archive size={14} /> Restore
          </button>
        ) : (
          <button onClick={onArchive} className="btn-ghost text-xs px-3 py-1.5">
            <Archive size={14} /> Archive
          </button>
        )}
        <button onClick={onDelete} className="btn-ghost text-xs px-3 py-1.5 text-red-600 hover:bg-red-50">
          <Trash2 size={14} /> Delete
        </button>
      </div>
    </div>
  )
}
