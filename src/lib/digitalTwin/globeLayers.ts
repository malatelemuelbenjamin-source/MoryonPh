import type { GlobeData, Position } from './globeData'
import type { Cesium, CesiumViewer } from './globeEngine'

const BOUNDARY_COLOR = '#38bdf8'
const ROUTE_COLOR = '#f59e0b'

function centroid(rings: Position[][]): Position {
  const points = rings.flat()
  const sum = points.reduce<Position>((acc, [lng, lat]) => [acc[0] + lng, acc[1] + lat], [0, 0])
  return [sum[0] / points.length, sum[1] / points.length]
}

export function renderGlobeLayers(viewer: CesiumViewer, Cesium: Cesium, data: GlobeData) {
  viewer.entities.removeAll()

  const boundaryFill = Cesium.Color.fromCssColorString(BOUNDARY_COLOR)
  for (const boundary of data.boundaries ?? []) {
    for (const ring of boundary.rings) {
      viewer.entities.add({
        name: boundary.municipality,
        polygon: {
          hierarchy: Cesium.Cartesian3.fromDegreesArray(ring.flat()),
          material: boundaryFill.withAlpha(0.12),
          outline: true,
          outlineColor: boundaryFill.withAlpha(0.9),
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        },
      })
    }
    if (boundary.rings.length > 0) {
      const [lng, lat] = centroid(boundary.rings)
      viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(lng, lat),
        label: {
          text: boundary.municipality,
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
