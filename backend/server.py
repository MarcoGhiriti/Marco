import logging
import os
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Literal, Optional

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
    privacy: PrivacySettings
    level: int = 1
    km_total: float = 0
    km_month: float = 0
    created_at: datetime



class MeUpdate(BaseModel):
    bio: Optional[str] = Field(default=None, max_length=280)
    bike: Optional[BikeInfo] = None
    profile_photo_base64: Optional[str] = None


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

    participants_count: int = 0
    is_joined: bool = False

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
    to_id = oid_str(target.get("_id"))

    if to_id == from_id:
        raise HTTPException(status_code=400, detail="Cannot add yourself")

    # already friends?
    if from_id in (target.get("friends") or []):
        return {"ok": True}

    await db.users.update_one({"_id": _as_object_id(to_id)}, {"$addToSet": {"friend_requests_in": from_id}})
    await db.users.update_one({"_id": _as_object_id(from_id)}, {"$addToSet": {"friend_requests_out": to_id}})
    return {"ok": True}


@api_router.post("/friends/accept")
async def friends_accept(payload: FriendAccept, current_user: dict = Depends(get_current_user)):
    from_id = payload.from_user_id
    to_id = current_user["id"]

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
    return {"ok": True}


@api_router.post("/groups", response_model=GroupOut)
async def groups_create(payload: GroupCreate, current_user: dict = Depends(get_current_user)):
    now = datetime.utcnow()
    owner_id = current_user["id"]
    doc = {
        "name": payload.name.strip(),
        "description": payload.description.strip(),
        "is_private": payload.is_private,
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
        "participants": [],
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
async def list_routes(
    limit: int = Query(default=50, ge=1, le=200),
    current_user: dict = Depends(get_current_user),
):
    uid = current_user["id"]
    cursor = db.routes.find().sort("created_at", -1).limit(limit)
    routes = await cursor.to_list(length=limit)
    result: list[RouteOut] = []
    for r in routes:
        participants = r.get("participants") or []
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
                participants_count=len(participants),
                is_joined=uid in participants,
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
        "participants": [],
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
                start_time=e.get("start_time") or datetime.utcnow(),
                poster_base64=e.get("poster_base64"),
                associated_route_id=e.get("associated_route_id"),
                participants_count=len(participants),
                is_joined=uid in participants,
                created_at=e.get("created_at") or datetime.utcnow(),
            )
        )
    return result




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
