import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  Loader2,
  ShieldCheck,
  AlertCircle,
  Users,
  Route as RouteIcon,
  Bus,
  PhilippinePeso,
  Building2,
  ClipboardList,
  AlertTriangle,
  Bell,
  Calendar,
  MapPin,
  Activity,
  Settings,
  FileText,
  Anchor,
  Bike,
  Cloud,
  Map as MapIcon,
  PartyPopper,
  Store,
  Siren,
  History,
  ClipboardCheck,
  Menu,
  X,
} from 'lucide-react'
import { useAuth } from '../lib/auth'
import { isAlertAdmin } from '../lib/transportAlerts'
import {
  fetchDashboardMetrics,
  fetchRecentActivity,
  fetchAdminAuditLogs,
  ADMIN_MODULES,
  type DashboardMetrics,
  type RecentActivityItem,
  type AdminAuditLogRow,
} from '../lib/adminDashboard'
import { formatRelativeTime } from '../lib/labels'

const ICON_MAP: Record<string, typeof Users> = {
  route: RouteIcon,
  fare: PhilippinePeso,
  matrix: FileText,
  map: MapIcon,
  tricycle: Bike,
  port: Anchor,
  operator: Building2,
  report: ClipboardList,
  concern: AlertTriangle,
  alert: Bell,
  weather: Cloud,
  destination: MapPin,
  event: PartyPopper,
  nearby: Store,
  emergency: Siren,
  users: Users,
  audit: History,
  verify: ClipboardCheck,
  settings: Settings,
}

export function AdminDashboardPage() {
  const { user } = useAuth()
  const [adminCheck, setAdminCheck] = useState<boolean | null>(null)
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [activity, setActivity] = useState<RecentActivityItem[]>([])
  const [auditLogs, setAuditLogs] = useState<AdminAuditLogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }
    void (async () => {
      const isAdmin = await isAlertAdmin()
      setAdminCheck(isAdmin)
      if (!isAdmin) {
        setLoading(false)
        return
      }
      const [m, act, logs] = await Promise.all([
        fetchDashboardMetrics(),
        fetchRecentActivity(8),
        fetchAdminAuditLogs(8),
      ])
      setMetrics(m)
      setActivity(act)
      setAuditLogs(logs)
      setLoading(false)
    })()
  }, [user])

  const summaryCards = useMemo(() => {
    if (!metrics) return []
    return [
      { label: 'Registered Users', value: metrics.totalUsers, icon: Users, to: '/admin/users', color: 'text-ocean-700 bg-ocean-50' },
      { label: 'Active Routes', value: metrics.totalRoutes, icon: RouteIcon, to: '/admin/routes', color: 'text-leaf-700 bg-leaf-50' },
      { label: 'Transport Modes', value: metrics.activeTransportModes, icon: Bus, to: '/admin/routes', color: 'text-ocean-700 bg-ocean-50' },
      { label: 'Published Fares', value: metrics.publishedFares, icon: PhilippinePeso, to: '/admin/fares', color: 'text-leaf-700 bg-leaf-50' },
      { label: 'Pending Operator Subs', value: metrics.pendingOperatorSubmissions, icon: Building2, to: '/operator-portal/admin', color: 'text-terra-700 bg-terra-50' },
      { label: 'Pending Community Reports', value: metrics.pendingCommunityReports, icon: ClipboardList, to: '/community-reports/admin', color: 'text-terra-700 bg-terra-50' },
      { label: 'Pending Fare Concerns', value: metrics.pendingFareConcerns, icon: AlertTriangle, to: '/fare-concerns/admin', color: 'text-terra-700 bg-terra-50' },
      { label: 'Active Alerts', value: metrics.activeTransportAlerts, icon: Bell, to: '/transport-alerts/admin', color: 'text-ocean-700 bg-ocean-50' },
      { label: 'Upcoming Events', value: metrics.upcomingEvents, icon: Calendar, to: '/admin/events', color: 'text-leaf-700 bg-leaf-50' },
      { label: 'Total Destinations', value: metrics.totalDestinations, icon: MapPin, to: '/admin/destinations', color: 'text-ocean-700 bg-ocean-50' },
      { label: 'Total Operators', value: metrics.totalOperators, icon: Building2, to: '/operator-portal/admin', color: 'text-ocean-700 bg-ocean-50' },
      { label: 'Pending Event Verif.', value: metrics.pendingEventVerifications, icon: PartyPopper, to: '/admin/events', color: 'text-terra-700 bg-terra-50' },
    ]
  }, [metrics])

  if (!user) {
    return (
      <div className="app-shell">
        <Header onMenu={() => setSidebarOpen(false)} />
        <main className="flex-1 px-4 py-6">
          <div className="card text-center">
            <p className="text-sm font-semibold text-ocean-900">Sign in to access the admin dashboard.</p>
            <Link to="/auth" className="btn-primary mt-3">Sign In</Link>
          </div>
        </main>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="app-shell">
        <Header onMenu={() => setSidebarOpen(false)} />
        <main className="flex-1 px-4 py-6">
          <div className="card flex items-center gap-3">
            <Loader2 size={20} className="animate-spin text-ocean-600" />
            <p className="text-sm text-ocean-700">Loading admin dashboard…</p>
          </div>
        </main>
      </div>
    )
  }

  if (adminCheck === false) {
    return (
      <div className="app-shell">
        <Header onMenu={() => setSidebarOpen(false)} />
        <main className="flex-1 px-4 py-6">
          <div className="card text-center space-y-3">
            <ShieldCheck size={28} className="mx-auto text-ocean-400" />
            <p className="text-sm font-semibold text-ocean-900">Admin access required.</p>
            <p className="text-xs text-ocean-600">You need community reviewer privileges to access this dashboard.</p>
            <Link to="/profile" className="btn-secondary">Back to Profile</Link>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <Header onMenu={() => setSidebarOpen(true)} />

      {/* Sidebar overlay (mobile) */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/30" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 z-50 h-full w-72 overflow-y-auto bg-ocean-900 text-white transition-transform duration-200 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex items-center justify-between px-4 py-4 border-b border-ocean-700">
          <h2 className="text-sm font-bold">Admin Modules</h2>
          <button type="button" onClick={() => setSidebarOpen(false)} className="lg:hidden text-ocean-300">
            <X size={18} />
          </button>
        </div>
        <nav className="space-y-1 p-3">
          <Link
            to="/admin"
            onClick={() => setSidebarOpen(false)}
            className="block rounded-xl bg-ocean-700 px-3 py-2 text-xs font-semibold"
          >
            Overview
          </Link>
          <Link
            to="/admin/control-center"
            onClick={() => setSidebarOpen(false)}
            className="flex items-center gap-2 rounded-xl bg-terra-500 px-3 py-2 text-xs font-bold text-white hover:bg-terra-600 transition"
          >
            <ShieldCheck size={14} />
            Control Center
          </Link>
          {ADMIN_MODULES.map((mod) => {
            const Icon = ICON_MAP[mod.icon] ?? FileText
            const badge = mod.metricKey && metrics ? metrics[mod.metricKey] : undefined
            return (
              <Link
                key={mod.to}
                to={mod.to}
                onClick={() => setSidebarOpen(false)}
                className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-ocean-100 hover:bg-ocean-800 transition"
              >
                <Icon size={14} className="shrink-0 text-ocean-300" />
                <span className="flex-1 truncate">{mod.label}</span>
                {badge !== undefined && badge > 0 && (
                  <span className="rounded-full bg-terra-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                    {badge}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 space-y-4 px-4 py-5 lg:ml-72">
        {/* Quick stats grid */}
        <section>
          <h2 className="mb-2 text-sm font-bold text-ocean-900">Overview</h2>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4">
            {summaryCards.map((card) => {
              const Icon = card.icon
              return (
                <Link
                  key={card.label}
                  to={card.to}
                  className="card flex flex-col gap-2 hover:shadow-cardHover transition active:scale-[0.98]"
                >
                  <div className="flex items-center justify-between">
                    <span className={`grid h-9 w-9 place-items-center rounded-full ${card.color}`}>
                      <Icon size={16} />
                    </span>
                    {card.value > 0 && (
                      <span className="text-lg font-bold text-ocean-900">{card.value}</span>
                    )}
                  </div>
                  <p className="text-[10px] font-medium text-ocean-600">{card.label}</p>
                </Link>
              )
            })}
          </div>
        </section>

        {/* Pending items alert */}
        {(metrics?.pendingOperatorSubmissions ?? 0) + (metrics?.pendingCommunityReports ?? 0) + (metrics?.pendingFareConcerns ?? 0) > 0 && (
          <section className="card flex items-start gap-3 border-l-4 border-terra-500 bg-terra-50">
            <AlertCircle size={18} className="mt-0.5 shrink-0 text-terra-600" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-terra-800">Items Needing Review</p>
              <div className="flex flex-wrap gap-3 text-xs text-terra-700">
                {(metrics?.pendingOperatorSubmissions ?? 0) > 0 && (
                  <Link to="/operator-portal/admin" className="font-semibold underline">
                    {metrics!.pendingOperatorSubmissions} operator submissions
                  </Link>
                )}
                {(metrics?.pendingCommunityReports ?? 0) > 0 && (
                  <Link to="/community-reports/admin" className="font-semibold underline">
                    {metrics!.pendingCommunityReports} community reports
                  </Link>
                )}
                {(metrics?.pendingFareConcerns ?? 0) > 0 && (
                  <Link to="/fare-concerns/admin" className="font-semibold underline">
                    {metrics!.pendingFareConcerns} fare concerns
                  </Link>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Two columns: Recent Activity + Audit Logs */}
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Recent Activity */}
          <section className="space-y-2">
            <h2 className="flex items-center gap-1.5 text-sm font-bold text-ocean-900">
              <Activity size={14} /> Recent Activity
            </h2>
            {activity.length === 0 ? (
              <div className="card text-center">
                <p className="text-xs text-ocean-500">No recent activity.</p>
              </div>
            ) : (
              <div className="card divide-y divide-ocean-50">
                {activity.map((item) => (
                  <div key={`${item.entity_type}-${item.id}`} className="flex items-start justify-between gap-2 py-2">
                    <div>
                      <p className="text-xs font-medium text-ocean-800">
                        {item.action.replace(/_/g, ' ')}
                      </p>
                      <p className="text-[10px] text-ocean-500 capitalize">{item.entity_type.replace(/_/g, ' ')}</p>
                      {item.summary && (
                        <p className="mt-0.5 text-[10px] text-ocean-600 line-clamp-2">{item.summary}</p>
                      )}
                    </div>
                    <p className="text-[10px] text-ocean-400">{formatRelativeTime(item.created_at)}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Centralized Audit Logs */}
          <section className="space-y-2">
            <h2 className="flex items-center gap-1.5 text-sm font-bold text-ocean-900">
              <History size={14} /> Admin Audit Log
            </h2>
            {auditLogs.length === 0 ? (
              <div className="card text-center">
                <p className="text-xs text-ocean-500">No admin audit entries yet.</p>
              </div>
            ) : (
              <div className="card divide-y divide-ocean-50">
                {auditLogs.map((log) => (
                  <div key={log.id} className="flex items-start justify-between gap-2 py-2">
                    <div>
                      <p className="text-xs font-medium text-ocean-800">{log.action}</p>
                      <p className="text-[10px] text-ocean-500">{log.entity_type}</p>
                      {log.summary && (
                        <p className="mt-0.5 text-[10px] text-ocean-600 line-clamp-2">{log.summary}</p>
                      )}
                    </div>
                    <p className="text-[10px] text-ocean-400">{formatRelativeTime(log.created_at)}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Module grid */}
        <section className="space-y-2">
          <h2 className="text-sm font-bold text-ocean-900">Management Modules</h2>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
            {ADMIN_MODULES.map((mod) => {
              const Icon = ICON_MAP[mod.icon] ?? FileText
              const badge = mod.metricKey && metrics ? metrics[mod.metricKey] : undefined
              return (
                <Link
                  key={mod.to}
                  to={mod.to}
                  className="card flex items-start gap-2.5 hover:shadow-cardHover transition active:scale-[0.98]"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ocean-50 text-ocean-700">
                    <Icon size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <p className="truncate text-xs font-semibold text-ocean-900">{mod.label}</p>
                      {badge !== undefined && badge > 0 && (
                        <span className="rounded-full bg-terra-500 px-1.5 py-0.5 text-[9px] font-bold text-white">
                          {badge}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-ocean-500 line-clamp-1">{mod.description}</p>
                  </div>
                </Link>
              )
            })}
          </div>
        </section>
      </main>
    </div>
  )
}

function Header({ onMenu }: { onMenu: () => void }) {
  return (
    <header className="sticky top-0 z-30 bg-ocean-900 text-white shadow-card">
      <div className="flex items-center gap-3 px-4 py-4">
        <button type="button" onClick={onMenu} className="grid h-9 w-9 place-items-center rounded-full bg-ocean-800 hover:bg-ocean-700 lg:hidden">
          <Menu size={18} />
        </button>
        <Link to="/profile" className="hidden lg:grid h-9 w-9 place-items-center rounded-full bg-ocean-800 hover:bg-ocean-700">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="flex items-center gap-2 text-lg font-bold">
          <ShieldCheck size={20} />
          Admin Dashboard
        </h1>
      </div>
    </header>
  )
}
