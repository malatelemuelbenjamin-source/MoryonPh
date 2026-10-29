import { useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Bus,
  MapPin,
  Clock,
  ShieldCheck,
  AlertCircle,
  Wallet,
  History,
  Table2,
  ExternalLink,
  Receipt,
} from 'lucide-react'
import {
  fetchFareMatrix,
  fetchFareMatrixEntries,
  fetchFareMatrixAuditLogs,
  groupEntriesByRoute,
  matrixTypeLabel,
  formatEntryFare,
  formatDate,
  isMatrixCurrent,
} from '../lib/fareMatrix'
import { supabase } from '../lib/supabase'
import { verificationClasses, VERIFICATION_LABELS, formatRelativeTime } from '../lib/labels'
import type {
  FareMatrixAuditLogRow,
  FareMatrixEntryWithDetails,
  FareMatrixWithDetails,
  RouteStopWithLocation,
} from '../lib/types'

const PASSENGER_COLUMNS: { key: 'regular' | 'student' | 'senior' | 'pwd'; label: string }[] = [
  { key: 'regular', label: 'Regular' },
  { key: 'student', label: 'Student' },
  { key: 'senior', label: 'Senior' },
  { key: 'pwd', label: 'PWD' },
]

export function FareMatrixDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [matrix, setMatrix] = useState<FareMatrixWithDetails | null>(null)
  const [entries, setEntries] = useState<FareMatrixEntryWithDetails[]>([])
  const [auditLogs, setAuditLogs] = useState<FareMatrixAuditLogRow[]>([])
  const [stops, setStops] = useState<RouteStopWithLocation[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    void (async () => {
      const [m, e, logs] = await Promise.all([
        fetchFareMatrix(id),
        fetchFareMatrixEntries(id),
        fetchFareMatrixAuditLogs(id),
      ])
      setMatrix(m)
      setEntries(e)
      setAuditLogs(logs)
      if (m?.route_id) {
        const { data: stopData } = await supabase
          .from('route_stops')
          .select('*, location:locations(id, name, municipality, barangay, latitude, longitude)')
          .eq('route_id', m.route_id)
          .order('stop_sequence', { ascending: true })
        setStops((stopData ?? []) as RouteStopWithLocation[])
      }
      setLoading(false)
    })()
  }, [id])

  if (loading) {
    return (
      <div className="app-shell">
        <DetailHeader />
        <main className="flex-1 px-4 py-5">
          <div className="card flex items-center gap-3">
            <span className="h-3 w-3 animate-pulse rounded-full bg-ocean-400" />
            <p className="text-sm font-semibold text-ocean-700">Loading fare matrix…</p>
          </div>
        </main>
      </div>
    )
  }

  if (!matrix) {
    return (
      <div className="app-shell">
        <DetailHeader />
        <main className="flex-1 px-4 py-5">
          <div className="card flex flex-col items-center gap-3 text-center">
            <AlertCircle size={28} className="text-ocean-600" />
            <p className="text-base font-bold text-ocean-900">Fare matrix not found.</p>
            <Link to="/fare-matrix" className="btn-primary mt-2">Back to Fare Matrix</Link>
          </div>
        </main>
      </div>
    )
  }

  if (!isMatrixCurrent(matrix)) {
    return (
      <div className="app-shell">
        <DetailHeader />
        <main className="flex-1 px-4 py-5">
          <div className="card flex flex-col items-center gap-3 text-center">
            <Clock size={28} className="text-terra-500" />
            <p className="text-base font-bold text-ocean-900">This fare matrix is no longer current.</p>
            <Link to="/fare-matrix" className="btn-primary mt-2">View Current Matrices</Link>
          </div>
        </main>
      </div>
    )
  }

  const rows = groupEntriesByRoute(entries)
  const routeId = matrix.route_id

  return (
    <div className="app-shell">
      <DetailHeader />
      <main className="flex-1 space-y-5 px-4 py-5">
        {/* Header card */}
        <section className="card space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {matrix.transport_mode && (
              <span className="pill bg-ocean-100 text-ocean-800">
                <Bus size={12} /> {matrix.transport_mode.name}
              </span>
            )}
            <span className={`pill ${verificationClasses(matrix.verification_status)}`}>
              {VERIFICATION_LABELS[matrix.verification_status]}
            </span>
            <span className="pill bg-sand-200 text-ocean-700">{matrixTypeLabel(matrix.matrix_type)}</span>
          </div>
          <p className="text-lg font-bold text-ocean-900">{matrix.title}</p>
          {matrix.description && <p className="text-sm text-ocean-700">{matrix.description}</p>}
          {matrix.route?.route_name && (
            <p className="text-sm font-semibold text-ocean-800">{matrix.route.route_name}</p>
          )}
          {matrix.route?.origin_location?.name && matrix.route?.destination_location?.name && (
            <p className="flex items-center gap-1 text-xs text-ocean-600">
              <MapPin size={12} />
              {matrix.route.origin_location.name} → {matrix.route.destination_location.name}
            </p>
          )}
        </section>

        {/* Fare table */}
        <section className="card space-y-3">
          <h2 className="flex items-center gap-1.5 section-title">
            <Table2 size={14} /> Fare Table
          </h2>
          {rows.length === 0 ? (
            <p className="text-sm text-ocean-700">Fare information not yet available.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-ocean-600">
                    <th className="pb-2 pr-3 font-semibold">From</th>
                    <th className="pb-2 pr-3 font-semibold">To</th>
                    {PASSENGER_COLUMNS.map((c) => (
                      <th key={c.key} className="pb-2 px-2 text-right font-semibold">{c.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={i} className="border-t border-ocean-50">
                      <td className="py-2 pr-3 text-ocean-800 font-medium">{row.originName}</td>
                      <td className="py-2 pr-3 text-ocean-800 font-medium">{row.destinationName}</td>
                      {PASSENGER_COLUMNS.map((c) => (
                        <td key={c.key} className="py-2 px-2 text-right font-semibold text-ocean-900">
                          {formatEntryFare(row.fares[c.key] ?? null)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-xs text-ocean-500">
            Unknown discounts are shown as "Not available" — they are never guessed.
          </p>
        </section>

        {/* Route stops */}
        {stops.length > 0 && (
          <section className="card">
            <h2 className="mb-3 section-title">Verified Route Stops</h2>
            <ol className="relative">
              {stops.sort((a, b) => a.stop_sequence - b.stop_sequence).map((stop, i) => (
                <li key={stop.id} className="relative flex gap-3 pb-4 last:pb-0">
                  {i < stops.length - 1 && (
                    <span className="absolute left-[14px] top-7 h-full w-0.5 bg-ocean-100" aria-hidden="true" />
                  )}
                  <span className="relative z-10 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-ocean-700 text-white">
                    <MapPin size={14} />
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-ocean-900">{stop.location?.name ?? 'Stop'}</p>
                    <p className="text-xs text-ocean-600">
                      {stop.stop_type === 'origin' ? 'Origin' : stop.stop_type === 'destination' ? 'Destination' : `Stop ${stop.stop_sequence}`}
                    </p>
                    {stop.notes && <p className="mt-0.5 text-xs text-ocean-500">{stop.notes}</p>}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        )}

        {/* Source & verification */}
        <section className="card space-y-2">
          <h2 className="section-title">Source & Verification</h2>
          <DetailRow label="Verification" value={VERIFICATION_LABELS[matrix.verification_status]} />
          <DetailRow label="Source" value={matrix.source ?? 'Source unavailable'} />
          {matrix.source_reference && <DetailRow label="Reference" value={matrix.source_reference} />}
          <DetailRow label="Effective from" value={formatDate(matrix.effective_from)} />
          {matrix.effective_until && <DetailRow label="Effective until" value={formatDate(matrix.effective_until)} />}
          {matrix.last_verified_at && <DetailRow label="Last verified" value={formatRelativeTime(matrix.last_verified_at)} />}
          {matrix.verification_status === 'community' && (
            <p className="mt-2 rounded-lg bg-sand-100 px-3 py-2 text-xs text-ocean-700">
              This matrix is community-submitted and has not been verified as official.
            </p>
          )}
        </section>

        {/* Audit timeline */}
        {auditLogs.length > 0 && (
          <section className="card">
            <h2 className="mb-3 flex items-center gap-1.5 section-title">
              <History size={14} /> Audit History
            </h2>
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
                      {log.action === 'created' ? 'Matrix created' :
                       log.action === 'published' ? 'Matrix published' :
                       log.action === 'corrected' ? 'Matrix corrected' :
                       log.action === 'verified' ? 'Matrix verified' :
                       log.action === 'rejected' ? 'Matrix rejected' :
                       'Matrix archived'}
                    </p>
                    <p className="text-xs text-ocean-600">{formatDate(log.created_at)}</p>
                    {log.reason && <p className="mt-0.5 text-xs text-ocean-500">{log.reason}</p>}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        )}

        {/* Actions */}
        <section className="card space-y-3">
          {routeId && (
            <button
              type="button"
              onClick={() => navigate('/fare', { state: { routeId } })}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              <Wallet size={18} /> Check Fare
            </button>
          )}
          {routeId && (
            <Link to="/fare-updates" className="btn-secondary w-full flex items-center justify-center gap-2">
              <ExternalLink size={16} /> View Fare Update History
            </Link>
          )}
          <Link
            to={`/fare-concerns/new?route_id=${routeId ?? ''}&fare_matrix_id=${matrix.id}${matrix.transport_mode ? `&transport_mode_id=${matrix.transport_mode.id}` : ''}`}
            className="btn-secondary w-full flex items-center justify-center gap-2"
          >
            <Receipt size={16} /> Report a Fare Concern
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
        <Link to="/fare-matrix" className="grid h-9 w-9 place-items-center rounded-full bg-ocean-700 hover:bg-ocean-600">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-lg font-bold">Fare Matrix</h1>
      </div>
    </header>
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
