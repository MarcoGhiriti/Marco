import logging
import os
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Literal, Optional

import httpx
from bson import ObjectId
from dotenv import load_dotenv
from fastapi import APIRouter, FastAPI, HTTPException, Query
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from starlette.middleware.cors import CORSMiddleware

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

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

app = FastAPI()
api_router = APIRouter(prefix="/api")


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
    total_m = sum([int(l.get("distance", {}).get("value", 0)) for l in legs])
    total_s = sum([int(l.get("duration", {}).get("value", 0)) for l in legs])

    return round(total_m / 1000.0, 2), int(round(total_s / 60.0))


# -----------------
# Models
# -----------------

Difficulty = Literal["easy", "medium", "hard"]


class CostEstimate(BaseModel):
    fuel: float
    tolls: float
    currency: str


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

    # Optional: if true, compute using Google Directions (roads)
    use_google_directions: bool = False


class RouteOut(BaseModel):
    id: str
    title: str
    description: str
    polyline: list[list[float]]

    distance_km: float
    duration_min: int
    stops_count: int
    cost_estimate: CostEstimate

    rules: str
    difficulty: Difficulty
    participants_min: int
    participants_max: int

    created_at: datetime


class EventCreate(BaseModel):
    title: str = Field(min_length=2, max_length=80)
    description: str = Field(default="", max_length=800)
    start_point: list[float] = Field(min_length=2, max_length=2, description="[lat,lng]")

    start_time: datetime

    poster_base64: Optional[str] = None
    associated_route_id: Optional[str] = None


class EventOut(BaseModel):
    id: str
    title: str
    description: str
    start_point: list[float]
    start_time: datetime

    poster_base64: Optional[str] = None
    associated_route_id: Optional[str] = None

    created_at: datetime


# -----------------
# Routes
# -----------------


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


@api_router.post("/routes", response_model=RouteOut)
async def create_route(payload: RouteCreate):
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
        created_at=doc["created_at"],
    )
    return out


@api_router.get("/routes", response_model=list[RouteOut])
async def list_routes(limit: int = Query(default=50, ge=1, le=200)):
    cursor = db.routes.find().sort("created_at", -1).limit(limit)
    routes = await cursor.to_list(length=limit)
    result: list[RouteOut] = []
    for r in routes:
        result.append(
            RouteOut(
                id=_oid_str(r.get("_id")),
                title=r.get("title", ""),
                description=r.get("description", ""),
                polyline=r.get("polyline", []),
                distance_km=float(r.get("distance_km", 0.0)),
                duration_min=int(r.get("duration_min", 0)),
                stops_count=int(r.get("stops_count", 0)),
                cost_estimate=CostEstimate(**(r.get("cost_estimate") or {"fuel": 0, "tolls": 0, "currency": "RON"})),
                rules=r.get("rules", ""),
                difficulty=r.get("difficulty", "medium"),
                participants_min=int(r.get("participants_min", 1)),
                participants_max=int(r.get("participants_max", 10)),
                created_at=r.get("created_at") or datetime.utcnow(),
            )
        )
    return result


@api_router.post("/events", response_model=EventOut)
async def create_event(payload: EventCreate):
    now = datetime.utcnow()

    doc = {
        "title": payload.title,
        "description": payload.description,
        "start_point": payload.start_point,
        "start_time": payload.start_time,
        "poster_base64": payload.poster_base64,
        "associated_route_id": payload.associated_route_id,
        "created_at": now,
    }

    res = await db.events.insert_one(doc)

    return EventOut(
        id=_oid_str(res.inserted_id),
        title=doc["title"],
        description=doc["description"],
        start_point=doc["start_point"],
        start_time=doc["start_time"],
        poster_base64=doc.get("poster_base64"),
        associated_route_id=doc.get("associated_route_id"),
        created_at=doc["created_at"],
    )


@api_router.get("/events", response_model=list[EventOut])
async def list_events(limit: int = Query(default=50, ge=1, le=200)):
    cursor = db.events.find().sort("created_at", -1).limit(limit)
    events = await cursor.to_list(length=limit)
    result: list[EventOut] = []
    for e in events:
        result.append(
            EventOut(
                id=_oid_str(e.get("_id")),
                title=e.get("title", ""),
                description=e.get("description", ""),
                start_point=e.get("start_point", [0, 0]),
                start_time=e.get("start_time") or datetime.utcnow(),
                poster_base64=e.get("poster_base64"),
                associated_route_id=e.get("associated_route_id"),
                created_at=e.get("created_at") or datetime.utcnow(),
            )
        )
    return result


# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
