import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  AlertTriangle,
  MapPin,
  Bus,
  Clock,
  ExternalLink,
  Info,
  Route as RouteIcon,
} from 'lucide-react'
import {
  fetchAlert,
  fetchAuditLogs,
  severityClasses,
  severityLabel,
  categoryLabel,
  statusLabel,
  statusClasses,
  verificationClasses,
  VERIFICATION_LABELS,
} from '../lib/transportAlerts'
import { formatRelativeTime } from '../lib/labels'
import type {
  TransportAlertWithDetails,
  TransportAlertAuditLogRow,
} from '../lib/types'

const AUDIT_ACTION_LABELS: Record<string, string> = {
  created: 'Alert Created',
  submitted_for_review: 'Submitted for Review',
  published: 'Alert Published',
  updated: 'Alert Updated',
  resolved: 'Alert Resolved',
  expired: 'Alert Expired',
  rejected: 'Alert Rejected',
}

export function TransportAlertDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [alert, setAlert] = useState<TransportAlertWithDetails | null>(null)
  const [auditLogs, setAuditLogs] = useState<TransportAlertAuditLogRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    void (async () => {
      const [a, logs] = await Promise.all([
        fetchAlert(id),
        fetchAuditLogs(id),
      ])
      setAlert(a)
      setAuditLogs(logs)
      setLoading(false)
    })()
  }, [id])

  if (loading) {
    return (
      <div className="app-shell">
        <header className="sticky top-0 z-30 bg-ocean-800 text-white shadow-card">
          <div className="flex items-center gap-3 px-4 py-4">
            <Link to="/transport-alerts" className="grid h-9 w-9 place-items-center rounded-full bg-ocean-700">
              <ArrowLeft size={18} />
            </Link>
            <h1 className="text-lg font-bold">Alert Details</h1>
          </div>
        </header>
        <main className="flex-1 px-4 py-5">
          <div className="card flex items-center gap-3">
            <span className="h-3 w-3 animate-pulse rounded-full bg-ocean-400" />
            <p className="text-sm font-semibold text-ocean-700">Loading alert details…</p>
          </div>
        </main>
      </div>
    )
  }

  if (!alert) {
    return (
      <div className="app-shell">
        <header className="sticky top-0 z-30 bg-ocean-800 text-white shadow-card">
          <div className="flex items-center gap-3 px-4 py-4">
            <Link to="/transport-alerts" className="grid h-9 w-9 place-items-center rounded-full bg-ocean-700">
              <ArrowLeft size={18} />
            </Link>
            <h1 className="text-lg font-bold">Alert Details</h1>
          </div>
        </header>
        <main className="flex-1 px-4 py-5">
          <div className="card flex flex-col items-center gap-3 text-center">
            <AlertTriangle size={24} className="text-terra-600" />
            <p className="text-base font-bold text-ocean-900">Alert not found</p>
            <p className="text-sm text-ocean-700">This alert may have been removed or is not publicly available.</p>
            <Link to="/transport-alerts" className="btn-secondary">Back to Transport Alerts</Link>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <header className="sticky top-0 z-30 bg-ocean-800 text-white shadow-card">
        <div className="flex items-center gap-3 px-4 py-4">
          <Link to="/transport-alerts" className="grid h-9 w-9 place-items-center rounded-full bg-ocean-700">
            <ArrowLeft size={18} />
          </Link>
          <h1 className="text-lg font-bold">Alert Details</h1>
        </div>
      </header>

      <main className="flex-1 space-y-5 px-4 py-5">
        {/* Title and severity */}
        <section className="card space-y-3">
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-xl font-bold text-ocean-900">{alert.title}</h2>
            <span className={`pill shrink-0 ${severityClasses(alert.severity)}`}>
              {severityLabel(alert.severity)}
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            <span className="pill bg-sand-200 text-ocean-800">{categoryLabel(alert.category)}</span>
            <span className={`pill ${statusClasses(alert.status)}`}>{statusLabel(alert.status)}</span>
            <span className={`pill ${verificationClasses(alert.verification)}`}>
              {VERIFICATION_LABELS[alert.verification]}
            </span>
          </div>
        </section>

        {/* Description */}
        <section className="card space-y-2">
          <h3 className="section-title">Description</h3>
          <p className="text-sm text-ocean-800 whitespace-pre-line">{alert.description}</p>
        </section>

        {/* Recommended actions */}
        {alert.recommended_actions && (
          <section className="card space-y-2 border-l-4 border-ocean-300">
            <h3 className="section-title">Recommended Actions</h3>
            <p className="text-sm text-ocean-800 whitespace-pre-line">{alert.recommended_actions}</p>
          </section>
        )}

        {/* Affected area and transport */}
        <section className="card space-y-3">
          <h3 className="section-title">Affected Area & Transport</h3>
          <div className="space-y-2">
            {alert.municipality && (
              <div className="flex items-center gap-2 text-sm text-ocean-700">
                <MapPin size={16} className="text-ocean-500" />
                <span>Municipality: <span className="font-semibold">{alert.municipality}</span></span>
              </div>
            )}
            {alert.location && (
              <div className="flex items-center gap-2 text-sm text-ocean-700">
                <MapPin size={16} className="text-ocean-500" />
                <span>Location: <span className="font-semibold">{alert.location.name}</span></span>
              </div>
            )}
            {alert.route && (
              <Link to={`/jeepney-routes/${alert.route.id}`} className="flex items-center gap-2 text-sm text-ocean-700 hover:underline">
                <RouteIcon size={16} className="text-ocean-500" />
                <span>Route: <span className="font-semibold">{alert.route.route_name}</span></span>
              </Link>
            )}
            {alert.transport_mode && (
              <div className="flex items-center gap-2 text-sm text-ocean-700">
                <Bus size={16} className="text-ocean-500" />
                <span>Transport: <span className="font-semibold">{alert.transport_mode.name}</span></span>
              </div>
            )}
            {!alert.municipality && !alert.location && !alert.route && !alert.transport_mode && (
              <p className="text-sm text-ocean-600">No specific area or transport mode associated.</p>
            )}
          </div>
        </section>

        {/* Timing */}
        <section className="card space-y-2">
          <h3 className="section-title">Timing</h3>
          <div className="space-y-1.5 text-sm text-ocean-700">
            {alert.starts_at && (
              <p>Effective from: <span className="font-semibold">{new Date(alert.starts_at).toLocaleString('en-PH')}</span></p>
            )}
            {alert.ends_at ? (
              <p>Expected until: <span className="font-semibold">{new Date(alert.ends_at).toLocaleString('en-PH')}</span></p>
            ) : (
              alert.status !== 'resolved' && <p className="text-terra-700 font-semibold">End time not confirmed</p>
            )}
            {alert.published_at && (
              <p>Published: <span className="font-semibold">{formatRelativeTime(alert.published_at)}</span></p>
            )}
            {alert.resolved_at && (
              <p>Resolved: <span className="font-semibold">{formatRelativeTime(alert.resolved_at)}</span></p>
            )}
            <p>Last updated: <span className="font-semibold">{formatRelativeTime(alert.updated_at)}</span></p>
          </div>
        </section>

        {/* Source */}
        <section className="card space-y-2">
          <h3 className="section-title">Source</h3>
          {alert.source_name ? (
            <div className="space-y-1.5">
              <p className="text-sm text-ocean-700">
                Issuing source: <span className="font-semibold">{alert.source_name}</span>
              </p>
              {alert.source_reference && (
                <p className="text-sm text-ocean-700">Reference: {alert.source_reference}</p>
              )}
              {alert.source_url && (
                <a
                  href={alert.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary inline-flex items-center gap-1.5 text-xs"
                >
                  <ExternalLink size={12} /> View Source
                </a>
              )}
            </div>
          ) : (
            <p className="text-sm text-ocean-600">No external source recorded.</p>
          )}
          {alert.verification === 'application_advisory' && (
            <div className="mt-2 flex items-start gap-2 rounded-xl bg-ocean-50 px-3 py-2">
              <Info size={14} className="mt-0.5 shrink-0 text-ocean-500" />
              <p className="text-xs text-ocean-700">
                This is an application-issued advisory from the MoryonGo team. It is not an official government announcement.
              </p>
            </div>
          )}
        </section>

        {/* Audit history */}
        {auditLogs.length > 0 && (
          <section className="space-y-3">
            <h2 className="section-title">Alert History</h2>
            <div className="card space-y-3">
              {auditLogs.map((log) => (
                <div key={log.id} className="flex items-start gap-2 text-sm">
                  <span className="mt-0.5 grid h-6 w-6 place-items-center rounded-full bg-ocean-50 text-ocean-600">
                    <Clock size={12} />
                  </span>
                  <div>
                    <p className="font-semibold text-ocean-800">
                      {AUDIT_ACTION_LABELS[log.action] ?? log.action}
                    </p>
                    <p className="text-xs text-ocean-500">{formatRelativeTime(log.created_at)}</p>
                    {log.note && <p className="text-xs text-ocean-600 mt-0.5">{log.note}</p>}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Disclaimer */}
        <p className="px-2 text-center text-[10px] text-ocean-400">
          Transport alerts are published by authorized reviewers. Unverified community reports are not displayed as official alerts.
        </p>
      </main>
    </div>
  )
}
