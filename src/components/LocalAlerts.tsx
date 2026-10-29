import { useEffect, useState } from 'react'
import { AlertTriangle, Info, Megaphone, X } from 'lucide-react'
import { getActiveAlerts } from '../lib/data'
import type { LocalAlertWithLocation } from '../lib/types'
import {
  CATEGORY_LABELS,
  PRIORITY_LABELS,
  VERIFICATION_LABELS,
  formatRelativeTime,
  verificationClasses,
} from '../lib/labels'

export function LocalAlerts() {
  const [items, setItems] = useState<LocalAlertWithLocation[]>([])
  const [loading, setLoading] = useState(true)
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())

  useEffect(() => {
    let cancelled = false
    async function load() {
      const r = await getActiveAlerts(6)
      if (!cancelled) {
        setItems(r)
        setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const visible = items.filter((a) => !dismissed.has(a.id))
  const official = visible.filter((a) => a.verification_status === 'official' || a.verification_status === 'verified')
  const community = visible.filter((a) => a.verification_status === 'community')

  if (loading) {
    return (
      <section>
        <h2 className="section-title mb-3">Local Information</h2>
        <div className="card">
          <p className="py-2 text-sm text-ocean-600">Loading advisories…</p>
        </div>
      </section>
    )
  }

  if (visible.length === 0) {
    return (
      <section>
        <h2 className="section-title mb-3">Local Information</h2>
        <div className="card flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-leaf-400/20 text-leaf-700">
            <Info size={20} />
          </span>
          <p className="text-sm font-semibold text-ocean-800">
            No active transportation advisories.
          </p>
        </div>
      </section>
    )
  }

  return (
    <section>
      <h2 className="section-title mb-3">Local Information</h2>
      <div className="space-y-3">
        {official.map((a) => (
          <AlertCard key={a.id} alert={a} onDismiss={() => dismiss(a.id)} prominent />
        ))}
        {community.map((a) => (
          <AlertCard key={a.id} alert={a} onDismiss={() => dismiss(a.id)} />
        ))}
      </div>
    </section>
  )

  function dismiss(id: string) {
    setDismissed((prev) => new Set(prev).add(id))
  }
}

interface AlertCardProps {
  alert: LocalAlertWithLocation
  onDismiss: () => void
  prominent?: boolean
}

function AlertCard({ alert, onDismiss, prominent }: AlertCardProps) {
  const isCommunity = alert.verification_status === 'community'
  const tone = prominent
    ? 'border-l-4 border-ocean-700 bg-ocean-50'
    : isCommunity
      ? 'border-l-4 border-sand-400 bg-sand-50'
      : 'border-l-4 border-leaf-500 bg-white'
  const Icon = alert.priority === 'critical' || alert.priority === 'high'
    ? AlertTriangle
    : Megaphone

  return (
    <div className={`card ${tone}`}>
      <div className="flex items-start gap-3">
        <span
          className={`grid h-10 w-10 place-items-center rounded-full ${
            prominent ? 'bg-ocean-700 text-white' : 'bg-sand-200 text-terra-700'
          }`}
        >
          <Icon size={20} />
        </span>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="pill bg-ocean-100 text-ocean-800">
              {CATEGORY_LABELS[alert.category]}
            </span>
            <span className={`pill ${verificationClasses(alert.verification_status)}`}>
              {VERIFICATION_LABELS[alert.verification_status]}
            </span>
            {alert.priority !== 'information' && (
              <span className="pill bg-terra-100 text-terra-700">
                {PRIORITY_LABELS[alert.priority]}
              </span>
            )}
          </div>
          <h3 className="mt-2 text-base font-bold text-ocean-900">{alert.title}</h3>
          {alert.description && (
            <p className="mt-1 text-sm text-ocean-700">{alert.description}</p>
          )}
          <div className="mt-2 text-xs text-ocean-600">
            {alert.affected_location?.name && (
              <span className="mr-2">📍 {alert.affected_location.name}</span>
            )}
            {alert.start_at && <span className="mr-2">{formatRelativeTime(alert.start_at)}</span>}
            {alert.source && <span>Source: {alert.source}</span>}
          </div>
          {isCommunity && (
            <p className="mt-2 text-xs font-semibold text-terra-700">
              Community Report — Not yet verified
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss advisory"
          className="grid h-8 w-8 place-items-center rounded-full text-ocean-500 hover:bg-ocean-100"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}
