import { useState } from 'react'
import { AlertTriangle, Loader2, Search } from 'lucide-react'
import { describeBoundaryStatus, filterMunicipalities, type MunicipalityEntry } from '../lib/municipalities'
import { MunicipalityDetailPanel } from './MunicipalityDetailPanel'

export function MunicipalityExplorer({
  entries,
  loadError,
  selectedId,
  onSelect,
}: {
  entries: MunicipalityEntry[] | null
  loadError: string | null
  selectedId: string | null
  onSelect: (id: string | null) => void
}) {
  const [query, setQuery] = useState('')

  if (loadError) {
    return (
      <p role="alert" className="flex items-center gap-2 rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-700">
        <AlertTriangle size={16} /> {loadError}
      </p>
    )
  }

  if (!entries) {
    return (
      <div className="card flex items-center gap-3">
        <Loader2 size={18} className="animate-spin text-ocean-500" />
        <p className="text-sm font-semibold text-ocean-700">Loading municipalities…</p>
      </div>
    )
  }

  const visible = filterMunicipalities(entries, query)
  const selected = entries.find((entry) => entry.record.id === selectedId) ?? null

  return (
    <section className="flex flex-col gap-4" aria-label="Municipality explorer">
      <div>
        <h2 className="text-base font-bold text-ocean-900">Explore the six municipalities</h2>
        <p className="text-sm text-ocean-700">
          Select a municipality to highlight its boundary on the globe. Only verified boundaries are drawn.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)]">
        <div className="flex flex-col gap-3">
          <label className="relative block">
            <span className="sr-only">Search municipalities</span>
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ocean-500" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by name"
              className="input-field pl-9"
            />
          </label>

          {visible.length === 0 ? (
            <p className="card text-sm text-ocean-700">No municipality matches “{query.trim()}”.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {visible.map((entry) => {
                const isSelected = entry.record.id === selectedId
                const status = describeBoundaryStatus(entry)
                return (
                  <li key={entry.record.id}>
                    <button
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => onSelect(entry.record.id)}
                      className={`card flex w-full items-center justify-between gap-3 text-left transition hover:border-ocean-300 active:scale-[0.99] ${
                        isSelected ? 'ring-2 ring-ocean-500' : ''
                      }`}
                    >
                      <span className="text-sm font-bold text-ocean-900">{entry.record.name}</span>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                          status.verified ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900'
                        }`}
                      >
                        {status.label}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {selected ? (
          <MunicipalityDetailPanel
            key={selected.record.id}
            entry={selected}
            onClear={() => onSelect(null)}
            onShowOnGlobe={() => onSelect(selected.record.id)}
          />
        ) : (
          <div className="card flex items-center justify-center p-6 text-center text-sm text-ocean-700">
            Choose a municipality to see its details and show it on the globe.
          </div>
        )}
      </div>
    </section>
  )
}
