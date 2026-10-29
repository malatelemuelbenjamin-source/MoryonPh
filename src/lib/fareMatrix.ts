import { supabase } from './supabase'
import { formatPeso } from './fares'
import type {
  FareMatrixAuditLogRow,
  FareMatrixEntryWithDetails,
  FareMatrixPassengerType,
  FareMatrixType,
  FareMatrixWithDetails,
} from './types'

// ---- Fetch distinct municipalities from locations ------------------------

export async function fetchMunicipalitiesForMatrix(): Promise<string[]> {
  const { data, error } = await supabase
    .from('locations')
    .select('municipality')
    .not('municipality', 'is', null)
    .order('municipality', { ascending: true })
  if (error) {
    console.error('fetchMunicipalitiesForMatrix error:', error.message)
    return []
  }
  const set = new Set<string>()
  for (const row of data ?? []) {
    if (row.municipality) set.add(row.municipality)
  }
  return [...set]
}

// ---- Fetch published fare matrices ---------------------------------------

export async function fetchFareMatrices(): Promise<FareMatrixWithDetails[]> {
  const { data, error } = await supabase
    .from('fare_matrices')
    .select(
      `*,
       transport_mode:transport_modes(id, name, code, icon),
       route:routes(
         id, route_name, route_code, origin_location_id, destination_location_id, transport_mode_id,
         origin_location:locations!routes_origin_location_id_fkey(id, name, municipality),
         destination_location:locations!routes_destination_location_id_fkey(id, name, municipality)
       )`,
    )
    .eq('publication_status', 'published')
    .in('verification_status', ['official', 'verified', 'community'])
    .order('effective_from', { ascending: false })
    .order('updated_at', { ascending: false })

  if (error) {
    console.error('fetchFareMatrices error:', error.message)
    return []
  }
  return (data ?? []) as FareMatrixWithDetails[]
}

export async function fetchFareMatrix(id: string): Promise<FareMatrixWithDetails | null> {
  const { data, error } = await supabase
    .from('fare_matrices')
    .select(
      `*,
       transport_mode:transport_modes(id, name, code, icon),
       route:routes(
         id, route_name, route_code, origin_location_id, destination_location_id, transport_mode_id,
         origin_location:locations!routes_origin_location_id_fkey(id, name, municipality),
         destination_location:locations!routes_destination_location_id_fkey(id, name, municipality)
       )`,
    )
    .eq('id', id)
    .maybeSingle()

  if (error) {
    console.error('fetchFareMatrix error:', error.message)
    return null
  }
  return (data as FareMatrixWithDetails) ?? null
}

// ---- Fetch entries for a matrix ------------------------------------------

export async function fetchFareMatrixEntries(
  matrixId: string,
): Promise<FareMatrixEntryWithDetails[]> {
  const { data, error } = await supabase
    .from('fare_matrix_entries')
    .select(
      `*,
       origin_location:locations!fare_matrix_entries_origin_location_id_fkey(id, name, municipality, barangay),
       destination_location:locations!fare_matrix_entries_destination_location_id_fkey(id, name, municipality, barangay),
       fare:fares(id, base_fare, fare_type, verification_status)`,
    )
    .eq('fare_matrix_id', matrixId)
    .in('verification_status', ['official', 'verified', 'community'])
    .order('origin_stop_sequence', { ascending: true, nullsFirst: false })
    .order('passenger_type', { ascending: true })

  if (error) {
    console.error('fetchFareMatrixEntries error:', error.message)
    return []
  }
  return (data ?? []) as FareMatrixEntryWithDetails[]
}

// ---- Fetch audit logs ----------------------------------------------------

export async function fetchFareMatrixAuditLogs(
  matrixId: string,
): Promise<FareMatrixAuditLogRow[]> {
  const { data, error } = await supabase
    .from('fare_matrix_audit_logs')
    .select('*')
    .eq('fare_matrix_id', matrixId)
    .order('created_at', { ascending: true })
  if (error) {
    console.error('fetchFareMatrixAuditLogs error:', error.message)
    return []
  }
  return (data ?? []) as FareMatrixAuditLogRow[]
}

// ---- Helpers --------------------------------------------------------------

export function isMatrixCurrent(m: { effective_from: string; effective_until: string | null }): boolean {
  const now = new Date()
  if (new Date(m.effective_from) > now) return false
  if (m.effective_until && new Date(m.effective_until) < now) return false
  return true
}

export function matrixTypeLabel(t: FareMatrixType): string {
  switch (t) {
    case 'fixed':
      return 'Fixed'
    case 'stage_based':
      return 'Stage-based'
    case 'distance_based':
      return 'Distance-based'
    case 'zone_based':
      return 'Zone-based'
    case 'other':
      return 'Other'
  }
}

export function passengerTypeLabel(p: FareMatrixPassengerType): string {
  switch (p) {
    case 'regular':
      return 'Regular'
    case 'student':
      return 'Student'
    case 'senior':
      return 'Senior Citizen'
    case 'pwd':
      return 'PWD'
    case 'other':
      return 'Other'
  }
}

export function formatEntryFare(amount: number | null): string {
  if (amount == null) return 'Not available'
  return formatPeso(amount)
}

export function formatDate(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
}

// Group entries by origin → destination pair, producing a flat table structure.
export interface MatrixTableRow {
  originName: string
  destinationName: string
  originMunicipality: string | null
  destinationMunicipality: string | null
  fares: Partial<Record<FareMatrixPassengerType, number | null>>
}

export function groupEntriesByRoute(
  entries: FareMatrixEntryWithDetails[],
): MatrixTableRow[] {
  const map = new Map<string, MatrixTableRow>()
  for (const e of entries) {
    const originName = e.origin_location?.name ?? 'Unknown'
    const destinationName = e.destination_location?.name ?? 'Unknown'
    const key = `${originName}|${destinationName}`
    let row = map.get(key)
    if (!row) {
      row = {
        originName,
        destinationName,
        originMunicipality: e.origin_location?.municipality ?? null,
        destinationMunicipality: e.destination_location?.municipality ?? null,
        fares: {},
      }
      map.set(key, row)
    }
    row.fares[e.passenger_type] = e.fare_amount
  }
  return [...map.values()]
}
