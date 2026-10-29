import { useEffect, useState, useCallback } from 'react'
import { Link, useLocation as useRouterLocation, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Share2, Copy, Trash2, Eye, EyeOff, Clock, CheckCircle2,
  AlertTriangle, Info, Link2, Ban, RefreshCw, Wallet, MapPin,
} from 'lucide-react'
import { useAuth } from '../lib/auth'
import {
  createShareLink, fetchMyShares, revokeShare, deleteShare, extendShare,
  buildItinerarySnapshot, buildRouteSnapshot, buildCostEstimateSnapshot,
  computeExpiry, formatExpiry, isExpired, isRevoked,
  buildShareUrl, copyToClipboard, nativeShare,
  EXPIRY_OPTIONS, sourceTypeLabel, shareStatusLabel,
} from '../lib/shareTrip'
import { fetchItineraryDetail } from '../lib/touristPlanner'
import { fetchEstimateDetail } from '../lib/tripCostCalculator'
import { getRouteDetail } from '../lib/routes'
import type { SharedTripRow, TripSourceType } from '../lib/types'
import type { ShareContentOptions } from '../lib/shareTrip'

interface RouterState {
  sourceType?: TripSourceType
  sourceId?: string
  title?: string
}

export function ShareTripPage() {
  const routerLoc = useRouterLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const initialState = (routerLoc.state ?? {}) as RouterState

  const [shares, setShares] = useState<SharedTripRow[]>([])
  const [loading, setLoading] = useState(true)
  const [actionError, setActionError] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [created, setCreated] = useState<string | null>(null)

  // Content selection options
  const [includeStops, setIncludeStops] = useState(true)
  const [includeRouteDetails, setIncludeRouteDetails] = useState(true)
  const [includeCosts, setIncludeCosts] = useState(false)
  const [includeNotes, setIncludeNotes] = useState(false)
  const [expiryDays, setExpiryDays] = useState(7)
  const [showPreview, setShowPreview] = useState(false)
  const [confirmed, setConfirmed] = useState(false)

  const loadShares = useCallback(async () => {
    const list = await fetchMyShares()
    setShares(list)
  }, [])

  useEffect(() => {
    if (!user) { setLoading(false); return }
    void (async () => {
      setLoading(true)
      await loadShares()
      setLoading(false)
    })()
  }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!user) {
    return (
      <div className="app-shell">
        <ShareHeader />
        <main className="flex-1 px-4 py-5">
          <div className="card flex flex-col items-center gap-3 text-center">
            <Share2 size={32} className="text-ocean-400" />
            <p className="font-bold text-ocean-900">Please sign in to share trips</p>
            <Link to="/auth" className="btn-primary w-full">Sign In / Sign Up</Link>
          </div>
        </main>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="app-shell">
        <ShareHeader />
        <main className="flex-1 px-4 py-5">
          <div className="card flex items-center gap-3">
            <span className="h-3 w-3 animate-pulse rounded-full bg-ocean-400" />
            <p className="text-sm font-semibold text-ocean-700">Loading…</p>
          </div>
        </main>
      </div>
    )
  }

  async function handleCreateShare() {
    if (!initialState.sourceType || !initialState.sourceId) {
      setActionError('Missing trip information to share.')
      return
    }
    setCreating(true)
    setActionError(null)

    const opts: ShareContentOptions = {
      include_costs: includeCosts,
      include_notes: includeNotes,
      include_stops: includeStops,
      include_route_details: includeRouteDetails,
    }

    let content: Record<string, unknown> = {}
    let title = initialState.title ?? 'Shared Trip'

    try {
      if (initialState.sourceType === 'itinerary') {
        const itinerary = await fetchItineraryDetail(initialState.sourceId)
        if (!itinerary) { setActionError('Trip not found or you do not have access.'); setCreating(false); return }
        title = itinerary.title
        content = await buildItinerarySnapshot(itinerary, opts)
      } else if (initialState.sourceType === 'route') {
        const route = await getRouteDetail(initialState.sourceId)
        if (!route) { setActionError('Route not found.'); setCreating(false); return }
        title = route.route_name
        content = await buildRouteSnapshot(route, opts)
      } else if (initialState.sourceType === 'cost_estimate') {
        const estimate = await fetchEstimateDetail(initialState.sourceId)
        if (!estimate) { setActionError('Cost estimate not found.'); setCreating(false); return }
        title = estimate.title
        content = await buildCostEstimateSnapshot(estimate, opts)
      }
    } catch {
      setActionError('Failed to prepare trip data for sharing.')
      setCreating(false)
      return
    }

    const expiresAt = computeExpiry(expiryDays)
    const { success, token, error } = await createShareLink({
      trip_source_type: initialState.sourceType,
      trip_source_id: initialState.sourceId,
      title,
      shared_content: content,
      options: opts,
      expires_at: expiresAt,
    })

    setCreating(false)

    if (!success || !token) {
      setActionError(error ?? 'Failed to create share link.')
      return
    }

    setCreated(token)
    await loadShares()
  }

  async function handleCopy(token: string, id: string) {
    const url = buildShareUrl(token)
    const ok = await copyToClipboard(url)
    if (ok) {
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    }
  }

  async function handleNativeShare(token: string) {
    const url = buildShareUrl(token)
    await nativeShare('Shared Trip', url)
  }

  async function handleRevoke(id: string) {
    if (!confirm('Revoke this share link? Recipients will no longer be able to view it.')) return
    setActionError(null)
    const { error } = await revokeShare(id)
    if (error) { setActionError(error); return }
    await loadShares()
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this share record permanently?')) return
    setActionError(null)
    const { error } = await deleteShare(id)
    if (error) { setActionError(error); return }
    await loadShares()
  }

  async function handleExtend(id: string, days: number) {
    setActionError(null)
    const expiresAt = computeExpiry(days)
    const { error } = await extendShare(id, expiresAt)
    if (error) { setActionError(error); return }
    await loadShares()
  }

  const hasSource = initialState.sourceType && initialState.sourceId

  return (
    <div className="app-shell">
      <ShareHeader />

      <main className="flex-1 space-y-5 px-4 py-5">
        {actionError && (
          <div className="card border border-red-200 bg-red-50">
            <p className="text-sm text-red-700 flex items-center gap-2"><AlertTriangle size={16} /> {actionError}</p>
          </div>
        )}

        {/* Created link success */}
        {created && (
          <div className="card space-y-3 border border-leaf-200 bg-leaf-50">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={20} className="text-leaf-600" />
              <p className="font-bold text-leaf-800">Share link created!</p>
            </div>
            <div className="rounded-xl bg-white px-3 py-2.5">
              <p className="text-xs text-ocean-600 break-all">{buildShareUrl(created)}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => void handleCopy(created, 'new')} className="btn-primary flex-1 text-xs py-2.5">
                <Copy size={14} /> Copy Link
              </button>
              <button onClick={() => void handleNativeShare(created)} className="btn-secondary flex-1 text-xs py-2.5">
                <Share2 size={14} /> Share
              </button>
              <button onClick={() => navigate(`/shared/${created}`)} className="btn-ghost text-xs px-4 py-2.5">
                <Eye size={14} /> Preview
              </button>
            </div>
            {copiedId === 'new' && (
              <p className="text-xs text-leaf-600 font-semibold flex items-center gap-1"><CheckCircle2 size={12} /> Copied to clipboard!</p>
            )}
            <button onClick={() => setCreated(null)} className="text-xs text-ocean-500 underline">
              Create another link
            </button>
          </div>
        )}

        {/* Share creation form */}
        {hasSource && !created && (
          <section className="card space-y-4">
            <h2 className="section-title flex items-center gap-2"><Share2 size={16} /> Share This {sourceTypeLabel(initialState.sourceType!)}</h2>

            <div className="rounded-xl bg-sand-50 px-3 py-3">
              <p className="text-sm font-semibold text-ocean-900">{initialState.title ?? 'Untitled trip'}</p>
              <p className="text-xs text-ocean-500 mt-0.5">{sourceTypeLabel(initialState.sourceType!)}</p>
            </div>

            {/* Content selection */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-ocean-800">What to include:</h3>
              <ToggleOption
                label="Stops & destinations"
                icon={<MapPin size={16} />}
                value={includeStops}
                onChange={setIncludeStops}
              />
              <ToggleOption
                label="Route & transport details"
                icon={<Link2 size={16} />}
                value={includeRouteDetails}
                onChange={setIncludeRouteDetails}
              />
              <ToggleOption
                label="Cost estimates"
                icon={<Wallet size={16} />}
                value={includeCosts}
                onChange={setIncludeCosts}
              />
              <ToggleOption
                label="Personal notes"
                icon={<Info size={16} />}
                value={includeNotes}
                onChange={setIncludeNotes}
              />
            </div>

            {/* Expiration */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-ocean-800 flex items-center gap-1"><Clock size={14} /> Link expires after:</label>
              <div className="flex flex-wrap gap-2">
                {EXPIRY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setExpiryDays(opt.value)}
                    className={`rounded-xl px-3 py-2 text-sm font-semibold transition active:scale-95 ${
                      expiryDays === opt.value
                        ? 'bg-ocean-700 text-white'
                        : 'bg-ocean-50 text-ocean-800 hover:bg-ocean-100'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Preview */}
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="btn-ghost w-full text-xs py-2.5"
            >
              {showPreview ? <EyeOff size={14} /> : <Eye size={14} />}
              {showPreview ? 'Hide preview' : 'Show preview of shared content'}
            </button>

            {showPreview && (
              <div className="rounded-xl bg-sand-50 p-3 space-y-2 text-xs text-ocean-700">
                <p className="font-semibold text-ocean-800">Preview of shared information:</p>
                <ul className="space-y-1">
                  <li className={includeStops ? 'text-leaf-700' : 'text-ocean-400 line-through'}>
                    {includeStops ? '+' : '−'} Trip title, dates, stops, and destinations</li>
                  <li className={includeRouteDetails ? 'text-leaf-700' : 'text-ocean-400 line-through'}>
                    {includeRouteDetails ? '+' : '−'} Route names, transport modes, fares</li>
                  <li className={includeCosts ? 'text-leaf-700' : 'text-ocean-400 line-through'}>
                    {includeCosts ? '+' : '−'} Cost estimates and breakdown</li>
                  <li className={includeNotes ? 'text-leaf-700' : 'text-ocean-400 line-through'}>
                    {includeNotes ? '+' : '−'} Your personal notes</li>
                  <li className="text-ocean-400">− Your account information, email, and private data are never shared</li>
                </ul>
                <p className="text-ocean-500 italic">
                  Expires: {formatExpiry(computeExpiry(expiryDays))}
                </p>
              </div>
            )}

            {/* Consent */}
            <label className="flex items-start gap-2 text-sm text-ocean-700">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="mt-0.5"
              />
              <span>I understand that anyone with this link can view the selected information until it expires or I revoke it.</span>
            </label>

            <button
              onClick={() => void handleCreateShare()}
              disabled={creating || !confirmed}
              className="btn-primary w-full disabled:opacity-50"
            >
              {creating ? (
                <><span className="h-4 w-4 animate-pulse rounded-full bg-white" /> Creating…</>
              ) : (
                <><Share2 size={18} /> Create Share Link</>
              )}
            </button>
          </section>
        )}

        {/* Manage existing shares */}
        <section className="card space-y-3">
          <h2 className="section-title flex items-center gap-2"><Link2 size={16} /> My Share Links</h2>

          {shares.length === 0 && (
            <p className="text-sm text-ocean-500 text-center py-4">
              No share links yet. {hasSource ? 'Create one above.' : 'Open a trip, route, or estimate and tap Share.'}
            </p>
          )}

          {shares.length > 0 && (
            <div className="space-y-3">
              {shares.map((share) => {
                const expired = isExpired(share.expires_at)
                const revoked = isRevoked(share.revoked_at)
                const isActive = !expired && !revoked
                return (
                  <div key={share.id} className="rounded-xl border border-sand-200 bg-sand-50 p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-ocean-900 truncate">{share.title_snapshot}</p>
                        <p className="text-xs text-ocean-500">
                          {sourceTypeLabel(share.trip_source_type)} · Created {new Date(share.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <span className={`pill text-[10px] shrink-0 ${
                        isActive ? 'bg-leaf-100 text-leaf-700'
                          : revoked ? 'bg-red-100 text-red-700'
                          : 'bg-sand-200 text-ocean-500'
                      }`}>
                        {shareStatusLabel(share)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-ocean-500">
                      <Clock size={12} />
                      Expires: {formatExpiry(share.expires_at)}
                      {share.view_count > 0 && (
                        <span className="ml-2">· {share.view_count} view(s)</span>
                      )}
                    </div>

                    {isActive && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => void handleCopy(share.share_token, share.id)}
                          className="btn-secondary flex-1 text-xs py-2"
                        >
                          {copiedId === share.id ? <CheckCircle2 size={12} /> : <Copy size={12} />}
                          {copiedId === share.id ? 'Copied!' : 'Copy'}
                        </button>
                        <button
                          onClick={() => void handleNativeShare(share.share_token)}
                          className="btn-secondary text-xs px-3 py-2"
                        >
                          <Share2 size={12} />
                        </button>
                        <button
                          onClick={() => void handleRevoke(share.id)}
                          className="btn-secondary text-xs px-3 py-2 text-terra-600"
                        >
                          <Ban size={12} /> Revoke
                        </button>
                      </div>
                    )}

                    {expired && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => void handleExtend(share.id, 7)}
                          className="btn-secondary flex-1 text-xs py-2"
                        >
                          <RefreshCw size={12} /> Extend 7 days
                        </button>
                        <button
                          onClick={() => void handleDelete(share.id)}
                          className="btn-secondary text-xs px-3 py-2 text-red-600"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    )}

                    {revoked && (
                      <button
                        onClick={() => void handleDelete(share.id)}
                        className="btn-secondary w-full text-xs py-2 text-red-600"
                      >
                        <Trash2 size={12} /> Delete record
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* Privacy note */}
        <div className="card">
          <p className="text-xs text-ocean-500 flex items-start gap-2">
            <Info size={14} className="shrink-0 mt-0.5" />
            Share links use secure, unpredictable tokens. Your private account information, home address, and private notes are never included unless you explicitly select them. You can revoke or delete any link at any time.
          </p>
        </div>
      </main>
    </div>
  )
}

// ---- Toggle option component ----------------------------------------------

function ToggleOption({
  label, icon, value, onChange,
}: { label: string; icon: React.ReactNode; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-3 rounded-xl bg-sand-50 px-3 py-2.5 cursor-pointer">
      <span className="text-ocean-600">{icon}</span>
      <span className="flex-1 text-sm font-semibold text-ocean-800">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`relative h-6 w-11 rounded-full transition ${value ? 'bg-leaf-500' : 'bg-sand-300'}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${value ? 'left-5' : 'left-0.5'}`}
        />
      </button>
    </label>
  )
}

// ---- Header ---------------------------------------------------------------

function ShareHeader() {
  return (
    <header className="sticky top-0 z-30 bg-ocean-800 text-white shadow-card">
      <div className="flex items-center gap-3 px-4 py-4">
        <Link to="/" className="grid h-9 w-9 place-items-center rounded-full bg-ocean-700 hover:bg-ocean-600">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-lg font-bold">Share Trip</h1>
      </div>
    </header>
  )
}
