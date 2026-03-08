"""Listing chat routes — isolated from Community messaging."""
from datetime import datetime, timezone, timedelta
import json
from bson import ObjectId, json_util
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional

from database import db, get_current_user, create_notification, _safe_create_index, logger

router = APIRouter(prefix="/api/marketplace/chat", tags=["listing-chat"])


# --- Models ---
class SendMessageBody(BaseModel):
    text: str


# --- Indexes (called once at import / startup) ---
async def ensure_listing_chat_indexes():
    # TTL: auto-delete after 30 days of inactivity
    await _safe_create_index(
        db.listing_chats,
        "last_message_at",
        expireAfterSeconds=2592000,  # 30 days
        background=True,
    )
    await _safe_create_index(
        db.listing_chats,
        [("listing_id", 1), ("buyer_id", 1)],
        unique=True,
        background=True,
    )
    await _safe_create_index(db.listing_chat_messages, "chat_id", background=True)
    await _safe_create_index(
        db.listing_chat_messages,
        "expires_at",
        expireAfterSeconds=0,
        background=True,
    )
    logger.info("Listing chat indexes ensured")


# --- Helpers ---
def _oid(v):
    return str(v) if v else None


def _user_variants(user_id: str) -> list:
    variants = [user_id]
    try:
        variants.append(ObjectId(user_id))
    except Exception:
        pass
    return variants


def _chat_out(chat, user_id: str) -> dict:
    sid = str(chat.get("seller_id", ""))
    bid = str(chat.get("buyer_id", ""))
    other_id = bid if sid == user_id else sid
    last_msg_at = chat.get("last_message_at", chat.get("created_at"))
    created = chat.get("created_at")
    return {
        "id": str(chat.get("_id", "")),
        "listing_id": str(chat.get("listing_id", "")),
        "listing_title": chat.get("listing_title", ""),
        "buyer_id": bid,
        "seller_id": sid,
        "other_user_id": other_id,
        "other_username": chat.get("buyer_username") if sid == user_id else chat.get("seller_username"),
        "last_message": chat.get("last_message", ""),
        "last_message_at": last_msg_at.isoformat() if isinstance(last_msg_at, datetime) else str(last_msg_at or ""),
        "unread_count": chat.get(f"unread_{user_id}", 0),
        "created_at": created.isoformat() if isinstance(created, datetime) else str(created or ""),
    }


# --- Routes ---

@router.get("/conversations")
async def get_my_conversations(user=Depends(get_current_user)):
    """Get all listing chat conversations for current user (as buyer or seller)."""
    uid = user["id"]
    uid_variants = _user_variants(uid)
    chats = []
    async for c in db.listing_chats.find(
        {"$or": [{"seller_id": {"$in": uid_variants}}, {"buyer_id": {"$in": uid_variants}}]},
    ).sort("last_message_at", -1):
        c["_id"] = str(c["_id"])
        chats.append(_chat_out(c, uid))
    return JSONResponse(content=json.loads(json_util.dumps(chats)))


@router.get("/listing/{listing_id}/conversations")
async def get_listing_conversations(listing_id: str, user=Depends(get_current_user)):
    """Seller: get all conversations for a specific listing they own."""
    uid = user["id"]
    listing = await db.marketplace_listings.find_one({"_id": ObjectId(listing_id)}, {"seller_id": 1})
    if not listing or str(listing.get("seller_id")) != uid:
        raise HTTPException(404, "Listing not found or not yours")
    uid_variants = _user_variants(uid)
    chats = []
    async for c in db.listing_chats.find(
        {"listing_id": listing_id, "seller_id": {"$in": uid_variants}},
    ).sort("last_message_at", -1):
        chats.append(_chat_out(c, uid))
    return chats


@router.get("/listing/{listing_id}/count")
async def get_listing_message_count(listing_id: str, user=Depends(get_current_user)):
    """Get unread message count for a listing (seller view)."""
    uid = user["id"]
    uid_variants = _user_variants(uid)
    pipeline = [
        {"$match": {"listing_id": listing_id, "seller_id": {"$in": uid_variants}}},
        {"$group": {"_id": None, "total": {"$sum": f"$unread_{uid}"}}},
    ]
    result = await db.listing_chats.aggregate(pipeline).to_list(1)
    total = result[0]["total"] if result and result[0].get("total") is not None else 0
    return {"listing_id": listing_id, "unread_count": total, "conversation_count": await db.listing_chats.count_documents({"listing_id": listing_id, "seller_id": {"$in": uid_variants}})}


@router.post("/listing/{listing_id}/send")
async def send_message(listing_id: str, body: SendMessageBody, user=Depends(get_current_user)):
    """Send a message in a listing chat. Creates the chat if it doesn't exist."""
    uid = user["id"]
    username = user.get("username", "user")
    text = body.text.strip()
    if not text:
        raise HTTPException(400, "Message cannot be empty")

    # Get listing info
    listing = await db.marketplace_listings.find_one(
        {"_id": ObjectId(listing_id)},
        {"seller_id": 1, "seller_username": 1, "title": 1},
    )
    if not listing:
        raise HTTPException(404, "Listing not found")

    seller_id = str(listing["seller_id"])
    seller_username = listing.get("seller_username", "seller")
    listing_title = listing.get("title", "Listing")

    # Determine roles
    if uid == seller_id:
        # Seller can't start a chat with themselves — they reply to existing ones
        # But we need a buyer_id. For replies, the chat must already exist.
        # Actually let's allow if chat exists
        buyer_id = None  # will be resolved from existing chat
    else:
        buyer_id = uid

    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(days=30)

    if buyer_id:
        # Buyer sending — upsert chat
        chat = await db.listing_chats.find_one_and_update(
            {"listing_id": listing_id, "buyer_id": buyer_id},
            {
                "$set": {
                    "last_message": text[:100],
                    "last_message_at": now,
                },
                "$setOnInsert": {
                    "listing_id": listing_id,
                    "listing_title": listing_title,
                    "seller_id": seller_id,
                    "seller_username": seller_username,
                    "buyer_id": buyer_id,
                    "buyer_username": username,
                    "created_at": now,
                },
                "$inc": {f"unread_{seller_id}": 1},
            },
            upsert=True,
            return_document=True,
        )
        # Fix: find_one_and_update with $ifNull doesn't work in $set. Do it simply:
        chat_id = str(chat["_id"])
    else:
        # Seller replying — we need to figure out which chat (not supported via this endpoint alone)
        raise HTTPException(400, "Seller must reply to a specific chat. Use /chat/{chat_id}/send instead.")

    # Insert the message
    msg_doc = {
        "chat_id": chat_id,
        "listing_id": listing_id,
        "sender_id": uid,
        "sender_username": username,
        "text": text,
        "created_at": now,
        "expires_at": expires_at,
    }
    res = await db.listing_chat_messages.insert_one(msg_doc)

    # Update chat last_message
    await db.listing_chats.update_one(
        {"_id": chat["_id"]},
        {"$set": {"last_message": text[:100], "last_message_at": now}},
    )

    # Send notification to seller
    await create_notification(
        seller_id,
        "listing_message",
        f"New message on {listing_title}",
        f"{username}: {text[:80]}",
        {"listing_id": listing_id, "chat_id": chat_id},
    )

    return {
        "id": str(res.inserted_id),
        "chat_id": chat_id,
        "text": text,
        "sender_id": uid,
        "created_at": now.isoformat(),
    }


@router.post("/{chat_id}/send")
async def send_message_to_chat(chat_id: str, body: SendMessageBody, user=Depends(get_current_user)):
    """Send a message to an existing chat (used by both buyer and seller)."""
    uid = user["id"]
    username = user.get("username", "user")
    text = body.text.strip()
    if not text:
        raise HTTPException(400, "Message cannot be empty")

    chat = await db.listing_chats.find_one({"_id": ObjectId(chat_id)})
    if not chat:
        raise HTTPException(404, "Chat not found")

    # Must be participant
    seller_id = str(chat["seller_id"])
    buyer_id = str(chat["buyer_id"])
    if uid not in [seller_id, buyer_id]:
        raise HTTPException(403, "Not a participant")

    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(days=30)
    other_id = buyer_id if uid == seller_id else seller_id

    # Insert message
    msg_doc = {
        "chat_id": chat_id,
        "listing_id": chat["listing_id"],
        "sender_id": uid,
        "sender_username": username,
        "text": text,
        "created_at": now,
        "expires_at": expires_at,
    }
    res = await db.listing_chat_messages.insert_one(msg_doc)

    # Update chat
    await db.listing_chats.update_one(
        {"_id": chat["_id"]},
        {
            "$set": {"last_message": text[:100], "last_message_at": now},
            "$inc": {f"unread_{other_id}": 1},
        },
    )

    # Notification
    listing_title = chat.get("listing_title", "Listing")
    await create_notification(
        other_id,
        "listing_message",
        f"Message on {listing_title}",
        f"{username}: {text[:80]}",
        {"listing_id": chat["listing_id"], "chat_id": chat_id},
    )

    return {
        "id": str(res.inserted_id),
        "chat_id": chat_id,
        "text": text,
        "sender_id": uid,
        "created_at": now.isoformat(),
    }


@router.get("/{chat_id}/messages")
async def get_chat_messages(chat_id: str, limit: int = 50, user=Depends(get_current_user)):
    """Get messages for a specific chat."""
    uid = user["id"]
    chat = await db.listing_chats.find_one({"_id": ObjectId(chat_id)})
    if not chat:
        raise HTTPException(404, "Chat not found")
    seller_id = str(chat["seller_id"])
    buyer_id = str(chat["buyer_id"])
    if uid not in [seller_id, buyer_id]:
        raise HTTPException(403, "Not a participant")

    # Mark as read
    await db.listing_chats.update_one(
        {"_id": chat["_id"]},
        {"$set": {f"unread_{uid}": 0}},
    )

    messages = []
    async for m in db.listing_chat_messages.find(
        {"chat_id": chat_id},
        {"_id": 1, "sender_id": 1, "sender_username": 1, "text": 1, "created_at": 1},
    ).sort("created_at", -1).limit(limit):
        messages.append({
            "id": str(m["_id"]),
            "sender_id": m["sender_id"],
            "sender_username": m.get("sender_username", ""),
            "text": m["text"],
            "created_at": m["created_at"].isoformat() if isinstance(m["created_at"], datetime) else m["created_at"],
        })

    messages.reverse()

    return {
        "chat_id": chat_id,
        "listing_id": chat["listing_id"],
        "listing_title": chat.get("listing_title", ""),
        "seller_id": seller_id,
        "buyer_id": buyer_id,
        "other_username": chat.get("buyer_username") if uid == seller_id else chat.get("seller_username"),
        "messages": messages,
    }
