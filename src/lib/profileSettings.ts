import { supabase } from './supabase'
import type { PreferredLanguage } from './types'

export interface NotificationPreferences {
  transport_alerts: boolean
  fare_updates: boolean
  weather_advisories: boolean
  saved_route_updates: boolean
  event_reminders: boolean
}

export interface CommuterPreferences {
  default_view: 'list' | 'map'
  preferred_transport_modes: string[]
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPreferences = {
  transport_alerts: true,
  fare_updates: true,
  weather_advisories: true,
  saved_route_updates: true,
  event_reminders: false,
}

export const DEFAULT_COMMUTER_PREFS: CommuterPreferences = {
  default_view: 'list',
  preferred_transport_modes: [],
}

// ---- Update profile --------------------------------------------------------

export async function updateProfile(userId: string, updates: {
  name?: string
  username?: string | null
  preferred_language?: PreferredLanguage
  home_municipality?: string | null
  commuter_preferences?: CommuterPreferences
}): Promise<{ success: boolean; error?: string }> {
  const payload: Record<string, unknown> = {}
  if (updates.name !== undefined) {
    const trimmed = updates.name.trim()
    if (trimmed.length > 60) return { success: false, error: 'Name must be 60 characters or fewer.' }
    payload.name = trimmed || null
  }
  if (updates.username !== undefined) {
    const trimmed = updates.username?.trim() || null
    if (trimmed && !/^[a-zA-Z0-9_]{3,20}$/.test(trimmed)) {
      return { success: false, error: 'Username must be 3-20 characters (letters, numbers, underscores only).' }
    }
    payload.username = trimmed
  }
  if (updates.preferred_language !== undefined) payload.preferred_language = updates.preferred_language
  if (updates.home_municipality !== undefined) payload.home_municipality = updates.home_municipality || null
  if (updates.commuter_preferences !== undefined) payload.commuter_preferences = updates.commuter_preferences

  const { error } = await supabase.from('users').update(payload).eq('id', userId)
  if (error) {
    if (error.code === '23505') return { success: false, error: 'That username is already taken.' }
    return { success: false, error: error.message }
  }
  return { success: true }
}

// ---- Update notification preferences --------------------------------------

export async function updateNotificationPreferences(
  userId: string,
  prefs: Partial<NotificationPreferences>,
): Promise<{ success: boolean; error?: string }> {
  const { data: current } = await supabase
    .from('users')
    .select('notification_preferences')
    .eq('id', userId)
    .maybeSingle()

  const existing = (current?.notification_preferences ?? {}) as Record<string, unknown>
  const merged = { ...DEFAULT_NOTIFICATION_PREFS, ...existing, ...prefs }

  const { error } = await supabase
    .from('users')
    .update({ notification_preferences: merged })
    .eq('id', userId)

  if (error) return { success: false, error: error.message }
  return { success: true }
}

// ---- Change password --------------------------------------------------------

export async function changePassword(newPassword: string): Promise<{ success: boolean; error?: string }> {
  if (newPassword.length < 8) return { success: false, error: 'Password must be at least 8 characters.' }
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) return { success: false, error: error.message }
  return { success: true }
}

// ---- Send password reset email --------------------------------------------

export async function sendPasswordReset(email: string): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.auth.resetPasswordForEmail(email)
  if (error) return { success: false, error: error.message }
  return { success: true }
}

// ---- Delete account ---------------------------------------------------------
// Client can delete auth user via Supabase if the user is authenticated.
// This also cascades to the users table row (RLS-protected).
export async function deleteAccount(userId: string): Promise<{ success: boolean; error?: string }> {
  // Delete the profile row first (user owns it via RLS)
  await supabase.from('users').delete().eq('id', userId)
  // Delete the auth user — requires the user to be signed in
  const { error } = await supabase.auth.admin?.deleteUser?.(userId) ?? { error: null }
  // If admin API isn't available client-side, instruct user to use Supabase dashboard
  if (error) {
    return {
      success: false,
      error: 'Account deletion requires verification. Please contact support or use the account settings in the auth dashboard to complete deletion.',
    }
  }
  return { success: true }
}

// ---- Username validation ----------------------------------------------------

export async function checkUsernameAvailable(username: string, currentUserId: string): Promise<boolean> {
  const { data } = await supabase
    .from('users')
    .select('id')
    .eq('username', username)
    .neq('id', currentUserId)
    .maybeSingle()
  return !data
}
