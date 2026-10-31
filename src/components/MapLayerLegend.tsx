import { LAYER_COLOR, MAP_LAYERS, verificationLabel, type LayerAvailabilityMap, type LayerPreferences } from '../lib/digitalTwin/mapLayers'

interface MapLayerLegendProps {
  availability: LayerAvailabilityMap
  preferences: LayerPreferences
}

export function MapLayerLegend({ availability, preferences }: MapLayerLegendProps) {
  const active = MAP_LAYERS.filter((layer) => availability[layer.id].available && preferences[layer.id])
  if (active.length === 0) return null

  return (
    <div className="absolute bottom-3 left-3 z-10 max-w-[60%] rounded-lg bg-white/95 px-3 py-2 text-xs text-ocean-800 shadow-card">
      <p className="mb-1 font-bold text-ocean-900">Legend</p>
      <ul className="space-y-1">
        {active.map((layer) => (
          <li key={layer.id} className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-4 shrink-0 rounded-sm" style={{ backgroundColor: LAYER_COLOR[layer.id] }} />
            <span className="font-semibold">{layer.name}</span>
            <span className="text-[10px] text-ocean-600">{verificationLabel(availability[layer.id].verified)}</span>
          </li>
        ))}
      </ul>
      {active.map((layer) => {
        const attribution = availability[layer.id].attribution
        return attribution ? (
          <p key={layer.id} className="mt-1.5 border-t border-ocean-100 pt-1.5 text-[10px] text-ocean-600">{attribution}</p>
        ) : null
      })}
    </div>
  )
}
