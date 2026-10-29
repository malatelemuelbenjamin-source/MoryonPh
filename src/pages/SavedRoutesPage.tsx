import { useEffect, useState, useCallback, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Plus,
  Star,
  StarOff,
  Edit2,
  Trash2,
  Compass,
  Loader2,
  AlertCircle,
  X,
  Check,
  Filter,
  Briefcase,
  GraduationCap,
  Users,
  Palmtree,
  Route as RouteIcon,
  RefreshCw,
  Share2,
} from 'lucide-react'
import { useAuth } from '../lib/auth'
import {
  fetchSavedRoutes,
  updateSavedRoute,
  toggleRouteFavorite,
  deleteSavedRoute,
  ROUTE_CATEGORY_LABELS,
} from '../lib/savedRoutes'
import type { SavedRouteWithDetails, SavedRouteCategory } from '../lib/types'

type LoadState = 'loading' | 'done' | 'error'
type SortMode = 'recent' | 'alphabetical' | 'favorites_first'

const CATEGORY_ICON: Record<SavedRouteCategory, typeof Briefcase> = {
  commute: Compass,
  school: GraduationCap,
  work: Briefcase,
  family: Users,
  tourism: Palmtree,
  other: RouteIcon,
}

const FILTER_CATEGORIES: { key: 'all' | 'favorites' | SavedRouteCategory; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'favorites', label: 'Paboritong Biyahe' },
  { key: 'commute', label: 'Commute' },
  { key: 'school', label: 'School' },
  { key: 'work', label: 'Work' },
  { key: 'family', label: 'Family' },
  { key: 'tourism', label: 'Tourism' },
  { key: 'other', label: 'Other' },
]

export function SavedRoutesPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [routes, setRoutes] = useState<SavedRouteWithDetails[]>([])
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [filter, setFilter] = useState<'all' | 'favorites' | SavedRouteCategory>('all')
  const [sortMode, setSortMode] = useState<SortMode>('recent')
  const [editingRoute, setEditingRoute] = useState<SavedRouteWithDetails | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<SavedRouteWithDetails | null>(null)

  const loadRoutes = useCallback(async () => {
    setLoadState('loading')
    const data = await fetchSavedRoutes()
    setRoutes(data)
    setLoadState('done')
  }, [])

  useEffect(() => {
    if (!user) {
      setLoadState('done')
      return
    }
    void loadRoutes().catch(() => setLoadState('error'))
  }, [user, loadRoutes])

  const filteredRoutes = useMemo(() => {
    let list = routes
    if (filter === 'favorites') {
      list = list.filter((r) => r.is_favorite)
    } else if (filter !== 'all') {
      list = list.filter((r) => r.category === filter)
    }
    const sorted = [...list]
    if (sortMode === 'alphabetical') {
      sorted.sort((a, b) => {
        const an = a.custom_name ?? a.route?.route_name ?? ''
        const bn = b.custom_name ?? b.route?.route_name ?? ''
        return an.localeCompare(bn)
      })
    } else if (sortMode === 'favorites_first') {
      sorted.sort((a, b) => Number(b.is_favorite) - Number(a.is_favorite))
    } else {
      sorted.sort((a, b) => b.created_at.localeCompare(a.created_at))
    }
    return sorted
  }, [routes, filter, sortMode])

  const handleToggleFavorite = async (route: SavedRouteWithDetails) => {
    const ok = await toggleRouteFavorite(route.id, route.is_favorite)
    if (ok) {
      setRoutes((prev) =>
        prev.map((r) => (r.id === route.id ? { ...r, is_favorite: !r.is_favorite } : r)),
      )
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    const ok = await deleteSavedRoute(deleteTarget.id)
    if (ok) {
      setRoutes((prev) => prev.filter((r) => r.id !== deleteTarget.id))
    }
    setDeleteTarget(null)
  }

  const handleReopen = (route: SavedRouteWithDetails) => {
    if (route.origin_location_id && route.destination_location_id) {
      navigate(`/plan?from=${route.origin_location_id}&to=${route.destination_location_id}`)
    } else if (route.origin_location_id) {
      navigate(`/plan?from=${route.origin_location_id}`)
    } else if (route.destination_location_id) {
      navigate(`/plan?to=${route.destination_location_id}`)
    } else {
      navigate('/plan')
    }
  }

  if (!user) {
    return (
      <div className="app-shell">
        <Header />
        <main className="flex-1 px-4 py-5">
          <div className="card flex flex-col items-center gap-3 text-center">
            <RouteIcon size={28} className="text-ocean-400" />
            <p className="text-sm font-semibold text-ocean-700">
              Sign in to save and manage your trips.
            </p>
            <Link to="/auth" className="btn-primary">
              Sign in
            </Link>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <Header />
      <main className="flex-1 space-y-4 px-4 py-5">
        {/* Add button */}
        <Link to="/plan" className="btn-primary w-full flex items-center justify-center gap-2">
          <Plus size={18} /> Plan a New Trip
        </Link>

        {/* Filters */}
        <section className="card space-y-3">
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-ocean-600" />
            <p className="text-xs font-semibold text-ocean-600">Filter</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {FILTER_CATEGORIES.map((f) => (
              <FilterChip
                key={f.key}
                active={filter === f.key}
                onClick={() => setFilter(f.key)}
                label={f.label}
              />
            ))}
          </div>
          <div>
            <p className="mb-1.5 text-xs font-semibold text-ocean-600">Sort</p>
            <div className="flex flex-wrap gap-1.5">
              <FilterChip active={sortMode === 'recent'} onClick={() => setSortMode('recent')} label="Recent" />
              <FilterChip active={sortMode === 'alphabetical'} onClick={() => setSortMode('alphabetical')} label="A-Z" />
              <FilterChip active={sortMode === 'favorites_first'} onClick={() => setSortMode('favorites_first')} label="Favorites First" />
            </div>
          </div>
        </section>

        {/* Loading */}
        {loadState === 'loading' && (
          <div className="card flex items-center gap-3">
            <Loader2 size={18} className="animate-spin text-ocean-500" />
            <p className="text-sm font-semibold text-ocean-700">Loading saved trips…</p>
          </div>
        )}

        {/* Error */}
        {loadState === 'error' && (
          <div className="card flex flex-col items-center gap-3 text-center">
            <AlertCircle size={28} className="text-red-600" />
            <p className="text-sm font-semibold text-red-700">
              Couldn't load saved trips. Please try again.
            </p>
            <button type="button" onClick={() => void loadRoutes()} className="btn-primary">
              Retry
            </button>
          </div>
        )}

        {/* Empty state */}
        {loadState === 'done' && filteredRoutes.length === 0 && (
          <div className="card flex flex-col items-center gap-3 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-full bg-sand-200 text-ocean-700">
              <RouteIcon size={28} />
            </span>
            <p className="text-base font-bold text-ocean-900">
              {routes.length === 0
                ? "You haven't saved a trip yet."
                : 'No trips match this filter.'}
            </p>
            {routes.length === 0 && (
              <>
                <p className="text-sm text-ocean-600">
                  Search for a route and save it for easier access next time.
                </p>
                <Link to="/plan" className="btn-secondary">
                  <Compass size={16} /> Plan a Trip
                </Link>
              </>
            )}
          </div>
        )}

        {/* Routes list */}
        {loadState === 'done' && filteredRoutes.length > 0 && (
          <section className="space-y-3">
            <h2 className="section-title">
              Mga Naka-save na Biyahe ({filteredRoutes.length})
            </h2>
            {filteredRoutes.map((route) => {
              const Icon = CATEGORY_ICON[route.category] ?? RouteIcon
              const displayName =
                route.custom_name ?? route.route?.route_name ?? 'Unnamed trip'
              const originName = route.origin_location?.name ?? 'Origin'
              const destName = route.destination_location?.name ?? 'Destination'
              const segmentCount = route.saved_route_segments?.length ?? 0
              return (
                <div key={route.id} className="card space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="grid h-9 w-9 place-items-center rounded-full bg-ocean-100 text-ocean-700">
                        <Icon size={16} />
                      </span>
                      <div>
                        <p className="font-bold text-ocean-900">{displayName}</p>
                        <p className="text-xs text-ocean-600">
                          {originName} → {destName}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggleFavorite(route)}
                      className="grid h-8 w-8 place-items-center rounded-full hover:bg-ocean-50"
                      aria-label={route.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
                    >
                      {route.is_favorite ? (
                        <Star size={18} className="fill-terra-400 text-terra-400" />
                      ) : (
                        <StarOff size={18} className="text-ocean-400" />
                      )}
                    </button>
                  </div>

                  {route.notes && <p className="text-xs text-ocean-500">{route.notes}</p>}

                  <div className="flex flex-wrap gap-1.5">
                    <span className="pill bg-ocean-100 text-ocean-800 text-[10px]">
                      {ROUTE_CATEGORY_LABELS[route.category]}
                    </span>
                    {route.is_favorite && (
                      <span className="pill bg-terra-100 text-terra-700 text-[10px]">Favorite</span>
                    )}
                    {segmentCount > 0 && (
                      <span className="pill bg-leaf-400/20 text-leaf-700 text-[10px]">
                        {segmentCount} segment{segmentCount > 1 ? 's' : ''}
                      </span>
                    )}
                    {route.preferred_transport_mode && (
                      <span className="pill bg-sand-200 text-ocean-700 text-[10px]">
                        {route.preferred_transport_mode.name}
                      </span>
                    )}
                  </div>

                  {/* Segments preview */}
                  {segmentCount > 0 && (
                    <div className="rounded-lg bg-ocean-50/50 px-3 py-2 space-y-1">
                      {route.saved_route_segments.map((seg) => (
                        <div key={seg.id} className="flex items-center gap-1.5 text-xs text-ocean-700">
                          <span className="font-semibold">{seg.sequence_number}.</span>
                          <span>{seg.origin_location?.name ?? '?'}</span>
                          <span className="text-ocean-400">→</span>
                          <span>{seg.destination_location?.name ?? '?'}</span>
                          {seg.transport_mode && (
                            <span className="ml-auto text-ocean-500">{seg.transport_mode.name}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="grid grid-cols-2 gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => handleReopen(route)}
                      className="flex items-center justify-center gap-1 rounded-lg bg-ocean-50 px-2 py-1.5 text-xs font-semibold text-ocean-700 hover:bg-ocean-100"
                    >
                      <RefreshCw size={12} /> Buksan ang Ruta
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingRoute(route)}
                      className="flex items-center justify-center gap-1 rounded-lg bg-ocean-50 px-2 py-1.5 text-xs font-semibold text-ocean-700 hover:bg-ocean-100"
                    >
                      <Edit2 size={12} /> I-edit ang Biyahe
                    </button>
                  </div>
                  <div className="flex gap-1.5">
                    <Link
                      to="/transport-map"
                      className="flex-1 rounded-lg bg-leaf-400/20 px-2 py-1.5 text-center text-xs font-semibold text-leaf-700 hover:bg-leaf-400/30"
                    >
                      View on Map
                    </Link>
                    <Link
                      to={`/share?source=saved_route&id=${route.id}`}
                      className="flex items-center justify-center gap-1 rounded-lg bg-ocean-50 px-2 py-1.5 text-xs font-semibold text-ocean-700 hover:bg-ocean-100"
                    >
                      <Share2 size={12} /> Share
                    </Link>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(route)}
                      className="flex items-center justify-center gap-1 rounded-lg bg-red-50 px-2 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100"
                    >
                      <Trash2 size={12} /> Delete
                    </button>
                  </div>
                </div>
              )
            })}
          </section>
        )}
      </main>

      {/* Edit Modal */}
      {editingRoute && (
        <EditRouteModal
          route={editingRoute}
          onClose={() => setEditingRoute(null)}
          onSaved={() => {
            setEditingRoute(null)
            void loadRoutes()
          }}
        />
      )}

      {/* Delete Confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-cardHover">
            <h3 className="text-lg font-bold text-ocean-900">Delete this trip?</h3>
            <p className="mt-1 text-sm text-ocean-600">
              "{deleteTarget.custom_name ?? deleteTarget.route?.route_name ?? 'This trip'}" will be
              removed from your saved trips. The routes and locations it references will not be
              affected.
            </p>
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => setDeleteTarget(null)} className="btn-secondary flex-1">
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Header() {
  return (
    <header className="sticky top-0 z-30 bg-ocean-800 text-white shadow-card">
      <div className="flex items-center gap-3 px-4 py-4">
        <Link
          to="/"
          className="grid h-9 w-9 place-items-center rounded-full bg-ocean-700 hover:bg-ocean-600"
        >
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-lg font-bold">My Saved Trips</h1>
      </div>
    </header>
  )
}

function FilterChip({
  active,
  onClick,
  label,
}: {
  active: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition active:scale-95 ${
        active ? 'bg-ocean-700 text-white' : 'bg-ocean-50 text-ocean-700 hover:bg-ocean-100'
      }`}
    >
      {label}
    </button>
  )
}

// ---- Edit Route Modal ---------------------------------------------------

function EditRouteModal({
  route,
  onClose,
  onSaved,
}: {
  route: SavedRouteWithDetails
  onClose: () => void
  onSaved: () => void
}) {
  const [customName, setCustomName] = useState(route.custom_name ?? '')
  const [category, setCategory] = useState<SavedRouteCategory>(route.category)
  const [notes, setNotes] = useState(route.notes ?? '')
  const [isFavorite, setIsFavorite] = useState(route.is_favorite)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    const result = await updateSavedRoute(route.id, {
      custom_name: customName,
      category,
      notes,
      is_favorite: isFavorite,
    })
    setSaving(false)
    if (result.success) {
      onSaved()
    } else {
      setError(result.error ?? 'Failed to update trip.')
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="max-h-[85vh] w-full max-w-md overflow-auto rounded-2xl bg-white p-5 shadow-cardHover">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-ocean-900">I-edit ang Biyahe</h3>
          <button type="button" onClick={onClose} className="text-ocean-500">
            <X size={20} />
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <div>
            <label className="text-xs font-semibold text-ocean-600">Trip Name</label>
            <input
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              maxLength={100}
              placeholder="e.g. Home to School"
              className="mt-1 w-full rounded-xl bg-ocean-50 px-3 py-2.5 text-sm text-ocean-900 placeholder:text-ocean-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-ocean-600">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as SavedRouteCategory)}
              className="mt-1 w-full rounded-xl bg-ocean-50 px-3 py-2.5 text-sm text-ocean-900 focus:outline-none"
            >
              {Object.entries(ROUTE_CATEGORY_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-ocean-600">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Private notes about this trip"
              maxLength={500}
              rows={2}
              className="mt-1 w-full rounded-xl bg-ocean-50 px-3 py-2.5 text-sm text-ocean-900 placeholder:text-ocean-400 focus:outline-none"
            />
          </div>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isFavorite}
              onChange={(e) => setIsFavorite(e.target.checked)}
              className="h-4 w-4 rounded accent-terra-500"
            />
            <span className="text-sm text-ocean-700">Mark as favorite</span>
          </label>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !customName.trim()}
            className="btn-primary w-full"
          >
            {saving ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  )
}
