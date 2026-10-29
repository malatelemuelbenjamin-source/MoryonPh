import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Bell,
  BellOff,
  TrendingUp,
  TrendingDown,
  BadgeCheck,
  Bus,
  AlertCircle,
  History,
  ShieldCheck,
} from 'lucide-react'
import { useAuth } from '../lib/auth'
import { fetchFareUpdate, fetchFareUpdateAuditLogs, fetchFareHistory, fetchUserSubscription, toggleSubscription, updateStatusLabel, updateStatusClasses, updateTypeLabel, formatChange, formatDate } from '../lib/fareUpdates'
import { formatPeso, isFareCurrent } from '../lib/fares'
import { verificationClasses, VERIFICATION_LABELS } from '../lib/labels'
import type { FareAuditLogRow, FareUpdateWithDetails, FareWithDetails } from '../lib/types'

export function FareUpdateDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()

  const [update, setUpdate] = useState<FareUpdateWithDetails | null>(null)
  const [auditLogs, setAuditLogs] = useState<FareAuditLogRow[]>([])
  const [history, setHistory] = useState<FareWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [subscribed, setSubscribed] = useState(false)
  const [subLoading, setSubLoading] = useState(false)
  const [subMsg, setSubMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    void (async () => {
      const [u, logs] = await Promise.all([
        fetchFareUpdate(id),
        fetchFareUpdateAuditLogs(id),
      ])
      setUpdate(u)
      setAuditLogs(logs)
      if (u?.route_id) {
        const hist = await fetchFareHistory(u.route_id)
        setHistory(hist)
      }
      if (user && u?.route_id) {
        const sub = await fetchUserSubscription(user.id, u.route_id)
        setSubscribed(sub?.is_enabled ?? false)
      }
      setLoading(false)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user?.id])

  async function handleToggle() {
    if (!user || !update?.route_id) return
    setSubLoading(true)
    const next = !subscribed
    const ok = await toggleSubscription(user.id, update.route_id, next)
    if (ok) {
      setSubscribed(next)
      setSubMsg(null)
    } else {
      setSubMsg('Could not update your notification preference. Please try again.')
    }
    setSubLoading(false)
  }

  if (loading) {
    return (
      <div className="app-shell">
        <header className="sticky top-0 z-30 bg-ocean-800 text-white shadow-card">
          <div className="flex items-center gap-3 px-4 py-4">
            <Link to="/fare-updates" className="grid h-9 w-9 place-items-center rounded-full bg-ocean-700 hover:bg-ocean-600">
              <ArrowLeft size={18} />
            </Link>
            <h1 className="text-lg font-bold">Fare Update</h1>
          </div>
        </header>
        <main className="flex-1 px-4 py-5">
          <div className="card flex items-center gap-3">
            <span className="h-3 w-3 animate-pulse rounded-full bg-ocean-400" />
            <p className="text-sm font-semibold text-ocean-700">Loading fare update…</p>
          </div>
        </main>
      </div>
    )
  }

  if (!update) {
    return (
      <div className="app-shell">
        <header className="sticky top-0 z-30 bg-ocean-800 text-white shadow-card">
          <div className="flex items-center gap-3 px-4 py-4">
            <Link to="/fare-updates" className="grid h-9 w-9 place-items-center rounded-full bg-ocean-700 hover:bg-ocean-600">
              <ArrowLeft size={18} />
            </Link>
            <h1 className="text-lg font-bold">Fare Update</h1>
          </div>
        </header>
        <main className="flex-1 px-4 py-5">
          <div className="card flex flex-col items-center gap-3 text-center">
            <AlertCircle size={28} className="text-ocean-600" />
            <p className="text-base font-bold text-ocean-900">Fare update not found.</p>
            <Link to="/fare-updates" className="btn-primary mt-2">Back to Fare Updates</Link>
          </div>
        </main>
      </div>
    )
  }

  const routeName = update.route?.route_name ?? 'Route'
  const modeName = update.route?.transport_mode?.name ?? 'Transport'

  return (
    <div className="app-shell">
      <header className="sticky top-0 z-30 bg-ocean-800 text-white shadow-card">
        <div className="flex items-center gap-3 px-4 py-4">
          <Link to="/fare-updates" className="grid h-9 w-9 place-items-center rounded-full bg-ocean-700 hover:bg-ocean-600">
            <ArrowLeft size={18} />
          </Link>
          <h1 className="text-lg font-bold">Fare Update</h1>
        </div>
      </header>

      <main className="flex-1 space-y-5 px-4 py-5">
        {/* Header card */}
        <section className="card space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="pill bg-ocean-100 text-ocean-800">
              <Bus size={12} /> {modeName}
            </span>
            <span className={`pill ${updateStatusClasses(update.verification_status)}`}>
              {updateStatusLabel(update.verification_status)}
            </span>
          </div>
          <p className="text-lg font-bold text-ocean-900">{routeName}</p>
          {update.announcement_title && (
            <p className="text-sm font-semibold text-ocean-800">{update.announcement_title}</p>
          )}
          {update.announcement_description && (
            <p className="text-sm text-ocean-700">{update.announcement_description}</p>
          )}
        </section>

        {/* Fare comparison */}
        <section className="card space-y-4">
          <h2 className="section-title">Fare Comparison</h2>
          <div className="flex items-center justify-between rounded-xl bg-sand-100 px-4 py-4">
            {update.previous_amount != null ? (
              <>
                <div className="text-center">
                  <p className="text-xs text-ocean-600">Previous fare</p>
                  <p className="text-xl font-bold text-ocean-700">{formatPeso(update.previous_amount)}</p>
                </div>
                {update.change_amount > 0 ? (
                  <TrendingUp size={24} className="text-terra-600" />
                ) : update.change_amount < 0 ? (
                  <TrendingDown size={24} className="text-leaf-700" />
                ) : (
                  <BadgeCheck size={24} className="text-ocean-600" />
                )}
                <div className="text-center">
                  <p className="text-xs text-ocean-600">New fare</p>
                  <p className="text-xl font-bold text-ocean-900">{formatPeso(update.new_amount)}</p>
                </div>
              </>
            ) : (
              <div className="text-center w-full">
                <p className="text-xs text-ocean-600">New fare</p>
                <p className="text-2xl font-bold text-ocean-900">{formatPeso(update.new_amount)}</p>
              </div>
            )}
          </div>

          {update.previous_amount != null && update.change_amount !== 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-ocean-600">{updateTypeLabel(update.update_type)}</span>
              <span className={`font-bold ${update.change_amount > 0 ? 'text-terra-600' : 'text-leaf-700'}`}>
                {formatChange(update.change_amount)}
                {update.change_percentage != null && ` (${update.change_percentage > 0 ? '+' : ''}${update.change_percentage}%)`}
              </span>
            </div>
          )}
          {update.previous_amount === 0 && (
            <p className="text-xs text-ocean-500">Percentage change unavailable.</p>
          )}
        </section>

        {/* Details */}
        <section className="card space-y-2">
          <h2 className="section-title">Details</h2>
          <DetailRow label="Transport" value={modeName} />
          <DetailRow label="Route" value={routeName} />
          {update.route?.origin_location?.name && update.route?.destination_location?.name && (
            <DetailRow label="From → To" value={`${update.route.origin_location.name} → ${update.route.destination_location.name}`} />
          )}
          <DetailRow label="Effective" value={formatDate(update.effective_from)} />
          <DetailRow label="Status" value={updateStatusLabel(update.verification_status)} />
          <DetailRow label="Source" value={update.source ?? 'Source unavailable'} />
          {update.source_reference && <DetailRow label="Reference" value={update.source_reference} />}
          {update.verified_at && <DetailRow label="Last verified" value={formatDate(update.verified_at)} />}
        </section>

        {/* Timeline */}
        {auditLogs.length > 0 && (
          <section className="card">
            <h2 className="mb-3 section-title">Update Timeline</h2>
            <ol className="relative">
              {auditLogs.map((log, i) => (
                <li key={log.id} className="relative flex gap-3 pb-4 last:pb-0">
                  {i < auditLogs.length - 1 && (
                    <span className="absolute left-[14px] top-7 h-full w-0.5 bg-ocean-100" aria-hidden="true" />
                  )}
                  <span className="relative z-10 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-ocean-700 text-white">
                    <ShieldCheck size={14} />
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-ocean-900">
                      {log.action === 'verified' ? 'Fare verified' : log.action === 'created' ? 'Update created' : log.action === 'reviewed' ? 'Under review' : log.action === 'rejected' ? 'Rejected' : log.action === 'archived' ? 'Archived' : log.action}
                    </p>
                    <p className="text-xs text-ocean-600">{formatDate(log.created_at)}</p>
                    {log.reason && <p className="mt-0.5 text-xs text-ocean-500">{log.reason}</p>}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        )}

        {/* Fare history */}
        {history.length > 0 && (
          <section className="card">
            <h2 className="mb-3 flex items-center gap-1.5 section-title">
              <History size={14} /> Fare History
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-ocean-600">
                    <th className="pb-2 font-semibold">Effective Date</th>
                    <th className="pb-2 text-right font-semibold">Fare</th>
                    <th className="pb-2 text-right font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((f) => {
                    const current = isFareCurrent(f)
                    return (
                      <tr key={f.id} className="border-t border-ocean-50">
                        <td className="py-2 text-ocean-800">{formatDate(f.effective_from)}</td>
                        <td className="py-2 text-right font-semibold text-ocean-900">{formatPeso(f.base_fare)}</td>
                        <td className="py-2 text-right">
                          <span className={`pill ${verificationClasses(f.verification_status)}`}>
                            {current ? 'Current' : VERIFICATION_LABELS[f.verification_status]}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Subscription */}
        <section className="card space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {subscribed ? <Bell size={20} className="text-leaf-700" /> : <BellOff size={20} className="text-ocean-500" />}
              <p className="text-sm font-semibold text-ocean-900">
                {subscribed ? 'Notifications on' : 'Notify me about fare changes'}
              </p>
            </div>
            {!user ? (
              <Link to="/auth" className="btn-secondary text-sm">Sign in</Link>
            ) : (
              <button
                type="button"
                onClick={handleToggle}
                disabled={subLoading}
                className={`relative h-7 w-12 rounded-full transition ${subscribed ? 'bg-leaf-600' : 'bg-ocean-200'}`}
                aria-label="Toggle fare notifications"
              >
                <span
                  className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${subscribed ? 'left-[1.4rem]' : 'left-0.5'}`}
                />
              </button>
            )}
          </div>
          {subMsg && <p className="text-xs text-red-600">{subMsg}</p>}
          {!user && (
            <p className="text-xs text-ocean-500">
              Sign in to save your fare-change notification preferences.
            </p>
          )}
          <p className="text-xs text-ocean-500">
            Fare update notifications will be available soon.
          </p>
        </section>
      </main>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-ocean-600">{label}</span>
      <span className="font-semibold text-ocean-900">{value}</span>
    </div>
  )
}
