import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Search as SearchIcon,
  Filter,
  User,
  GraduationCap,
  Heart,
  Accessibility,
  Baby,
  Users,
  Bus,
  Info,
  AlertCircle,
} from 'lucide-react'
import { getTransportModes } from '../lib/routes'
import { fetchPassengerCategories, fetchDiscountRequirements, isRequirementCurrent } from '../lib/discounts'
import { verificationClasses, VERIFICATION_LABELS } from '../lib/labels'
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

export function PassengerDiscountsPage() {
  const navigate = useNavigate()

  const [categories, setCategories] = useState<PassengerCategoryRow[]>([])
  const [requirements, setRequirements] = useState<PassengerDiscountRequirementWithDetails[]>([])
  const [transportModes, setTransportModes] = useState<TransportModeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const [search, setSearch] = useState('')
  const [transportFilter, setTransportFilter] = useState<string>('all')

  useEffect(() => {
    void (async () => {
      const [cats, modes] = await Promise.all([
        fetchPassengerCategories(),
        getTransportModes(),
      ])
      setCategories(cats)
      setTransportModes(modes)
      const reqs = await fetchDiscountRequirements()
      setRequirements(reqs)
      setLoading(false)
    })().catch(() => {
      setError(true)
      setLoading(false)
    })
  }, [])

  const filteredCategories = useMemo(() => {
    let list = categories
    const term = search.trim().toLowerCase()
    if (term) {
      list = list.filter((c) => {
        const name = c.name.toLowerCase()
        const desc = c.description?.toLowerCase() ?? ''
        return name.includes(term) || desc.includes(term)
      })
    }
    return list
  }, [categories, search])

  const filteredRequirements = useMemo(() => {
    let list = requirements.filter(isRequirementCurrent)
    if (transportFilter !== 'all') {
      list = list.filter((r) => r.transport_mode_id === transportFilter || r.transport_mode_id === null)
    }
    return list
  }, [requirements, transportFilter])

  function getReqsForCategory(catId: string): PassengerDiscountRequirementWithDetails[] {
    return filteredRequirements.filter((r) => r.passenger_category_id === catId)
  }

  return (
    <div className="app-shell">
      <header className="sticky top-0 z-30 bg-ocean-800 text-white shadow-card">
        <div className="flex items-center gap-3 px-4 py-4">
          <Link to="/" aria-label="Back to home" className="grid h-9 w-9 place-items-center rounded-full bg-ocean-700 hover:bg-ocean-600">
            <ArrowLeft size={18} />
          </Link>
          <h1 className="text-lg font-bold">Passenger Discounts</h1>
        </div>
      </header>

      <main className="flex-1 space-y-5 px-4 py-5">
        {/* Intro */}
        <section className="card">
          <p className="text-sm text-ocean-700">
            Check available passenger discounts and their requirements before travelling.
          </p>
        </section>

        {/* Search */}
        <section className="card">
          <div className="flex items-center gap-2 rounded-xl bg-ocean-50 px-3 py-2.5">
            <SearchIcon size={18} className="text-ocean-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search passenger categories"
              className="w-full bg-transparent text-sm text-ocean-900 placeholder:text-ocean-400 focus:outline-none"
            />
          </div>
        </section>

        {/* Transport filter */}
        <section className="card space-y-3">
          <h2 className="flex items-center gap-1.5 section-title">
            <Filter size={14} /> Filter by Transport
          </h2>
          <div className="flex flex-wrap gap-1.5">
            <FilterChip active={transportFilter === 'all'} onClick={() => setTransportFilter('all')} label="All" />
            {transportModes.map((m) => (
              <FilterChip key={m.id} active={transportFilter === m.id} onClick={() => setTransportFilter(m.id)} label={m.name} />
            ))}
          </div>
        </section>

        {/* Loading */}
        {loading && (
          <div className="card flex items-center gap-3">
            <span className="h-3 w-3 animate-pulse rounded-full bg-ocean-400" />
            <p className="text-sm font-semibold text-ocean-700">Loading discount information…</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="card flex flex-col items-center gap-2 text-center">
            <AlertCircle size={24} className="text-red-600" />
            <p className="text-sm font-semibold text-red-700">Discount information is temporarily unavailable. Please try again.</p>
            <button type="button" onClick={() => window.location.reload()} className="btn-primary mt-2">Retry</button>
          </div>
        )}

        {/* Category cards */}
        {!loading && !error && filteredCategories.length === 0 && (
          <div className="card flex flex-col items-center gap-3 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-sand-200 text-ocean-700">
              <Info size={24} />
            </span>
            <p className="text-base font-bold text-ocean-900">Discount information not yet available.</p>
          </div>
        )}

        {!loading && !error && filteredCategories.length > 0 && (
          <section className="space-y-3">
            <h2 className="section-title">Passenger Categories</h2>
            {filteredCategories.map((cat) => {
              const Icon = ICONS[cat.code] ?? User
              const reqs = getReqsForCategory(cat.id)
              return (
                <div
                  key={cat.id}
                  className="card space-y-3 transition hover:shadow-cardHover active:scale-[0.99] cursor-pointer"
                  onClick={() => navigate(`/discounts/${cat.id}`)}
                >
                  <div className="flex items-start gap-3">
                    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-leaf-400/20 text-leaf-700">
                      <Icon size={24} />
                    </span>
                    <div className="flex-1">
                      <p className="font-bold text-ocean-900">{cat.name}</p>
                      {cat.description && <p className="text-sm text-ocean-700">{cat.description}</p>}
                    </div>
                  </div>

                  {reqs.length > 0 ? (
                    <div className="space-y-2">
                      {reqs.slice(0, 2).map((r) => (
                        <div key={r.id} className="rounded-xl bg-ocean-50 px-3 py-2">
                          <div className="flex items-center gap-2">
                            {r.transport_mode && (
                              <span className="pill bg-ocean-100 text-ocean-800 text-[10px]">
                                <Bus size={10} /> {r.transport_mode.name}
                              </span>
                            )}
                            <span className={`pill text-[10px] ${verificationClasses(r.verification_status)}`}>
                              {VERIFICATION_LABELS[r.verification_status]}
                            </span>
                          </div>
                          <p className="mt-1 text-sm font-semibold text-ocean-900">{r.requirement_title}</p>
                          {r.requirement_description && (
                            <p className="text-xs text-ocean-600">{r.requirement_description}</p>
                          )}
                        </div>
                      ))}
                      {reqs.length > 2 && (
                        <p className="text-xs font-semibold text-ocean-600">+{reqs.length - 2} more</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-ocean-500">
                      Discount information for this service is not yet verified.
                    </p>
                  )}

                  <button type="button" className="btn-secondary w-full" onClick={(e) => { e.stopPropagation(); navigate(`/discounts/${cat.id}`) }}>
                    View Details
                  </button>
                </div>
              )
            })}
          </section>
        )}
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
