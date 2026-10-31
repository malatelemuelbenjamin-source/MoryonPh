import {
  EXAGGERATION_OPTIONS,
  FALLBACK_IMAGERY_ID,
  IMAGERY_PROVIDERS,
  type ImageryProviderId,
} from './mapProviders'

export interface MapSettings {
  imageryId: ImageryProviderId
  terrainEnabled: boolean
  exaggeration: number
  terrainDepthTest: boolean
  lowBandwidth: boolean
}

const STORAGE_KEY = 'moryongo.mapSettings'

export function defaultMapSettings(hasToken: boolean): MapSettings {
  return {
    imageryId: hasToken ? 'ion-aerial' : FALLBACK_IMAGERY_ID,
    terrainEnabled: true,
    exaggeration: 1,
    terrainDepthTest: true,
    lowBandwidth: false,
  }
}

function isImageryId(value: unknown): value is ImageryProviderId {
  return IMAGERY_PROVIDERS.some((provider) => provider.id === value)
}

function isExaggeration(value: unknown): value is number {
  return (EXAGGERATION_OPTIONS as readonly unknown[]).includes(value)
}

export function loadMapSettings(hasToken: boolean): MapSettings {
  const defaults = defaultMapSettings(hasToken)
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) return defaults
  try {
    const saved = JSON.parse(raw) as Partial<Record<keyof MapSettings, unknown>>
    return {
      imageryId: isImageryId(saved.imageryId) ? saved.imageryId : defaults.imageryId,
      terrainEnabled: typeof saved.terrainEnabled === 'boolean' ? saved.terrainEnabled : defaults.terrainEnabled,
      exaggeration: isExaggeration(saved.exaggeration) ? saved.exaggeration : defaults.exaggeration,
      terrainDepthTest: typeof saved.terrainDepthTest === 'boolean' ? saved.terrainDepthTest : defaults.terrainDepthTest,
      lowBandwidth: typeof saved.lowBandwidth === 'boolean' ? saved.lowBandwidth : defaults.lowBandwidth,
    }
  } catch {
    return defaults
  }
}

export function saveMapSettings(settings: MapSettings) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}

export function resetMapSettings() {
  window.localStorage.removeItem(STORAGE_KEY)
}
