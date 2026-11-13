import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { AuthError, Session, User } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type { UserProfile } from './types'

interface AuthContextValue {
  session: Session | null
  user: User | null
  profile: UserProfile | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signUp: (email: string, password: string, name: string) => Promise<{ error: string | null }>
  requestPasswordReset: (email: string) => Promise<{ error: string | null }>
  updatePassword: (password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

const NETWORK_ERROR = 'We could not reach the server. Check your connection and try again.'
const EXISTING_ACCOUNT_ERROR = 'An account with this email already exists. Sign in instead.'

function describeAuthError(error: AuthError): string {
  switch (error.code) {
    case 'invalid_credentials':
      return 'Wrong email or password. Please try again.'
    case 'user_already_exists':
    case 'email_exists':
      return EXISTING_ACCOUNT_ERROR
    case 'weak_password':
      return 'Password is too weak. Please choose a stronger one.'
    case 'same_password':
      return 'Your new password must be different from your old one.'
    case 'email_address_invalid':
      return 'Please enter a valid email address.'
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit':
      return 'Too many attempts. Please wait a moment and try again.'
    default:
      return error.message
  }
}

const LOCAL_HOSTNAMES = ['localhost', '127.0.0.1']

// Local addresses are not reachable from the user's email client, so the reset
// link falls back to the project's published Site URL instead.
function passwordResetRedirect(): string | undefined {
  const { origin, hostname } = window.location
  if (LOCAL_HOSTNAMES.includes(hostname)) return undefined
  return `${origin}/reset-password`
}

async function ensureProfile(user: User): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()

  if (error) {
    console.error('Failed to load profile:', error.message)
    return null
  }

  if (data) return data as UserProfile

  // First-time sign-in: create the public profile row.
  const { data: inserted, error: insertError } = await supabase
    .from('users')
    .insert({
      id: user.id,
      email: user.email ?? null,
      name:
        (user.user_metadata?.name as string | undefined) ??
        (user.email ? user.email.split('@')[0] : null),
    })
    .select('*')
    .maybeSingle()

  if (insertError) {
    console.error('Failed to create profile:', insertError.message)
    return null
  }
  return inserted as UserProfile | null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((event, sess) => {
      ;(async () => {
        setSession(sess)
        if (event === 'SIGNED_OUT') {
          setProfile(null)
        } else if (sess?.user) {
          const p = await ensureProfile(sess.user)
          setProfile(p)
        }
      })()
    })

    return () => sub.subscription.unsubscribe()
  }, [])

  const refreshProfile = useCallback(async () => {
    if (!session?.user) return
    const p = await ensureProfile(session.user)
    setProfile(p)
  }, [session?.user])

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      return { error: error ? describeAuthError(error) : null }
    } catch {
      return { error: NETWORK_ERROR }
    }
  }, [])

  const signUp = useCallback(async (email: string, password: string, name: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name } },
      })
      if (error) return { error: describeAuthError(error) }
      if (!data.user) return { error: 'Sign-up failed. Please try again.' }
      if (data.user.identities?.length === 0) return { error: EXISTING_ACCOUNT_ERROR }
      if (!data.session) {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
        if (signInError) return { error: describeAuthError(signInError) }
      }
      return { error: null }
    } catch {
      return { error: NETWORK_ERROR }
    }
  }, [])

  const requestPasswordReset = useCallback(async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: passwordResetRedirect(),
      })
      return { error: error ? describeAuthError(error) : null }
    } catch {
      return { error: NETWORK_ERROR }
    }
  }, [])

  const updatePassword = useCallback(async (password: string) => {
    try {
      const { error } = await supabase.auth.updateUser({ password })
      return { error: error ? describeAuthError(error) : null }
    } catch {
      return { error: NETWORK_ERROR }
    }
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setProfile(null)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      loading,
      signIn,
      signUp,
      requestPasswordReset,
      updatePassword,
      signOut,
      refreshProfile,
    }),
    [
      session, profile, loading, signIn, signUp, requestPasswordReset,
      updatePassword, signOut, refreshProfile,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
