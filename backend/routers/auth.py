"""Authentication routes: register, login"""
from datetime import datetime

from email_validator import EmailNotValidError, validate_email
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from database import db
from src_auth import create_access_token, hash_password, oid_str, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


class AuthRegister(BaseModel):
    email: str
    username: str
    password: str


class AuthLogin(BaseModel):
    email: str
    password: str


class AuthToken(BaseModel):
    access_token: str


@router.post("/register", response_model=AuthToken)
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


@router.post("/login", response_model=AuthToken)
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
