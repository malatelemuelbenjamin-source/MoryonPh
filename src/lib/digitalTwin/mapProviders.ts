export type ImageryProviderId = 'natural-earth' | 'ion-aerial' | 'openstreetmap'

export const FALLBACK_IMAGERY_ID: ImageryProviderId = 'natural-earth'
export const ION_AERIAL_ASSET_ID = 2
export const OPENSTREETMAP_TILE_URL = 'https://tile.openstreetmap.org/'
export const EXAGGERATION_OPTIONS = [1, 1.5, 2, 3] as const

export interface ImageryProviderInfo {
  id: ImageryProviderId
  label: string
  requiresToken: boolean
  attribution: string
  coverage: string
}

export const IMAGERY_PROVIDERS: readonly ImageryProviderInfo[] = [
  {
    id: 'natural-earth',
    label: 'Basic world map',
    requiresToken: false,
    attribution: 'Natural Earth II, public domain. Bundled with the Cesium library.',
    coverage: 'Worldwide, low resolution. Shows no roads or local detail.',
  },
  {
    id: 'ion-aerial',
    label: 'Aerial imagery',
    requiresToken: true,
    attribution: 'Bing Maps Aerial, served through Cesium ion. Credits are shown on the globe.',
    coverage: 'Worldwide aerial coverage. Resolution varies, and rural areas such as parts of Marinduque may be lower resolution or older.',
  },
  {
    id: 'openstreetmap',
    label: 'Street map',
    requiresToken: false,
    attribution: '© OpenStreetMap contributors (ODbL). Tile use follows the OpenStreetMap tile usage policy.',
    coverage: 'Worldwide. Detail depends on local OpenStreetMap contributions.',
  },
]

export const TERRAIN_PROVIDER_INFO = {
  label: 'Cesium World Terrain',
  requiresToken: true,
  attribution: 'Terrain: Cesium World Terrain, served through Cesium ion, built from public elevation data.',
  coverage: 'Worldwide. Elevation detail varies by area, and rural areas may be coarser than urban areas.',
} as const

export function getImageryProviderInfo(id: ImageryProviderId): ImageryProviderInfo {
  return IMAGERY_PROVIDERS.find((provider) => provider.id === id) ?? IMAGERY_PROVIDERS[0]
}

export function canUseImagery(id: ImageryProviderId, hasToken: boolean): boolean {
  return !getImageryProviderInfo(id).requiresToken || hasToken
}

export function availableImageryProviders(hasToken: boolean): ImageryProviderInfo[] {
  return IMAGERY_PROVIDERS.filter((provider) => canUseImagery(provider.id, hasToken))
}
