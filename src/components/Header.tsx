import { Bell, MapPin, User as UserIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useLocation } from '../lib/location'
import { Logo } from './Logo'

export function Header() {
  const { user, profile } = useAuth()
  const { status, municipality } = useLocation()

  const locationLabel =
    status === 'granted' && municipality
      ? `${municipality}, Marinduque`
      : status === 'denied' || status === 'unavailable'
        ? 'Location unavailable'
        : 'Marinduque, Philippines'

  return (
    <header className="sticky top-0 z-30 bg-ocean-800 text-white shadow-card">
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Logo size={40} />
            <div className="leading-tight">
              <div className="text-xl font-extrabold tracking-tight">MoryonGo</div>
              <div className="flex items-center gap-1 text-xs text-ocean-100">
                <MapPin size={12} className="text-terra-300" />
                <span className="truncate max-w-[180px]">{locationLabel}</span>
              </div>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <Link
              to="/notifications"
              aria-label="Notifications"
              className="grid h-10 w-10 place-items-center rounded-full bg-ocean-700 hover:bg-ocean-600 transition"
            >
              <Bell size={20} />
            </Link>
            <Link
              to={user ? '/profile' : '/auth'}
              aria-label="Profile"
              className="grid h-10 w-10 place-items-center rounded-full bg-ocean-700 hover:bg-ocean-600 transition"
            >
              {profile?.profile_photo ? (
                <img
                  src={profile.profile_photo}
                  alt="Profile"
                  className="h-10 w-10 rounded-full object-cover"
                />
              ) : (
                <UserIcon size={20} />
              )}
            </Link>
          </div>
        </div>

        <GpsStatusRow />
      </div>
    </header>
  )
}

function GpsStatusRow() {
  const { status } = useLocation()

  if (status === 'granted') {
    return null
  }

  if (status === 'denied' || status === 'unavailable') {
    return (
      <div className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-ocean-900/60 px-3 py-2 text-sm">
        <span>Location unavailable.</span>
        <span className="text-ocean-100">Tap "Enable Location" below.</span>
      </div>
    )
  }

  return (
    <div className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-ocean-900/60 px-3 py-2 text-sm">
      <span>Location permission is needed to show nearby places and transportation.</span>
      <span className="text-ocean-100">Allow Location</span>
    </div>
  )
}
