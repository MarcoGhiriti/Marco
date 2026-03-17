"""Group chat polls - create, vote, get results."""
from datetime import datetime, timezone
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List

from database import db, get_current_user, _safe_create_index, logger

router = APIRouter(tags=["polls"])


class CreatePollRequest(BaseModel):
    group_id: str
    question: str
    options: List[str]


class VoteRequest(BaseModel):
    option_index: int


async def ensure_poll_indexes():
    await _safe_create_index(db.polls, "group_id", background=True)
    logger.info("Poll indexes ensured")


@router.post("/api/polls")
async def create_poll(body: CreatePollRequest, user=Depends(get_current_user)):
    uid = user["id"]
    opts = [o.strip() for o in body.options if o.strip()]
    if len(opts) < 2:
        raise HTTPException(400, "At least 2 options required")

    now = datetime.now(timezone.utc)
    doc = {
        "group_id": body.group_id,
        "created_by": uid,
        "created_by_username": user.get("username", ""),
        "question": body.question.strip(),
        "options": [{"text": o, "votes": [], "count": 0} for o in opts],
        "total_votes": 0,
        "voters": [],
        "created_at": now,
    }
    result = await db.polls.insert_one(doc)
    return {"id": str(result.inserted_id), "question": body.question}


@router.post("/api/polls/{poll_id}/vote")
async def vote_poll(poll_id: str, body: VoteRequest, user=Depends(get_current_user)):
    uid = user["id"]
    poll = await db.polls.find_one({"_id": ObjectId(poll_id)})
    if not poll:
        raise HTTPException(404, "Poll not found")

    if uid in poll.get("voters", []):
        raise HTTPException(400, "Already voted")

    if body.option_index < 0 or body.option_index >= len(poll["options"]):
        raise HTTPException(400, "Invalid option")

    await db.polls.update_one(
        {"_id": ObjectId(poll_id)},
        {
            "$push": {
                f"options.{body.option_index}.votes": uid,
                "voters": uid,
            },
            "$inc": {
                f"options.{body.option_index}.count": 1,
                "total_votes": 1,
            },
        },
    )
    return {"voted": True, "option_index": body.option_index}


@router.get("/api/polls/{poll_id}")
async def get_poll(poll_id: str, user=Depends(get_current_user)):
    uid = user["id"]
    poll = await db.polls.find_one({"_id": ObjectId(poll_id)})
    if not poll:
        raise HTTPException(404, "Poll not found")

    has_voted = uid in poll.get("voters", [])
    my_vote = -1
    options = []
    for i, o in enumerate(poll["options"]):
        if uid in o.get("votes", []):
            my_vote = i
        options.append({"text": o["text"], "count": o.get("count", 0)})

    return {
        "id": str(poll["_id"]),
        "question": poll["question"],
        "options": options,
        "total_votes": poll.get("total_votes", 0),
        "has_voted": has_voted,
        "my_vote": my_vote,
        "created_by": poll.get("created_by_username", ""),
    }


@router.get("/api/polls/group/{group_id}")
async def get_group_polls(group_id: str, user=Depends(get_current_user)):
    uid = user["id"]
    polls = []
    async for p in db.polls.find({"group_id": group_id}).sort("created_at", -1).limit(50):
        has_voted = uid in p.get("voters", [])
        my_vote = -1
        options = []
        for i, o in enumerate(p["options"]):
            if uid in o.get("votes", []):
                my_vote = i
            options.append({"text": o["text"], "count": o.get("count", 0)})
        polls.append({
            "id": str(p["_id"]),
            "question": p["question"],
            "options": options,
            "total_votes": p.get("total_votes", 0),
            "has_voted": has_voted,
            "my_vote": my_vote,
            "created_by": p.get("created_by_username", ""),
        })
    return polls
