import { supabase } from './supabase'
import type {
  PassengerCategoryRow,
  PassengerDiscountRequirementWithDetails,
} from './types'

// ---- Fetch passenger categories ------------------------------------------

export async function fetchPassengerCategories(): Promise<PassengerCategoryRow[]> {
  const { data, error } = await supabase
    .from('passenger_categories')
    .select('*')
    .eq('is_active', true)
    .order('code', { ascending: true })
  if (error) {
    console.error('fetchPassengerCategories error:', error.message)
    return []
  }
  return (data ?? []) as PassengerCategoryRow[]
}

// ---- Fetch discount requirements -----------------------------------------

export async function fetchDiscountRequirements(
  categoryId?: string,
  transportModeId?: string,
  routeId?: string,
): Promise<PassengerDiscountRequirementWithDetails[]> {
  let q = supabase
    .from('passenger_discount_requirements')
    .select(
      `*,
       transport_mode:transport_modes(id, name, code, icon),
       route:routes(id, route_name, route_code)`,
    )
    .in('verification_status', ['official', 'verified', 'community'])
    .order('verification_status', { ascending: false })
    .order('effective_from', { ascending: false })

  if (categoryId) q = q.eq('passenger_category_id', categoryId)
  if (transportModeId) q = q.eq('transport_mode_id', transportModeId)
  if (routeId) q = q.eq('route_id', routeId)

  const { data, error } = await q
  if (error) {
    console.error('fetchDiscountRequirements error:', error.message)
    return []
  }
  return (data ?? []) as PassengerDiscountRequirementWithDetails[]
}

// ---- Fetch a single category ---------------------------------------------

export async function fetchPassengerCategory(
  id: string,
): Promise<PassengerCategoryRow | null> {
  const { data, error } = await supabase
    .from('passenger_categories')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) {
    console.error('fetchPassengerCategory error:', error.message)
    return null
  }
  return (data as PassengerCategoryRow) ?? null
}

// ---- User preference ------------------------------------------------------

export async function setPreferredPassengerCategory(
  userId: string,
  categoryId: string | null,
): Promise<boolean> {
  const { error } = await supabase
    .from('users')
    .update({ preferred_passenger_category_id: categoryId, updated_at: new Date().toISOString() })
    .eq('id', userId)
  if (error) {
    console.error('setPreferredPassengerCategory error:', error.message)
    return false
  }
  return true
}

// ---- Helpers --------------------------------------------------------------

export function isRequirementCurrent(r: {
  effective_from: string | null
  effective_until: string | null
}): boolean {
  const now = new Date()
  if (r.effective_from && new Date(r.effective_from) > now) return false
  if (r.effective_until && new Date(r.effective_until) < now) return false
  return true
}

export function categoryIcon(code: string): string {
  switch (code) {
    case 'student':
      return 'GraduationCap'
    case 'senior':
      return 'Heart'
    case 'pwd':
      return 'Accessibility'
    case 'child':
      return 'Baby'
    case 'other':
      return 'Users'
    default:
      return 'User'
  }
}

export function formatDate(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
}
