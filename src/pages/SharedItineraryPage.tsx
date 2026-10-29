import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft, MapPin, Calendar, Users, Clock, Luggage, Info,
  Route as RouteIcon, Wallet,
} from 'lucide-react'
import {
  fetchSharedItinerary,
  STATUS_LABELS, statusClasses,
  FARE_SOURCE_LABELS,
  formatCurrency,
  calculateTripCost,
} from '../lib/touristPlanner'
import type { TouristItineraryWithDetails } from '../lib/types'

export function SharedItineraryPage() {
  const { token } = useParams<{ token: string }>()
  const [itinerary, setItinerary] = useState<TouristItineraryWithDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    void (async () => {
      const iti = await fetchSharedItinerary(token)
      if (!iti) {
        setError('This shared itinerary is no longer available or the link is invalid.')
      } else {
        setItinerary(iti)
      }
      setLoading(false)
    })()
  }, [token])

  if (loading) {
    return (
      <div className="app-shell">
        <header className="sticky top-0 z-30 bg-ocean-800 text-white shadow-card">
          <div className="flex items-center gap-3 px-4 py-4">
            <Link to="/" className="grid h-9 w-9 place-items-center rounded-full bg-ocean-700">
              <ArrowLeft size={18} />
            </Link>
            <h1 className="text-lg font-bold">Shared Trip</h1>
          </div>
        </header>
        <main className="flex-1 px-4 py-5">
          <div className="card flex items-center gap-3">
            <span className="h-3 w-3 animate-pulse rounded-full bg-ocean-400" />
            <p className="text-sm font-semibold text-ocean-700">Loading shared itinerary…</p>
          </div>
        </main>
      </div>
    )
  }

  if (error || !itinerary) {
    return (
      <div className="app-shell">
        <header className="sticky top-0 z-30 bg-ocean-800 text-white shadow-card">
          <div className="flex items-center gap-3 px-4 py-4">
            <Link to="/" className="grid h-9 w-9 place-items-center rounded-full bg-ocean-700">
              <ArrowLeft size={18} />
            </Link>
            <h1 className="text-lg font-bold">Shared Trip</h1>
          </div>
        </header>
        <main className="flex-1 px-4 py-5">
          <div className="card flex flex-col items-center gap-3 text-center">
            <Info size={24} className="text-ocean-400" />
            <p className="text-sm font-bold text-ocean-900">{error ?? 'Itinerary not found'}</p>
            <Link to="/" className="btn-secondary">Go to MoryonGo</Link>
          </div>
        </main>
      </div>
    )
  }

  const cost = calculateTripCost(itinerary)
  const startDate = itinerary.start_date ? new Date(itinerary.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null
  const endDate = itinerary.end_date ? new Date(itinerary.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null

  return (
    <div className="app-shell">
      <header className="sticky top-0 z-30 bg-ocean-800 text-white shadow-card">
        <div className="flex items-center gap-3 px-4 py-4">
          <Link to="/" className="grid h-9 w-9 place-items-center rounded-full bg-ocean-700 hover:bg-ocean-600">
            <ArrowLeft size={18} />
          </Link>
          <span className="grid h-8 w-8 place-items-center rounded-full bg-ocean-600">
            <Luggage size={18} />
          </span>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold truncate">{itinerary.title}</h1>
            <span className={`pill text-[10px] ${statusClasses(itinerary.status)}`}>{STATUS_LABELS[itinerary.status]}</span>
          </div>
        </div>
      </header>

      <main className="flex-1 space-y-5 px-4 py-5">
        {/* Summary */}
        <section className="card space-y-3">
          {itinerary.description && <p className="text-sm text-ocean-700">{itinerary.description}</p>}
          <div className="flex flex-wrap gap-3 text-xs text-ocean-600">
            {startDate && (
              <span className="flex items-center gap-1"><Calendar size={12} /> {startDate}{endDate && endDate !== startDate ? ` – ${endDate}` : ''}</span>
            )}
            <span className="flex items-center gap-1"><Users size={12} /> {itinerary.traveler_count} traveler{itinerary.traveler_count > 1 ? 's' : ''}</span>
            {itinerary.starting_location && (
              <span className="flex items-center gap-1"><MapPin size={12} /> From {itinerary.starting_location.name}</span>
            )}
          </div>
        </section>

        {/* Days & Stops */}
        <section className="space-y-4">
          <h2 className="section-title">Itinerary</h2>
          {itinerary.days.map((day) => (
            <div key={day.id} className="card space-y-2">
              <div className="flex items-center gap-2">
                {day.day_number > 0 && (
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-ocean-100 text-ocean-800 text-sm font-bold">
                    {day.day_number}
                  </span>
                )}
                <div>
                  <p className="font-bold text-ocean-900">
                    {day.day_number === 0 ? 'Stops' : `Day ${day.day_number}`}
                  </p>
                  {day.trip_date && <p className="text-xs text-ocean-600">{new Date(day.trip_date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</p>}
                </div>
              </div>
              {day.notes && <p className="text-sm text-ocean-600 italic">{day.notes}</p>}
              <div className="space-y-2">
                {day.stops.map((stop) => {
                  const name = stop.is_rest_break
                    ? stop.custom_title ?? 'Rest / Meal Break'
                    : stop.destination?.name ?? stop.location?.name ?? stop.custom_title ?? 'Custom Stop'
                  const municipality = stop.destination?.municipality ?? stop.location?.municipality ?? null
                  const isCustom = !stop.destination_id && !stop.location_id && !stop.is_rest_break

                  return (
                    <div key={stop.id} className="rounded-xl border border-sand-200 bg-sand-50 p-3 space-y-1">
                      <div className="flex items-center gap-2">
                        {stop.is_rest_break ? <Clock size={14} className="text-terra-600" /> : <MapPin size={14} className="text-ocean-600" />}
                        <p className="font-semibold text-sm text-ocean-900">{name}</p>
                      </div>
                      {municipality && <p className="text-xs text-ocean-600 ml-5">{municipality}</p>}
                      {isCustom && !stop.is_rest_break && <p className="text-xs text-terra-600 ml-5">Custom stop (not a verified destination)</p>}
                      {(stop.planned_arrival_time || stop.planned_departure_time) && (
                        <div className="flex gap-3 text-xs text-ocean-600 ml-5">
                          {stop.planned_arrival_time && <span>Arrive {stop.planned_arrival_time.slice(0, 5)}</span>}
                          {stop.planned_departure_time && <span>Depart {stop.planned_departure_time.slice(0, 5)}</span>}
                        </div>
                      )}
                      {stop.user_notes && <p className="text-xs text-ocean-600 ml-5 italic">{stop.user_notes}</p>}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </section>

        {/* Transport Legs */}
        {itinerary.legs.length > 0 && (
          <section className="space-y-3">
            <h2 className="section-title flex items-center gap-2"><RouteIcon size={16} /> Transport</h2>
            <div className="space-y-2">
              {itinerary.legs.map((leg) => (
                <div key={leg.id} className="card space-y-1 py-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-ocean-900">{leg.route?.route_name ?? 'Transport leg'}</span>
                    <span className={`pill text-[10px] ${
                      leg.fare_source_status === 'verified' ? 'bg-leaf-100 text-leaf-700' :
                      leg.fare_source_status === 'estimated' ? 'bg-sand-200 text-terra-800' :
                      leg.fare_source_status === 'user_entered' ? 'bg-ocean-100 text-ocean-800' :
                      'bg-red-100 text-red-700'
                    }`}>{FARE_SOURCE_LABELS[leg.fare_source_status]}</span>
                  </div>
                  <div className="flex gap-3 text-xs text-ocean-600">
                    <span>{leg.estimated_fare != null ? formatCurrency(Number(leg.estimated_fare), leg.currency_code) : 'No fare data'}</span>
                    {leg.estimated_duration_minutes != null && <span>~{leg.estimated_duration_minutes}min</span>}
                    {leg.transport_mode && <span>{leg.transport_mode.name}</span>}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Cost Summary */}
        <section className="card space-y-2">
          <h2 className="section-title flex items-center gap-2"><Wallet size={16} /> Cost Estimate</h2>
          <div className="flex items-center justify-between">
            <span className="font-bold text-ocean-900">Estimated Total</span>
            <span className="font-bold text-lg text-ocean-900">{formatCurrency(cost.grandTotal, cost.currency)}</span>
          </div>
          {itinerary.traveler_count > 1 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-ocean-600">Per Traveler</span>
              <span className="text-ocean-700">{formatCurrency(cost.perTraveler, cost.currency)}</span>
            </div>
          )}
          {cost.incomplete && (
            <p className="text-xs text-terra-600">This estimate may be incomplete. Some costs could not be determined.</p>
          )}
        </section>

        <section className="card flex items-start gap-2">
          <Info size={16} className="mt-0.5 shrink-0 text-ocean-500" />
          <p className="text-xs text-ocean-600">
            This is a shared view of a MoryonGo trip itinerary. Fares and information are labeled by verification status.
            No reservation or booking has been made. Plan your own trip at MoryonGo.
          </p>
        </section>

        <Link to="/tourist-planner" className="btn-primary w-full">
          <Luggage size={18} /> Create Your Own Trip
        </Link>
      </main>
    </div>
  )
}
