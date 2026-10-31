import { supabase } from './supabase'

export const MAJOR_ROAD_CLASSES = ['motorway', 'trunk', 'primary', 'secondary', 'tertiary'] as const
export const ROAD_CLASSES = [
  ...MAJOR_ROAD_CLASSES,
  'unclassified',
  'residential',
  'service',
  'track',
  'living_street',
  'road',
  'path',
  'footway',
  'cycleway',
] as const

export const ROAD_ATTRIBUTION = 'Road data © OpenStreetMap contributors, ODbL 1.0'
export const ROAD_VIEW_LIMIT = 2000

export type RoadVersionStatus = 'importing' | 'staging' | 'published' | 'archived' | 'failed'

export interface RoadCoverageEntry {
  municipality: string | null
  roadCount: number
}

export interface RoadDatasetVersion {
  id: string
  version: number
  status: RoadVersionStatus
  source_attribution: string
  source_endpoint: string
  source_query: string
  source_fetched_at: string | null
  raw_element_count: number
  road_count: number
  invalid_count: number
  duplicate_count: number
  municipality_coverage: RoadCoverageEntry[]
  failure_reason: string | null
  created_at: string
  published_at: string | null
  archived_at: string | null
}

export interface RoadSegment {
  id: string
  source_feature_id: string
  road_name: string | null
  road_classification: string | null
  municipality_id: string | null
  quality_flags: string[]
  min_lon: number
  min_lat: number
  max_lon: number
  max_lat: number
  display_geometry: { type: 'LineString'; coordinates: [number, number][] }
}

export interface RoadBounds {
  west: number
  south: number
  east: number
  north: number
}

export interface RoadSearchFilters {
  name: string
  classification: string
  municipalityId: string
}

const VERSION_COLUMNS =
  'id, version, status, source_attribution, source_endpoint, source_query, source_fetched_at, raw_element_count, road_count, invalid_count, duplicate_count, municipality_coverage, failure_reason, created_at, published_at, archived_at'

const SEGMENT_COLUMNS =
  'id, source_feature_id, road_name, road_classification, municipality_id, quality_flags, min_lon, min_lat, max_lon, max_lat, display_geometry'

function isLineGeometry(value: unknown): value is RoadSegment['display_geometry'] {
  if (!value || typeof value !== 'object') return false
  const geom = value as { type?: unknown; coordinates?: unknown }
  return (
    geom.type === 'LineString' &&
    Array.isArray(geom.coordinates) &&
    geom.coordinates.length >= 2 &&
    geom.coordinates.every((p) => Array.isArray(p) && p.length >= 2 && typeof p[0] === 'number' && typeof p[1] === 'number')
  )
}

function toSegments(rows: unknown[]): RoadSegment[] {
  return rows.filter((row): row is RoadSegment => {
    const candidate = row as Partial<RoadSegment>
    return typeof candidate.id === 'string' && typeof candidate.min_lon === 'number' && isLineGeometry(candidate.display_geometry)
  })
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`)
}

export async function fetchPublishedRoadVersion(): Promise<RoadDatasetVersion | null> {
  const { data, error } = await supabase
    .from('road_dataset_versions')
    .select(VERSION_COLUMNS)
    .eq('status', 'published')
    .maybeSingle()
  if (error) throw new Error(`Road data could not be loaded: ${error.message}`)
  return (data as RoadDatasetVersion | null) ?? null
}

export async function fetchRoadVersions(): Promise<RoadDatasetVersion[]> {
  const { data, error } = await supabase
    .from('road_dataset_versions')
    .select(VERSION_COLUMNS)
    .order('version', { ascending: false })
  if (error) throw new Error(`Road versions could not be loaded: ${error.message}`)
  return (data ?? []) as RoadDatasetVersion[]
}

export async function fetchRoadPreview(versionId: string): Promise<RoadSegment[]> {
  const { data, error } = await supabase
    .from('road_segments')
    .select(SEGMENT_COLUMNS)
    .eq('dataset_version_id', versionId)
    .order('road_name', { ascending: true, nullsFirst: false })
    .limit(25)
  if (error) throw new Error(`Road preview could not be loaded: ${error.message}`)
  return toSegments(data ?? [])
}

export async function fetchRoadsInView(
  versionId: string,
  bounds: RoadBounds,
  majorOnly: boolean,
): Promise<{ roads: RoadSegment[]; truncated: boolean }> {
  let query = supabase
    .from('road_segments')
    .select(SEGMENT_COLUMNS)
    .eq('dataset_version_id', versionId)
    .lte('min_lon', bounds.east)
    .gte('max_lon', bounds.west)
    .lte('min_lat', bounds.north)
    .gte('max_lat', bounds.south)
    .limit(ROAD_VIEW_LIMIT)
  if (majorOnly) query = query.in('road_classification', [...MAJOR_ROAD_CLASSES])
  const { data, error } = await query
  if (error) throw new Error(`Roads for this view could not be loaded: ${error.message}`)
  const roads = toSegments(data ?? [])
  return { roads, truncated: (data ?? []).length >= ROAD_VIEW_LIMIT }
}

export async function searchRoads(versionId: string, filters: RoadSearchFilters): Promise<RoadSegment[]> {
  let query = supabase
    .from('road_segments')
    .select(SEGMENT_COLUMNS)
    .eq('dataset_version_id', versionId)
    .not('road_name', 'is', null)
    .order('road_name', { ascending: true })
    .limit(50)
  const name = filters.name.trim()
  if (name) query = query.ilike('road_name', `%${escapeLike(name)}%`)
  if (filters.classification) query = query.eq('road_classification', filters.classification)
  if (filters.municipalityId) query = query.eq('municipality_id', filters.municipalityId)
  const { data, error } = await query
  if (error) throw new Error(`Road search failed: ${error.message}`)
  return toSegments(data ?? [])
}

export async function importRoadNetwork(): Promise<{ versionId: string; roadCount: number }> {
  const { data, error } = await supabase.functions.invoke('import-osm-roads', { method: 'POST' })
  if (error) {
    const context = (error as { context?: Response }).context
    const body = context instanceof Response ? ((await context.json().catch(() => null)) as { error?: string } | null) : null
    throw new Error(body?.error ?? 'The road import could not be started. Try again later.')
  }
  const result = data as { versionId?: unknown; roadCount?: unknown } | null
  if (!result || typeof result.versionId !== 'string' || typeof result.roadCount !== 'number') {
    throw new Error('The road import returned an unexpected response.')
  }
  return { versionId: result.versionId, roadCount: result.roadCount }
}

export async function activateRoadVersion(versionId: string): Promise<void> {
  const { error } = await supabase.rpc('activate_road_dataset_version', { p_version_id: versionId })
  if (error) throw new Error(error.message)
}
