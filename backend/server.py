import logging
import os
import uuid
import math
from datetime import datetime, timedelta
from enum import Enum
from pathlib import Path
from typing import Any, List, Literal, Optional

from email_validator import EmailNotValidError, validate_email

from src_auth import create_access_token, decode_token, hash_password, oid_str, verify_password
from src_chat_models import (
    FriendAccept,
    FriendRequestCreate,
    GroupCreate,
    GroupOut,
    MessageCreate,
    MessageOut,
)

import httpx
import polyline as polyline_lib
import socketio
from bson import ObjectId
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, FastAPI, HTTPException, Query
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from starlette.middleware.cors import CORSMiddleware

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")
# Re-read env after loading .env

logger = logging.getLogger("moto-go")
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)

mongo_url = os.environ["MONGO_URL"]
db_name = os.environ.get("DB_NAME", "test_database")
client = AsyncIOMotorClient(mongo_url)
db = client[db_name]

GOOGLE_MAPS_API_KEY = os.environ.get("GOOGLE_MAPS_API_KEY")


def haversine_distance(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Calculate distance in km between two points using Haversine formula."""
    R = 6371  # Earth's radius in km
    
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lng = math.radians(lng2 - lng1)
    
    a = math.sin(delta_lat / 2) ** 2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lng / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    
    return R * c


fastapi_app = FastAPI()
api_router = APIRouter(prefix="/api")
security = HTTPBearer(auto_error=False)

sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins="*",
    ping_interval=20,
    ping_timeout=20,
)

# In-memory mapping of socket session -> user_id
sid_to_user: dict[str, str] = {}


@sio.event
async def connect(sid, environ, auth):  # type: ignore[no-untyped-def]
    token = None
    if isinstance(auth, dict):
        token = auth.get("token")

    if not token or not isinstance(token, str):
        return False

    payload = decode_token(token)
    if not payload or payload.get("type") != "access" or not payload.get("sub"):
        return False

    user_id = payload["sub"]
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        return False

    sid_to_user[sid] = user_id
    await sio.enter_room(sid, f"user:{user_id}")
    return True


@sio.event
async def disconnect(sid):  # type: ignore[no-untyped-def]
    user_id = sid_to_user.pop(sid, None)
    if user_id:
        await sio.leave_room(sid, f"user:{user_id}")


@sio.on("ping_test")
async def ping_test(sid, data):  # type: ignore[no-untyped-def]
    await sio.emit("pong_test", {"ok": True, "echo": data}, to=sid)


def dm_thread_id(a: str, b: str) -> str:
    x, y = sorted([a, b])
    return f"dm:{x}:{y}"


async def is_group_member(group_id: str, user_id: str) -> bool:
    g = await db.groups.find_one({"_id": ObjectId(group_id)})
    if not g:
        return False
    members = g.get("members") or []
    return user_id in members


@sio.on("dm:send")
async def dm_send(sid, data):  # type: ignore[no-untyped-def]
    from_user_id = sid_to_user.get(sid)
    if not from_user_id:
        return

    if not isinstance(data, dict):
        return

    to_user_id = data.get("to_user_id")
    text = data.get("text")
    if not isinstance(to_user_id, str) or not isinstance(text, str) or not text.strip():
        return

    # basic friend-only constraint can be added later; currently allow if user exists
    to_user = await db.users.find_one({"_id": ObjectId(to_user_id)})
    if not to_user:
        return

    thread_id = dm_thread_id(from_user_id, to_user_id)
    now = datetime.utcnow()
    doc = {
        "kind": "dm",
        "thread_id": thread_id,
        "from_user_id": from_user_id,
        "to_user_id": to_user_id,
        "group_id": None,
        "text": text.strip(),
        "created_at": now,
    }
    res = await db.messages.insert_one(doc)

    payload = {
        "id": oid_str(res.inserted_id),
        "thread_id": thread_id,
        "kind": "dm",
        "from_user_id": from_user_id,
        "to_user_id": to_user_id,
        "group_id": None,
        "text": doc["text"],
        "created_at": now.isoformat(),
    }

    await sio.emit("dm:new", payload, room=f"user:{from_user_id}")
    await sio.emit("dm:new", payload, room=f"user:{to_user_id}")


@sio.on("group:join")
async def group_join(sid, data):  # type: ignore[no-untyped-def]
    user_id = sid_to_user.get(sid)
    if not user_id or not isinstance(data, dict):
        return

    group_id = data.get("group_id")
    if not isinstance(group_id, str):
        return

    if not await is_group_member(group_id, user_id):
        return

    await sio.enter_room(sid, f"group:{group_id}")
    await sio.emit("group:joined", {"group_id": group_id}, to=sid)


@sio.on("group:send")
async def group_send(sid, data):  # type: ignore[no-untyped-def]
    from_user_id = sid_to_user.get(sid)
    if not from_user_id or not isinstance(data, dict):
        return

    group_id = data.get("group_id")
    text = data.get("text")
    if not isinstance(group_id, str) or not isinstance(text, str) or not text.strip():
        return

    if not await is_group_member(group_id, from_user_id):
        return

    now = datetime.utcnow()
    thread_id = f"group:{group_id}"
    doc = {
        "kind": "group",
        "thread_id": thread_id,
        "from_user_id": from_user_id,
        "to_user_id": None,
        "group_id": group_id,
        "text": text.strip(),
        "created_at": now,
    }

    res = await db.messages.insert_one(doc)

    payload = {
        "id": oid_str(res.inserted_id),
        "thread_id": thread_id,
        "kind": "group",
        "from_user_id": from_user_id,
        "to_user_id": None,
        "group_id": group_id,
        "text": doc["text"],
        "created_at": now.isoformat(),
    }

    await sio.emit("group:new", payload, room=f"group:{group_id}")


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

    # Remove sensitive fields
    user["id"] = oid_str(user.get("_id"))
    user.pop("_id", None)
    user.pop("password_hash", None)
    return user


# -----------------
# Utils
# -----------------

def _oid_str(oid: Any) -> str:
    if isinstance(oid, ObjectId):
        return str(oid)
    return str(oid)


def haversine_km(a: list[float], b: list[float]) -> float:
    # a, b: [lat, lng]
    from math import asin, cos, radians, sin, sqrt

    lat1, lon1 = a
    lat2, lon2 = b
    r = 6371.0
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    lat1 = radians(lat1)
    lat2 = radians(lat2)

    h = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlon / 2) ** 2
    return 2 * r * asin(sqrt(h))


def polyline_distance_km(polyline: list[list[float]]) -> float:
    if len(polyline) < 2:
        return 0.0
    total = 0.0
    for i in range(1, len(polyline)):
        total += haversine_km(polyline[i - 1], polyline[i])
    return round(total, 2)


def estimate_duration_min(distance_km: float, difficulty: str) -> int:
    # Conservative avg speeds in km/h
    avg_speed = {
        "easy": 70,
        "medium": 60,
        "hard": 45,
    }.get(difficulty, 60)

    if distance_km <= 0:
        return 0

    hours = distance_km / max(avg_speed, 1)
    return int(round(hours * 60))


def estimate_cost(
    distance_km: float,
    fuel_price_per_l: float,
    bike_consumption_l_per_100km: float,
    toll_estimate: float,
    currency: str,
) -> dict:
    liters = (distance_km / 100.0) * max(bike_consumption_l_per_100km, 0)
    fuel = round(liters * max(fuel_price_per_l, 0), 2)
    tolls = round(max(toll_estimate, 0), 2)
    return {"fuel": fuel, "tolls": tolls, "currency": currency}


async def google_directions_distance_duration(
    origin: list[float],
    destination: list[float],
    waypoints: Optional[list[list[float]]],
) -> tuple[float, int]:
    if not GOOGLE_MAPS_API_KEY:
        raise HTTPException(status_code=400, detail="GOOGLE_MAPS_API_KEY not configured")

    url = "https://maps.googleapis.com/maps/api/directions/json"
    params: dict[str, Any] = {
        "origin": f"{origin[0]},{origin[1]}",
        "destination": f"{destination[0]},{destination[1]}",
        "key": GOOGLE_MAPS_API_KEY,
        "mode": "driving",
    }
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


# -----------------
# Models
# -----------------

Difficulty = Literal["easy", "medium", "hard"]


class CostEstimate(BaseModel):
    fuel: float
    tolls: float
    currency: str


class AuthRegister(BaseModel):
    email: str
    username: str = Field(min_length=3, max_length=20)
    password: str = Field(min_length=8, max_length=128)


class AuthLogin(BaseModel):
    email: str
    password: str


class AuthToken(BaseModel):
    access_token: str
    token_type: str = "bearer"


class BikeInfo(BaseModel):
    model: Optional[str] = None
    cc: Optional[int] = Field(default=None, ge=50, le=3000)


class PrivacySettings(BaseModel):
    location_visible: bool = False
    routes_visible: Literal["public", "friends", "private"] = "public"


class UserPublic(BaseModel):
    id: str
    email: str
    username: str
    profile_photo_base64: Optional[str] = None
    bio: str = ""
    bike: Optional[BikeInfo] = None
    country: Optional[str] = None
    privacy: PrivacySettings
    level: int = 1
    km_total: float = 0
    km_month: float = 0
    # License verification fields
    license_type: Optional[str] = None  # A1, A2, A, or None
    license_verified: bool = False
    license_photo_base64: Optional[str] = None
    created_at: datetime


class MeUpdate(BaseModel):
    country: Optional[str] = Field(default=None, max_length=2)

    bio: Optional[str] = Field(default=None, max_length=280)
    bike: Optional[BikeInfo] = None
    privacy: Optional[PrivacySettings] = None
    profile_photo_base64: Optional[str] = None


class LicenseUpload(BaseModel):
    license_type: str = Field(..., pattern="^(A1|A2|A)$", description="License type: A1, A2, or A")
    license_photo_base64: str = Field(..., description="Base64 encoded photo of the license")


class RouteCreate(BaseModel):
    title: str = Field(min_length=2, max_length=80)
    description: str = Field(default="", max_length=800)
    polyline: list[list[float]] = Field(min_length=2, description="List of [lat,lng] points")

    rules: str = Field(default="", max_length=800)
    difficulty: Difficulty = "medium"
    participants_min: int = Field(default=1, ge=1, le=99)
    participants_max: int = Field(default=10, ge=1, le=999)

    fuel_price_per_l: float = Field(default=7.5, ge=0)
    bike_consumption_l_per_100km: float = Field(default=5.0, ge=0)
    toll_estimate: float = Field(default=0.0, ge=0)
    currency: str = Field(default="RON", min_length=3, max_length=3)

    stops_count: int = Field(default=0, ge=0, le=50)
    
    # Start date for the route (when riders will meet)
    start_date: Optional[datetime] = None

    # Optional: if true, compute using Google Directions (roads)
    use_google_directions: bool = False





class UserSearchOut(BaseModel):
    id: str
    username: str
    profile_photo_base64: Optional[str] = None


class FriendRequestOut(BaseModel):
    incoming: list["UserSearchOut"]
    outgoing: list["UserSearchOut"]

class RouteOut(BaseModel):
    id: str
    title: str
    description: str
    polyline: list[list[float]]

    distance_km: float
    duration_min: int
    stops_count: int
    cost_estimate: CostEstimate

    participants_count: int = 0
    is_joined: bool = False
    created_by: str = ""

    rules: str
    difficulty: Difficulty
    participants_min: int
    participants_max: int
    
    start_date: Optional[datetime] = None

    created_at: datetime


class EventCreate(BaseModel):
    title: str = Field(min_length=2, max_length=80)
    description: str = Field(default="", max_length=800)
    start_point: list[float] = Field(min_length=2, max_length=2, description="[lat,lng]")
    location_name: str = Field(default="", max_length=200, description="Name/address of the location")

    start_time: datetime

    poster_base64: Optional[str] = None
    associated_route_id: Optional[str] = None


class EventOut(BaseModel):
    id: str
    title: str
    description: str
    start_point: list[float]
    location_name: str = ""
    start_time: datetime

    poster_base64: Optional[str] = None
    associated_route_id: Optional[str] = None

    participants_count: int = 0
    is_joined: bool = False
    created_by: str = ""

    created_at: datetime


# -----------------
# Places Autocomplete Models
# -----------------

class PlaceAutocompleteResult(BaseModel):
    place_id: str
    description: str
    main_text: str
    secondary_text: str


class PlaceDetailsResult(BaseModel):
    place_id: str
    name: str
    address: str
    lat: float
    lng: float


# -----------------
# Notifications Models
# -----------------

class NotificationType(str, Enum):
    FRIEND_REQUEST = "friend_request"
    FRIEND_ACCEPTED = "friend_accepted"
    ROUTE_INVITE = "route_invite"
    EVENT_INVITE = "event_invite"
    GROUP_INVITE = "group_invite"
    ROUTE_REMINDER = "route_reminder"
    EVENT_REMINDER = "event_reminder"
    ROUTE_UPDATED = "route_updated"
    EVENT_UPDATED = "event_updated"


class NotificationOut(BaseModel):
    id: str
    type: str
    title: str
    message: str
    data: dict = {}  # Additional data (route_id, event_id, user_id, etc.)
    read: bool = False
    created_at: datetime


# -----------------
# Stories Models
# -----------------

class StoryCreate(BaseModel):
    media_base64: str = Field(..., description="Base64 encoded image or video")
    media_type: Literal["image", "video"] = Field(default="image")
    caption: Optional[str] = Field(default=None, max_length=200)


class StoryOut(BaseModel):
    id: str
    owner_id: str
    owner_username: str
    owner_photo: Optional[str] = None
    media_base64: str
    media_type: str
    caption: Optional[str] = None
    created_at: datetime
    expires_at: datetime


class StoryOwner(BaseModel):
    user_id: str
    username: str
    profile_photo: Optional[str] = None
    stories: list[StoryOut]


# -----------------
# Map Reports Models
# -----------------

ReportType = Literal["police", "hazard", "road_closure", "radar", "accident", "traffic"]

# TTL in minutes for each report type
REPORT_TTL_MINUTES = {
    "police": 30,
    "hazard": 60,
    "road_closure": 120,
    "radar": 45,
    "accident": 90,
    "traffic": 30,
}


class ReportCreate(BaseModel):
    report_type: ReportType
    location: list[float] = Field(..., min_length=2, max_length=2, description="[lat, lng]")
    description: Optional[str] = Field(default=None, max_length=200)


class ReportOut(BaseModel):
    id: str
    report_type: str
    location: list[float]
    description: Optional[str] = None
    reporter_id: str
    reporter_username: str
    votes_up: int = 0
    votes_down: int = 0
    created_at: datetime
    expires_at: datetime


# -----------------
# Ride Sessions Models (Anti-fraud km tracking)
# -----------------

class RideSessionStart(BaseModel):
    route_id: str


class RideSessionEnd(BaseModel):
    session_id: str
    end_location: list[float] = Field(..., min_length=2, max_length=2)


class RideSessionOut(BaseModel):
    id: str
    user_id: str
    route_id: str
    status: str  # "active", "completed", "cancelled"
    start_time: datetime
    end_time: Optional[datetime] = None
    km_tracked: float = 0
    is_validated: bool = False


# -----------------
# Badges & Gamification Models
# -----------------

BadgeType = Literal[
    "first_ride",      # Complete first route
    "explorer_10",     # Complete 10 routes
    "explorer_50",     # Complete 50 routes
    "km_100",          # Reach 100 km
    "km_500",          # Reach 500 km
    "km_1000",         # Reach 1000 km
    "km_5000",         # Reach 5000 km
    "km_10000",        # Reach 10000 km
    "event_creator",   # Create first event
    "social_5",        # Have 5 friends
    "social_20",       # Have 20 friends
    "reporter",        # Report 10 map issues
    "early_adopter",   # Joined in first month
]

BADGE_INFO = {
    "first_ride": {"name": "First Ride", "description": "Completed your first route", "icon": "bicycle"},
    "explorer_10": {"name": "Explorer", "description": "Completed 10 routes", "icon": "compass"},
    "explorer_50": {"name": "Adventurer", "description": "Completed 50 routes", "icon": "map"},
    "km_100": {"name": "Century Rider", "description": "Rode 100 kilometers", "icon": "speedometer"},
    "km_500": {"name": "Road Warrior", "description": "Rode 500 kilometers", "icon": "flash"},
    "km_1000": {"name": "Highway King", "description": "Rode 1,000 kilometers", "icon": "trophy"},
    "km_5000": {"name": "Legend", "description": "Rode 5,000 kilometers", "icon": "star"},
    "km_10000": {"name": "Immortal", "description": "Rode 10,000 kilometers", "icon": "ribbon"},
    "event_creator": {"name": "Event Organizer", "description": "Created your first event", "icon": "calendar"},
    "social_5": {"name": "Social Rider", "description": "Made 5 friends", "icon": "people"},
    "social_20": {"name": "Popular Rider", "description": "Made 20 friends", "icon": "heart"},
    "reporter": {"name": "Road Guardian", "description": "Reported 10 road issues", "icon": "shield"},
    "early_adopter": {"name": "Early Adopter", "description": "Joined Moto GO early", "icon": "rocket"},
}


class BadgeOut(BaseModel):
    badge_type: str
    name: str
    description: str
    icon: str
    earned_at: datetime


class LeaderboardEntry(BaseModel):
    rank: int
    user_id: str
    username: str
    profile_photo: Optional[str] = None
    km_total: float
    level: int
    badges_count: int


# -----------------
# Places Autocomplete Endpoints
# -----------------

@api_router.get("/places/autocomplete", response_model=list[PlaceAutocompleteResult])
async def places_autocomplete(
    query: str = Query(..., min_length=2, description="Search query"),
    current_user: dict = Depends(get_current_user),
):
    """Search for places using Google Places Autocomplete API."""
    if not GOOGLE_MAPS_API_KEY:
        raise HTTPException(status_code=400, detail="Google Maps API key not configured")
    
    url = "https://maps.googleapis.com/maps/api/place/autocomplete/json"
    params = {
        "input": query,
        "key": GOOGLE_MAPS_API_KEY,
        "types": "geocode|establishment",
        "language": "ro",
    }
    
    async with httpx.AsyncClient(timeout=10) as http:
        resp = await http.get(url, params=params)
        resp.raise_for_status()
        data = resp.json()
    
    if data.get("status") not in ["OK", "ZERO_RESULTS"]:
        logger.error(f"Places API error: {data}")
        raise HTTPException(status_code=400, detail=f"Google API error: {data.get('status')}")
    
    predictions = data.get("predictions", [])
    results = []
    for p in predictions:
        structured = p.get("structured_formatting", {})
        results.append(PlaceAutocompleteResult(
            place_id=p.get("place_id", ""),
            description=p.get("description", ""),
            main_text=structured.get("main_text", p.get("description", "")),
            secondary_text=structured.get("secondary_text", ""),
        ))
    
    return results


@api_router.get("/places/details", response_model=PlaceDetailsResult)
async def places_details(
    place_id: str = Query(..., description="Google Place ID"),
    current_user: dict = Depends(get_current_user),
):
    """Get place details (coordinates) from Google Place ID."""
    if not GOOGLE_MAPS_API_KEY:
        raise HTTPException(status_code=400, detail="Google Maps API key not configured")
    
    url = "https://maps.googleapis.com/maps/api/place/details/json"
    params = {
        "place_id": place_id,
        "key": GOOGLE_MAPS_API_KEY,
        "fields": "name,formatted_address,geometry",
    }
    
    async with httpx.AsyncClient(timeout=10) as http:
        resp = await http.get(url, params=params)
        resp.raise_for_status()
        data = resp.json()
    
    if data.get("status") != "OK":
        logger.error(f"Place Details API error: {data}")
        raise HTTPException(status_code=400, detail=f"Google API error: {data.get('status')}")
    
    result = data.get("result", {})
    geo = result.get("geometry", {}).get("location", {})
    
    return PlaceDetailsResult(
        place_id=place_id,
        name=result.get("name", ""),
        address=result.get("formatted_address", ""),
        lat=geo.get("lat", 0),
        lng=geo.get("lng", 0),
    )


@api_router.get("/directions/route")
async def get_directions_route(
    origin_lat: float = Query(...),
    origin_lng: float = Query(...),
    dest_lat: float = Query(...),
    dest_lng: float = Query(...),
    waypoints: str = Query(None, description="Pipe-separated waypoints: lat,lng|lat,lng"),
    current_user: dict = Depends(get_current_user),
):
    """Get route polyline and info from Google Directions API."""
    if not GOOGLE_MAPS_API_KEY:
        raise HTTPException(status_code=400, detail="Google Maps API key not configured")
    
    url = "https://maps.googleapis.com/maps/api/directions/json"
    params = {
        "origin": f"{origin_lat},{origin_lng}",
        "destination": f"{dest_lat},{dest_lng}",
        "key": GOOGLE_MAPS_API_KEY,
        "mode": "driving",
    }
    
    # Add waypoints if provided
    if waypoints:
        params["waypoints"] = waypoints
    
    async with httpx.AsyncClient(timeout=15) as http:
        resp = await http.get(url, params=params)
        resp.raise_for_status()
        data = resp.json()
    
    if data.get("status") != "OK":
        raise HTTPException(status_code=400, detail=f"Google Directions error: {data.get('status')}")
    
    route = data.get("routes", [{}])[0]
    legs = route.get("legs", [{}])
    
    # Decode polyline
    encoded_polyline = route.get("overview_polyline", {}).get("points", "")
    decoded_points = polyline_lib.decode(encoded_polyline) if encoded_polyline else []
    
    # Convert to [[lat, lng], ...] format
    polyline_coords = [[lat, lng] for lat, lng in decoded_points]
    
    total_distance_m = sum(leg.get("distance", {}).get("value", 0) for leg in legs)
    total_duration_s = sum(leg.get("duration", {}).get("value", 0) for leg in legs)
    
    return {
        "polyline": polyline_coords,
        "distance_km": round(total_distance_m / 1000, 2),
        "duration_min": int(round(total_duration_s / 60)),
        "start_address": legs[0].get("start_address", "") if legs else "",
        "end_address": legs[-1].get("end_address", "") if legs else "",
    }


@api_router.get("/")
async def root():
    return {"message": "Moto GO API"}


@api_router.get("/health")
async def health():
    try:
        _ = await db.command({"ping": 1})
        return {"ok": True, "db": "up"}
    except Exception as e:  # noqa: BLE001
        logger.exception("Health check failed")
        return {"ok": False, "db": "down", "detail": str(e)}


@api_router.post("/auth/register", response_model=AuthToken)
async def auth_register(payload: AuthRegister):
    try:
        email = validate_email(payload.email, check_deliverability=False).email
    except EmailNotValidError:
        raise HTTPException(status_code=400, detail="Invalid email")

    username = payload.username.strip()
    if not username.isalnum():
        raise HTTPException(status_code=400, detail="Username must be alphanumeric")

    existing_email = await db.users.find_one({"email": email})
    if existing_email:
        raise HTTPException(status_code=409, detail="Email already in use")

    existing_username = await db.users.find_one({"username": username})
    if existing_username:
        raise HTTPException(status_code=409, detail="Username already in use")

    now = datetime.utcnow()
    doc = {
        "email": email,
        "username": username,
        "password_hash": hash_password(payload.password),
        "profile_photo_base64": None,
        "bio": "",
        "bike": None,
        "country": None,
        "privacy": {"location_visible": False, "routes_visible": "public"},
        "level": 1,
        "km_total": 0.0,
        "km_month": 0.0,
        "created_at": now,
        "friends": [],
        "friend_requests_in": [],
        "friend_requests_out": [],
    }

    res = await db.users.insert_one(doc)
    token = create_access_token(oid_str(res.inserted_id))
    return AuthToken(access_token=token)


@api_router.post("/auth/login", response_model=AuthToken)
async def auth_login(payload: AuthLogin):
    try:
        email = validate_email(payload.email, check_deliverability=False).email
    except EmailNotValidError:
        raise HTTPException(status_code=400, detail="Invalid email")

    user = await db.users.find_one({"email": email})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not verify_password(payload.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_access_token(oid_str(user.get("_id")))
    return AuthToken(access_token=token)


@api_router.patch("/me", response_model=UserPublic)
async def update_me(payload: MeUpdate, current_user: dict = Depends(get_current_user)):
    uid = current_user["id"]
    update: dict[str, Any] = {}

    if payload.bio is not None:
        update["bio"] = payload.bio

    if payload.bike is not None:
        update["bike"] = payload.bike.model_dump()

    if payload.country is not None:
        update["country"] = payload.country

    if payload.privacy is not None:
        update["privacy"] = payload.privacy.model_dump()

    if payload.profile_photo_base64 is not None:
        update["profile_photo_base64"] = payload.profile_photo_base64

    if update:
        await db.users.update_one({"_id": _as_object_id(uid)}, {"$set": update})

    user = await db.users.find_one({"_id": _as_object_id(uid)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user["id"] = oid_str(user.get("_id"))
    user.pop("_id", None)
    user.pop("password_hash", None)
    return UserPublic(**user)


@api_router.get("/me", response_model=UserPublic)
async def me(current_user: dict = Depends(get_current_user)):
    return UserPublic(**current_user)


async def verify_license_with_ai(image_base64: str) -> dict:
    """Use AI to verify if the image is a valid driver's license."""
    from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
    
    emergent_key = os.environ.get("EMERGENT_LLM_KEY")
    if not emergent_key:
        logger.warning("EMERGENT_LLM_KEY not configured, skipping AI verification")
        return {"is_valid": True, "reason": "AI verification not configured", "confidence": 0}
    
    try:
        # Clean base64 string (remove data URL prefix if present)
        clean_base64 = image_base64
        if "," in clean_base64:
            clean_base64 = clean_base64.split(",")[1]
        
        chat = LlmChat(
            api_key=emergent_key,
            session_id=f"license-verify-{uuid.uuid4()}",
            system_message="""You are an expert at verifying driver's licenses. 
Your task is to determine if an image shows a valid driver's license or motorcycle license.

Respond ONLY with a JSON object in this exact format:
{
    "is_license": true/false,
    "confidence": 0-100,
    "reason": "brief explanation"
}

A valid license should show:
- An official government-issued document
- Photo of the holder
- Text with name, dates, categories
- Official stamps or holograms

Reject images that are:
- Random photos (people, objects, landscapes)
- Screenshots of other apps
- Blank or corrupted images
- Obviously fake or edited documents"""
        ).with_model("openai", "gpt-4o")
        
        image_content = ImageContent(image_base64=clean_base64)
        
        user_message = UserMessage(
            text="Is this image a valid driver's license or motorcycle license? Analyze carefully and respond with JSON only.",
            file_contents=[image_content]
        )
        
        response = await chat.send_message(user_message)
        logger.info(f"AI license verification response: {response}")
        
        # Parse the JSON response
        import json
        import re
        
        # Try to extract JSON from response
        json_match = re.search(r'\{[^}]+\}', response, re.DOTALL)
        if json_match:
            result = json.loads(json_match.group())
            return {
                "is_valid": result.get("is_license", False),
                "confidence": result.get("confidence", 0),
                "reason": result.get("reason", "Unknown")
            }
        else:
            # If no JSON found, check for positive keywords
            is_valid = any(word in response.lower() for word in ["yes", "valid", "license", "true"])
            return {
                "is_valid": is_valid,
                "confidence": 50,
                "reason": response[:200]
            }
            
    except Exception as e:
        logger.error(f"AI license verification failed: {e}")
        return {"is_valid": False, "reason": f"Verification error: {str(e)}", "confidence": 0}


@api_router.post("/me/license")
async def upload_license(payload: LicenseUpload, current_user: dict = Depends(get_current_user)):
    """Upload motorcycle license for verification with AI check."""
    uid = current_user["id"]
    
    # Step 1: Verify with AI that it's actually a license
    ai_result = await verify_license_with_ai(payload.license_photo_base64)
    
    if not ai_result.get("is_valid", False):
        # Save the attempt but mark as not verified
        await db.users.update_one(
            {"_id": _as_object_id(uid)},
            {
                "$set": {
                    "license_type": payload.license_type,
                    "license_photo_base64": payload.license_photo_base64,
                    "license_verified": False,
                    "license_rejection_reason": ai_result.get("reason", "Invalid image"),
                    "license_submitted_at": datetime.utcnow(),
                }
            }
        )
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid license image: {ai_result.get('reason', 'The uploaded image does not appear to be a valid driver license.')}"
        )
    
    # Step 2: AI confirmed it's a license - verify it
    await db.users.update_one(
        {"_id": _as_object_id(uid)},
        {
            "$set": {
                "license_type": payload.license_type,
                "license_photo_base64": payload.license_photo_base64,
                "license_verified": True,
                "license_verification_confidence": ai_result.get("confidence", 0),
                "license_submitted_at": datetime.utcnow(),
                "license_verified_at": datetime.utcnow(),
            }
        }
    )
    
    return {
        "ok": True, 
        "message": "License verified successfully!", 
        "verified": True,
        "confidence": ai_result.get("confidence", 0)
    }


@api_router.get("/me/license-status")
async def get_license_status(current_user: dict = Depends(get_current_user)):
    """Get current license verification status."""
    uid = current_user["id"]
    user = await db.users.find_one({"_id": _as_object_id(uid)})
    
    return {
        "license_type": user.get("license_type"),
        "license_verified": user.get("license_verified", False),
        "license_submitted_at": user.get("license_submitted_at"),
    }


# Admin endpoint to verify licenses (for future use)
@api_router.post("/admin/verify-license/{user_id}")
async def verify_license(user_id: str, verified: bool = True, current_user: dict = Depends(get_current_user)):
    """Admin endpoint to verify a user's license."""
    # For now, auto-approve (in production, this would be admin-only)
    await db.users.update_one(
        {"_id": _as_object_id(user_id)},
        {"$set": {"license_verified": verified}}
    )
    return {"ok": True}


# -----------------
# Notifications Endpoints
# -----------------

async def create_notification(
    user_id: str,
    notif_type: str,
    title: str,
    message: str,
    data: dict = None
):
    """Helper function to create a notification."""
    doc = {
        "user_id": user_id,
        "type": notif_type,
        "title": title,
        "message": message,
        "data": data or {},
        "read": False,
        "created_at": datetime.utcnow(),
    }
    await db.notifications.insert_one(doc)


@api_router.get("/notifications", response_model=list[NotificationOut])
async def get_notifications(
    limit: int = Query(default=50, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
):
    """Get user's notifications."""
    uid = current_user["id"]
    cursor = db.notifications.find({"user_id": uid}).sort("created_at", -1).limit(limit)
    docs = await cursor.to_list(length=limit)
    
    result = []
    for n in docs:
        result.append(NotificationOut(
            id=_oid_str(n.get("_id")),
            type=n.get("type", ""),
            title=n.get("title", ""),
            message=n.get("message", ""),
            data=n.get("data", {}),
            read=n.get("read", False),
            created_at=n.get("created_at") or datetime.utcnow(),
        ))
    
    return result


@api_router.get("/notifications/unread-count")
async def get_unread_notification_count(current_user: dict = Depends(get_current_user)):
    """Get count of unread notifications."""
    uid = current_user["id"]
    count = await db.notifications.count_documents({"user_id": uid, "read": False})
    return {"count": count}


@api_router.post("/notifications/{notif_id}/read")
async def mark_notification_read(notif_id: str, current_user: dict = Depends(get_current_user)):
    """Mark a notification as read."""
    uid = current_user["id"]
    result = await db.notifications.update_one(
        {"_id": _as_object_id(notif_id), "user_id": uid},
        {"$set": {"read": True}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"ok": True}


@api_router.post("/notifications/read-all")
async def mark_all_notifications_read(current_user: dict = Depends(get_current_user)):
    """Mark all notifications as read."""
    uid = current_user["id"]
    await db.notifications.update_many({"user_id": uid}, {"$set": {"read": True}})
    return {"ok": True}


@api_router.delete("/notifications/{notif_id}")
async def delete_notification(notif_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a notification."""
    uid = current_user["id"]
    result = await db.notifications.delete_one({"_id": _as_object_id(notif_id), "user_id": uid})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"ok": True}


def _as_object_id(id_str: str) -> ObjectId:
    try:
        return ObjectId(id_str)
    except Exception:  # noqa: BLE001
        raise HTTPException(status_code=400, detail="Invalid id")


@api_router.get("/users/search", response_model=list[UserSearchOut])
async def users_search(
    username: str = Query(min_length=1, max_length=20),
    current_user: dict = Depends(get_current_user),
):
    # prefix search, case-insensitive
    q = {"username": {"$regex": f"^{username}", "$options": "i"}}
    cursor = db.users.find(q, {"username": 1, "profile_photo_base64": 1}).limit(20)
    docs = await cursor.to_list(length=20)

    results: list[UserSearchOut] = []
    for u in docs:
        uid = oid_str(u.get("_id"))
        if uid == current_user["id"]:
            continue
        results.append(
            UserSearchOut(
                id=uid,
                username=u.get("username", ""),
                profile_photo_base64=u.get("profile_photo_base64"),
            )
        )
    return results


@api_router.get("/users/{user_id}", response_model=UserSearchOut)
async def get_user(user_id: str, current_user: dict = Depends(get_current_user)):
    """Get a user's public profile info."""
    user = await db.users.find_one({"_id": _as_object_id(user_id)}, {"username": 1, "profile_photo_base64": 1})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return UserSearchOut(
        id=oid_str(user.get("_id")),
        username=user.get("username", ""),
        profile_photo_base64=user.get("profile_photo_base64"),
    )


@api_router.get("/stats")
async def stats(current_user: dict = Depends(get_current_user)):
    uid = current_user["id"]

    # NOTE: Completed routes tracking (anti-fraud) will be implemented via ride sessions.
    # For now we expose joined routes and joined events.
    joined_routes = await db.routes.count_documents({"participants": uid})
    joined_events = await db.events.count_documents({"participants": uid})

    return {
        "km_total": float(current_user.get("km_total", 0.0)),
        "km_month": float(current_user.get("km_month", 0.0)),
        "joined_routes": int(joined_routes),
        "events_joined": int(joined_events),
        "completed_routes": 0,
    }


@api_router.get("/friends", response_model=list[UserSearchOut])
async def friends_list(current_user: dict = Depends(get_current_user)):
    ids = current_user.get("friends") or []
    if not ids:
        return []

    oids = [_as_object_id(i) for i in ids]
    cursor = db.users.find({"_id": {"$in": oids}}, {"username": 1, "profile_photo_base64": 1})
    docs = await cursor.to_list(length=200)

    # preserve insertion order
    by_id = {oid_str(d.get("_id")): d for d in docs}
    out: list[UserSearchOut] = []
    for fid in ids:
        d = by_id.get(fid)
        if d:
            out.append(UserSearchOut(id=fid, username=d.get("username", ""), profile_photo_base64=d.get("profile_photo_base64")))
    return out


@api_router.get("/friends/requests", response_model=FriendRequestOut)
async def friends_requests(current_user: dict = Depends(get_current_user)):
    incoming_ids = current_user.get("friend_requests_in") or []
    outgoing_ids = current_user.get("friend_requests_out") or []

    async def _resolve(ids: list[str]) -> list[UserSearchOut]:
        if not ids:
            return []
        oids = [_as_object_id(i) for i in ids]
        cursor = db.users.find({"_id": {"$in": oids}}, {"username": 1, "profile_photo_base64": 1})
        docs = await cursor.to_list(length=200)
        by_id = {oid_str(d.get("_id")): d for d in docs}
        out: list[UserSearchOut] = []
        for uid in ids:
            d = by_id.get(uid)
            if d:
                out.append(UserSearchOut(id=uid, username=d.get("username", ""), profile_photo_base64=d.get("profile_photo_base64")))
        return out

    incoming = await _resolve(incoming_ids)
    outgoing = await _resolve(outgoing_ids)
    return FriendRequestOut(incoming=incoming, outgoing=outgoing)


@api_router.post("/friends/request")
async def friends_request(payload: FriendRequestCreate, current_user: dict = Depends(get_current_user)):
    to_username = payload.to_username.strip()
    target = await db.users.find_one({"username": {"$regex": f"^{to_username}$", "$options": "i"}})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    from_id = current_user["id"]
    from_username = current_user.get("username", "Someone")
    to_id = oid_str(target.get("_id"))

    if to_id == from_id:
        raise HTTPException(status_code=400, detail="Cannot add yourself")

    # already friends?
    if from_id in (target.get("friends") or []):
        return {"ok": True}

    await db.users.update_one({"_id": _as_object_id(to_id)}, {"$addToSet": {"friend_requests_in": from_id}})
    await db.users.update_one({"_id": _as_object_id(from_id)}, {"$addToSet": {"friend_requests_out": to_id}})
    
    # Create notification for the recipient
    await create_notification(
        user_id=to_id,
        notif_type="friend_request",
        title="New Friend Request",
        message=f"{from_username} wants to be your friend",
        data={"from_user_id": from_id, "from_username": from_username}
    )
    
    return {"ok": True}


@api_router.post("/friends/accept")
async def friends_accept(payload: FriendAccept, current_user: dict = Depends(get_current_user)):
    from_id = payload.from_user_id
    to_id = current_user["id"]
    to_username = current_user.get("username", "Someone")

    # must exist in incoming
    if from_id not in (current_user.get("friend_requests_in") or []):
        raise HTTPException(status_code=400, detail="No such request")

    # add friendship both sides
    await db.users.update_one(
        {"_id": _as_object_id(to_id)},
        {
            "$addToSet": {"friends": from_id},
            "$pull": {"friend_requests_in": from_id},
        },
    )
    await db.users.update_one(
        {"_id": _as_object_id(from_id)},
        {
            "$addToSet": {"friends": to_id},
            "$pull": {"friend_requests_out": to_id},
        },
    )
    
    # Create notification for the person who sent the request
    await create_notification(
        user_id=from_id,
        notif_type="friend_accepted",
        title="Friend Request Accepted",
        message=f"{to_username} accepted your friend request",
        data={"user_id": to_id, "username": to_username}
    )
    
    return {"ok": True}


@api_router.post("/friends/reject")
async def friends_reject(payload: FriendAccept, current_user: dict = Depends(get_current_user)):
    """Reject a friend request."""
    from_id = payload.from_user_id
    to_id = current_user["id"]

    # must exist in incoming
    if from_id not in (current_user.get("friend_requests_in") or []):
        raise HTTPException(status_code=400, detail="No such request")

    # remove from both sides without adding as friend
    await db.users.update_one(
        {"_id": _as_object_id(to_id)},
        {"$pull": {"friend_requests_in": from_id}},
    )
    await db.users.update_one(
        {"_id": _as_object_id(from_id)},
        {"$pull": {"friend_requests_out": to_id}},
    )
    return {"ok": True}


@api_router.post("/groups", response_model=GroupOut)
async def groups_create(payload: GroupCreate, current_user: dict = Depends(get_current_user)):
    now = datetime.utcnow()
    owner_id = current_user["id"]
    doc = {
        "name": payload.name.strip(),
        "description": payload.description.strip(),
        "is_private": payload.is_private,
        "photo_base64": payload.photo_base64,
        "owner_id": owner_id,
        "admins": [owner_id],
        "members": [owner_id],
        "created_at": now,
    }
    res = await db.groups.insert_one(doc)
    return GroupOut(
        id=oid_str(res.inserted_id),
        name=doc["name"],
        description=doc["description"],
        is_private=doc["is_private"],
        owner_id=doc["owner_id"],
        admins=doc["admins"],
        members_count=len(doc["members"]),
        members=doc["members"],
        photo_base64=doc.get("photo_base64"),
        created_at=doc["created_at"],
    )


@api_router.get("/groups", response_model=list[GroupOut])
async def groups_list(current_user: dict = Depends(get_current_user)):
    uid = current_user["id"]
    cursor = db.groups.find({"members": uid}).sort("created_at", -1)
    docs = await cursor.to_list(length=200)
    out: list[GroupOut] = []
    for g in docs:
        out.append(
            GroupOut(
                id=oid_str(g.get("_id")),
                name=g.get("name", ""),
                description=g.get("description", ""),
                is_private=bool(g.get("is_private", False)),
                owner_id=g.get("owner_id", ""),
                admins=g.get("admins") or [],
                members_count=len(g.get("members") or []),
                members=g.get("members") or [],
                photo_base64=g.get("photo_base64"),
                created_at=g.get("created_at") or datetime.utcnow(),
            )
        )
    return out


@api_router.post("/groups/{group_id}/join")
async def groups_join(group_id: str, current_user: dict = Depends(get_current_user)):
    uid = current_user["id"]
    g = await db.groups.find_one({"_id": _as_object_id(group_id)})
    if not g:
        raise HTTPException(status_code=404, detail="Group not found")

    await db.groups.update_one({"_id": _as_object_id(group_id)}, {"$addToSet": {"members": uid}})
    return {"ok": True}


@api_router.get("/groups/{group_id}/members")
async def get_group_members(group_id: str, current_user: dict = Depends(get_current_user)):
    """Get list of members in a group."""
    g = await db.groups.find_one({"_id": _as_object_id(group_id)})
    if not g:
        raise HTTPException(status_code=404, detail="Group not found")
    
    member_ids = g.get("members") or []
    members = []
    
    for mid in member_ids:
        user = await db.users.find_one({"_id": _as_object_id(mid)})
        if user:
            members.append({
                "id": _oid_str(user.get("_id")),
                "username": user.get("username", ""),
                "avatar": user.get("avatar"),
                "level": user.get("level", 0),
            })
    
    # Use owner_id as it's the field name in DB
    owner_id = g.get("owner_id") or g.get("created_by", "")
    
    return {
        "group_id": group_id,
        "group_name": g.get("name", ""),
        "created_by": owner_id,
        "members": members,
    }


@api_router.post("/groups/{group_id}/add-member")
async def add_group_member(group_id: str, payload: dict, current_user: dict = Depends(get_current_user)):
    """Add a member to a group (only creator or admin can add)."""
    uid = current_user["id"]
    inviter_username = current_user.get("username", "Someone")
    g = await db.groups.find_one({"_id": _as_object_id(group_id)})
    if not g:
        raise HTTPException(status_code=404, detail="Group not found")
    
    # Check if user is creator (owner_id)
    owner_id = g.get("owner_id") or g.get("created_by", "")
    if owner_id != uid:
        raise HTTPException(status_code=403, detail="Only the group creator can add members")
    
    user_id = payload.get("user_id")
    if not user_id:
        raise HTTPException(status_code=400, detail="user_id is required")
    
    # Check if user exists
    target_user = await db.users.find_one({"_id": _as_object_id(user_id)})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    await db.groups.update_one({"_id": _as_object_id(group_id)}, {"$addToSet": {"members": user_id}})
    
    # Create notification for the added user
    group_name = g.get("name", "a group")
    await create_notification(
        user_id=user_id,
        notif_type="group_invite",
        title="Added to Group",
        message=f"{inviter_username} added you to '{group_name}'",
        data={"group_id": group_id, "group_name": group_name, "inviter_id": uid}
    )
    
    return {"ok": True}


@api_router.post("/groups/{group_id}/remove-member")
async def remove_group_member(group_id: str, payload: dict, current_user: dict = Depends(get_current_user)):
    """Remove a member from a group (only creator can remove, or user can leave)."""
    uid = current_user["id"]
    g = await db.groups.find_one({"_id": _as_object_id(group_id)})
    if not g:
        raise HTTPException(status_code=404, detail="Group not found")
    
    user_id = payload.get("user_id")
    if not user_id:
        raise HTTPException(status_code=400, detail="user_id is required")
    
    # Use owner_id as it's the field name in DB
    owner_id = g.get("owner_id") or g.get("created_by", "")
    
    # Allow creator to remove anyone, or user to remove themselves
    if owner_id != uid and user_id != uid:
        raise HTTPException(status_code=403, detail="Only the group creator can remove members")
    
    await db.groups.update_one({"_id": _as_object_id(group_id)}, {"$pull": {"members": user_id}})
    return {"ok": True}


@api_router.get("/dm/{other_user_id}/messages", response_model=list[MessageOut])
async def dm_messages(other_user_id: str, limit: int = Query(default=50, ge=1, le=200), current_user: dict = Depends(get_current_user)):
    uid = current_user["id"]
    thread_id = dm_thread_id(uid, other_user_id)
    cursor = db.messages.find({"thread_id": thread_id}).sort("created_at", -1).limit(limit)
    docs = await cursor.to_list(length=limit)
    out: list[MessageOut] = []

    for m in reversed(docs):
        out.append(
            MessageOut(
                id=oid_str(m.get("_id")),
                thread_id=m.get("thread_id"),
                kind=m.get("kind"),
                from_user_id=m.get("from_user_id"),
                to_user_id=m.get("to_user_id"),
                group_id=m.get("group_id"),
                text=m.get("text", ""),
                created_at=m.get("created_at") or datetime.utcnow(),
            )
        )
    return out


@api_router.post("/events/{event_id}/join")
async def event_join(event_id: str, current_user: dict = Depends(get_current_user)):
    uid = current_user["id"]
    res = await db.events.update_one({"_id": _as_object_id(event_id)}, {"$addToSet": {"participants": uid}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Event not found")
    return {"ok": True}


@api_router.post("/events/{event_id}/leave")
async def event_leave(event_id: str, current_user: dict = Depends(get_current_user)):
    uid = current_user["id"]
    res = await db.events.update_one({"_id": _as_object_id(event_id)}, {"$pull": {"participants": uid}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Event not found")
    return {"ok": True}


@api_router.post("/events/{event_id}/invite")
async def event_invite(event_id: str, payload: dict, current_user: dict = Depends(get_current_user)):
    """Invite a user to an event (sends notification)."""
    uid = current_user["id"]
    inviter_username = current_user.get("username", "Someone")
    
    event = await db.events.find_one({"_id": _as_object_id(event_id)})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    user_id = payload.get("user_id")
    if not user_id:
        raise HTTPException(status_code=400, detail="user_id is required")
    
    # Check if target user exists
    target_user = await db.users.find_one({"_id": _as_object_id(user_id)})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    event_title = event.get("title", "an event")
    await create_notification(
        user_id=user_id,
        notif_type="event_invite",
        title="Event Invitation",
        message=f"{inviter_username} invited you to '{event_title}'",
        data={"event_id": event_id, "event_title": event_title, "inviter_id": uid}
    )
    
    return {"ok": True}


@api_router.post("/dm/{other_user_id}/messages", response_model=MessageOut)
async def dm_send_rest(other_user_id: str, payload: MessageCreate, current_user: dict = Depends(get_current_user)):
    uid = current_user["id"]
    # Reuse socket logic via direct insert and emit
    thread_id = dm_thread_id(uid, other_user_id)
    now = datetime.utcnow()
    doc = {
        "kind": "dm",
        "thread_id": thread_id,
        "from_user_id": uid,
        "to_user_id": other_user_id,
        "group_id": None,
        "text": payload.text.strip(),
        "created_at": now,
    }
    res = await db.messages.insert_one(doc)
    out = MessageOut(
        id=oid_str(res.inserted_id),
        thread_id=thread_id,
        kind="dm",
        from_user_id=uid,
        to_user_id=other_user_id,
        group_id=None,
        text=doc["text"],
        created_at=now,
    )
    await sio.emit(
        "dm:new",
        {
            **out.model_dump(),
            "created_at": now.isoformat(),
        },
        room=f"user:{uid}",
    )
    await sio.emit(
        "dm:new",
        {
            **out.model_dump(),
            "created_at": now.isoformat(),
        },
        room=f"user:{other_user_id}",
    )
    return out


@api_router.get("/groups/{group_id}/messages", response_model=list[MessageOut])
async def group_messages(group_id: str, limit: int = Query(default=50, ge=1, le=200), current_user: dict = Depends(get_current_user)):
    uid = current_user["id"]
    if not await is_group_member(group_id, uid):
        raise HTTPException(status_code=403, detail="Not a group member")

    thread_id = f"group:{group_id}"
    cursor = db.messages.find({"thread_id": thread_id}).sort("created_at", -1).limit(limit)
    docs = await cursor.to_list(length=limit)
    out: list[MessageOut] = []
    for m in reversed(docs):
        out.append(
            MessageOut(
                id=oid_str(m.get("_id")),
                thread_id=m.get("thread_id"),
                kind=m.get("kind"),
                from_user_id=m.get("from_user_id"),
                to_user_id=m.get("to_user_id"),
                group_id=m.get("group_id"),
                text=m.get("text", ""),
                created_at=m.get("created_at") or datetime.utcnow(),
            )
        )
    return out


@api_router.post("/groups/{group_id}/messages", response_model=MessageOut)
async def group_send_rest(group_id: str, payload: MessageCreate, current_user: dict = Depends(get_current_user)):
    uid = current_user["id"]
    if not await is_group_member(group_id, uid):
        raise HTTPException(status_code=403, detail="Not a group member")

    thread_id = f"group:{group_id}"
    now = datetime.utcnow()
    doc = {
        "kind": "group",
        "thread_id": thread_id,
        "from_user_id": uid,
        "to_user_id": None,
        "group_id": group_id,
        "text": payload.text.strip(),
        "created_at": now,
    }
    res = await db.messages.insert_one(doc)
    out = MessageOut(
        id=oid_str(res.inserted_id),
        thread_id=thread_id,
        kind="group",
        from_user_id=uid,
        to_user_id=None,
        group_id=group_id,
        text=doc["text"],
        created_at=now,
    )
    await sio.emit(
        "group:new",
        {
            **out.model_dump(),
            "created_at": now.isoformat(),
        },
        room=f"group:{group_id}",
    )
    return out


@api_router.post("/routes", response_model=RouteOut)
async def create_route(payload: RouteCreate, current_user: dict = Depends(get_current_user)):
    uid = current_user["id"]
    
    if payload.participants_min > payload.participants_max:
        raise HTTPException(status_code=400, detail="participants_min cannot exceed participants_max")

    distance_km = polyline_distance_km(payload.polyline)
    duration_min = estimate_duration_min(distance_km, payload.difficulty)

    # Optional Google compute (more accurate)
    if payload.use_google_directions:
        origin = payload.polyline[0]
        destination = payload.polyline[-1]
        waypoints = payload.polyline[1:-1] if len(payload.polyline) > 2 else None
        distance_km, duration_min = await google_directions_distance_duration(origin, destination, waypoints)

    cost = estimate_cost(
        distance_km=distance_km,
        fuel_price_per_l=payload.fuel_price_per_l,
        bike_consumption_l_per_100km=payload.bike_consumption_l_per_100km,
        toll_estimate=payload.toll_estimate,
        currency=payload.currency,
    )

    now = datetime.utcnow()
    doc = {
        "title": payload.title,
        "description": payload.description,
        "polyline": payload.polyline,
        "distance_km": distance_km,
        "duration_min": duration_min,
        "stops_count": payload.stops_count,
        "cost_estimate": cost,
        "rules": payload.rules,
        "difficulty": payload.difficulty,
        "participants_min": payload.participants_min,
        "participants_max": payload.participants_max,
        "participants": [uid],  # Creator automatically joins
        "created_by": uid,
        "start_date": payload.start_date,
        "created_at": now,
    }

    res = await db.routes.insert_one(doc)
    out = RouteOut(
        id=_oid_str(res.inserted_id),
        title=doc["title"],
        description=doc["description"],
        polyline=doc["polyline"],
        distance_km=doc["distance_km"],
        duration_min=doc["duration_min"],
        stops_count=doc["stops_count"],
        cost_estimate=CostEstimate(**doc["cost_estimate"]),
        rules=doc["rules"],
        difficulty=doc["difficulty"],
        participants_min=doc["participants_min"],
        participants_max=doc["participants_max"],
        participants_count=1,
        is_joined=True,
        created_by=uid,
        start_date=doc.get("start_date"),
        created_at=doc["created_at"],
    )
    return out


@api_router.get("/routes", response_model=list[RouteOut])
async def list_routes(
    limit: int = Query(default=50, ge=1, le=200),
    lat: float = Query(default=None, description="User latitude for filtering"),
    lng: float = Query(default=None, description="User longitude for filtering"),
    radius_km: float = Query(default=500, ge=10, le=5000, description="Search radius in km"),
    current_user: dict = Depends(get_current_user),
):
    uid = current_user["id"]
    cursor = db.routes.find().sort("created_at", -1).limit(limit)
    routes = await cursor.to_list(length=limit)
    result: list[RouteOut] = []
    
    for r in routes:
        participants = r.get("participants") or []
        polyline = r.get("polyline", [])
        
        # Filter by distance if user location provided
        if lat is not None and lng is not None and len(polyline) > 0:
            start_point = polyline[0]
            distance_to_route = haversine_km([lat, lng], start_point)
            if distance_to_route > radius_km:
                continue  # Skip routes too far away
        
        result.append(
            RouteOut(
                id=_oid_str(r.get("_id")),
                title=r.get("title", ""),
                description=r.get("description", ""),
                polyline=polyline,
                distance_km=float(r.get("distance_km", 0.0)),
                duration_min=int(r.get("duration_min", 0)),
                stops_count=int(r.get("stops_count", 0)),
                cost_estimate=CostEstimate(**(r.get("cost_estimate") or {"fuel": 0, "tolls": 0, "currency": "RON"})),
                rules=r.get("rules", ""),
                difficulty=r.get("difficulty", "medium"),
                participants_min=int(r.get("participants_min", 1)),
                participants_max=int(r.get("participants_max", 10)),
                participants_count=len(participants),
                is_joined=uid in participants,
                created_by=r.get("created_by", ""),
                start_date=r.get("start_date"),
                created_at=r.get("created_at") or datetime.utcnow(),
            )
        )
    return result


@api_router.post("/events", response_model=EventOut)
async def create_event(payload: EventCreate, current_user: dict = Depends(get_current_user)):
    uid = current_user["id"]
    now = datetime.utcnow()

    doc = {
        "title": payload.title,
        "description": payload.description,
        "start_point": payload.start_point,
        "location_name": payload.location_name,
        "start_time": payload.start_time,
        "poster_base64": payload.poster_base64,
        "associated_route_id": payload.associated_route_id,
        "participants": [uid],  # Creator automatically joins
        "created_by": uid,
        "created_at": now,
    }

    res = await db.events.insert_one(doc)
    
    # Award badge for first event creation
    await check_and_award_badges(uid)

    return EventOut(
        id=_oid_str(res.inserted_id),
        title=doc["title"],
        description=doc["description"],
        start_point=doc["start_point"],
        location_name=doc.get("location_name", ""),
        start_time=doc["start_time"],
        poster_base64=doc.get("poster_base64"),
        associated_route_id=doc.get("associated_route_id"),
        participants_count=1,
        is_joined=True,
        created_by=uid,
        created_at=doc["created_at"],
    )


@api_router.get("/events", response_model=list[EventOut])
async def list_events(
    limit: int = Query(default=50, ge=1, le=200),
    current_user: dict = Depends(get_current_user),
):
    uid = current_user["id"]
    cursor = db.events.find().sort("created_at", -1).limit(limit)
    events = await cursor.to_list(length=limit)
    result: list[EventOut] = []
    for e in events:
        participants = e.get("participants") or []
        result.append(
            EventOut(
                id=_oid_str(e.get("_id")),
                title=e.get("title", ""),
                description=e.get("description", ""),
                start_point=e.get("start_point", [0, 0]),
                location_name=e.get("location_name", ""),
                start_time=e.get("start_time") or datetime.utcnow(),
                poster_base64=e.get("poster_base64"),
                associated_route_id=e.get("associated_route_id"),
                participants_count=len(participants),
                is_joined=uid in participants,
                created_by=e.get("created_by", ""),
                created_at=e.get("created_at") or datetime.utcnow(),
            )
        )
    return result




# -----------------
# Stories Endpoints
# -----------------

STORY_EXPIRATION_SECONDS = 24 * 60 * 60  # 24 hours


async def ensure_stories_ttl_index():
    """Create TTL index on stories collection for automatic 24h expiration."""
    try:
        await db.stories.create_index(
            "expires_at",
            expireAfterSeconds=0,
            name="stories_ttl_idx",
            background=True,
        )
    except Exception:
        # Index might already exist
        pass


@api_router.post("/stories", response_model=StoryOut)
async def create_story(payload: StoryCreate, current_user: dict = Depends(get_current_user)):
    """Create a new story (24h expiration)."""
    await ensure_stories_ttl_index()
    
    uid = current_user["id"]
    now = datetime.utcnow()
    expires = now + timedelta(seconds=STORY_EXPIRATION_SECONDS)
    
    doc = {
        "owner_id": uid,
        "media_base64": payload.media_base64,
        "media_type": payload.media_type,
        "caption": payload.caption,
        "created_at": now,
        "expires_at": expires,
    }
    
    res = await db.stories.insert_one(doc)
    
    return StoryOut(
        id=oid_str(res.inserted_id),
        owner_id=uid,
        owner_username=current_user.get("username", ""),
        owner_photo=current_user.get("profile_photo_base64"),
        media_base64=doc["media_base64"],
        media_type=doc["media_type"],
        caption=doc["caption"],
        created_at=doc["created_at"],
        expires_at=doc["expires_at"],
    )


@api_router.get("/stories", response_model=list[StoryOwner])
async def get_stories(current_user: dict = Depends(get_current_user)):
    """Get stories from friends (and self) from the last 24h, grouped by owner."""
    uid = current_user["id"]
    friend_ids = current_user.get("friends") or []
    
    # Include self and friends
    relevant_user_ids = [uid] + friend_ids
    
    # Fetch non-expired stories from relevant users
    now = datetime.utcnow()
    cursor = db.stories.find({
        "owner_id": {"$in": relevant_user_ids},
        "expires_at": {"$gt": now},
    }).sort("created_at", 1)
    
    stories_docs = await cursor.to_list(length=500)
    
    if not stories_docs:
        return []
    
    # Get unique owner IDs
    owner_ids = list(set(s.get("owner_id") for s in stories_docs if s.get("owner_id")))
    
    # Fetch owner info
    owner_oids = [_as_object_id(oid) for oid in owner_ids]
    owners_cursor = db.users.find({"_id": {"$in": owner_oids}}, {"username": 1, "profile_photo_base64": 1})
    owners_docs = await owners_cursor.to_list(length=100)
    owners_map = {oid_str(o.get("_id")): o for o in owners_docs}
    
    # Group stories by owner
    grouped: dict[str, list[StoryOut]] = {}
    for s in stories_docs:
        owner_id = s.get("owner_id", "")
        owner_info = owners_map.get(owner_id, {})
        
        story = StoryOut(
            id=oid_str(s.get("_id")),
            owner_id=owner_id,
            owner_username=owner_info.get("username", "Unknown"),
            owner_photo=owner_info.get("profile_photo_base64"),
            media_base64=s.get("media_base64", ""),
            media_type=s.get("media_type", "image"),
            caption=s.get("caption"),
            created_at=s.get("created_at") or now,
            expires_at=s.get("expires_at") or now,
        )
        
        if owner_id not in grouped:
            grouped[owner_id] = []
        grouped[owner_id].append(story)
    
    # Build final response with owner first (self), then friends
    result: list[StoryOwner] = []
    
    # Self first
    if uid in grouped:
        owner_info = owners_map.get(uid, {})
        result.append(StoryOwner(
            user_id=uid,
            username=owner_info.get("username", current_user.get("username", "")),
            profile_photo=owner_info.get("profile_photo_base64") or current_user.get("profile_photo_base64"),
            stories=grouped[uid],
        ))
    
    # Then friends
    for friend_id in friend_ids:
        if friend_id in grouped and friend_id != uid:
            owner_info = owners_map.get(friend_id, {})
            result.append(StoryOwner(
                user_id=friend_id,
                username=owner_info.get("username", ""),
                profile_photo=owner_info.get("profile_photo_base64"),
                stories=grouped[friend_id],
            ))
    
    return result


@api_router.delete("/stories/{story_id}")
async def delete_story(story_id: str, current_user: dict = Depends(get_current_user)):
    """Delete own story."""
    uid = current_user["id"]
    res = await db.stories.delete_one({"_id": _as_object_id(story_id), "owner_id": uid})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Story not found or not owned by you")
    return {"ok": True}


# -----------------
# Map Reports Endpoints
# -----------------

async def ensure_reports_ttl_index():
    """Create TTL index on reports collection for automatic expiration."""
    try:
        await db.reports.create_index(
            "expires_at",
            expireAfterSeconds=0,
            name="reports_ttl_idx",
            background=True,
        )
    except Exception:
        pass


@api_router.post("/reports", response_model=ReportOut)
async def create_report(payload: ReportCreate, current_user: dict = Depends(get_current_user)):
    """Create a new map report (police, hazard, etc.)."""
    await ensure_reports_ttl_index()
    
    uid = current_user["id"]
    now = datetime.utcnow()
    ttl_minutes = REPORT_TTL_MINUTES.get(payload.report_type, 60)
    expires = now + timedelta(minutes=ttl_minutes)
    
    doc = {
        "report_type": payload.report_type,
        "location": payload.location,
        "description": payload.description,
        "reporter_id": uid,
        "votes_up": 0,
        "votes_down": 0,
        "voters": [],
        "created_at": now,
        "expires_at": expires,
    }
    
    res = await db.reports.insert_one(doc)
    
    return ReportOut(
        id=oid_str(res.inserted_id),
        report_type=doc["report_type"],
        location=doc["location"],
        description=doc["description"],
        reporter_id=uid,
        reporter_username=current_user.get("username", ""),
        votes_up=0,
        votes_down=0,
        created_at=doc["created_at"],
        expires_at=doc["expires_at"],
    )


@api_router.get("/reports", response_model=list[ReportOut])
async def get_reports(
    lat: float = Query(..., description="Center latitude"),
    lng: float = Query(..., description="Center longitude"),
    radius_km: float = Query(default=50, ge=1, le=200, description="Radius in km"),
    current_user: dict = Depends(get_current_user),
):
    """Get active reports within a radius from a point."""
    now = datetime.utcnow()
    
    # Get all non-expired reports (MongoDB TTL handles cleanup, but filter just in case)
    cursor = db.reports.find({"expires_at": {"$gt": now}}).sort("created_at", -1).limit(500)
    docs = await cursor.to_list(length=500)
    
    # Filter by distance
    result: list[ReportOut] = []
    for r in docs:
        loc = r.get("location", [0, 0])
        dist = haversine_km([lat, lng], loc)
        if dist <= radius_km:
            # Get reporter username
            reporter_id = r.get("reporter_id", "")
            reporter = await db.users.find_one({"_id": _as_object_id(reporter_id)}, {"username": 1})
            reporter_username = reporter.get("username", "Unknown") if reporter else "Unknown"
            
            result.append(ReportOut(
                id=oid_str(r.get("_id")),
                report_type=r.get("report_type", "hazard"),
                location=loc,
                description=r.get("description"),
                reporter_id=reporter_id,
                reporter_username=reporter_username,
                votes_up=r.get("votes_up", 0),
                votes_down=r.get("votes_down", 0),
                created_at=r.get("created_at") or now,
                expires_at=r.get("expires_at") or now,
            ))
    
    return result


@api_router.post("/reports/{report_id}/vote")
async def vote_report(
    report_id: str,
    vote: Literal["up", "down"] = Query(...),
    current_user: dict = Depends(get_current_user),
):
    """Vote on a report (up = confirm, down = invalid)."""
    uid = current_user["id"]
    
    report = await db.reports.find_one({"_id": _as_object_id(report_id)})
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    voters = report.get("voters") or []
    if uid in voters:
        return {"ok": True, "message": "Already voted"}
    
    update = {"$push": {"voters": uid}}
    if vote == "up":
        update["$inc"] = {"votes_up": 1}
        # Extend expiration by 10 minutes on upvote
        new_expires = report.get("expires_at", datetime.utcnow()) + timedelta(minutes=10)
        update["$set"] = {"expires_at": new_expires}
    else:
        update["$inc"] = {"votes_down": 1}
        # If too many downvotes, expire immediately
        if report.get("votes_down", 0) + 1 >= 3:
            update["$set"] = {"expires_at": datetime.utcnow()}
    
    await db.reports.update_one({"_id": _as_object_id(report_id)}, update)
    return {"ok": True}


@api_router.delete("/reports/{report_id}")
async def delete_report(report_id: str, current_user: dict = Depends(get_current_user)):
    """Delete own report."""
    uid = current_user["id"]
    res = await db.reports.delete_one({"_id": _as_object_id(report_id), "reporter_id": uid})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Report not found or not owned by you")
    return {"ok": True}


@api_router.post("/routes/{route_id}/join")
async def route_join(route_id: str, current_user: dict = Depends(get_current_user)):
    uid = current_user["id"]
    res = await db.routes.update_one({"_id": _as_object_id(route_id)}, {"$addToSet": {"participants": uid}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Route not found")
    return {"ok": True}


@api_router.post("/routes/{route_id}/leave")
async def route_leave(route_id: str, current_user: dict = Depends(get_current_user)):
    uid = current_user["id"]
    res = await db.routes.update_one({"_id": _as_object_id(route_id)}, {"$pull": {"participants": uid}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Route not found")
    return {"ok": True}


@api_router.post("/routes/{route_id}/invite")
async def route_invite(route_id: str, payload: dict, current_user: dict = Depends(get_current_user)):
    """Invite a user to a route (sends notification)."""
    uid = current_user["id"]
    inviter_username = current_user.get("username", "Someone")
    
    route = await db.routes.find_one({"_id": _as_object_id(route_id)})
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
    
    user_id = payload.get("user_id")
    if not user_id:
        raise HTTPException(status_code=400, detail="user_id is required")
    
    # Check if target user exists
    target_user = await db.users.find_one({"_id": _as_object_id(user_id)})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    route_title = route.get("title", "a route")
    await create_notification(
        user_id=user_id,
        notif_type="route_invite",
        title="Route Invitation",
        message=f"{inviter_username} invited you to join '{route_title}'",
        data={"route_id": route_id, "route_title": route_title, "inviter_id": uid}
    )
    
    return {"ok": True}


@api_router.get("/routes/my", response_model=list[RouteOut])
async def get_my_routes(current_user: dict = Depends(get_current_user)):
    """Get routes created by the current user."""
    uid = current_user["id"]
    cursor = db.routes.find({"created_by": uid}).sort("created_at", -1)
    routes = await cursor.to_list(length=50)
    result: list[RouteOut] = []
    
    for r in routes:
        participants = r.get("participants") or []
        polyline = r.get("polyline", [])
        
        result.append(
            RouteOut(
                id=_oid_str(r.get("_id")),
                title=r.get("title", ""),
                description=r.get("description", ""),
                polyline=polyline,
                distance_km=float(r.get("distance_km", 0.0)),
                duration_min=int(r.get("duration_min", 0)),
                stops_count=int(r.get("stops_count", 0)),
                cost_estimate=CostEstimate(**(r.get("cost_estimate") or {"fuel": 0, "tolls": 0, "currency": "RON"})),
                rules=r.get("rules", ""),
                difficulty=r.get("difficulty", "medium"),
                participants_min=int(r.get("participants_min", 1)),
                participants_max=int(r.get("participants_max", 10)),
                participants_count=len(participants),
                is_joined=uid in participants,
                created_by=r.get("created_by", ""),
                start_date=r.get("start_date"),
                created_at=r.get("created_at") or datetime.utcnow(),
            )
        )
    return result


@api_router.delete("/routes/{route_id}")
async def delete_route(route_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a route (only creator can delete)."""
    uid = current_user["id"]
    route = await db.routes.find_one({"_id": _as_object_id(route_id)})
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
    if route.get("created_by") != uid:
        raise HTTPException(status_code=403, detail="Only the creator can delete this route")
    
    await db.routes.delete_one({"_id": _as_object_id(route_id)})
    return {"ok": True}


@api_router.delete("/events/{event_id}")
async def delete_event(event_id: str, current_user: dict = Depends(get_current_user)):
    """Delete an event (only creator can delete)."""
    uid = current_user["id"]
    event = await db.events.find_one({"_id": _as_object_id(event_id)})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if event.get("created_by") != uid:
        raise HTTPException(status_code=403, detail="Only the creator can delete this event")
    
    await db.events.delete_one({"_id": _as_object_id(event_id)})
    return {"ok": True}


# -----------------
# Ride Sessions Endpoints (Anti-fraud km tracking)
# -----------------

@api_router.post("/rides/start", response_model=RideSessionOut)
async def start_ride(payload: RideSessionStart, current_user: dict = Depends(get_current_user)):
    """Start a ride session for a route."""
    uid = current_user["id"]
    
    # Check if route exists
    route = await db.routes.find_one({"_id": _as_object_id(payload.route_id)})
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
    
    # Check if user already has an active ride
    active = await db.ride_sessions.find_one({"user_id": uid, "status": "active"})
    if active:
        raise HTTPException(status_code=400, detail="You already have an active ride. End it first.")
    
    now = datetime.utcnow()
    doc = {
        "user_id": uid,
        "route_id": payload.route_id,
        "status": "active",
        "start_time": now,
        "end_time": None,
        "km_tracked": 0,
        "is_validated": False,
    }
    
    res = await db.ride_sessions.insert_one(doc)
    
    return RideSessionOut(
        id=oid_str(res.inserted_id),
        user_id=uid,
        route_id=payload.route_id,
        status="active",
        start_time=now,
        km_tracked=0,
        is_validated=False,
    )


@api_router.post("/rides/end", response_model=RideSessionOut)
async def end_ride(payload: RideSessionEnd, current_user: dict = Depends(get_current_user)):
    """End a ride session and validate kilometers for ALL participants."""
    uid = current_user["id"]
    
    session = await db.ride_sessions.find_one({
        "_id": _as_object_id(payload.session_id),
        "user_id": uid,
        "status": "active",
    })
    if not session:
        raise HTTPException(status_code=404, detail="Active ride session not found")
    
    # Get route to calculate expected km and get participants
    route = await db.routes.find_one({"_id": _as_object_id(session.get("route_id"))})
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
    
    route_km = route.get("distance_km", 0)
    participants = route.get("participants") or []
    
    now = datetime.utcnow()
    start_time = session.get("start_time", now)
    duration_mins = (now - start_time).total_seconds() / 60
    
    # Simple validation: ride must take at least 1 min per 2 km (reasonable motorcycle pace)
    min_duration = route_km / 2
    is_validated = duration_mins >= min_duration and route_km > 0
    
    # If validated, count the route's distance
    km_tracked = route_km if is_validated else 0
    
    await db.ride_sessions.update_one(
        {"_id": _as_object_id(payload.session_id)},
        {"$set": {
            "status": "completed",
            "end_time": now,
            "km_tracked": km_tracked,
            "is_validated": is_validated,
            "participants_credited": participants if is_validated else [],
        }}
    )
    
    # Update stats for ALL participants if validated
    if is_validated and participants:
        for participant_id in participants:
            await db.stats.update_one(
                {"user_id": participant_id},
                {"$inc": {"km_total": km_tracked, "km_month": km_tracked, "completed_routes": 1}},
                upsert=True,
            )
            # Check for badge achievements for each participant
            await check_and_award_badges(participant_id)
    
    # Delete the route after completion (route is one-time use)
    await db.routes.delete_one({"_id": _as_object_id(session.get("route_id"))})
    
    return RideSessionOut(
        id=payload.session_id,
        user_id=uid,
        route_id=session.get("route_id", ""),
        status="completed",
        start_time=start_time,
        end_time=now,
        km_tracked=km_tracked,
        is_validated=is_validated,
    )


@api_router.post("/rides/cancel")
async def cancel_ride(payload: dict, current_user: dict = Depends(get_current_user)):
    """Cancel an active ride session."""
    uid = current_user["id"]
    session_id = payload.get("session_id")
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id is required")
    
    res = await db.ride_sessions.update_one(
        {"_id": _as_object_id(session_id), "user_id": uid, "status": "active"},
        {"$set": {"status": "cancelled", "end_time": datetime.utcnow()}}
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Active ride session not found")
    return {"ok": True}


@api_router.post("/rides/pause")
async def pause_ride(payload: dict, current_user: dict = Depends(get_current_user)):
    """Pause an active ride session."""
    uid = current_user["id"]
    session_id = payload.get("session_id")
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id is required")
    
    session = await db.ride_sessions.find_one({
        "_id": _as_object_id(session_id),
        "user_id": uid,
        "status": "active"
    })
    if not session:
        raise HTTPException(status_code=404, detail="Active ride session not found")
    
    await db.ride_sessions.update_one(
        {"_id": _as_object_id(session_id)},
        {"$set": {"status": "paused", "paused_at": datetime.utcnow()}}
    )
    return {"ok": True, "status": "paused"}


@api_router.post("/rides/resume")
async def resume_ride(payload: dict, current_user: dict = Depends(get_current_user)):
    """Resume a paused ride session."""
    uid = current_user["id"]
    session_id = payload.get("session_id")
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id is required")
    
    session = await db.ride_sessions.find_one({
        "_id": _as_object_id(session_id),
        "user_id": uid,
        "status": "paused"
    })
    if not session:
        raise HTTPException(status_code=404, detail="Paused ride session not found")
    
    # Calculate paused duration and add to total paused time
    paused_at = session.get("paused_at")
    total_paused = session.get("total_paused_seconds", 0)
    if paused_at:
        paused_duration = (datetime.utcnow() - paused_at).total_seconds()
        total_paused += paused_duration
    
    await db.ride_sessions.update_one(
        {"_id": _as_object_id(session_id)},
        {
            "$set": {
                "status": "active",
                "paused_at": None,
                "total_paused_seconds": total_paused
            }
        }
    )
    return {"ok": True, "status": "active"}


@api_router.post("/rides/update-location")
async def update_ride_location(payload: dict, current_user: dict = Depends(get_current_user)):
    """Update creator's current location during a ride (for progress tracking)."""
    uid = current_user["id"]
    session_id = payload.get("session_id")
    lat = payload.get("lat")
    lng = payload.get("lng")
    
    if not session_id or lat is None or lng is None:
        raise HTTPException(status_code=400, detail="session_id, lat, and lng are required")
    
    session = await db.ride_sessions.find_one({
        "_id": _as_object_id(session_id),
        "user_id": uid,
        "status": {"$in": ["active", "paused"]}
    })
    if not session:
        raise HTTPException(status_code=404, detail="Ride session not found")
    
    await db.ride_sessions.update_one(
        {"_id": _as_object_id(session_id)},
        {
            "$set": {
                "current_location": {"lat": lat, "lng": lng},
                "location_updated_at": datetime.utcnow()
            }
        }
    )
    return {"ok": True}


class RideProgressOut(BaseModel):
    ride_id: str
    route_id: str
    route_title: str
    creator_id: str
    creator_username: str
    status: str
    progress_percent: float
    distance_km: float
    elapsed_minutes: float
    participants: List[str]
    is_creator: bool
    current_location: Optional[dict] = None


@api_router.get("/rides/{ride_id}/progress", response_model=RideProgressOut)
async def get_ride_progress(ride_id: str, current_user: dict = Depends(get_current_user)):
    """Get detailed progress of a ride (visible to creator and participants)."""
    uid = current_user["id"]
    
    session = await db.ride_sessions.find_one({"_id": _as_object_id(ride_id)})
    if not session:
        raise HTTPException(status_code=404, detail="Ride not found")
    
    route = await db.routes.find_one({"_id": _as_object_id(session.get("route_id"))})
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
    
    # Check if user is creator or participant
    creator_id = session.get("user_id")
    participants = route.get("participants", [])
    
    if uid != creator_id and uid not in participants:
        raise HTTPException(status_code=403, detail="You are not part of this ride")
    
    # Get creator info
    creator = await db.users.find_one({"_id": _as_object_id(creator_id)})
    creator_username = creator.get("username", "Unknown") if creator else "Unknown"
    
    # Calculate progress based on current location vs route
    progress_percent = 0.0
    current_loc = session.get("current_location")
    
    if current_loc and route.get("waypoints"):
        waypoints = route.get("waypoints", [])
        if len(waypoints) >= 2:
            # Simple progress calculation: distance from start / total distance
            start = waypoints[0]
            end = waypoints[-1]
            total_dist = haversine_distance(
                start.get("lat", 0), start.get("lng", 0),
                end.get("lat", 0), end.get("lng", 0)
            )
            dist_from_start = haversine_distance(
                start.get("lat", 0), start.get("lng", 0),
                current_loc.get("lat", 0), current_loc.get("lng", 0)
            )
            if total_dist > 0:
                progress_percent = min(100.0, (dist_from_start / total_dist) * 100)
    
    # Calculate elapsed time (excluding paused time)
    start_time = session.get("start_time", datetime.utcnow())
    total_paused = session.get("total_paused_seconds", 0)
    elapsed_seconds = (datetime.utcnow() - start_time).total_seconds() - total_paused
    elapsed_minutes = max(0, elapsed_seconds / 60)
    
    return RideProgressOut(
        ride_id=ride_id,
        route_id=session.get("route_id", ""),
        route_title=route.get("title", "Unknown Route"),
        creator_id=creator_id,
        creator_username=creator_username,
        status=session.get("status", "unknown"),
        progress_percent=round(progress_percent, 1),
        distance_km=route.get("distance_km", 0),
        elapsed_minutes=round(elapsed_minutes, 1),
        participants=participants,
        is_creator=(uid == creator_id),
        current_location=current_loc
    )


@api_router.get("/rides/active", response_model=Optional[RideSessionOut])
async def get_active_ride(current_user: dict = Depends(get_current_user)):
    """Get current active or paused ride session if any."""
    uid = current_user["id"]
    
    # Find active OR paused rides (both are "in progress")
    session = await db.ride_sessions.find_one({
        "user_id": uid, 
        "status": {"$in": ["active", "paused"]}
    })
    if not session:
        return None
    
    return RideSessionOut(
        id=oid_str(session.get("_id")),
        user_id=uid,
        route_id=session.get("route_id", ""),
        status=session.get("status", "active"),  # Return actual status!
        start_time=session.get("start_time"),
        km_tracked=session.get("km_tracked", 0),
        is_validated=False,
    )


# -----------------
# Badges & Gamification Endpoints
# -----------------

async def check_and_award_badges(user_id: str):
    """Check and award badges based on user achievements."""
    # Get user stats
    stats = await db.stats.find_one({"user_id": user_id}) or {}
    km_total = stats.get("km_total", 0)
    completed_routes = stats.get("completed_routes", 0)
    
    # Get user info
    user = await db.users.find_one({"_id": _as_object_id(user_id)})
    friends_count = len(user.get("friends", [])) if user else 0
    
    # Get existing badges
    existing = await db.badges.find({"user_id": user_id}).to_list(length=100)
    existing_types = {b.get("badge_type") for b in existing}
    
    # Count reports made
    reports_count = await db.reports.count_documents({"reporter_id": user_id})
    
    # Count events created
    events_created = await db.events.count_documents({"created_by": user_id})
    
    badges_to_award = []
    now = datetime.utcnow()
    
    # Check each badge condition
    if completed_routes >= 1 and "first_ride" not in existing_types:
        badges_to_award.append({"user_id": user_id, "badge_type": "first_ride", "earned_at": now})
    
    if completed_routes >= 10 and "explorer_10" not in existing_types:
        badges_to_award.append({"user_id": user_id, "badge_type": "explorer_10", "earned_at": now})
    
    if completed_routes >= 50 and "explorer_50" not in existing_types:
        badges_to_award.append({"user_id": user_id, "badge_type": "explorer_50", "earned_at": now})
    
    if km_total >= 100 and "km_100" not in existing_types:
        badges_to_award.append({"user_id": user_id, "badge_type": "km_100", "earned_at": now})
    
    if km_total >= 500 and "km_500" not in existing_types:
        badges_to_award.append({"user_id": user_id, "badge_type": "km_500", "earned_at": now})
    
    if km_total >= 1000 and "km_1000" not in existing_types:
        badges_to_award.append({"user_id": user_id, "badge_type": "km_1000", "earned_at": now})
    
    if km_total >= 5000 and "km_5000" not in existing_types:
        badges_to_award.append({"user_id": user_id, "badge_type": "km_5000", "earned_at": now})
    
    if km_total >= 10000 and "km_10000" not in existing_types:
        badges_to_award.append({"user_id": user_id, "badge_type": "km_10000", "earned_at": now})
    
    if events_created >= 1 and "event_creator" not in existing_types:
        badges_to_award.append({"user_id": user_id, "badge_type": "event_creator", "earned_at": now})
    
    if friends_count >= 5 and "social_5" not in existing_types:
        badges_to_award.append({"user_id": user_id, "badge_type": "social_5", "earned_at": now})
    
    if friends_count >= 20 and "social_20" not in existing_types:
        badges_to_award.append({"user_id": user_id, "badge_type": "social_20", "earned_at": now})
    
    if reports_count >= 10 and "reporter" not in existing_types:
        badges_to_award.append({"user_id": user_id, "badge_type": "reporter", "earned_at": now})
    
    if badges_to_award:
        await db.badges.insert_many(badges_to_award)


@api_router.get("/badges", response_model=list[BadgeOut])
async def get_my_badges(current_user: dict = Depends(get_current_user)):
    """Get all badges earned by current user."""
    uid = current_user["id"]
    
    # Check for new badges first
    await check_and_award_badges(uid)
    
    cursor = db.badges.find({"user_id": uid}).sort("earned_at", -1)
    badges = await cursor.to_list(length=100)
    
    result = []
    for b in badges:
        badge_type = b.get("badge_type", "")
        info = BADGE_INFO.get(badge_type, {})
        result.append(BadgeOut(
            badge_type=badge_type,
            name=info.get("name", badge_type),
            description=info.get("description", ""),
            icon=info.get("icon", "star"),
            earned_at=b.get("earned_at", datetime.utcnow()),
        ))
    
    return result


@api_router.get("/badges/all")
async def get_all_badges():
    """Get all available badges with their info."""
    return [
        {
            "badge_type": bt,
            "name": info["name"],
            "description": info["description"],
            "icon": info["icon"],
        }
        for bt, info in BADGE_INFO.items()
    ]


@api_router.get("/leaderboard", response_model=list[LeaderboardEntry])
async def get_leaderboard(limit: int = Query(default=50, ge=1, le=100)):
    """Get top riders by total kilometers."""
    cursor = db.stats.find().sort("km_total", -1).limit(limit)
    stats = await cursor.to_list(length=limit)
    
    result = []
    for rank, s in enumerate(stats, 1):
        user_id = s.get("user_id", "")
        user = await db.users.find_one({"_id": _as_object_id(user_id)}, {"username": 1, "profile_photo_base64": 1})
        username = user.get("username", "Unknown") if user else "Unknown"
        profile_photo = user.get("profile_photo_base64") if user else None
        
        km_total = s.get("km_total", 0)
        
        # Calculate level
        level = 1
        if km_total >= 100: level = 2
        if km_total >= 500: level = 3
        if km_total >= 1000: level = 4
        if km_total >= 2500: level = 5
        if km_total >= 5000: level = 6
        if km_total >= 10000: level = 7
        if km_total >= 25000: level = 8
        if km_total >= 50000: level = 9
        if km_total >= 100000: level = 10
        
        # Count badges
        badges_count = await db.badges.count_documents({"user_id": user_id})
        
        result.append(LeaderboardEntry(
            rank=rank,
            user_id=user_id,
            username=username,
            profile_photo=profile_photo,
            km_total=km_total,
            level=level,
            badges_count=badges_count,
        ))
    
    return result


# Include router
fastapi_app.include_router(api_router)

fastapi_app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@fastapi_app.on_event("shutdown")
async def shutdown_db_client():
    client.close()


@fastapi_app.get("/api/realtime/health")
async def realtime_health():
    return {"ok": True}


# IMPORTANT: use /api/socket.io so Kubernetes ingress routes to backend (only /api/* is proxied).
app = socketio.ASGIApp(sio, other_asgi_app=fastapi_app, socketio_path="api/socket.io")
