import { supabase } from './supabase'
import type {
  FareCalculationResult,
  FareDiscountRow,
  FareRuleRow,
  FareWithDetails,
  PassengerType,
} from './types'

// ---- Fetch fares for a route --------------------------------------------

export async function fetchFaresForRoute(
  routeId: string,
): Promise<FareWithDetails[]> {
  const { data, error } = await supabase
    .from('fares')
    .select(
      '*, route:routes(id, route_name, transport_mode_id, operator_name), transport_mode:transport_modes(id, name, code, icon)',
    )
    .eq('route_id', routeId)
    .in('verification_status', ['official', 'verified', 'community'])
    .order('effective_from', { ascending: false })

  if (error) {
    console.error('fetchFaresForRoute error:', error.message)
    return []
  }
  return (data ?? []) as FareWithDetails[]
}

export async function fetchFareRules(fareId: string): Promise<FareRuleRow[]> {
  const { data, error } = await supabase
    .from('fare_rules')
    .select('*')
    .eq('fare_id', fareId)
    .in('verification_status', ['official', 'verified', 'community'])
  if (error) {
    console.error('fetchFareRules error:', error.message)
    return []
  }
  return (data ?? []) as FareRuleRow[]
}

export async function fetchFareDiscounts(
  fareId: string,
): Promise<FareDiscountRow[]> {
  const { data, error } = await supabase
    .from('fare_discounts')
    .select('*')
    .eq('fare_id', fareId)
    .in('verification_status', ['official', 'verified', 'community'])
  if (error) {
    console.error('fetchFareDiscounts error:', error.message)
    return []
  }
  return (data ?? []) as FareDiscountRow[]
}

// ---- Check if a fare is currently effective ------------------------------

export function isFareCurrent(fare: { effective_from: string; effective_until: string | null }): boolean {
  const now = new Date()
  const from = new Date(fare.effective_from)
  if (from > now) return false
  if (fare.effective_until) {
    const until = new Date(fare.effective_until)
    if (until < now) return false
  }
  return true
}

// ---- Fare calculation engine ---------------------------------------------

export async function calculateFare(
  routeId: string,
  passengerType: PassengerType,
): Promise<FareCalculationResult> {
  const empty: FareCalculationResult = {
    fare: null,
    rules: [],
    discount: null,
    baseAmount: 0,
    discountAmount: 0,
    totalAmount: 0,
    breakdown: [],
    passengerType,
    hasFare: false,
    expired: false,
    error: null,
  }

  const fares = await fetchFaresForRoute(routeId)
  if (fares.length === 0) {
    return empty
  }

  // Find the most recent current fare.
  const currentFares = fares.filter(isFareCurrent)
  if (currentFares.length === 0) {
    return { ...empty, expired: true }
  }

  // Prefer official/verified over community.
  const rank = (s: string) => (s === 'official' ? 0 : s === 'verified' ? 1 : 2)
  const fare = currentFares.sort((a, b) => rank(a.verification_status) - rank(b.verification_status))[0]

  const rules = await fetchFareRules(fare.id)
  const discounts = await fetchFareDiscounts(fare.id)

  // Find discount matching passenger type (or regular = no discount).
  let discount = discounts.find((d) => d.passenger_type === passengerType) ?? null
  if (passengerType === 'regular') discount = null

  // Base fare
  let baseAmount = Number(fare.base_fare) || 0
  const breakdown: FareCalculationResult['breakdown'] = [
    { label: 'Base fare', amount: baseAmount },
  ]

  // Apply additional charges and distance/stage rates from rules.
  for (const rule of rules) {
    if (rule.rule_type === 'additional_charge') {
      baseAmount += rule.rule_value
      breakdown.push({ label: rule.description ?? 'Additional charge', amount: rule.rule_value })
    } else if (rule.rule_type === 'distance_rate') {
      // Without a known trip distance we cannot apply distance_rate; skip.
    } else if (rule.rule_type === 'stage_rate') {
      // Stage-based requires stage data not yet available; skip.
    }
  }

  // Enforce minimum/maximum from the fare record itself.
  if (fare.minimum_fare != null && baseAmount < Number(fare.minimum_fare)) {
    const diff = Number(fare.minimum_fare) - baseAmount
    baseAmount = Number(fare.minimum_fare)
    breakdown.push({ label: 'Minimum fare adjustment', amount: diff })
  }
  if (fare.maximum_fare != null && baseAmount > Number(fare.maximum_fare)) {
    const diff = Number(fare.maximum_fare) - baseAmount
    baseAmount = Number(fare.maximum_fare)
    breakdown.push({ label: 'Maximum fare adjustment', amount: diff })
  }

  // Apply discount
  let discountAmount = 0
  if (discount && discount.discount_type === 'percentage') {
    discountAmount = (baseAmount * Number(discount.discount_value)) / 100
  } else if (discount && discount.discount_type === 'fixed_amount') {
    discountAmount = Number(discount.discount_value)
  }
  discountAmount = Math.min(discountAmount, baseAmount)

  if (discountAmount > 0) {
    breakdown.push({ label: `${passengerLabel(passengerType)} discount`, amount: -discountAmount })
  }

  const totalAmount = baseAmount - discountAmount

  return {
    fare,
    rules,
    discount,
    baseAmount: Number(fare.base_fare) || 0,
    discountAmount,
    totalAmount,
    breakdown,
    passengerType,
    hasFare: true,
    expired: false,
    error: null,
  }
}

export function passengerLabel(p: PassengerType): string {
  switch (p) {
    case 'regular':
      return 'Regular'
    case 'student':
      return 'Student'
    case 'senior':
      return 'Senior Citizen'
    case 'pwd':
      return 'PWD'
  }
}

export function fareTypeLabel(t: string): string {
  switch (t) {
    case 'fixed':
      return 'Fixed'
    case 'distance_based':
      return 'Distance-based'
    case 'zone_based':
      return 'Zone-based'
    case 'stage_based':
      return 'Stage-based'
    case 'range':
      return 'Range'
    case 'other':
      return 'Other'
    default:
      return t
  }
}

export function formatPeso(amount: number): string {
  return `₱${amount.toFixed(2)}`
}
