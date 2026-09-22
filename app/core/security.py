from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional, Union
from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain-text password against a hashed password."""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Generate a bcrypt password hash."""
    return pwd_context.hash(password)


def create_access_token(
    subject: Union[str, Any],
    role: Optional[str] = None,
    department_id: Optional[int] = None,
    extra_claims: Optional[Dict[str, Any]] = None,
    expires_delta: Optional[timedelta] = None,
) -> str:
    """
    Generate an encoded JWT access token with standard and custom claims.
    """
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode: Dict[str, Any] = {
        "sub": str(subject),
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
    }
    
    if role:
        to_encode["role"] = role
    if department_id is not None:
        to_encode["department_id"] = department_id
    if extra_claims:
        to_encode.update(extra_claims)

    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    """
    Decode and validate a JWT access token.
    Returns the token payload dictionary if valid, None otherwise.
    """
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError:
        return None


def create_action_token(
    ticket_id: int,
    user_id: int,
    target_state: str,
    expires_delta: Optional[timedelta] = None,
) -> str:
    """
    Generate a short-lived, cryptographically signed JWT token for 1-click email approvals/rejections.
    Default validity is 48 hours.
    """
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(hours=48)

    to_encode: Dict[str, Any] = {
        "type": "quick_action",
        "ticket_id": ticket_id,
        "user_id": user_id,
        "target_state": target_state,
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
    }
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_action_token(token: str) -> Optional[Dict[str, Any]]:
    """
    Decode and validate a 1-click quick-action JWT token.
    Returns payload dictionary if valid and type == 'quick_action', None otherwise.
    """
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        if payload.get("type") != "quick_action":
            return None
        if "ticket_id" not in payload or "user_id" not in payload or "target_state" not in payload:
            return None
        return payload
    except JWTError:
        return None

