import type * as CesiumNamespace from 'cesium'
import { DIGITAL_TWIN_CONFIG } from './config'

export type Cesium = typeof CesiumNamespace
export type CesiumViewer = CesiumNamespace.Viewer
export type SceneMode = '3d' | '2d'

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

export interface GlobeCreationResult {
  viewer: CesiumViewer
  notice: string | null
}

export async function createGlobeViewer(
  container: HTMLElement,
  Cesium: Cesium,
  token: string | null,
): Promise<GlobeCreationResult> {
  const viewer = new Cesium.Viewer(container, {
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

  try {
    if (token) {
      Cesium.Ion.defaultAccessToken = token
      const imagery = await Cesium.IonImageryProvider.fromAssetId(2)
      viewer.imageryLayers.addImageryProvider(imagery)
      try {
        viewer.terrainProvider = await Cesium.createWorldTerrainAsync()
        return { viewer, notice: null }
      } catch {
        return { viewer, notice: 'Terrain data could not be loaded. Showing a flat globe.' }
      }
    }

    const offlineImagery = await Cesium.TileMapServiceImageryProvider.fromUrl(
      Cesium.buildModuleUrl('Assets/Textures/NaturalEarthII'),
    )
    viewer.imageryLayers.addImageryProvider(offlineImagery)
    return {
      viewer,
      notice: 'Showing a basic world map. Add a Cesium token with the key button for satellite imagery and terrain.',
    }
  } catch (error) {
    viewer.destroy()
    throw error
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

export function setSceneMode(viewer: CesiumViewer, mode: SceneMode) {
  if (mode === '2d') viewer.scene.morphTo2D(0.8)
  else viewer.scene.morphTo3D(0.8)
}

export function zoomCamera(viewer: CesiumViewer, direction: 'in' | 'out') {
  const amount = viewer.camera.positionCartographic.height * 0.4
  if (direction === 'in') viewer.camera.zoomIn(amount)
  else viewer.camera.zoomOut(amount)
}
