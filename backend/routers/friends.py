"""Friends routes: list, requests, locations, etc."""
from datetime import datetime, timedelta
from typing import List, Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from database import (
    db, get_current_user, create_notification,
    _oid_str, _as_object_id, haversine_km
)
from src_auth import oid_str

router = APIRouter(prefix="/friends", tags=["friends"])


# --- Models ---
class UserSearchOut(BaseModel):
    id: str
    username: str
    profile_photo_base64: Optional[str] = None


class FriendRequestOut(BaseModel):
    incoming: List[UserSearchOut]
    outgoing: List[UserSearchOut]


class FriendRequestCreate(BaseModel):
    to_username: str


class FriendAccept(BaseModel):
    from_user_id: str


class LocationUpdate(BaseModel):
    lat: float = Field(..., ge=-90, le=90)
    lng: float = Field(..., ge=-180, le=180)


class FriendLocationOut(BaseModel):
    id: str
    username: str
    profile_photo_base64: Optional[str] = None
    lat: float
    lng: float
    updated_at: str
    # New fields for popup
    active_ride: Optional[dict] = None  # Route info if on a ride
    distance_km: Optional[float] = None  # Distance from requester


class FriendDetailOut(BaseModel):
    id: str
    username: str
    profile_photo_base64: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    active_ride: Optional[dict] = None
    distance_km: Optional[float] = None


# --- Endpoints ---

@router.get("", response_model=List[UserSearchOut])
async def friends_list(current_user: dict = Depends(get_current_user)):
    """Get list of friends."""
    ids = current_user.get("friends") or []
    if not ids:
        return []

    oids = [_as_object_id(i) for i in ids]
    cursor = db.users.find({"_id": {"$in": oids}}, {"username": 1, "profile_photo_base64": 1})
    docs = await cursor.to_list(length=200)

    by_id = {oid_str(d.get("_id")): d for d in docs}
    out: List[UserSearchOut] = []
    for fid in ids:
        d = by_id.get(fid)
        if d:
            out.append(UserSearchOut(
                id=fid, 
                username=d.get("username", ""), 
                profile_photo_base64=d.get("profile_photo_base64")
            ))
    return out


@router.get("/requests", response_model=FriendRequestOut)
async def friends_requests(current_user: dict = Depends(get_current_user)):
    """Get incoming and outgoing friend requests."""
    incoming_ids = current_user.get("friend_requests_in") or []
    outgoing_ids = current_user.get("friend_requests_out") or []

    async def _resolve(ids: List[str]) -> List[UserSearchOut]:
        if not ids:
            return []
        oids = [_as_object_id(i) for i in ids]
        cursor = db.users.find({"_id": {"$in": oids}}, {"username": 1, "profile_photo_base64": 1})
        docs = await cursor.to_list(length=200)
        by_id = {oid_str(d.get("_id")): d for d in docs}
        out: List[UserSearchOut] = []
        for uid in ids:
            d = by_id.get(uid)
            if d:
                out.append(UserSearchOut(
                    id=uid, 
                    username=d.get("username", ""), 
                    profile_photo_base64=d.get("profile_photo_base64")
                ))
        return out

    incoming = await _resolve(incoming_ids)
    outgoing = await _resolve(outgoing_ids)
    return FriendRequestOut(incoming=incoming, outgoing=outgoing)


@router.post("/request")
async def friends_request(payload: FriendRequestCreate, current_user: dict = Depends(get_current_user)):
    """Send a friend request."""
    to_username = payload.to_username.strip()
    target = await db.users.find_one({"username": {"$regex": f"^{to_username}$", "$options": "i"}})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    from_id = current_user["id"]
    from_username = current_user.get("username", "Someone")
    to_id = oid_str(target.get("_id"))

    if to_id == from_id:
        raise HTTPException(status_code=400, detail="Cannot add yourself")

    if from_id in (target.get("friends") or []):
        return {"ok": True}

    await db.users.update_one({"_id": _as_object_id(to_id)}, {"$addToSet": {"friend_requests_in": from_id}})
    await db.users.update_one({"_id": _as_object_id(from_id)}, {"$addToSet": {"friend_requests_out": to_id}})
    
    await create_notification(
        user_id=to_id,
        notif_type="friend_request",
        title="New Friend Request",
        message=f"{from_username} wants to be your friend",
        data={"from_user_id": from_id, "from_username": from_username}
    )
    
    return {"ok": True}


@router.post("/accept")
async def friends_accept(payload: FriendAccept, current_user: dict = Depends(get_current_user)):
    """Accept a friend request."""
    from_id = payload.from_user_id
    to_id = current_user["id"]
    to_username = current_user.get("username", "Someone")

    if from_id not in (current_user.get("friend_requests_in") or []):
        raise HTTPException(status_code=400, detail="No such request")

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
    
    await create_notification(
        user_id=from_id,
        notif_type="friend_accepted",
        title="Friend Request Accepted",
        message=f"{to_username} accepted your friend request",
        data={"user_id": to_id, "username": to_username}
    )
    
    return {"ok": True}


@router.post("/reject")
async def friends_reject(payload: FriendAccept, current_user: dict = Depends(get_current_user)):
    """Reject a friend request."""
    from_id = payload.from_user_id
    to_id = current_user["id"]

    if from_id not in (current_user.get("friend_requests_in") or []):
        raise HTTPException(status_code=400, detail="No such request")

    await db.users.update_one(
        {"_id": _as_object_id(to_id)},
        {"$pull": {"friend_requests_in": from_id}},
    )
    await db.users.update_one(
        {"_id": _as_object_id(from_id)},
        {"$pull": {"friend_requests_out": to_id}},
    )
    return {"ok": True}


@router.post("/cancel")
async def friends_cancel(payload: FriendAccept, current_user: dict = Depends(get_current_user)):
    """Cancel an outgoing friend request."""
    to_id = payload.from_user_id
    from_id = current_user["id"]

    if to_id not in (current_user.get("friend_requests_out") or []):
        raise HTTPException(status_code=400, detail="No such outgoing request")

    await db.users.update_one(
        {"_id": _as_object_id(from_id)},
        {"$pull": {"friend_requests_out": to_id}},
    )
    await db.users.update_one(
        {"_id": _as_object_id(to_id)},
        {"$pull": {"friend_requests_in": from_id}},
    )
    return {"ok": True}


@router.post("/remove")
async def friends_remove(payload: FriendAccept, current_user: dict = Depends(get_current_user)):
    """Remove an existing friend."""
    friend_id = payload.from_user_id
    uid = current_user["id"]

    if friend_id not in (current_user.get("friends") or []):
        raise HTTPException(status_code=400, detail="Not in friends list")

    await db.users.update_one(
        {"_id": _as_object_id(uid)},
        {"$pull": {"friends": friend_id}},
    )
    await db.users.update_one(
        {"_id": _as_object_id(friend_id)},
        {"$pull": {"friends": uid}},
    )
    return {"ok": True}


@router.get("/locations")
async def friends_locations(
    my_lat: Optional[float] = Query(None, ge=-90, le=90),
    my_lng: Optional[float] = Query(None, ge=-180, le=180),
    current_user: dict = Depends(get_current_user)
):
    """Return locations of friends with active ride info and distance."""
    friend_ids = current_user.get("friends") or []
    if not friend_ids:
        return []

    oids = [_as_object_id(fid) for fid in friend_ids]
    cutoff = datetime.utcnow() - timedelta(minutes=30)
    cursor = db.users.find(
        {
            "_id": {"$in": oids},
            "last_location.updated_at": {"$gte": cutoff},
        },
        {"username": 1, "profile_photo_base64": 1, "last_location": 1},
    )
    docs = await cursor.to_list(length=200)
    
    # Get active rides for these friends
    active_rides = {}
    rides_cursor = db.ride_sessions.find({
        "user_id": {"$in": friend_ids},
        "status": "active"
    })
    async for ride in rides_cursor:
        user_id = ride.get("user_id")
        route_id = ride.get("route_id")
        if route_id:
            route = await db.routes.find_one({"_id": _as_object_id(route_id)}, {"title": 1})
            if route:
                active_rides[user_id] = {
                    "route_id": route_id,
                    "route_title": route.get("title", "Unknown Route"),
                    "started_at": ride.get("start_time", "").isoformat() if hasattr(ride.get("start_time", ""), "isoformat") else str(ride.get("start_time", ""))
                }
    
    results = []
    for d in docs:
        loc = d.get("last_location", {})
        friend_id = oid_str(d.get("_id"))
        friend_lat = loc.get("lat")
        friend_lng = loc.get("lng")
        
        # Calculate distance if user location provided
        distance = None
        if my_lat is not None and my_lng is not None and friend_lat is not None and friend_lng is not None:
            distance = round(haversine_km([my_lat, my_lng], [friend_lat, friend_lng]), 1)
        
        results.append({
            "id": friend_id,
            "username": d.get("username", ""),
            "profile_photo_base64": d.get("profile_photo_base64"),
            "lat": friend_lat,
            "lng": friend_lng,
            "updated_at": loc.get("updated_at", "").isoformat() if hasattr(loc.get("updated_at", ""), "isoformat") else str(loc.get("updated_at", "")),
            "active_ride": active_rides.get(friend_id),
            "distance_km": distance,
        })
    return results


@router.get("/{friend_id}/detail")
async def get_friend_detail(
    friend_id: str,
    my_lat: Optional[float] = Query(None, ge=-90, le=90),
    my_lng: Optional[float] = Query(None, ge=-180, le=180),
    current_user: dict = Depends(get_current_user)
):
    """Get detailed info about a specific friend for popup."""
    # Check if they are friends
    if friend_id not in (current_user.get("friends") or []):
        raise HTTPException(status_code=403, detail="Not friends")
    
    friend = await db.users.find_one(
        {"_id": _as_object_id(friend_id)},
        {"username": 1, "profile_photo_base64": 1, "last_location": 1}
    )
    if not friend:
        raise HTTPException(status_code=404, detail="Friend not found")
    
    loc = friend.get("last_location", {})
    friend_lat = loc.get("lat")
    friend_lng = loc.get("lng")
    
    # Get active ride
    active_ride = None
    ride = await db.ride_sessions.find_one({
        "user_id": friend_id,
        "status": "active"
    })
    if ride:
        route_id = ride.get("route_id")
        if route_id:
            route = await db.routes.find_one({"_id": _as_object_id(route_id)}, {"title": 1})
            if route:
                active_ride = {
                    "route_id": route_id,
                    "route_title": route.get("title", "Unknown Route"),
                    "started_at": ride.get("start_time", "").isoformat() if hasattr(ride.get("start_time", ""), "isoformat") else str(ride.get("start_time", ""))
                }
    
    # Calculate distance
    distance = None
    if my_lat is not None and my_lng is not None and friend_lat is not None and friend_lng is not None:
        distance = round(haversine_km([my_lat, my_lng], [friend_lat, friend_lng]), 1)
    
    return {
        "id": friend_id,
        "username": friend.get("username", ""),
        "profile_photo_base64": friend.get("profile_photo_base64"),
        "lat": friend_lat,
        "lng": friend_lng,
        "active_ride": active_ride,
        "distance_km": distance,
    }
