import type { MunicipalityEntry } from '../municipalities'
import type { GlobeAreaBoundary, GlobeData, GlobeIslandOutline, Position } from './globeData'
import type { Cesium, CesiumViewer } from './globeEngine'

const MUNICIPALITY_COLOR = '#38bdf8'
const SELECTED_MUNICIPALITY_COLOR = '#34d399'
const ROUTE_COLOR = '#f59e0b'
const ISLAND_COLOR = '#fde047'
const ISLAND_SOURCE_NAME = 'island-outline'
const BARANGAY_SOURCE_NAME = 'barangay-boundaries'
const BARANGAY_COLOR = '#a3e635'
const MUNICIPALITY_SOURCE_NAME = 'municipality-boundaries'

function centroid(rings: Position[][]): Position {
  const points = rings.flat()
  const sum = points.reduce<Position>((acc, [lng, lat]) => [acc[0] + lng, acc[1] + lat], [0, 0])
  return [sum[0] / points.length, sum[1] / points.length]
}

function renderIslandOutline(viewer: CesiumViewer, Cesium: Cesium, outline: GlobeIslandOutline | null) {
  for (const existing of viewer.dataSources.getByName(ISLAND_SOURCE_NAME)) {
    viewer.dataSources.remove(existing, true)
  }
  if (!outline) return

  const color = Cesium.Color.fromCssColorString(ISLAND_COLOR)
  const material = outline.verificationStatus === 'verified'
    ? color
    : new Cesium.PolylineDashMaterialProperty({ color, dashLength: 16 })
  const source = new Cesium.CustomDataSource(ISLAND_SOURCE_NAME)
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
  viewer.dataSources.add(source)
}

export function setIslandOutlineVisible(viewer: CesiumViewer, visible: boolean) {
  for (const source of viewer.dataSources.getByName(ISLAND_SOURCE_NAME)) {
    source.show = visible
  }
}

export function renderMunicipalityBoundaries(
  viewer: CesiumViewer,
  Cesium: Cesium,
  entries: MunicipalityEntry[],
  selectedId: string | null,
) {
  for (const existing of viewer.dataSources.getByName(MUNICIPALITY_SOURCE_NAME)) {
    viewer.dataSources.remove(existing, true)
  }
  const source = new Cesium.CustomDataSource(MUNICIPALITY_SOURCE_NAME)

  for (const { record, boundary } of entries) {
    if (!boundary) continue
    const selected = record.id === selectedId
    const fill = Cesium.Color.fromCssColorString(selected ? SELECTED_MUNICIPALITY_COLOR : MUNICIPALITY_COLOR)
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
  viewer.dataSources.add(source)
}

export function renderBarangayBoundaries(viewer: CesiumViewer, Cesium: Cesium, boundaries: GlobeAreaBoundary[]) {
  for (const existing of viewer.dataSources.getByName(BARANGAY_SOURCE_NAME)) {
    viewer.dataSources.remove(existing, true)
  }
  const source = new Cesium.CustomDataSource(BARANGAY_SOURCE_NAME)
  const fill = Cesium.Color.fromCssColorString(BARANGAY_COLOR)
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
  viewer.dataSources.add(source)
}

export function renderGlobeLayers(viewer: CesiumViewer, Cesium: Cesium, data: GlobeData) {
  viewer.entities.removeAll()
  renderIslandOutline(viewer, Cesium, data.islandOutline)
  renderBarangayBoundaries(viewer, Cesium, data.barangayBoundaries)

  const routeColor = Cesium.Color.fromCssColorString(ROUTE_COLOR)
  for (const route of data.routes) {
    if (route.path.length >= 2) {
      viewer.entities.add({
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
      viewer.entities.add({
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
