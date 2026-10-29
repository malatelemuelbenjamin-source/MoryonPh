"""
Mory AI Assistant - Python Alternative to OpenAI
==================================================

A rule-based AI commuter assistant for Marinduque that generates natural
language responses in Filipino, English, or Taglish using verified Supabase
data. No external AI API key required.

Usage:
    # CLI mode
    python mory_ai_assistant.py "Paano makakarating mula Boac papuntang Santa Cruz?"

    # Interactive mode
    python mory_ai_assistant.py --interactive

    # API server mode (FastAPI)
    python mory_ai_assistant.py --serve --port 8000

Environment variables (reads from .env or set directly):
    SUPABASE_URL
    SUPABASE_SERVICE_ROLE_KEY
"""

import os
import re
import sys
import json
import argparse
from datetime import datetime
from typing import Optional

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

try:
    from supabase import create_client, Client
except ImportError:
    print("Install dependencies: pip install supabase python-dotenv fastapi uvicorn")
    sys.exit(1)


# ---------------------------------------------------------------------------
# Supabase connection
# ---------------------------------------------------------------------------

SUPABASE_URL = os.environ.get("SUPABASE_URL", os.environ.get("VITE_SUPABASE_URL", ""))
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

supabase: Optional[Client] = None
if SUPABASE_URL and SUPABASE_KEY:
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)


# ---------------------------------------------------------------------------
# Marinduque municipalities (for location matching)
# ---------------------------------------------------------------------------

MUNICIPALITIES = [
    "boac", "santa cruz", "mogpog", "gasan", "buenavista",
    "torrijos", "sta cruz", "gasan", "mogpog",
]


# ---------------------------------------------------------------------------
# Language detection
# ---------------------------------------------------------------------------

FILIPINO_MARKERS = [
    "paano", "saan", "magkano", "pamasahe", "ruta", "sasakay", "bababa",
    "transfer", "ferry", "pantalan", "bangka", "skedyul", "presyo",
    "gusto", "hanap", "ipakita", "tulungan", "suriin", "lipat",
    "mula", "papunta", "papuntang", "biyahe", "sakay", " terminals",
]

ENGLISH_MARKERS = [
    "how", "where", "how much", "fare", "route", "schedule", "transport",
    "from", "to", "nearest", "available", "ferry", "port", "boat",
    "transfer", "cost", "price", "find", "show", "help",
]


def detect_language(text: str) -> str:
    """Detect if text is Filipino, English, or Taglish."""
    text_lower = text.lower()
    has_filipino = any(m in text_lower for m in FILIPINO_MARKERS)
    has_english = any(m in text_lower for m in ENGLISH_MARKERS)
    if has_filipino and has_english:
        return "taglish"
    if has_filipino:
        return "filipino"
    return "english"


# ---------------------------------------------------------------------------
# Intent classification
# ---------------------------------------------------------------------------

INTENT_PATTERNS = {
    "route_search": [
        r"\b(paano|how)\b.*\b(makakarating|pumunta|get to|go to|reach)\b",
        r"\b(ipakita|show|find|hanap)\b.*\b(ruta|route)\b",
        r"\b(ruta|route)\b.*\b(options?|options)\b",
        r"\b(mula|from)\b.*\b(papuntang|to|pupunta)\b",
    ],
    "fare_inquiry": [
        r"\b(magkano|how much|cost|presyo|price)\b",
        r"\b(pamasahe|fare)\b",
    ],
    "schedule_inquiry": [
        r"\b(schedule|skedyul|oras|time|available)\b.*\b(ferry|boat|bangka|roro|sea)\b",
        r"\b(ferry|boat|bangka|roro)\b.*\b(schedule|skedyul|oras|time)\b",
        r"\b(available|mayroon|may)\b.*\b(ferry|boat|schedule)\b",
    ],
    "transfer_inquiry": [
        r"\b(transfer|lipat|switch)\b",
        r"\b(jeepney|tricycle)\b.*\b(papuntang|to)\b.*\b(jeepney|tricycle)\b",
    ],
    "boarding_point": [
        r"\b(saan|where)\b.*\b(sasakay|board|terminal|boarding)\b",
        r"\b(nearest|pinakamalapit)\b.*\b(terminal|boarding|sakay)\b",
    ],
    "alert_inquiry": [
        r"\b(alert|advisory|babala|cancel|delay|suspension)\b",
    ],
    "greeting": [
        r"^(hi|hello|kamusta|mabuhay|hey|yo)\b",
    ],
}


def classify_intent(text: str) -> str:
    text_lower = text.lower()
    for intent, patterns in INTENT_PATTERNS.items():
        for pattern in patterns:
            if re.search(pattern, text_lower):
                return intent
    # Fallback heuristics
    if any(w in text_lower for w in ["fare", "pamasahe", "magkano"]):
        return "fare_inquiry"
    if any(w in text_lower for w in ["ferry", "boat", "schedule", "skedyul"]):
        return "schedule_inquiry"
    if any(w in text_lower for w in ["route", "ruta", "paano", "how"]):
        return "route_search"
    return "general"


# ---------------------------------------------------------------------------
# Entity extraction (origin, destination)
# ---------------------------------------------------------------------------

def extract_locations(text: str, known_locations: list[dict]) -> dict:
    """Extract origin and destination from user text by matching known locations."""
    text_lower = text.lower()
    origin = None
    destination = None

    # Pattern: "mula X papuntang Y" / "from X to Y"
    patterns = [
        r"(?:mula|from)\s+([a-zA-Z\s]+?)\s+(?:papuntang|papunta sa|to|pupunta)",
        r"(?:papuntang|to)\s+([a-zA-Z\s]+)",
    ]

    for loc in known_locations:
        name = (loc.get("name") or "").lower()
        muni = (loc.get("municipality") or "").lower()
        if not name:
            continue
        if name in text_lower or (muni and muni in text_lower):
            # Check if it appears after "mula/from" (origin) or "papuntang/to" (destination)
            if re.search(rf"(?:mula|from)\s+{re.escape(name)}", text_lower) or re.search(rf"(?:mula|from)\s+{re.escape(muni)}", text_lower):
                origin = loc
            elif re.search(rf"(?:papuntang|papunta|to|pupunta)\s+{re.escape(name)}", text_lower) or re.search(rf"(?:papuntang|papunta|to|pupunta)\s+{re.escape(muni)}", text_lower):
                destination = loc
            elif not destination:
                destination = loc
            elif not origin:
                origin = loc

    # Check raw municipality names
    for muni in MUNICIPALITIES:
        if muni in text_lower:
            if re.search(rf"(?:mula|from)\s+{re.escape(muni)}", text_lower):
                if not origin:
                    origin = {"name": muni.title(), "municipality": muni.title()}
            elif re.search(rf"(?:papuntang|to|pupunta)\s+{re.escape(muni)}", text_lower):
                if not destination:
                    destination = {"name": muni.title(), "municipality": muni.title()}

    return {"origin": origin, "destination": destination}


# ---------------------------------------------------------------------------
# Data retrieval functions
# ---------------------------------------------------------------------------

def get_verified_locations() -> list[dict]:
    if not supabase:
        return []
    result = supabase.table("locations").select("id, name, municipality, barangay, type").execute()
    return result.data or []


def get_verified_routes(origin_name: str = None, dest_name: str = None) -> list[dict]:
    if not supabase:
        return []
    query = supabase.table("routes").select(
        "id, route_name, route_code, direction, operator_name, "
        "estimated_duration_minutes, verification_status, last_verified_at, "
        "origin_location:locations!origin_location_id(id, name, municipality), "
        "destination_location:locations!destination_location_id(id, name, municipality), "
        "transport_mode:transport_modes(id, name, code)"
    ).eq("route_status", "active").in_("verification_status", ["official", "verified"])

    result = query.execute()
    routes = result.data or []

    if origin_name or dest_name:
        filtered = []
        origin_l = (origin_name or "").lower()
        dest_l = (dest_name or "").lower()
        for r in routes:
            r_origin = ((r.get("origin_location") or {}).get("name") or "").lower()
            r_dest = ((r.get("destination_location") or {}).get("name") or "").lower()
            r_muni_o = ((r.get("origin_location") or {}).get("municipality") or "").lower()
            r_muni_d = ((r.get("destination_location") or {}).get("municipality") or "").lower()
            if origin_name and dest_name:
                if (origin_l in r_origin or origin_l in r_muni_o) and (dest_l in r_dest or dest_l in r_muni_d):
                    filtered.append(r)
                elif (origin_l in r_dest or origin_l in r_muni_d) and (dest_l in r_origin or dest_l in r_muni_o):
                    filtered.append(r)
            elif origin_name:
                if origin_l in r_origin or origin_l in r_dest or origin_l in r_muni_o or origin_l in r_muni_d:
                    filtered.append(r)
            elif dest_name:
                if dest_l in r_origin or dest_l in r_dest or dest_l in r_muni_o or dest_l in r_muni_d:
                    filtered.append(r)
        return filtered

    return routes


def get_verified_fares(route_id: str = None) -> list[dict]:
    if not supabase:
        return []
    select = (
        "id, base_fare, minimum_fare, maximum_fare, fare_type, currency, "
        "effective_from, effective_until, verification_status, "
        "route:routes(id, route_name), "
        "transport_mode:transport_modes(id, name)"
    )
    query = supabase.table("fares").select(select).in_("verification_status", ["official", "verified"])
    if route_id:
        query = query.eq("route_id", route_id)
    result = query.limit(10).execute()
    return result.data or []


def get_fare_discounts() -> list[dict]:
    if not supabase:
        return []
    result = supabase.table("fare_discounts").select(
        "id, passenger_type, discount_type, discount_value, eligibility_notes, "
        "required_document, verification_status"
    ).in_("verification_status", ["official", "verified"]).execute()
    return result.data or []


def get_sea_schedules() -> list[dict]:
    if not supabase:
        return []
    result = supabase.table("sea_transport_schedules").select(
        "id, operator_name, departure_datetime, arrival_datetime, schedule_type, "
        "status, effective_from, effective_until, verification_status, "
        "departure_port:ports!departure_port_id(id, port_name), "
        "arrival_port:ports!arrival_port_id(id, port_name)"
    ).in_("verification_status", ["official", "verified"]).execute()
    return result.data or []


def get_local_alerts() -> list[dict]:
    if not supabase:
        return []
    now = datetime.utcnow().isoformat()
    result = supabase.table("local_alerts").select(
        "id, title, description, category, priority, start_at, end_at, "
        "verification_status"
    ).in_("verification_status", ["official", "verified"]).execute()
    return result.data or []


def get_route_stops(route_id: str) -> list[dict]:
    if not supabase:
        return []
    result = supabase.table("route_stops").select(
        "id, stop_sequence, stop_type, pickup_allowed, dropoff_allowed, notes, "
        "location:locations(id, name, municipality)"
    ).eq("route_id", route_id).order("stop_sequence").execute()
    return result.data or []


def get_tricycle_service_areas() -> list[dict]:
    if not supabase:
        return []
    result = supabase.table("tricycle_service_areas").select(
        "id, name, description, coverage_type, verification_status"
    ).in_("verification_status", ["official", "verified"]).execute()
    return result.data or []


# ---------------------------------------------------------------------------
# Response generation
# ---------------------------------------------------------------------------

def generate_route_response(question: str, lang: str, locations: list[dict]) -> str:
    """Generate a response for route-related questions."""
    entities = extract_locations(question, locations)
    origin = entities.get("origin")
    dest = entities.get("destination")

    if not origin and not dest:
        if lang == "filipino":
            return ("Saan ang gusto mong puntahan at saan ka magsisimula? "
                    "Halimbawa: 'Paano makakarating mula Boac papuntang Santa Cruz?'")
        elif lang == "taglish":
            return ("Saan ang origin mo at saan ang destination? "
                    "Example: 'Paano makakarating from Boac papuntang Santa Cruz?'")
        return ("Where are you coming from and where do you want to go? "
                "Example: 'How do I get from Boac to Santa Cruz?'")

    origin_name = (origin or {}).get("name") or (origin or {}).get("municipality") or ""
    dest_name = (dest or {}).get("name") or (dest or {}).get("municipality") or ""

    routes = get_verified_routes(origin_name, dest_name)

    if not routes:
        if lang == "filipino":
            return (f"Wala pang verified na ruta na nahanap mula {origin_name} "
                    f"patungo sa {dest_name}. Maaaring hindi pa naka-record ang "
                    f"rutang ito sa MoryonGo database. Subukang gamitin ang Route "
                    f"Planner para sa iba pang options.")
        return (f"No verified route found from {origin_name} to {dest_name}. "
                f"This route may not yet be recorded in the MoryonGo database. "
                f"Try using the Route Planner for other options.")

    lines = []
    if lang == "filipino":
        lines.append(f"Narito ang mga verified na ruta mula {origin_name} papuntang {dest_name}:")
    elif lang == "taglish":
        lines.append(f"Heto ang mga verified routes from {origin_name} to {dest_name}:")
    else:
        lines.append(f"Here are the verified routes from {origin_name} to {dest_name}:")

    for r in routes[:5]:
        mode = ((r.get("transport_mode") or {}).get("name") or "Transport")
        r_origin = ((r.get("origin_location") or {}).get("name") or "Unknown")
        r_dest = ((r.get("destination_location") or {}).get("name") or "Unknown")
        route_name = r.get("route_name") or "Unnamed route"
        duration = r.get("estimated_duration_minutes")
        operator = r.get("operator_name") or ""

        line = f"  • {route_name}"
        if r.get("route_code"):
            line += f" (Code: {r['route_code']})"
        line += f" | {mode} | {r_origin} → {r_dest}"
        if duration:
            line += f" | ~{duration} min"
        if operator:
            line += f" | Operator: {operator}"
        line += f" | Status: {r.get('verification_status', 'unknown')}"
        lines.append(line)

    lines.append("")
    if lang == "filipino":
        lines.append("Pindutin ang 'View Route' para makita ang detalye ng ruta.")
    elif lang == "taglish":
        lines.append("Tap 'View Route' to see route details.")
    else:
        lines.append("Tap 'View Route' to see route details.")

    return "\n".join(lines)


def generate_fare_response(question: str, lang: str, locations: list[dict]) -> str:
    """Generate a response for fare-related questions."""
    entities = extract_locations(question, locations)
    origin_name = (entities.get("origin") or {}).get("name") or ""
    dest_name = (entities.get("destination") or {}).get("name") or ""

    routes = get_verified_routes(origin_name, dest_name) if (origin_name or dest_name) else []
    route_ids = [r["id"] for r in routes if r.get("id")]

    fares = []
    if route_ids:
        for rid in route_ids:
            fares.extend(get_verified_fares(rid))
    else:
        fares = get_verified_fares()

    discounts = get_fare_discounts()

    lines = []
    if fares:
        if lang == "filipino":
            lines.append("Narito ang mga verified na pamasahe:")
        elif lang == "taglish":
            lines.append("Heto ang mga verified fares:")
        else:
            lines.append("Here are the verified fares:")

        for f in fares[:5]:
            route_name = ((f.get("route") or {}).get("route_name") or "Unknown route")
            mode = ((f.get("transport_mode") or {}).get("name") or "Transport")
            base = f.get("base_fare")
            min_f = f.get("minimum_fare")
            max_f = f.get("maximum_fare")
            fare_type = f.get("fare_type") or "regular"

            line = f"  • {route_name} | {mode} | {fare_type}"
            if base is not None:
                line += f" | Base: ₱{base}"
            if min_f is not None and max_f is not None:
                line += f" | Range: ₱{min_f} – ₱{max_f}"
            currency = f.get("currency") or "PHP"
            line += f" | {currency} | Status: {f.get('verification_status', 'unknown')}"
            lines.append(line)

        if discounts:
            lines.append("")
            if lang == "filipino":
                lines.append("Mga available na discount:")
            elif lang == "taglish":
                lines.append("Available discounts:")
            else:
                lines.append("Available discounts:")
            for d in discounts[:3]:
                line = f"  • {d.get('passenger_type', 'N/A')}"
                if d.get("discount_value"):
                    line += f" ({d['discount_value']} {d.get('discount_type', 'discount')})"
                if d.get("eligibility_notes"):
                    line += f" — {d['eligibility_notes']}"
                lines.append(line)
    else:
        if lang == "filipino":
            lines.append("Wala pang verified na datos tungkol sa pamasahe para sa rutang ito.")
        elif lang == "taglish":
            lines.append("Wala pang verified fare data para sa route na ito.")
        else:
            lines.append("No verified fare data is available for this route yet.")

    lines.append("")
    if lang == "filipino":
        lines.append("Pindutin ang 'Calculate Fare' para sa fare calculator.")
    elif lang == "taglish":
        lines.append("Tap 'Calculate Fare' to open the fare calculator.")
    else:
        lines.append("Tap 'Calculate Fare' to open the fare calculator.")

    return "\n".join(lines)


def generate_schedule_response(question: str, lang: str) -> str:
    """Generate a response for schedule/ferry-related questions."""
    schedules = get_sea_schedules()
    ports_query = supabase.table("ports").select(
        "id, port_name, port_type, operating_status, verification_status"
    ).in_("verification_status", ["official", "verified"]).execute() if supabase else None
    ports = (ports_query.data if ports_query else [])

    lines = []
    if schedules:
        if lang == "filipino":
            lines.append("Narito ang mga verified na ferry/sea transport schedules:")
        elif lang == "taglish":
            lines.append("Heto ang mga verified ferry schedules:")
        else:
            lines.append("Here are the verified ferry/sea transport schedules:")

        now = datetime.utcnow()
        for s in schedules[:5]:
            dep_port = ((s.get("departure_port") or {}).get("port_name") or "Unknown")
            arr_port = ((s.get("arrival_port") or {}).get("port_name") or "Unknown")
            dep_dt = s.get("departure_datetime")
            arr_dt = s.get("arrival_datetime")
            operator = s.get("operator_name") or "Unknown operator"
            status = s.get("status") or "unknown"
            sched_type = s.get("schedule_type") or "regular"

            line = f"  • {dep_port} → {arr_port}"
            if dep_dt:
                try:
                    dep_formatted = datetime.fromisoformat(dep_dt.replace("Z", "+00:00")).strftime("%b %d, %Y %H:%M")
                    line += f" | Departure: {dep_formatted}"
                except Exception:
                    line += f" | Departure: {dep_dt}"
            if arr_dt:
                try:
                    arr_formatted = datetime.fromisoformat(arr_dt.replace("Z", "+00:00")).strftime("%b %d, %H:%M")
                    line += f" | Arrival: {arr_formatted}"
                except Exception:
                    line += f" | Arrival: {arr_dt}"
            line += f" | {sched_type} | {operator} | Status: {status}"
            line += f" | Verified: {s.get('verification_status', 'unknown')}"
            lines.append(line)
    else:
        if lang == "filipino":
            lines.append("Wala pang verified na ferry schedule na available sa database.")
        elif lang == "taglish":
            lines.append("Wala pang verified ferry schedules sa database ngayon.")
        else:
            lines.append("No verified ferry schedules are currently available in the database.")

    if ports:
        lines.append("")
        if lang == "filipino":
            lines.append("Mga verified na pantalan (ports):")
        elif lang == "taglish":
            lines.append("Verified ports:")
        else:
            lines.append("Verified ports:")
        for p in ports[:3]:
            line = f"  • {p.get('port_name', 'Unnamed')}"
            line += f" | Type: {p.get('port_type', 'N/A')}"
            line += f" | Status: {p.get('operating_status', 'N/A')}"
            lines.append(line)

    lines.append("")
    if lang == "filipino":
        lines.append("Pindutin ang 'View Ports' para sa detalye ng pantalan.")
    elif lang == "taglish":
        lines.append("Tap 'View Ports' for port details.")
    else:
        lines.append("Tap 'View Ports' for port details.")

    return "\n".join(lines)


def generate_transfer_response(question: str, lang: str) -> str:
    """Generate a response for transfer-related questions."""
    text_lower = question.lower()
    lines = []

    has_jeepney = "jeepney" in text_lower
    has_tricycle = "tricycle" in text_lower or "trike" in text_lower

    if has_jeepney and has_tricycle:
        if lang == "filipino":
            lines.append(
                "Para maglipat mula jeepney papuntang tricycle:\n"
                "  1. Hanapin ang pinakamalapit na jeepney terminal o boarding point.\n"
                "  2. Sabihin sa driver kung saan ka bababa.\n"
                "  3. Maghanap ng tricycle station o stand malapit sa drop-off point.\n"
                "  4. Magtanong sa lokal kung saan ang tamang tricycle route.\n\n"
                "Tandaan: Ang mga transfer points ay nakadepende sa verified route data. "
                "Gamitin ang Route Planner para sa eksaktong stops."
            )
        elif lang == "taglish":
            lines.append(
                "To transfer from jeepney to tricycle:\n"
                "  1. Find the nearest jeepney terminal or boarding point.\n"
                "  2. Tell the driver where you'll alight (bababa).\n"
                "  3. Look for a tricycle station near the drop-off.\n"
                "  4. Ask locals for the right tricycle route.\n\n"
                "Note: Transfer points depend on verified route data. "
                "Use the Route Planner for exact stops."
            )
        else:
            lines.append(
                "To transfer from jeepney to tricycle:\n"
                "  1. Find the nearest jeepney terminal or boarding point.\n"
                "  2. Tell the driver where you'll alight.\n"
                "  3. Look for a tricycle station or stand near your drop-off.\n"
                "  4. Ask locals for the correct tricycle route.\n\n"
                "Note: Transfer points depend on verified route data. "
                "Use the Route Planner for exact stops."
            )
    else:
        if lang == "filipino":
            lines.append(
                "Para sa mga transfer, gamitin ang Route Planner para makita ang "
                "mga connection points. Hanapin ang verified routes na may "
                "overlapping stops sa parehong location."
            )
        else:
            lines.append(
                "For transfers, use the Route Planner to find connection points. "
                "Look for verified routes with overlapping stops at the same location."
            )

    return "\n".join(lines)


def generate_boarding_response(question: str, lang: str, locations: list[dict]) -> str:
    """Generate a response for boarding point questions."""
    lines = []
    if lang == "filipino":
        lines.append(
            "Narito ang mga verified na terminal at boarding points sa Marinduque:"
        )
    elif lang == "taglish":
        lines.append("Here are the verified terminals and boarding points in Marinduque:")
    else:
        lines.append("Here are the verified terminals and boarding points in Marinduque:")

    # Get route stops that allow pickup
    routes = get_verified_routes()
    boarding_points = set()
    for r in routes[:10]:
        stops = get_route_stops(r["id"])
        for stop in stops:
            if stop.get("pickup_allowed"):
                loc_name = ((stop.get("location") or {}).get("name") or "")
                muni = ((stop.get("location") or {}).get("municipality") or "")
                if loc_name:
                    boarding_points.add(f"{loc_name}, {muni}".strip(", "))

    if boarding_points:
        for bp in sorted(boarding_points)[:5]:
            lines.append(f"  • {bp}")
    else:
        terminal_locations = [l for l in locations if l.get("type") == "terminal"]
        if terminal_locations:
            for loc in terminal_locations[:5]:
                lines.append(f"  • {loc.get('name', 'Unnamed')}, {loc.get('municipality', '')}")
        else:
            if lang == "filipino":
                lines.append("  Wala pang verified na boarding points sa database.")
            else:
                lines.append("  No verified boarding points found in the database yet.")

    lines.append("")
    if lang == "filipino":
        lines.append("Pindutin ang 'Open Map' para makita sa mapa.")
    else:
        lines.append("Tap 'Open Map' to see on the map.")

    return "\n".join(lines)


def generate_alert_response(lang: str) -> str:
    """Generate a response for alert-related questions."""
    alerts = get_local_alerts()
    lines = []

    if alerts:
        if lang == "filipino":
            lines.append("Narito ang mga kasalukuyang travel advisories:")
        elif lang == "taglish":
            lines.append("Heto ang current travel advisories:")
        else:
            lines.append("Here are the current travel advisories:")

        for a in alerts[:3]:
            line = f"  • {a.get('title', 'Untitled')}"
            line += f" | Priority: {a.get('priority', 'N/A')}"
            if a.get("start_at"):
                line += f" | Valid from: {a.get('start_at', '')[:10]}"
            if a.get("end_at"):
                line += f" | Until: {a.get('end_at', '')[:10]}"
            if a.get("description"):
                desc = a["description"][:80] + ("..." if len(a["description"]) > 80 else "")
                line += f"\n    {desc}"
            lines.append(line)
    else:
        if lang == "filipino":
            lines.append("Wala pang verified na travel advisories sa ngayon.")
        elif lang == "taglish":
            lines.append("Wala pang verified travel advisories ngayon.")
        else:
            lines.append("No verified travel advisories at this time.")

    return "\n".join(lines)


def generate_greeting_response(lang: str) -> str:
    """Generate a greeting response."""
    if lang == "filipino":
        return (
            "Kamusta! Ako si Mory AI, ang inyong commuter assistant para sa Marinduque. "
            "Maaari mong itanong sa akin tungkol sa mga ruta, pamasahe, ferry schedules, "
            "at travel advisories. Halimbawa: 'Paano makakarating mula Boac papuntang Santa Cruz?'"
        )
    elif lang == "taglish":
        return (
            "Hi! I'm Mory AI, your commuter assistant for Marinduque. "
            "You can ask me about routes, fares, ferry schedules, and travel advisories. "
            "Example: 'Paano makakarating from Boac to Santa Cruz?'"
        )
    return (
        "Hello! I'm Mory AI, your commuter assistant for Marinduque. "
        "Ask me about routes, fares, ferry schedules, and travel advisories. "
        "Example: 'How do I get from Boac to Santa Cruz?'"
    )


def generate_general_response(question: str, lang: str) -> str:
    """Generate a general/fallback response."""
    if lang == "filipino":
        return (
            "Maaari kitang tulungan sa mga sumusunod:\n"
            "  • Paghahanap ng ruta (route search)\n"
            "  • Impormasyon tungkol sa pamasahe (fare inquiry)\n"
            "  • Ferry at sea transport schedules\n"
            "  • Travel advisories at alerts\n"
            "  • Transfer points sa pagitan ng jeepney at tricycle\n\n"
            "Halimbawa: 'Paano makakarating mula Boac papuntang Santa Cruz?' "
            "o 'Magkano ang pamasahe sa rutang ito?'"
        )
    elif lang == "taglish":
        return (
            "I can help you with:\n"
            "  • Route search (paghahanap ng ruta)\n"
            "  • Fare inquiry (pamasahe info)\n"
            "  • Ferry and sea transport schedules\n"
            "  • Travel advisories and alerts\n"
            "  • Transfer points between jeepney and tricycle\n\n"
            "Example: 'Paano makakarating from Boac to Santa Cruz?' "
            "or 'Magkano ang pamasahe dito?'"
        )
    return (
        "I can help you with:\n"
        "  • Route search\n"
        "  • Fare inquiry\n"
        "  • Ferry and sea transport schedules\n"
        "  • Travel advisories and alerts\n"
        "  • Transfer points between jeepney and tricycle\n\n"
        "Example: 'How do I get from Boac to Santa Cruz?' "
        "or 'How much is the fare for this route?'"
    )


# ---------------------------------------------------------------------------
# Main response generator
# ---------------------------------------------------------------------------

def generate_response(question: str, history: list[dict] = None) -> str:
    """
    Generate a natural language response to a commuter question.
    Uses verified Supabase data only — never invents routes, fares, or schedules.
    """
    if not question or not question.strip():
        return "Please ask a question about transportation in Marinduque."

    lang = detect_language(question)
    intent = classify_intent(question)
    locations = get_verified_locations()

    if intent == "greeting":
        return generate_greeting_response(lang)
    elif intent == "route_search":
        return generate_route_response(question, lang, locations)
    elif intent == "fare_inquiry":
        return generate_fare_response(question, lang, locations)
    elif intent == "schedule_inquiry":
        return generate_schedule_response(question, lang)
    elif intent == "transfer_inquiry":
        return generate_transfer_response(question, lang)
    elif intent == "boarding_point":
        return generate_boarding_response(question, lang, locations)
    elif intent == "alert_inquiry":
        return generate_alert_response(lang)
    else:
        return generate_general_response(question, lang)


# ---------------------------------------------------------------------------
# CLI / Interactive / Server modes
# ---------------------------------------------------------------------------

def cli_mode(question: str):
    response = generate_response(question)
    print(response)


def interactive_mode():
    print("=" * 60)
    print("  Mory AI Assistant - Marinduque Commuter Helper")
    print("  Type 'quit' or 'exit' to leave.")
    print("=" * 60)
    print()
    print(generate_greeting_response("taglish"))
    print()

    history = []
    while True:
        try:
            user_input = input("You: ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nPaalam! (Goodbye!)")
            break

        if user_input.lower() in ("quit", "exit", "q"):
            print("Paalam! (Goodbye!)")
            break

        if not user_input:
            continue

        print("\nMory AI:", end=" ")
        response = generate_response(user_input, history)
        print(response)
        print()

        history.append({"role": "user", "content": user_input})
        history.append({"role": "assistant", "content": response})


def server_mode(port: int = 8000):
    """Run as a FastAPI server."""
    try:
        from fastapi import FastAPI, Request
        from fastapi.middleware.cors import CORSMiddleware
        import uvicorn
    except ImportError:
        print("Install FastAPI: pip install fastapi uvicorn")
        sys.exit(1)

    app = FastAPI(title="Mory AI Assistant", version="1.0.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["*"],
    )

    @app.post("/ask")
    async def ask(request: Request):
        body = await request.json()
        message = body.get("message", "")
        history = body.get("history", [])
        if not message:
            return {"error": "Message is required."}
        if len(message) > 1000:
            return {"error": "Message too long. Keep it under 1000 characters."}
        response = generate_response(message, history)
        return {"response": response, "conversationId": body.get("conversationId")}

    @app.get("/health")
    async def health():
        return {"status": "ok", "service": "mory-ai-python"}

    print(f"Mory AI server starting on port {port}...")
    uvicorn.run(app, host="0.0.0.0", port=port)


def main():
    parser = argparse.ArgumentParser(description="Mory AI Assistant for Marinduque")
    parser.add_argument("question", nargs="?", help="Ask a single question")
    parser.add_argument("--interactive", "-i", action="store_true", help="Interactive chat mode")
    parser.add_argument("--serve", "-s", action="store_true", help="Start as API server")
    parser.add_argument("--port", "-p", type=int, default=8000, help="Server port (default 8000)")
    args = parser.parse_args()

    if args.serve:
        server_mode(args.port)
    elif args.interactive:
        interactive_mode()
    elif args.question:
        cli_mode(args.question)
    else:
        interactive_mode()


if __name__ == "__main__":
    main()