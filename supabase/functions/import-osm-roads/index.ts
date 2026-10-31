import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const OVERPASS_ENDPOINT = "https://overpass-api.de/api/interpreter";
const USER_AGENT = "MoryonGo/1.0 (contact: admin)";
const SOURCE_NAME = "OpenStreetMap road network";
const SOURCE_PUBLISHER = "OpenStreetMap contributors";
const SOURCE_URL = "https://www.openstreetmap.org/copyright";
const SOURCE_LICENSE = "ODbL 1.0";
const SOURCE_ATTRIBUTION = "Road data © OpenStreetMap contributors, ODbL 1.0";
const BBOX_PADDING_DEG = 0.02;
const SIMPLIFY_TOLERANCE_DEG = 0.00005;
const INSERT_BATCH_SIZE = 500;
const OVERPASS_ATTEMPTS = 2;
const OVERPASS_TIMEOUT_MS = 120_000;
const OVERPASS_RETRY_DELAY_MS = 5_000;

type Position = [number, number];
type Ring = Position[];
type Polygon = Ring[];

interface MunicipalArea {
  id: string;
  name: string;
  polygons: Polygon[];
}

interface OverpassElement {
  type: string;
  id: number;
  tags?: Record<string, string>;
  geometry?: { lat: number; lon: number }[];
}

interface CoverageEntry {
  municipality: string | null;
  roadCount: number;
}

interface RoadRow {
  dataset_version_id: string;
  source_id: string;
  source_feature_id: string;
  road_name: string | null;
  road_classification: string | null;
  surface_type: string | null;
  access_information: string | null;
  municipality_id: string | null;
  barangay_id: null;
  geometry: { type: "LineString"; coordinates: Position[] };
  display_geometry: { type: "LineString"; coordinates: Position[] };
  min_lon: number;
  min_lat: number;
  max_lon: number;
  max_lat: number;
  osm_tags: Record<string, string>;
  quality_flags: string[];
  verification_status: "unverified";
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Unknown error";
}

function isPosition(value: unknown): value is Position {
  return Array.isArray(value) && value.length >= 2 && typeof value[0] === "number" && typeof value[1] === "number";
}

function polygonsOf(data: unknown): Polygon[] {
  if (!data || typeof data !== "object") return [];
  const obj = data as { type?: unknown; geometry?: unknown; coordinates?: unknown };
  const geom = obj.type === "Feature" ? (obj.geometry as typeof obj) : obj;
  if (!geom || !Array.isArray(geom.coordinates)) return [];
  const polygons = geom.type === "Polygon" ? [geom.coordinates] : geom.type === "MultiPolygon" ? geom.coordinates : [];
  return polygons.flatMap((polygon: unknown) => {
    if (!Array.isArray(polygon)) return [];
    const rings = polygon.flatMap((ring: unknown) =>
      Array.isArray(ring) && ring.length >= 4 && ring.every(isPosition) ? [ring as Ring] : [],
    );
    return rings.length > 0 ? [rings] : [];
  });
}

function insideRing(point: Position, ring: Ring): boolean {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function containsPoint(polygons: Polygon[], point: Position): boolean {
  return polygons.some(([outer, ...holes]) => insideRing(point, outer) && !holes.some((hole) => insideRing(point, hole)));
}

function perpendicularDistance(point: Position, start: Position, end: Position): number {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(point[0] - start[0], point[1] - start[1]);
  const t = Math.max(0, Math.min(1, ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / lengthSquared));
  return Math.hypot(point[0] - (start[0] + t * dx), point[1] - (start[1] + t * dy));
}

function simplifyLine(points: Position[], tolerance: number): Position[] {
  if (points.length <= 2) return points;
  const first = points[0];
  const last = points[points.length - 1];
  let maxDistance = 0;
  let splitIndex = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const distance = perpendicularDistance(points[i], first, last);
    if (distance > maxDistance) {
      maxDistance = distance;
      splitIndex = i;
    }
  }
  if (maxDistance <= tolerance) return [first, last];
  const left = simplifyLine(points.slice(0, splitIndex + 1), tolerance);
  const right = simplifyLine(points.slice(splitIndex), tolerance);
  return [...left.slice(0, -1), ...right];
}

function isValidLine(coords: Position[]): boolean {
  if (coords.length < 2) return false;
  const inRange = coords.every(([lon, lat]) => Number.isFinite(lon) && Number.isFinite(lat) && Math.abs(lon) <= 180 && Math.abs(lat) <= 90);
  const distinct = new Set(coords.map(([lon, lat]) => `${lon},${lat}`)).size;
  return inRange && distinct >= 2;
}

function textOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

async function fetchRoadElements(bbox: { minLat: number; minLon: number; maxLat: number; maxLon: number }) {
  const query = `[out:json][timeout:110];way["highway"](${bbox.minLat},${bbox.minLon},${bbox.maxLat},${bbox.maxLon});out geom tags;`;
  let lastError = "Overpass request failed";
  for (let attempt = 1; attempt <= OVERPASS_ATTEMPTS; attempt++) {
    let response: Response;
    try {
      response = await fetch(OVERPASS_ENDPOINT, {
        method: "POST",
        headers: {
          "User-Agent": USER_AGENT,
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: new URLSearchParams({ data: query }),
        signal: AbortSignal.timeout(OVERPASS_TIMEOUT_MS),
      });
    } catch (err) {
      lastError = `Could not reach the OpenStreetMap service (${errorMessage(err)})`;
      await new Promise((resolve) => setTimeout(resolve, OVERPASS_RETRY_DELAY_MS * attempt));
      continue;
    }
    if (response.ok) {
      const body = (await response.json()) as { elements?: unknown };
      if (!Array.isArray(body.elements)) throw new Error("The OpenStreetMap service returned an unexpected response");
      return body.elements as OverpassElement[];
    }
    lastError = `The OpenStreetMap service returned status ${response.status}`;
    if (response.status !== 429 && response.status < 500) break;
    await new Promise((resolve) => setTimeout(resolve, OVERPASS_RETRY_DELAY_MS * attempt));
  }
  throw new Error(lastError);
}

async function markFailed(admin: SupabaseClient, versionId: string, reason: string) {
  await admin
    .from("road_dataset_versions")
    .update({ status: "failed", failure_reason: reason.slice(0, 500) })
    .eq("id", versionId);
}

async function loadMunicipalAreas(admin: SupabaseClient): Promise<MunicipalArea[]> {
  const [{ data: municipalities, error: municipalityError }, { data: boundaries, error: boundaryError }] = await Promise.all([
    admin.from("municipalities").select("id, name"),
    admin.from("municipality_boundaries").select("municipality, geometry_data"),
  ]);
  if (municipalityError) throw new Error(`Municipalities could not be loaded: ${municipalityError.message}`);
  if (boundaryError) throw new Error(`Municipality boundaries could not be loaded: ${boundaryError.message}`);
  const idByName = new Map((municipalities ?? []).map((row) => [row.name, row.id as string]));
  return (boundaries ?? []).flatMap((row) => {
    const id = idByName.get(row.municipality);
    const polygons = polygonsOf(row.geometry_data);
    return id && polygons.length > 0 ? [{ id, name: row.municipality as string, polygons }] : [];
  });
}

function boundingBox(areas: MunicipalArea[]) {
  const points = areas.flatMap((area) => area.polygons.flatMap((polygon) => polygon.flat()));
  return {
    minLon: Math.min(...points.map((p) => p[0])) - BBOX_PADDING_DEG,
    minLat: Math.min(...points.map((p) => p[1])) - BBOX_PADDING_DEG,
    maxLon: Math.max(...points.map((p) => p[0])) + BBOX_PADDING_DEG,
    maxLat: Math.max(...points.map((p) => p[1])) + BBOX_PADDING_DEG,
  };
}

function buildRoadRow(
  element: OverpassElement,
  coords: Position[],
  areas: MunicipalArea[],
  versionId: string,
  sourceId: string,
): RoadRow {
  const tags = element.tags ?? {};
  const midpoint = coords[Math.floor(coords.length / 2)];
  const municipality = areas.find((area) => containsPoint(area.polygons, midpoint)) ?? null;
  const roadName = textOrNull(tags.name);
  const flags: string[] = [];
  if (!roadName) flags.push("missing_name");
  if (!municipality) flags.push("outside_municipal_boundaries");
  const lons = coords.map((p) => p[0]);
  const lats = coords.map((p) => p[1]);
  return {
    dataset_version_id: versionId,
    source_id: sourceId,
    source_feature_id: `way/${element.id}`,
    road_name: roadName,
    road_classification: textOrNull(tags.highway),
    surface_type: textOrNull(tags.surface),
    access_information: textOrNull(tags.access),
    municipality_id: municipality?.id ?? null,
    barangay_id: null,
    geometry: { type: "LineString", coordinates: coords },
    display_geometry: { type: "LineString", coordinates: simplifyLine(coords, SIMPLIFY_TOLERANCE_DEG) },
    min_lon: Math.min(...lons),
    min_lat: Math.min(...lats),
    max_lon: Math.max(...lons),
    max_lat: Math.max(...lats),
    osm_tags: tags,
    quality_flags: flags,
    verification_status: "unverified",
  };
}

async function findOrCreateSource(admin: SupabaseClient, userId: string | null): Promise<string> {
  const { data: existing, error: lookupError } = await admin
    .from("geographic_data_sources")
    .select("id")
    .eq("name", SOURCE_NAME)
    .maybeSingle();
  if (lookupError) throw new Error(`Source record could not be loaded: ${lookupError.message}`);
  if (existing) return existing.id as string;
  const { data: created, error: createError } = await admin
    .from("geographic_data_sources")
    .insert({
      name: SOURCE_NAME,
      publisher: SOURCE_PUBLISHER,
      source_url: SOURCE_URL,
      license: SOURCE_LICENSE,
      notes: "Highway ways from the Overpass API, limited to the Marinduque bounding box.",
      origin_checked: false,
      imported_by: userId,
    })
    .select("id")
    .single();
  if (createError) throw new Error(`Source record could not be created: ${createError.message}`);
  return created.id as string;
}

async function runImport(admin: SupabaseClient, userId: string | null): Promise<Response> {
  const areas = await loadMunicipalAreas(admin);
  if (areas.length === 0) return json({ error: "No municipality boundaries are available to assign roads to." }, 409);
  const bbox = boundingBox(areas);

  const { data: latest, error: latestError } = await admin
    .from("road_dataset_versions")
    .select("version")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestError) throw new Error(`Version history could not be read: ${latestError.message}`);

  const sourceId = await findOrCreateSource(admin, userId);
  const sourceQuery = `way["highway"](${bbox.minLat},${bbox.minLon},${bbox.maxLat},${bbox.maxLon})`;
  const { data: version, error: versionError } = await admin
    .from("road_dataset_versions")
    .insert({
      version: (latest?.version ?? 0) + 1,
      status: "importing",
      source_id: sourceId,
      source_name: SOURCE_NAME,
      source_license: SOURCE_LICENSE,
      source_attribution: SOURCE_ATTRIBUTION,
      source_endpoint: OVERPASS_ENDPOINT,
      source_query: sourceQuery,
      bbox: { minLon: bbox.minLon, minLat: bbox.minLat, maxLon: bbox.maxLon, maxLat: bbox.maxLat },
      imported_by: userId,
    })
    .select("id, version")
    .single();
  if (versionError) {
    if (versionError.code === "23505") return json({ error: "Another road import is already running." }, 409);
    throw new Error(`Import could not be started: ${versionError.message}`);
  }
  const versionId = version.id as string;

  let elements: OverpassElement[];
  try {
    elements = await fetchRoadElements(bbox);
  } catch (err) {
    const reason = errorMessage(err);
    await markFailed(admin, versionId, reason);
    return json({ error: `${reason}. No road data was changed.`, versionId }, 502);
  }

  const seen = new Set<number>();
  const roads: RoadRow[] = [];
  let duplicateCount = 0;
  let invalidCount = 0;
  for (const element of elements) {
    if (element.type !== "way") {
      invalidCount++;
      continue;
    }
    if (seen.has(element.id)) {
      duplicateCount++;
      continue;
    }
    seen.add(element.id);
    const coords = (element.geometry ?? []).map((p): Position => [p.lon, p.lat]);
    if (!isValidLine(coords)) {
      invalidCount++;
      continue;
    }
    roads.push(buildRoadRow(element, coords, areas, versionId, sourceId));
  }

  for (let start = 0; start < roads.length; start += INSERT_BATCH_SIZE) {
    const { error: insertError } = await admin
      .from("road_segments")
      .insert(roads.slice(start, start + INSERT_BATCH_SIZE));
    if (insertError) {
      await admin.from("road_segments").delete().eq("dataset_version_id", versionId);
      await markFailed(admin, versionId, `Saving roads failed: ${insertError.message}`);
      return json({ error: "Saving the road data failed. No published roads were changed.", versionId }, 500);
    }
  }

  const coverage: CoverageEntry[] = areas.map((area) => ({
    municipality: area.name,
    roadCount: roads.filter((road) => road.municipality_id === area.id).length,
  }));
  coverage.push({ municipality: null, roadCount: roads.filter((road) => road.municipality_id === null).length });

  const { error: finalizeError } = await admin
    .from("road_dataset_versions")
    .update({
      status: "staging",
      source_fetched_at: new Date().toISOString(),
      raw_element_count: elements.length,
      road_count: roads.length,
      invalid_count: invalidCount,
      duplicate_count: duplicateCount,
      municipality_coverage: coverage,
    })
    .eq("id", versionId);
  if (finalizeError) {
    await admin.from("road_segments").delete().eq("dataset_version_id", versionId);
    await markFailed(admin, versionId, `Finalizing the import failed: ${finalizeError.message}`);
    return json({ error: "Finalizing the import failed. No published roads were changed.", versionId }, 500);
  }

  return json({
    versionId,
    version: version.version,
    rawElementCount: elements.length,
    roadCount: roads.length,
    invalidCount,
    duplicateCount,
    coverage,
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
      auth: { persistSession: false },
    });
    const { data: isAdmin, error: adminError } = await userClient.rpc("is_alert_admin");
    if (adminError) return json({ error: "Administrator access could not be verified." }, 500);
    if (!isAdmin) return json({ error: "Only administrators can import road data." }, 403);
    const { data: userData } = await userClient.auth.getUser();

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    return await runImport(admin, userData.user?.id ?? null);
  } catch (err) {
    console.error("import-osm-roads failed:", errorMessage(err));
    return json({ error: `The road import failed: ${errorMessage(err)}` }, 500);
  }
});
