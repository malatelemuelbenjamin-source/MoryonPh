import {
  fetchPublishedBoundariesByKind,
  fetchPublishedBoundary,
  ISLAND_OUTLINE_KEY,
  type VerificationStatus,
} from '../geographicBoundaries'
import { fetchMapRoutes, fetchRouteGeometry, fetchRouteStopsForMap } from '../transportMap'

export type Position = [number, number]

export interface GlobeStop {
  id: string
  name: string
  longitude: number
  latitude: number
}

export interface GlobeRoute {
  id: string
  name: string
  code: string | null
  mode: string | null
  path: Position[]
  stops: GlobeStop[]
}

export interface GlobeIslandOutline {
  label: string
  verificationStatus: VerificationStatus
  sourceName: string
  rings: Position[][]
}

export interface GlobeAreaBoundary {
  key: string
  label: string
  rings: Position[][]
}

export interface GlobeData {
  islandOutline: GlobeIslandOutline | null
  barangayBoundaries: GlobeAreaBoundary[]
  routes: GlobeRoute[]
}

function isPosition(value: unknown): value is Position {
  return Array.isArray(value) && value.length >= 2 && typeof value[0] === 'number' && typeof value[1] === 'number'
}

function unwrapGeometry(data: unknown): { type?: unknown; coordinates?: unknown } | null {
  if (!data || typeof data !== 'object') return null
  const obj = data as { type?: unknown; geometry?: unknown; coordinates?: unknown }
  if (obj.type === 'Feature') return unwrapGeometry(obj.geometry)
  return obj
}

function linePath(data: unknown): Position[] {
  const geom = unwrapGeometry(data)
  if (!geom) return []
  let lines: unknown[]
  if (geom.type === 'LineString') lines = [geom.coordinates]
  else if (geom.type === 'MultiLineString' && Array.isArray(geom.coordinates)) lines = geom.coordinates
  else return []
  return lines.flatMap((line) =>
    Array.isArray(line) && line.every(isPosition) ? (line as Position[]) : [],
  )
}

export function allMultiPolygonRings(data: unknown): Position[][] {
  const geom = unwrapGeometry(data)
  if (!geom || geom.type !== 'MultiPolygon' || !Array.isArray(geom.coordinates)) return []
  return geom.coordinates.flatMap((polygon: unknown) => {
    if (!Array.isArray(polygon)) return []
    return polygon.flatMap((ring: unknown) =>
      Array.isArray(ring) && ring.length >= 4 && ring.every(isPosition) ? [ring as Position[]] : [],
    )
  })
}

async function fetchIslandOutline(): Promise<GlobeIslandOutline | null> {
  const boundary = await fetchPublishedBoundary(ISLAND_OUTLINE_KEY)
  if (!boundary) return null
  const rings = allMultiPolygonRings(boundary.geometry_data)
  if (rings.length === 0) return null
  return {
    label: boundary.label,
    verificationStatus: boundary.verification_status,
    sourceName: boundary.source?.name ?? 'Unknown source',
    rings,
  }
}

async function fetchBarangayBoundaries(): Promise<GlobeAreaBoundary[]> {
  const boundaries = await fetchPublishedBoundariesByKind('barangay_boundary')
  return boundaries.flatMap((boundary) => {
    const rings = allMultiPolygonRings(boundary.geometry_data)
    return rings.length > 0 ? [{ key: boundary.boundary_key, label: boundary.label, rings }] : []
  })
}

async function fetchGlobeRoutes(): Promise<GlobeRoute[]> {
  const routes = await fetchMapRoutes()
  return Promise.all(
    routes.map(async (route) => {
      const [geometry, stops] = await Promise.all([
        fetchRouteGeometry(route.id),
        fetchRouteStopsForMap(route.id),
      ])
      const globeStops = stops.flatMap((stop) => {
        const location = stop.location
        if (!location || location.latitude == null || location.longitude == null) return []
        return [{ id: stop.id, name: location.name, longitude: location.longitude, latitude: location.latitude }]
      })
      const path = linePath(geometry?.geometry_data)
      return {
        id: route.id,
        name: route.route_name,
        code: route.route_code,
        mode: route.transport_mode?.name ?? null,
        path: path.length >= 2 ? path : globeStops.map((stop): Position => [stop.longitude, stop.latitude]),
        stops: globeStops,
      }
    }),
  )
}

export async function loadGlobeData(): Promise<GlobeData> {
  const [islandOutline, barangayBoundaries, routes] = await Promise.all([
    fetchIslandOutline().catch((err: Error) => {
      console.error('fetchIslandOutline error:', err.message)
      return null
    }),
    fetchBarangayBoundaries().catch((err: Error) => {
      console.error('fetchBarangayBoundaries error:', err.message)
      return []
    }),
    fetchGlobeRoutes(),
  ])
  return { islandOutline, barangayBoundaries, routes }
}
