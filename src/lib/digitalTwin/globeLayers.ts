import type { MunicipalityEntry } from '../municipalities'
import type { GlobeAreaBoundary, GlobeData, GlobeIslandOutline, GlobeRoute, Position } from './globeData'
import { LAYER_COLOR, MAP_LAYER_IDS, type LayerPreferences } from './mapLayers'
import type { Cesium, CesiumViewer } from './globeEngine'

const SELECTED_MUNICIPALITY_COLOR = '#34d399'

function centroid(rings: Position[][]): Position {
  const points = rings.flat()
  const sum = points.reduce<Position>((acc, [lng, lat]) => [acc[0] + lng, acc[1] + lat], [0, 0])
  return [sum[0] / points.length, sum[1] / points.length]
}

function replaceSource(viewer: CesiumViewer, Cesium: Cesium, name: string) {
  for (const existing of viewer.dataSources.getByName(name)) {
    viewer.dataSources.remove(existing, true)
  }
  const source = new Cesium.CustomDataSource(name)
  viewer.dataSources.add(source)
  return source
}

function renderIslandOutline(viewer: CesiumViewer, Cesium: Cesium, outline: GlobeIslandOutline | null) {
  const source = replaceSource(viewer, Cesium, 'island-outline')
  if (!outline) return

  const color = Cesium.Color.fromCssColorString(LAYER_COLOR['island-outline'])
  const material = outline.verificationStatus === 'verified'
    ? color
    : new Cesium.PolylineDashMaterialProperty({ color, dashLength: 16 })
  for (const ring of outline.rings) {
    source.entities.add({
      name: outline.label,
      polyline: {
        positions: Cesium.Cartesian3.fromDegreesArray(ring.flat()),
        width: 2.5,
        material,
        clampToGround: true,
      },
    })
  }
}

export function renderMunicipalityBoundaries(
  viewer: CesiumViewer,
  Cesium: Cesium,
  entries: MunicipalityEntry[],
  selectedId: string | null,
) {
  const source = replaceSource(viewer, Cesium, 'municipal-boundaries')
  const baseFill = Cesium.Color.fromCssColorString(LAYER_COLOR['municipal-boundaries'])

  for (const { record, boundary } of entries) {
    if (!boundary) continue
    const selected = record.id === selectedId
    const fill = selected ? Cesium.Color.fromCssColorString(SELECTED_MUNICIPALITY_COLOR) : baseFill
    for (const ring of boundary.rings) {
      source.entities.add({
        name: record.name,
        polygon: {
          hierarchy: Cesium.Cartesian3.fromDegreesArray(ring.flat()),
          material: fill.withAlpha(selected ? 0.35 : 0.12),
          outline: true,
          outlineColor: fill.withAlpha(0.95),
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        },
      })
    }
    if (boundary.rings.length > 0) {
      const [lng, lat] = centroid(boundary.rings)
      source.entities.add({
        position: Cesium.Cartesian3.fromDegrees(lng, lat),
        label: {
          text: record.name,
          font: '600 13px sans-serif',
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 3,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: Cesium.VerticalOrigin.CENTER,
        },
      })
    }
  }
}

function renderBarangayBoundaries(viewer: CesiumViewer, Cesium: Cesium, boundaries: GlobeAreaBoundary[]) {
  const source = replaceSource(viewer, Cesium, 'barangay-boundaries')
  const fill = Cesium.Color.fromCssColorString(LAYER_COLOR['barangay-boundaries'])
  for (const boundary of boundaries) {
    for (const ring of boundary.rings) {
      source.entities.add({
        name: boundary.label,
        polygon: {
          hierarchy: Cesium.Cartesian3.fromDegreesArray(ring.flat()),
          material: fill.withAlpha(0.1),
          outline: true,
          outlineColor: fill.withAlpha(0.9),
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        },
      })
    }
  }
}

function renderCommuterRoutes(viewer: CesiumViewer, Cesium: Cesium, routes: GlobeRoute[]) {
  const source = replaceSource(viewer, Cesium, 'commuter-routes')
  const routeColor = Cesium.Color.fromCssColorString(LAYER_COLOR['commuter-routes'])
  for (const route of routes) {
    if (route.path.length >= 2) {
      source.entities.add({
        name: route.name,
        polyline: {
          positions: Cesium.Cartesian3.fromDegreesArray(route.path.flat()),
          width: 4,
          material: routeColor,
          clampToGround: true,
        },
      })
    }
    for (const stop of route.stops) {
      source.entities.add({
        name: stop.name,
        position: Cesium.Cartesian3.fromDegrees(stop.longitude, stop.latitude),
        point: {
          pixelSize: 8,
          color: Cesium.Color.WHITE,
          outlineColor: routeColor,
          outlineWidth: 2,
        },
      })
    }
  }
}

export function renderGlobeLayers(viewer: CesiumViewer, Cesium: Cesium, data: GlobeData) {
  renderIslandOutline(viewer, Cesium, data.islandOutline)
  renderBarangayBoundaries(viewer, Cesium, data.barangayBoundaries)
  renderCommuterRoutes(viewer, Cesium, data.routes)
}

export function applyLayerVisibility(viewer: CesiumViewer, preferences: LayerPreferences) {
  for (const id of MAP_LAYER_IDS) {
    for (const source of viewer.dataSources.getByName(id)) {
      source.show = preferences[id]
    }
  }
}
