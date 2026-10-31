import type * as CesiumNamespace from 'cesium'
import { DIGITAL_TWIN_CONFIG } from './config'
import {
  FALLBACK_IMAGERY_ID,
  ION_AERIAL_ASSET_ID,
  OPENSTREETMAP_TILE_URL,
  canUseImagery,
  type ImageryProviderId,
} from './mapProviders'
import type { MapSettings } from './mapSettings'
import { canShowOnGlobe, type MunicipalityEntry } from '../municipalities'

export type Cesium = typeof CesiumNamespace
export type CesiumViewer = CesiumNamespace.Viewer
export type SceneMode = '3d' | '2d'
type ImageryProviderInstance = CesiumNamespace.ImageryProvider
type TerrainProviderInstance = CesiumNamespace.TerrainProvider

const IMAGERY_FAILURE_LIMIT = 10
const DETAIL_SCREEN_ERROR = 2
const LOW_BANDWIDTH_SCREEN_ERROR = 4

let cesiumPromise: Promise<Cesium> | null = null

export function loadCesium(): Promise<Cesium> {
  if (!cesiumPromise) {
    cesiumPromise = Promise.all([
      import('cesium'),
      import('cesium/Build/Cesium/Widgets/widgets.css'),
    ])
      .then(([cesium]) => cesium)
      .catch((error: unknown) => {
        cesiumPromise = null
        throw error
      })
  }
  return cesiumPromise
}

export function hasWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas')
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'))
  } catch {
    return false
  }
}

export function createGlobeViewer(container: HTMLElement, Cesium: Cesium): CesiumViewer {
  return new Cesium.Viewer(container, {
    baseLayer: false,
    animation: false,
    timeline: false,
    baseLayerPicker: false,
    geocoder: false,
    homeButton: false,
    sceneModePicker: false,
    navigationHelpButton: false,
    fullscreenButton: false,
    infoBox: false,
    selectionIndicator: false,
  })
}

export interface AppliedMapState {
  imageryId: ImageryProviderId
  imageryIsFallback: boolean
  terrainActive: boolean
  messages: string[]
}

async function createImageryProvider(
  Cesium: Cesium,
  id: ImageryProviderId,
): Promise<ImageryProviderInstance> {
  if (id === 'ion-aerial') {
    return Cesium.IonImageryProvider.fromAssetId(ION_AERIAL_ASSET_ID)
  }
  if (id === 'openstreetmap') {
    return new Cesium.OpenStreetMapImageryProvider({ url: OPENSTREETMAP_TILE_URL })
  }
  return Cesium.TileMapServiceImageryProvider.fromUrl(
    Cesium.buildModuleUrl('Assets/Textures/NaturalEarthII'),
  )
}

async function resolveImagery(
  Cesium: Cesium,
  id: ImageryProviderId,
): Promise<{ provider: ImageryProviderInstance; id: ImageryProviderId; isFallback: boolean }> {
  try {
    return { provider: await createImageryProvider(Cesium, id), id, isFallback: false }
  } catch (error) {
    if (id === FALLBACK_IMAGERY_ID) throw error
    return {
      provider: await createImageryProvider(Cesium, FALLBACK_IMAGERY_ID),
      id: FALLBACK_IMAGERY_ID,
      isFallback: true,
    }
  }
}

function watchImageryFailures(
  viewer: CesiumViewer,
  Cesium: Cesium,
  provider: ImageryProviderInstance,
  onFallback: (message: string) => void,
) {
  let failures = 0
  let switched = false
  provider.errorEvent.addEventListener(async () => {
    failures += 1
    if (switched || failures < IMAGERY_FAILURE_LIMIT || viewer.isDestroyed()) return
    switched = true
    viewer.imageryLayers.removeAll(true)
    const fallback = await createImageryProvider(Cesium, FALLBACK_IMAGERY_ID)
    if (viewer.isDestroyed()) return
    viewer.imageryLayers.addImageryProvider(fallback)
    onFallback('Aerial imagery stopped loading, so the basic world map is shown instead.')
  })
}

async function resolveTerrain(
  Cesium: Cesium,
  enabled: boolean,
  token: string | null,
): Promise<{ provider: TerrainProviderInstance; active: boolean; message: string | null }> {
  const flat = new Cesium.EllipsoidTerrainProvider()
  if (!enabled) return { provider: flat, active: false, message: null }
  if (!token) {
    return { provider: flat, active: false, message: 'Terrain needs a Cesium token. The globe is shown flat.' }
  }
  try {
    return { provider: await Cesium.createWorldTerrainAsync(), active: true, message: null }
  } catch {
    return { provider: flat, active: false, message: 'Terrain data could not be loaded. The globe is shown flat.' }
  }
}

export async function applyMapSettings(
  viewer: CesiumViewer,
  Cesium: Cesium,
  settings: MapSettings,
  token: string | null,
  onImageryFallback: (message: string) => void,
): Promise<AppliedMapState> {
  if (token) Cesium.Ion.defaultAccessToken = token
  const messages: string[] = []

  const requestedId = canUseImagery(settings.imageryId, Boolean(token)) ? settings.imageryId : FALLBACK_IMAGERY_ID
  if (requestedId !== settings.imageryId) {
    messages.push('Aerial imagery needs a Cesium token. The basic world map is shown instead.')
  }

  const imagery = await resolveImagery(Cesium, requestedId)
  if (viewer.isDestroyed()) throw new Error('Globe was closed while loading.')
  if (imagery.isFallback) {
    messages.push('The selected imagery could not be loaded. The basic world map is shown instead.')
  }
  viewer.imageryLayers.removeAll(true)
  viewer.imageryLayers.addImageryProvider(imagery.provider)
  if (imagery.id !== FALLBACK_IMAGERY_ID) {
    watchImageryFailures(viewer, Cesium, imagery.provider, onImageryFallback)
  }

  const terrain = await resolveTerrain(Cesium, settings.terrainEnabled, token)
  if (viewer.isDestroyed()) throw new Error('Globe was closed while loading.')
  if (terrain.message) messages.push(terrain.message)
  viewer.terrainProvider = terrain.provider

  viewer.scene.verticalExaggeration = settings.exaggeration
  viewer.scene.globe.depthTestAgainstTerrain = terrain.active && settings.terrainDepthTest
  viewer.scene.globe.maximumScreenSpaceError = settings.lowBandwidth
    ? LOW_BANDWIDTH_SCREEN_ERROR
    : DETAIL_SCREEN_ERROR

  return {
    imageryId: imagery.id,
    imageryIsFallback: imagery.isFallback,
    terrainActive: terrain.active,
    messages,
  }
}

export function flyToMarinduque(viewer: CesiumViewer, Cesium: Cesium, duration = 1.5) {
  const { latitude, longitude } = DIGITAL_TWIN_CONFIG.marinduqueCenter
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(longitude, latitude, DIGITAL_TWIN_CONFIG.initialCameraHeightMeters),
    orientation: { heading: 0, pitch: Cesium.Math.toRadians(-90), roll: 0 },
    duration,
  })
}

const MUNICIPALITY_VIEW_PADDING_DEGREES = 0.02
const MUNICIPALITY_CENTER_HEIGHT_METERS = 25000

export function flyToMunicipality(viewer: CesiumViewer, Cesium: Cesium, entry: MunicipalityEntry, duration = 1.5): boolean {
  if (!canShowOnGlobe(entry)) return false
  if (entry.boundary) {
    const { min_lon, min_lat, max_lon, max_lat } = entry.boundary.bbox
    const pad = MUNICIPALITY_VIEW_PADDING_DEGREES
    viewer.camera.flyTo({
      destination: Cesium.Rectangle.fromDegrees(min_lon - pad, min_lat - pad, max_lon + pad, max_lat + pad),
      duration,
    })
    return true
  }
  const { center_lon: longitude, center_lat: latitude } = entry.record
  if (longitude === null || latitude === null) return false
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(longitude, latitude, MUNICIPALITY_CENTER_HEIGHT_METERS),
    orientation: { heading: 0, pitch: Cesium.Math.toRadians(-90), roll: 0 },
    duration,
  })
  return true
}

export function setSceneMode(viewer: CesiumViewer, mode: SceneMode) {
  if (mode === '2d') viewer.scene.morphTo2D(0.8)
  else viewer.scene.morphTo3D(0.8)
}

export function zoomCamera(viewer: CesiumViewer, direction: 'in' | 'out') {
  const amount = viewer.camera.positionCartographic.height * 0.4
  if (direction === 'in') viewer.camera.zoomIn(amount)
  else viewer.camera.zoomOut(amount)
}
