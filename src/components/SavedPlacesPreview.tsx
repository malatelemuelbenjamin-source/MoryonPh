import { Link } from 'react-router-dom'
import { Home, GraduationCap, Briefcase, Star, Plus, MapPin, Anchor, Compass, ShoppingBag, Landmark, Users, Tag } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { fetchSavedPlaces } from '../lib/savedPlaces'
import type { SavedPlaceWithLocation } from '../lib/types'
import { useEffect, useState } from 'react'

const CATEGORY_ICON: Record<string, typeof Home> = {
  home: Home,
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

export function SavedPlacesPreview() {
  const { user } = useAuth()
  const [places, setPlaces] = useState<SavedPlaceWithLocation[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!user) {
        setPlaces([])
        setLoading(false)
        return
      }
      const r = await fetchSavedPlaces()
      if (!cancelled) {
        // Prioritize favorites, then recent
        const sorted = [...r].sort((a, b) => {
          if (a.is_favorite !== b.is_favorite) return Number(b.is_favorite) - Number(a.is_favorite)
          return b.created_at.localeCompare(a.created_at)
        })
        setPlaces(sorted)
        setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [user])

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="section-title">Mga Naka-save na Lugar</h2>
        <Link to="/saved-places" className="text-sm font-semibold text-ocean-700 hover:underline">
          Manage
        </Link>
      </div>

      <div className="card">
        {!user ? (
          <EmptyState message="Sign in to save your places." ctaTo="/auth" ctaLabel="Sign in" />
        ) : loading ? (
          <div className="py-3 text-sm text-ocean-600">Loading saved places…</div>
        ) : places.length === 0 ? (
          <EmptyState
            message="No saved places yet. Save a place to access it quickly."
            ctaTo="/saved-places"
            ctaLabel="+ Add Place"
          />
        ) : (
          <ul className="grid grid-cols-2 gap-2">
            {places.slice(0, 4).map((p) => {
              const Icon = CATEGORY_ICON[p.category] ?? MapPin
              return (
                <li key={p.id}>
                  <Link
                    to="/saved-places"
                    className="flex items-center gap-2 rounded-xl bg-ocean-50 p-3 hover:bg-ocean-100"
                  >
                    <span className="relative grid h-9 w-9 place-items-center rounded-full bg-ocean-700 text-white">
                      <Icon size={16} />
                      {p.is_favorite && (
                        <Star size={10} className="absolute -right-1 -top-1 fill-terra-400 text-terra-400" />
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-ocean-900">
                        {p.custom_name ?? p.location?.name ?? 'Unnamed place'}
                      </span>
                      <span className="block truncate text-xs text-ocean-600">
                        {p.location?.municipality ?? p.custom_address ?? 'Saved place'}
                      </span>
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}

function EmptyState({
  message,
  ctaTo,
  ctaLabel,
}: {
  message: string
  ctaTo: string
  ctaLabel: string
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-3 text-center">
      <MapPin size={22} className="text-ocean-400" />
      <p className="text-sm text-ocean-700">{message}</p>
      <Link to={ctaTo} className="btn-secondary w-full">
        <Plus size={16} />
        {ctaLabel}
      </Link>
    </div>
  )
}
