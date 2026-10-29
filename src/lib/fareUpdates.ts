import { supabase } from './supabase'
import { formatPeso } from './fares'
import type {
  FareAuditLogRow,
  FareUpdateStatus,
  FareUpdateSubscriptionRow,
  FareUpdateType,
  FareUpdateWithDetails,
  FareWithDetails,
} from './types'

// ---- Fetch fare updates (published only; RLS hides pending/rejected) ----

export async function fetchFareUpdates(): Promise<FareUpdateWithDetails[]> {
  const { data, error } = await supabase
    .from('fare_updates')
    .select(
      `*,
       route:routes(
         id,
         route_name,
         route_code,
         origin_location_id,
         destination_location_id,
         transport_mode_id,
         origin_location:locations!routes_origin_location_id_fkey(id, name, municipality),
         destination_location:locations!routes_destination_location_id_fkey(id, name, municipality),
         transport_mode:transport_modes(id, name, code, icon)
       )`,
    )
    .in('verification_status', ['official', 'verified', 'community'])
    .order('effective_from', { ascending: false })
    .order('updated_at', { ascending: false })

  if (error) {
    console.error('fetchFareUpdates error:', error.message)
    return []
  }
  return (data ?? []) as FareUpdateWithDetails[]
}

export async function fetchFareUpdate(id: string): Promise<FareUpdateWithDetails | null> {
  const { data, error } = await supabase
    .from('fare_updates')
    .select(
      `*,
       route:routes(
         id,
         route_name,
         route_code,
         origin_location_id,
         destination_location_id,
         transport_mode_id,
         origin_location:locations!routes_origin_location_id_fkey(id, name, municipality),
         destination_location:locations!routes_destination_location_id_fkey(id, name, municipality),
         transport_mode:transport_modes(id, name, code, icon)
       )`,
    )
    .eq('id', id)
    .maybeSingle()

  if (error) {
    console.error('fetchFareUpdate error:', error.message)
    return null
  }
  return (data as FareUpdateWithDetails) ?? null
}

export async function fetchFareUpdateAuditLogs(
  fareUpdateId: string,
): Promise<FareAuditLogRow[]> {
  const { data, error } = await supabase
    .from('fare_update_audit_logs')
    .select('*')
    .eq('fare_update_id', fareUpdateId)
    .order('created_at', { ascending: true })
  if (error) {
    console.error('fetchFareUpdateAuditLogs error:', error.message)
    return []
  }
  return (data ?? []) as FareAuditLogRow[]
}

// ---- Fetch all fares for a route (history) ------------------------------

export async function fetchFareHistory(routeId: string): Promise<FareWithDetails[]> {
  const { data, error } = await supabase
    .from('fares')
    .select(
      '*, route:routes(id, route_name, transport_mode_id, operator_name), transport_mode:transport_modes(id, name, code, icon)',
    )
    .eq('route_id', routeId)
    .in('verification_status', ['official', 'verified', 'community', 'archived'])
    .order('effective_from', { ascending: false })

  if (error) {
    console.error('fetchFareHistory error:', error.message)
    return []
  }
  return (data ?? []) as FareWithDetails[]
}

// ---- Subscriptions -------------------------------------------------------

export async function fetchUserSubscription(
  userId: string,
  routeId: string,
): Promise<FareUpdateSubscriptionRow | null> {
  const { data, error } = await supabase
    .from('fare_update_subscriptions')
    .select('*')
    .eq('user_id', userId)
    .eq('route_id', routeId)
    .maybeSingle()
  if (error) {
    console.error('fetchUserSubscription error:', error.message)
    return null
  }
  return (data as FareUpdateSubscriptionRow) ?? null
}

export async function toggleSubscription(
  userId: string,
  routeId: string,
  enabled: boolean,
): Promise<boolean> {
  const existing = await fetchUserSubscription(userId, routeId)
  if (existing) {
    const { error } = await supabase
      .from('fare_update_subscriptions')
      .update({ is_enabled: enabled, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
    if (error) {
      console.error('toggleSubscription update error:', error.message)
      return false
    }
    return true
  }
  const { error } = await supabase
    .from('fare_update_subscriptions')
    .insert({
      user_id: userId,
      route_id: routeId,
      notification_type: 'fare_change',
      is_enabled: enabled,
    })
  if (error) {
    console.error('toggleSubscription insert error:', error.message)
    return false
  }
  return true
}

// ---- Fetch distinct municipalities from locations -----------------------

export async function fetchMunicipalities(): Promise<string[]> {
  const { data, error } = await supabase
    .from('locations')
    .select('municipality')
    .not('municipality', 'is', null)
    .order('municipality', { ascending: true })
  if (error) {
    console.error('fetchMunicipalities error:', error.message)
    return []
  }
  const set = new Set<string>()
  for (const row of data ?? []) {
    if (row.municipality) set.add(row.municipality)
  }
  return [...set]
}

// ---- Classifiers ---------------------------------------------------------

export function isUpcomingUpdate(u: { effective_from: string }): boolean {
  return new Date(u.effective_from) > new Date()
}

export function isCurrentUpdate(u: { effective_from: string }): boolean {
  return new Date(u.effective_from) <= new Date()
}

export function updateTypeLabel(t: FareUpdateType): string {
  switch (t) {
    case 'increase':
      return 'Fare Increased'
    case 'decrease':
      return 'Fare Decreased'
    case 'unchanged_verified':
      return 'Fare Verified'
    case 'new_fare':
      return 'New Fare'
    case 'correction':
      return 'Fare Corrected'
    case 'expiration':
      return 'Fare Expired'
    case 'other':
      return 'Fare Update'
  }
}

export function updateStatusLabel(s: FareUpdateStatus): string {
  switch (s) {
    case 'official':
      return 'OFFICIAL'
    case 'verified':
      return 'VERIFIED'
    case 'pending':
      return 'PENDING VERIFICATION'
    case 'community':
      return 'COMMUNITY'
    case 'estimated':
      return 'ESTIMATED'
    case 'rejected':
      return 'REJECTED'
    case 'archived':
      return 'ARCHIVED'
  }
}

export function updateStatusClasses(s: FareUpdateStatus): string {
  switch (s) {
    case 'official':
      return 'bg-ocean-700 text-white'
    case 'verified':
      return 'bg-leaf-600 text-white'
    case 'community':
      return 'bg-sand-300 text-ocean-900'
    case 'estimated':
      return 'bg-terra-300 text-ocean-900'
    case 'pending':
      return 'bg-terra-100 text-terra-700'
    default:
      return 'bg-ocean-100 text-ocean-800'
  }
}

export function formatChange(amount: number): string {
  if (amount > 0) return `+${formatPeso(amount)}`
  if (amount < 0) return `-${formatPeso(Math.abs(amount))}`
  return formatPeso(0)
}

export function formatDate(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
}
