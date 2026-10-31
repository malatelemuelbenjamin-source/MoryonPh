import { supabase } from './supabase'
import type { FieldMapping, InspectionReport } from './geographicInspection'
import type { UploadCategory } from './geographicCategories'
import type { UploadFormat } from './geographicFileParsers'
import type { MultiPolygonCoordinates, BoundaryBbox } from './geoJsonValidation'

export const UPLOAD_BUCKET = 'geographic-uploads'
const SIGNED_URL_SECONDS = 300

export type UploadStatus =
  | 'uploaded'
  | 'processing'
  | 'validation_failed'
  | 'needs_review'
  | 'approved'
  | 'published'
  | 'rejected'
  | 'archived'

export type StoredValidation = Omit<InspectionReport, 'boundaryGeometry'>

export interface UploadJob {
  id: string
  file_name: string
  file_format: UploadFormat
  file_size_bytes: number
  file_sha256: string
  storage_path: string
  category: UploadCategory
  municipality_id: string | null
  boundary_key: string | null
  title: string
  description: string | null
  coverage: string | null
  source_organization: string
  source_url: string | null
  source_reference: string | null
  license: string
  dataset_version: string | null
  notes: string | null
  status: UploadStatus
  validation: StoredValidation
  field_mapping: FieldMapping
  boundary_id: string | null
  review_note: string | null
  created_at: string
  reviewed_at: string | null
}

export interface UploadJobGeometry {
  geometry_data: { type: 'MultiPolygon'; coordinates: MultiPolygonCoordinates } | null
  bbox: BoundaryBbox | null
}

export interface UploadMetadata {
  title: string
  description: string
  coverage: string
  source_organization: string
  source_url: string
  source_reference: string
  license: string
  dataset_version: string
  notes: string
  boundary_key: string
}

export interface CreateUploadInput {
  fileName: string
  format: UploadFormat
  sizeBytes: number
  sha256: string
  storagePath: string
  category: UploadCategory
  municipalityId: string | null
  metadata: UploadMetadata
  mapping: FieldMapping
  report: InspectionReport
}

const JOB_COLUMNS =
  'id, file_name, file_format, file_size_bytes, file_sha256, storage_path, category, municipality_id, boundary_key, title, description, coverage, source_organization, source_url, source_reference, license, dataset_version, notes, status, validation, field_mapping, boundary_id, review_note, created_at, reviewed_at'

export async function fetchUploadJobs(): Promise<UploadJob[]> {
  const { data, error } = await supabase
    .from('geographic_upload_jobs')
    .select(JOB_COLUMNS)
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) throw new Error(error.message)
  return (data ?? []) as UploadJob[]
}

export async function fetchUploadGeometry(jobId: string): Promise<UploadJobGeometry> {
  const { data, error } = await supabase
    .from('geographic_upload_jobs')
    .select('geometry_data, bbox')
    .eq('id', jobId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('The upload could not be found.')
  return data as UploadJobGeometry
}

export function buildStoragePath(fileName: string): string {
  const safeName = fileName.replace(/[^A-Za-z0-9._-]/g, '-').slice(0, 200) || 'upload'
  return `${crypto.randomUUID()}/${safeName}`
}

export async function sha256Hex(file: File): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function storeOriginalFile(file: File, storagePath: string): Promise<void> {
  const { error } = await supabase.storage.from(UPLOAD_BUCKET).upload(storagePath, file, {
    contentType: file.type || 'application/octet-stream',
    upsert: false,
  })
  if (error) throw new Error(error.message)
}

export async function createUploadJob(input: CreateUploadInput): Promise<string> {
  const { data, error } = await supabase.rpc('create_geographic_upload_job', {
    p_file_name: input.fileName,
    p_file_format: input.format,
    p_file_size_bytes: input.sizeBytes,
    p_file_sha256: input.sha256,
    p_storage_path: input.storagePath,
    p_category: input.category,
    p_municipality_id: input.municipalityId,
    p_metadata: input.metadata,
    p_field_mapping: input.mapping,
    p_validation: { ...input.report, boundaryGeometry: undefined },
    p_geometry: input.report.boundaryGeometry,
    p_bbox: input.report.bbox,
  })
  if (error) throw new Error(error.message)
  if (typeof data !== 'string') throw new Error('The upload was not saved. Try again.')
  return data
}

export async function reviewUploadJob(jobId: string, decision: 'approve' | 'reject', note: string): Promise<void> {
  const { error } = await supabase.rpc('review_geographic_upload', {
    p_job_id: jobId,
    p_decision: decision,
    p_note: note,
  })
  if (error) throw new Error(error.message)
}

export async function createOriginalFileUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage.from(UPLOAD_BUCKET).createSignedUrl(storagePath, SIGNED_URL_SECONDS)
  if (error || !data?.signedUrl) throw new Error(error?.message ?? 'The original file could not be opened.')
  return data.signedUrl
}
