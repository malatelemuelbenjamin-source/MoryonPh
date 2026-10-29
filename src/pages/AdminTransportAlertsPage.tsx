import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  ShieldAlert,
  PlusCircle,
  Search as SearchIcon,
  Filter,
  Send,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Eye,
  FileText,
  Lock,
  Bus,
  MapPin,
} from 'lucide-react'
import {
  fetchAllAlerts,
  isAlertAdmin,
  createAlert,
  publishAlert,
  resolveAlert,
  expireAlert,
  rejectAlert,
  submitForReview,
  fetchTransportModes,
  fetchMunicipalities,
  searchLocations,
  searchRoutes,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  SEVERITY_LABELS,
  STATUS_LABELS,
  severityClasses,
  severityLabel,
  statusLabel,
  statusClasses,
  categoryLabel,
  VERIFICATION_LABELS,
} from '../lib/transportAlerts'
import { formatRelativeTime } from '../lib/labels'
import type {
  TransportAlertWithDetails,
  TransportAlertCategory,
  TransportAlertSeverity,
  TransportAlertStatus,
  TransportAlertVerification,
  TransportModeRow,
} from '../lib/types'

const SEVERITY_VALUES: TransportAlertSeverity[] = ['info', 'low', 'moderate', 'high', 'critical']
const VERIFICATION_VALUES: TransportAlertVerification[] = ['verified', 'application_advisory', 'unverified']
const STATUS_ORDER: TransportAlertStatus[] = ['draft', 'pending_review', 'published', 'updated', 'resolved', 'expired', 'rejected']

export function AdminTransportAlertsPage() {
  const [admin, setAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [alerts, setAlerts] = useState<TransportAlertWithDetails[]>([])
  const [transportModes, setTransportModes] = useState<TransportModeRow[]>([])
  const [municipalities, setMunicipalities] = useState<{ id: string; name: string }[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')

  useEffect(() => {
    void (async () => {
      const [isAdmin, modes, munis] = await Promise.all([
        isAlertAdmin(),
        fetchTransportModes(),
        fetchMunicipalities(),
      ])
      setAdmin(isAdmin)
      setTransportModes(modes)
      setMunicipalities(munis)
      if (isAdmin) {
        const all = await fetchAllAlerts()
        setAlerts(all)
      }
      setLoading(false)
    })()
  }, [])

  const filtered = useMemo(() => {
    let list = alerts
    const term = search.trim().toLowerCase()
    if (term) {
      list = list.filter(
        (a) =>
          a.title.toLowerCase().includes(term) ||
          a.description.toLowerCase().includes(term) ||
          (a.source_name ?? '').toLowerCase().includes(term),
      )
    }
    if (statusFilter !== 'all') list = list.filter((a) => a.status === statusFilter)
    if (categoryFilter !== 'all') list = list.filter((a) => a.category === categoryFilter)
    return list
  }, [alerts, search, statusFilter, categoryFilter])

  async function refresh() {
    const all = await fetchAllAlerts()
    setAlerts(all)
  }

  if (loading) {
    return (
      <div className="app-shell">
        <Header />
        <main className="flex-1 px-4 py-5">
          <div className="card flex items-center gap-3">
            <span className="h-3 w-3 animate-pulse rounded-full bg-ocean-400" />
            <p className="text-sm font-semibold text-ocean-700">Loading…</p>
          </div>
        </main>
      </div>
    )
  }

  if (!admin) {
    return (
      <div className="app-shell">
        <Header />
        <main className="flex-1 px-4 py-5">
          <div className="card flex flex-col items-center gap-3 text-center">
            <Lock size={24} className="text-ocean-500" />
            <p className="text-base font-bold text-ocean-900">Access Restricted</p>
            <p className="text-sm text-ocean-700">Only authorized reviewers can manage transport alerts.</p>
            <Link to="/transport-alerts" className="btn-secondary">Back to Transport Alerts</Link>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <Header />

      <main className="flex-1 space-y-5 px-4 py-5">
        {/* Actions */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => { setShowCreate(true); setSelectedId(null) }}
            className="btn-primary flex-1"
          >
            <PlusCircle size={18} /> Create Alert
          </button>
          <Link to="/transport-alerts" className="btn-secondary">
            <Eye size={16} /> Public View
          </Link>
        </div>

        {/* Create form */}
        {showCreate && (
          <CreateAlertForm
            transportModes={transportModes}
            municipalities={municipalities}
            onCreated={() => { setShowCreate(false); void refresh() }}
            onCancel={() => setShowCreate(false)}
          />
        )}

        {/* Search and filters */}
        <section className="card space-y-3">
          <div className="flex items-center gap-2 rounded-xl bg-ocean-50 px-3 py-2.5">
            <SearchIcon size={18} className="text-ocean-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search alerts"
              className="w-full bg-transparent text-sm text-ocean-900 placeholder:text-ocean-400 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-1.5 text-xs font-semibold text-ocean-600">
            <Filter size={14} /> Filters
          </div>

          <div className="flex flex-wrap gap-1.5">
            <Chip active={statusFilter === 'all'} onClick={() => setStatusFilter('all')} label="All Status" />
            {STATUS_ORDER.map((s) => (
              <Chip key={s} active={statusFilter === s} onClick={() => setStatusFilter(s)} label={STATUS_LABELS[s]} />
            ))}
          </div>

          <div className="flex flex-wrap gap-1.5">
            <Chip active={categoryFilter === 'all'} onClick={() => setCategoryFilter('all')} label="All Categories" />
            {CATEGORY_ORDER.map((c) => (
              <Chip key={c} active={categoryFilter === c} onClick={() => setCategoryFilter(c)} label={CATEGORY_LABELS[c]} />
            ))}
          </div>
        </section>

        {/* Alert count */}
        <p className="text-sm text-ocean-600">{filtered.length} alert(s)</p>

        {/* Alert list */}
        <section className="space-y-3">
          {filtered.map((a) => (
            <AdminAlertCard
              key={a.id}
              alert={a}
              expanded={selectedId === a.id}
              onClick={() => setSelectedId(selectedId === a.id ? null : a.id)}
              onRefresh={refresh}
            />
          ))}
          {filtered.length === 0 && (
            <div className="card flex flex-col items-center gap-3 text-center">
              <FileText size={24} className="text-ocean-500" />
              <p className="text-base font-bold text-ocean-900">No alerts found</p>
              <p className="text-sm text-ocean-700">Create a new alert or adjust your filters.</p>
            </div>
          )}
        </section>
      </main>
    </div>
  )

  function Header() {
    return (
      <header className="sticky top-0 z-30 bg-ocean-800 text-white shadow-card">
        <div className="flex items-center gap-3 px-4 py-4">
          <Link to="/" className="grid h-9 w-9 place-items-center rounded-full bg-ocean-700 hover:bg-ocean-600">
            <ArrowLeft size={18} />
          </Link>
          <span className="grid h-8 w-8 place-items-center rounded-full bg-ocean-600">
            <ShieldAlert size={18} />
          </span>
          <h1 className="text-lg font-bold">Alert Management</h1>
        </div>
      </header>
    )
  }
}

// ---- Create Alert Form ---------------------------------------------------

function CreateAlertForm({
  transportModes,
  municipalities,
  onCreated,
  onCancel,
}: {
  transportModes: TransportModeRow[]
  municipalities: { id: string; name: string }[]
  onCreated: () => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<TransportAlertCategory>('service_interruption')
  const [severity, setSeverity] = useState<TransportAlertSeverity>('info')
  const [verification, setVerification] = useState<TransportAlertVerification>('application_advisory')
  const [municipality, setMunicipality] = useState<string>('')
  const [locationQuery, setLocationQuery] = useState('')
  const [locationId, setLocationId] = useState<string | null>(null)
  const [routeQuery, setRouteQuery] = useState('')
  const [routeId, setRouteId] = useState<string | null>(null)
  const [transportModeId, setTransportModeId] = useState<string>('')
  const [sourceName, setSourceName] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [sourceRef, setSourceRef] = useState('')
  const [recommendedActions, setRecommendedActions] = useState('')
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [locResults, setLocResults] = useState<{ id: string; name: string; municipality: string | null }[]>([])
  const [routeResults, setRouteResults] = useState<{ id: string; route_name: string; route_code: string | null }[]>([])

  async function handleLocSearch(q: string) {
    setLocationQuery(q)
    setLocationId(null)
    if (q.trim().length >= 2) {
      setLocResults(await searchLocations(q))
    } else {
      setLocResults([])
    }
  }

  async function handleRouteSearch(q: string) {
    setRouteQuery(q)
    setRouteId(null)
    if (q.trim().length >= 2) {
      setRouteResults(await searchRoutes(q))
    } else {
      setRouteResults([])
    }
  }

  async function handleSubmit() {
    setError(null)
    if (title.trim().length < 5) { setError('Title must be at least 5 characters.'); return }
    if (description.trim().length < 10) { setError('Description must be at least 10 characters.'); return }

    setSubmitting(true)
    const { success, error: err } = await createAlert({
      title,
      description,
      category,
      severity,
      verification,
      municipality: municipality || null,
      location_id: locationId,
      route_id: routeId,
      transport_mode_id: transportModeId || null,
      source_name: sourceName || null,
      source_url: sourceUrl || null,
      source_reference: sourceRef || null,
      recommended_actions: recommendedActions || null,
      starts_at: startsAt ? new Date(startsAt).toISOString() : null,
      ends_at: endsAt ? new Date(endsAt).toISOString() : null,
    })
    setSubmitting(false)

    if (!success) {
      setError(err ?? 'Failed to create alert.')
      return
    }
    onCreated()
  }

  return (
    <section className="card space-y-4">
      <div className="flex items-center gap-2">
        <PlusCircle size={18} className="text-ocean-700" />
        <h2 className="text-base font-bold text-ocean-900">Create New Alert</h2>
      </div>

      <Field label="Title" required>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
          className="input-field"
          placeholder="Brief alert title"
        />
      </Field>

      <Field label="Description" required>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={8000}
          rows={4}
          className="input-field"
          placeholder="Full alert details"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Category" required>
          <select value={category} onChange={(e) => setCategory(e.target.value as TransportAlertCategory)} className="input-field">
            {CATEGORY_ORDER.map((c) => (
              <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
            ))}
          </select>
        </Field>

        <Field label="Severity" required>
          <select value={severity} onChange={(e) => setSeverity(e.target.value as TransportAlertSeverity)} className="input-field">
            {SEVERITY_VALUES.map((s) => (
              <option key={s} value={s}>{SEVERITY_LABELS[s]}</option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Verification Level" required>
        <select value={verification} onChange={(e) => setVerification(e.target.value as TransportAlertVerification)} className="input-field">
          {VERIFICATION_VALUES.map((v) => (
            <option key={v} value={v}>{VERIFICATION_LABELS[v]}</option>
          ))}
        </select>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Municipality">
          <select value={municipality} onChange={(e) => setMunicipality(e.target.value)} className="input-field">
            <option value="">— None —</option>
            {municipalities.map((m) => (
              <option key={m.id} value={m.name}>{m.name}</option>
            ))}
          </select>
        </Field>

        <Field label="Transport Mode">
          <select value={transportModeId} onChange={(e) => setTransportModeId(e.target.value)} className="input-field">
            <option value="">— None —</option>
            {transportModes.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Search Location">
        <input
          type="text"
          value={locationQuery}
          onChange={(e) => handleLocSearch(e.target.value)}
          className="input-field"
          placeholder="Type a location name"
        />
        {locResults.length > 0 && (
          <div className="mt-1 space-y-1">
            {locResults.slice(0, 5).map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => { setLocationId(l.id); setLocationQuery(l.name); setLocResults([]) }}
                className="block w-full rounded-lg bg-ocean-50 px-3 py-1.5 text-left text-xs text-ocean-800 hover:bg-ocean-100"
              >
                {l.name} {l.municipality ? `(${l.municipality})` : ''}
              </button>
            ))}
          </div>
        )}
      </Field>

      <Field label="Search Route">
        <input
          type="text"
          value={routeQuery}
          onChange={(e) => handleRouteSearch(e.target.value)}
          className="input-field"
          placeholder="Type a route name"
        />
        {routeResults.length > 0 && (
          <div className="mt-1 space-y-1">
            {routeResults.slice(0, 5).map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => { setRouteId(r.id); setRouteQuery(r.route_name); setRouteResults([]) }}
                className="block w-full rounded-lg bg-ocean-50 px-3 py-1.5 text-left text-xs text-ocean-800 hover:bg-ocean-100"
              >
                {r.route_name} {r.route_code ? `(${r.route_code})` : ''}
              </button>
            ))}
          </div>
        )}
      </Field>

      <Field label="Source Name" required={false}>
        <input
          type="text"
          value={sourceName}
          onChange={(e) => setSourceName(e.target.value)}
          className="input-field"
          placeholder="e.g. PAGASA, Montenegro Shipping, LTFRB"
        />
        <p className="mt-1 text-[10px] text-ocean-500">A source is required to publish this alert.</p>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Source URL">
          <input
            type="url"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            className="input-field"
            placeholder="https://..."
          />
        </Field>

        <Field label="Source Reference">
          <input
            type="text"
            value={sourceRef}
            onChange={(e) => setSourceRef(e.target.value)}
            className="input-field"
            placeholder="Announcement ID or reference"
          />
        </Field>
      </div>

      <Field label="Recommended Actions">
        <textarea
          value={recommendedActions}
          onChange={(e) => setRecommendedActions(e.target.value)}
          maxLength={4000}
          rows={3}
          className="input-field"
          placeholder="What should travelers do?"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Starts At">
          <input
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            className="input-field"
          />
        </Field>

        <Field label="Ends At">
          <input
            type="datetime-local"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
            className="input-field"
          />
        </Field>
      </div>

      {error && (
        <div className="rounded-xl bg-terra-50 px-3 py-2.5 text-sm text-terra-800">
          {error}
        </div>
      )}

      <div className="flex gap-2">
        <button type="button" onClick={handleSubmit} disabled={submitting} className="btn-primary flex-1">
          {submitting ? 'Saving…' : 'Save as Draft'}
        </button>
        <button type="button" onClick={onCancel} className="btn-secondary">Cancel</button>
      </div>
    </section>
  )
}

// ---- Admin Alert Card with actions ---------------------------------------

function AdminAlertCard({
  alert,
  expanded,
  onClick,
  onRefresh,
}: {
  alert: TransportAlertWithDetails
  expanded: boolean
  onClick: () => void
  onRefresh: () => void
}) {
  const [acting, setActing] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  async function doAction(fn: () => Promise<{ success: boolean; error?: string }>, label: string) {
    setActionError(null)
    setActing(true)
    const { success, error } = await fn()
    setActing(false)
    if (!success) {
      setActionError(error ?? `Failed to ${label}.`)
    } else {
      void onRefresh()
    }
  }

  return (
    <div className="card space-y-2">
      <div className="cursor-pointer active:scale-[0.98] transition" onClick={onClick} role="button">
        <div className="flex items-start justify-between gap-2">
          <p className="font-bold text-ocean-900">{alert.title}</p>
          <span className={`pill shrink-0 ${severityClasses(alert.severity)}`}>
            {severityLabel(alert.severity)}
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5 mt-1">
          <span className="pill bg-sand-200 text-ocean-800 text-[10px]">{categoryLabel(alert.category)}</span>
          <span className={`pill ${statusClasses(alert.status)} text-[10px]`}>{statusLabel(alert.status)}</span>
        </div>

        <p className="text-sm text-ocean-700 line-clamp-2 mt-1">{alert.description}</p>

        <div className="flex flex-wrap gap-3 text-xs text-ocean-600 mt-1">
          {alert.municipality && <span className="flex items-center gap-1"><MapPin size={12} /> {alert.municipality}</span>}
          {alert.transport_mode && <span className="flex items-center gap-1"><Bus size={12} /> {alert.transport_mode.name}</span>}
          <span className="flex items-center gap-1"><Clock size={12} /> {formatRelativeTime(alert.updated_at)}</span>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-sand-200 pt-3 space-y-3">
          <p className="text-sm text-ocean-700 whitespace-pre-line">{alert.description}</p>

          {alert.source_name && (
            <p className="text-xs text-ocean-600">Source: {alert.source_name}</p>
          )}

          {actionError && (
            <p className="text-xs text-terra-700 font-semibold">{actionError}</p>
          )}

          {/* Action buttons based on status */}
          <div className="flex flex-wrap gap-2">
            {alert.status === 'draft' && (
              <button
                type="button"
                disabled={acting}
                onClick={(e) => { e.stopPropagation(); void doAction(() => submitForReview(alert.id), 'submit for review') }}
                className="btn-secondary text-xs"
              >
                <Send size={14} /> Submit for Review
              </button>
            )}
            {(alert.status === 'pending_review' || alert.status === 'draft') && (
              <button
                type="button"
                disabled={acting || !alert.source_name}
                onClick={(e) => { e.stopPropagation(); void doAction(() => publishAlert(alert.id), 'publish') }}
                className="btn-primary text-xs"
                title={!alert.source_name ? 'Source required to publish' : undefined}
              >
                <CheckCircle2 size={14} /> Publish
              </button>
            )}
            {(alert.status === 'published' || alert.status === 'updated') && (
              <>
                <button
                  type="button"
                  disabled={acting}
                  onClick={(e) => { e.stopPropagation(); void doAction(() => resolveAlert(alert.id), 'resolve') }}
                  className="btn-secondary text-xs"
                >
                  <CheckCircle2 size={14} /> Resolve
                </button>
                <button
                  type="button"
                  disabled={acting}
                  onClick={(e) => { e.stopPropagation(); void doAction(() => expireAlert(alert.id), 'expire') }}
                  className="btn-secondary text-xs"
                >
                  <Clock size={14} /> Expire
                </button>
              </>
            )}
            {alert.status !== 'rejected' && alert.status !== 'resolved' && alert.status !== 'expired' && (
              <button
                type="button"
                disabled={acting}
                onClick={(e) => { e.stopPropagation(); void doAction(() => rejectAlert(alert.id), 'reject') }}
                className="btn-secondary text-xs text-terra-700"
              >
                <XCircle size={14} /> Reject
              </button>
            )}
            <Link
              to={`/transport-alerts/${alert.id}`}
              className="btn-secondary text-xs"
              onClick={(e) => e.stopPropagation()}
            >
              <Eye size={14} /> View Details
            </Link>
          </div>

          {!alert.source_name && (alert.status === 'draft' || alert.status === 'pending_review') && (
            <div className="flex items-start gap-2 rounded-xl bg-terra-50 px-3 py-2">
              <AlertTriangle size={14} className="mt-0.5 shrink-0 text-terra-600" />
              <p className="text-xs text-terra-800">A source name is required before this alert can be published.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ---- Reusable UI helpers -------------------------------------------------

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-ocean-700 mb-1">
        {label}{required && <span className="text-terra-600"> *</span>}
      </label>
      {children}
    </div>
  )
}

function Chip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-semibold transition active:scale-95 ${
        active ? 'bg-ocean-700 text-white' : 'bg-ocean-50 text-ocean-700 hover:bg-ocean-100'
      }`}
    >
      {label}
    </button>
  )
}
