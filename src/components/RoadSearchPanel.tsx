import { useState, type FormEvent } from 'react'
import { Loader2, X } from 'lucide-react'
import type { MunicipalityEntry } from '../lib/municipalities'
import { ROAD_CLASSES, searchRoads, type RoadSegment } from '../lib/roadNetwork'

interface RoadSearchPanelProps {
  versionId: string
  municipalities: MunicipalityEntry[]
  onSelect: (road: RoadSegment) => void
  onClose: () => void
}

const INPUT_CLASS =
  'w-full rounded-lg border border-ocean-200 px-3 py-2 text-xs text-ocean-900 focus:outline-none focus:ring-2 focus:ring-ocean-300'

export function RoadSearchPanel({ versionId, municipalities, onSelect, onClose }: RoadSearchPanelProps) {
  const [name, setName] = useState('')
  const [classification, setClassification] = useState('')
  const [municipalityId, setMunicipalityId] = useState('')
  const [results, setResults] = useState<RoadSegment[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const municipalityName = (id: string | null) => municipalities.find((entry) => entry.record.id === id)?.record.name ?? 'Unassigned'

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setSearching(true)
    setError(null)
    try {
      setResults(await searchRoads(versionId, { name, classification, municipalityId }))
    } catch (err) {
      setResults(null)
      setError(err instanceof Error ? err.message : 'Road search failed. Try again.')
    } finally {
      setSearching(false)
    }
  }

  return (
    <div className="absolute inset-x-3 top-3 z-20 flex max-h-[70%] flex-col gap-3 overflow-y-auto rounded-xl bg-white p-3 shadow-cardHover">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-ocean-900">Find a road</p>
        <button type="button" aria-label="Close road search" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full text-ocean-700 hover:bg-ocean-50">
          <X size={16} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="grid gap-2 sm:grid-cols-3">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Road name"
          aria-label="Road name"
          className={INPUT_CLASS}
        />
        <select value={classification} onChange={(e) => setClassification(e.target.value)} aria-label="Road type" className={INPUT_CLASS}>
          <option value="">All road types</option>
          {ROAD_CLASSES.map((value) => (
            <option key={value} value={value}>{value.replace('_', ' ')}</option>
          ))}
        </select>
        <select value={municipalityId} onChange={(e) => setMunicipalityId(e.target.value)} aria-label="Municipality" className={INPUT_CLASS}>
          <option value="">All municipalities</option>
          {municipalities.map((entry) => (
            <option key={entry.record.id} value={entry.record.id}>{entry.record.name}</option>
          ))}
        </select>
        <button type="submit" disabled={searching} className="btn-primary text-xs sm:col-span-3">
          {searching ? <span className="inline-flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Searching…</span> : 'Search roads'}
        </button>
      </form>

      {error && <p role="alert" className="text-xs font-semibold text-red-700">{error}</p>}

      {results && results.length === 0 && <p className="text-xs text-ocean-700">No roads match these filters.</p>}

      {results && results.length > 0 && (
        <ul className="flex flex-col divide-y divide-ocean-100">
          {results.map((road) => (
            <li key={road.id}>
              <button
                type="button"
                onClick={() => onSelect(road)}
                className="flex w-full flex-col items-start gap-0.5 py-2 text-left transition hover:bg-ocean-50"
              >
                <span className="text-sm font-semibold text-ocean-900">{road.road_name}</span>
                <span className="text-xs text-ocean-600">
                  {road.road_classification?.replace('_', ' ') ?? 'Road type not recorded'} · {municipalityName(road.municipality_id)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
