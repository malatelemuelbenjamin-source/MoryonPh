import { useEffect, useState } from 'react'
import { Clock, Trash2, X, MapPin } from 'lucide-react'
import { useAuth } from '../lib/auth'
import {
  clearRecentSearches,
  deleteRecentSearch,
  getRecentSearches,
} from '../lib/data'
import type { RecentSearchWithLocation } from '../lib/types'
import { formatRelativeTime } from '../lib/labels'

export function RecentSearches() {
  const { user } = useAuth()
  const [items, setItems] = useState<RecentSearchWithLocation[]>([])
  const [loading, setLoading] = useState(true)

  async function reload() {
    if (!user) {
      setItems([])
      setLoading(false)
      return
    }
    const r = await getRecentSearches(user.id, 5)
    setItems(r)
    setLoading(false)
  }

  useEffect(() => {
    void reload()
  }, [user])

  async function removeOne(id: string) {
    const ok = await deleteRecentSearch(id)
    if (ok) setItems((prev) => prev.filter((i) => i.id !== id))
  }

  async function clearAll() {
    if (!user) return
    const ok = await clearRecentSearches(user.id)
    if (ok) setItems([])
  }

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="section-title">Recent</h2>
        {items.length > 0 && (
          <button
            type="button"
            onClick={clearAll}
            className="text-sm font-semibold text-terra-700 hover:underline"
          >
            Clear All
          </button>
        )}
      </div>

      <div className="card">
        {!user ? (
          <p className="py-3 text-sm text-ocean-700">Sign in to see your recent searches.</p>
        ) : loading ? (
          <p className="py-3 text-sm text-ocean-600">Loading…</p>
        ) : items.length === 0 ? (
          <p className="py-3 text-sm text-ocean-700">No recent searches.</p>
        ) : (
          <ul className="divide-y divide-ocean-50">
            {items.map((s) => (
              <li key={s.id} className="flex items-center gap-3 py-3">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-ocean-100 text-ocean-700">
                  {s.location ? <MapPin size={16} /> : <Clock size={16} />}
                </span>
                <button
                  type="button"
                  className="flex-1 text-left"
                  onClick={() =>
                    s.location &&
                    window.dispatchEvent(
                      new CustomEvent('moryongo:open-location', { detail: s.location.id }),
                    )
                  }
                >
                  <span className="block font-semibold text-ocean-900">
                    {s.location?.name ?? s.search_text ?? 'Unknown search'}
                  </span>
                  <span className="block text-xs text-ocean-600">
                    {s.location?.municipality ? `${s.location.municipality} · ` : ''}
                    {formatRelativeTime(s.searched_at)}
                  </span>
                </button>
                <button
                  type="button"
                  aria-label="Remove search"
                  onClick={() => removeOne(s.id)}
                  className="grid h-8 w-8 place-items-center rounded-full text-ocean-500 hover:bg-ocean-50"
                >
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

// Re-export for placeholder usage in placeholder pages.
export { X }
