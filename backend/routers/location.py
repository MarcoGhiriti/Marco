"""Location routes: update user location."""
from datetime import datetime

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from database import db, get_current_user, _as_object_id

router = APIRouter(prefix="/location", tags=["location"])


class LocationUpdate(BaseModel):
    lat: float = Field(..., ge=-90, le=90)
    lng: float = Field(..., ge=-180, le=180)


@router.post("/update")
async def location_update(payload: LocationUpdate, current_user: dict = Depends(get_current_user)):
    """Update the current user's live location."""
    uid = current_user["id"]
    await db.users.update_one(
        {"_id": _as_object_id(uid)},
        {"$set": {
            "last_location": {"lat": payload.lat, "lng": payload.lng, "updated_at": datetime.utcnow()},
        }},
    )
    return {"ok": True}
