import { useState } from 'react'
import { ChevronDown, ChevronRight, Layers, RefreshCw, RotateCcw, X } from 'lucide-react'
import {
  MAP_LAYER_CATEGORIES,
  MAP_LAYERS,
  verificationLabel,
  type LayerAvailability,
  type LayerAvailabilityMap,
  type LayerPreferences,
  type MapLayerDefinition,
  type MapLayerId,
} from '../lib/digitalTwin/mapLayers'

interface MapLayerPanelProps {
  availability: LayerAvailabilityMap | null
  statusMessage: string | null
  preferences: LayerPreferences
  onToggle: (id: MapLayerId, visible: boolean) => void
  onShowAll: () => void
  onResetDefaults: () => void
  onRetry: () => void
  onClose: () => void
}

const FOOTER_BUTTON = 'rounded-full border border-ocean-200 px-3 py-1.5 text-xs font-semibold text-ocean-800 transition hover:bg-ocean-50'

function LayerRow({
  layer,
  availability,
  visible,
  onToggle,
}: {
  layer: MapLayerDefinition
  availability: LayerAvailability
  visible: boolean
  onToggle: (id: MapLayerId, visible: boolean) => void
}) {
  const on = availability.available && visible
  return (
    <div className="rounded-lg px-2 py-2 hover:bg-ocean-50/60">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ocean-900">{layer.name}</p>
          <p className="text-xs text-ocean-700">{layer.description}</p>
          {availability.available ? (
            <p className="mt-1 text-[11px] text-ocean-600">
              {verificationLabel(availability.verified)} · {availability.sourceNote}
            </p>
          ) : (
            <p className="mt-1 text-[11px] font-semibold text-terra-700">Unavailable. {layer.unavailableReason}</p>
          )}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label={`Show ${layer.name}`}
          disabled={!availability.available}
          onClick={() => onToggle(layer.id, !visible)}
          className={`relative mt-1 h-6 w-11 shrink-0 rounded-full transition disabled:cursor-not-allowed disabled:opacity-40 ${
            on ? 'bg-ocean-600' : 'bg-ocean-200'
          }`}
        >
          <span
            className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${on ? 'translate-x-5' : ''}`}
          />
        </button>
      </div>
    </div>
  )
}

export function MapLayerPanel({
  availability,
  statusMessage,
  preferences,
  onToggle,
  onShowAll,
  onResetDefaults,
  onRetry,
  onClose,
}: MapLayerPanelProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  return (
    <div
      role="dialog"
      aria-label="Map layers"
      className="absolute left-3 top-14 z-10 flex max-h-[calc(100%-7rem)] w-72 flex-col overflow-hidden rounded-xl bg-white shadow-cardHover"
    >
      <div className="flex items-center justify-between border-b border-ocean-100 px-3 py-2">
        <p className="flex items-center gap-2 text-sm font-bold text-ocean-900">
          <Layers size={16} /> Map layers
        </p>
        <button
          type="button"
          aria-label="Hide layers"
          onClick={onClose}
          className="grid h-7 w-7 place-items-center rounded-full text-ocean-700 transition hover:bg-ocean-50"
        >
          <X size={16} />
        </button>
      </div>

      <div className="overflow-y-auto p-2">
        {availability === null ? (
          <p className="p-2 text-xs text-ocean-700">{statusMessage}</p>
        ) : (
          MAP_LAYER_CATEGORIES.map((category) => {
            const isOpen = !collapsed[category.id]
            const layers = MAP_LAYERS.filter((layer) => layer.category === category.id)
            return (
              <div key={category.id} className="mb-1">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setCollapsed((prev) => ({ ...prev, [category.id]: isOpen }))}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs font-bold uppercase tracking-wide text-ocean-700 transition hover:bg-ocean-50"
                >
                  {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  {category.label}
                </button>
                {isOpen &&
                  layers.map((layer) => (
                    <LayerRow
                      key={layer.id}
                      layer={layer}
                      availability={availability[layer.id]}
                      visible={preferences[layer.id]}
                      onToggle={onToggle}
                    />
                  ))}
              </div>
            )
          })
        )}
      </div>

      <div className="flex flex-wrap gap-2 border-t border-ocean-100 px-3 py-2">
        {availability && (
          <>
            <button type="button" onClick={onShowAll} className={FOOTER_BUTTON}>
              Show all
            </button>
            <button type="button" onClick={onResetDefaults} className={`${FOOTER_BUTTON} flex items-center gap-1`}>
              <RotateCcw size={12} /> Defaults
            </button>
          </>
        )}
        <button type="button" onClick={onRetry} className={`${FOOTER_BUTTON} flex items-center gap-1`}>
          <RefreshCw size={12} /> Reload data
        </button>
      </div>
    </div>
  )
}
