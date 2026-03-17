"""Push notifications + local notification scheduling."""
import os
from datetime import datetime, timezone
from typing import Optional, List

import httpx
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from database import db, get_current_user, _safe_create_index, logger

router = APIRouter(tags=["push"])


# --- Models ---

class PushTokenRegister(BaseModel):
    token: str
    platform: str = "unknown"


class SendNotification(BaseModel):
    user_ids: List[str]
    title: str
    body: str
    data: Optional[dict] = None


# --- Indexes ---

async def ensure_push_indexes():
    await _safe_create_index(db.push_tokens, [("user_id", 1), ("token", 1)], unique=True, background=True)
    logger.info("Push notification indexes ensured")


# --- Push Token Management ---

@router.post("/api/push/register")
async def register_push_token(body: PushTokenRegister, user=Depends(get_current_user)):
    """Register an Expo push token for the current user."""
    uid = user["id"]
    token = body.token.strip()

    if not token.startswith("ExponentPushToken[") and not token.startswith("ExpoPushToken["):
        raise HTTPException(400, "Invalid Expo push token format")

    now = datetime.now(timezone.utc)
    await db.push_tokens.update_one(
        {"user_id": uid, "token": token},
        {"$set": {"platform": body.platform, "updated_at": now},
         "$setOnInsert": {"created_at": now}},
        upsert=True,
    )
    return {"registered": True}


@router.delete("/api/push/unregister")
async def unregister_push_token(body: PushTokenRegister, user=Depends(get_current_user)):
    """Remove a push token (on logout)."""
    uid = user["id"]
    await db.push_tokens.delete_one({"user_id": uid, "token": body.token.strip()})
    return {"unregistered": True}


# --- Send Push Notifications ---

async def send_push_to_user(user_id: str, title: str, body: str, data: dict = None):
    """Send push notification to all devices of a user."""
    tokens = []
    async for doc in db.push_tokens.find({"user_id": user_id}, {"token": 1}):
        tokens.append(doc["token"])

    if not tokens:
        return

    messages = []
    for token in tokens:
        msg = {"to": token, "title": title, "body": body, "sound": "default"}
        if data:
            msg["data"] = data
        messages.append(msg)

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                "https://exp.host/--/api/v2/push/send",
                json=messages if len(messages) > 1 else messages[0],
                headers={"Content-Type": "application/json"},
            )
            if resp.status_code != 200:
                logger.error(f"Push send failed: {resp.text}")
    except Exception as e:
        logger.error(f"Push send error: {e}")


async def send_push_to_users(user_ids: List[str], title: str, body: str, data: dict = None):
    """Send push notification to multiple users."""
    for uid in user_ids:
        await send_push_to_user(uid, title, body, data)


# --- Notification Triggers (called from other parts of the app) ---

async def notify_new_message(sender_name: str, recipient_id: str, preview: str, chat_type: str = "dm"):
    """Notify user of a new message."""
    title = f"New message from {sender_name}"
    body_text = preview[:100] if preview else "Sent you a message"
    await send_push_to_user(recipient_id, title, body_text, {"type": "message", "chat_type": chat_type})


async def notify_friend_request(from_name: str, to_id: str):
    """Notify user of a friend request."""
    await send_push_to_user(to_id, "Friend Request", f"{from_name} wants to be your friend", {"type": "friend_request"})


async def notify_friend_accepted(from_name: str, to_id: str):
    """Notify user that friend request was accepted."""
    await send_push_to_user(to_id, "Friend Accepted", f"{from_name} accepted your friend request", {"type": "friend_accepted"})


async def notify_route_invite(from_name: str, to_id: str, route_title: str):
    """Notify user of a route invitation."""
    await send_push_to_user(to_id, "Route Invitation", f"{from_name} invited you to: {route_title}", {"type": "route_invite"})


async def notify_event_reminder(user_id: str, event_title: str):
    """Notify user of an upcoming event."""
    await send_push_to_user(user_id, "Event Reminder", f"Upcoming: {event_title}", {"type": "event_reminder"})


async def notify_premium_alert(user_id: str, alert_type: str, message: str):
    """Notify premium user of bike alerts (insurance, ITP, service)."""
    await send_push_to_user(user_id, f"Bike Alert: {alert_type}", message, {"type": "premium_alert", "alert": alert_type})


async def notify_ride_milestone(user_id: str, km: float):
    """Notify user of a ride milestone."""
    await send_push_to_user(user_id, "Ride Milestone!", f"You've ridden {km:.0f} km total!", {"type": "milestone"})


# --- API: Get notification preferences ---

@router.get("/api/push/status")
async def get_push_status(user=Depends(get_current_user)):
    """Check if user has push tokens registered."""
    uid = user["id"]
    count = await db.push_tokens.count_documents({"user_id": uid})
    return {"registered": count > 0, "device_count": count}
