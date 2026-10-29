import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft, AlertTriangle, Clock, MapPin, Wallet, Bus,
  Info, Calendar, Route as RouteIcon,
} from 'lucide-react'
import { lookupSharedTrip, formatExpiry } from '../lib/shareTrip'
import type { SharedTripLookupResult } from '../lib/types'

type LoadState = 'loading' | 'ok' | 'not_found' | 'expired' | 'revoked' | 'error'

interface ItineraryContent {
  title: string
  description: string | null
  start_date: string | null
  end_date: string | null
  traveler_count: number
  starting_location: { name: string; municipality: string | null } | null
  days: {
    day_number: number
    trip_date: string | null
    stops: {
      stop_order: number
      name: string
      municipality: string | null
      is_rest_break: boolean
      planned_arrival_time: string | null
      planned_departure_time: string | null
      estimated_duration_minutes: number | null
      notes: string | null
    }[]
  }[]
  legs: {
    leg_order: number
    route_name: string | null
    transport_mode: string | null
    estimated_fare: number | null
    fare_source_status: string
    estimated_duration_minutes: number | null
  }[]
  expenses: {
    category: string
    amount: number
    description: string | null
    source_type: string
  }[]
  cost_summary: {
    transportation_total: number
    expenses_total: number
    known_total: number
    is_complete: boolean
  } | null
}

interface RouteContent {
  route_name: string
  route_code: string | null
  transport_mode: string | null
  operator_name: string | null
  origin: { name: string; municipality: string | null } | null
  destination: { name: string; municipality: string | null } | null
  estimated_duration_minutes: number | null
  verification_status: string
}

interface CostEstimateContent {
  title: string
  trip_date: string | null
  return_date: string | null
  is_round_trip: boolean
  traveler_count: number
  origin: { name: string; municipality: string | null } | null
  destination: { name: string; municipality: string | null } | null
  items: {
    description: string
    category: string
    amount: number
    line_total: number
    source_type: string
    calculation_type: string
  }[]
  cost_summary: {
    transportation_subtotal: number
    additional_expenses_subtotal: number
    known_total: number
    is_complete: boolean
  }
}

export function SharedTripViewerPage() {
  const { token } = useParams<{ token: string }>()
  const [state, setState] = useState<LoadState>('loading')
  const [data, setData] = useState<SharedTripLookupResult | null>(null)

  useEffect(() => {
    if (!token) { setState('error'); return }
    void (async () => {
      const result = await lookupSharedTrip(token)
      if (!result) { setState('error'); return }
      if (result.status === 'ok') { setData(result); setState('ok') }
      else if (result.status === 'not_found') setState('not_found')
      else if (result.status === 'expired') setState('expired')
      else if (result.status === 'revoked') setState('revoked')
      else setState('error')
    })()
  }, [token])

  if (state === 'loading') {
    return (
      <div className="app-shell">
        <ViewerHeader />
        <main className="flex-1 px-4 py-5">
          <div className="card flex items-center gap-3">
            <span className="h-3 w-3 animate-pulse rounded-full bg-ocean-400" />
            <p className="text-sm font-semibold text-ocean-700">Loading shared trip…</p>
          </div>
        </main>
      </div>
    )
  }

  if (state !== 'ok') {
    return (
      <div className="app-shell">
        <ViewerHeader />
        <main className="flex-1 px-4 py-5">
          <div className="card flex flex-col items-center gap-3 text-center">
            <AlertTriangle size={32} className={
              state === 'expired' ? 'text-terra-500'
              : state === 'revoked' ? 'text-red-500'
              : 'text-ocean-400'
            } />
            <p className="font-bold text-ocean-900">
              {state === 'not_found' && 'Link Not Found'}
              {state === 'expired' && 'Link Has Expired'}
              {state === 'revoked' && 'Link Has Been Revoked'}
              {state === 'error' && 'Unable to Load'}
            </p>
            <p className="text-sm text-ocean-600">
              {state === 'not_found' && 'This share link is invalid or does not exist.'}
              {state === 'expired' && 'The owner set an expiration date for this link, and it has passed.'}
              {state === 'revoked' && 'The owner has disabled this share link.'}
              {state === 'error' && 'Something went wrong. Please try again later.'}
            </p>
            <Link to="/" className="btn-primary w-full">Go to MoryonGo</Link>
          </div>
        </main>
      </div>
    )
  }

  const content = data?.shared_content ?? {}
  const sourceType = data?.trip_source_type

  return (
    <div className="app-shell">
      <ViewerHeader />

      <main className="flex-1 space-y-5 px-4 py-5">
        {/* Title card */}
        <section className="card space-y-2 text-center">
          <h2 className="text-xl font-bold text-ocean-900">{data?.title ?? 'Shared Trip'}</h2>
          <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-ocean-500">
            {data?.created_at && (
              <span className="flex items-center gap-1">
                <Calendar size={12} /> Shared {new Date(data.created_at).toLocaleDateString()}
              </span>
            )}
            {data?.expires_at && (
              <span className="flex items-center gap-1">
                <Clock size={12} /> Expires {formatExpiry(data.expires_at)}
              </span>
            )}
          </div>
        </section>

        {/* Render by source type */}
        {sourceType === 'itinerary' && <ItineraryView content={content as unknown as ItineraryContent} includeCosts={data?.include_costs ?? false} />}
        {sourceType === 'route' && <RouteView content={content as unknown as RouteContent} />}
        {sourceType === 'cost_estimate' && <CostEstimateView content={content as unknown as CostEstimateContent} />}

        {/* Verification notice */}
        <div className="card">
          <p className="text-xs text-ocean-500 flex items-start gap-2">
            <Info size={14} className="shrink-0 mt-0.5" />
            This is a read-only shared view. Cost estimates and fare information are labeled by source. Unverified or unavailable items are clearly marked. This information was current when the link was created but may have changed since.
          </p>
        </div>

        {/* Back to MoryonGo */}
        <Link to="/" className="btn-secondary w-full text-sm">
          Open MoryonGo
        </Link>
      </main>
    </div>
  )
}

// ---- Itinerary View -------------------------------------------------------

function ItineraryView({ content, includeCosts }: { content: ItineraryContent; includeCosts: boolean }) {
  return (
    <>
      {/* Trip info */}
      <section className="card space-y-2">
        <h3 className="section-title flex items-center gap-2"><Info size={16} /> Trip Overview</h3>
        {content.starting_location && (
          <DetailRow label="Starting from" value={`${content.starting_location.name}${content.starting_location.municipality ? ', ' + content.starting_location.municipality : ''}`} />
        )}
        <DetailRow label="Dates" value={
          content.start_date && content.end_date
            ? `${content.start_date} to ${content.end_date}`
            : content.start_date ?? 'Not set'
        } />
        <DetailRow label="Travelers" value={String(content.traveler_count)} />
        {content.description && <p className="text-sm text-ocean-600 mt-1">{content.description}</p>}
      </section>

      {/* Days & stops */}
      {content.days.length > 0 && (
        <section className="card space-y-3">
          <h3 className="section-title flex items-center gap-2"><MapPin size={16} /> Itinerary</h3>
          {content.days.map((day) => (
            <div key={day.day_number} className="space-y-2">
              <p className="text-sm font-bold text-ocean-800">
                Day {day.day_number}{day.trip_date ? ` · ${day.trip_date}` : ''}
              </p>
              <div className="space-y-1.5">
                {day.stops.map((stop, idx) => (
                  <div key={idx} className="rounded-xl bg-sand-50 px-3 py-2">
                    <div className="flex items-center justify-between">
                      <span className={`text-sm font-semibold ${stop.is_rest_break ? 'text-ocean-400 italic' : 'text-ocean-900'}`}>
                        {stop.is_rest_break ? '☕ Rest break' : stop.name}
                      </span>
                      {stop.planned_arrival_time && (
                        <span className="text-xs text-ocean-500">{stop.planned_arrival_time}</span>
                      )}
                    </div>
                    {stop.municipality && (
                      <p className="text-xs text-ocean-500">{stop.municipality}</p>
                    )}
                    {stop.notes && (
                      <p className="text-xs text-ocean-600 mt-1 italic">{stop.notes}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Transport legs */}
      {content.legs.length > 0 && (
        <section className="card space-y-3">
          <h3 className="section-title flex items-center gap-2"><Bus size={16} /> Transportation</h3>
          <div className="space-y-2">
            {content.legs.map((leg, idx) => (
              <div key={idx} className="rounded-xl border border-sand-200 bg-sand-50 p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-ocean-900">
                    {leg.transport_mode ?? 'Transport'}
                  </span>
                  {leg.estimated_fare != null ? (
                    <span className="text-sm font-bold text-ocean-900">₱{leg.estimated_fare.toFixed(2)}</span>
                  ) : (
                    <span className="pill text-[10px] bg-sand-200 text-ocean-500">Fare unavailable</span>
                  )}
                </div>
                {leg.route_name && <p className="text-xs text-ocean-600">{leg.route_name}</p>}
                <div className="flex gap-3 text-xs text-ocean-500">
                  {leg.estimated_duration_minutes != null && <span>~{leg.estimated_duration_minutes} min</span>}
                  <span className="capitalize">{leg.fare_source_status.replace(/_/g, ' ')}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Cost summary */}
      {includeCosts && content.cost_summary && (
        <section className="card space-y-2">
          <h3 className="section-title flex items-center gap-2"><Wallet size={16} /> Cost Summary</h3>
          <DetailRow label="Transportation" value={`₱${content.cost_summary.transportation_total.toFixed(2)}`} />
          <DetailRow label="Other expenses" value={`₱${content.cost_summary.expenses_total.toFixed(2)}`} />
          <div className="border-t border-sand-200 pt-2 flex justify-between">
            <span className="font-bold text-ocean-900">Known Total</span>
            <span className="font-bold text-lg text-ocean-900">₱{content.cost_summary.known_total.toFixed(2)}</span>
          </div>
          {!content.cost_summary.is_complete && (
            <p className="text-xs text-terra-600 flex items-center gap-1">
              <AlertTriangle size={12} /> Some costs could not be determined and are excluded from the total.
            </p>
          )}
        </section>
      )}
    </>
  )
}

// ---- Route View -----------------------------------------------------------

function RouteView({ content }: { content: RouteContent }) {
  return (
    <section className="card space-y-3">
      <h3 className="section-title flex items-center gap-2"><RouteIcon size={16} /> Route Details</h3>
      <DetailRow label="Route" value={content.route_name} />
      {content.route_code && <DetailRow label="Code" value={content.route_code} />}
      {content.transport_mode && <DetailRow label="Transport" value={content.transport_mode} />}
      {content.operator_name && <DetailRow label="Operator" value={content.operator_name} />}
      {content.origin && <DetailRow label="From" value={`${content.origin.name}${content.origin.municipality ? ', ' + content.origin.municipality : ''}`} />}
      {content.destination && <DetailRow label="To" value={`${content.destination.name}${content.destination.municipality ? ', ' + content.destination.municipality : ''}`} />}
      {content.estimated_duration_minutes != null && <DetailRow label="Est. duration" value={`~${content.estimated_duration_minutes} minutes`} />}
      <div>
        <span className={`pill text-[10px] ${
          content.verification_status === 'official' || content.verification_status === 'verified'
            ? 'bg-leaf-100 text-leaf-700'
            : 'bg-sand-200 text-ocean-600'
        }`}>
          {content.verification_status === 'official' ? 'Official' :
           content.verification_status === 'verified' ? 'Verified' :
           content.verification_status === 'community' ? 'Community-submitted' :
           content.verification_status}
        </span>
      </div>
    </section>
  )
}

// ---- Cost Estimate View ---------------------------------------------------

function CostEstimateView({ content }: { content: CostEstimateContent }) {
  return (
    <>
      <section className="card space-y-2">
        <h3 className="section-title flex items-center gap-2"><Info size={16} /> Trip Overview</h3>
        {content.origin && <DetailRow label="From" value={content.origin.name} />}
        {content.destination && <DetailRow label="To" value={content.destination.name} />}
        {content.trip_date && <DetailRow label="Date" value={content.trip_date} />}
        <DetailRow label="Travelers" value={String(content.traveler_count)} />
        <DetailRow label="Trip type" value={content.is_round_trip ? 'Round trip' : 'One way'} />
      </section>

      {content.items.length > 0 && (
        <section className="card space-y-3">
          <h3 className="section-title flex items-center gap-2"><Wallet size={16} /> Cost Breakdown</h3>
          <div className="space-y-2">
            {content.items.map((item, idx) => (
              <div key={idx} className="rounded-xl border border-sand-200 bg-sand-50 p-3 space-y-1">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-semibold text-ocean-900">{item.description}</p>
                    <p className="text-xs text-ocean-500 capitalize">{item.category.replace(/_/g, ' ')}</p>
                  </div>
                  <span className="text-sm font-bold text-ocean-900">₱{item.line_total.toFixed(2)}</span>
                </div>
                <span className={`pill text-[10px] ${
                  item.source_type === 'verified' ? 'bg-leaf-100 text-leaf-700'
                  : item.source_type === 'calculated_estimate' ? 'bg-ocean-100 text-ocean-800'
                  : item.source_type === 'unavailable' ? 'bg-red-100 text-red-700'
                  : 'bg-sand-200 text-ocean-600'
                }`}>
                  {item.source_type.replace(/_/g, ' ')}
                </span>
              </div>
            ))}
          </div>
          <div className="border-t border-sand-200 pt-2 space-y-1">
            <DetailRow label="Transportation subtotal" value={`₱${content.cost_summary.transportation_subtotal.toFixed(2)}`} />
            <DetailRow label="Additional expenses" value={`₱${content.cost_summary.additional_expenses_subtotal.toFixed(2)}`} />
            <div className="flex justify-between font-bold text-ocean-900">
              <span>Known Total</span>
              <span className="text-lg">₱{content.cost_summary.known_total.toFixed(2)}</span>
            </div>
            {!content.cost_summary.is_complete && (
              <p className="text-xs text-terra-600 flex items-center gap-1 mt-1">
                <AlertTriangle size={12} /> Some costs could not be determined and are excluded.
              </p>
            )}
          </div>
        </section>
      )}
    </>
  )
}

// ---- Shared components ----------------------------------------------------

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-ocean-600">{label}</span>
      <span className="font-semibold text-ocean-900">{value}</span>
    </div>
  )
}

function ViewerHeader() {
  return (
    <header className="sticky top-0 z-30 bg-ocean-800 text-white shadow-card">
      <div className="flex items-center gap-3 px-4 py-4">
        <Link to="/" className="grid h-9 w-9 place-items-center rounded-full bg-ocean-700 hover:bg-ocean-600">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-lg font-bold">Shared Trip</h1>
      </div>
    </header>
  )
}
