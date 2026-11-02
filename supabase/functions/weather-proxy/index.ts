// Weather proxy edge function for MoryonGo.
// Securely fetches weather data from OpenWeatherMap, caches it in Supabase,
// and returns normalized JSON to the frontend. API key stays server-side.

import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface MunicipalityCoord {
  name: string;
  lat: number;
  lon: number;
}

// Verified coordinates for the six municipalities of Marinduque, Philippines.
const MUNICIPALITIES: MunicipalityCoord[] = [
  { name: "Boac", lat: 13.4394, lon: 121.8467 },
  { name: "Buenavista", lat: 13.4458, lon: 121.9244 },
  { name: "Gasan", lat: 13.3169, lon: 121.8856 },
  { name: "Mogpog", lat: 13.4225, lon: 121.8294 },
  { name: "Santa Cruz", lat: 13.4728, lon: 121.9919 },
  { name: "Torrijos", lat: 13.3322, lon: 122.0592 },
];

const CACHE_TTL_MINUTES = 20; // OpenWeatherMap free tier: cache 20 min
const PROVIDER = "openweathermap";

function getSupabaseClient() {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  return createClient(url, serviceKey);
}

function getApiKey(): string | null {
  const key = Deno.env.get("OPENWEATHER_API_KEY");
  if (!key) return null;
  return key;
}

interface NormalizedCurrent {
  temperature: number | null;
  feels_like: number | null;
  description: string | null;
  icon: string | null;
  humidity: number | null;
  wind_speed: number | null;
  wind_direction: number | null;
  visibility: number | null;
  precipitation_chance: number | null;
  sunrise: string | null;
  sunset: string | null;
  observed_at: string | null;
}

interface NormalizedHourly {
  time: string;
  temperature: number | null;
  description: string | null;
  icon: string | null;
  precipitation_chance: number | null;
  precipitation_amount: number | null;
  wind_speed: number | null;
}

interface NormalizedDaily {
  date: string;
  temp_min: number | null;
  temp_max: number | null;
  description: string | null;
  icon: string | null;
  precipitation_chance: number | null;
  precipitation_amount: number | null;
  wind_speed: number | null;
}

interface NormalizedWarning {
  title: string;
  severity: string | null;
  description: string | null;
  issued_by: string | null;
  issued_at: string | null;
  expires_at: string | null;
  url: string | null;
}

function normalizeCurrent(data: Record<string, unknown>): NormalizedCurrent {
  const w = (data.weather as Record<string, unknown>[]) ?? [];
  const main = (data.main as Record<string, unknown>) ?? {};
  const wind = (data.wind as Record<string, unknown>) ?? {};
  const sys = (data.sys as Record<string, unknown>) ?? {};
  return {
    temperature: typeof main.temp === "number" ? main.temp : null,
    feels_like: typeof main.feels_like === "number" ? main.feels_like : null,
    description: w[0]?.description ? String(w[0].description) : null,
    icon: w[0]?.icon ? String(w[0].icon) : null,
    humidity: typeof main.humidity === "number" ? main.humidity : null,
    wind_speed: typeof wind.speed === "number" ? wind.speed : null,
    wind_direction: typeof wind.deg === "number" ? wind.deg : null,
    visibility: typeof data.visibility === "number" ? (data.visibility as number) / 1000 : null,
    precipitation_chance: typeof data.pop === "number" ? (data.pop as number) * 100 : null,
    sunrise: sys.sunrise ? new Date((sys.sunrise as number) * 1000).toISOString() : null,
    sunset: sys.sunset ? new Date((sys.sunset as number) * 1000).toISOString() : null,
    observed_at: data.dt ? new Date((data.dt as number) * 1000).toISOString() : null,
  };
}

function normalizeHourly(data: Record<string, unknown>): NormalizedHourly[] {
  const list = (data.list as Record<string, unknown>[]) ?? [];
  return list.slice(0, 24).map((item) => {
    const w = (item.weather as Record<string, unknown>[]) ?? [];
    const main = (item.main as Record<string, unknown>) ?? {};
    const wind = (item.wind as Record<string, unknown>) ?? {};
    return {
      time: item.dt ? new Date((item.dt as number) * 1000).toISOString() : "",
      temperature: typeof main.temp === "number" ? main.temp : null,
      description: w[0]?.description ? String(w[0].description) : null,
      icon: w[0]?.icon ? String(w[0].icon) : null,
      precipitation_chance: typeof item.pop === "number" ? (item.pop as number) * 100 : null,
      precipitation_amount: typeof item.rain === "object" && item.rain !== null
        ? Number((item.rain as Record<string, unknown>)["3h"] ?? null)
        : null,
      wind_speed: typeof wind.speed === "number" ? wind.speed : null,
    };
  });
}

function normalizeDaily(data: Record<string, unknown>): NormalizedDaily[] {
  const list = (data.list as Record<string, unknown>[]) ?? [];
  // Group 3-hour forecasts into daily summaries (every 8 entries ≈ 1 day)
  const daily: NormalizedDaily[] = [];
  for (let i = 0; i < list.length; i += 8) {
    const daySlice = list.slice(i, i + 8);
    if (daySlice.length === 0) break;
    const first = daySlice[0];
    const temps = daySlice
      .map((d) => ((d.main as Record<string, unknown>) ?? {}).temp)
      .filter((t): t is number => typeof t === "number");
    const pops = daySlice
      .map((d) => d.pop)
      .filter((p): p is number => typeof p === "number");
    const winds = daySlice
      .map((d) => ((d.wind as Record<string, unknown>) ?? {}).speed)
      .filter((s): s is number => typeof s === "number");
    const w = ((daySlice[0].weather as Record<string, unknown>[]) ?? []);
    const rainAmounts = daySlice
      .map((d) =>
        typeof d.rain === "object" && d.rain !== null
          ? Number((d.rain as Record<string, unknown>)["3h"] ?? 0)
          : 0,
      );
    daily.push({
      date: first.dt ? new Date((first.dt as number) * 1000).toISOString() : "",
      temp_min: temps.length ? Math.min(...temps) : null,
      temp_max: temps.length ? Math.max(...temps) : null,
      description: w[0]?.description ? String(w[0].description) : null,
      icon: w[0]?.icon ? String(w[0].icon) : null,
      precipitation_chance: pops.length ? Math.max(...pops) * 100 : null,
      precipitation_amount: rainAmounts.reduce((a, b) => a + b, 0) || null,
      wind_speed: winds.length ? Math.max(...winds) : null,
    });
  }
  return daily.slice(0, 5);
}

async function getCached(supabase: ReturnType<typeof getSupabaseClient>, municipality: string, dataType: string) {
  const { data } = await supabase
    .from("weather_cache")
    .select("*")
    .eq("municipality", municipality)
    .eq("data_type", dataType)
    .order("fetched_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

async function writeCache(
  supabase: ReturnType<typeof getSupabaseClient>,
  municipality: string,
  dataType: string,
  payload: unknown,
  observedAt: string | null,
) {
  const now = new Date();
  const expires = new Date(now.getTime() + CACHE_TTL_MINUTES * 60 * 1000);
  await supabase.from("weather_cache").insert({
    municipality,
    provider: PROVIDER,
    data_type: dataType,
    payload,
    observed_at: observedAt,
    fetched_at: now.toISOString(),
    expires_at: expires.toISOString(),
  });
}

async function fetchWeatherFromProvider(apiKey: string, lat: number, lon: number) {
  const currentUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${apiKey}`;
  const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=metric&appid=${apiKey}`;

  const [currentRes, forecastRes] = await Promise.all([
    fetch(currentUrl, { signal: AbortSignal.timeout(10000) }),
    fetch(forecastUrl, { signal: AbortSignal.timeout(10000) }),
  ]);

  if (!currentRes.ok) {
    const body = await currentRes.text();
    throw new Error(`OpenWeatherMap current API error ${currentRes.status}: ${body}`);
  }
  if (!forecastRes.ok) {
    const body = await forecastRes.text();
    throw new Error(`OpenWeatherMap forecast API error ${forecastRes.status}: ${body}`);
  }

  const currentData = await currentRes.json() as Record<string, unknown>;
  const forecastData = await forecastRes.json() as Record<string, unknown>;

  return { currentData, forecastData };
}

async function handleRequest(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const municipality = url.searchParams.get("municipality");

    if (!municipality) {
      return new Response(
        JSON.stringify({ error: "Missing 'municipality' parameter" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const coord = MUNICIPALITIES.find(
      (m) => m.name.toLowerCase() === municipality.toLowerCase(),
    );
    if (!coord) {
      return new Response(
        JSON.stringify({ error: `Unsupported municipality: ${municipality}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const apiKey = getApiKey();
    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error: "Weather API key not configured. Set OPENWEATHER_API_KEY as an edge function secret.",
          provider: PROVIDER,
          configured: false,
        }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = getSupabaseClient();
    const now = Date.now();
    const cacheTtlMs = CACHE_TTL_MINUTES * 60 * 1000;

    // Check cache for current + forecast
    const [cachedCurrent, cachedHourly, cachedDaily] = await Promise.all([
      getCached(supabase, coord.name, "current"),
      getCached(supabase, coord.name, "hourly"),
      getCached(supabase, coord.name, "daily"),
    ]);

    const cacheValid = (fetchedAt: string | null | undefined) => {
      if (!fetchedAt) return false;
      return now - new Date(fetchedAt).getTime() < cacheTtlMs;
    };

    const currentFresh = cachedCurrent && cacheValid(cachedCurrent.fetched_at);
    const hourlyFresh = cachedHourly && cacheValid(cachedHourly.fetched_at);
    const dailyFresh = cachedDaily && cacheValid(cachedDaily.fetched_at);

    if (currentFresh && hourlyFresh && dailyFresh) {
      return new Response(
        JSON.stringify({
          municipality: coord.name,
          provider: PROVIDER,
          current: cachedCurrent!.payload,
          hourly: cachedHourly!.payload,
          daily: cachedDaily!.payload,
          warnings: [],
          fetched_at: cachedCurrent!.fetched_at,
          cached: true,
          configured: true,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Fetch fresh data from provider
    const { currentData, forecastData } = await fetchWeatherFromProvider(apiKey, coord.lat, coord.lon);

    const normalizedCurrent = normalizeCurrent(currentData);
    const normalizedHourly = normalizeHourly(forecastData);
    const normalizedDaily = normalizeDaily(forecastData);

    // Write to cache (non-blocking but awaited)
    await Promise.all([
      writeCache(supabase, coord.name, "current", normalizedCurrent, normalizedCurrent.observed_at),
      writeCache(supabase, coord.name, "hourly", normalizedHourly, null),
      writeCache(supabase, coord.name, "daily", normalizedDaily, null),
    ]);

    return new Response(
      JSON.stringify({
        municipality: coord.name,
        provider: PROVIDER,
        current: normalizedCurrent,
        hourly: normalizedHourly,
        daily: normalizedDaily,
        warnings: [] as NormalizedWarning[],
        fetched_at: new Date().toISOString(),
        cached: false,
        configured: true,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("weather-proxy error:", message);

    // Try to return stale cache on error
    const url = new URL(req.url);
    const municipality = url.searchParams.get("municipality");
    if (municipality) {
      const supabase = getSupabaseClient();
      const [staleCurrent, staleHourly, staleDaily] = await Promise.all([
        getCached(supabase, municipality, "current"),
        getCached(supabase, municipality, "hourly"),
        getCached(supabase, municipality, "daily"),
      ]);
      if (staleCurrent) {
        return new Response(
          JSON.stringify({
            municipality,
            provider: PROVIDER,
            current: staleCurrent.payload,
            hourly: staleHourly?.payload ?? [],
            daily: staleDaily?.payload ?? [],
            warnings: [],
            fetched_at: staleCurrent.fetched_at,
            cached: true,
            stale: true,
            error: "Weather provider temporarily unavailable. Showing last cached data.",
            configured: true,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    return new Response(
      JSON.stringify({ error: "Weather data unavailable. Please try again later.", configured: true }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
}

const allowedOrigins = ["https://moryon-ph-6lty.vercel.app", "https://localhost", "http://localhost:5173"];

Deno.serve(async (req: Request) => {
  const response = await handleRequest(req);
  const origin = req.headers.get("Origin");
  const headers = new Headers(response.headers);
  headers.append("Vary", "Origin");
  if (origin && allowedOrigins.includes(origin)) headers.set("Access-Control-Allow-Origin", origin);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
});
