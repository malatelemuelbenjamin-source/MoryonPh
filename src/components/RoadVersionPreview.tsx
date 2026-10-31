import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import type { MunicipalityEntry } from '../lib/municipalities'
import { fetchRoadPreview, type RoadSegment } from '../lib/roadNetwork'

interface RoadVersionPreviewProps {
  versionId: string
  municipalities: MunicipalityEntry[]
}

const FLAG_LABEL: Record<string, string> = {
  missing_name: 'No name in source',
  outside_municipal_boundaries: 'Outside municipal boundaries',
}

export function RoadVersionPreview({ versionId, municipalities }: RoadVersionPreviewProps) {
  const [roads, setRoads] = useState<RoadSegment[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchRoadPreview(versionId)
      .then((rows) => {
        if (!cancelled) setRoads(rows)
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message)
      })
    return () => {
      cancelled = true
    }
  }, [versionId])

  if (error) return <p role="alert" className="text-xs font-semibold text-red-700">{error}</p>
  if (!roads) {
    return (
      <p className="flex items-center gap-2 text-xs text-ocean-700">
        <Loader2 size={14} className="animate-spin" /> Loading preview…
      </p>
    )
  }
  if (roads.length === 0) return <p className="text-xs text-ocean-700">This version has no roads to preview.</p>

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-bold text-ocean-700">First {roads.length} roads (sorted by name)</p>
      <ul className="divide-y divide-ocean-100 rounded-lg border border-ocean-100">
        {roads.map((road) => {
          const municipality = municipalities.find((entry) => entry.record.id === road.municipality_id)?.record.name
          return (
            <li key={road.id} className="flex flex-col gap-0.5 px-3 py-2 text-xs text-ocean-800">
              <span className="font-semibold">{road.road_name ?? 'Unnamed road'}</span>
              <span className="text-ocean-600">
                {road.road_classification ?? 'Type not recorded'} · {municipality ?? 'Unassigned'} · {road.source_feature_id}
              </span>
              {road.quality_flags.length > 0 && (
                <span className="text-amber-700">
                  {road.quality_flags.map((flag) => FLAG_LABEL[flag] ?? flag).join(' · ')}
                </span>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
