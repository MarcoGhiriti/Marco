import os
from datetime import datetime, timedelta
from typing import Any, Optional

import bcrypt
import jwt
from bson import ObjectId
from fastapi import HTTPException

def _get_jwt_secret() -> str:
    # Read dynamically so reloads pick up .env changes
    return os.environ.get("JWT_SECRET", "")
JWT_ALG = "HS256"
ACCESS_TOKEN_DAYS = 14


def oid_str(v: Any) -> str:
    if isinstance(v, ObjectId):
        return str(v)
    return str(v)


def hash_password(password: str) -> str:
    salt = bcrypt.gensalt(rounds=12)
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except Exception:
        return False


def create_access_token(user_id: str) -> str:
    jwt_secret = _get_jwt_secret()
    if not jwt_secret:
        raise HTTPException(status_code=500, detail="JWT_SECRET not configured")

    now = datetime.utcnow()
    payload = {
        "sub": user_id,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(days=ACCESS_TOKEN_DAYS)).timestamp()),
        "type": "access",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


def decode_token(token: str) -> Optional[dict]:
    if not JWT_SECRET:
        return None
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except Exception:
        return None
