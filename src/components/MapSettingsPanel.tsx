import { X } from 'lucide-react'
import type { AppliedMapState } from '../lib/digitalTwin/globeEngine'
import { availableImageryProviders, EXAGGERATION_OPTIONS, getImageryProviderInfo, TERRAIN_PROVIDER_INFO } from '../lib/digitalTwin/mapProviders'
import type { MapSettings } from '../lib/digitalTwin/mapSettings'

interface MapSettingsPanelProps {
  settings: MapSettings
  hasToken: boolean
  applied: AppliedMapState | null
  onChange: (next: MapSettings) => void
  onReset: () => void
  onClose: () => void
}

const SECTION_LABEL = 'text-xs font-bold uppercase tracking-wide text-ocean-600'
const OPTION_BASE = 'rounded-lg border px-3 py-2 text-left text-xs font-semibold transition active:scale-[0.98]'
const OPTION_ON = 'border-ocean-700 bg-ocean-700 text-white'
const OPTION_OFF = 'border-ocean-200 bg-white text-ocean-800 hover:border-ocean-400'

function ToggleRow({ label, hint, pressed, disabled, onToggle }: {
  label: string
  hint?: string
  pressed: boolean
  disabled?: boolean
  onToggle: () => void
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs font-semibold text-ocean-900">{label}</p>
        {hint && <p className="text-[11px] text-ocean-600">{hint}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={pressed}
        aria-label={label}
        disabled={disabled}
        onClick={onToggle}
        className={`relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-40 ${pressed ? 'bg-ocean-700' : 'bg-ocean-200'}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${pressed ? 'translate-x-5' : 'translate-x-0.5'}`}
        />
      </button>
    </div>
  )
}

export function MapSettingsPanel({ settings, hasToken, applied, onChange, onReset, onClose }: MapSettingsPanelProps) {
  const imageryOptions = availableImageryProviders(hasToken)
  const activeImagery = applied ? getImageryProviderInfo(applied.imageryId) : null

  return (
    <div className="absolute inset-x-3 top-3 z-20 max-h-[calc(100%-1.5rem)] space-y-4 overflow-y-auto rounded-xl bg-white p-4 shadow-cardHover">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-ocean-900">Map settings</p>
        <button type="button" aria-label="Close map settings" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full text-ocean-700 hover:bg-ocean-50">
          <X size={16} />
        </button>
      </div>

      <div className="space-y-2">
        <p className={SECTION_LABEL}>Imagery</p>
        <div role="radiogroup" aria-label="Imagery" className="grid gap-2">
          {imageryOptions.map((option) => {
            const selected = settings.imageryId === option.id
            return (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onChange({ ...settings, imageryId: option.id })}
                className={`${OPTION_BASE} ${selected ? OPTION_ON : OPTION_OFF}`}
              >
                {option.label}
              </button>
            )
          })}
        </div>
        {!hasToken && (
          <p className="text-[11px] text-ocean-600">Add a Cesium token with the key button to unlock aerial imagery and terrain.</p>
        )}
      </div>

      <div className="space-y-3">
        <p className={SECTION_LABEL}>Terrain</p>
        <ToggleRow
          label="Show hills and elevation"
          hint={hasToken ? TERRAIN_PROVIDER_INFO.label : 'Needs a Cesium token'}
          pressed={settings.terrainEnabled && hasToken}
          disabled={!hasToken}
          onToggle={() => onChange({ ...settings, terrainEnabled: !settings.terrainEnabled })}
        />
        <div className="space-y-2">
          <p className="text-xs font-semibold text-ocean-900">Height exaggeration</p>
          <div role="radiogroup" aria-label="Height exaggeration" className="grid grid-cols-4 gap-2">
            {EXAGGERATION_OPTIONS.map((value) => {
              const selected = settings.exaggeration === value
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => onChange({ ...settings, exaggeration: value })}
                  className={`${OPTION_BASE} text-center ${selected ? OPTION_ON : OPTION_OFF}`}
                >
                  {value}x
                </button>
              )
            })}
          </div>
        </div>
        <ToggleRow
          label="Hide parts behind hills"
          pressed={settings.terrainDepthTest}
          onToggle={() => onChange({ ...settings, terrainDepthTest: !settings.terrainDepthTest })}
        />
        <ToggleRow
          label="Lower detail to save data"
          pressed={settings.lowBandwidth}
          onToggle={() => onChange({ ...settings, lowBandwidth: !settings.lowBandwidth })}
        />
      </div>

      <div className="space-y-2 rounded-lg bg-ocean-50 p-3 text-[11px] leading-relaxed text-ocean-800">
        <p className={SECTION_LABEL}>Currently showing</p>
        {applied ? (
          <>
            <p>
              Imagery: {activeImagery?.label}
              {applied.imageryIsFallback ? ' (fallback)' : ''}. Terrain: {applied.terrainActive ? 'on' : 'off'}.
            </p>
            {activeImagery && <p>Imagery source: {activeImagery.attribution}</p>}
            {activeImagery && <p>Imagery coverage: {activeImagery.coverage}</p>}
            {applied.terrainActive && <p>Terrain source: {TERRAIN_PROVIDER_INFO.attribution}</p>}
            {applied.terrainActive && <p>Terrain coverage: {TERRAIN_PROVIDER_INFO.coverage}</p>}
          </>
        ) : (
          <p>Applying settings…</p>
        )}
        <p>Municipality outlines are approximate open-data shapes, not official boundaries.</p>
      </div>

      <button type="button" onClick={onReset} className="btn-secondary w-full text-xs">
        Reset to defaults
      </button>
    </div>
  )
}
