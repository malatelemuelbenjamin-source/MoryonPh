import type { MunicipalityEntry } from '../municipalities'
import type { GlobeData } from './globeData'

export type MapLayerId = 'island-outline' | 'municipal-boundaries' | 'barangay-boundaries' | 'commuter-routes' | 'road-network'
export type MapLayerCategoryId = 'administrative-boundaries' | 'transportation'

export interface MapLayerCategory {
  id: MapLayerCategoryId
  label: string
}

export interface MapLayerDefinition {
  id: MapLayerId
  category: MapLayerCategoryId
  name: string
  description: string
  defaultVisible: boolean
  unavailableReason: string
}

export interface LayerAvailability {
  available: boolean
  verified: boolean | null
  sourceNote: string
  attribution: string | null
}

export type LayerAvailabilityMap = Record<MapLayerId, LayerAvailability>
export type LayerPreferences = Record<MapLayerId, boolean>

export const LAYER_COLOR: Record<MapLayerId, string> = {
  'island-outline': '#fde047',
  'municipal-boundaries': '#38bdf8',
  'barangay-boundaries': '#a3e635',
  'commuter-routes': '#f59e0b',
  'road-network': '#94a3b8',
}

export const MAP_LAYER_CATEGORIES: MapLayerCategory[] = [
  { id: 'administrative-boundaries', label: 'Administrative boundaries' },
  { id: 'transportation', label: 'Transportation' },
]

export const MAP_LAYERS: MapLayerDefinition[] = [
  {
    id: 'island-outline',
    category: 'administrative-boundaries',
    name: 'Marinduque Island outline',
    description: 'Island coastline from the published island boundary.',
    defaultVisible: true,
    unavailableReason: 'No island outline has been published yet.',
  },
  {
    id: 'municipal-boundaries',
    category: 'administrative-boundaries',
    name: 'Municipality boundaries',
    description: 'Published boundaries of the municipalities.',
    defaultVisible: true,
    unavailableReason: 'No municipality boundary has been published yet.',
  },
  {
    id: 'barangay-boundaries',
    category: 'administrative-boundaries',
    name: 'Barangay boundaries',
    description: 'Verified barangay boundaries from approved uploads.',
    defaultVisible: true,
    unavailableReason:
      'No verified barangay boundary has been published yet. Barangay boundaries appear after an approved upload is published.',
  },
  {
    id: 'commuter-routes',
    category: 'transportation',
    name: 'Commuter routes',
    description: 'Published commuter routes with their stops.',
    defaultVisible: true,
    unavailableReason: 'No commuter routes have been published yet.',
  },
  {
    id: 'road-network',
    category: 'transportation',
    name: 'Road network',
    description: 'Roads from OpenStreetMap. Zoom in to load more detail.',
    defaultVisible: true,
    unavailableReason: 'No road network has been published yet.',
  },
]

export const MAP_LAYER_IDS: MapLayerId[] = MAP_LAYERS.map((layer) => layer.id)

export function buildLayerAvailability(globe: GlobeData, municipalities: MunicipalityEntry[]): LayerAvailabilityMap {
  const island = globe.islandOutline
  const municipalCount = municipalities.filter((entry) => entry.boundary).length
  const barangayCount = globe.barangayBoundaries.length
  const routeCount = globe.routes.filter((route) => route.path.length >= 2).length
  const roads = globe.roadVersion
  return {
    'island-outline': {
      available: island !== null,
      verified: island ? island.verificationStatus === 'verified' : null,
      sourceNote: island ? `Source: ${island.sourceName}` : 'No source published',
      attribution: null,
    },
    'municipal-boundaries': {
      available: municipalCount > 0,
      verified: municipalCount > 0 ? true : null,
      sourceNote: 'Published boundaries, verified before publication',
      attribution: null,
    },
    'barangay-boundaries': {
      available: barangayCount > 0,
      verified: barangayCount > 0 ? true : null,
      sourceNote: 'Verified barangay datasets from the import pipeline',
      attribution: null,
    },
    'commuter-routes': {
      available: routeCount > 0,
      verified: null,
      sourceNote: 'Published route data',
      attribution: null,
    },
    'road-network': {
      available: roads !== null,
      verified: roads ? true : null,
      sourceNote: roads ? `${roads.roadCount.toLocaleString()} roads in the published version` : 'No road version published',
      attribution: roads ? roads.attribution : null,
    },
  }
}

export function verificationLabel(verified: boolean | null): string {
  if (verified === true) return 'Verified'
  if (verified === false) return 'Unverified'
  return 'Verification not recorded'
}

const LAYER_PREFERENCES_KEY = 'moryongo.mapLayers'

export function defaultLayerPreferences(): LayerPreferences {
  return Object.fromEntries(MAP_LAYERS.map((layer) => [layer.id, layer.defaultVisible])) as LayerPreferences
}

export function loadLayerPreferences(): LayerPreferences {
  const defaults = defaultLayerPreferences()
  const raw = window.localStorage.getItem(LAYER_PREFERENCES_KEY)
  if (!raw) return defaults
  try {
    const saved = JSON.parse(raw) as Partial<Record<MapLayerId, unknown>>
    return Object.fromEntries(
      MAP_LAYER_IDS.map((id) => [id, typeof saved[id] === 'boolean' ? saved[id] : defaults[id]]),
    ) as LayerPreferences
  } catch {
    return defaults
  }
}

export function saveLayerPreferences(preferences: LayerPreferences) {
  window.localStorage.setItem(LAYER_PREFERENCES_KEY, JSON.stringify(preferences))
}

export function resetLayerPreferences() {
  window.localStorage.removeItem(LAYER_PREFERENCES_KEY)
}
