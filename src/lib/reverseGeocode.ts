import { supabase } from './supabase'

export interface ReverseGeocodeResult {
  municipality: string | null
  barangay: string | null
  area: string | null
}

interface MunicipalityBoundary {
  name: string
  polygons: number[][][]
}

let boundariesCache: MunicipalityBoundary[] | null = null

async function loadMunicipalityBoundaries(): Promise<MunicipalityBoundary[]> {
  if (boundariesCache) return boundariesCache

  const { data, error } = await supabase
    .from('municipality_boundaries')
    .select('municipality, geometry_data')

  if (error || !data) return []

  boundariesCache = data.map((row) => {
    const geom = row.geometry_data as { type: string; coordinates: number[][][][] }
    const polygons: number[][][] = []

    if (geom.type === 'MultiPolygon') {
      for (const poly of geom.coordinates) {
        polygons.push(poly[0])
      }
    } else if (geom.type === 'Polygon') {
      polygons.push(geom.coordinates[0])
    }

    return { name: row.municipality, polygons }
  })

  return boundariesCache
}

function pointInPolygon(lat: number, lng: number, polygon: number[][]): boolean {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0]
    const yi = polygon[i][1]
    const xj = polygon[j][0]
    const yj = polygon[j][1]

    const intersect =
      yi > lat !== yj > lat &&
      (lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi)
    if (intersect) inside = !inside
  }
  return inside
}

export async function detectMunicipality(lat: number, lng: number): Promise<string | null> {
  const boundaries = await loadMunicipalityBoundaries()
  for (const boundary of boundaries) {
    for (const polygon of boundary.polygons) {
      if (pointInPolygon(lat, lng, polygon)) {
        return boundary.name
      }
    }
  }
  return null
}

interface NominatimResult {
  address?: {
    town?: string
    city?: string
    municipality?: string
    village?: string
    barangay?: string
    neighbourhood?: string
    hamlet?: string
    suburb?: string
    county?: string
    state?: string
    road?: string
    residential?: string
  }
  display_name?: string
}

let lastNominatimTime = 0
let lastNominatimCoords = { lat: 0, lng: 0 }
let lastNominatimResult: ReverseGeocodeResult | null = null

const NOMINATIM_MIN_INTERVAL_MS = 5000
const NOMINATIM_MIN_DISTANCE_M = 200

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export async function reverseGeocode(lat: number, lng: number): Promise<ReverseGeocodeResult> {
  const now = Date.now()
  const distMoved = haversineMeters(lat, lng, lastNominatimCoords.lat, lastNominatimCoords.lng)

  if (
    lastNominatimResult &&
    now - lastNominatimTime < NOMINATIM_MIN_INTERVAL_MS &&
    distMoved < NOMINATIM_MIN_DISTANCE_M
  ) {
    return lastNominatimResult
  }

  lastNominatimTime = now
  lastNominatimCoords = { lat, lng }

  const municipality = await detectMunicipality(lat, lng)

  let barangay: string | null = null
  let area: string | null = null

  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=14&addressdetails=1`
    const response = await fetch(url, {
      headers: { 'Accept-Language': 'en' },
      signal: AbortSignal.timeout(8000),
    })

    if (response.ok) {
      const data: NominatimResult = await response.json()
      const addr = data.address

      if (addr) {
        barangay =
          addr.barangay ??
          addr.neighbourhood ??
          addr.hamlet ??
          addr.village ??
          addr.suburb ??
          addr.residential ??
          null

        area = addr.road ?? addr.town ?? addr.city ?? null
      }

      if (!municipality) {
        const nomMuni = addr?.municipality ?? addr?.town ?? addr?.city ?? addr?.county
        if (nomMuni && MARINDUQUE_MUNICIPALITIES.includes(nomMuni)) {
          return { municipality: nomMuni, barangay, area }
        }
      }
    }
  } catch {
    // Network or timeout — fall through to boundary-only result
  }

  lastNominatimResult = { municipality, barangay, area }
  return lastNominatimResult
}

const MARINDUQUE_MUNICIPALITIES = [
  'Boac',
  'Buenavista',
  'Gasan',
  'Mogpog',
  'Santa Cruz',
  'Torrijos',
]

export function inMarinduqueBbox(lat: number, lng: number): boolean {
  return lat >= 13.15 && lat <= 13.7 && lng >= 121.7 && lng <= 122.1
}
