import { useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  User,
  GraduationCap,
  Heart,
  Accessibility,
  Baby,
  Users,
  Bus,
  ShieldCheck,
  Clock,
  AlertCircle,
  Wallet,
  FileText,
} from 'lucide-react'
import {
  fetchPassengerCategory,
  fetchDiscountRequirements,
  isRequirementCurrent,
  formatDate,
} from '../lib/discounts'
import { getTransportModes } from '../lib/routes'
import { verificationClasses, VERIFICATION_LABELS, formatRelativeTime } from '../lib/labels'
import type {
  PassengerCategoryRow,
  PassengerDiscountRequirementWithDetails,
  TransportModeRow,
} from '../lib/types'

const ICONS: Record<string, typeof User> = {
  regular: User,
  student: GraduationCap,
  senior: Heart,
  pwd: Accessibility,
  child: Baby,
  other: Users,
}

export function PassengerCategoryDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [category, setCategory] = useState<PassengerCategoryRow | null>(null)
  const [requirements, setRequirements] = useState<PassengerDiscountRequirementWithDetails[]>([])
  const [transportModes, setTransportModes] = useState<TransportModeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [transportFilter, setTransportFilter] = useState<string>('all')

  useEffect(() => {
    if (!id) return
    void (async () => {
      const [cat, modes] = await Promise.all([
        fetchPassengerCategory(id),
        getTransportModes(),
      ])
      setCategory(cat)
      setTransportModes(modes)
      if (cat) {
        const reqs = await fetchDiscountRequirements(cat.id)
        setRequirements(reqs)
      }
      setLoading(false)
    })()
  }, [id])

  const filteredReqs = requirements
    .filter(isRequirementCurrent)
    .filter((r) => transportFilter === 'all' || r.transport_mode_id === transportFilter || r.transport_mode_id === null)

  if (loading) {
    return (
      <div className="app-shell">
        <DetailHeader />
        <main className="flex-1 px-4 py-5">
          <div className="card flex items-center gap-3">
            <span className="h-3 w-3 animate-pulse rounded-full bg-ocean-400" />
            <p className="text-sm font-semibold text-ocean-700">Loading discount information…</p>
          </div>
        </main>
      </div>
    )
  }

  if (!category) {
    return (
      <div className="app-shell">
        <DetailHeader />
        <main className="flex-1 px-4 py-5">
          <div className="card flex flex-col items-center gap-3 text-center">
            <AlertCircle size={28} className="text-ocean-600" />
            <p className="text-base font-bold text-ocean-900">Category not found.</p>
            <Link to="/discounts" className="btn-primary mt-2">Back to Discounts</Link>
          </div>
        </main>
      </div>
    )
  }

  const Icon = ICONS[category.code] ?? User

  return (
    <div className="app-shell">
      <DetailHeader />
      <main className="flex-1 space-y-5 px-4 py-5">
        {/* Header */}
        <section className="card flex items-start gap-3">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-leaf-400/20 text-leaf-700">
            <Icon size={28} />
          </span>
          <div>
            <p className="text-lg font-bold text-ocean-900">{category.name}</p>
            {category.description && <p className="text-sm text-ocean-700">{category.description}</p>}
          </div>
        </section>

        {/* Transport filter */}
        <section className="card space-y-3">
          <h2 className="section-title">Filter by Transport</h2>
          <div className="flex flex-wrap gap-1.5">
            <FilterChip active={transportFilter === 'all'} onClick={() => setTransportFilter('all')} label="All" />
            {transportModes.map((m) => (
              <FilterChip key={m.id} active={transportFilter === m.id} onClick={() => setTransportFilter(m.id)} label={m.name} />
            ))}
          </div>
        </section>

        {/* Requirements */}
        <section className="space-y-3">
          <h2 className="section-title">Eligibility & Requirements</h2>
          {filteredReqs.length === 0 ? (
            <div className="card">
              <p className="text-sm text-ocean-700">
                Discount information for this service is not yet verified.
              </p>
            </div>
          ) : (
            filteredReqs.map((r) => (
              <div key={r.id} className="card space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  {r.transport_mode && (
                    <span className="pill bg-ocean-100 text-ocean-800">
                      <Bus size={12} /> {r.transport_mode.name}
                    </span>
                  )}
                  <span className={`pill ${verificationClasses(r.verification_status)}`}>
                    {VERIFICATION_LABELS[r.verification_status]}
                  </span>
                  {r.route && (
                    <span className="pill bg-sand-200 text-ocean-700">{r.route.route_name}</span>
                  )}
                </div>

                <p className="font-bold text-ocean-900">{r.requirement_title}</p>
                {r.requirement_description && (
                  <p className="text-sm text-ocean-700">{r.requirement_description}</p>
                )}

                {r.required_document && (
                  <div className="flex items-center gap-2 rounded-xl bg-sand-100 px-3 py-2">
                    <FileText size={16} className="text-ocean-600" />
                    <p className="text-sm text-ocean-800">
                      <span className="font-semibold">Required:</span> {r.required_document}
                    </p>
                  </div>
                )}

                <div className="flex flex-wrap gap-3 text-xs text-ocean-600">
                  {r.effective_from && (
                    <span className="flex items-center gap-1">
                      <Clock size={12} /> Effective {formatDate(r.effective_from)}
                    </span>
                  )}
                  {r.effective_until && (
                    <span>Until {formatDate(r.effective_until)}</span>
                  )}
                  {r.last_verified_at && (
                    <span className="flex items-center gap-1">
                      <ShieldCheck size={12} /> Verified {formatRelativeTime(r.last_verified_at)}
                    </span>
                  )}
                  {r.source && <span>Source: {r.source}</span>}
                </div>

                {r.verification_status === 'community' && (
                  <p className="rounded-lg bg-sand-100 px-3 py-2 text-xs text-ocean-700">
                    This information is community-submitted and has not been verified as official.
                  </p>
                )}
              </div>
            ))
          )}
        </section>

        {/* Action */}
        <section className="card space-y-3">
          <p className="text-sm text-ocean-700">
            Use the Fare Calculator to check your fare with this passenger category.
          </p>
          <button
            type="button"
            onClick={() => navigate('/fare')}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            <Wallet size={18} /> Check Fare
          </button>
          <Link
            to={`/fare-concerns/new?passenger_category=${category.code}`}
            className="btn-secondary w-full flex items-center justify-center gap-2"
          >
            Report a Fare Concern
          </Link>
        </section>
      </main>
    </div>
  )
}

function DetailHeader() {
  return (
    <header className="sticky top-0 z-30 bg-ocean-800 text-white shadow-card">
      <div className="flex items-center gap-3 px-4 py-4">
        <Link to="/discounts" className="grid h-9 w-9 place-items-center rounded-full bg-ocean-700 hover:bg-ocean-600">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-lg font-bold">Passenger Discounts</h1>
      </div>
    </header>
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
