import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
from jose import JWTError, jwt

from app.core.config import settings


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(
        plain_password.encode('utf-8'),
        hashed_password.encode('utf-8')
    )


def get_password_hash(password: str) -> str:
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed.decode('utf-8')


# ─── Access token (short-lived JWT) ───────────────────────────────────────────

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=15))
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)


def decode_access_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        # Reject tokens that are not access tokens (e.g. someone passing a refresh JWT)
        if payload.get("type") != "access":
            return None
        return payload
    except JWTError:
        return None


# ─── Refresh token (opaque random bytes, hashed for storage) ──────────────────

def generate_refresh_token() -> str:
    """Return a 64-byte URL-safe random token (128 hex chars). Never stored raw."""
    return secrets.token_hex(64)


def hash_refresh_token(raw_token: str) -> str:
    """SHA-256 of the raw token — this is what goes into the DB."""
    return hashlib.sha256(raw_token.encode()).hexdigest()


def get_refresh_token_expiry() -> datetime:
    return datetime.utcnow() + timedelta(days=settings.refresh_token_expire_days)
