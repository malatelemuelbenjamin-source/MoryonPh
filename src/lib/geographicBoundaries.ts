import { supabase } from './supabase'
import type { BoundaryBbox, MultiPolygonCoordinates } from './geoJsonValidation'

export type BoundaryStatus = 'draft' | 'published' | 'archived'
export type VerificationStatus = 'unverified' | 'verified' | 'rejected'
export type ReviewDecision = VerificationStatus

export interface GeographicSource {
  id: string
  name: string
  publisher: string
  source_url: string | null
  license: string
  source_year: number | null
  last_updated_on: string | null
  notes: string | null
  origin_checked: boolean
  origin_checked_at: string | null
}

export interface GeographicBoundary {
  id: string
  boundary_key: string
  version: number
  label: string
  kind: string
  status: BoundaryStatus
  verification_status: VerificationStatus
  geometry_type: string
  crs: string
  geometry_data: unknown
  bbox: BoundaryBbox
  feature_count: number
  review_note: string | null
  reviewed_at: string | null
  published_at: string | null
  archived_at: string | null
  created_at: string
  source: GeographicSource | null
}

export interface GeographicHistoryEntry {
  id: string
  boundary_id: string | null
  action: 'imported' | 'reviewed' | 'published' | 'archived'
  actor_id: string | null
  details: Record<string, unknown>
  created_at: string
}

export const ISLAND_OUTLINE_KEY = 'marinduque-island'

const BOUNDARY_SELECT = '*, source:geographic_data_sources(*)'

function requireData<T>(data: T | null, error: { message: string } | null, fallback: string): T {
  if (error) throw new Error(error.message)
  if (data === null) throw new Error(fallback)
  return data
}

export async function fetchPublishedBoundary(boundaryKey: string): Promise<GeographicBoundary | null> {
  const { data, error } = await supabase
    .from('geographic_boundaries')
    .select(BOUNDARY_SELECT)
    .eq('boundary_key', boundaryKey)
    .eq('status', 'published')
    .maybeSingle()
  if (error) throw new Error(error.message)
  return (data as GeographicBoundary | null) ?? null
}

export async function fetchAdminBoundaries(): Promise<GeographicBoundary[]> {
  const { data, error } = await supabase
    .from('geographic_boundaries')
    .select(BOUNDARY_SELECT)
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) throw new Error(error.message)
  return (data ?? []) as GeographicBoundary[]
}

export async function fetchBoundaryHistory(): Promise<GeographicHistoryEntry[]> {
  const { data, error } = await supabase
    .from('geographic_import_history')
    .select('id, boundary_id, action, actor_id, details, created_at')
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) throw new Error(error.message)
  return (data ?? []) as GeographicHistoryEntry[]
}

export interface ImportBoundaryInput {
  boundaryKey: string
  label: string
  kind: string
  source: {
    name: string
    publisher: string
    source_url: string
    license: string
    source_year: string
    last_updated_on: string
    notes: string
  }
  geometry: { type: 'MultiPolygon'; coordinates: MultiPolygonCoordinates }
  bbox: BoundaryBbox
  featureCount: number
}

export async function importBoundary(input: ImportBoundaryInput): Promise<string> {
  const { data, error } = await supabase.rpc('import_geographic_boundary', {
    p_boundary_key: input.boundaryKey,
    p_label: input.label,
    p_kind: input.kind,
    p_source: input.source,
    p_geometry: input.geometry,
    p_bbox: input.bbox,
    p_feature_count: input.featureCount,
  })
  return requireData(data as string | null, error, 'The import did not return a dataset id.')
}

export async function reviewBoundary(
  boundaryId: string,
  decision: ReviewDecision,
  sourceChecked: boolean,
  note: string,
): Promise<void> {
  const { error } = await supabase.rpc('review_geographic_boundary', {
    p_boundary_id: boundaryId,
    p_decision: decision,
    p_source_checked: sourceChecked,
    p_note: note,
  })
  if (error) throw new Error(error.message)
}

export async function publishBoundary(boundaryId: string): Promise<void> {
  const { error } = await supabase.rpc('publish_geographic_boundary', { p_boundary_id: boundaryId })
  if (error) throw new Error(error.message)
}

export async function archiveBoundary(boundaryId: string, note: string): Promise<void> {
  const { error } = await supabase.rpc('archive_geographic_boundary', { p_boundary_id: boundaryId, p_note: note })
  if (error) throw new Error(error.message)
}
