"""Premium subscription & bike management routes."""
import os
from datetime import datetime, timezone
from typing import Optional, List

from bson import ObjectId
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from database import db, get_current_user, _safe_create_index, logger, GOOGLE_MAPS_API_KEY

load_dotenv()

router = APIRouter(tags=["premium"])

STRIPE_API_KEY = os.environ.get("STRIPE_API_KEY", "")
PREMIUM_PRICE_EUR = 4.99
PREMIUM_PLAN_ID = "motogo_premium"


# --- Models ---

class CheckoutRequest(BaseModel):
    origin_url: str


class BikeDataUpdate(BaseModel):
    insurance_expiry: Optional[str] = None
    itp_expiry: Optional[str] = None
    last_service_date: Optional[str] = None
    last_service_notes: Optional[str] = None
    next_service_date: Optional[str] = None
    next_service_km: Optional[int] = None
    current_km: Optional[int] = None
    bike_name: Optional[str] = None
    plate_number: Optional[str] = None
    fuel_cost: Optional[float] = None
    service_cost: Optional[float] = None
    other_cost: Optional[float] = None


class FreeRideEnd(BaseModel):
    polyline: List[List[float]] = []
    distance_km: float = 0
    max_speed_kmh: float = 0
    duration_seconds: int = 0
    stops_count: int = 0


# --- Indexes ---

async def ensure_premium_indexes():
    await _safe_create_index(db.payment_transactions, "session_id", unique=True, background=True)
    await _safe_create_index(db.payment_transactions, "user_id", background=True)
    await _safe_create_index(db.bike_data, "user_id", unique=True, background=True)
    await _safe_create_index(db.free_rides, "user_id", background=True)
    logger.info("Premium indexes ensured")


# --- Helpers ---

async def is_premium(user_id: str) -> bool:
    """Check if user has active premium subscription."""
    user = await db.users.find_one({"_id": ObjectId(user_id)}, {"premium": 1, "premium_until": 1})
    if not user:
        return False
    if user.get("premium") is True:
        until = user.get("premium_until")
        if until and isinstance(until, datetime):
            # Handle both timezone-aware and naive datetimes
            now = datetime.now(timezone.utc)
            if until.tzinfo is None:
                until = until.replace(tzinfo=timezone.utc)
            return until > now
        return True
    return False


async def require_premium(user=Depends(get_current_user)):
    """Dependency: require premium subscription."""
    if not await is_premium(user["id"]):
        raise HTTPException(403, "Premium subscription required")
    return user


# ==========================================
# STRIPE CHECKOUT
# ==========================================

@router.post("/api/premium/checkout")
async def create_checkout(body: CheckoutRequest, request: Request, user=Depends(get_current_user)):
    """Create a Stripe checkout session for premium subscription."""
    from emergentintegrations.payments.stripe.checkout import (
        StripeCheckout, CheckoutSessionRequest,
    )

    uid = user["id"]
    origin = body.origin_url.rstrip("/")
    success_url = f"{origin}/premium/success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin}/premium"

    host_url = str(request.base_url).rstrip("/")
    webhook_url = f"{host_url}/api/webhook/stripe"

    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)

    checkout_req = CheckoutSessionRequest(
        amount=PREMIUM_PRICE_EUR,
        currency="eur",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={
            "user_id": uid,
            "plan": PREMIUM_PLAN_ID,
            "username": user.get("username", ""),
        },
    )

    session = await stripe_checkout.create_checkout_session(checkout_req)

    # Create payment transaction record
    now = datetime.now(timezone.utc)
    await db.payment_transactions.insert_one({
        "session_id": session.session_id,
        "user_id": uid,
        "amount": PREMIUM_PRICE_EUR,
        "currency": "eur",
        "plan": PREMIUM_PLAN_ID,
        "status": "initiated",
        "payment_status": "pending",
        "metadata": {"username": user.get("username", "")},
        "created_at": now,
        "updated_at": now,
    })

    return {"url": session.url, "session_id": session.session_id}


@router.get("/api/premium/checkout/status/{session_id}")
async def check_checkout_status(session_id: str, user=Depends(get_current_user)):
    """Check the status of a checkout session and activate premium if paid."""
    from emergentintegrations.payments.stripe.checkout import StripeCheckout

    uid = user["id"]

    # Check if already processed
    txn = await db.payment_transactions.find_one({"session_id": session_id})
    if not txn:
        raise HTTPException(404, "Transaction not found")

    if txn.get("payment_status") == "paid":
        return {"status": "complete", "payment_status": "paid", "already_processed": True}

    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url="")
    status = await stripe_checkout.get_checkout_status(session_id)

    now = datetime.now(timezone.utc)
    update_data = {
        "status": status.status,
        "payment_status": status.payment_status,
        "updated_at": now,
    }

    if status.payment_status == "paid" and txn.get("payment_status") != "paid":
        # Activate premium - 30 days from now
        premium_until = datetime(now.year, now.month, now.day, tzinfo=timezone.utc)
        premium_until = premium_until.replace(day=min(now.day, 28))
        from datetime import timedelta
        premium_until = now + timedelta(days=30)

        await db.users.update_one(
            {"_id": ObjectId(uid)},
            {"$set": {"premium": True, "premium_until": premium_until}},
        )
        update_data["premium_activated_at"] = now

    await db.payment_transactions.update_one(
        {"session_id": session_id},
        {"$set": update_data},
    )

    return {
        "status": status.status,
        "payment_status": status.payment_status,
        "amount_total": status.amount_total,
        "currency": status.currency,
    }


@router.post("/api/webhook/stripe")
async def stripe_webhook(request: Request):
    """Handle Stripe webhook events."""
    from emergentintegrations.payments.stripe.checkout import StripeCheckout

    body = await request.body()
    sig = request.headers.get("Stripe-Signature", "")

    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url="")

    try:
        event = await stripe_checkout.handle_webhook(body, sig)
    except Exception as e:
        logger.error(f"Webhook error: {e}")
        raise HTTPException(400, "Webhook verification failed")

    if event.payment_status == "paid":
        session_id = event.session_id
        user_id = event.metadata.get("user_id")

        if user_id and session_id:
            now = datetime.now(timezone.utc)
            from datetime import timedelta
            premium_until = now + timedelta(days=30)

            # Update transaction
            await db.payment_transactions.update_one(
                {"session_id": session_id},
                {"$set": {
                    "status": "complete",
                    "payment_status": "paid",
                    "updated_at": now,
                    "premium_activated_at": now,
                }},
            )

            # Activate premium
            await db.users.update_one(
                {"_id": ObjectId(user_id)},
                {"$set": {"premium": True, "premium_until": premium_until}},
            )
            logger.info(f"Premium activated for user {user_id} via webhook")

    return {"received": True}


# ==========================================
# PREMIUM STATUS
# ==========================================

@router.get("/api/premium/status")
async def get_premium_status(user=Depends(get_current_user)):
    """Get user's premium subscription status."""
    uid = user["id"]
    u = await db.users.find_one(
        {"_id": ObjectId(uid)},
        {"premium": 1, "premium_until": 1},
    )
    is_active = False
    until_str = None
    if u and u.get("premium"):
        until = u.get("premium_until")
        if until and isinstance(until, datetime):
            now = datetime.now(timezone.utc)
            if until.tzinfo is None:
                until = until.replace(tzinfo=timezone.utc)
            is_active = until > now
            until_str = until.isoformat()
        else:
            is_active = bool(u.get("premium"))

    return {
        "is_premium": is_active,
        "premium_until": until_str,
        "plan": PREMIUM_PLAN_ID if is_active else None,
        "price": PREMIUM_PRICE_EUR,
    }


# ==========================================
# YOUR BIKE - CRUD
# ==========================================

@router.get("/api/premium/bike")
async def get_bike_data(user=Depends(require_premium)):
    """Get user's bike data (premium only)."""
    uid = user["id"]
    doc = await db.bike_data.find_one({"user_id": uid}, {"_id": 0})
    if not doc:
        return {
            "user_id": uid,
            "insurance_expiry": None,
            "itp_expiry": None,
            "last_service_date": None,
            "last_service_notes": None,
            "next_service_date": None,
            "next_service_km": None,
            "current_km": None,
        }
    doc.pop("_id", None)
    return doc


@router.put("/api/premium/bike")
async def update_bike_data(body: BikeDataUpdate, user=Depends(require_premium)):
    """Update user's bike data (premium only)."""
    uid = user["id"]
    now = datetime.now(timezone.utc)

    update = {"user_id": uid, "updated_at": now}
    for field in ["insurance_expiry", "itp_expiry", "last_service_date",
                   "last_service_notes", "next_service_date", "next_service_km", "current_km",
                   "bike_name", "plate_number", "fuel_cost", "service_cost", "other_cost"]:
        val = getattr(body, field, None)
        if val is not None:
            update[field] = val

    await db.bike_data.update_one(
        {"user_id": uid},
        {"$set": update, "$setOnInsert": {"created_at": now}},
        upsert=True,
    )
    doc = await db.bike_data.find_one({"user_id": uid}, {"_id": 0})
    return doc


# ==========================================
# MAINTENANCE TIPS
# ==========================================

MAINTENANCE_TIPS = [
    {
        "id": "chain_clean",
        "title": "Chain Cleaning & Lubrication",
        "icon": "link",
        "description": "Clean your chain every 500-1000 km. Use a chain cleaner spray, brush off debris, let dry, then apply chain lube evenly while rotating the wheel.",
        "frequency": "Every 500-1000 km",
    },
    {
        "id": "tire_pressure",
        "title": "Tire Pressure Check",
        "icon": "speedometer",
        "description": "Check tire pressure weekly when tires are cold. Incorrect pressure affects handling, braking, and tire life. Refer to your owner's manual for correct PSI.",
        "frequency": "Weekly",
    },
    {
        "id": "oil_change",
        "title": "Engine Oil Change",
        "icon": "water",
        "description": "Change engine oil every 3000-6000 km or as specified. Use the recommended grade. Don't forget to replace the oil filter too.",
        "frequency": "Every 3000-6000 km",
    },
    {
        "id": "brake_check",
        "title": "Brake Pads & Fluid",
        "icon": "hand-left",
        "description": "Inspect brake pads for wear (minimum 2mm thickness). Check brake fluid level and color monthly. Replace fluid every 2 years.",
        "frequency": "Monthly inspection",
    },
    {
        "id": "coolant",
        "title": "Coolant Level",
        "icon": "thermometer",
        "description": "Check coolant level regularly. Top up with manufacturer-recommended coolant. Replace completely every 2 years to prevent corrosion.",
        "frequency": "Monthly check",
    },
    {
        "id": "battery",
        "title": "Battery Maintenance",
        "icon": "battery-charging",
        "description": "Keep terminals clean and tight. Use a battery tender during winter storage. Check voltage regularly - should read 12.6V or above when fully charged.",
        "frequency": "Monthly",
    },
    {
        "id": "air_filter",
        "title": "Air Filter",
        "icon": "cloud",
        "description": "Clean or replace the air filter every 10,000-15,000 km. A dirty filter reduces power and fuel efficiency. Check more frequently in dusty conditions.",
        "frequency": "Every 10,000-15,000 km",
    },
    {
        "id": "lights",
        "title": "Lights & Signals",
        "icon": "flashlight",
        "description": "Check all lights before every ride: headlight (low & high beam), tail light, brake light, and turn signals. Replace bulbs immediately if burnt out.",
        "frequency": "Before every ride",
    },
]


@router.get("/api/premium/maintenance-tips")
async def get_maintenance_tips(user=Depends(require_premium)):
    """Get motorcycle maintenance tips."""
    return MAINTENANCE_TIPS


# ==========================================
# FREE RIDE MODE
# ==========================================

@router.post("/api/premium/free-ride/start")
async def start_free_ride(user=Depends(require_premium)):
    """Start a free ride session (not tied to a route)."""
    uid = user["id"]
    now = datetime.now(timezone.utc)

    # Check for existing active free ride
    active = await db.free_rides.find_one({"user_id": uid, "status": "active"})
    if active:
        return {
            "id": str(active["_id"]),
            "status": "active",
            "started_at": active["started_at"].isoformat() if isinstance(active["started_at"], datetime) else str(active["started_at"]),
            "already_active": True,
        }

    ride = {
        "user_id": uid,
        "status": "active",
        "started_at": now,
        "paused_at": None,
        "ended_at": None,
        "polyline": [],
        "distance_km": 0,
        "max_speed_kmh": 0,
        "duration_seconds": 0,
        "stops_count": 0,
    }
    result = await db.free_rides.insert_one(ride)
    return {
        "id": str(result.inserted_id),
        "status": "active",
        "started_at": now.isoformat(),
    }


@router.post("/api/premium/free-ride/{ride_id}/pause")
async def pause_free_ride(ride_id: str, user=Depends(require_premium)):
    """Pause a free ride."""
    uid = user["id"]
    ride = await db.free_rides.find_one({"_id": ObjectId(ride_id), "user_id": uid})
    if not ride:
        raise HTTPException(404, "Ride not found")
    if ride["status"] != "active":
        raise HTTPException(400, "Ride is not active")

    now = datetime.now(timezone.utc)
    await db.free_rides.update_one(
        {"_id": ObjectId(ride_id)},
        {"$set": {"status": "paused", "paused_at": now}},
    )
    return {"status": "paused"}


@router.post("/api/premium/free-ride/{ride_id}/resume")
async def resume_free_ride(ride_id: str, user=Depends(require_premium)):
    """Resume a paused free ride."""
    uid = user["id"]
    ride = await db.free_rides.find_one({"_id": ObjectId(ride_id), "user_id": uid})
    if not ride:
        raise HTTPException(404, "Ride not found")
    if ride["status"] != "paused":
        raise HTTPException(400, "Ride is not paused")

    await db.free_rides.update_one(
        {"_id": ObjectId(ride_id)},
        {"$set": {"status": "active", "paused_at": None}},
    )
    return {"status": "active"}


@router.post("/api/premium/free-ride/{ride_id}/end")
async def end_free_ride(ride_id: str, body: FreeRideEnd, user=Depends(require_premium)):
    """End a free ride and save summary."""
    uid = user["id"]
    ride = await db.free_rides.find_one({"_id": ObjectId(ride_id), "user_id": uid})
    if not ride:
        raise HTTPException(404, "Ride not found")
    if ride["status"] == "ended":
        raise HTTPException(400, "Ride already ended")

    now = datetime.now(timezone.utc)
    started_at = ride.get("started_at", now)
    total_seconds = body.duration_seconds or int((now - started_at).total_seconds())

    await db.free_rides.update_one(
        {"_id": ObjectId(ride_id)},
        {"$set": {
            "status": "ended",
            "ended_at": now,
            "polyline": body.polyline,
            "distance_km": body.distance_km,
            "max_speed_kmh": body.max_speed_kmh,
            "duration_seconds": total_seconds,
            "stops_count": body.stops_count,
        }},
    )

    # Update user total km + monthly km + stats for leaderboard
    if body.distance_km > 0:
        await db.users.update_one(
            {"_id": ObjectId(uid)},
            {"$inc": {"km_total": body.distance_km, "km_month": body.distance_km}},
        )
        # Also update stats collection for leaderboard
        await db.stats.update_one(
            {"user_id": uid},
            {"$inc": {"km_total": body.distance_km, "km_month": body.distance_km},
             "$setOnInsert": {"user_id": uid}},
            upsert=True,
        )

    return {
        "id": ride_id,
        "status": "ended",
        "distance_km": body.distance_km,
        "max_speed_kmh": body.max_speed_kmh,
        "duration_seconds": total_seconds,
        "stops_count": body.stops_count,
        "started_at": started_at.isoformat() if isinstance(started_at, datetime) else str(started_at),
        "ended_at": now.isoformat(),
    }


@router.get("/api/premium/free-ride/active")
async def get_active_free_ride(user=Depends(require_premium)):
    """Get active free ride if any."""
    uid = user["id"]
    ride = await db.free_rides.find_one(
        {"user_id": uid, "status": {"$in": ["active", "paused"]}},
        {"_id": 1, "status": 1, "started_at": 1, "paused_at": 1},
    )
    if not ride:
        return {"active": False}
    return {
        "active": True,
        "id": str(ride["_id"]),
        "status": ride["status"],
        "started_at": ride["started_at"].isoformat() if isinstance(ride["started_at"], datetime) else str(ride["started_at"]),
    }


@router.get("/api/premium/free-ride/history")
async def get_free_ride_history(limit: int = 20, user=Depends(require_premium)):
    """Get free ride history."""
    uid = user["id"]
    rides = []
    async for r in db.free_rides.find(
        {"user_id": uid, "status": "ended"},
    ).sort("ended_at", -1).limit(limit):
        rides.append({
            "id": str(r["_id"]),
            "distance_km": r.get("distance_km", 0),
            "max_speed_kmh": r.get("max_speed_kmh", 0),
            "duration_seconds": r.get("duration_seconds", 0),
            "stops_count": r.get("stops_count", 0),
            "started_at": r["started_at"].isoformat() if isinstance(r["started_at"], datetime) else str(r["started_at"]),
            "ended_at": r["ended_at"].isoformat() if isinstance(r.get("ended_at"), datetime) else None,
        })
    return rides


# ==========================================
# ROUTE RECOMMENDATIONS (premium feature)
# ==========================================

@router.get("/api/premium/recommendations")
async def get_route_recommendations(user=Depends(require_premium)):
    """Get 3 recommended routes for premium users."""
    uid = user["id"]
    import random

    # Get routes the user hasn't created, sorted by participants
    all_routes = []
    async for r in db.routes.find(
        {"created_by": {"$ne": uid}},
        {"_id": 1, "title": 1, "start_city": 1, "end_city": 1,
         "distance_km": 1, "duration_min": 1, "difficulty": 1,
         "participants_count": 1, "polyline": 1, "meeting_point": 1},
    ).sort("participants_count", -1).limit(50):
        all_routes.append({
            "id": str(r["_id"]),
            "title": r.get("title", ""),
            "start_city": r.get("start_city", ""),
            "end_city": r.get("end_city", ""),
            "distance_km": r.get("distance_km", 0),
            "duration_min": r.get("duration_min", 0),
            "difficulty": r.get("difficulty", "medium"),
            "participants_count": r.get("participants_count", 0),
            "has_polyline": bool(r.get("polyline")),
        })

    # Pick 3 random from top routes
    if len(all_routes) > 3:
        recommendations = random.sample(all_routes[:20], min(3, len(all_routes[:20])))
    else:
        recommendations = all_routes[:3]

    return recommendations


@router.post("/api/premium/recommendations/refresh")
async def refresh_recommendations(user=Depends(require_premium)):
    """Refresh route recommendations (returns new random set)."""
    return await get_route_recommendations(user=user)



# ==========================================
# AI ROUTE GENERATION
# ==========================================

class GenerateRouteRequest(BaseModel):
    desired_km: float = Field(..., ge=10, le=1000)
    start_lat: float
    start_lng: float
    difficulty: str = "medium"


@router.post("/api/premium/generate-route")
async def generate_route(body: GenerateRouteRequest, user=Depends(require_premium)):
    """Generate a unique route using AI + Google Directions based on desired km."""
    import httpx
    import math
    import random

    uid = user["id"]
    api_key = GOOGLE_MAPS_API_KEY

    # Calculate a bearing and endpoint based on desired km
    # Use a random direction to create variety
    bearing = random.uniform(0, 360)
    # Go roughly half the desired km in one direction, then loop back
    half_km = body.desired_km / 2.5
    lat_offset = half_km / 111.0 * math.cos(math.radians(bearing))
    lng_offset = half_km / (111.0 * math.cos(math.radians(body.start_lat))) * math.sin(math.radians(bearing))

    # Create a waypoint to make the route more interesting
    wp_bearing = bearing + random.uniform(30, 90)
    wp_km = body.desired_km / 3
    wp_lat = body.start_lat + wp_km / 111.0 * math.cos(math.radians(wp_bearing))
    wp_lng = body.start_lng + wp_km / (111.0 * math.cos(math.radians(body.start_lat))) * math.sin(math.radians(wp_bearing))

    mid_lat = body.start_lat + lat_offset
    mid_lng = body.start_lng + lng_offset

    # Use Google Directions to get actual road route (round trip)
    origin = f"{body.start_lat},{body.start_lng}"
    waypoints_str = f"{wp_lat},{wp_lng}|{mid_lat},{mid_lng}"

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(
            "https://maps.googleapis.com/maps/api/directions/json",
            params={
                "origin": origin,
                "destination": origin,  # round trip
                "waypoints": f"via:{waypoints_str}",
                "mode": "driving",
                "key": api_key,
            },
        )
        data = resp.json()

    if data.get("status") != "OK" or not data.get("routes"):
        raise HTTPException(400, "Could not generate route. Try different parameters.")

    route = data["routes"][0]
    legs = route.get("legs", [])

    total_distance_m = sum(leg.get("distance", {}).get("value", 0) for leg in legs)
    total_duration_s = sum(leg.get("duration", {}).get("value", 0) for leg in legs)
    distance_km = round(total_distance_m / 1000, 1)
    duration_min = round(total_duration_s / 60)

    # Decode polyline
    import polyline as polyline_lib
    overview = route.get("overview_polyline", {}).get("points", "")
    decoded = polyline_lib.decode(overview) if overview else []
    polyline_points = [[lat, lng] for lat, lng in decoded]

    # Get start/end city names
    start_address = legs[0].get("start_address", "") if legs else ""
    end_address = legs[-1].get("end_address", "") if legs else ""

    # Build a title
    diff_label = body.difficulty.capitalize()
    title = f"{diff_label} Loop - {distance_km} km"

    # Analyze route details
    cities_passed = set()
    for leg in legs:
        for step in leg.get("steps", []):
            html = step.get("html_instructions", "")
            # Detect city/town transitions
            if "onto" in html.lower() or "toward" in html.lower():
                pass  # basic detection
    
    # Count turns/curves from steps
    total_steps = sum(len(leg.get("steps", [])) for leg in legs)
    curves_estimate = max(0, total_steps - len(legs) * 2)  # subtract start/end per leg
    
    # Speed analysis
    avg_speed_kmh = round(distance_km / (duration_min / 60)) if duration_min > 0 else 0
    has_highways = any("highway" in step.get("html_instructions", "").lower() or "motorway" in step.get("html_instructions", "").lower() for leg in legs for step in leg.get("steps", []))
    has_urban = any("city" in step.get("html_instructions", "").lower() or "town" in step.get("html_instructions", "").lower() or "urban" in step.get("html_instructions", "").lower() for leg in legs for step in leg.get("steps", []))
    
    # Extract waypoints for Google Maps navigation
    waypoints_nav = []
    sample_interval = max(1, len(polyline_points) // 8)
    for i in range(sample_interval, len(polyline_points) - sample_interval, sample_interval):
        pt = polyline_points[i]
        waypoints_nav.append({"lat": pt[0], "lng": pt[1]})
        if len(waypoints_nav) >= 6:
            break

    return {
        "title": title,
        "distance_km": distance_km,
        "duration_min": duration_min,
        "difficulty": body.difficulty,
        "polyline": polyline_points,
        "start_address": start_address,
        "end_address": end_address,
        "overview_polyline": overview,
        "is_generated": True,
        "is_round_trip": True,
        "curves_count": curves_estimate,
        "avg_speed_kmh": avg_speed_kmh,
        "has_highways": has_highways,
        "has_urban_areas": has_urban,
        "total_steps": total_steps,
        "waypoints_nav": waypoints_nav,
        "start_lat": body.start_lat,
        "start_lng": body.start_lng,
    }


# ==========================================
# SAVE GENERATED ROUTE
# ==========================================

class SaveGeneratedRoute(BaseModel):
    title: str
    distance_km: float
    duration_min: int
    difficulty: str = "medium"
    polyline: List[List[float]] = []
    overview_polyline: str = ""
    start_address: str = ""
    end_address: str = ""
    start_lat: float = 0
    start_lng: float = 0
    curves_count: int = 0
    avg_speed_kmh: int = 0
    has_highways: bool = False
    has_urban_areas: bool = False
    waypoints_nav: List[dict] = []


@router.post("/api/premium/saved-routes")
async def save_generated_route(body: SaveGeneratedRoute, user=Depends(require_premium)):
    """Save a generated route for later use."""
    uid = user["id"]
    now = datetime.now(timezone.utc)
    doc = {
        "user_id": uid,
        "title": body.title,
        "distance_km": body.distance_km,
        "duration_min": body.duration_min,
        "difficulty": body.difficulty,
        "polyline": body.polyline,
        "overview_polyline": body.overview_polyline,
        "start_address": body.start_address,
        "end_address": body.end_address,
        "start_lat": body.start_lat,
        "start_lng": body.start_lng,
        "curves_count": body.curves_count,
        "avg_speed_kmh": body.avg_speed_kmh,
        "has_highways": body.has_highways,
        "has_urban_areas": body.has_urban_areas,
        "waypoints_nav": body.waypoints_nav,
        "is_generated": True,
        "is_round_trip": True,
        "status": "saved",
        "progress_pct": 0,
        "created_at": now,
    }
    result = await db.saved_routes.insert_one(doc)
    return {"id": str(result.inserted_id), "status": "saved"}


@router.get("/api/premium/saved-routes")
async def get_saved_routes(user=Depends(require_premium)):
    """Get all saved generated routes."""
    uid = user["id"]
    routes = []
    async for r in db.saved_routes.find({"user_id": uid}).sort("created_at", -1).limit(50):
        routes.append({
            "id": str(r["_id"]),
            "title": r.get("title", ""),
            "distance_km": r.get("distance_km", 0),
            "duration_min": r.get("duration_min", 0),
            "difficulty": r.get("difficulty", "medium"),
            "start_address": r.get("start_address", ""),
            "end_address": r.get("end_address", ""),
            "start_lat": r.get("start_lat", 0),
            "start_lng": r.get("start_lng", 0),
            "curves_count": r.get("curves_count", 0),
            "avg_speed_kmh": r.get("avg_speed_kmh", 0),
            "has_highways": r.get("has_highways", False),
            "has_urban_areas": r.get("has_urban_areas", False),
            "waypoints_nav": r.get("waypoints_nav", []),
            "polyline": r.get("polyline", []),
            "overview_polyline": r.get("overview_polyline", ""),
            "status": r.get("status", "saved"),
            "progress_pct": r.get("progress_pct", 0),
            "created_at": r["created_at"].isoformat() if isinstance(r.get("created_at"), datetime) else None,
        })
    return routes


@router.get("/api/premium/saved-routes/{route_id}")
async def get_saved_route_detail(route_id: str, user=Depends(require_premium)):
    """Get full detail of a saved route."""
    uid = user["id"]
    r = await db.saved_routes.find_one({"_id": ObjectId(route_id), "user_id": uid})
    if not r:
        raise HTTPException(404, "Route not found")
    return {
        "id": str(r["_id"]),
        "title": r.get("title", ""),
        "distance_km": r.get("distance_km", 0),
        "duration_min": r.get("duration_min", 0),
        "difficulty": r.get("difficulty", "medium"),
        "polyline": r.get("polyline", []),
        "overview_polyline": r.get("overview_polyline", ""),
        "start_address": r.get("start_address", ""),
        "end_address": r.get("end_address", ""),
        "start_lat": r.get("start_lat", 0),
        "start_lng": r.get("start_lng", 0),
        "curves_count": r.get("curves_count", 0),
        "avg_speed_kmh": r.get("avg_speed_kmh", 0),
        "has_highways": r.get("has_highways", False),
        "has_urban_areas": r.get("has_urban_areas", False),
        "waypoints_nav": r.get("waypoints_nav", []),
        "is_round_trip": r.get("is_round_trip", True),
        "status": r.get("status", "saved"),
        "progress_pct": r.get("progress_pct", 0),
    }


@router.post("/api/premium/saved-routes/{route_id}/start")
async def start_saved_route(route_id: str, user=Depends(require_premium)):
    """Mark a saved route as started."""
    uid = user["id"]
    r = await db.saved_routes.find_one({"_id": ObjectId(route_id), "user_id": uid})
    if not r:
        raise HTTPException(404, "Route not found")
    await db.saved_routes.update_one(
        {"_id": ObjectId(route_id)},
        {"$set": {"status": "active", "started_at": datetime.now(timezone.utc)}},
    )
    return {"status": "active"}


@router.post("/api/premium/saved-routes/{route_id}/progress")
async def update_route_progress(route_id: str, progress_pct: float = 0, user=Depends(require_premium)):
    """Update completion percentage of a route."""
    uid = user["id"]
    await db.saved_routes.update_one(
        {"_id": ObjectId(route_id), "user_id": uid},
        {"$set": {"progress_pct": min(100, max(0, progress_pct))}},
    )
    return {"progress_pct": progress_pct}


@router.post("/api/premium/saved-routes/{route_id}/complete")
async def complete_saved_route(route_id: str, user=Depends(require_premium)):
    """Mark a saved route as completed."""
    uid = user["id"]
    await db.saved_routes.update_one(
        {"_id": ObjectId(route_id), "user_id": uid},
        {"$set": {"status": "completed", "progress_pct": 100, "completed_at": datetime.now(timezone.utc)}},
    )
    return {"status": "completed"}


@router.delete("/api/premium/saved-routes/{route_id}")
async def delete_saved_route(route_id: str, user=Depends(require_premium)):
    """Delete a saved route."""
    uid = user["id"]
    await db.saved_routes.delete_one({"_id": ObjectId(route_id), "user_id": uid})
    return {"deleted": True}


# ==========================================
# RIDE HISTORY (participated routes + free rides)
# ==========================================

@router.get("/api/premium/history/routes")
async def get_route_participation_history(limit: int = 30, user=Depends(require_premium)):
    """Get routes the user participated in (ride sessions)."""
    uid = user["id"]
    rides = []
    async for r in db.ride_sessions.find(
        {"user_id": uid, "status": "ended"},
        {"_id": 1, "route_id": 1, "started_at": 1, "ended_at": 1, "km_tracked": 1},
    ).sort("ended_at", -1).limit(limit):
        route_id = r.get("route_id")
        route_info = None
        if route_id:
            route_doc = await db.routes.find_one(
                {"_id": ObjectId(route_id)},
                {"title": 1, "start_city": 1, "end_city": 1, "distance_km": 1, "difficulty": 1},
            )
            if route_doc:
                route_info = {
                    "id": str(route_doc["_id"]),
                    "title": route_doc.get("title", ""),
                    "start_city": route_doc.get("start_city", ""),
                    "end_city": route_doc.get("end_city", ""),
                    "distance_km": route_doc.get("distance_km", 0),
                    "difficulty": route_doc.get("difficulty", "medium"),
                }

        rides.append({
            "id": str(r["_id"]),
            "route_id": str(route_id) if route_id else None,
            "route": route_info,
            "started_at": r["started_at"].isoformat() if isinstance(r.get("started_at"), datetime) else None,
            "ended_at": r["ended_at"].isoformat() if isinstance(r.get("ended_at"), datetime) else None,
            "km_tracked": r.get("km_tracked", 0),
        })
    return rides


@router.get("/api/premium/history/free-rides")
async def get_free_ride_history_detailed(limit: int = 30, user=Depends(require_premium)):
    """Get detailed free ride history with polylines."""
    uid = user["id"]
    rides = []
    async for r in db.free_rides.find(
        {"user_id": uid, "status": "ended"},
    ).sort("ended_at", -1).limit(limit):
        stops = r.get("stop_checkpoints", [])
        rides.append({
            "id": str(r["_id"]),
            "distance_km": r.get("distance_km", 0),
            "max_speed_kmh": r.get("max_speed_kmh", 0),
            "duration_seconds": r.get("duration_seconds", 0),
            "stops_count": r.get("stops_count", 0),
            "stop_checkpoints": stops,
            "polyline": r.get("polyline", []),
            "started_at": r["started_at"].isoformat() if isinstance(r.get("started_at"), datetime) else None,
            "ended_at": r["ended_at"].isoformat() if isinstance(r.get("ended_at"), datetime) else None,
        })
    return rides


# ==========================================
# FREE RIDE - update location + save stop checkpoints
# ==========================================

class FreeRideLocationUpdate(BaseModel):
    lat: float
    lng: float
    speed_kmh: float = 0


@router.post("/api/premium/free-ride/{ride_id}/location")
async def update_free_ride_location(ride_id: str, body: FreeRideLocationUpdate, user=Depends(require_premium)):
    """Update current location during a free ride (for live tracking)."""
    uid = user["id"]
    ride = await db.free_rides.find_one({"_id": ObjectId(ride_id), "user_id": uid})
    if not ride or ride["status"] not in ("active", "paused"):
        raise HTTPException(404, "Active ride not found")

    await db.free_rides.update_one(
        {"_id": ObjectId(ride_id)},
        {"$set": {"current_lat": body.lat, "current_lng": body.lng, "current_speed_kmh": body.speed_kmh}},
    )
    return {"ok": True}
