import { Link } from 'react-router-dom'
import {
  Compass,
  Wallet,
  TrendingUp,
  Table2,
  Percent,
  Bus,
  Bike,
  Sailboat,
  Map,
  CloudSun,
  AlertTriangle,
  Palmtree,
  Calendar,
  Siren,
  Bookmark,
  Route as RouteIcon,
  Sparkles,
  Flag,
  Receipt,
  MapPin,
  Database,
  Luggage,
  Calculator,
  Share2,
  type LucideIcon,
} from 'lucide-react'

interface QuickAction {
  to: string
  label: string
  icon: LucideIcon
  tone: string
}

const ACTIONS: QuickAction[] = [
  { to: '/plan', label: 'Plan a Trip', icon: Compass, tone: 'bg-ocean-100 text-ocean-800' },
  { to: '/mory-ai', label: 'Mory AI', icon: Sparkles, tone: 'bg-leaf-400/30 text-leaf-700' },
  { to: '/saved-routes', label: 'My Trips', icon: RouteIcon, tone: 'bg-ocean-100 text-ocean-800' },
  { to: '/saved-places', label: 'Saved Places', icon: Bookmark, tone: 'bg-ocean-100 text-ocean-800' },
  { to: '/fare', label: 'Check Fare', icon: Wallet, tone: 'bg-leaf-400/30 text-leaf-700' },
  { to: '/fare-updates', label: 'Fare Updates', icon: TrendingUp, tone: 'bg-terra-100 text-terra-700' },
  { to: '/fare-matrix', label: 'Fare Matrix', icon: Table2, tone: 'bg-ocean-100 text-ocean-800' },
  { to: '/discounts', label: 'Discounts', icon: Percent, tone: 'bg-leaf-400/30 text-leaf-700' },
  { to: '/jeepney-routes', label: 'Jeepney Routes', icon: Bus, tone: 'bg-ocean-100 text-ocean-800' },
  { to: '/tricycle-routes', label: 'Tricycle Routes', icon: Bike, tone: 'bg-terra-100 text-terra-700' },
  { to: '/ports', label: 'Ports & Ferries', icon: Sailboat, tone: 'bg-ocean-100 text-ocean-800' },
  { to: '/transport-map', label: 'Transport Map', icon: Map, tone: 'bg-ocean-100 text-ocean-800' },
  { to: '/weather', label: 'Weather', icon: CloudSun, tone: 'bg-sand-200 text-terra-700' },
  { to: '/transport-alerts', label: 'Alerts', icon: AlertTriangle, tone: 'bg-terra-100 text-terra-700' },
  { to: '/explore', label: 'Explore', icon: Palmtree, tone: 'bg-terra-100 text-terra-700' },
  { to: '/tourist-planner', label: 'Trip Planner', icon: Luggage, tone: 'bg-leaf-400/30 text-leaf-700' },
  { to: '/trip-cost', label: 'Cost Calc', icon: Calculator, tone: 'bg-ocean-100 text-ocean-800' },
  { to: '/share', label: 'Share Trip', icon: Share2, tone: 'bg-leaf-400/30 text-leaf-700' },
  { to: '/nearby-places', label: 'Nearby', icon: MapPin, tone: 'bg-ocean-100 text-ocean-800' },
  { to: '/events', label: 'Events', icon: Calendar, tone: 'bg-leaf-400/30 text-leaf-700' },
  { to: '/emergency', label: 'Emergency', icon: Siren, tone: 'bg-red-100 text-red-700' },
  { to: '/community-reports', label: 'Report', icon: Flag, tone: 'bg-terra-100 text-terra-700' },
  { to: '/fare-concerns', label: 'Fare Concerns', icon: Receipt, tone: 'bg-terra-100 text-terra-700' },
  { to: '/offline-settings', label: 'Offline', icon: Database, tone: 'bg-ocean-100 text-ocean-800' },
]

export function QuickActions() {
  return (
    <section>
      <h2 className="section-title mb-3">Quick Actions</h2>
      <div className="grid grid-cols-4 gap-2">
        {ACTIONS.map((a) => (
          <Link
            key={a.to}
            to={a.to}
            className="flex flex-col items-center gap-2 rounded-2xl bg-white p-3 shadow-card transition hover:shadow-cardHover active:scale-95"
          >
            <span className={`grid h-12 w-12 place-items-center rounded-full ${a.tone}`}>
              <a.icon size={24} />
            </span>
            <span className="text-center text-xs font-semibold leading-tight text-ocean-900">
              {a.label}
            </span>
          </Link>
        ))}
      </div>
    </section>
  )
}
