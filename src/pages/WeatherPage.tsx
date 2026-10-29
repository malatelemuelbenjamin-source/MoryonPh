import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  CloudSun,
  RefreshCw,
  MapPin,
  Wind,
  Droplets,
  Eye,
  Sunrise,
  Sunset,
  AlertTriangle,
  Clock,
  Bell,
  BellOff,
  Info,
  ExternalLink,
  Loader2,
} from 'lucide-react'
import { useAuth } from '../lib/auth'
import {
  MUNICIPALITIES,
  type Municipality,
  type WeatherResponse,
  type TravelAdvisory,
  type WeatherSubscriptionRow,
  fetchWeather,
  generateAdvisories,
  fetchWeatherSubscriptions,
  toggleWeatherSubscription,
  weatherIcon,
  formatTime,
  formatDay,
  windDirectionLabel,
  advisorySeverityClasses,
  advisorySeverityLabel,
} from '../lib/weather'
import { formatRelativeTime } from '../lib/labels'

const PAGASA_URL = 'https://www.pagasa.dost.gov.ph/information/bulletin-list'

export function WeatherPage() {
  const { user } = useAuth()
  const [municipality, setMunicipality] = useState<Municipality>('Boac')
  const [weather, setWeather] = useState<WeatherResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  const [subs, setSubs] = useState<WeatherSubscriptionRow[]>([])
  const [subToggling, setSubToggling] = useState(false)

  const loadWeather = useCallback(async (muni: string, isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)

    const { data, error: err } = await fetchWeather(muni)
    if (err && !data) {
      setError(err)
    } else if (data) {
      setWeather(data)
      if (data.error) setError(data.error)
    }
    setLoading(false)
    setRefreshing(false)
    setLastRefresh(new Date())
  }, [])

  useEffect(() => {
    void loadWeather(municipality)
  }, [municipality, loadWeather])

  useEffect(() => {
    if (!user) return
    void (async () => {
      setSubs(await fetchWeatherSubscriptions())
    })()
  }, [user])

  const advisories = useMemo(() => {
    if (!weather?.current) return []
    return generateAdvisories(weather.current, weather.hourly ?? [])
  }, [weather])

  const isSubscribed = useMemo(() => {
    return subs.some((s) => s.municipality === municipality && s.enabled)
  }, [subs, municipality])

  async function handleToggleSub() {
    if (!user) return
    setSubToggling(true)
    const { success } = await toggleWeatherSubscription(municipality, !isSubscribed)
    if (success) {
      setSubs(await fetchWeatherSubscriptions())
    }
    setSubToggling(false)
  }

  return (
    <div className="app-shell">
      <header className="sticky top-0 z-30 bg-ocean-800 text-white shadow-card">
        <div className="flex items-center gap-3 px-4 py-4">
          <Link to="/" aria-label="Back to home" className="grid h-9 w-9 place-items-center rounded-full bg-ocean-700 hover:bg-ocean-600">
            <ArrowLeft size={18} />
          </Link>
          <span className="grid h-8 w-8 place-items-center rounded-full bg-ocean-600">
            <CloudSun size={18} />
          </span>
          <h1 className="text-lg font-bold">Weather & Travel Conditions</h1>
        </div>
      </header>

      <main className="flex-1 space-y-5 px-4 py-5">
        {/* Municipality selector */}
        <section className="card space-y-3">
          <div className="flex items-center gap-2">
            <MapPin size={18} className="text-ocean-700" />
            <h2 className="text-base font-bold text-ocean-900">Select Municipality</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {MUNICIPALITIES.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMunicipality(m)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition active:scale-95 ${
                  municipality === m
                    ? 'bg-ocean-700 text-white'
                    : 'bg-ocean-50 text-ocean-700 hover:bg-ocean-100'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </section>

        {/* Loading state */}
        {loading && (
          <div className="card flex items-center gap-3">
            <Loader2 size={20} className="animate-spin text-ocean-500" />
            <p className="text-sm font-semibold text-ocean-700">Loading weather for {municipality}…</p>
          </div>
        )}

        {/* Error / not configured */}
        {error && !loading && (
          <div className="card border-l-4 border-terra-400 bg-terra-50 flex items-start gap-3">
            <AlertTriangle size={20} className="mt-0.5 shrink-0 text-terra-600" />
            <div className="flex-1">
              <p className="text-sm font-bold text-ocean-900">Weather data unavailable</p>
              <p className="mt-1 text-sm text-ocean-700">{error}</p>
              {!weather && (
                <button
                  type="button"
                  onClick={() => void loadWeather(municipality, true)}
                  className="btn-secondary mt-3"
                >
                  <RefreshCw size={16} /> Try Again
                </button>
              )}
            </div>
          </div>
        )}

        {/* Current weather */}
        {weather?.current && !loading && (
          <section className="card space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-semibold text-ocean-600">{municipality}, Marinduque</p>
                <div className="mt-1 flex items-center gap-3">
                  <span className="text-4xl">{weatherIcon(weather.current.icon)}</span>
                  <div>
                    <p className="text-4xl font-bold text-ocean-900">
                      {weather.current.temperature != null ? `${Math.round(weather.current.temperature)}°C` : '—'}
                    </p>
                    <p className="text-sm capitalize text-ocean-700">{weather.current.description ?? 'N/A'}</p>
                  </div>
                </div>
              </div>
              {weather.stale && (
                <span className="pill bg-sand-200 text-terra-800 text-[10px]">STALE</span>
              )}
            </div>

            {weather.current.feels_like != null && (
              <p className="text-sm text-ocean-700">
                Feels like <span className="font-semibold">{Math.round(weather.current.feels_like)}°C</span>
              </p>
            )}

            {/* Weather details grid */}
            <div className="grid grid-cols-2 gap-3">
              {weather.current.humidity != null && (
                <DetailItem icon={Droplets} label="Humidity" value={`${weather.current.humidity}%`} />
              )}
              {weather.current.wind_speed != null && (
                <DetailItem
                  icon={Wind}
                  label="Wind"
                  value={`${Math.round(weather.current.wind_speed)} m/s ${windDirectionLabel(weather.current.wind_direction)}`}
                />
              )}
              {weather.current.visibility != null && (
                <DetailItem icon={Eye} label="Visibility" value={`${weather.current.visibility.toFixed(1)} km`} />
              )}
              {weather.current.precipitation_chance != null && (
                <DetailItem icon={Droplets} label="Rain Chance" value={`${Math.round(weather.current.precipitation_chance)}%`} />
              )}
              {weather.current.sunrise && (
                <DetailItem icon={Sunrise} label="Sunrise" value={formatTime(weather.current.sunrise)} />
              )}
              {weather.current.sunset && (
                <DetailItem icon={Sunset} label="Sunset" value={formatTime(weather.current.sunset)} />
              )}
            </div>

            {/* Timestamp and refresh */}
            <div className="flex items-center justify-between border-t border-sand-200 pt-3">
              <p className="flex items-center gap-1 text-xs text-ocean-500">
                <Clock size={12} />
                {weather.current.observed_at
                  ? `Observed ${formatRelativeTime(weather.current.observed_at)}`
                  : `Fetched ${formatRelativeTime(weather.fetched_at)}`}
              </p>
              <button
                type="button"
                onClick={() => void loadWeather(municipality, true)}
                disabled={refreshing}
                className="btn-secondary flex items-center gap-1.5 text-xs"
              >
                <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
                {refreshing ? 'Refreshing…' : 'Refresh'}
              </button>
            </div>

            <p className="text-[10px] text-ocean-400">
              Weather data provided by {weather.provider === 'openweathermap' ? 'OpenWeatherMap' : weather.provider}. Forecasts are predictions, not actual measurements.
            </p>
          </section>
        )}

        {/* Travel advisories */}
        {advisories.length > 0 && !loading && (
          <section className="space-y-3">
            <h2 className="section-title">Travel Weather Advisories</h2>
            {advisories.map((adv) => (
              <AdvisoryCard key={adv.id} advisory={adv} />
            ))}
            <div className="card flex items-start gap-2">
              <Info size={14} className="mt-0.5 shrink-0 text-ocean-500" />
              <p className="text-xs text-ocean-600">
                Advisories are generated from current weather data and forecasts. They do not confirm road closures, ferry cancellations, or service disruptions. Always verify with transport operators.
              </p>
            </div>
          </section>
        )}

        {/* Hourly forecast */}
        {weather?.hourly && weather.hourly.length > 0 && !loading && (
          <section className="space-y-3">
            <h2 className="section-title">Hourly Forecast</h2>
            <div className="card">
              <div className="flex gap-3 overflow-x-auto pb-2">
                {weather.hourly.slice(0, 12).map((h, i) => (
                  <div key={i} className="flex min-w-[72px] flex-col items-center gap-1 text-center">
                    <p className="text-xs font-semibold text-ocean-600">
                      {h.time ? formatTime(h.time) : ''}
                    </p>
                    <span className="text-2xl">{weatherIcon(h.icon)}</span>
                    <p className="text-sm font-bold text-ocean-900">
                      {h.temperature != null ? `${Math.round(h.temperature)}°` : '—'}
                    </p>
                    {h.precipitation_chance != null && h.precipitation_chance > 0 && (
                      <p className="text-[10px] text-ocean-500">{Math.round(h.precipitation_chance)}%</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Daily forecast */}
        {weather?.daily && weather.daily.length > 0 && !loading && (
          <section className="space-y-3">
            <h2 className="section-title">5-Day Forecast</h2>
            <div className="space-y-2">
              {weather.daily.map((d, i) => (
                <div key={i} className="card flex items-center gap-3">
                  <div className="w-20">
                    <p className="text-sm font-bold text-ocean-900">{d.date ? formatDay(d.date) : ''}</p>
                  </div>
                  <span className="text-2xl">{weatherIcon(d.icon)}</span>
                  <p className="flex-1 text-sm capitalize text-ocean-700">{d.description ?? ''}</p>
                  <div className="text-right">
                    <p className="text-sm font-bold text-ocean-900">
                      {d.temp_max != null ? `${Math.round(d.temp_max)}°` : '—'}
                      <span className="text-ocean-500"> / </span>
                      {d.temp_min != null ? `${Math.round(d.temp_min)}°` : '—'}
                    </p>
                    {d.precipitation_chance != null && d.precipitation_chance > 0 && (
                      <p className="text-[10px] text-ocean-500">{Math.round(d.precipitation_chance)}% rain</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Official warnings section */}
        {!loading && (
          <section className="space-y-3">
            <h2 className="section-title">Official Weather Warnings</h2>
            {weather?.warnings && weather.warnings.length > 0 ? (
              weather.warnings.map((w, i) => (
                <div key={i} className="card border-l-4 border-red-500">
                  <p className="text-base font-bold text-ocean-900">{w.title}</p>
                  {w.severity && <span className="pill bg-red-100 text-red-700 mt-1">{w.severity}</span>}
                  {w.description && <p className="mt-2 text-sm text-ocean-700">{w.description}</p>}
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-ocean-500">
                    {w.issued_by && <span>Issued by: {w.issued_by}</span>}
                    {w.issued_at && <span>Issued: {formatRelativeTime(w.issued_at)}</span>}
                    {w.expires_at && <span>Expires: {formatRelativeTime(w.expires_at)}</span>}
                  </div>
                  {w.url && (
                    <a href={w.url} target="_blank" rel="noopener noreferrer" className="btn-secondary mt-3 inline-flex items-center gap-1.5 text-xs">
                      <ExternalLink size={12} /> View Official Advisory
                    </a>
                  )}
                </div>
              ))
            ) : (
              <div className="card flex items-start gap-3">
                <Info size={18} className="mt-0.5 shrink-0 text-ocean-500" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-ocean-800">No official warnings integrated</p>
                  <p className="mt-1 text-xs text-ocean-600">
                    Official severe weather warnings are not currently integrated. For the latest
                    official Philippine weather warnings, check PAGASA directly.
                  </p>
                  <a
                    href={PAGASA_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-secondary mt-3 inline-flex items-center gap-1.5 text-xs"
                  >
                    <ExternalLink size={12} /> Visit PAGASA Bulletins
                  </a>
                </div>
              </div>
            )}
          </section>
        )}

        {/* Notification subscription */}
        {!loading && user && (
          <section className="card space-y-3">
            <div className="flex items-center gap-2">
              <Bell size={18} className="text-ocean-700" />
              <h2 className="text-base font-bold text-ocean-900">Weather Alerts</h2>
            </div>
            <p className="text-sm text-ocean-700">
              Subscribe to receive in-app weather alerts for {municipality}.
            </p>
            <button
              type="button"
              onClick={handleToggleSub}
              disabled={subToggling}
              className={isSubscribed ? 'btn-secondary w-full' : 'btn-primary w-full'}
            >
              {isSubscribed ? (
                <><BellOff size={16} /> Unsubscribe from {municipality} Alerts</>
              ) : (
                <><Bell size={16} /> Subscribe to {municipality} Alerts</>
              )}
            </button>
            {subs.filter((s) => s.enabled).length > 0 && (
              <div className="border-t border-sand-200 pt-2">
                <p className="text-xs font-semibold text-ocean-600">Active subscriptions:</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {subs.filter((s) => s.enabled).map((s) => (
                    <span key={s.id} className="pill bg-ocean-100 text-ocean-800 text-[10px]">
                      {s.municipality}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {!loading && !user && (
          <section className="card flex flex-col items-center gap-3 text-center">
            <Bell size={24} className="text-ocean-500" />
            <p className="text-sm font-semibold text-ocean-900">Sign in to subscribe to weather alerts</p>
            <Link to="/auth" className="btn-secondary w-full">Sign In / Create Account</Link>
          </section>
        )}

        {/* Footer attribution */}
        {!loading && (
          <div className="space-y-1 text-center">
            {lastRefresh && (
              <p className="px-2 text-[10px] text-ocean-500">
                Page last refreshed {formatRelativeTime(lastRefresh.toISOString())}
              </p>
            )}
            <p className="px-2 text-[10px] text-ocean-400">
              Weather forecasts are predictions and may differ from actual conditions. Always verify with official sources for critical decisions.
            </p>
          </div>
        )}
      </main>
    </div>
  )
}

function DetailItem({ icon: Icon, label, value }: { icon: typeof Wind; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-ocean-50 px-3 py-2">
      <Icon size={16} className="shrink-0 text-ocean-600" />
      <div>
        <p className="text-[10px] font-semibold text-ocean-500">{label}</p>
        <p className="text-sm font-bold text-ocean-900">{value}</p>
      </div>
    </div>
  )
}

function AdvisoryCard({ advisory }: { advisory: TravelAdvisory }) {
  return (
    <div className={`card ${advisorySeverityClasses(advisory.severity)}`}>
      <div className="flex items-start gap-3">
        <span className="text-2xl">{advisory.icon}</span>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold text-ocean-900">{advisory.title}</p>
            <span className={`pill text-[10px] ${
              advisory.severity === 'warning' ? 'bg-red-100 text-red-700'
                : advisory.severity === 'caution' ? 'bg-terra-100 text-terra-700'
                : 'bg-ocean-100 text-ocean-800'
            }`}>
              {advisorySeverityLabel(advisory.severity)}
            </span>
          </div>
          <p className="mt-1 text-xs text-ocean-700">{advisory.description}</p>
        </div>
      </div>
    </div>
  )
}
