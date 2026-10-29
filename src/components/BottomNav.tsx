import { Link, useLocation } from 'react-router-dom'
import { Home, Route, Sparkles, Compass, User } from 'lucide-react'

const NAV = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/plan', label: 'Plan', icon: Compass },
  { to: '/mory-ai', label: 'Mory AI', icon: Sparkles },
  { to: '/jeepney-routes', label: 'Routes', icon: Route },
  { to: '/profile', label: 'Profile', icon: User },
]

export function BottomNav() {
  const loc = useLocation()
  return (
    <nav className="sticky bottom-0 z-30 border-t border-sand-200 bg-white/95 backdrop-blur">
      <ul className="flex">
        {NAV.map((n) => {
          const active = n.to === '/' ? loc.pathname === '/' : loc.pathname.startsWith(n.to)
          return (
            <li key={n.to} className="flex-1">
              <Link
                to={n.to}
                className={`flex flex-col items-center gap-1 py-2.5 ${
                  active ? 'text-ocean-800' : 'text-ocean-600/70'
                }`}
              >
                <span
                  className={`grid h-9 w-9 place-items-center rounded-full transition ${
                    active ? 'bg-ocean-100' : 'bg-transparent'
                  }`}
                >
                  <n.icon size={22} />
                </span>
                <span className="text-xs font-semibold">{n.label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
