export interface BoundaryBbox {
  min_lon: number
  max_lon: number
  min_lat: number
  max_lat: number
}

export type MultiPolygonCoordinates = number[][][][]

export interface ValidatedBoundary {
  geometry: { type: 'MultiPolygon'; coordinates: MultiPolygonCoordinates }
  polygonCount: number
  bbox: BoundaryBbox
  warnings: string[]
}

export type BoundaryValidationResult =
  | { ok: true; value: ValidatedBoundary }
  | { ok: false; errors: string[] }

const CRS_OK = /(CRS84|EPSG::?4326)/i
const MAX_ERRORS = 12

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function checkCrs(crs: unknown, errors: string[]) {
  if (crs === undefined || crs === null) return
  const name = isRecord(crs) && isRecord(crs.properties) ? crs.properties.name : undefined
  if (typeof name !== 'string' || !CRS_OK.test(name)) {
    errors.push('Unsupported coordinate system. Only WGS 84 (EPSG:4326 or CRS84) longitude and latitude are accepted.')
  }
}

export function checkPosition(position: unknown, where: string, errors: string[]): position is number[] {
  if (!Array.isArray(position) || position.length < 2 || !position.every((n) => typeof n === 'number' && Number.isFinite(n))) {
    errors.push(`${where} is not a valid coordinate pair.`)
    return false
  }
  const [lon, lat] = position as number[]
  if (lon < -180 || lon > 180 || lat < -90 || lat > 90) {
    errors.push(`${where} is outside valid longitude or latitude ranges (longitude ${lon}, latitude ${lat}).`)
    return false
  }
  return true
}

function checkPolygon(rings: unknown, where: string, errors: string[]): rings is number[][][] {
  if (!Array.isArray(rings) || rings.length === 0) {
    errors.push(`${where} has no rings.`)
    return false
  }
  let valid = true
  rings.forEach((ring: unknown, ringIndex) => {
    const ringWhere = `${where}, ring ${ringIndex + 1}`
    if (!Array.isArray(ring) || ring.length < 4) {
      errors.push(`${ringWhere} needs at least 4 positions.`)
      valid = false
      return
    }
    const positionsValid = ring.every((position, i) => checkPosition(position, `${ringWhere}, position ${i + 1}`, errors))
    if (!positionsValid) {
      valid = false
      return
    }
    const first = ring[0] as number[]
    const last = ring[ring.length - 1] as number[]
    if (first[0] !== last[0] || first[1] !== last[1]) {
      errors.push(`${ringWhere} is not closed. The first and last positions must match.`)
      valid = false
    }
  })
  return valid
}

export function collectPolygons(geometry: unknown, where: string, errors: string[]): number[][][][] {
  if (!isRecord(geometry)) {
    errors.push(`${where} has no geometry.`)
    return []
  }
  if (geometry.type === 'Polygon') {
    return checkPolygon(geometry.coordinates, where, errors) ? [geometry.coordinates as number[][][]] : []
  }
  if (geometry.type === 'MultiPolygon') {
    if (!Array.isArray(geometry.coordinates) || geometry.coordinates.length === 0) {
      errors.push(`${where} is an empty MultiPolygon.`)
      return []
    }
    return geometry.coordinates.flatMap((polygon: unknown, index) =>
      checkPolygon(polygon, `${where}, polygon ${index + 1}`, errors) ? [polygon as number[][][]] : [],
    )
  }
  errors.push(`${where} is a ${String(geometry.type)}. Only Polygon and MultiPolygon are supported.`)
  return []
}

function computeBbox(polygons: number[][][][]): BoundaryBbox {
  let min_lon = Infinity
  let max_lon = -Infinity
  let min_lat = Infinity
  let max_lat = -Infinity
  for (const polygon of polygons) {
    for (const ring of polygon) {
      for (const [lon, lat] of ring) {
        min_lon = Math.min(min_lon, lon)
        max_lon = Math.max(max_lon, lon)
        min_lat = Math.min(min_lat, lat)
        max_lat = Math.max(max_lat, lat)
      }
    }
  }
  return { min_lon, max_lon, min_lat, max_lat }
}

export function validateBoundaryGeoJson(text: string): BoundaryValidationResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { ok: false, errors: ['The file is not valid JSON.'] }
  }
  if (!isRecord(parsed)) {
    return { ok: false, errors: ['The file must contain a GeoJSON object.'] }
  }

  const errors: string[] = []
  checkCrs(parsed.crs, errors)

  let polygons: number[][][][] = []
  if (parsed.type === 'FeatureCollection') {
    if (!Array.isArray(parsed.features) || parsed.features.length === 0) {
      errors.push('The FeatureCollection contains no features.')
    } else {
      parsed.features.forEach((feature: unknown, index) => {
        const where = `Feature ${index + 1}`
        if (!isRecord(feature) || feature.type !== 'Feature') {
          errors.push(`${where} is not a valid GeoJSON Feature.`)
          return
        }
        polygons = polygons.concat(collectPolygons(feature.geometry, where, errors))
      })
    }
  } else if (parsed.type === 'Feature') {
    polygons = collectPolygons(parsed.geometry, 'The feature', errors)
  } else {
    polygons = collectPolygons(parsed, 'The geometry', errors)
  }

  if (errors.length === 0 && polygons.length === 0) {
    errors.push('The file contains no polygons.')
  }
  if (errors.length > 0) {
    const truncated = errors.length > MAX_ERRORS
    return { ok: false, errors: errors.slice(0, MAX_ERRORS).concat(truncated ? ['More errors were found. Fix these and try again.'] : []) }
  }

  return {
    ok: true,
    value: {
      geometry: { type: 'MultiPolygon', coordinates: polygons },
      polygonCount: polygons.length,
      bbox: computeBbox(polygons),
      warnings: ['Self-intersections are not checked automatically. Review the preview before publishing.'],
    },
  }
}
