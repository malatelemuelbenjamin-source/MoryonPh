import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, LogOut, User as UserIcon, Mail, MapPin, Percent, Bookmark, Route as RouteIcon, Settings, History, Truck, ShieldCheck, Share2, Compass as CompassIcon, Calculator } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { useLocation } from '../lib/location'
import { Logo } from '../components/Logo'
import { fetchPassengerCategories, setPreferredPassengerCategory } from '../lib/discounts'
import type { PassengerCategoryRow } from '../lib/types'

export function ProfilePage() {
  const { user, profile, signOut, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const { municipality } = useLocation()

  const [categories, setCategories] = useState<PassengerCategoryRow[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void (async () => {
      const cats = await fetchPassengerCategories()
      setCategories(cats)
      setSelectedCategory(profile?.preferred_passenger_category_id ?? null)
    })()
  }, [profile?.preferred_passenger_category_id])

  async function savePreference(catId: string | null) {
    if (!user) return
    setSaving(true)
    setSelectedCategory(catId)
    const ok = await setPreferredPassengerCategory(user.id, catId)
    if (ok) await refreshProfile()
    setSaving(false)
  }

  if (!user) {
    return (
      <div className="app-shell">
        <header className="sticky top-0 z-30 bg-ocean-800 text-white shadow-card">
          <div className="flex items-center gap-3 px-4 py-4">
            <Link
              to="/"
              aria-label="Back to home"
              className="grid h-9 w-9 place-items-center rounded-full bg-ocean-700 hover:bg-ocean-600"
            >
              <ArrowLeft size={18} />
            </Link>
            <h1 className="text-lg font-bold">Profile</h1>
          </div>
        </header>
        <main className="flex-1 px-4 py-6">
          <div className="card flex flex-col items-center gap-4 text-center">
            <Logo size={48} />
            <div>
              <p className="text-base font-semibold text-ocean-900">You are not signed in.</p>
              <p className="mt-1 text-sm text-ocean-700">
                Sign in to save places and recent searches.
              </p>
            </div>
            <Link to="/auth" className="btn-primary w-full">
              Sign In / Create Account
            </Link>
          </div>
        </main>
      </div>
    )
  }

  async function doSignOut() {
    await signOut()
    navigate('/')
  }

  return (
    <div className="app-shell">
      <header className="sticky top-0 z-30 bg-ocean-800 text-white shadow-card">
        <div className="flex items-center gap-3 px-4 py-4">
          <Link
            to="/"
            aria-label="Back to home"
            className="grid h-9 w-9 place-items-center rounded-full bg-ocean-700 hover:bg-ocean-600"
          >
            <ArrowLeft size={18} />
          </Link>
          <h1 className="text-lg font-bold">Profile</h1>
        </div>
      </header>
      <main className="flex-1 space-y-4 px-4 py-6">
        <div className="card flex items-center gap-4">
          <span className="grid h-16 w-16 place-items-center rounded-full bg-ocean-700 text-white">
            <UserIcon size={28} />
          </span>
          <div>
            <p className="text-lg font-bold text-ocean-900">
              {profile?.name ?? user.email?.split('@')[0] ?? 'MoryonGo User'}
            </p>
            <p className="flex items-center gap-1 text-sm text-ocean-700">
              <Mail size={14} /> {user.email}
            </p>
            {profile?.home_municipality && (
              <p className="flex items-center gap-1 text-sm text-ocean-700">
                <MapPin size={14} /> {profile.home_municipality}
              </p>
            )}
            {municipality && !profile?.home_municipality && (
              <p className="flex items-center gap-1 text-sm text-ocean-700">
                <MapPin size={14} /> {municipality}
              </p>
            )}
          </div>
        </div>

        <Link to="/account-settings" className="card flex items-center gap-3 hover:shadow-cardHover transition active:scale-[0.98]">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-ocean-100 text-ocean-700">
            <Settings size={18} />
          </span>
          <div>
            <p className="text-sm font-semibold text-ocean-900">Account Settings</p>
            <p className="text-xs text-ocean-600">Privacy, notifications, security</p>
          </div>
        </Link>

        <button type="button" onClick={doSignOut} className="btn-secondary w-full">
          <LogOut size={18} />
          Sign Out
        </button>

        {/* Preferred passenger category */}
        <div className="card space-y-3">
          <div className="flex items-center gap-2">
            <Percent size={18} className="text-ocean-600" />
            <p className="text-sm font-semibold text-ocean-900">Preferred Passenger Type</p>
          </div>
          <p className="text-xs text-ocean-600">
            This preselects your category in the Fare Calculator. It does not prove eligibility —
            you must still meet the applicable requirements.
          </p>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => savePreference(null)}
              disabled={saving}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition active:scale-95 ${
                selectedCategory === null
                  ? 'bg-ocean-700 text-white'
                  : 'bg-ocean-50 text-ocean-700 hover:bg-ocean-100'
              }`}
            >
              None
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => savePreference(c.id)}
                disabled={saving}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition active:scale-95 ${
                  selectedCategory === c.id
                    ? 'bg-ocean-700 text-white'
                    : 'bg-ocean-50 text-ocean-700 hover:bg-ocean-100'
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>

        <Link to="/saved-places" className="card flex items-center gap-3 hover:shadow-cardHover">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-ocean-100 text-ocean-700">
            <Bookmark size={18} />
          </span>
          <div>
            <p className="text-sm font-semibold text-ocean-900">Saved Places</p>
            <p className="text-xs text-ocean-600">Mga Naka-save na Lugar — manage your favorite locations</p>
          </div>
        </Link>

        <Link to="/saved-routes" className="card flex items-center gap-3 hover:shadow-cardHover">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-ocean-100 text-ocean-700">
            <RouteIcon size={18} />
          </span>
          <div>
            <p className="text-sm font-semibold text-ocean-900">My Saved Trips</p>
            <p className="text-xs text-ocean-600">Mga Naka-save na Biyahe — manage your favorite journeys</p>
          </div>
        </Link>

        <Link to="/trip-history" className="card flex items-center gap-3 hover:shadow-cardHover transition active:scale-[0.98]">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-ocean-100 text-ocean-700">
            <History size={18} />
          </span>
          <div>
            <p className="text-sm font-semibold text-ocean-900">Trip History</p>
            <p className="text-xs text-ocean-600">Review planned, started, and completed journeys</p>
          </div>
        </Link>

        <Link to="/tourist-planner" className="card flex items-center gap-3 hover:shadow-cardHover transition active:scale-[0.98]">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-leaf-100 text-leaf-700">
            <CompassIcon size={18} />
          </span>
          <div>
            <p className="text-sm font-semibold text-ocean-900">Tourist Trip Planner</p>
            <p className="text-xs text-ocean-600">Plan your Marinduque itinerary with costs and transport</p>
          </div>
        </Link>

        <Link to="/trip-cost" className="card flex items-center gap-3 hover:shadow-cardHover transition active:scale-[0.98]">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-ocean-100 text-ocean-700">
            <Calculator size={18} />
          </span>
          <div>
            <p className="text-sm font-semibold text-ocean-900">Trip Cost Calculator</p>
            <p className="text-xs text-ocean-600">Estimate total travel expenses including transport and extras</p>
          </div>
        </Link>

        <Link to="/share" className="card flex items-center gap-3 hover:shadow-cardHover transition active:scale-[0.98]">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-ocean-100 text-ocean-700">
            <Share2 size={18} />
          </span>
          <div>
            <p className="text-sm font-semibold text-ocean-900">Manage Shared Trips</p>
            <p className="text-xs text-ocean-600">View, extend, revoke, or delete your active share links</p>
          </div>
        </Link>

        <Link to="/operator-portal" className="card flex items-center gap-3 hover:shadow-cardHover transition active:scale-[0.98]">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-leaf-100 text-leaf-700">
            <Truck size={18} />
          </span>
          <div>
            <p className="text-sm font-semibold text-ocean-900">Transport Partner Portal</p>
            <p className="text-xs text-ocean-600">For drivers & operators — submit routes, fares, and updates</p>
          </div>
        </Link>

        <Link to="/admin" className="card flex items-center gap-3 hover:shadow-cardHover transition active:scale-[0.98]">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-ocean-900 text-white">
            <ShieldCheck size={18} />
          </span>
          <div>
            <p className="text-sm font-semibold text-ocean-900">Admin Dashboard</p>
            <p className="text-xs text-ocean-600">Manage routes, fares, reports, alerts, and users</p>
          </div>
        </Link>

        <div className="card">
          <p className="text-sm font-semibold text-ocean-800">Language preference</p>
          <p className="mt-1 text-sm text-ocean-700">
            {profile?.preferred_language === 'filipino' ? 'Filipino' : 'English'}
          </p>
        </div>
      </main>
    </div>
  )
}
