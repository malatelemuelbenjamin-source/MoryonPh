import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Search as SearchIcon,
  Filter,
  PlusCircle,
  Receipt,
  Clock,
  Eye,
  HelpCircle,
  CheckCircle2,
  Lock,
  ShieldAlert,
  Bus,
  MapPin,
} from 'lucide-react'
import { useAuth } from '../lib/auth'
import {
  fetchMyFareConcerns,
  isCommunityReviewer,
  fetchTransportModes,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  statusLabel,
  statusClasses,
  categoryLabel,
  statusLabel as fcStatusLabel,
} from '../lib/fareConcerns'
import { formatRelativeTime } from '../lib/labels'
import type {
  FareConcernWithDetails,
  FareConcernStatus,
  TransportModeRow,
} from '../lib/types'

const STATUS_SUMMARY: { status: FareConcernStatus; icon: typeof Receipt }[] = [
  { status: 'submitted', icon: Receipt },
  { status: 'under_review', icon: Eye },
  { status: 'needs_more_info', icon: HelpCircle },
  { status: 'resolved', icon: CheckCircle2 },
]

export function FareConcernsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [reports, setReports] = useState<FareConcernWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [reviewer, setReviewer] = useState(false)
  const [transportModes, setTransportModes] = useState<TransportModeRow[]>([])

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [transportFilter, setTransportFilter] = useState<string>('all')

  useEffect(() => {
    void (async () => {
      const [isReviewer, modes, myReports] = await Promise.all([
        isCommunityReviewer(),
        fetchTransportModes(),
        fetchMyFareConcerns(),
      ])
      setReviewer(isReviewer)
      setTransportModes(modes)
      setReports(myReports)
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
          r.report_reference.toLowerCase().includes(term) ||
          r.description.toLowerCase().includes(term),
      )
    }
    if (statusFilter !== 'all') list = list.filter((r) => r.status === statusFilter)
    if (categoryFilter !== 'all') list = list.filter((r) => r.category === categoryFilter)
    if (transportFilter !== 'all') list = list.filter((r) => r.transport_mode_id === transportFilter)
    return list
  }, [reports, search, statusFilter, categoryFilter, transportFilter])

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    reports.forEach((r) => {
      counts[r.status] = (counts[r.status] ?? 0) + 1
    })
    return counts
  }, [reports])

  return (
    <div className="app-shell">
      <header className="sticky top-0 z-30 bg-ocean-800 text-white shadow-card">
        <div className="flex items-center gap-3 px-4 py-4">
          <Link to="/" aria-label="Back to home" className="grid h-9 w-9 place-items-center rounded-full bg-ocean-700 hover:bg-ocean-600">
            <ArrowLeft size={18} />
          </Link>
          <h1 className="text-lg font-bold">Fare Concerns</h1>
        </div>
      </header>

      <main className="flex-1 space-y-5 px-4 py-5">
        {/* Intro */}
        <section className="card space-y-3">
          <div className="flex items-center gap-2">
            <Receipt size={20} className="text-ocean-700" />
            <h2 className="text-base font-bold text-ocean-900">Fare Concerns &amp; Reports</h2>
          </div>
          <p className="text-sm text-ocean-700">
            Report suspected overcharging, incorrect fares, discount concerns, or other
            fare-related issues. Each concern is reviewed by authorized personnel before
            any action is taken. Your report is an allegation, not a confirmed violation.
          </p>
          <div className="flex items-start gap-2 rounded-xl bg-sand-100 px-3 py-2.5">
            <ShieldAlert size={16} className="mt-0.5 shrink-0 text-terra-600" />
            <p className="text-xs text-terra-800">
              Fare concerns are private. Reporter identities and allegations are not
              published. This is not an emergency service.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/fare-concerns/new')}
            className="btn-primary w-full"
          >
            <PlusCircle size={18} /> Submit a Fare Concern
          </button>
        </section>

        {/* Not signed in */}
        {!user && (
          <div className="card flex flex-col items-center gap-3 text-center">
            <p className="text-sm font-semibold text-ocean-900">Sign in to submit and track fare concerns</p>
            <Link to="/auth" className="btn-secondary w-full">Sign In / Create Account</Link>
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
                placeholder="Search by title or reference number"
                className="w-full bg-transparent text-sm text-ocean-900 placeholder:text-ocean-400 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-1.5 text-xs font-semibold text-ocean-600">
              <Filter size={14} /> Filters
            </div>

            <div className="flex flex-wrap gap-1.5">
              <Chip active={statusFilter === 'all'} onClick={() => setStatusFilter('all')} label="All Status" />
              {(['submitted','under_review','needs_more_info','resolved','rejected','closed'] as FareConcernStatus[]).map((s) => (
                <Chip key={s} active={statusFilter === s} onClick={() => setStatusFilter(s)} label={statusLabel(s)} />
              ))}
            </div>

            <div className="flex flex-wrap gap-1.5">
              <Chip active={categoryFilter === 'all'} onClick={() => setCategoryFilter('all')} label="All Categories" />
              {CATEGORY_ORDER.map((c) => (
                <Chip key={c} active={categoryFilter === c} onClick={() => setCategoryFilter(c)} label={CATEGORY_LABELS[c]} />
              ))}
            </div>

            <div className="flex flex-wrap gap-1.5">
              <Chip active={transportFilter === 'all'} onClick={() => setTransportFilter('all')} label="All Transport" />
              {transportModes.map((m) => (
                <Chip key={m.id} active={transportFilter === m.id} onClick={() => setTransportFilter(m.id)} label={m.name} />
              ))}
            </div>
          </section>
        )}

        {/* My fare reports */}
        {user && (
          <section className="space-y-3">
            <h2 className="section-title">My Fare Reports</h2>
            {loading && (
              <div className="card flex items-center gap-3">
                <span className="h-3 w-3 animate-pulse rounded-full bg-ocean-400" />
                <p className="text-sm font-semibold text-ocean-700">Loading your fare reports…</p>
              </div>
            )}
            {!loading && filtered.length === 0 && (
              <div className="card flex flex-col items-center gap-3 text-center">
                <span className="grid h-12 w-12 place-items-center rounded-full bg-sand-200 text-ocean-700">
                  <Receipt size={24} />
                </span>
                <p className="text-base font-bold text-ocean-900">
                  {reports.length === 0 ? 'No fare concerns yet' : 'No reports match your filters'}
                </p>
                <p className="text-sm text-ocean-700">
                  {reports.length === 0
                    ? 'Submit a fare concern to report an issue with fares or discounts.'
                    : 'Try adjusting your search or filters.'}
                </p>
              </div>
            )}
            {!loading && filtered.map((r) => (
              <FareReportCard key={r.id} report={r} onClick={() => navigate(`/fare-concerns/${r.id}`)} />
            ))}
          </section>
        )}

        {/* Admin link */}
        {user && reviewer && (
          <Link to="/fare-concerns/admin" className="card flex items-center gap-3 hover:shadow-cardHover">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-terra-100 text-terra-700">
              <ShieldAlert size={18} />
            </span>
            <div>
              <p className="text-sm font-semibold text-ocean-900">Fare Review Dashboard</p>
              <p className="text-xs text-ocean-600">Review and manage fare concern reports</p>
            </div>
          </Link>
        )}

        {/* Privacy notice */}
        <section className="card flex items-start gap-2">
          <Lock size={16} className="mt-0.5 shrink-0 text-ocean-500" />
          <p className="text-xs text-ocean-600">
            Fare concerns are private. Report details, evidence, and reporter identity
            are visible only to you and authorized reviewers. Allegations are not
            published or treated as proven violations.
          </p>
        </section>
      </main>
    </div>
  )
}

function FareReportCard({ report, onClick }: { report: FareConcernWithDetails; onClick: () => void }) {
  return (
    <div className="card space-y-2 cursor-pointer active:scale-[0.98] transition" onClick={onClick} role="button">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs font-semibold text-ocean-500">{report.report_reference}</span>
        <span className={`pill ${statusClasses(report.status)}`}>{fcStatusLabel(report.status)}</span>
      </div>
      <p className="font-bold text-ocean-900">{report.title}</p>
      <div className="flex flex-wrap gap-2">
        <span className="pill bg-sand-200 text-ocean-800">{categoryLabel(report.category)}</span>
        {report.transport_mode && (
          <span className="pill bg-ocean-100 text-ocean-800"><Bus size={10} /> {report.transport_mode.name}</span>
        )}
      </div>
      <div className="flex flex-wrap gap-3 text-xs text-ocean-600">
        <span className="flex items-center gap-1"><MapPin size={12} /> {report.municipality}</span>
        <span className="flex items-center gap-1"><Clock size={12} /> {formatRelativeTime(report.created_at)}</span>
      </div>
      {(report.amount_charged != null || report.expected_fare_amount != null) && (
        <div className="flex gap-3 text-xs text-ocean-700">
          {report.amount_charged != null && <span>Charged: ₱{report.amount_charged}</span>}
          {report.expected_fare_amount != null && <span>Expected: ₱{report.expected_fare_amount}</span>}
        </div>
      )}
    </div>
  )
}

function Chip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
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
