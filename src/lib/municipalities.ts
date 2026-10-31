import { supabase } from './supabase'
import { fetchPublishedBoundariesByKind } from './geographicBoundaries'
import type { BoundaryBbox } from './geoJsonValidation'
import { allMultiPolygonRings, type Position } from './digitalTwin/globeData'

export const MUNICIPAL_BOUNDARY_KIND = 'municipal_boundary'

export interface MunicipalityRecord {
  id: string
  name: string
  boundary_key: string
  official_code: string | null
  description: string | null
  image_url: string | null
  center_lon: number | null
  center_lat: number | null
  area_sq_km: number | null
  details_source_name: string | null
  details_source_url: string | null
  details_verification_status: 'unverified' | 'verified'
  updated_at: string
}

export interface MunicipalityBoundary {
  rings: Position[][]
  bbox: BoundaryBbox
  sourceName: string | null
}

export interface MunicipalityEntry {
  record: MunicipalityRecord
  boundary: MunicipalityBoundary | null
}

export interface MunicipalityRevision {
  action: string
  details: Record<string, unknown>
  created_at: string
}

export interface MunicipalityDetailsInput {
  municipalityId: string
  officialCode: string
  description: string
  imageUrl: string
  centerLon: number | null
  centerLat: number | null
  areaSqKm: number | null
  sourceName: string
  sourceUrl: string
  sourceChecked: boolean
}

const MUNICIPALITY_SELECT =
  'id, name, boundary_key, official_code, description, image_url, center_lon, center_lat, area_sq_km, details_source_name, details_source_url, details_verification_status, updated_at'

export async function fetchMunicipalityRecords(): Promise<MunicipalityRecord[]> {
  const { data, error } = await supabase
    .from('municipalities')
    .select(MUNICIPALITY_SELECT)
    .order('name', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as MunicipalityRecord[]
}

export async function loadMunicipalityDirectory(): Promise<MunicipalityEntry[]> {
  const [records, boundaries] = await Promise.all([
    fetchMunicipalityRecords(),
    fetchPublishedBoundariesByKind(MUNICIPAL_BOUNDARY_KIND),
  ])
  const boundaryByKey = new Map(boundaries.map((boundary) => [boundary.boundary_key, boundary]))

  return records.map((record) => {
    const published = boundaryByKey.get(record.boundary_key)
    const rings = published ? allMultiPolygonRings(published.geometry_data) : []
    const boundary: MunicipalityBoundary | null =
      published && rings.length > 0
        ? { rings, bbox: published.bbox, sourceName: published.source?.name ?? null }
        : null
    return { record, boundary }
  })
}

export function describeBoundaryStatus(entry: MunicipalityEntry): { label: string; verified: boolean } {
  return entry.boundary
    ? { label: 'Verified boundary', verified: true }
    : { label: 'Boundary not yet verified', verified: false }
}

export function canShowOnGlobe(entry: MunicipalityEntry): boolean {
  if (entry.boundary) return true
  const { record } = entry
  return record.details_verification_status === 'verified' && record.center_lon !== null && record.center_lat !== null
}

export function filterMunicipalities(entries: MunicipalityEntry[], query: string): MunicipalityEntry[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return entries
  return entries.filter(({ record }) => record.name.toLowerCase().includes(needle))
}

export async function fetchMunicipalityRevisions(municipalityId: string): Promise<MunicipalityRevision[]> {
  const { data, error } = await supabase
    .from('municipality_revisions')
    .select('action, details, created_at')
    .eq('municipality_id', municipalityId)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw new Error(error.message)
  return (data ?? []) as MunicipalityRevision[]
}

export async function saveMunicipalityDetails(input: MunicipalityDetailsInput): Promise<void> {
  const { error } = await supabase.rpc('update_municipality_details', {
    p_municipality_id: input.municipalityId,
    p_official_code: input.officialCode,
    p_description: input.description,
    p_image_url: input.imageUrl,
    p_center_lon: input.centerLon,
    p_center_lat: input.centerLat,
    p_area_sq_km: input.areaSqKm,
    p_source_name: input.sourceName,
    p_source_url: input.sourceUrl,
    p_source_checked: input.sourceChecked,
  })
  if (error) throw new Error(error.message)
}
