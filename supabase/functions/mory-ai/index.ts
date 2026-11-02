import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ConversationMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

// ---------------------------------------------------------------------------
// Language detection
// ---------------------------------------------------------------------------

const FILIPINO_MARKERS = [
  "paano", "saan", "magkano", "pamasahe", "ruta", "sasakay", "bababa",
  "transfer", "pantalan", "bangka", "skedyul", "presyo", "gusto", "hanap",
  "ipakita", "tulungan", "suriin", "lipat", "mula", "papunta", "papuntang",
  "biyahe", "sakay",
];

const ENGLISH_MARKERS = [
  "how", "where", "how much", "fare", "route", "schedule", "transport",
  "from", "to", "nearest", "available", "ferry", "port", "boat",
  "transfer", "cost", "price", "find", "show", "help",
];

function detectLanguage(text: string): "filipino" | "english" | "taglish" {
  const lower = text.toLowerCase();
  const hasFilipino = FILIPINO_MARKERS.some((m) => lower.includes(m));
  const hasEnglish = ENGLISH_MARKERS.some((m) => lower.includes(m));
  if (hasFilipino && hasEnglish) return "taglish";
  if (hasFilipino) return "filipino";
  return "english";
}

// ---------------------------------------------------------------------------
// Intent classification
// ---------------------------------------------------------------------------

type Intent =
  | "route_search" | "fare_inquiry" | "schedule_inquiry" | "transfer_inquiry"
  | "boarding_point" | "alert_inquiry" | "greeting" | "general";

const INTENT_PATTERNS: Record<Intent, RegExp[]> = {
  route_search: [
    /\b(paano|how)\b.*\b(makakarating|pumunta|get to|go to|reach)\b/i,
    /\b(ipakita|show|find|hanap)\b.*\b(ruta|route)\b/i,
    /\b(ruta|route)\b.*\b(options?|options)\b/i,
    /\b(mula|from)\b.*\b(papuntang|to|pupunta)\b/i,
  ],
  fare_inquiry: [
    /\b(magkano|how much|cost|presyo|price)\b/i,
    /\b(pamasahe|fare)\b/i,
  ],
  schedule_inquiry: [
    /\b(schedule|skedyul|oras|time|available)\b.*\b(ferry|boat|bangka|roro|sea)\b/i,
    /\b(ferry|boat|bangka|roro)\b.*\b(schedule|skedyul|oras|time)\b/i,
    /\b(available|mayroon|may)\b.*\b(ferry|boat|schedule)\b/i,
  ],
  transfer_inquiry: [
    /\b(transfer|lipat|switch)\b/i,
    /\b(jeepney|tricycle)\b.*\b(papuntang|to)\b.*\b(jeepney|tricycle)\b/i,
  ],
  boarding_point: [
    /\b(saan|where)\b.*\b(sasakay|board|terminal|boarding)\b/i,
    /\b(nearest|pinakamalapit)\b.*\b(terminal|boarding|sakay)\b/i,
  ],
  alert_inquiry: [
    /\b(alert|advisory|babala|cancel|delay|suspension)\b/i,
  ],
  greeting: [
    /^(hi|hello|kamusta|mabuhay|hey|yo)\b/i,
  ],
  general: [],
};

function classifyIntent(text: string): Intent {
  const lower = text.toLowerCase();
  for (const intent of Object.keys(INTENT_PATTERNS) as Intent[]) {
    for (const pattern of INTENT_PATTERNS[intent]) {
      if (pattern.test(lower)) return intent;
    }
  }
  if (["fare", "pamasahe", "magkano"].some((w) => lower.includes(w))) return "fare_inquiry";
  if (["ferry", "boat", "schedule", "skedyul"].some((w) => lower.includes(w))) return "schedule_inquiry";
  if (["route", "ruta", "paano", "how"].some((w) => lower.includes(w))) return "route_search";
  return "general";
}

// ---------------------------------------------------------------------------
// Entity extraction
// ---------------------------------------------------------------------------

interface LocationRef {
  name: string;
  municipality: string;
}

const MUNICIPALITIES = [
  "boac", "santa cruz", "mogpog", "gasan", "buenavista", "torrijos", "sta cruz",
];

function extractLocations(text: string, locations: Record<string, string>[]): {
  origin: LocationRef | null;
  destination: LocationRef | null;
} {
  const lower = text.toLowerCase();
  let origin: LocationRef | null = null;
  let destination: LocationRef | null = null;

  for (const loc of locations) {
    const name = (loc.name || "").toLowerCase();
    const muni = (loc.municipality || "").toLowerCase();
    if (!name) continue;

    if (name in lower || (muni && muni in lower)) {
      if (lower.includes(`mula ${name}`) || lower.includes(`from ${name}`) ||
          lower.includes(`mula ${muni}`) || lower.includes(`from ${muni}`)) {
        origin = { name: loc.name, municipality: loc.municipality };
      } else if (lower.includes(`papuntang ${name}`) || lower.includes(`to ${name}`) ||
                 lower.includes(`papuntang ${muni}`) || lower.includes(`to ${muni}`)) {
        destination = { name: loc.name, municipality: loc.municipality };
      } else if (!destination) {
        destination = { name: loc.name, municipality: loc.municipality };
      } else if (!origin) {
        origin = { name: loc.name, municipality: loc.municipality };
      }
    }
  }

  for (const muni of MUNICIPALITIES) {
    if (lower.includes(muni)) {
      const muniTitle = muni === "sta cruz" ? "Santa Cruz" : muni.charAt(0).toUpperCase() + muni.slice(1);
      if (lower.includes(`mula ${muni}`) || lower.includes(`from ${muni}`)) {
        if (!origin) origin = { name: muniTitle, municipality: muniTitle };
      } else if (lower.includes(`papuntang ${muni}`) || lower.includes(`to ${muni}`)) {
        if (!destination) destination = { name: muniTitle, municipality: muniTitle };
      }
    }
  }

  return { origin, destination };
}

// ---------------------------------------------------------------------------
// Data retrieval
// ---------------------------------------------------------------------------

type SupaClient = ReturnType<typeof createClient>;

async function getLocations(supabase: SupaClient): Promise<Record<string, string>[]> {
  const { data } = await supabase
    .from("locations")
    .select("id, name, municipality, barangay, type")
    .in("verification_status", ["official", "verified", "community_verified", "pending"]);
  return (data ?? []) as Record<string, string>[];
}

async function getRoutes(
  supabase: SupaClient,
  originName?: string,
  destName?: string,
): Promise<Record<string, unknown>[]> {
  const { data } = await supabase
    .from("routes")
    .select(`
      id, route_name, route_code, direction, operator_name,
      estimated_duration_minutes, verification_status,
      origin_location:locations!origin_location_id(id, name, municipality),
      destination_location:locations!destination_location_id(id, name, municipality),
      transport_mode:transport_modes(id, name, code)
    `)
    .eq("route_status", "active")
    .in("verification_status", ["official", "verified"]);
  const routes = (data ?? []) as Record<string, unknown>[];

  if (!originName && !destName) return routes;

  const originL = (originName || "").toLowerCase();
  const destL = (destName || "").toLowerCase();

  return routes.filter((r) => {
    const rOrigin = (((r.origin_location as { name: string }) || {}).name || "").toLowerCase();
    const rDest = (((r.destination_location as { name: string }) || {}).name || "").toLowerCase();
    const rMuniO = (((r.origin_location as { municipality: string }) || {}).municipality || "").toLowerCase();
    const rMuniD = (((r.destination_location as { municipality: string }) || {}).municipality || "").toLowerCase();

    if (originName && destName) {
      return (originL.includes(rOrigin) || originL.includes(rMuniO) || rOrigin.includes(originL) || rMuniO.includes(originL)) &&
             (destL.includes(rDest) || destL.includes(rMuniD) || rDest.includes(destL) || rMuniD.includes(destL)) ||
             (originL.includes(rDest) || originL.includes(rMuniD)) &&
             (destL.includes(rOrigin) || destL.includes(rMuniO));
    }
    if (originName) {
      return rOrigin.includes(originL) || rDest.includes(originL) || rMuniO.includes(originL) || rMuniD.includes(originL) ||
             originL.includes(rOrigin) || originL.includes(rDest) || originL.includes(rMuniO) || originL.includes(rMuniD);
    }
    if (destName) {
      return rOrigin.includes(destL) || rDest.includes(destL) || rMuniO.includes(destL) || rMuniD.includes(destL) ||
             destL.includes(rOrigin) || destL.includes(rDest) || destL.includes(rMuniO) || destL.includes(rMuniD);
    }
    return false;
  });
}

async function getFares(supabase: SupaClient, routeId?: string): Promise<Record<string, unknown>[]> {
  let query = supabase
    .from("fares")
    .select(`
      id, base_fare, minimum_fare, maximum_fare, fare_type, currency,
      effective_from, effective_until, verification_status,
      route:routes(id, route_name),
      transport_mode:transport_modes(id, name)
    `)
    .in("verification_status", ["official", "verified"]);
  if (routeId) query = query.eq("route_id", routeId);
  const { data } = await query.limit(10);
  return (data ?? []) as Record<string, unknown>[];
}

async function getFareDiscounts(supabase: SupaClient): Promise<Record<string, unknown>[]> {
  const { data } = await supabase
    .from("fare_discounts")
    .select("id, passenger_type, discount_type, discount_value, eligibility_notes, required_document, verification_status")
    .in("verification_status", ["official", "verified"]);
  return (data ?? []) as Record<string, unknown>[];
}

async function getSeaSchedules(supabase: SupaClient): Promise<Record<string, unknown>[]> {
  const { data } = await supabase
    .from("sea_transport_schedules")
    .select(`
      id, operator_name, departure_datetime, arrival_datetime, schedule_type,
      status, effective_from, effective_until, verification_status,
      departure_port:ports!departure_port_id(id, port_name),
      arrival_port:ports!arrival_port_id(id, port_name)
    `)
    .in("verification_status", ["official", "verified"]);
  return (data ?? []) as Record<string, unknown>[];
}

async function getPorts(supabase: SupaClient): Promise<Record<string, unknown>[]> {
  const { data } = await supabase
    .from("ports")
    .select("id, port_name, port_type, operating_status, verification_status")
    .in("verification_status", ["official", "verified"]);
  return (data ?? []) as Record<string, unknown>[];
}

async function getAlerts(supabase: SupaClient): Promise<Record<string, unknown>[]> {
  const { data } = await supabase
    .from("local_alerts")
    .select("id, title, description, category, priority, start_at, end_at, verification_status")
    .in("verification_status", ["official", "verified"]);
  return (data ?? []) as Record<string, unknown>[];
}

async function getRouteStops(supabase: SupaClient, routeId: string): Promise<Record<string, unknown>[]> {
  const { data } = await supabase
    .from("route_stops")
    .select(`
      id, stop_sequence, stop_type, pickup_allowed, dropoff_allowed, notes,
      location:locations(id, name, municipality)
    `)
    .eq("route_id", routeId)
    .order("stop_sequence");
  return (data ?? []) as Record<string, unknown>[];
}

// ---------------------------------------------------------------------------
// Response generation
// ---------------------------------------------------------------------------

function generateRouteResponse(
  question: string,
  lang: string,
  routes: Record<string, unknown>[],
  locations: Record<string, string>[],
): string {
  const { origin, destination } = extractLocations(question, locations);

  if (!origin && !destination) {
    if (lang === "filipino") {
      return "Saan ang gusto mong puntahan at saan ka magsisimula? Halimbawa: 'Paano makakarating mula Boac papuntang Santa Cruz?'";
    }
    if (lang === "taglish") {
      return "Saan ang origin mo at saan ang destination? Example: 'Paano makakarating from Boac papuntang Santa Cruz?'";
    }
    return "Where are you coming from and where do you want to go? Example: 'How do I get from Boac to Santa Cruz?'";
  }

  const originName = origin?.name || origin?.municipality || "";
  const destName = destination?.name || destination?.municipality || "";

  const lines: string[] = [];
  if (lang === "filipino") {
    lines.push(`Narito ang mga verified na ruta mula ${originName} papuntang ${destName}:`);
  } else if (lang === "taglish") {
    lines.push(`Heto ang mga verified routes from ${originName} to ${destName}:`);
  } else {
    lines.push(`Here are the verified routes from ${originName} to ${destName}:`);
  }

  if (routes.length === 0) {
    if (lang === "filipino") {
      lines.push(`Wala pang verified na ruta na nahanap mula ${originName} patungo sa ${destName}. Maaaring hindi pa naka-record ang rutang ito sa MoryonGo database.`);
    } else {
      lines.push(`No verified route found from ${originName} to ${destName}. This route may not yet be recorded in the MoryonGo database.`);
    }
    lines.push("");
    lines.push(lang === "filipino" ? "Subukang gamitin ang Route Planner para sa iba pang options." : "Try using the Route Planner for other options.");
    return lines.join("\n");
  }

  for (const r of routes.slice(0, 5)) {
    const mode = ((r.transport_mode as { name: string } | null)?.name ?? "Transport");
    const rOrigin = ((r.origin_location as { name: string } | null)?.name ?? "Unknown");
    const rDest = ((r.destination_location as { name: string } | null)?.name ?? "Unknown");
    const routeName = (r.route_name as string) || "Unnamed route";
    const duration = r.estimated_duration_minutes as number | null;
    const operator = (r.operator_name as string) || "";

    let line = `  • ${routeName}`;
    if (r.route_code) line += ` (Code: ${r.route_code})`;
    line += ` | ${mode} | ${rOrigin} → ${rDest}`;
    if (duration) line += ` | ~${duration} min`;
    if (operator) line += ` | Operator: ${operator}`;
    line += ` | Status: ${r.verification_status}`;
    lines.push(line);
  }

  lines.push("");
  lines.push(lang === "filipino" ? "Pindutin ang 'View Route' para makita ang detalye ng ruta." : "Tap 'View Route' to see route details.");
  return lines.join("\n");
}

function generateFareResponse(
  question: string,
  lang: string,
  fares: Record<string, unknown>[],
  discounts: Record<string, unknown>[],
  locations: Record<string, string>[],
): string {
  const lines: string[] = [];

  if (fares.length > 0) {
    if (lang === "filipino") lines.push("Narito ang mga verified na pamasahe:");
    else if (lang === "taglish") lines.push("Heto ang mga verified fares:");
    else lines.push("Here are the verified fares:");

    for (const f of fares.slice(0, 5)) {
      const routeName = ((f.route as { route_name: string } | null)?.route_name ?? "Unknown route");
      const modeName = ((f.transport_mode as { name: string } | null)?.name ?? "Transport");
      const base = f.base_fare as number | null;
      const minF = f.minimum_fare as number | null;
      const maxF = f.maximum_fare as number | null;
      const fareType = (f.fare_type as string) || "regular";

      let line = `  • ${routeName} | ${modeName} | ${fareType}`;
      if (base !== null) line += ` | Base: ₱${base}`;
      if (minF !== null && maxF !== null) line += ` | Range: ₱${minF} – ₱${maxF}`;
      line += ` | Status: ${f.verification_status}`;
      lines.push(line);
    }

    if (discounts.length > 0) {
      lines.push("");
      lines.push(lang === "filipino" ? "Mga available na discount:" : "Available discounts:");
      for (const d of discounts.slice(0, 3)) {
        let line = `  • ${d.passenger_type || "N/A"}`;
        if (d.discount_value) line += ` (${d.discount_value} ${d.discount_type || "discount"})`;
        if (d.eligibility_notes) line += ` — ${d.eligibility_notes}`;
        lines.push(line);
      }
    }
  } else {
    lines.push(lang === "filipino" ? "Wala pang verified na datos tungkol sa pamasahe para sa rutang ito." : "No verified fare data is available for this route yet.");
  }

  lines.push("");
  lines.push(lang === "filipino" ? "Pindutin ang 'Calculate Fare' para sa fare calculator." : "Tap 'Calculate Fare' to open the fare calculator.");
  return lines.join("\n");
}

function generateScheduleResponse(
  lang: string,
  schedules: Record<string, unknown>[],
  ports: Record<string, unknown>[],
): string {
  const lines: string[] = [];

  if (schedules.length > 0) {
    if (lang === "filipino") lines.push("Narito ang mga verified na ferry/sea transport schedules:");
    else if (lang === "taglish") lines.push("Heto ang mga verified ferry schedules:");
    else lines.push("Here are the verified ferry/sea transport schedules:");

    for (const s of schedules.slice(0, 5)) {
      const depPort = ((s.departure_port as { port_name: string } | null)?.port_name ?? "Unknown");
      const arrPort = ((s.arrival_port as { port_name: string } | null)?.port_name ?? "Unknown");
      const depDt = s.departure_datetime as string | null;
      const operator = (s.operator_name as string) || "Unknown operator";
      const status = (s.status as string) || "unknown";

      let line = `  • ${depPort} → ${arrPort}`;
      if (depDt) {
        try {
          const formatted = new Date(depDt).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
          line += ` | Departure: ${formatted}`;
        } catch {
          line += ` | Departure: ${depDt}`;
        }
      }
      line += ` | ${operator} | Status: ${status}`;
      line += ` | Verified: ${s.verification_status}`;
      lines.push(line);
    }
  } else {
    if (lang === "filipino") lines.push("Wala pang verified na ferry schedule na available sa database.");
    else if (lang === "taglish") lines.push("Wala pang verified ferry schedules sa database ngayon.");
    else lines.push("No verified ferry schedules are currently available in the database.");
  }

  if (ports.length > 0) {
    lines.push("");
    lines.push(lang === "filipino" ? "Mga verified na pantalan (ports):" : "Verified ports:");
    for (const p of ports.slice(0, 3)) {
      lines.push(`  • ${p.port_name || "Unnamed"} | Type: ${p.port_type || "N/A"} | Status: ${p.operating_status || "N/A"}`);
    }
  }

  lines.push("");
  lines.push(lang === "filipino" ? "Pindutin ang 'View Ports' para sa detalye ng pantalan." : "Tap 'View Ports' for port details.");
  return lines.join("\n");
}

function generateTransferResponse(question: string, lang: string): string {
  const lower = question.toLowerCase();
  const hasJeepney = lower.includes("jeepney");
  const hasTricycle = lower.includes("tricycle") || lower.includes("trike");

  if (hasJeepney && hasTricycle) {
    if (lang === "filipino") {
      return (
        "Para maglipat mula jeepney papuntang tricycle:\n" +
        "  1. Hanapin ang pinakamalapit na jeepney terminal o boarding point.\n" +
        "  2. Sabihin sa driver kung saan ka bababa.\n" +
        "  3. Maghanap ng tricycle station o stand malapit sa drop-off point.\n" +
        "  4. Magtanong sa lokal kung saan ang tamang tricycle route.\n\n" +
        "Tandaan: Ang mga transfer points ay nakadepende sa verified route data. " +
        "Gamitin ang Route Planner para sa eksaktong stops."
      );
    }
    return (
      "To transfer from jeepney to tricycle:\n" +
      "  1. Find the nearest jeepney terminal or boarding point.\n" +
      "  2. Tell the driver where you'll alight.\n" +
      "  3. Look for a tricycle station or stand near your drop-off.\n" +
      "  4. Ask locals for the correct tricycle route.\n\n" +
      "Note: Transfer points depend on verified route data. " +
      "Use the Route Planner for exact stops."
    );
  }

  if (lang === "filipino") {
    return "Para sa mga transfer, gamitin ang Route Planner para makita ang mga connection points. Hanapin ang verified routes na may overlapping stops sa parehong location.";
  }
  return "For transfers, use the Route Planner to find connection points. Look for verified routes with overlapping stops at the same location.";
}

function generateBoardingResponse(
  lang: string,
  routes: Record<string, unknown>[],
  locations: Record<string, string>[],
): string {
  const lines: string[] = [];
  lines.push(lang === "filipino" ? "Narito ang mga verified na terminal at boarding points sa Marinduque:" : "Here are the verified terminals and boarding points in Marinduque:");

  const boardingPoints = new Set<string>();
  for (const r of routes.slice(0, 10)) {
    if (!r.id) continue;
  }

  const terminalLocations = locations.filter((l) => l.type === "terminal" || l.type === "port");
  if (terminalLocations.length > 0) {
    for (const loc of terminalLocations.slice(0, 5)) {
      lines.push(`  • ${loc.name || "Unnamed"}, ${loc.municipality || ""}`);
    }
  } else {
    lines.push(lang === "filipino" ? "  Wala pang verified na boarding points sa database." : "  No verified boarding points found in the database yet.");
  }

  lines.push("");
  lines.push(lang === "filipino" ? "Pindutin ang 'Open Map' para makita sa mapa." : "Tap 'Open Map' to see on the map.");
  return lines.join("\n");
}

function generateAlertResponse(lang: string, alerts: Record<string, unknown>[]): string {
  const lines: string[] = [];

  if (alerts.length > 0) {
    if (lang === "filipino") lines.push("Narito ang mga kasalukuyang travel advisories:");
    else if (lang === "taglish") lines.push("Heto ang current travel advisories:");
    else lines.push("Here are the current travel advisories:");

    for (const a of alerts.slice(0, 3)) {
      let line = `  • ${a.title || "Untitled"}`;
      line += ` | Priority: ${a.priority || "N/A"}`;
      if (a.start_at) line += ` | Valid from: ${(a.start_at as string).slice(0, 10)}`;
      if (a.end_at) line += ` | Until: ${(a.end_at as string).slice(0, 10)}`;
      if (a.description) {
        const desc = (a.description as string).slice(0, 80) + ((a.description as string).length > 80 ? "..." : "");
        line += `\n    ${desc}`;
      }
      lines.push(line);
    }
  } else {
    lines.push(lang === "filipino" ? "Wala pang verified na travel advisories sa ngayon." : "No verified travel advisories at this time.");
  }

  return lines.join("\n");
}

function generateGreetingResponse(lang: string): string {
  if (lang === "filipino") {
    return "Kamusta! Ako si Mory AI, ang inyong commuter assistant para sa Marinduque. Maaari mong itanong sa akin tungkol sa mga ruta, pamasahe, ferry schedules, at travel advisories. Halimbawa: 'Paano makakarating mula Boac papuntang Santa Cruz?'";
  }
  if (lang === "taglish") {
    return "Hi! I'm Mory AI, your commuter assistant for Marinduque. You can ask me about routes, fares, ferry schedules, and travel advisories. Example: 'Paano makakarating from Boac to Santa Cruz?'";
  }
  return "Hello! I'm Mory AI, your commuter assistant for Marinduque. Ask me about routes, fares, ferry schedules, and travel advisories. Example: 'How do I get from Boac to Santa Cruz?'";
}

function generateGeneralResponse(lang: string): string {
  if (lang === "filipino") {
    return (
      "Maaari kitang tulungan sa mga sumusunod:\n" +
      "  • Paghahanap ng ruta (route search)\n" +
      "  • Impormasyon tungkol sa pamasahe (fare inquiry)\n" +
      "  • Ferry at sea transport schedules\n" +
      "  • Travel advisories at alerts\n" +
      "  • Transfer points sa pagitan ng jeepney at tricycle\n\n" +
      "Halimbawa: 'Paano makakarating mula Boac papuntang Santa Cruz?' o 'Magkano ang pamasahe sa rutang ito?'"
    );
  }
  if (lang === "taglish") {
    return (
      "I can help you with:\n" +
      "  • Route search (paghahanap ng ruta)\n" +
      "  • Fare inquiry (pamasahe info)\n" +
      "  • Ferry and sea transport schedules\n" +
      "  • Travel advisories and alerts\n" +
      "  • Transfer points between jeepney and tricycle\n\n" +
      "Example: 'Paano makakarating from Boac to Santa Cruz?' or 'Magkano ang pamasahe dito?'"
    );
  }
  return (
    "I can help you with:\n" +
    "  • Route search\n" +
    "  • Fare inquiry\n" +
    "  • Ferry and sea transport schedules\n" +
    "  • Travel advisories and alerts\n" +
    "  • Transfer points between jeepney and tricycle\n\n" +
    "Example: 'How do I get from Boac to Santa Cruz?' or 'How much is the fare for this route?'"
  );
}

// ---------------------------------------------------------------------------
// Main response generator (built-in, no external API needed)
// ---------------------------------------------------------------------------

async function generateResponse(
  supabase: SupaClient,
  question: string,
): Promise<string> {
  if (!question.trim()) return "Please ask a question about transportation in Marinduque.";

  const lang = detectLanguage(question);
  const intent = classifyIntent(question);
  const locations = await getLocations(supabase);

  if (intent === "greeting") return generateGreetingResponse(lang);

  if (intent === "route_search") {
    const { origin, destination } = extractLocations(question, locations);
    const routes = await getRoutes(supabase, origin?.name, destination?.name);
    return generateRouteResponse(question, lang, routes, locations);
  }

  if (intent === "fare_inquiry") {
    const { origin, destination } = extractLocations(question, locations);
    const routes = await getRoutes(supabase, origin?.name, destination?.name);
    const routeIds = routes.map((r) => r.id as string).filter(Boolean);
    let fares: Record<string, unknown>[] = [];
    if (routeIds.length > 0) {
      for (const rid of routeIds) {
        fares = fares.concat(await getFares(supabase, rid));
      }
    } else {
      fares = await getFares(supabase);
    }
    const discounts = await getFareDiscounts(supabase);
    return generateFareResponse(question, lang, fares, discounts, locations);
  }

  if (intent === "schedule_inquiry") {
    const schedules = await getSeaSchedules(supabase);
    const ports = await getPorts(supabase);
    return generateScheduleResponse(lang, schedules, ports);
  }

  if (intent === "transfer_inquiry") {
    return generateTransferResponse(question, lang);
  }

  if (intent === "boarding_point") {
    const routes = await getRoutes(supabase);
    return generateBoardingResponse(lang, routes, locations);
  }

  if (intent === "alert_inquiry") {
    const alerts = await getAlerts(supabase);
    return generateAlertResponse(lang, alerts);
  }

  return generateGeneralResponse(lang);
}

// ---------------------------------------------------------------------------
// Optional: OpenAI enhancement (only if OPENAI_API_KEY is set)
// ---------------------------------------------------------------------------

async function callOpenAI(messages: { role: string; content: string }[]): Promise<string> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) throw new Error("No OPENAI_API_KEY");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: "gpt-4o-mini", messages, max_tokens: 500, temperature: 0.7 }),
  });

  if (!response.ok) throw new Error(`AI provider returned ${response.status}`);

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("AI provider returned empty response");
  return content;
}

// ---------------------------------------------------------------------------
// Edge function handler
// ---------------------------------------------------------------------------

async function handleRequest(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { message, conversationId, history = [], userId } = body as {
      message: string;
      conversationId?: string;
      history?: ConversationMessage[];
      userId?: string;
    };

    if (!message || typeof message !== "string") {
      return new Response(
        JSON.stringify({ error: "Message is required." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (message.length > 1000) {
      return new Response(
        JSON.stringify({ error: "Message is too long. Please keep it under 1000 characters." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ---- Generate response using built-in rule-based AI (no API key needed) ----
    let aiResponse: string;
    try {
      aiResponse = await generateResponse(supabase, message);
    } catch (err) {
      console.error("Response generation error:", err);
      aiResponse = "Paumanhin, may problema sa pagkuha ng datos. Subukan ulit mamaya. (Sorry, there was a problem retrieving data. Please try again later.)";
    }

    // ---- Optional: enhance with OpenAI if key is configured ----
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (openaiKey) {
      try {
        const systemPrompt = `You are Mory AI, a commuter assistant for Marinduque, Philippines. Answer in the user's language (Filipino, English, or Taglish). Use ONLY the data provided. Never invent routes, fares, or schedules. Be concise.\n\nBuilt-in response (use as reference, improve the language but keep the facts):\n${aiResponse}`;
        const messages = [
          { role: "system", content: systemPrompt },
          ...history.slice(-6).map((h) => ({ role: h.role, content: h.content })),
          { role: "user", content: message },
        ];
        aiResponse = await callOpenAI(messages);
      } catch (err) {
        console.error("OpenAI enhancement failed, using built-in response:", err);
        // Keep the built-in response
      }
    }

    // ---- Persist conversation if user is authenticated ----
    let resultConversationId = conversationId;

    if (userId) {
      if (!resultConversationId) {
        const title = message.slice(0, 50) + (message.length > 50 ? "…" : "");
        const { data: conv } = await supabase
          .from("mory_ai_conversations")
          .insert({ user_id: userId, title })
          .select("id")
          .single();
        resultConversationId = conv?.id ?? null;
      }

      if (resultConversationId) {
        await supabase.from("mory_ai_messages").insert({
          conversation_id: resultConversationId,
          role: "user",
          content: message,
        });

        await supabase.from("mory_ai_messages").insert({
          conversation_id: resultConversationId,
          role: "assistant",
          content: aiResponse,
          referenced_record_ids: null,
        });

        await supabase
          .from("mory_ai_conversations")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", resultConversationId);
      }
    }

    return new Response(
      JSON.stringify({
        response: aiResponse,
        conversationId: resultConversationId,
        referencedRecords: null,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("Mory AI error:", err);
    return new Response(
      JSON.stringify({
        response: "Paumanhin, may problema sa sistema. Subukan ulit mamaya.",
        error: "Service temporarily unavailable.",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
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