from datetime import datetime, timezone
import hashlib
import secrets
from typing import Optional
from fastapi import Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_db
from app.models.api_key import ApiKey


async def get_api_key(
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
    db: AsyncSession = Depends(get_db),
) -> ApiKey:
    """
    FastAPI security dependency for authenticating third-party integration requests
    via cryptographically hashed API keys (e.g., X-API-Key: nxf_live_...).
    """
    if not x_api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing required authentication header 'X-API-Key'",
            headers={"WWW-Authenticate": "ApiKey"},
        )

    # Clean input
    raw_key = x_api_key.strip()
    if not raw_key.startswith("nxf_live_"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key format. Expected prefix 'nxf_live_...'",
            headers={"WWW-Authenticate": "ApiKey"},
        )

    # Hash incoming key
    hashed = hashlib.sha256(raw_key.encode("utf-8")).hexdigest()

    # Query active key record
    stmt = (
        select(ApiKey)
        .options(selectinload(ApiKey.department), selectinload(ApiKey.created_by))
        .where(ApiKey.hashed_key == hashed, ApiKey.is_active == True)
    )
    result = await db.execute(stmt)
    api_key_record = result.scalars().first()

    if not api_key_record:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized: API Key is invalid, unrecognized, or has been revoked",
            headers={"WWW-Authenticate": "ApiKey"},
        )

    # Constant-time comparison
    if not secrets.compare_digest(api_key_record.hashed_key, hashed):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized: Constant-time validation mismatch",
            headers={"WWW-Authenticate": "ApiKey"},
        )

    # Update last_used_at timestamp asynchronously
    try:
        api_key_record.last_used_at = datetime.now(timezone.utc)
        await db.commit()
    except Exception:
        await db.rollback()

    return api_key_record
