import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { TrendingUp, TrendingDown, BadgeCheck, ArrowRight, Bus } from 'lucide-react'
import { fetchFareUpdates, isCurrentUpdate, formatChange, formatDate, updateStatusLabel, updateStatusClasses } from '../lib/fareUpdates'
import { formatPeso } from '../lib/fares'
import type { FareUpdateWithDetails } from '../lib/types'

export function LatestFareUpdates() {
  const [updates, setUpdates] = useState<FareUpdateWithDetails[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      const all = await fetchFareUpdates()
      const current = all.filter(isCurrentUpdate).slice(0, 3)
      setUpdates(current)
      setLoading(false)
    })()
  }, [])

  if (loading) {
    return (
      <section>
        <h2 className="section-title mb-3">Latest Fare Updates</h2>
        <div className="card">
          <div className="flex items-center gap-3">
            <span className="h-3 w-3 animate-pulse rounded-full bg-ocean-400" />
            <p className="text-sm font-semibold text-ocean-700">Loading fare updates…</p>
          </div>
        </div>
      </section>
    )
  }

  if (updates.length === 0) {
    return (
      <section>
        <h2 className="section-title mb-3">Latest Fare Updates</h2>
        <div className="card flex items-center justify-between">
          <p className="text-sm font-semibold text-ocean-700">
            No verified fare updates available.
          </p>
          <Link to="/fare-updates" className="text-sm font-bold text-ocean-700 hover:text-ocean-800">
            View All
          </Link>
        </div>
      </section>
    )
  }

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="section-title">Latest Fare Updates</h2>
        <Link to="/fare-updates" className="text-sm font-bold text-ocean-700 hover:text-ocean-800">
          View All
        </Link>
      </div>
      <div className="space-y-3">
        {updates.map((u) => (
          <Link
            key={u.id}
            to={`/fare-update/${u.id}`}
            className="card block space-y-2 transition hover:shadow-cardHover active:scale-[0.99]"
          >
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-sm font-bold text-ocean-900">
                <Bus size={14} className="text-ocean-600" />
                {u.route?.route_name ?? 'Route'}
              </span>
              <span className={`pill text-[10px] ${updateStatusClasses(u.verification_status)}`}>
                {updateStatusLabel(u.verification_status)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-ocean-600">New verified fare</p>
                <p className="text-lg font-bold text-ocean-900">{formatPeso(u.new_amount)}</p>
              </div>
              {u.change_amount !== 0 && u.previous_amount != null && (
                <div className="flex items-center gap-1 text-sm font-bold">
                  {u.change_amount > 0 ? (
                    <TrendingUp size={16} className="text-terra-600" />
                  ) : (
                    <TrendingDown size={16} className="text-leaf-700" />
                  )}
                  <span className={u.change_amount > 0 ? 'text-terra-600' : 'text-leaf-700'}>
                    {formatChange(u.change_amount)}
                  </span>
                </div>
              )}
              {u.change_amount === 0 && (
                <BadgeCheck size={18} className="text-ocean-600" />
              )}
            </div>
            <p className="text-xs text-ocean-500">Effective {formatDate(u.effective_from)}</p>
          </Link>
        ))}
        <Link
          to="/fare-updates"
          className="flex items-center justify-center gap-1.5 text-sm font-bold text-ocean-700 hover:text-ocean-800"
        >
          View All Updates <ArrowRight size={16} />
        </Link>
      </div>
    </section>
  )
}
