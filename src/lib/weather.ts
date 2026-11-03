import { supabase } from './supabase'

// ---- Marinduque municipalities ----

export const MUNICIPALITIES = [
  'Boac',
  'Buenavista',
  'Gasan',
  'Mogpog',
  'Santa Cruz',
  'Torrijos',
] as const

export type Municipality = (typeof MUNICIPALITIES)[number]

// ---- Normalized weather types ----

export interface WeatherCurrent {
  temperature: number | null
  feels_like: number | null
  description: string | null
  icon: string | null
  humidity: number | null
  wind_speed: number | null
  wind_direction: number | null
  visibility: number | null
  precipitation_chance: number | null
  sunrise: string | null
  sunset: string | null
  observed_at: string | null
}

export interface WeatherHourly {
  time: string
  temperature: number | null
  description: string | null
  icon: string | null
  precipitation_chance: number | null
  precipitation_amount: number | null
  wind_speed: number | null
}

export interface WeatherDaily {
  date: string
  temp_min: number | null
  temp_max: number | null
  description: string | null
  icon: string | null
  precipitation_chance: number | null
  precipitation_amount: number | null
  wind_speed: number | null
}

export interface WeatherWarning {
  title: string
  severity: string | null
  description: string | null
  issued_by: string | null
  issued_at: string | null
  expires_at: string | null
  url: string | null
}

export interface WeatherResponse {
  municipality: string
  provider: string
  current: WeatherCurrent
  hourly: WeatherHourly[]
  daily: WeatherDaily[]
  warnings: WeatherWarning[]
  fetched_at: string
  cached: boolean
  stale?: boolean
  error?: string
  configured: boolean
}

// ---- Travel advisory types ----

export type AdvisorySeverity = 'info' | 'caution' | 'warning'

export interface TravelAdvisory {
  id: string
  severity: AdvisorySeverity
  title: string
  description: string
  icon: string
}

// ---- Weather icon mapping (OpenWeatherMap icon code → emoji) ----

const ICON_MAP: Record<string, string> = {
  '01d': '☀️', '01n': '🌙',
  '02d': '⛅', '02n': '☁️',
  '03d': '☁️', '03n': '☁️',
  '04d': '☁️', '04n': '☁️',
  '09d': '🌧️', '09n': '🌧️',
  '10d': '🌦️', '10n': '🌧️',
  '11d': '⛈️', '11n': '⛈️',
  '13d': '❄️', '13n': '❄️',
  '50d': '🌫️', '50n': '🌫️',
}

export function weatherIcon(code: string | null): string {
  if (!code) return '🌤️'
  return ICON_MAP[code] ?? '🌤️'
}

// ---- Fetch weather data from edge function ----

export async function fetchWeather(
  municipality: string,
): Promise<{ data: WeatherResponse | null; error: string | null }> {
  const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/weather-proxy?municipality=${encodeURIComponent(municipality)}`
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  // Attach publishable key for project identification
  const apiKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
  if (apiKey) {
    headers['apikey'] = apiKey
  }

  try {
    const res = await fetch(apiUrl, { headers, signal: AbortSignal.timeout(15000) })
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: `Request failed (${res.status})` }))
      return { data: null, error: body.error ?? `Request failed (${res.status})` }
    }
    const json = await res.json() as WeatherResponse
    if (!json.configured) {
      return { data: json, error: null }
    }
    return { data: json, error: json.error ?? null }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch weather data'
    return { data: null, error: msg }
  }
}

// ---- Generate travel advisories from actual weather data ----

export function generateAdvisories(current: WeatherCurrent, hourly: WeatherHourly[]): TravelAdvisory[] {
  const advisories: TravelAdvisory[] = []
  const desc = (current.description ?? '').toLowerCase()
  const windSpeed = current.wind_speed
  const precipChance = current.precipitation_chance
  const visibility = current.visibility

  // Thunderstorm advisory
  if (desc.includes('thunderstorm') || desc.includes('storm')) {
    advisories.push({
      id: 'thunderstorm',
      severity: 'warning',
      title: 'Thunderstorm conditions',
      description: 'Thunderstorms may create unsafe outdoor conditions. Consider postponing non-essential travel and seek shelter if needed.',
      icon: '⛈️',
    })
  }

  // Heavy rain advisory
  if (desc.includes('heavy rain') || desc.includes('drizzle')) {
    advisories.push({
      id: 'heavy_rain',
      severity: 'caution',
      title: 'Rain may reduce road visibility',
      description: 'Heavy rain can reduce visibility on roads. Exercise caution when traveling, especially on two-wheel vehicles.',
      icon: '🌧️',
    })
  } else if ((precipChance ?? 0) >= 70) {
    advisories.push({
      id: 'high_precip_chance',
      severity: 'caution',
      title: 'High chance of precipitation',
      description: `There is a ${Math.round(precipChance!)}% chance of precipitation. Bring rain gear and plan for possible delays.`,
      icon: '🌧️',
    })
  }

  // Strong wind advisory
  if (windSpeed != null && windSpeed >= 10) {
    advisories.push({
      id: 'strong_wind',
      severity: windSpeed >= 17 ? 'warning' : 'caution',
      title: windSpeed >= 17 ? 'Strong winds may affect travel' : 'Moderate winds expected',
      description: windSpeed >= 17
        ? `Wind speeds of ${Math.round(windSpeed)} m/s may affect exposed travel routes and sea crossings. Check with ferry operators before departure.`
        : `Wind speeds around ${Math.round(windSpeed)} m/s may affect two-wheel vehicles and sea travel comfort.`,
      icon: '💨',
    })
  }

  // Low visibility advisory
  if (visibility != null && visibility <= 2) {
    advisories.push({
      id: 'low_visibility',
      severity: 'caution',
      title: 'Reduced visibility',
      description: `Visibility is approximately ${visibility.toFixed(1)} km. Exercise extra caution on roads and near ports.`,
      icon: '🌫️',
    })
  }

  // Fog advisory
  if (desc.includes('fog') || desc.includes('mist') || desc.includes('haze')) {
    advisories.push({
      id: 'fog',
      severity: 'caution',
      title: 'Fog or haze conditions',
      description: 'Fog can significantly reduce visibility. Drive slowly, use headlights, and allow extra travel time.',
      icon: '🌫️',
    })
  }

  // Sea travel caution from wind/rain
  const next6h = hourly.slice(0, 6)
  const maxWind6h = Math.max(...next6h.map((h) => h.wind_speed ?? 0))
  const maxPrecip6h = Math.max(...next6h.map((h) => h.precipitation_chance ?? 0))
  if (maxWind6h >= 15 || maxPrecip6h >= 80) {
    advisories.push({
      id: 'sea_travel_caution',
      severity: 'caution',
      title: 'Sea travel may be affected',
      description: 'Forecasted conditions may affect boat or ferry services. Check with transport operators before departing for ports. This is not a confirmed cancellation.',
      icon: '⛵',
    })
  }

  // Clear weather note
  if (advisories.length === 0 && desc.includes('clear')) {
    advisories.push({
      id: 'clear_conditions',
      severity: 'info',
      title: 'Weather conditions are clear',
      description: 'Current conditions are favorable for travel. Always check with operators for the latest schedules.',
      icon: '☀️',
    })
  }

  return advisories
}

// ---- Weather alert subscriptions ----

export interface WeatherSubscriptionRow {
  id: string
  user_id: string
  municipality: string
  alert_preferences: string[]
  enabled: boolean
  created_at: string
  updated_at: string
}

export async function fetchWeatherSubscriptions(): Promise<WeatherSubscriptionRow[]> {
  const { data, error } = await supabase
    .from('weather_alert_subscriptions')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('fetchWeatherSubscriptions error:', error.message)
    return []
  }
  return (data ?? []) as WeatherSubscriptionRow[]
}

export async function toggleWeatherSubscription(
  municipality: string,
  enabled: boolean,
): Promise<{ success: boolean; error?: string }> {
  const { data: existing } = await supabase
    .from('weather_alert_subscriptions')
    .select('id')
    .eq('municipality', municipality)
    .maybeSingle()

  if (existing) {
    const { error } = await supabase
      .from('weather_alert_subscriptions')
      .update({ enabled, updated_at: new Date().toISOString() })
      .eq('id', (existing as { id: string }).id)
    if (error) return { success: false, error: error.message }
    return { success: true }
  }

  if (!enabled) return { success: true }

  const { error } = await supabase
    .from('weather_alert_subscriptions')
    .insert({ municipality, enabled })
  if (error) return { success: false, error: error.message }
  return { success: true }
}

// ---- Formatting helpers ----

export function formatTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', hour12: true })
}

export function formatDay(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  if (d.toDateString() === today.toDateString()) return 'Today'
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  if (d.toDateString() === tomorrow.toDateString()) return 'Tomorrow'
  return d.toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' })
}

export function windDirectionLabel(deg: number | null): string {
  if (deg == null) return ''
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
  return dirs[Math.round(deg / 45) % 8]
}

export function advisorySeverityClasses(severity: AdvisorySeverity): string {
  switch (severity) {
    case 'warning': return 'border-l-4 border-red-400 bg-red-50'
    case 'caution': return 'border-l-4 border-terra-300 bg-terra-50'
    case 'info': return 'border-l-4 border-ocean-300 bg-ocean-50'
  }
}

export function advisorySeverityLabel(severity: AdvisorySeverity): string {
  switch (severity) {
    case 'warning': return 'Warning'
    case 'caution': return 'Caution'
    case 'info': return 'Info'
  }
}
