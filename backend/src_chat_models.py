from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field


class FriendRequestCreate(BaseModel):
    to_username: str = Field(min_length=3, max_length=20)


class FriendAccept(BaseModel):
    from_user_id: str


class GroupCreate(BaseModel):
    name: str = Field(min_length=2, max_length=40)
    description: str = Field(default="", max_length=400)
    is_private: bool = False
    photo_base64: Optional[str] = Field(default=None, description="Base64 encoded group photo")


class GroupOut(BaseModel):
    id: str
    name: str
    description: str
    is_private: bool
    owner_id: str
    admins: list[str]
    members_count: int
    members: list[str] = []
    photo_base64: Optional[str] = None
    created_at: datetime


class MessageCreate(BaseModel):
    text: str = Field(min_length=1, max_length=2000)


class MessageOut(BaseModel):
    id: str
    thread_id: str
    kind: Literal["dm", "group"]
    from_user_id: str
    to_user_id: Optional[str] = None
    group_id: Optional[str] = None
    text: str
    created_at: datetime
