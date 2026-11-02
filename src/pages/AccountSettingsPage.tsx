import { useEffect, useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  MapPin,
  Settings,
  Bell,
  Shield,
  Lock,
  LogOut,
  Trash2,
  Save,
  Check,
  Loader2,
  Info,
  Edit3,
} from 'lucide-react'
import { useAuth } from '../lib/auth'
import { MUNICIPALITIES } from '../lib/explore'
import { formatRelativeTime } from '../lib/labels'
import {
  deleteAccount,
  updateProfile,
  type CommuterPreferences,
} from '../lib/profileSettings'
import type { PreferredLanguage } from '../lib/types'

export function AccountSettingsPage() {
  const { user, profile, signOut, refreshProfile } = useAuth()
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [language, setLanguage] = useState<PreferredLanguage>('english')
  const [municipality, setMunicipality] = useState('')
  const [defaultView, setDefaultView] = useState<'list' | 'map'>('list')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmSignOut, setConfirmSignOut] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => {
    if (profile) {
      setName(profile.name ?? '')
      setUsername(profile.username ?? '')
      setLanguage(profile.preferred_language ?? 'english')
      setMunicipality(profile.home_municipality ?? '')
      const cp = (profile.commuter_preferences ?? {}) as Partial<CommuterPreferences>
      setDefaultView(cp.default_view ?? 'list')
    }
  }, [profile])

  const handleSave = useCallback(async () => {
    if (!user) return
    setSaving(true)
    setError(null)
    setSaved(false)
    const res = await updateProfile(user.id, {
      name,
      username: username || null,
      preferred_language: language,
      home_municipality: municipality || null,
      commuter_preferences: { default_view: defaultView, preferred_transport_modes: [] },
    })
    setSaving(false)
    if (res.success) {
      setSaved(true)
      await refreshProfile()
      setTimeout(() => setSaved(false), 3000)
    } else {
      setError(res.error ?? 'Failed to save.')
    }
  }, [user, name, username, language, municipality, defaultView, refreshProfile])

  async function doSignOut() {
    await signOut()
    navigate('/')
  }

  async function handleDeleteAccount() {
    setDeleting(true)
    setDeleteError(null)
    const result = await deleteAccount()
    if (!result.success) {
      setDeleting(false)
      setDeleteError(result.error ?? 'We could not delete your account right now. Please try again.')
      return
    }
    await signOut()
    navigate('/')
  }

  if (!user) {
    return (
      <div className="app-shell">
        <header className="sticky top-0 z-30 bg-ocean-800 text-white shadow-card">
          <div className="flex items-center gap-3 px-4 py-4">
            <Link to="/" className="grid h-9 w-9 place-items-center rounded-full bg-ocean-700 hover:bg-ocean-600">
              <ArrowLeft size={18} />
            </Link>
            <h1 className="text-lg font-bold">Account Settings</h1>
          </div>
        </header>
        <main className="flex-1 px-4 py-6">
          <div className="card flex flex-col items-center gap-4 text-center">
            <p className="text-sm font-semibold text-ocean-900">Please sign in to manage your account.</p>
            <Link to="/auth" className="btn-primary w-full">Sign In</Link>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <header className="sticky top-0 z-30 bg-ocean-800 text-white shadow-card">
        <div className="flex items-center gap-3 px-4 py-4">
          <Link to="/profile" className="grid h-9 w-9 place-items-center rounded-full bg-ocean-700 hover:bg-ocean-600">
            <ArrowLeft size={18} />
          </Link>
          <span className="grid h-8 w-8 place-items-center rounded-full bg-ocean-600">
            <Settings size={18} />
          </span>
          <h1 className="text-lg font-bold">Account Settings</h1>
        </div>
      </header>

      <main className="flex-1 space-y-4 px-4 py-5">
        {/* General — Edit Profile */}
        <section className="card space-y-3">
          <div className="flex items-center gap-2">
            <Edit3 size={18} className="text-ocean-600" />
            <h2 className="section-title">Edit Profile</h2>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-ocean-700">Display Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                maxLength={60}
                className="input mt-1"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-ocean-700">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="3-20 chars, letters/numbers/underscore"
                maxLength={20}
                className="input mt-1"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-ocean-700">Preferred Language</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as PreferredLanguage)}
                className="input mt-1"
              >
                <option value="english">English</option>
                <option value="filipino">Filipino</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-ocean-700">Home Municipality</label>
              <select
                value={municipality}
                onChange={(e) => setMunicipality(e.target.value)}
                className="input mt-1"
              >
                <option value="">None</option>
                {MUNICIPALITIES.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-ocean-700">Default View</label>
              <div className="mt-1 flex gap-2">
                <button
                  type="button"
                  onClick={() => setDefaultView('list')}
                  className={`flex-1 rounded-xl px-3 py-2 text-xs font-semibold transition active:scale-95 ${
                    defaultView === 'list' ? 'bg-ocean-700 text-white' : 'bg-ocean-50 text-ocean-700'
                  }`}
                >
                  List
                </button>
                <button
                  type="button"
                  onClick={() => setDefaultView('map')}
                  className={`flex-1 rounded-xl px-3 py-2 text-xs font-semibold transition active:scale-95 ${
                    defaultView === 'map' ? 'bg-ocean-700 text-white' : 'bg-ocean-50 text-ocean-700'
                  }`}
                >
                  Map
                </button>
              </div>
            </div>
          </div>

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
          {saved && <p className="rounded-lg bg-leaf-50 px-3 py-2 text-xs text-leaf-700 flex items-center gap-1"><Check size={12} /> Profile saved.</p>}

          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="btn-primary w-full text-sm"
          >
            {saving ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : <><Save size={14} /> Save Changes</>}
          </button>
        </section>

        {/* Notifications */}
        <NotificationSection userId={user.id} prefs={profile?.notification_preferences ?? null} />

        {/* Privacy & Security */}
        <section className="card space-y-3">
          <div className="flex items-center gap-2">
            <Shield size={18} className="text-ocean-600" />
            <h2 className="section-title">Privacy & Security</h2>
          </div>

          <div className="flex items-center gap-2 text-xs text-ocean-600">
            <Lock size={14} className="shrink-0 text-ocean-500" />
            <p>Only you can see your private profile. MoryonGo does not share your data with other users.</p>
          </div>

          <Link to="/offline-settings" className="flex items-center gap-2 text-sm text-ocean-700 hover:text-ocean-900">
            <MapPin size={14} /> Manage downloaded offline data
          </Link>
        </section>

        {/* Security — Change password */}
        <SecuritySection />

        {/* Sign out */}
        <section className="card">
          {!confirmSignOut ? (
            <button
              type="button"
              onClick={() => setConfirmSignOut(true)}
              className="btn-secondary w-full text-sm"
            >
              <LogOut size={14} /> Sign Out
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-ocean-900">Sign out of your account?</p>
              <p className="text-xs text-ocean-600">Your saved places and routes stay on your account. You can sign back in any time.</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => void doSignOut()} className="flex-1 rounded-xl bg-ocean-700 px-4 py-2 text-sm font-bold text-white">
                  Yes, Sign Out
                </button>
                <button type="button" onClick={() => setConfirmSignOut(false)} className="flex-1 rounded-xl bg-ocean-50 px-4 py-2 text-sm font-semibold text-ocean-700">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Delete account */}
        <section className="card border-red-200">
          {!confirmDelete ? (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="flex w-full items-center gap-2 text-sm font-semibold text-red-700"
            >
              <Trash2 size={14} /> Delete Account
            </button>
          ) : (
            <div className="space-y-2">
              <p className="flex items-center gap-1.5 text-sm font-bold text-red-700">
                <Trash2 size={14} /> Delete Account
              </p>
              <div className="space-y-2 text-xs text-ocean-600">
                <p>
                  <span className="font-semibold text-ocean-800">Permanently deleted:</span> your profile and sign-in account, saved places and routes, itineraries and shared trip links, trip history, assistant conversations, subscriptions, event registrations, recent searches, and files you uploaded with reports.
                </p>
                <p>
                  <span className="font-semibold text-ocean-800">Kept without your name:</span> reports, comments, and transport service submissions you sent. They will show as from an unknown user, and their text is not edited, so avoid personal details in them. Moderation records stay in place with your name removed.
                </p>
                <p className="font-semibold text-red-700">This cannot be undone. You will not be able to sign in to this account again.</p>
              </div>
              {deleteError && <p role="alert" className="text-xs font-semibold text-red-700">{deleteError}</p>}
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => void handleDeleteAccount()}
                  className="flex-1 rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
                >
                  {deleting ? 'Deleting...' : 'Permanently delete'}
                </button>
                <button type="button" disabled={deleting} onClick={() => { setConfirmDelete(false); setDeleteError(null) }} className="flex-1 rounded-xl bg-ocean-50 px-4 py-2 text-sm font-semibold text-ocean-700 disabled:opacity-60">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Info */}
        <section className="card flex items-start gap-2">
          <Info size={16} className="mt-0.5 shrink-0 text-ocean-500" />
          <p className="text-xs text-ocean-600">
            Account created {profile ? formatRelativeTime(profile.created_at) : 'recently'}.
            Changes to your profile are saved to your authenticated account and protected by Row Level Security.
          </p>
        </section>
      </main>
    </div>
  )
}

// ---- Notification Section ---------------------------------------------------

function NotificationSection({
  userId,
  prefs,
}: {
  userId: string
  prefs: Record<string, unknown> | null
}) {
  const { updateNotificationPreferences } = useNotificationUpdater(userId)
  const defaults = {
    transport_alerts: true,
    fare_updates: true,
    weather_advisories: true,
    saved_route_updates: true,
    event_reminders: false,
  }
  const current = { ...defaults, ...(prefs ?? {}) }

  const items: { key: keyof typeof defaults; label: string }[] = [
    { key: 'transport_alerts', label: 'Transport Alerts' },
    { key: 'fare_updates', label: 'Fare Updates' },
    { key: 'weather_advisories', label: 'Weather Advisories' },
    { key: 'saved_route_updates', label: 'Saved Route Updates' },
    { key: 'event_reminders', label: 'Event Reminders' },
  ]

  return (
    <section className="card space-y-3">
      <div className="flex items-center gap-2">
        <Bell size={18} className="text-ocean-600" />
        <h2 className="section-title">Notifications</h2>
      </div>
      <p className="text-xs text-ocean-600">
        Manage which updates you receive. Delivery depends on your device settings and connectivity.
      </p>
      <div className="space-y-2">
        {items.map((item) => (
          <ToggleRow
            key={item.key}
            label={item.label}
            checked={current[item.key] as boolean}
            onChange={(val) => void updateNotificationPreferences({ [item.key]: val })}
          />
        ))}
      </div>
    </section>
  )
}

function useNotificationUpdater(userId: string) {
  const { refreshProfile } = useAuth()
  const updateNotificationPreferences = useCallback(async (prefs: Record<string, boolean>) => {
    const { updateNotificationPreferences: fn } = await import('../lib/profileSettings')
    const res = await fn(userId, prefs)
    if (res.success) await refreshProfile()
  }, [userId, refreshProfile])

  return { updateNotificationPreferences }
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-ocean-800">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 rounded-full transition ${checked ? 'bg-ocean-600' : 'bg-ocean-200'}`}
        aria-label={`Toggle ${label}`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`} />
      </button>
    </div>
  )
}

// ---- Security Section ------------------------------------------------------

function SecuritySection() {
  const [newPassword, setNewPassword] = useState('')
  const [changing, setChanging] = useState(false)
  const [result, setResult] = useState<{ success: boolean; error?: string } | null>(null)

  async function handleChange() {
    if (newPassword.length < 8) return
    setChanging(true)
    setResult(null)
    const { changePassword } = await import('../lib/profileSettings')
    const res = await changePassword(newPassword)
    setChanging(false)
    setResult(res)
    if (res.success) setNewPassword('')
  }

  return (
    <section className="card space-y-3">
      <div className="flex items-center gap-2">
        <Lock size={18} className="text-ocean-600" />
        <h2 className="section-title">Security</h2>
      </div>

      <div>
        <label className="text-xs font-semibold text-ocean-700">Change Password</label>
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="New password (min 8 characters)"
          className="input mt-1"
        />
      </div>

      {result?.success && <p className="rounded-lg bg-leaf-50 px-3 py-2 text-xs text-leaf-700 flex items-center gap-1"><Check size={12} /> Password updated.</p>}
      {result && !result.success && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{result.error}</p>}

      <button
        type="button"
        onClick={() => void handleChange()}
        disabled={changing || newPassword.length < 8}
        className="btn-secondary w-full text-sm"
      >
        {changing ? <><Loader2 size={14} className="animate-spin" /> Updating…</> : 'Update Password'}
      </button>
    </section>
  )
}
