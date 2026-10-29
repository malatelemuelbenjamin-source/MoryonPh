import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Search as SearchIcon,
  Filter,
  PlusCircle,
  Flag,
  Clock,
  Eye,
  HelpCircle,
  CheckCircle2,
  MapPin,
  AlertTriangle,
  ShieldAlert,
  FileText,
} from 'lucide-react'
import { useAuth } from '../lib/auth'
import {
  fetchMyReports,
  fetchPublicReports,
  fetchTransportModes,
  isCommunityReviewer,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  statusLabel,
  statusClasses,
  categoryLabel,
} from '../lib/communityReports'
import type {
  CommunityReportWithDetails,
  CommunityReportStatus,
  TransportModeRow,
} from '../lib/types'
import { formatRelativeTime } from '../lib/labels'

const STATUS_SUMMARY: { status: CommunityReportStatus; icon: typeof Flag }[] = [
  { status: 'submitted', icon: FileText },
  { status: 'under_review', icon: Eye },
  { status: 'needs_more_info', icon: HelpCircle },
  { status: 'resolved', icon: CheckCircle2 },
]

export function CommunityReportsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [reports, setReports] = useState<CommunityReportWithDetails[]>([])
  const [publicReports, setPublicReports] = useState<CommunityReportWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [reviewer, setReviewer] = useState(false)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [transportFilter, setTransportFilter] = useState<string>('all')

  const [transportModes, setTransportModes] = useState<TransportModeRow[]>([])

  useEffect(() => {
    void (async () => {
      const [isReviewer, modes, myReports, pubReports] = await Promise.all([
        isCommunityReviewer(),
        fetchTransportModes(),
        fetchMyReports(),
        fetchPublicReports(10),
      ])
      setReviewer(isReviewer)
      setTransportModes(modes)
      setReports(myReports)
      setPublicReports(pubReports)
      setLoading(false)
    })()
  }, [])

  const filtered = useMemo(() => {
    let list = reports
    const term = search.trim().toLowerCase()
    if (term) {
      list = list.filter(
        (r) =>
          r.title.toLowerCase().includes(term) ||
          r.description.toLowerCase().includes(term) ||
          r.municipality.toLowerCase().includes(term),
      )
    }
    if (statusFilter !== 'all') list = list.filter((r) => r.status === statusFilter)
    if (categoryFilter !== 'all') list = list.filter((r) => r.category === categoryFilter)
    if (transportFilter !== 'all') list = list.filter((r) => r.transport_mode_id === transportFilter)
    return list
  }, [reports, search, statusFilter, categoryFilter, transportFilter])

  const statusCounts = useMemo(() => {
    const counts: Record<CommunityReportStatus, number> = {
      submitted: 0,
      under_review: 0,
      needs_more_info: 0,
      resolved: 0,
      rejected: 0,
    }
    reports.forEach((r) => {
      counts[r.status] = (counts[r.status] ?? 0) + 1
    })
    return counts
  }, [reports])

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
          <h1 className="text-lg font-bold">Community Reports</h1>
        </div>
      </header>

      <main className="flex-1 space-y-5 px-4 py-5">
        {/* Intro */}
        <section className="card space-y-3">
          <div className="flex items-center gap-2">
            <Flag size={20} className="text-ocean-700" />
            <h2 className="text-base font-bold text-ocean-900">Community Transport Reports</h2>
          </div>
          <p className="text-sm text-ocean-700">
            Help improve Marinduque transport information. Report missing routes, incorrect details,
            service issues, and more. Every report is reviewed before any official data is changed.
          </p>
          <div className="flex items-start gap-2 rounded-xl bg-sand-100 px-3 py-2.5">
            <ShieldAlert size={16} className="mt-0.5 shrink-0 text-terra-600" />
            <p className="text-xs text-terra-800">
              This is not an emergency service. For immediate threats or emergencies, contact local
              authorities directly.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/community-reports/new')}
            className="btn-primary w-full"
          >
            <PlusCircle size={18} /> Submit a Report
          </button>
        </section>

        {/* Not signed in notice */}
        {!user && (
          <div className="card flex flex-col items-center gap-3 text-center">
            <p className="text-sm font-semibold text-ocean-900">Sign in to submit and track reports</p>
            <p className="text-xs text-ocean-700">
              You need an account to submit reports and view their status.
            </p>
            <Link to="/auth" className="btn-secondary w-full">
              Sign In / Create Account
            </Link>
          </div>
        )}

        {/* Status summary */}
        {user && (
          <section className="space-y-3">
            <h2 className="section-title">Report Status Summary</h2>
            <div className="grid grid-cols-2 gap-2">
              {STATUS_SUMMARY.map(({ status, icon: Icon }) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setStatusFilter(statusFilter === status ? 'all' : status)}
                  className={`card flex items-center gap-3 transition active:scale-95 ${
                    statusFilter === status ? 'ring-2 ring-ocean-500' : ''
                  }`}
                >
                  <span className={`grid h-10 w-10 place-items-center rounded-full ${statusClasses(status)}`}>
                    <Icon size={18} />
                  </span>
                  <div className="text-left">
                    <p className="text-2xl font-bold text-ocean-900">{statusCounts[status] ?? 0}</p>
                    <p className="text-xs text-ocean-600">{statusLabel(status)}</p>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Search and filters */}
        {user && reports.length > 0 && (
          <section className="card space-y-3">
            <div className="flex items-center gap-2 rounded-xl bg-ocean-50 px-3 py-2.5">
              <SearchIcon size={18} className="text-ocean-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search your reports"
                className="w-full bg-transparent text-sm text-ocean-900 placeholder:text-ocean-400 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-1.5 text-xs font-semibold text-ocean-600">
              <Filter size={14} /> Filters
            </div>

            {/* Status filter */}
            <div className="flex flex-wrap gap-1.5">
              <FilterChip active={statusFilter === 'all'} onClick={() => setStatusFilter('all')} label="All Status" />
              {(['submitted', 'under_review', 'needs_more_info', 'resolved', 'rejected'] as CommunityReportStatus[]).map(
                (s) => (
                  <FilterChip
                    key={s}
                    active={statusFilter === s}
                    onClick={() => setStatusFilter(s)}
                    label={statusLabel(s)}
                  />
                ),
              )}
            </div>

            {/* Category filter */}
            <div className="flex flex-wrap gap-1.5">
              <FilterChip active={categoryFilter === 'all'} onClick={() => setCategoryFilter('all')} label="All Categories" />
              {CATEGORY_ORDER.map((c) => (
                <FilterChip
                  key={c}
                  active={categoryFilter === c}
                  onClick={() => setCategoryFilter(c)}
                  label={CATEGORY_LABELS[c]}
                />
              ))}
            </div>

            {/* Transport filter */}
            <div className="flex flex-wrap gap-1.5">
              <FilterChip active={transportFilter === 'all'} onClick={() => setTransportFilter('all')} label="All Transport" />
              {transportModes.map((m) => (
                <FilterChip
                  key={m.id}
                  active={transportFilter === m.id}
                  onClick={() => setTransportFilter(m.id)}
                  label={m.name}
                />
              ))}
            </div>
          </section>
        )}

        {/* My reports */}
        {user && (
          <section className="space-y-3">
            <h2 className="section-title">My Reports</h2>
            {loading && (
              <div className="card flex items-center gap-3">
                <span className="h-3 w-3 animate-pulse rounded-full bg-ocean-400" />
                <p className="text-sm font-semibold text-ocean-700">Loading your reports…</p>
              </div>
            )}
            {!loading && filtered.length === 0 && (
              <div className="card flex flex-col items-center gap-3 text-center">
                <span className="grid h-12 w-12 place-items-center rounded-full bg-sand-200 text-ocean-700">
                  <Flag size={24} />
                </span>
                <p className="text-base font-bold text-ocean-900">
                  {reports.length === 0 ? 'No reports yet' : 'No reports match your filters'}
                </p>
                <p className="text-sm text-ocean-700">
                  {reports.length === 0
                    ? 'Submit a report to help improve transport information.'
                    : 'Try adjusting your search or filters.'}
                </p>
              </div>
            )}
            {!loading &&
              filtered.map((r) => (
                <ReportCard key={r.id} report={r} onClick={() => navigate(`/community-reports/${r.id}`)} />
              ))}
          </section>
        )}

        {/* Admin link */}
        {user && reviewer && (
          <Link to="/community-reports/admin" className="card flex items-center gap-3 hover:shadow-cardHover">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-terra-100 text-terra-700">
              <ShieldAlert size={18} />
            </span>
            <div>
              <p className="text-sm font-semibold text-ocean-900">Review Dashboard</p>
              <p className="text-xs text-ocean-600">Review and manage community reports</p>
            </div>
          </Link>
        )}

        {/* Public resolved feed */}
        <section className="space-y-3">
          <h2 className="section-title">Recently Resolved</h2>
          {publicReports.length === 0 && !loading && (
            <div className="card text-center">
              <p className="text-sm text-ocean-700">No resolved reports to show yet.</p>
            </div>
          )}
          {publicReports.map((r) => (
            <div key={r.id} className="card space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`pill ${statusClasses(r.status)}`}>{statusLabel(r.status)}</span>
                <span className="pill bg-sand-200 text-ocean-800">{categoryLabel(r.category)}</span>
              </div>
              <p className="font-bold text-ocean-900">{r.title}</p>
              <p className="flex items-center gap-1 text-xs text-ocean-600">
                <MapPin size={12} /> {r.municipality}
              </p>
              {r.resolution_summary && (
                <p className="rounded-xl bg-leaf-50 px-3 py-2 text-sm text-leaf-800">
                  {r.resolution_summary}
                </p>
              )}
              <button
                type="button"
                onClick={() => navigate(`/community-reports/${r.id}`)}
                className="btn-secondary w-full"
              >
                View Details
              </button>
            </div>
          ))}
        </section>
      </main>
    </div>
  )
}

function FilterChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition active:scale-95 ${
        active ? 'bg-ocean-700 text-white' : 'bg-ocean-50 text-ocean-700 hover:bg-ocean-100'
      }`}
    >
      {label}
    </button>
  )
}

function ReportCard({ report, onClick }: { report: CommunityReportWithDetails; onClick: () => void }) {
  return (
    <div className="card space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`pill ${statusClasses(report.status)}`}>{statusLabel(report.status)}</span>
        <span className="pill bg-sand-200 text-ocean-800">{categoryLabel(report.category)}</span>
      </div>
      <p className="font-bold text-ocean-900">{report.title}</p>
      <p className="flex items-center gap-1 text-xs text-ocean-600">
        <MapPin size={12} /> {report.municipality}
        {report.transport_mode && <span> · {report.transport_mode.name}</span>}
      </p>
      <div className="flex flex-wrap gap-3 text-xs text-ocean-600">
        <span className="flex items-center gap-1">
          <Clock size={12} /> {formatRelativeTime(report.created_at)}
        </span>
        {report.status === 'needs_more_info' && (
          <span className="flex items-center gap-1 font-semibold text-terra-600">
            <AlertTriangle size={12} /> Action needed
          </span>
        )}
      </div>
      <button type="button" onClick={onClick} className="btn-secondary w-full">
        View Details
      </button>
    </div>
  )
}
