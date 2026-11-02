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

const GENERIC_DELETE_ERROR = 'We could not delete your account right now. Please try again.'

export async function deleteAccount(): Promise<{ success: boolean; error?: string }> {
  const { data: sessionData } = await supabase.auth.getSession()
  const accessToken = sessionData.session?.access_token
  if (!accessToken) {
    return { success: false, error: 'You need to be signed in to delete your account.' }
  }

  try {
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-account`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
      },
    })
    const body = (await response.json().catch(() => null)) as { success?: unknown; error?: unknown } | null
    if (!response.ok || body?.success !== true) {
      return { success: false, error: typeof body?.error === 'string' ? body.error : GENERIC_DELETE_ERROR }
    }
    return { success: true }
  } catch {
    return { success: false, error: 'We could not reach the server. Check your connection and try again.' }
  }
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
