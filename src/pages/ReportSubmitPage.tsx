import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  Route as RouteIcon,
  MapPin,
  Building2,
  Calendar,
  Camera,
  X,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ShieldAlert,
  Image as ImageIcon,
} from 'lucide-react'
import { useAuth } from '../lib/auth'
import {
  MUNICIPALITIES,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  fetchTransportModes,
  searchLocations,
  searchRoutes,
  createReport,
  uploadReportPhoto,
  validateImageFile,
  categoryLabel,
} from '../lib/communityReports'
import type {
  CommunityReportCategory,
  TransportModeRow,
} from '../lib/types'

interface PendingPhoto {
  file: File
  previewUrl: string
}

export function ReportSubmitPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  // Form state
  const [category, setCategory] = useState<CommunityReportCategory | ''>('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [municipality, setMunicipality] = useState('')
  const [transportModeId, setTransportModeId] = useState('')
  const [locationQuery, setLocationQuery] = useState('')
  const [locationId, setLocationId] = useState<string | null>(null)
  const [locationName, setLocationName] = useState('')
  const [routeQuery, setRouteQuery] = useState('')
  const [routeId, setRouteId] = useState<string | null>(null)
  const [routeName, setRouteName] = useState('')
  const [latitude, setLatitude] = useState('')
  const [longitude, setLongitude] = useState('')
  const [observedAt, setObservedAt] = useState('')
  const [urgency, setUrgency] = useState('')
  const [followupPref, setFollowupPref] = useState('')
  const [photos, setPhotos] = useState<PendingPhoto[]>([])

  // UI state
  const [transportModes, setTransportModes] = useState<TransportModeRow[]>([])
  const [locationResults, setLocationResults] = useState<{ id: string; name: string; municipality: string | null }[]>([])
  const [routeResults, setRouteResults] = useState<{ id: string; route_name: string; route_code: string | null }[]>([])
  const [showConfirm, setShowConfirm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [successId, setSuccessId] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      const modes = await fetchTransportModes()
      setTransportModes(modes)

      // Prefill from query params (coming from route/map screens)
      const prefilledRouteId = searchParams.get('route_id')
      const prefilledRouteName = searchParams.get('route_name')
      const prefilledLocationId = searchParams.get('location_id')
      const prefilledLocationName = searchParams.get('location_name')
      const prefilledModeId = searchParams.get('transport_mode_id')
      const prefilledMunicipality = searchParams.get('municipality')

      if (prefilledRouteId && prefilledRouteName) {
        setRouteId(prefilledRouteId)
        setRouteName(prefilledRouteName)
      }
      if (prefilledLocationId && prefilledLocationName) {
        setLocationId(prefilledLocationId)
        setLocationName(prefilledLocationName)
      }
      if (prefilledModeId) setTransportModeId(prefilledModeId)
      if (prefilledMunicipality && MUNICIPALITIES.includes(prefilledMunicipality as typeof MUNICIPALITIES[number])) {
        setMunicipality(prefilledMunicipality)
      }
    })()
  }, [searchParams])

  // Location search
  useEffect(() => {
    if (!locationQuery.trim() || locationId) {
      setLocationResults([])
      return
    }
    const timer = setTimeout(() => {
      void (async () => {
        const results = await searchLocations(locationQuery)
        setLocationResults(results)
      })()
    }, 300)
    return () => clearTimeout(timer)
  }, [locationQuery, locationId])

  // Route search
  useEffect(() => {
    if (!routeQuery.trim() || routeId) {
      setRouteResults([])
      return
    }
    const timer = setTimeout(() => {
      void (async () => {
        const results = await searchRoutes(routeQuery)
        setRouteResults(results)
      })()
    }, 300)
    return () => clearTimeout(timer)
  }, [routeQuery, routeId])

  const canSubmit = useMemo(() => {
    return (
      !!category &&
      title.trim().length >= 3 &&
      description.trim().length >= 10 &&
      !!municipality
    )
  }, [category, title, description, municipality])

  if (!user) {
    return (
      <div className="app-shell">
        <header className="sticky top-0 z-30 bg-ocean-800 text-white shadow-card">
          <div className="flex items-center gap-3 px-4 py-4">
            <Link to="/community-reports" className="grid h-9 w-9 place-items-center rounded-full bg-ocean-700 hover:bg-ocean-600">
              <ArrowLeft size={18} />
            </Link>
            <h1 className="text-lg font-bold">Submit a Report</h1>
          </div>
        </header>
        <main className="flex-1 px-4 py-6">
          <div className="card flex flex-col items-center gap-4 text-center">
            <p className="text-base font-semibold text-ocean-900">Sign in to submit a report</p>
            <Link to="/auth" className="btn-primary w-full">Sign In / Create Account</Link>
          </div>
        </main>
      </div>
    )
  }

  function handleAddPhotos(files: FileList) {
    setError(null)
    const newPhotos: PendingPhoto[] = []
    for (const file of Array.from(files)) {
      const err = validateImageFile(file)
      if (err) {
        setError(err)
        continue
      }
      newPhotos.push({ file, previewUrl: URL.createObjectURL(file) })
    }
    setPhotos((prev) => [...prev, ...newPhotos].slice(0, 5))
  }

  function removePhoto(idx: number) {
    setPhotos((prev) => {
      const photo = prev[idx]
      if (photo) URL.revokeObjectURL(photo.previewUrl)
      return prev.filter((_, i) => i !== idx)
    })
  }

  async function handleSubmit() {
    setError(null)
    setSubmitting(true)

    const lat = latitude ? parseFloat(latitude) : null
    const lng = longitude ? parseFloat(longitude) : null
    if ((lat !== null && isNaN(lat)) || (lng !== null && isNaN(lng))) {
      setError('Coordinates must be valid numbers.')
      setSubmitting(false)
      return
    }

    const { success, id, error: createError } = await createReport({
      category: category as CommunityReportCategory,
      title,
      description,
      municipality,
      location_id: locationId,
      route_id: routeId,
      transport_mode_id: transportModeId || null,
      latitude: lat,
      longitude: lng,
      observed_at: observedAt ? new Date(observedAt).toISOString() : null,
      urgency: urgency || null,
      reporter_followup_preference: followupPref || null,
    })

    if (!success || !id) {
      setError(createError ?? 'Failed to submit report. Please try again.')
      setSubmitting(false)
      return
    }

    // Upload photos
    if (photos.length > 0) {
      setUploadProgress(10)
      for (let i = 0; i < photos.length; i++) {
        const pct = 10 + Math.round(((i + 1) / photos.length) * 80)
        const { error: uploadError } = await uploadReportPhoto(id, photos[i].file, (p) => setUploadProgress(pct - 10 + Math.round(p * 0.1)))
        if (uploadError) {
          // Report was created but photo failed — still show success for the report
          setError(`Report submitted, but photo ${i + 1} failed to upload: ${uploadError}`)
          break
        }
      }
      setUploadProgress(100)
    }

    // Clean up preview URLs
    photos.forEach((p) => URL.revokeObjectURL(p.previewUrl))

    setSubmitting(false)
    setSuccessId(id)
  }

  // Success screen
  if (successId) {
    return (
      <div className="app-shell">
        <header className="sticky top-0 z-30 bg-ocean-800 text-white shadow-card">
          <div className="flex items-center gap-3 px-4 py-4">
            <Link to="/community-reports" className="grid h-9 w-9 place-items-center rounded-full bg-ocean-700 hover:bg-ocean-600">
              <ArrowLeft size={18} />
            </Link>
            <h1 className="text-lg font-bold">Report Submitted</h1>
          </div>
        </header>
        <main className="flex-1 px-4 py-6">
          <div className="card flex flex-col items-center gap-4 text-center">
            <span className="grid h-16 w-16 place-items-center rounded-full bg-leaf-100 text-leaf-700">
              <CheckCircle2 size={32} />
            </span>
            <div>
              <p className="text-lg font-bold text-ocean-900">Your report was submitted</p>
              <p className="mt-1 text-sm text-ocean-700">
                Reference: <span className="font-mono font-semibold">{successId.slice(0, 8).toUpperCase()}</span>
              </p>
            </div>
            <p className="text-sm text-ocean-700">
              Your report is now in <span className="font-semibold">Submitted</span> status. A reviewer will
              assess it before any official data is changed. You can track its status in My Reports.
            </p>
            <div className="flex w-full flex-col gap-2">
              <button
                type="button"
                onClick={() => navigate(`/community-reports/${successId}`)}
                className="btn-primary w-full"
              >
                View My Report
              </button>
              <button
                type="button"
                onClick={() => navigate('/community-reports')}
                className="btn-secondary w-full"
              >
                Back to Community Reports
              </button>
            </div>
          </div>
        </main>
      </div>
    )
  }

  // Confirmation summary
  if (showConfirm) {
    return (
      <div className="app-shell">
        <header className="sticky top-0 z-30 bg-ocean-800 text-white shadow-card">
          <div className="flex items-center gap-3 px-4 py-4">
            <button
              type="button"
              onClick={() => setShowConfirm(false)}
              className="grid h-9 w-9 place-items-center rounded-full bg-ocean-700 hover:bg-ocean-600"
            >
              <ArrowLeft size={18} />
            </button>
            <h1 className="text-lg font-bold">Review Your Report</h1>
          </div>
        </header>
        <main className="flex-1 space-y-4 px-4 py-5">
          <div className="card space-y-3">
            <h2 className="text-base font-bold text-ocean-900">Please review before submitting</h2>
            <SummaryRow label="Category" value={category ? categoryLabel(category as CommunityReportCategory) : ''} />
            <SummaryRow label="Title" value={title} />
            <SummaryRow label="Municipality" value={municipality} />
            {transportModeId && (
              <SummaryRow label="Transport Mode" value={transportModes.find((m) => m.id === transportModeId)?.name ?? ''} />
            )}
            {locationName && <SummaryRow label="Related Location" value={locationName} />}
            {routeName && <SummaryRow label="Related Route" value={routeName} />}
            {latitude && longitude && <SummaryRow label="Coordinates" value={`${latitude}, ${longitude}`} />}
            {observedAt && <SummaryRow label="Observed At" value={new Date(observedAt).toLocaleString()} />}
            {urgency && <SummaryRow label="Urgency" value={urgency} />}
            {followupPref && <SummaryRow label="Follow-up Preference" value={followupPref} />}
            <div>
              <p className="text-xs font-semibold text-ocean-600">Description</p>
              <p className="mt-1 text-sm text-ocean-900">{description}</p>
            </div>
            {photos.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-ocean-600">Photos ({photos.length})</p>
                <div className="mt-2 flex gap-2">
                  {photos.map((p, i) => (
                    <img key={i} src={p.previewUrl} alt={`Evidence ${i + 1}`} className="h-16 w-16 rounded-lg object-cover" />
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-start gap-2 rounded-xl bg-sand-100 px-3 py-2.5">
            <ShieldAlert size={16} className="mt-0.5 shrink-0 text-terra-600" />
            <p className="text-xs text-terra-800">
              This is not an emergency service. Your report will be reviewed by an authorized reviewer
              before any official data changes.
            </p>
          </div>

          {error && (
            <div className="card flex items-start gap-2 border-l-4 border-red-400">
              <AlertTriangle size={18} className="mt-0.5 shrink-0 text-red-600" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div className="flex gap-2">
            <button type="button" onClick={() => setShowConfirm(false)} className="btn-secondary flex-1" disabled={submitting}>
              Edit
            </button>
            <button type="button" onClick={handleSubmit} className="btn-primary flex-1" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  {uploadProgress > 0 ? `Uploading… ${uploadProgress}%` : 'Submitting…'}
                </>
              ) : (
                'Confirm & Submit'
              )}
            </button>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <header className="sticky top-0 z-30 bg-ocean-800 text-white shadow-card">
        <div className="flex items-center gap-3 px-4 py-4">
          <Link to="/community-reports" className="grid h-9 w-9 place-items-center rounded-full bg-ocean-700 hover:bg-ocean-600">
            <ArrowLeft size={18} />
          </Link>
          <h1 className="text-lg font-bold">Submit a Report</h1>
        </div>
      </header>

      <main className="flex-1 space-y-4 px-4 py-5">
        {/* Emergency notice */}
        <div className="flex items-start gap-2 rounded-xl bg-sand-100 px-3 py-2.5">
          <ShieldAlert size={16} className="mt-0.5 shrink-0 text-terra-600" />
          <p className="text-xs text-terra-800">
            For immediate emergencies, contact local authorities directly. This form is for
            reporting transport information issues, not emergencies.
          </p>
        </div>

        {/* Category selector */}
        <section className="card space-y-3">
          <div>
            <p className="mb-1 text-sm font-semibold text-ocean-900">
              Report Category <span className="text-red-500">*</span>
            </p>
            <p className="text-xs text-ocean-600">Select the type of issue you are reporting.</p>
          </div>
          <div className="grid grid-cols-1 gap-2">
            {CATEGORY_ORDER.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                className={`flex items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold transition active:scale-[0.98] ${
                  category === cat
                    ? 'bg-ocean-700 text-white'
                    : 'bg-ocean-50 text-ocean-800 hover:bg-ocean-100'
                }`}
              >
                <CategoryIcon category={cat} />
                {CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>
          <p className="text-xs text-ocean-600">
            Note: Fare disputes and overcharging should be reported through the Fare Concern feature.
          </p>
        </section>

        {/* Title */}
        <section className="card space-y-2">
          <label htmlFor="report-title" className="text-sm font-semibold text-ocean-900">
            Report Title <span className="text-red-500">*</span>
          </label>
          <input
            id="report-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value.slice(0, 120))}
            placeholder="Brief summary of the issue"
            className="w-full rounded-xl bg-ocean-50 px-3 py-2.5 text-sm text-ocean-900 placeholder:text-ocean-400 focus:outline-none focus:ring-2 focus:ring-ocean-400"
          />
          <p className="text-right text-xs text-ocean-400">{title.length}/120</p>
        </section>

        {/* Description */}
        <section className="card space-y-2">
          <label htmlFor="report-desc" className="text-sm font-semibold text-ocean-900">
            Description <span className="text-red-500">*</span>
          </label>
          <textarea
            id="report-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value.slice(0, 4000))}
            placeholder="Describe the issue in detail. Include relevant stops, times, or other helpful context."
            rows={5}
            className="w-full rounded-xl bg-ocean-50 px-3 py-2.5 text-sm text-ocean-900 placeholder:text-ocean-400 focus:outline-none focus:ring-2 focus:ring-ocean-400"
          />
          <p className="text-right text-xs text-ocean-400">{description.length}/4000</p>
        </section>

        {/* Municipality */}
        <section className="card space-y-2">
          <label htmlFor="report-muni" className="text-sm font-semibold text-ocean-900">
            Municipality <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <Building2 size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ocean-400" />
            <select
              id="report-muni"
              value={municipality}
              onChange={(e) => setMunicipality(e.target.value)}
              className="w-full appearance-none rounded-xl bg-ocean-50 px-3 py-2.5 pl-9 text-sm text-ocean-900 focus:outline-none focus:ring-2 focus:ring-ocean-400"
            >
              <option value="">Select municipality</option>
              {MUNICIPALITIES.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        </section>

        {/* Transport mode */}
        <section className="card space-y-2">
          <label htmlFor="report-mode" className="text-sm font-semibold text-ocean-900">
            Transport Mode <span className="text-xs font-normal text-ocean-400">(optional)</span>
          </label>
          <select
            id="report-mode"
            value={transportModeId}
            onChange={(e) => setTransportModeId(e.target.value)}
            className="w-full appearance-none rounded-xl bg-ocean-50 px-3 py-2.5 text-sm text-ocean-900 focus:outline-none focus:ring-2 focus:ring-ocean-400"
          >
            <option value="">None</option>
            {transportModes.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </section>

        {/* Related location search */}
        <section className="card space-y-2">
          <label htmlFor="report-loc" className="text-sm font-semibold text-ocean-900">
            Related Location <span className="text-xs font-normal text-ocean-400">(optional)</span>
          </label>
          {locationId && locationName ? (
            <div className="flex items-center gap-2 rounded-xl bg-leaf-50 px-3 py-2.5">
              <MapPin size={16} className="text-leaf-700" />
              <span className="flex-1 text-sm font-semibold text-leaf-800">{locationName}</span>
              <button type="button" onClick={() => { setLocationId(null); setLocationName(''); setLocationQuery('') }} className="text-leaf-600 hover:text-leaf-800">
                <X size={16} />
              </button>
            </div>
          ) : (
            <>
              <input
                id="report-loc"
                type="text"
                value={locationQuery}
                onChange={(e) => setLocationQuery(e.target.value)}
                placeholder="Search verified locations"
                className="w-full rounded-xl bg-ocean-50 px-3 py-2.5 text-sm text-ocean-900 placeholder:text-ocean-400 focus:outline-none focus:ring-2 focus:ring-ocean-400"
              />
              {locationResults.length > 0 && (
                <div className="space-y-1">
                  {locationResults.map((loc) => (
                    <button
                      key={loc.id}
                      type="button"
                      onClick={() => { setLocationId(loc.id); setLocationName(loc.name); setLocationQuery(''); setLocationResults([]) }}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-ocean-800 hover:bg-ocean-50"
                    >
                      <MapPin size={14} className="text-ocean-500" />
                      <span>{loc.name}</span>
                      {loc.municipality && <span className="text-xs text-ocean-400">{loc.municipality}</span>}
                    </button>
                  ))}
                </div>
              )}
              <p className="text-xs text-ocean-500">
                If the location is not in the verified directory, just describe it in your report above.
              </p>
            </>
          )}
        </section>

        {/* Related route search */}
        <section className="card space-y-2">
          <label htmlFor="report-route" className="text-sm font-semibold text-ocean-900">
            Related Route <span className="text-xs font-normal text-ocean-400">(optional)</span>
          </label>
          {routeId && routeName ? (
            <div className="flex items-center gap-2 rounded-xl bg-leaf-50 px-3 py-2.5">
              <RouteIcon size={16} className="text-leaf-700" />
              <span className="flex-1 text-sm font-semibold text-leaf-800">{routeName}</span>
              <button type="button" onClick={() => { setRouteId(null); setRouteName(''); setRouteQuery('') }} className="text-leaf-600 hover:text-leaf-800">
                <X size={16} />
              </button>
            </div>
          ) : (
            <>
              <input
                id="report-route"
                type="text"
                value={routeQuery}
                onChange={(e) => setRouteQuery(e.target.value)}
                placeholder="Search verified routes"
                className="w-full rounded-xl bg-ocean-50 px-3 py-2.5 text-sm text-ocean-900 placeholder:text-ocean-400 focus:outline-none focus:ring-2 focus:ring-ocean-400"
              />
              {routeResults.length > 0 && (
                <div className="space-y-1">
                  {routeResults.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => { setRouteId(r.id); setRouteName(r.route_name); setRouteQuery(''); setRouteResults([]) }}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-ocean-800 hover:bg-ocean-50"
                    >
                      <RouteIcon size={14} className="text-ocean-500" />
                      <span>{r.route_name}</span>
                      {r.route_code && <span className="text-xs text-ocean-400">{r.route_code}</span>}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </section>

        {/* Coordinates */}
        <section className="card space-y-2">
          <p className="text-sm font-semibold text-ocean-900">
            Map Coordinates <span className="text-xs font-normal text-ocean-400">(optional)</span>
          </p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="report-lat" className="text-xs text-ocean-600">Latitude</label>
              <input
                id="report-lat"
                type="text"
                inputMode="decimal"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                placeholder="e.g. 13.3622"
                className="w-full rounded-xl bg-ocean-50 px-3 py-2.5 text-sm text-ocean-900 placeholder:text-ocean-400 focus:outline-none focus:ring-2 focus:ring-ocean-400"
              />
            </div>
            <div>
              <label htmlFor="report-lng" className="text-xs text-ocean-600">Longitude</label>
              <input
                id="report-lng"
                type="text"
                inputMode="decimal"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                placeholder="e.g. 121.9381"
                className="w-full rounded-xl bg-ocean-50 px-3 py-2.5 text-sm text-ocean-900 placeholder:text-ocean-400 focus:outline-none focus:ring-2 focus:ring-ocean-400"
              />
            </div>
          </div>
          <p className="text-xs text-ocean-500">Only provide coordinates you have verified yourself.</p>
        </section>

        {/* Observed at */}
        <section className="card space-y-2">
          <label htmlFor="report-observed" className="text-sm font-semibold text-ocean-900">
            Date & Time Observed <span className="text-xs font-normal text-ocean-400">(optional)</span>
          </label>
          <div className="relative">
            <Calendar size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ocean-400" />
            <input
              id="report-observed"
              type="datetime-local"
              value={observedAt}
              onChange={(e) => setObservedAt(e.target.value)}
              className="w-full appearance-none rounded-xl bg-ocean-50 px-3 py-2.5 pl-9 text-sm text-ocean-900 focus:outline-none focus:ring-2 focus:ring-ocean-400"
            />
          </div>
        </section>

        {/* Urgency */}
        <section className="card space-y-2">
          <label htmlFor="report-urgency" className="text-sm font-semibold text-ocean-900">
            Urgency Note <span className="text-xs font-normal text-ocean-400">(optional)</span>
          </label>
          <input
            id="report-urgency"
            type="text"
            value={urgency}
            onChange={(e) => setUrgency(e.target.value.slice(0, 40))}
            placeholder="e.g. Affects daily commute"
            className="w-full rounded-xl bg-ocean-50 px-3 py-2.5 text-sm text-ocean-900 placeholder:text-ocean-400 focus:outline-none focus:ring-2 focus:ring-ocean-400"
          />
          <p className="text-xs text-ocean-500">This is your priority hint, not an official emergency designation.</p>
        </section>

        {/* Follow-up preference */}
        <section className="card space-y-2">
          <label htmlFor="report-followup" className="text-sm font-semibold text-ocean-900">
            Follow-up Preference <span className="text-xs font-normal text-ocean-400">(optional)</span>
          </label>
          <input
            id="report-followup"
            type="text"
            value={followupPref}
            onChange={(e) => setFollowupPref(e.target.value.slice(0, 200))}
            placeholder="e.g. Contact via app notifications"
            className="w-full rounded-xl bg-ocean-50 px-3 py-2.5 text-sm text-ocean-900 placeholder:text-ocean-400 focus:outline-none focus:ring-2 focus:ring-ocean-400"
          />
        </section>

        {/* Photo evidence */}
        <section className="card space-y-3">
          <div className="flex items-center gap-2">
            <Camera size={18} className="text-ocean-600" />
            <p className="text-sm font-semibold text-ocean-900">
              Photo Evidence <span className="text-xs font-normal text-ocean-400">(optional)</span>
            </p>
          </div>
          <p className="text-xs text-ocean-600">
            JPEG, PNG, or WebP. Max 10 MB each. Up to 5 photos. Do not upload government IDs or personal documents.
          </p>
          {photos.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {photos.map((p, i) => (
                <div key={i} className="relative">
                  <img src={p.previewUrl} alt={`Evidence ${i + 1}`} className="h-20 w-20 rounded-lg object-cover" />
                  <button
                    type="button"
                    onClick={() => removePhoto(i)}
                    className="absolute -right-1 -top-1 grid h-6 w-6 place-items-center rounded-full bg-red-500 text-white shadow"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
          {photos.length < 5 && (
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-ocean-200 px-3 py-4 text-sm text-ocean-600 hover:bg-ocean-50">
              <ImageIcon size={18} />
              Add Photo
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="hidden"
                onChange={(e) => e.target.files && handleAddPhotos(e.target.files)}
              />
            </label>
          )}
        </section>

        {/* Error */}
        {error && (
          <div className="card flex items-start gap-2 border-l-4 border-red-400">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-red-600" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <Link to="/community-reports" className="btn-secondary flex-1">Cancel</Link>
          <button
            type="button"
            onClick={() => { setError(null); setShowConfirm(true) }}
            className="btn-primary flex-1"
            disabled={!canSubmit}
          >
            Review & Submit
          </button>
        </div>
      </main>
    </div>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <p className="w-32 shrink-0 text-xs font-semibold text-ocean-600">{label}</p>
      <p className="flex-1 text-sm text-ocean-900">{value}</p>
    </div>
  )
}

function CategoryIcon({ category }: { category: CommunityReportCategory }) {
  const iconMap: Record<CommunityReportCategory, string> = {
    missing_route: '🛣️',
    missing_stop_or_terminal: '📍',
    incorrect_location_info: '🗺️',
    transport_service_issue: '🚌',
    missing_or_incorrect_schedule: '🕐',
    accessibility_concern: '♿',
    passenger_info_concern: 'ℹ️',
    safety_concern: '⚠️',
    other_transport_concern: '📝',
  }
  return <span className="text-lg">{iconMap[category]}</span>
}
