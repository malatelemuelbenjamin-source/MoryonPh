import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  Search as SearchIcon,
  MapPin,
  Navigation,
  List,
  Map as MapIcon,
  RefreshCw,
  Info,
  AlertCircle,
  Utensils,
  Coffee,
  ShoppingCart,
  Store,
  Building2,
  Pill,
  HeartPulse,
  Banknote,
  Shield,
  Flame,
  Landmark,
  Fuel,
  Bus,
  Bike,
  Sailboat,
  Anchor,
  Palmtree,
  Waves,
  Hotel,
  Compass,
  Plus,
  X,
} from 'lucide-react'
import { useLocation as useGpsLocation } from '../lib/location'
import {
  fetchNearbyPlaces,
  CATEGORY_GROUPS,
  CATEGORY_LABELS,
  RADIUS_OPTIONS,
  formatDistance,
  getPlaceCategory,
  getAvailableCategories,
  submitNearbyPlaceSuggestion,
} from '../lib/nearbyPlaces'
import { MUNICIPALITIES } from '../lib/explore'
import type { NearbyPlace, NearbyPlaceCategory } from '../lib/types'

const CATEGORY_ICON_MAP: Record<NearbyPlaceCategory, typeof MapPin> = {
  restaurant: Utensils,
  cafe_bakery: Coffee,
  grocery_market: ShoppingCart,
  convenience_store: Store,
  local_shop: Store,
  public_market: Building2,
  pharmacy: Pill,
  hospital_clinic: HeartPulse,
  health_center: HeartPulse,
  atm_bank: Banknote,
  police_station: Shield,
  fire_station: Flame,
  government_office: Landmark,
  gas_station: Fuel,
  public_toilet: Info,
  jeepney_stop: Bus,
  tricycle_terminal: Bike,
  bus_terminal: Bus,
  port: Sailboat,
  ferry_terminal: Anchor,
  boat_service: Sailboat,
  tourist_attraction: Palmtree,
  beach: Waves,
  historical_cultural: Landmark,
  accommodation: Hotel,
  visitor_info: Compass,
  other: MapPin,
}

export function NearbyPlacesPage() {
  const gps = useGpsLocation()
  const [places, setPlaces] = useState<NearbyPlace[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [muniFilter, setMuniFilter] = useState('all')
  const [activeGroup, setActiveGroup] = useState<string | 'all'>('all')
  const [activeCategory, setActiveCategory] = useState<NearbyPlaceCategory | 'all'>('all')
  const [radius, setRadius] = useState(0)
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list')
  const [showGpsPrompt, setShowGpsPrompt] = useState(false)
  const [showSuggest, setShowSuggest] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const userLat = gps.coords?.lat ?? null
  const userLng = gps.coords?.lng ?? null

  const loadPlaces = useCallback(async () => {
    setLoading(true)
    setError(null)
    const result = await fetchNearbyPlaces({
      search,
      municipality: muniFilter,
      categoryGroup: activeGroup === 'all' ? undefined : activeGroup,
      category: activeCategory,
      radiusKm: radius,
      userLat,
      userLng,
    })
    setPlaces(result)
    setLoading(false)
  }, [search, muniFilter, activeGroup, activeCategory, radius, userLat, userLng])

  useEffect(() => {
    const debounce = setTimeout(() => void loadPlaces(), 300)
    return () => clearTimeout(debounce)
  }, [loadPlaces])

  // Auto-select municipality from GPS
  useEffect(() => {
    if (gps.municipality && muniFilter === 'all' && gps.status === 'granted') {
      setMuniFilter(gps.municipality)
    }
  }, [gps.municipality, gps.status])

  const availableCats = getAvailableCategories(places)

  function handleUseGps() {
    if (gps.status === 'granted' || gps.status === 'unknown') {
      setShowGpsPrompt(true)
    } else {
      void gps.requestPermission()
    }
  }

  return (
    <div className="app-shell">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-ocean-800 text-white shadow-card">
        <div className="flex items-center gap-3 px-4 py-4">
          <Link to="/" aria-label="Back to home" className="grid h-9 w-9 place-items-center rounded-full bg-ocean-700 hover:bg-ocean-600">
            <ArrowLeft size={18} />
          </Link>
          <span className="grid h-8 w-8 place-items-center rounded-full bg-ocean-600">
            <MapPin size={18} />
          </span>
          <h1 className="text-lg font-bold">Nearby Places</h1>
          <div className="ml-auto flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setViewMode(viewMode === 'list' ? 'map' : 'list')}
              aria-label="Toggle view"
              className="grid h-9 w-9 place-items-center rounded-full bg-ocean-700 hover:bg-ocean-600"
            >
              {viewMode === 'list' ? <MapIcon size={18} /> : <List size={18} />}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 space-y-4 px-4 py-5">
        {/* GPS status banner */}
        {showGpsPrompt && gps.status !== 'granted' && (
          <div className="card flex items-start gap-2 border-ocean-200">
            <Navigation size={16} className="mt-0.5 shrink-0 text-ocean-600" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-ocean-900">Use your location?</p>
              <p className="text-xs text-ocean-600 mt-1">
                We use your location only to calculate distances to nearby places. We don't store or track your GPS coordinates.
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => { void gps.requestPermission(); setShowGpsPrompt(false) }}
                  className="btn-primary text-xs"
                >
                  Allow
                </button>
                <button
                  type="button"
                  onClick={() => setShowGpsPrompt(false)}
                  className="btn-secondary text-xs"
                >
                  No thanks
                </button>
              </div>
            </div>
          </div>
        )}

        {gps.status === 'denied' && (
          <div className="card flex items-start gap-2 border-sand-200">
            <AlertCircle size={16} className="mt-0.5 shrink-0 text-terra-600" />
            <p className="text-xs text-terra-700">
              Location access denied. You can still search by municipality. Distances won't show without GPS.
            </p>
          </div>
        )}

        {/* Search bar */}
        <section className="card space-y-3">
          <div className="flex items-center gap-2 rounded-xl bg-ocean-50 px-3 py-2.5">
            <SearchIcon size={18} className="text-ocean-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search places, services, establishments…"
              className="w-full bg-transparent text-sm text-ocean-900 placeholder:text-ocean-400 focus:outline-none"
            />
            {search && (
              <button type="button" onClick={() => setSearch('')} className="text-ocean-400 hover:text-ocean-600">
                <X size={16} />
              </button>
            )}
          </div>

          {/* GPS + Radius */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleUseGps}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition active:scale-95 ${
                gps.status === 'granted'
                  ? 'bg-leaf-100 text-leaf-700'
                  : 'bg-ocean-50 text-ocean-700 hover:bg-ocean-100'
              }`}
            >
              <Navigation size={12} />
              {gps.status === 'granted' ? 'GPS On' : 'Use GPS'}
            </button>
            {gps.status === 'granted' && (
              <select
                value={radius}
                onChange={(e) => setRadius(Number(e.target.value))}
                className="rounded-full bg-ocean-50 px-3 py-1.5 text-xs font-semibold text-ocean-700 focus:outline-none"
              >
                {RADIUS_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            )}
          </div>

          {/* Municipality filter */}
          <div className="flex flex-wrap gap-1.5">
            <Chip active={muniFilter === 'all'} onClick={() => setMuniFilter('all')} label="All" />
            {MUNICIPALITIES.map((m) => (
              <Chip key={m} active={muniFilter === m} onClick={() => setMuniFilter(m)} label={m} />
            ))}
          </div>
        </section>

        {/* Category group shortcuts */}
        <section className="space-y-2">
          <h2 className="section-title">Categories</h2>
          <div className="grid grid-cols-4 gap-2">
            <CategoryChip
              active={activeGroup === 'all'}
              onClick={() => { setActiveGroup('all'); setActiveCategory('all') }}
              icon={MapPin}
              label="All"
            />
            {CATEGORY_GROUPS.map((g) => (
              <CategoryChip
                key={g.id}
                active={activeGroup === g.id}
                onClick={() => { setActiveGroup(g.id); setActiveCategory('all') }}
                icon={CATEGORY_ICON_MAP[g.categories[0]] ?? MapPin}
                label={g.label}
              />
            ))}
          </div>

          {/* Sub-categories when a group is active */}
          {activeGroup !== 'all' && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {(() => {
                const group = CATEGORY_GROUPS.find((g) => g.id === activeGroup)
                if (!group) return null
                return group.categories
                  .filter((c) => availableCats.size === 0 || availableCats.has(c))
                  .map((c) => (
                    <Chip
                      key={c}
                      active={activeCategory === c}
                      onClick={() => setActiveCategory(activeCategory === c ? 'all' : c)}
                      label={CATEGORY_LABELS[c]}
                    />
                  ))
              })()}
            </div>
          )}
        </section>

        {/* Loading */}
        {loading && (
          <div className="card flex items-center gap-3">
            <span className="h-3 w-3 animate-pulse rounded-full bg-ocean-400" />
            <p className="text-sm font-semibold text-ocean-700">Loading nearby places…</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="card flex items-center gap-2 border-red-200">
            <AlertCircle size={16} className="text-red-600" />
            <p className="text-sm text-red-700">{error}</p>
            <button type="button" onClick={() => void loadPlaces()} className="ml-auto text-red-600">
              <RefreshCw size={14} />
            </button>
          </div>
        )}

        {/* Results */}
        {!loading && !error && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="section-title">
                {places.length} {places.length === 1 ? 'Place' : 'Places'}
                {radius > 0 && gps.status === 'granted' && ` within ${RADIUS_OPTIONS.find(r => r.value === radius)?.label}`}
              </h2>
              <button type="button" onClick={() => void loadPlaces()} className="text-ocean-500 hover:text-ocean-700">
                <RefreshCw size={16} />
              </button>
            </div>

            {places.length === 0 ? (
              <div className="card flex flex-col items-center gap-2 text-center">
                <Info size={24} className="text-ocean-400" />
                <p className="text-sm font-bold text-ocean-900">No verified places found</p>
                <p className="text-sm text-ocean-600">
                  Try a different search, municipality, or category. You can also suggest a missing place.
                </p>
                <button
                  type="button"
                  onClick={() => setShowSuggest(true)}
                  className="btn-primary text-xs mt-2"
                >
                  <Plus size={14} /> Suggest a Place
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {places.map((p) => (
                  <PlaceCard key={p.id} place={p} />
                ))}
              </div>
            )}
          </section>
        )}

        {/* Suggest a place form */}
        {showSuggest && (
          <SuggestPlaceForm
            onClose={() => setShowSuggest(false)}
            municipality={muniFilter !== 'all' ? muniFilter : undefined}
          />
        )}

        {/* Info notice */}
        <section className="card flex items-start gap-2">
          <Info size={16} className="mt-0.5 shrink-0 text-ocean-500" />
          <p className="text-xs text-ocean-600">
            Places are sourced from verified MoryonGo records. Distances are shown only when
            GPS coordinates are available for both you and the place. Community-submitted places
            remain unverified until reviewed.
          </p>
        </section>
      </main>
    </div>
  )
}

// ---- Place Card -----------------------------------------------------------

function PlaceCard({ place }: { place: NearbyPlace }) {
  const cat = getPlaceCategory(place)
  const catLabel = cat ? CATEGORY_LABELS[cat] : null
  const Icon = cat ? CATEGORY_ICON_MAP[cat] ?? MapPin : MapPin

  return (
    <Link
      to={`/nearby-places/${place.id}`}
      className="card block space-y-2 hover:shadow-cardHover transition active:scale-[0.98]"
    >
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ocean-50 text-ocean-700">
          <Icon size={20} />
        </span>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-ocean-900 truncate">{place.name}</p>
          {catLabel && <p className="text-xs text-ocean-600">{catLabel}</p>}
        </div>
        {place.distance_km !== null && (
          <span className="shrink-0 text-xs font-semibold text-leaf-700">
            {formatDistance(place.distance_km)}
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-2 text-xs text-ocean-500">
        {place.municipality && (
          <span className="flex items-center gap-1"><MapPin size={12} /> {place.municipality}</span>
        )}
        {place.barangay && <span>{place.barangay}</span>}
        <span className={`pill text-[10px] ${
          place.verification_status === 'official' ? 'bg-leaf-100 text-leaf-700' :
          place.verification_status === 'verified' ? 'bg-leaf-100 text-leaf-700' :
          place.verification_status === 'community' ? 'bg-ocean-50 text-ocean-600' :
          'bg-sand-200 text-terra-700'
        }`}>
          {place.verification_status}
        </span>
      </div>
    </Link>
  )
}

// ---- Suggest Place Form --------------------------------------------------

function SuggestPlaceForm({
  onClose,
  municipality,
}: {
  onClose: () => void
  municipality?: string
}) {
  const [name, setName] = useState('')
  const [muni, setMuni] = useState(municipality ?? '')
  const [barangay, setBarangay] = useState('')
  const [address, setAddress] = useState('')
  const [category, setCategory] = useState<NearbyPlaceCategory>('other')
  const [phone, setPhone] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ success: boolean; error?: string } | null>(null)

  async function handleSubmit() {
    if (!name.trim()) return
    setSubmitting(true)
    const res = await submitNearbyPlaceSuggestion({
      name,
      municipality: muni || undefined,
      barangay: barangay || undefined,
      address: address || undefined,
      category,
      phone_number: phone || undefined,
      description: description || undefined,
    })
    setSubmitting(false)
    setResult(res)
    if (res.success) {
      setName(''); setBarangay(''); setAddress(''); setPhone(''); setDescription('')
    }
  }

  return (
    <div className="card space-y-3 border-ocean-200">
      <div className="flex items-center justify-between">
        <p className="font-bold text-ocean-900">Suggest a Place</p>
        <button type="button" onClick={onClose} className="text-ocean-400 hover:text-ocean-600">
          <X size={18} />
        </button>
      </div>
      <p className="text-xs text-ocean-600">
        Your suggestion will be reviewed before it appears publicly. It won't become official until verified.
      </p>

      {result?.success && (
        <div className="rounded-lg bg-leaf-50 px-3 py-2 text-sm text-leaf-700">
          Thank you! Your suggestion has been submitted for review.
        </div>
      )}
      {result && !result.success && (
        <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {result.error || 'Submission failed. Please try again.'}
        </div>
      )}

      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Place name *"
        className="input"
      />
      <select value={muni} onChange={(e) => setMuni(e.target.value)} className="input">
        <option value="">Select municipality</option>
        {MUNICIPALITIES.map((m) => <option key={m} value={m}>{m}</option>)}
      </select>
      <input
        type="text"
        value={barangay}
        onChange={(e) => setBarangay(e.target.value)}
        placeholder="Barangay (optional)"
        className="input"
      />
      <input
        type="text"
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        placeholder="Address (optional)"
        className="input"
      />
      <select
        value={category}
        onChange={(e) => setCategory(e.target.value as NearbyPlaceCategory)}
        className="input"
      >
        {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
          <option key={k} value={k}>{v}</option>
        ))}
      </select>
      <input
        type="text"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="Phone number (optional)"
        className="input"
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description (optional)"
        className="input min-h-[60px]"
      />
      <button
        type="button"
        onClick={() => void handleSubmit()}
        disabled={submitting || !name.trim()}
        className="btn-primary w-full"
      >
        {submitting ? 'Submitting…' : 'Submit for Review'}
      </button>
    </div>
  )
}

// ---- Small UI helpers ----------------------------------------------------

function Chip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
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

function CategoryChip({
  active, onClick, icon: Icon, label,
}: {
  active: boolean
  onClick: () => void
  icon: typeof MapPin
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center gap-1.5 rounded-2xl p-3 transition active:scale-95 ${
        active ? 'bg-ocean-700 text-white shadow-card' : 'bg-white text-ocean-700 shadow-card hover:shadow-cardHover'
      }`}
    >
      <span className={`grid h-10 w-10 place-items-center rounded-full ${
        active ? 'bg-ocean-600' : 'bg-ocean-50'
      }`}>
        <Icon size={20} />
      </span>
      <span className="text-center text-[10px] font-semibold leading-tight">{label}</span>
    </button>
  )
}
