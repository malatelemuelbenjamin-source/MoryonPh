import { useEffect, useRef, useState } from 'react'
import { MapPin, X, Search } from 'lucide-react'
import { searchLocationsForRouting } from '../lib/routes'
import type { LocationRow } from '../lib/types'

interface LocationSearchFieldProps {
  label: string
  placeholder: string
  value: LocationRow | null
  onChange: (loc: LocationRow | null) => void
  allowCurrentLocation?: boolean
  onUseCurrentLocation?: () => void
  autoFocus?: boolean
}

export function LocationSearchField({
  label,
  placeholder,
  value,
  onChange,
  allowCurrentLocation = false,
  onUseCurrentLocation,
  autoFocus = false,
}: LocationSearchFieldProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<LocationRow[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const debounceRef = useRef<number | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (value) setQuery(value.name)
    else setQuery('')
  }, [value])

  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current)
    if (!query.trim() || (value && query.trim() === value.name)) {
      setResults([])
      setLoading(false)
      return
    }
    setLoading(true)
    debounceRef.current = window.setTimeout(async () => {
      const r = await searchLocationsForRouting(query, 10)
      setResults(r)
      setLoading(false)
    }, 220)
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current)
    }
  }, [query, value])

  function pick(loc: LocationRow) {
    onChange(loc)
    setOpen(false)
    setQuery(loc.name)
  }

  function clear() {
    onChange(null)
    setQuery('')
    setResults([])
  }

  const showResults =
    open && (loading || results.length > 0 || (query.trim().length > 0 && !value))

  return (
    <div ref={containerRef} className="relative">
      <label className="mb-1 block text-sm font-bold text-ocean-800">{label}</label>
      <div className="flex items-center gap-2 rounded-2xl border border-ocean-100 bg-white px-3 py-3 shadow-card focus-within:border-ocean-400">
        <Search size={20} className="text-ocean-600" />
        <input
          type="text"
          inputMode="search"
          autoComplete="off"
          value={query}
          autoFocus={autoFocus}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 180)}
          onChange={(e) => {
            setQuery(e.target.value)
            if (value) onChange(null)
          }}
          placeholder={placeholder}
          aria-label={label}
          className="w-full bg-transparent text-base text-ocean-900 placeholder:text-ocean-600/60 focus:outline-none"
        />
        {value && (
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={clear}
            aria-label="Clear"
            className="grid h-7 w-7 place-items-center rounded-full text-ocean-500 hover:bg-ocean-50"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {showResults && (
        <div className="absolute inset-x-0 top-full z-30 mt-2 max-h-72 overflow-y-auto rounded-2xl bg-white shadow-cardHover">
          {allowCurrentLocation && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onUseCurrentLocation?.()
                setOpen(false)
              }}
              className="flex w-full items-center gap-3 border-b border-ocean-50 px-4 py-3 text-left hover:bg-ocean-50"
            >
              <span className="grid h-8 w-8 place-items-center rounded-full bg-leaf-400/30 text-leaf-700">
                <MapPin size={16} />
              </span>
              <span className="text-sm font-semibold text-ocean-800">
                Use My Current Location
              </span>
            </button>
          )}

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
                    {loc.barangay ? `${loc.barangay}, ` : ''}
                    {loc.municipality ?? loc.province}
                  </span>
                </span>
              </button>
            ))}
        </div>
      )}
    </div>
  )
}
