import { useEffect, useRef, useState } from 'react'
import { Search, X, MapPin } from 'lucide-react'
import { useAuth } from '../lib/auth'
import {
  recordSearch,
  searchLocations,
} from '../lib/data'
import type { LocationRow } from '../lib/types'

interface SearchBoxProps {
  onSelect?: (loc: LocationRow) => void
}

export function SearchBox({ onSelect }: SearchBoxProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<LocationRow[]>([])
  const [loading, setLoading] = useState(false)
  const [focused, setFocused] = useState(false)
  const debounceRef = useRef<number | null>(null)
  const { user } = useAuth()

  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current)
    if (!query.trim()) {
      setResults([])
      setLoading(false)
      return
    }
    setLoading(true)
    debounceRef.current = window.setTimeout(async () => {
      const r = await searchLocations(query, 8)
      setResults(r)
      setLoading(false)
    }, 220)
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current)
    }
  }, [query])

  function pick(loc: LocationRow) {
    setQuery(loc.name)
    setFocused(false)
    if (user) {
      void recordSearch(user.id, { id: loc.id, name: loc.name, municipality: loc.municipality }, loc.name)
    }
    onSelect?.(loc)
  }

  const showResults = focused && (loading || results.length > 0 || query.trim().length > 0)

  return (
    <div className="relative">
      <div className="flex items-center gap-2 rounded-2xl bg-white px-4 py-3 shadow-card">
        <Search size={22} className="text-ocean-600" />
        <input
          type="text"
          inputMode="search"
          autoComplete="off"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder="Saan ka pupunta?"
          aria-label="Search destinations"
          className="w-full bg-transparent text-base text-ocean-900 placeholder:text-ocean-600/60 focus:outline-none"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('')
              setResults([])
            }}
            aria-label="Clear search"
            className="grid h-7 w-7 place-items-center rounded-full text-ocean-500 hover:bg-ocean-50"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {showResults && (
        <div className="absolute inset-x-0 top-full z-20 mt-2 overflow-hidden rounded-2xl bg-white shadow-cardHover">
          {loading && (
            <div className="px-4 py-3 text-sm text-ocean-600">Searching…</div>
          )}
          {!loading && results.length === 0 && query.trim().length > 0 && (
            <div className="px-4 py-4 text-sm text-ocean-700">
              No matching location found.
            </div>
          )}
          {!loading &&
            results.map((loc) => (
              <button
                key={loc.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(loc)}
                className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-ocean-50"
              >
                <MapPin size={18} className="mt-0.5 text-terra-500" />
                <span className="flex-1">
                  <span className="block font-semibold text-ocean-900">{loc.name}</span>
                  <span className="block text-xs text-ocean-600">
                    {typeLabel(loc.type)}
                    {loc.municipality ? ` · ${loc.municipality}` : ''}
                  </span>
                </span>
              </button>
            ))}
        </div>
      )}

      <p className="mt-1 px-1 text-xs text-ocean-700/70">
        Where are you going? — Search places, barangays, terminals, ports & destinations in
        Marinduque.
      </p>
    </div>
  )
}

function typeLabel(t: LocationRow['type']): string {
  return t
    .replace('_', ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}
