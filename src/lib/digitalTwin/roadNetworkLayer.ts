import { fetchRoadsInView, ROAD_VIEW_LIMIT, type RoadSegment } from '../roadNetwork'
import { LAYER_COLOR } from './mapLayers'
import type { Cesium, CesiumViewer } from './globeEngine'

const ROAD_SOURCE_NAME = 'road-network'
const ALL_ROADS_MAX_HEIGHT_M = 25_000
const ROADS_MAX_HEIGHT_M = 120_000
const LOAD_DEBOUNCE_MS = 350
const FLY_PADDING_DEG = 0.002

export type RoadLoadState =
  | { kind: 'zoom-in' }
  | { kind: 'loading' }
  | { kind: 'loaded'; count: number; truncated: boolean; majorOnly: boolean }
  | { kind: 'error'; message: string }

const ROAD_WIDTH_BY_CLASS: Record<string, number> = {
  motorway: 4,
  trunk: 3.5,
  primary: 3,
  secondary: 2.5,
  tertiary: 2,
}

function getOrCreateSource(viewer: CesiumViewer, Cesium: Cesium) {
  const [existing] = viewer.dataSources.getByName(ROAD_SOURCE_NAME)
  if (existing) return existing
  const source = new Cesium.CustomDataSource(ROAD_SOURCE_NAME)
  viewer.dataSources.add(source)
  return source
}

function renderRoads(source: ReturnType<typeof getOrCreateSource>, Cesium: Cesium, roads: RoadSegment[]) {
  source.entities.removeAll()
  const color = Cesium.Color.fromCssColorString(LAYER_COLOR['road-network']).withAlpha(0.85)
  for (const road of roads) {
    source.entities.add({
      name: road.road_name ?? road.road_classification ?? 'Road',
      polyline: {
        positions: Cesium.Cartesian3.fromDegreesArray(road.display_geometry.coordinates.flat()),
        width: ROAD_WIDTH_BY_CLASS[road.road_classification ?? ''] ?? 1.5,
        material: color,
        clampToGround: true,
      },
    })
  }
}

export function attachRoadNetwork(
  viewer: CesiumViewer,
  Cesium: Cesium,
  versionId: string,
  onState: (state: RoadLoadState) => void,
): () => void {
  const source = getOrCreateSource(viewer, Cesium)
  let timer: number | undefined
  let requestId = 0
  let detached = false

  const load = async () => {
    if (detached || viewer.isDestroyed()) return
    const height = viewer.camera.positionCartographic.height
    if (height > ROADS_MAX_HEIGHT_M) {
      source.entities.removeAll()
      onState({ kind: 'zoom-in' })
      return
    }
    const rectangle = viewer.camera.computeViewRectangle()
    if (!rectangle) return
    const bounds = {
      west: Cesium.Math.toDegrees(rectangle.west),
      south: Cesium.Math.toDegrees(rectangle.south),
      east: Cesium.Math.toDegrees(rectangle.east),
      north: Cesium.Math.toDegrees(rectangle.north),
    }
    const majorOnly = height > ALL_ROADS_MAX_HEIGHT_M
    const current = ++requestId
    onState({ kind: 'loading' })
    try {
      const { roads, truncated } = await fetchRoadsInView(versionId, bounds, majorOnly)
      if (detached || current !== requestId) return
      renderRoads(source, Cesium, roads)
      onState({ kind: 'loaded', count: roads.length, truncated, majorOnly })
    } catch (err) {
      if (detached || current !== requestId) return
      onState({ kind: 'error', message: err instanceof Error ? err.message : 'Roads could not be loaded.' })
    }
  }

  const schedule = () => {
    window.clearTimeout(timer)
    timer = window.setTimeout(() => void load(), LOAD_DEBOUNCE_MS)
  }

  const removeMoveListener = viewer.camera.moveEnd.addEventListener(schedule)
  schedule()

  return () => {
    detached = true
    window.clearTimeout(timer)
    removeMoveListener()
    source.entities.removeAll()
  }
}

export function describeRoadState(state: RoadLoadState | null): string | null {
  if (!state) return null
  if (state.kind === 'zoom-in') return 'Zoom in to load roads.'
  if (state.kind === 'loading') return 'Loading roads…'
  if (state.kind === 'error') return state.message
  if (state.truncated) return `Showing the first ${ROAD_VIEW_LIMIT.toLocaleString()} roads in view. Zoom in for more.`
  if (state.majorOnly) return `Showing ${state.count.toLocaleString()} major roads. Zoom in for all roads.`
  return `Showing ${state.count.toLocaleString()} roads.`
}

export function flyToRoad(viewer: CesiumViewer, Cesium: Cesium, road: RoadSegment) {
  viewer.camera.flyTo({
    destination: Cesium.Rectangle.fromDegrees(
      road.min_lon - FLY_PADDING_DEG,
      road.min_lat - FLY_PADDING_DEG,
      road.max_lon + FLY_PADDING_DEG,
      road.max_lat + FLY_PADDING_DEG,
    ),
    duration: 1.5,
  })
}
