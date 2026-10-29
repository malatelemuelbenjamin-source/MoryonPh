import { useEffect, useState, useCallback, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Search as SearchIcon,
  Plus,
  Star,
  StarOff,
  Edit2,
  Trash2,
  MapPin,
  Home as HomeIcon,
  GraduationCap,
  Briefcase,
  Anchor,
  ShoppingBag,
  Landmark,
  Users,
  Tag,
  Compass,
  Navigation,
  Loader2,
  AlertCircle,
  X,
  Check,
  Filter,
  LocateFixed,
} from 'lucide-react'
import { useAuth } from '../lib/auth'
import {
  fetchSavedPlaces,
  saveVerifiedLocation,
  saveCustomPlace,
  updateSavedPlace,
  toggleFavorite,
  deleteSavedPlace,
  searchLocationsForSave,
  checkIfSaved,
  CATEGORY_LABELS,
} from '../lib/savedPlaces'
import type { SavedPlaceWithLocation, SavedPlaceCategory, LocationRow } from '../lib/types'

type LoadState = 'loading' | 'done' | 'error'
type SortMode = 'recent' | 'alphabetical' | 'favorites_first'

const CATEGORY_ICON: Record<string, typeof HomeIcon> = {
  home: HomeIcon,
  school: GraduationCap,
  work: Briefcase,
  favorite: Star,
  custom: Tag,
  terminal: Compass,
  port: Anchor,
  shopping: ShoppingBag,
  landmark: Landmark,
  family: Users,
  other: MapPin,
  uncategorized: MapPin,
}

const FILTER_CATEGORIES: { key: 'all' | 'favorites' | SavedPlaceCategory; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'favorites', label: 'Favorites' },
  { key: 'home', label: 'Home' },
  { key: 'school', label: 'School' },
  { key: 'work', label: 'Work' },
  { key: 'terminal', label: 'Terminal' },
  { key: 'port', label: 'Port' },
  { key: 'landmark', label: 'Landmark' },
  { key: 'other', label: 'Other' },
]

export function SavedPlacesPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [places, setPlaces] = useState<SavedPlaceWithLocation[]>([])
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [filter, setFilter] = useState<'all' | 'favorites' | SavedPlaceCategory>('all')
  const [sortMode, setSortMode] = useState<SortMode>('recent')
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingPlace, setEditingPlace] = useState<SavedPlaceWithLocation | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<SavedPlaceWithLocation | null>(null)
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'loading' | 'granted' | 'denied'>('idle')

  const handleGps = () => {
    setGpsStatus('loading')
    if (!navigator.geolocation) {
      setGpsStatus('denied')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setGpsStatus('granted')
      },
      () => setGpsStatus('denied'),
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  const loadPlaces = useCallback(async () => {
    setLoadState('loading')
    const data = await fetchSavedPlaces()
    setPlaces(data)
    setLoadState('done')
  }, [])

  useEffect(() => {
    if (!user) {
      setLoadState('done')
      return
    }
    void loadPlaces().catch(() => setLoadState('error'))
  }, [user, loadPlaces])

  const filteredPlaces = useMemo(() => {
    let list = places
    if (filter === 'favorites') {
      list = list.filter((p) => p.is_favorite)
    } else if (filter !== 'all') {
      list = list.filter((p) => p.category === filter)
    }
    const sorted = [...list]
    if (sortMode === 'alphabetical') {
      sorted.sort((a, b) => {
        const an = a.custom_name ?? a.location?.name ?? ''
        const bn = b.custom_name ?? b.location?.name ?? ''
        return an.localeCompare(bn)
      })
    } else if (sortMode === 'favorites_first') {
      sorted.sort((a, b) => Number(b.is_favorite) - Number(a.is_favorite))
    } else {
      sorted.sort((a, b) => b.created_at.localeCompare(a.created_at))
    }
    return sorted
  }, [places, filter, sortMode])

  const handleToggleFavorite = async (place: SavedPlaceWithLocation) => {
    const ok = await toggleFavorite(place.id, place.is_favorite)
    if (ok) {
      setPlaces((prev) =>
        prev.map((p) => (p.id === place.id ? { ...p, is_favorite: !p.is_favorite } : p)),
      )
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    const ok = await deleteSavedPlace(deleteTarget.id)
    if (ok) {
      setPlaces((prev) => prev.filter((p) => p.id !== deleteTarget.id))
    }
    setDeleteTarget(null)
  }

  const handlePlanTrip = (place: SavedPlaceWithLocation, role: 'origin' | 'destination') => {
    if (place.location_id) {
      navigate(`/plan?${role}=${place.location_id}`)
    } else if (place.latitude != null && place.longitude != null) {
      navigate(`/plan?${role}_lat=${place.latitude}&${role}_lng=${place.longitude}&${role}_name=${encodeURIComponent(place.custom_name ?? 'Custom Place')}`)
    }
  }

  if (!user) {
    return (
      <div className="app-shell">
        <Header />
        <main className="flex-1 px-4 py-5">
          <div className="card flex flex-col items-center gap-3 text-center">
            <MapPin size={28} className="text-ocean-400" />
            <p className="text-sm font-semibold text-ocean-700">Sign in to save and manage your places.</p>
            <Link to="/auth" className="btn-primary">Sign in</Link>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <Header />
      <main className="flex-1 space-y-4 px-4 py-5">
        {/* Add button + GPS */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="btn-primary flex-1"
          >
            <Plus size={18} /> Magdagdag ng Lugar
          </button>
          {gpsStatus !== 'granted' && (
            <button
              type="button"
              onClick={handleGps}
              disabled={gpsStatus === 'loading'}
              className="btn-secondary"
              aria-label="Use my current location"
            >
              {gpsStatus === 'loading' ? <Loader2 size={18} className="animate-spin" /> : <LocateFixed size={18} />}
            </button>
          )}
        </div>
        {gpsStatus === 'granted' && (
          <p className="text-xs text-ocean-500">Location enabled — approximate distances shown below.</p>
        )}
        {gpsStatus === 'denied' && (
          <p className="text-xs text-ocean-500">Location unavailable — you can still save and use places without it.</p>
        )}

        {/* Filters */}
        <section className="card space-y-3">
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-ocean-600" />
            <p className="text-xs font-semibold text-ocean-600">Filter</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {FILTER_CATEGORIES.map((f) => (
              <FilterChip key={f.key} active={filter === f.key} onClick={() => setFilter(f.key)} label={f.label} />
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
            <p className="text-sm font-semibold text-ocean-700">Loading saved places…</p>
          </div>
        )}

        {/* Error */}
        {loadState === 'error' && (
          <div className="card flex flex-col items-center gap-3 text-center">
            <AlertCircle size={28} className="text-red-600" />
            <p className="text-sm font-semibold text-red-700">Couldn't load saved places. Please try again.</p>
            <button type="button" onClick={() => void loadPlaces()} className="btn-primary">Retry</button>
          </div>
        )}

        {/* Places list */}
        {loadState === 'done' && filteredPlaces.length === 0 && (
          <div className="card flex flex-col items-center gap-3 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-full bg-sand-200 text-ocean-700">
              <MapPin size={28} />
            </span>
            <p className="text-base font-bold text-ocean-900">
              {places.length === 0
                ? "You haven't saved any places yet."
                : 'No places match this filter.'}
            </p>
            {places.length === 0 && (
              <p className="text-sm text-ocean-600">Save a place to access it quickly next time.</p>
            )}
            {places.length === 0 && (
              <button type="button" onClick={() => setShowAddModal(true)} className="btn-secondary">
                <Plus size={16} /> Add Your First Place
              </button>
            )}
          </div>
        )}

        {loadState === 'done' && filteredPlaces.length > 0 && (
          <section className="space-y-3">
            <h2 className="section-title">Mga Naka-save na Lugar ({filteredPlaces.length})</h2>
            {filteredPlaces.map((place) => {
              const Icon = CATEGORY_ICON[place.category] ?? MapPin
              const displayName = place.custom_name ?? place.location?.name ?? 'Unnamed place'
              return (
                <div key={place.id} className="card space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="grid h-9 w-9 place-items-center rounded-full bg-ocean-100 text-ocean-700">
                        <Icon size={16} />
                      </span>
                      <div>
                        <p className="font-bold text-ocean-900">{displayName}</p>
                        <p className="text-xs text-ocean-600">
                          {place.location?.municipality ?? place.custom_address ?? CATEGORY_LABELS[place.category]}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggleFavorite(place)}
                      className="grid h-8 w-8 place-items-center rounded-full hover:bg-ocean-50"
                      aria-label={place.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
                    >
                      {place.is_favorite ? (
                        <Star size={18} className="fill-terra-400 text-terra-400" />
                      ) : (
                        <StarOff size={18} className="text-ocean-400" />
                      )}
                    </button>
                  </div>

                  {place.notes && <p className="text-xs text-ocean-500">{place.notes}</p>}

                  {place.latitude != null && place.longitude != null && (
                    <p className="text-xs text-ocean-400">
                      {place.latitude.toFixed(4)}, {place.longitude.toFixed(4)}
                      {gpsCoords && (
                        <span className="ml-1 text-ocean-500">
                          · ~{haversineKm(gpsCoords.lat, gpsCoords.lng, place.latitude, place.longitude).toFixed(1)} km away (approx)
                        </span>
                      )}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-1.5">
                    <span className="pill bg-ocean-100 text-ocean-800 text-[10px]">
                      {CATEGORY_LABELS[place.category]}
                    </span>
                    {place.is_favorite && (
                      <span className="pill bg-terra-100 text-terra-700 text-[10px]">Favorite</span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="grid grid-cols-3 gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => handlePlanTrip(place, 'origin')}
                      className="flex items-center justify-center gap-1 rounded-lg bg-ocean-50 px-2 py-1.5 text-xs font-semibold text-ocean-700 hover:bg-ocean-100"
                    >
                      <Compass size={12} /> Origin
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePlanTrip(place, 'destination')}
                      className="flex items-center justify-center gap-1 rounded-lg bg-ocean-50 px-2 py-1.5 text-xs font-semibold text-ocean-700 hover:bg-ocean-100"
                    >
                      <Navigation size={12} /> Destination
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingPlace(place)}
                      className="flex items-center justify-center gap-1 rounded-lg bg-ocean-50 px-2 py-1.5 text-xs font-semibold text-ocean-700 hover:bg-ocean-100"
                    >
                      <Edit2 size={12} /> Edit
                    </button>
                  </div>
                  <div className="flex gap-1.5">
                    {place.location_id && (
                      <Link
                        to={`/transport-map`}
                        className="flex-1 rounded-lg bg-leaf-400/20 px-2 py-1.5 text-center text-xs font-semibold text-leaf-700 hover:bg-leaf-400/30"
                      >
                        View on Map
                      </Link>
                    )}
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(place)}
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

      {/* Add Place Modal */}
      {showAddModal && (
        <AddPlaceModal
          onClose={() => setShowAddModal(false)}
          onSaved={() => {
            setShowAddModal(false)
            void loadPlaces()
          }}
        />
      )}

      {/* Edit Place Modal */}
      {editingPlace && (
        <EditPlaceModal
          place={editingPlace}
          onClose={() => setEditingPlace(null)}
          onSaved={() => {
            setEditingPlace(null)
            void loadPlaces()
          }}
        />
      )}

      {/* Delete Confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-cardHover">
            <h3 className="text-lg font-bold text-ocean-900">Delete this place?</h3>
            <p className="mt-1 text-sm text-ocean-600">
              "{deleteTarget.custom_name ?? deleteTarget.location?.name ?? 'This place'}" will be removed from your saved places.
            </p>
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => setDeleteTarget(null)} className="btn-secondary flex-1">
                Cancel
              </button>
              <button type="button" onClick={handleDelete} className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-700">
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
        <Link to="/" className="grid h-9 w-9 place-items-center rounded-full bg-ocean-700 hover:bg-ocean-600">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-lg font-bold">Saved Places</h1>
      </div>
    </header>
  )
}

function FilterChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
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

// ---- Add Place Modal ----------------------------------------------------

function AddPlaceModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [mode, setMode] = useState<'search' | 'custom'>('search')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<LocationRow[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedLocation, setSelectedLocation] = useState<LocationRow | null>(null)
  const [alreadySaved, setAlreadySaved] = useState(false)

  // Custom place fields
  const [customName, setCustomName] = useState('')
  const [customAddress, setCustomAddress] = useState('')
  const [category, setCategory] = useState<SavedPlaceCategory>('uncategorized')
  const [notes, setNotes] = useState('')
  const [isFavorite, setIsFavorite] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Debounced search
  useEffect(() => {
    if (mode !== 'search') return
    if (!searchQuery.trim()) {
      setSearchResults([])
      return
    }
    setSearching(true)
    const timer = setTimeout(async () => {
      const results = await searchLocationsForSave(searchQuery)
      setSearchResults(results)
      setSearching(false)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery, mode])

  const handleSelectLocation = async (loc: LocationRow) => {
    setSelectedLocation(loc)
    const { saved } = await checkIfSaved(loc.id)
    setAlreadySaved(saved)
  }

  const handleSaveVerified = async () => {
    if (!selectedLocation) return
    setSaving(true)
    setSaveError(null)
    const result = await saveVerifiedLocation({
      locationId: selectedLocation.id,
      customName: customName.trim() || undefined,
      category,
      notes: notes.trim() || undefined,
      isFavorite,
    })
    setSaving(false)
    if (result.success) {
      onSaved()
    } else {
      setSaveError(result.error ?? 'Failed to save place.')
    }
  }

  const handleSaveCustom = async () => {
    setSaving(true)
    setSaveError(null)
    const result = await saveCustomPlace({
      customName,
      customAddress: customAddress || undefined,
      category,
      notes: notes || undefined,
      isFavorite,
    })
    setSaving(false)
    if (result.success) {
      onSaved()
    } else {
      setSaveError(result.error ?? 'Failed to save place.')
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="max-h-[85vh] w-full max-w-md overflow-auto rounded-2xl bg-white p-5 shadow-cardHover">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-ocean-900">Add Saved Place</h3>
          <button type="button" onClick={onClose} className="text-ocean-500">
            <X size={20} />
          </button>
        </div>

        {/* Mode toggle */}
        <div className="mt-3 flex gap-1.5">
          <FilterChip active={mode === 'search'} onClick={() => setMode('search')} label="Search Location" />
          <FilterChip active={mode === 'custom'} onClick={() => setMode('custom')} label="Custom Place" />
        </div>

        {mode === 'search' && (
          <div className="mt-4 space-y-3">
            {/* Search */}
            <div className="flex items-center gap-2 rounded-xl bg-ocean-50 px-3 py-2.5">
              <SearchIcon size={18} className="text-ocean-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search municipality, terminal, port…"
                className="w-full bg-transparent text-sm text-ocean-900 placeholder:text-ocean-400 focus:outline-none"
              />
              {searching && <Loader2 size={14} className="animate-spin text-ocean-500" />}
            </div>

            {/* Search results */}
            {searchResults.length > 0 && !selectedLocation && (
              <ul className="max-h-40 space-y-1 overflow-auto">
                {searchResults.map((loc) => (
                  <li key={loc.id}>
                    <button
                      type="button"
                      onClick={() => handleSelectLocation(loc)}
                      className="w-full rounded-lg bg-ocean-50 px-3 py-2 text-left text-sm text-ocean-900 hover:bg-ocean-100"
                    >
                      <span className="font-semibold">{loc.name}</span>
                      {loc.municipality && <span className="text-xs text-ocean-500"> · {loc.municipality}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {/* Selected location details */}
            {selectedLocation && (
              <div className="rounded-xl bg-leaf-400/10 p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Check size={16} className="text-leaf-600" />
                  <p className="text-sm font-bold text-ocean-900">{selectedLocation.name}</p>
                  <button type="button" onClick={() => setSelectedLocation(null)} className="ml-auto text-xs text-ocean-500">
                    Change
                  </button>
                </div>
                {alreadySaved && (
                  <p className="text-xs text-terra-600">You already saved this location. You can still add it with a different label.</p>
                )}
              </div>
            )}

            {/* Label and options */}
            {selectedLocation && (
              <PlaceFormFields
                customName={customName}
                setCustomName={setCustomName}
                category={category}
                setCategory={setCategory}
                notes={notes}
                setNotes={setNotes}
                isFavorite={isFavorite}
                setIsFavorite={setIsFavorite}
              />
            )}

            {saveError && <p className="text-xs text-red-600">{saveError}</p>}

            <button
              type="button"
              onClick={handleSaveVerified}
              disabled={saving || !selectedLocation}
              className="btn-primary w-full"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              Save Place
            </button>
          </div>
        )}

        {mode === 'custom' && (
          <div className="mt-4 space-y-3">
            <div>
              <label className="text-xs font-semibold text-ocean-600">Place Name *</label>
              <input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="e.g. My House, Lola's Place"
                maxLength={100}
                className="mt-1 w-full rounded-xl bg-ocean-50 px-3 py-2.5 text-sm text-ocean-900 placeholder:text-ocean-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-ocean-600">Address (optional)</label>
              <input
                type="text"
                value={customAddress}
                onChange={(e) => setCustomAddress(e.target.value)}
                placeholder="Street, barangay, municipality"
                maxLength={200}
                className="mt-1 w-full rounded-xl bg-ocean-50 px-3 py-2.5 text-sm text-ocean-900 placeholder:text-ocean-400 focus:outline-none"
              />
            </div>
            <PlaceFormFields
              customName={customName}
              setCustomName={setCustomName}
              category={category}
              setCategory={setCategory}
              notes={notes}
              setNotes={setNotes}
              isFavorite={isFavorite}
              setIsFavorite={setIsFavorite}
            />
            {saveError && <p className="text-xs text-red-600">{saveError}</p>}
            <button
              type="button"
              onClick={handleSaveCustom}
              disabled={saving || !customName.trim()}
              className="btn-primary w-full"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              Save Custom Place
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ---- Edit Place Modal ---------------------------------------------------

function EditPlaceModal({
  place,
  onClose,
  onSaved,
}: {
  place: SavedPlaceWithLocation
  onClose: () => void
  onSaved: () => void
}) {
  const [customName, setCustomName] = useState(place.custom_name ?? '')
  const [customAddress, setCustomAddress] = useState(place.custom_address ?? '')
  const [category, setCategory] = useState<SavedPlaceCategory>(place.category)
  const [notes, setNotes] = useState(place.notes ?? '')
  const [isFavorite, setIsFavorite] = useState(place.is_favorite)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const handleSave = async () => {
    setSaving(true)
    setSaveError(null)
    const result = await updateSavedPlace(place.id, {
      custom_name: customName.trim() || null,
      custom_address: customAddress.trim() || null,
      category,
      notes: notes.trim() || null,
      is_favorite: isFavorite,
    })
    setSaving(false)
    if (result.success) {
      onSaved()
    } else {
      setSaveError(result.error ?? 'Failed to update place.')
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="max-h-[85vh] w-full max-w-md overflow-auto rounded-2xl bg-white p-5 shadow-cardHover">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-ocean-900">I-edit ang Lugar (Edit Place)</h3>
          <button type="button" onClick={onClose} className="text-ocean-500">
            <X size={20} />
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {place.location && (
            <div className="rounded-xl bg-ocean-50 p-3">
              <p className="text-sm font-bold text-ocean-900">{place.location.name}</p>
              <p className="text-xs text-ocean-500">{place.location.municipality}</p>
              <p className="mt-1 text-xs text-ocean-400">Linked to verified location</p>
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-ocean-600">Custom Name</label>
            <input
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="e.g. My House"
              maxLength={100}
              className="mt-1 w-full rounded-xl bg-ocean-50 px-3 py-2.5 text-sm text-ocean-900 placeholder:text-ocean-400 focus:outline-none"
            />
          </div>

          {!place.location_id && (
            <div>
              <label className="text-xs font-semibold text-ocean-600">Address</label>
              <input
                type="text"
                value={customAddress}
                onChange={(e) => setCustomAddress(e.target.value)}
                placeholder="Street, barangay, municipality"
                maxLength={200}
                className="mt-1 w-full rounded-xl bg-ocean-50 px-3 py-2.5 text-sm text-ocean-900 placeholder:text-ocean-400 focus:outline-none"
              />
            </div>
          )}

          <PlaceFormFields
            customName={customName}
            setCustomName={setCustomName}
            category={category}
            setCategory={setCategory}
            notes={notes}
            setNotes={setNotes}
            isFavorite={isFavorite}
            setIsFavorite={setIsFavorite}
          />

          {saveError && <p className="text-xs text-red-600">{saveError}</p>}

          <button type="button" onClick={handleSave} disabled={saving} className="btn-primary w-full">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  )
}

// ---- Shared form fields -------------------------------------------------

function PlaceFormFields({
  customName,
  setCustomName,
  category,
  setCategory,
  notes,
  setNotes,
  isFavorite,
  setIsFavorite,
}: {
  customName: string
  setCustomName: (v: string) => void
  category: SavedPlaceCategory
  setCategory: (v: SavedPlaceCategory) => void
  notes: string
  setNotes: (v: string) => void
  isFavorite: boolean
  setIsFavorite: (v: boolean) => void
}) {
  return (
    <>
      <div>
        <label className="text-xs font-semibold text-ocean-600">Custom Label (optional)</label>
        <input
          type="text"
          value={customName}
          onChange={(e) => setCustomName(e.target.value)}
          placeholder="e.g. My House, School"
          maxLength={100}
          className="mt-1 w-full rounded-xl bg-ocean-50 px-3 py-2.5 text-sm text-ocean-900 placeholder:text-ocean-400 focus:outline-none"
        />
      </div>
      <div>
        <label className="text-xs font-semibold text-ocean-600">Category</label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as SavedPlaceCategory)}
          className="mt-1 w-full rounded-xl bg-ocean-50 px-3 py-2.5 text-sm text-ocean-900 focus:outline-none"
        >
          {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-xs font-semibold text-ocean-600">Notes (optional)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Private notes about this place"
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
    </>
  )
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2)
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}
