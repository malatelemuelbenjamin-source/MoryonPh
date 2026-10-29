import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  Route as RouteIcon,
  MapPin,
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
  createFareConcern,
  uploadFareConcernPhoto,
  validateImageFile,
  categoryLabel,
  PASSENGER_CATEGORY_LABELS,
} from '../lib/fareConcerns'
import type {
  FareConcernCategory,
  FareConcernPassengerCategory,
  TransportModeRow,
} from '../lib/types'

interface PendingPhoto {
  file: File
  previewUrl: string
}

export function FareConcernSubmitPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [category, setCategory] = useState<FareConcernCategory | ''>('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [municipality, setMunicipality] = useState('')
  const [transportModeId, setTransportModeId] = useState('')
  const [routeQuery, setRouteQuery] = useState('')
  const [routeId, setRouteId] = useState<string | null>(null)
  const [routeName, setRouteName] = useState('')
  const [boardingQuery, setBoardingQuery] = useState('')
  const [boardingLocationId, setBoardingLocationId] = useState<string | null>(null)
  const [boardingName, setBoardingName] = useState('')
  const [destQuery, setDestQuery] = useState('')
  const [destinationLocationId, setDestinationLocationId] = useState<string | null>(null)
  const [destinationName, setDestinationName] = useState('')
  const [incidentAt, setIncidentAt] = useState('')
  const [amountCharged, setAmountCharged] = useState('')
  const [expectedFare, setExpectedFare] = useState('')
  const [passengerCategory, setPassengerCategory] = useState<FareConcernPassengerCategory | ''>('')
  const [photos, setPhotos] = useState<PendingPhoto[]>([])

  const [transportModes, setTransportModes] = useState<TransportModeRow[]>([])
  const [routeResults, setRouteResults] = useState<{ id: string; route_name: string; route_code: string | null }[]>([])
  const [boardingResults, setBoardingResults] = useState<{ id: string; name: string; municipality: string | null }[]>([])
  const [destResults, setDestResults] = useState<{ id: string; name: string; municipality: string | null }[]>([])

  const [showConfirm, setShowConfirm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [successId, setSuccessId] = useState<string | null>(null)
  const [successRef, setSuccessRef] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      const modes = await fetchTransportModes()
      setTransportModes(modes)

      const prefilledRouteId = searchParams.get('route_id')
      const prefilledRouteName = searchParams.get('route_name')
      const prefilledModeId = searchParams.get('transport_mode_id')
      const prefilledMunicipality = searchParams.get('municipality')
      const prefilledExpectedFare = searchParams.get('expected_fare')

      if (prefilledRouteId && prefilledRouteName) {
        setRouteId(prefilledRouteId)
        setRouteName(prefilledRouteName)
      }
      if (prefilledModeId) setTransportModeId(prefilledModeId)
      if (prefilledMunicipality && MUNICIPALITIES.includes(prefilledMunicipality as typeof MUNICIPALITIES[number])) {
        setMunicipality(prefilledMunicipality)
      }
      if (prefilledExpectedFare) setExpectedFare(prefilledExpectedFare)
    })()
  }, [searchParams])

  useEffect(() => {
    if (!routeQuery.trim() || routeId) { setRouteResults([]); return }
    const timer = setTimeout(() => {
      void (async () => setRouteResults(await searchRoutes(routeQuery)))()
    }, 300)
    return () => clearTimeout(timer)
  }, [routeQuery, routeId])

  useEffect(() => {
    if (!boardingQuery.trim() || boardingLocationId) { setBoardingResults([]); return }
    const timer = setTimeout(() => {
      void (async () => setBoardingResults(await searchLocations(boardingQuery)))()
    }, 300)
    return () => clearTimeout(timer)
  }, [boardingQuery, boardingLocationId])

  useEffect(() => {
    if (!destQuery.trim() || destinationLocationId) { setDestResults([]); return }
    const timer = setTimeout(() => {
      void (async () => setDestResults(await searchLocations(destQuery)))()
    }, 300)
    return () => clearTimeout(timer)
  }, [destQuery, destinationLocationId])

  const canSubmit = useMemo(() => {
    return !!category && title.trim().length >= 3 && description.trim().length >= 10 && !!municipality
  }, [category, title, description, municipality])

  if (!user) {
    return (
      <div className="app-shell">
        <Header />
        <main className="flex-1 px-4 py-6">
          <div className="card flex flex-col items-center gap-4 text-center">
            <p className="text-base font-semibold text-ocean-900">Sign in to submit a fare concern</p>
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
      if (err) { setError(err); continue }
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

    const charged = amountCharged ? parseFloat(amountCharged) : null
    const expected = expectedFare ? parseFloat(expectedFare) : null
    if ((charged !== null && isNaN(charged)) || (expected !== null && isNaN(expected))) {
      setError('Fare amounts must be valid numbers.')
      setSubmitting(false)
      return
    }

    const { success, id, reportReference, error: createError } = await createFareConcern({
      category: category as FareConcernCategory,
      title,
      description,
      municipality,
      route_id: routeId,
      transport_mode_id: transportModeId || null,
      boarding_location_id: boardingLocationId,
      destination_location_id: destinationLocationId,
      incident_at: incidentAt ? new Date(incidentAt).toISOString() : null,
      amount_charged: charged,
      expected_fare_amount: expected,
      passenger_category: (passengerCategory || null) as FareConcernPassengerCategory | null,
    })

    if (!success || !id) {
      setError(createError ?? 'Failed to submit fare concern.')
      setSubmitting(false)
      return
    }

    if (photos.length > 0) {
      setUploadProgress(10)
      for (let i = 0; i < photos.length; i++) {
        const pct = 10 + Math.round(((i + 1) / photos.length) * 80)
        const { error: uploadError } = await uploadFareConcernPhoto(id, photos[i].file, (p) => setUploadProgress(pct - 10 + Math.round(p * 0.1)))
        if (uploadError) {
          setError(`Report submitted, but photo ${i + 1} failed to upload: ${uploadError}`)
          break
        }
      }
      setUploadProgress(100)
    }

    photos.forEach((p) => URL.revokeObjectURL(p.previewUrl))
    setSubmitting(false)
    setSuccessId(id)
    setSuccessRef(reportReference ?? null)
  }

  if (successId) {
    return (
      <div className="app-shell">
        <Header />
        <main className="flex-1 px-4 py-6">
          <div className="card flex flex-col items-center gap-4 text-center">
            <span className="grid h-16 w-16 place-items-center rounded-full bg-leaf-100 text-leaf-700">
              <CheckCircle2 size={32} />
            </span>
            <div>
              <p className="text-lg font-bold text-ocean-900">Your fare concern was submitted</p>
              <p className="mt-1 text-sm text-ocean-700">
                Reference: <span className="font-mono font-semibold">{successRef ?? successId.slice(0, 8).toUpperCase()}</span>
              </p>
            </div>
            <p className="text-sm text-ocean-700">
              Your report is now in <span className="font-semibold">Submitted</span> status. An authorized
              reviewer will investigate the concern. You can track its status in My Fare Reports.
            </p>
            <div className="flex w-full flex-col gap-2">
              <button type="button" onClick={() => navigate(`/fare-concerns/${successId}`)} className="btn-primary w-full">
                View My Report
              </button>
              <button type="button" onClick={() => navigate('/fare-concerns')} className="btn-secondary w-full">
                Back to Fare Concerns
              </button>
            </div>
          </div>
        </main>
      </div>
    )
  }

  if (showConfirm) {
    return (
      <div className="app-shell">
        <Header />
        <main className="flex-1 space-y-4 px-4 py-5">
          <div className="card space-y-3">
            <h2 className="text-base font-bold text-ocean-900">Review Your Fare Concern</h2>
            <SummaryRow label="Category" value={category ? categoryLabel(category as FareConcernCategory) : ''} />
            <SummaryRow label="Title" value={title} />
            <SummaryRow label="Municipality" value={municipality} />
            {transportModeId && <SummaryRow label="Transport Mode" value={transportModes.find((m) => m.id === transportModeId)?.name ?? ''} />}
            {routeName && <SummaryRow label="Related Route" value={routeName} />}
            {boardingName && <SummaryRow label="Boarding Location" value={boardingName} />}
            {destinationName && <SummaryRow label="Destination" value={destinationName} />}
            {incidentAt && <SummaryRow label="Incident Date/Time" value={new Date(incidentAt).toLocaleString()} />}
            {amountCharged && <SummaryRow label="Amount Charged" value={`₱${amountCharged}`} />}
            {expectedFare && <SummaryRow label="Expected Fare" value={`₱${expectedFare}`} />}
            {passengerCategory && <SummaryRow label="Passenger Category" value={PASSENGER_CATEGORY_LABELS[passengerCategory as FareConcernPassengerCategory] ?? ''} />}
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
              This is an allegation, not a confirmed violation. Your report will be
              reviewed by authorized personnel before any action is taken.
            </p>
          </div>

          {error && (
            <div className="card flex items-start gap-2 border-l-4 border-red-400">
              <AlertTriangle size={18} className="mt-0.5 shrink-0 text-red-600" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div className="flex gap-2">
            <button type="button" onClick={() => setShowConfirm(false)} className="btn-secondary flex-1" disabled={submitting}>Edit</button>
            <button type="button" onClick={handleSubmit} className="btn-primary flex-1" disabled={submitting}>
              {submitting ? (
                <><Loader2 size={18} className="animate-spin" />{uploadProgress > 0 ? `Uploading… ${uploadProgress}%` : 'Submitting…'}</>
              ) : 'Confirm & Submit'}
            </button>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <Header />
      <main className="flex-1 space-y-4 px-4 py-5">
        {/* Emergency notice */}
        <div className="flex items-start gap-2 rounded-xl bg-sand-100 px-3 py-2.5">
          <ShieldAlert size={16} className="mt-0.5 shrink-0 text-terra-600" />
          <p className="text-xs text-terra-800">
            A fare concern is an allegation, not a confirmed violation. Reports are
            reviewed by authorized personnel. Reporter identity is kept private.
          </p>
        </div>

        {/* Category selector */}
        <section className="card space-y-3">
          <div>
            <p className="mb-1 text-sm font-semibold text-ocean-900">Report Category <span className="text-red-500">*</span></p>
            <p className="text-xs text-ocean-600">Select the type of fare concern.</p>
          </div>
          <div className="grid grid-cols-1 gap-2">
            {CATEGORY_ORDER.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                className={`flex items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold transition active:scale-[0.98] ${
                  category === cat ? 'bg-ocean-700 text-white' : 'bg-ocean-50 text-ocean-800 hover:bg-ocean-100'
                }`}
              >
                <CategoryIcon category={cat} />
                {CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>
          <p className="text-xs text-ocean-600">
            Note: Do not assume a fare is unlawful simply because it differs from an older listing.
            Fare rules may change.
          </p>
        </section>

        {/* Title */}
        <section className="card space-y-2">
          <label htmlFor="fc-title" className="text-sm font-semibold text-ocean-900">Report Title <span className="text-red-500">*</span></label>
          <input id="fc-title" type="text" value={title} onChange={(e) => setTitle(e.target.value.slice(0, 120))}
            placeholder="Brief summary of the fare concern"
            className="w-full rounded-xl bg-ocean-50 px-3 py-2.5 text-sm text-ocean-900 placeholder:text-ocean-400 focus:outline-none focus:ring-2 focus:ring-ocean-400" />
          <p className="text-right text-xs text-ocean-400">{title.length}/120</p>
        </section>

        {/* Description */}
        <section className="card space-y-2">
          <label htmlFor="fc-desc" className="text-sm font-semibold text-ocean-900">Description <span className="text-red-500">*</span></label>
          <textarea id="fc-desc" value={description} onChange={(e) => setDescription(e.target.value.slice(0, 4000))}
            placeholder="Describe the fare concern in detail. Include the route, time, and what happened."
            rows={5}
            className="w-full rounded-xl bg-ocean-50 px-3 py-2.5 text-sm text-ocean-900 placeholder:text-ocean-400 focus:outline-none focus:ring-2 focus:ring-ocean-400" />
          <p className="text-right text-xs text-ocean-400">{description.length}/4000</p>
        </section>

        {/* Municipality */}
        <section className="card space-y-2">
          <label htmlFor="fc-muni" className="text-sm font-semibold text-ocean-900">Municipality <span className="text-red-500">*</span></label>
          <select id="fc-muni" value={municipality} onChange={(e) => setMunicipality(e.target.value)}
            className="w-full appearance-none rounded-xl bg-ocean-50 px-3 py-2.5 text-sm text-ocean-900 focus:outline-none focus:ring-2 focus:ring-ocean-400">
            <option value="">Select municipality</option>
            {MUNICIPALITIES.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </section>

        {/* Transport mode */}
        <section className="card space-y-2">
          <label htmlFor="fc-mode" className="text-sm font-semibold text-ocean-900">Transport Mode <span className="text-xs font-normal text-ocean-400">(optional)</span></label>
          <select id="fc-mode" value={transportModeId} onChange={(e) => setTransportModeId(e.target.value)}
            className="w-full appearance-none rounded-xl bg-ocean-50 px-3 py-2.5 text-sm text-ocean-900 focus:outline-none focus:ring-2 focus:ring-ocean-400">
            <option value="">None</option>
            {transportModes.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </section>

        {/* Related route search */}
        <section className="card space-y-2">
          <label htmlFor="fc-route" className="text-sm font-semibold text-ocean-900">Related Route <span className="text-xs font-normal text-ocean-400">(optional)</span></label>
          {routeId && routeName ? (
            <div className="flex items-center gap-2 rounded-xl bg-leaf-50 px-3 py-2.5">
              <RouteIcon size={16} className="text-leaf-700" />
              <span className="flex-1 text-sm font-semibold text-leaf-800">{routeName}</span>
              <button type="button" onClick={() => { setRouteId(null); setRouteName(''); setRouteQuery('') }} className="text-leaf-600 hover:text-leaf-800"><X size={16} /></button>
            </div>
          ) : (
            <>
              <input id="fc-route" type="text" value={routeQuery} onChange={(e) => setRouteQuery(e.target.value)}
                placeholder="Search verified routes"
                className="w-full rounded-xl bg-ocean-50 px-3 py-2.5 text-sm text-ocean-900 placeholder:text-ocean-400 focus:outline-none focus:ring-2 focus:ring-ocean-400" />
              {routeResults.length > 0 && (
                <div className="space-y-1">
                  {routeResults.map((r) => (
                    <button key={r.id} type="button"
                      onClick={() => { setRouteId(r.id); setRouteName(r.route_name); setRouteQuery(''); setRouteResults([]) }}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-ocean-800 hover:bg-ocean-50">
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

        {/* Boarding location */}
        <section className="card space-y-2">
          <label htmlFor="fc-board" className="text-sm font-semibold text-ocean-900">Boarding Location <span className="text-xs font-normal text-ocean-400">(optional)</span></label>
          {boardingLocationId && boardingName ? (
            <div className="flex items-center gap-2 rounded-xl bg-leaf-50 px-3 py-2.5">
              <MapPin size={16} className="text-leaf-700" />
              <span className="flex-1 text-sm font-semibold text-leaf-800">{boardingName}</span>
              <button type="button" onClick={() => { setBoardingLocationId(null); setBoardingName(''); setBoardingQuery('') }} className="text-leaf-600 hover:text-leaf-800"><X size={16} /></button>
            </div>
          ) : (
            <>
              <input id="fc-board" type="text" value={boardingQuery} onChange={(e) => setBoardingQuery(e.target.value)}
                placeholder="Search boarding location"
                className="w-full rounded-xl bg-ocean-50 px-3 py-2.5 text-sm text-ocean-900 placeholder:text-ocean-400 focus:outline-none focus:ring-2 focus:ring-ocean-400" />
              {boardingResults.length > 0 && (
                <div className="space-y-1">
                  {boardingResults.map((loc) => (
                    <button key={loc.id} type="button"
                      onClick={() => { setBoardingLocationId(loc.id); setBoardingName(loc.name); setBoardingQuery(''); setBoardingResults([]) }}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-ocean-800 hover:bg-ocean-50">
                      <MapPin size={14} className="text-ocean-500" />
                      <span>{loc.name}</span>
                      {loc.municipality && <span className="text-xs text-ocean-400">{loc.municipality}</span>}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </section>

        {/* Destination */}
        <section className="card space-y-2">
          <label htmlFor="fc-dest" className="text-sm font-semibold text-ocean-900">Destination <span className="text-xs font-normal text-ocean-400">(optional)</span></label>
          {destinationLocationId && destinationName ? (
            <div className="flex items-center gap-2 rounded-xl bg-leaf-50 px-3 py-2.5">
              <MapPin size={16} className="text-leaf-700" />
              <span className="flex-1 text-sm font-semibold text-leaf-800">{destinationName}</span>
              <button type="button" onClick={() => { setDestinationLocationId(null); setDestinationName(''); setDestQuery('') }} className="text-leaf-600 hover:text-leaf-800"><X size={16} /></button>
            </div>
          ) : (
            <>
              <input id="fc-dest" type="text" value={destQuery} onChange={(e) => setDestQuery(e.target.value)}
                placeholder="Search destination location"
                className="w-full rounded-xl bg-ocean-50 px-3 py-2.5 text-sm text-ocean-900 placeholder:text-ocean-400 focus:outline-none focus:ring-2 focus:ring-ocean-400" />
              {destResults.length > 0 && (
                <div className="space-y-1">
                  {destResults.map((loc) => (
                    <button key={loc.id} type="button"
                      onClick={() => { setDestinationLocationId(loc.id); setDestinationName(loc.name); setDestQuery(''); setDestResults([]) }}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-ocean-800 hover:bg-ocean-50">
                      <MapPin size={14} className="text-ocean-500" />
                      <span>{loc.name}</span>
                      {loc.municipality && <span className="text-xs text-ocean-400">{loc.municipality}</span>}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </section>

        {/* Incident date/time */}
        <section className="card space-y-2">
          <label htmlFor="fc-incident" className="text-sm font-semibold text-ocean-900">Date &amp; Time of Incident <span className="text-xs font-normal text-ocean-400">(optional)</span></label>
          <div className="relative">
            <Calendar size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ocean-400" />
            <input id="fc-incident" type="datetime-local" value={incidentAt} onChange={(e) => setIncidentAt(e.target.value)}
              className="w-full appearance-none rounded-xl bg-ocean-50 px-3 py-2.5 pl-9 text-sm text-ocean-900 focus:outline-none focus:ring-2 focus:ring-ocean-400" />
          </div>
        </section>

        {/* Amount charged and expected fare */}
        <section className="card space-y-3">
          <p className="text-sm font-semibold text-ocean-900">Fare Amounts <span className="text-xs font-normal text-ocean-400">(optional)</span></p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="fc-charged" className="text-xs text-ocean-600">Amount Charged (₱)</label>
              <input id="fc-charged" type="text" inputMode="decimal" value={amountCharged} onChange={(e) => setAmountCharged(e.target.value)}
                placeholder="e.g. 50"
                className="w-full rounded-xl bg-ocean-50 px-3 py-2.5 text-sm text-ocean-900 placeholder:text-ocean-400 focus:outline-none focus:ring-2 focus:ring-ocean-400" />
            </div>
            <div>
              <label htmlFor="fc-expected" className="text-xs text-ocean-600">Expected Fare (₱)</label>
              <input id="fc-expected" type="text" inputMode="decimal" value={expectedFare} onChange={(e) => setExpectedFare(e.target.value)}
                placeholder="e.g. 40"
                className="w-full rounded-xl bg-ocean-50 px-3 py-2.5 text-sm text-ocean-900 placeholder:text-ocean-400 focus:outline-none focus:ring-2 focus:ring-ocean-400" />
            </div>
          </div>
          <p className="text-xs text-ocean-500">Only provide amounts you actually encountered. Do not guess expected fares.</p>
        </section>

        {/* Passenger category */}
        <section className="card space-y-2">
          <label htmlFor="fc-passenger" className="text-sm font-semibold text-ocean-900">Passenger Category <span className="text-xs font-normal text-ocean-400">(optional)</span></label>
          <select id="fc-passenger" value={passengerCategory} onChange={(e) => setPassengerCategory(e.target.value as FareConcernPassengerCategory | '')}
            className="w-full appearance-none rounded-xl bg-ocean-50 px-3 py-2.5 text-sm text-ocean-900 focus:outline-none focus:ring-2 focus:ring-ocean-400">
            <option value="">None</option>
            {(['regular','student','senior','pwd'] as FareConcernPassengerCategory[]).map((p) => (
              <option key={p} value={p}>{PASSENGER_CATEGORY_LABELS[p]}</option>
            ))}
          </select>
        </section>

        {/* Photo evidence */}
        <section className="card space-y-3">
          <div className="flex items-center gap-2">
            <Camera size={18} className="text-ocean-600" />
            <p className="text-sm font-semibold text-ocean-900">Supporting Photo <span className="text-xs font-normal text-ocean-400">(optional)</span></p>
          </div>
          <p className="text-xs text-ocean-600">JPEG, PNG, or WebP. Max 10 MB each. Up to 5 photos. Do not upload government IDs.</p>
          {photos.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {photos.map((p, i) => (
                <div key={i} className="relative">
                  <img src={p.previewUrl} alt={`Evidence ${i + 1}`} className="h-20 w-20 rounded-lg object-cover" />
                  <button type="button" onClick={() => removePhoto(i)}
                    className="absolute -right-1 -top-1 grid h-6 w-6 place-items-center rounded-full bg-red-500 text-white shadow">
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
          {photos.length < 5 && (
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-ocean-200 px-3 py-4 text-sm text-ocean-600 hover:bg-ocean-50">
              <ImageIcon size={18} /> Add Photo
              <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden"
                onChange={(e) => e.target.files && handleAddPhotos(e.target.files)} />
            </label>
          )}
        </section>

        {error && (
          <div className="card flex items-start gap-2 border-l-4 border-red-400">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-red-600" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <div className="flex gap-2">
          <Link to="/fare-concerns" className="btn-secondary flex-1">Cancel</Link>
          <button type="button" onClick={() => { setError(null); setShowConfirm(true) }}
            className="btn-primary flex-1" disabled={!canSubmit}>
            Review &amp; Submit
          </button>
        </div>
      </main>
    </div>
  )
}

function Header() {
  return (
    <header className="sticky top-0 z-30 bg-ocean-800 text-white shadow-card">
      <div className="flex items-center gap-3 px-4 py-4">
        <Link to="/fare-concerns" className="grid h-9 w-9 place-items-center rounded-full bg-ocean-700 hover:bg-ocean-600">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-lg font-bold">Submit Fare Concern</h1>
      </div>
    </header>
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

function CategoryIcon({ category }: { category: FareConcernCategory }) {
  const icons: Record<FareConcernCategory, string> = {
    suspected_overcharging: '⚠️',
    fare_differs_from_matrix: '📋',
    student_discount_concern: '🎓',
    senior_discount_concern: '👴',
    pwd_discount_concern: '♿',
    fare_calculation_concern: '🧮',
    inconsistent_fare_collection: '🔄',
    unclear_or_unposted_fare: '❓',
    additional_fare_or_surcharge: '➕',
    other_fare_concern: '📝',
  }
  return <span className="text-lg">{icons[category]}</span>
}
