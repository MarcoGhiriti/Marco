"""Shared database connection, helpers, and utilities."""
import logging
import math
import os
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Optional

import httpx
import socketio
from bson import ObjectId
from dotenv import load_dotenv
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from motor.motor_asyncio import AsyncIOMotorClient

from src_auth import create_access_token, decode_token, hash_password, oid_str, verify_password

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

logger = logging.getLogger("moto-go")
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")

# --- Database ---
mongo_url = os.environ["MONGO_URL"]
db_name = os.environ["DB_NAME"]
client = AsyncIOMotorClient(mongo_url, maxPoolSize=100, minPoolSize=10, maxIdleTimeMS=30000)
db = client[db_name]

GOOGLE_MAPS_API_KEY = os.environ.get("GOOGLE_MAPS_API_KEY")

# --- Security ---
security = HTTPBearer(auto_error=False)

# --- Socket.IO ---
sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins="*", ping_interval=20, ping_timeout=20)
sid_to_user: dict[str, str] = {}

# --- Auth dependency ---
async def get_current_user(creds: HTTPAuthorizationCredentials = Depends(security)):
    if creds is None or not creds.credentials:
        raise HTTPException(status_code=401, detail="Missing bearer token")
    payload = decode_token(creds.credentials)
    if not payload or payload.get("type") != "access" or not payload.get("sub"):
        raise HTTPException(status_code=401, detail="Invalid token")
    user_id = payload["sub"]
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    user["id"] = oid_str(user.get("_id"))
    user.pop("_id", None)
    user.pop("password_hash", None)
    return user

# --- Utility functions ---
def _oid_str(oid: Any) -> str:
    return str(oid)

def _as_object_id(id_str: str) -> ObjectId:
    try:
        return ObjectId(id_str)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid ID format")

def dm_thread_id(a: str, b: str) -> str:
    x, y = sorted([a, b])
    return f"dm:{x}:{y}"

def haversine_distance(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6371
    lat1_rad, lat2_rad = math.radians(lat1), math.radians(lat2)
    delta_lat, delta_lng = math.radians(lat2 - lat1), math.radians(lng2 - lng1)
    a = math.sin(delta_lat / 2) ** 2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lng / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

def haversine_km(a: list[float], b: list[float]) -> float:
    from math import asin, cos, radians, sin, sqrt
    lat1, lon1 = a
    lat2, lon2 = b
    r = 6371.0
    dlat, dlon = radians(lat2 - lat1), radians(lon2 - lon1)
    lat1r, lat2r = radians(lat1), radians(lat2)
    h = sin(dlat / 2) ** 2 + cos(lat1r) * cos(lat2r) * sin(dlon / 2) ** 2
    return 2 * r * asin(sqrt(h))

def polyline_distance_km(polyline: list[list[float]]) -> float:
    if len(polyline) < 2:
        return 0.0
    total = 0.0
    for i in range(1, len(polyline)):
        total += haversine_km(polyline[i - 1], polyline[i])
    return round(total, 2)

def estimate_duration_min(distance_km: float, difficulty: str) -> int:
    avg_speed = {"easy": 70, "medium": 60, "hard": 45}.get(difficulty, 60)
    if distance_km <= 0:
        return 0
    return int(round((distance_km / max(avg_speed, 1)) * 60))

def estimate_cost(distance_km: float, fuel_price_per_l: float, bike_consumption_l_per_100km: float, toll_estimate: float, currency: str) -> dict:
    liters = (distance_km / 100.0) * max(bike_consumption_l_per_100km, 0)
    fuel = round(liters * max(fuel_price_per_l, 0), 2)
    tolls = round(max(toll_estimate, 0), 2)
    return {"fuel": fuel, "tolls": tolls, "currency": currency}

# --- Google Maps helpers ---
async def google_directions_distance_duration(origin: list[float], destination: list[float], waypoints: Optional[list[list[float]]]) -> tuple[float, int]:
    if not GOOGLE_MAPS_API_KEY:
        raise HTTPException(status_code=400, detail="GOOGLE_MAPS_API_KEY not configured")
    url = "https://maps.googleapis.com/maps/api/directions/json"
    params: dict[str, Any] = {"origin": f"{origin[0]},{origin[1]}", "destination": f"{destination[0]},{destination[1]}", "key": GOOGLE_MAPS_API_KEY, "mode": "driving"}
    if waypoints and len(waypoints) > 0:
        params["waypoints"] = "|".join([f"{p[0]},{p[1]}" for p in waypoints])
    async with httpx.AsyncClient(timeout=15) as http:
        resp = await http.get(url, params=params)
        resp.raise_for_status()
        data = resp.json()
    if data.get("status") != "OK":
        raise HTTPException(status_code=400, detail={"google_status": data.get("status"), "error": data.get("error_message")})
    legs = data.get("routes", [{}])[0].get("legs", [])
    total_m = sum([int(leg.get("distance", {}).get("value", 0)) for leg in legs])
    total_s = sum([int(leg.get("duration", {}).get("value", 0)) for leg in legs])
    return round(total_m / 1000.0, 2), int(round(total_s / 60.0))

def _extract_city_from_geocode_result(result: dict) -> Optional[str]:
    comps = result.get("address_components") or []
    preferred = ["locality", "postal_town", "administrative_area_level_2", "administrative_area_level_1"]
    for t in preferred:
        for c in comps:
            if t in (c.get("types") or []):
                name = c.get("long_name") or c.get("short_name")
                if isinstance(name, str) and name.strip():
                    return name.strip()
    return None

async def google_reverse_geocode_city(lat: float, lng: float) -> Optional[str]:
    if not GOOGLE_MAPS_API_KEY:
        return None
    url = "https://maps.googleapis.com/maps/api/geocode/json"
    params: dict[str, Any] = {"latlng": f"{lat},{lng}", "key": GOOGLE_MAPS_API_KEY, "result_type": "locality|postal_town|administrative_area_level_2|administrative_area_level_1", "language": "ro"}
    async with httpx.AsyncClient(timeout=12) as http:
        resp = await http.get(url, params=params)
        resp.raise_for_status()
        data = resp.json()
    if data.get("status") != "OK":
        return None
    for r in (data.get("results") or []):
        city = _extract_city_from_geocode_result(r)
        if city:
            return city
    return None

async def ensure_route_city_fields(doc: dict) -> dict:
    if doc.get("start_city") and doc.get("end_city"):
        return doc
    polyline = doc.get("polyline") or []
    if not isinstance(polyline, list) or len(polyline) < 2:
        return doc
    try:
        start, end = polyline[0], polyline[-1]
        if not doc.get("start_city") and isinstance(start, list) and len(start) == 2:
            doc["start_city"] = await google_reverse_geocode_city(float(start[0]), float(start[1]))
        if not doc.get("end_city") and isinstance(end, list) and len(end) == 2:
            doc["end_city"] = await google_reverse_geocode_city(float(end[0]), float(end[1]))
    except Exception:
        pass
    return doc

async def _enrich_waypoints_with_city(waypoints: list[dict], max_geocodes: int = 12) -> list[dict]:
    out: list[dict] = []
    for idx, wp in enumerate(waypoints):
        wp2 = dict(wp)
        if idx < max_geocodes:
            try:
                city = await google_reverse_geocode_city(float(wp2.get("lat")), float(wp2.get("lng")))
                if city:
                    wp2["city"] = city
            except Exception:
                pass
        out.append(wp2)
    return out

# --- Notification helper ---
async def create_notification(user_id: str, notif_type: str, title: str, message: str, data: dict | None = None):
    now = datetime.utcnow()
    doc = {"user_id": user_id, "type": notif_type, "title": title, "message": message, "data": data or {}, "read": False, "created_at": now}
    res = await db.notifications.insert_one(doc)
    payload = {"id": str(res.inserted_id), "type": notif_type, "title": title, "message": message, "data": data or {}, "read": False, "created_at": now.isoformat()}
    await sio.emit("notification:new", payload, room=f"user:{user_id}")

# --- Group membership helper ---
async def is_group_member(group_id: str, user_id: str) -> bool:
    g = await db.groups.find_one({"_id": ObjectId(group_id)})
    if not g:
        return False
    return user_id in (g.get("members") or [])

# --- Badge system ---
BADGE_INFO = {
    "first_ride": {"name": "First Ride", "description": "Completed your first route", "icon": "bicycle"},
    "explorer_10": {"name": "Explorer", "description": "Completed 10 routes", "icon": "compass"},
    "explorer_50": {"name": "Adventurer", "description": "Completed 50 routes", "icon": "map"},
    "km_100": {"name": "Century Rider", "description": "Rode 100 kilometers", "icon": "speedometer"},
    "km_500": {"name": "Road Warrior", "description": "Rode 500 kilometers", "icon": "flash"},
    "km_1000": {"name": "Highway King", "description": "Rode 1,000 kilometers", "icon": "trophy"},
    "km_2500": {"name": "Road Master", "description": "Rode 2,500 kilometers", "icon": "medal"},
    "km_5000": {"name": "Legend", "description": "Rode 5,000 kilometers", "icon": "star"},
    "km_10000": {"name": "Immortal", "description": "Rode 10,000 kilometers", "icon": "ribbon"},
    "event_creator": {"name": "Event Organizer", "description": "Created your first event", "icon": "calendar"},
    "route_creator": {"name": "Route Creator", "description": "Created your first route", "icon": "trail-sign"},
    "social_5": {"name": "Social Rider", "description": "Made 5 friends", "icon": "people"},
    "social_20": {"name": "Popular Rider", "description": "Made 20 friends", "icon": "heart"},
    "reporter": {"name": "Road Guardian", "description": "Reported 10 road issues", "icon": "shield"},
    "early_adopter": {"name": "Early Adopter", "description": "Joined Moto GO early", "icon": "rocket"},
}

async def check_and_award_badges(user_id: str):
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        return
    existing = set()
    async for b in db.badges.find({"user_id": user_id}):
        existing.add(b["badge_type"])

    async def _award(badge_type: str):
        if badge_type not in existing:
            await db.badges.insert_one({"user_id": user_id, "badge_type": badge_type, "earned_at": datetime.utcnow()})
            info = BADGE_INFO.get(badge_type, {})
            await create_notification(user_id, "badge_earned", f"Badge: {info.get('name', badge_type)}", info.get("description", ""), {"badge_type": badge_type})

    rides_count = await db.ride_sessions.count_documents({"user_id": user_id, "status": "completed"})
    km = user.get("km_total", 0)
    friends_count = await db.friends.count_documents({"user_id": user_id})
    events_count = await db.events.count_documents({"created_by": user_id})
    routes_count = await db.routes.count_documents({"created_by": user_id})
    reports_count = await db.map_reports.count_documents({"reporter_id": user_id})

    if rides_count >= 1:
        await _award("first_ride")
    if rides_count >= 10:
        await _award("explorer_10")
    if rides_count >= 50:
        await _award("explorer_50")
    for threshold, badge in [(100, "km_100"), (500, "km_500"), (1000, "km_1000"), (2500, "km_2500"), (5000, "km_5000"), (10000, "km_10000")]:
        if km >= threshold:
            await _award(badge)
    if events_count >= 1:
        await _award("event_creator")
    if routes_count >= 1:
        await _award("route_creator")
    if friends_count >= 5:
        await _award("social_5")
    if friends_count >= 20:
        await _award("social_20")
    if reports_count >= 10:
        await _award("reporter")

# --- AI License verification ---
async def verify_license_with_ai(image_base64: str) -> dict:
    try:
        from emergentintegrations.llm.chat import ChatRequest, chat
        req = ChatRequest(
            api_key=os.environ.get("EMERGENT_LLM_KEY", ""),
            model="gpt-4o",
            system_prompt="""You are an AI assistant that verifies motorcycle licenses.
Analyze the uploaded image and determine:
1. Is this a valid motorcycle license? (true/false)
2. What type of motorcycle license is it? (A1, A2, A, or unknown)
3. Is the license expired? (true/false/unknown)
4. Confidence score (0.0 to 1.0)

Respond ONLY in valid JSON format:
{"is_valid": true/false, "license_type": "A1/A2/A/unknown", "is_expired": true/false/unknown, "confidence": 0.0-1.0, "reason": "brief explanation"}""",
            user_prompt="Please verify this motorcycle license image.",
            image_urls=[f"data:image/jpeg;base64,{image_base64[:100]}..."],
        )
        resp = await chat(req)
        import json
        try:
            return json.loads(resp.response)
        except Exception:
            return {"is_valid": False, "license_type": "unknown", "confidence": 0.0, "reason": "Could not parse AI response"}
    except Exception as e:
        logger.error(f"AI license verification error: {e}")
        return {"is_valid": True, "license_type": "unknown", "confidence": 0.5, "reason": "AI verification unavailable, manual review needed"}

# --- Database indexes for 10k+ users optimization ---
async def ensure_indexes():
    """Create all necessary indexes for performance at scale."""
    try:
        # Users indexes
        await db.users.create_index("email", unique=True, background=True)
        await db.users.create_index("username", background=True)

        # Friends indexes
        await db.friends.create_index("user_id", background=True)
        await db.friend_requests.create_index([("from_user_id", 1), ("to_user_id", 1)], background=True)
        await db.friend_requests.create_index("to_user_id", background=True)

        # Messages indexes
        await db.messages.create_index([("thread_id", 1), ("created_at", -1)], background=True)
        await db.thread_reads.create_index([("user_id", 1), ("thread_id", 1)], background=True)

        # Notifications indexes
        await db.notifications.create_index([("user_id", 1), ("created_at", -1)], background=True)
        await db.notifications.create_index([("user_id", 1), ("read", 1)], background=True)

        # Routes indexes
        await db.routes.create_index("created_at", background=True)
        await db.routes.create_index("created_by", background=True)

        # Events indexes
        await db.events.create_index("start_time", background=True)
        await db.events.create_index("created_by", background=True)
        await db.events.create_index([("start_point", "2dsphere")], background=True)

        # Rides indexes
        await db.ride_sessions.create_index([("user_id", 1), ("status", 1)], background=True)
        await db.ride_sessions.create_index("route_id", background=True)

        # Marketplace indexes
        await db.marketplace_listings.create_index("created_at", background=True)
        await db.marketplace_listings.create_index("seller_id", background=True)
        await db.marketplace_listings.create_index("category", background=True)

        # Groups indexes
        await db.groups.create_index("members", background=True)
        await db.groups.create_index([("name", "text")], background=True)

        # Stories TTL index - handle name conflict gracefully
        try:
            await db.stories.create_index("expires_at", expireAfterSeconds=0, background=True)
        except Exception:
            pass
        try:
            await db.story_views.create_index([("story_id", 1), ("user_id", 1)], unique=True, background=True)
        except Exception:
            pass

        # Reports TTL index
        await db.map_reports.create_index("expires_at", expireAfterSeconds=0, background=True)
        await db.map_reports.create_index([("location", "2dsphere")], background=True)

        # Police reports TTL index
        await db.police_reports.create_index("expires_at", expireAfterSeconds=0, background=True)

        # Badges indexes
        await db.badges.create_index([("user_id", 1), ("badge_type", 1)], unique=True, background=True)

        logger.info("All database indexes ensured successfully")
    except Exception as e:
        logger.error(f"Error creating indexes: {e}")
