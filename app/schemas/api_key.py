from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class ApiKeyCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=150, description="Friendly label (e.g., 'ERP Invoice Bot')")
    department_id: Optional[int] = Field(
        None, description="Optional department restriction. None = universal queue access."
    )


class ApiKeyRead(BaseModel):
    id: int
    name: str
    key_prefix: str
    department_id: Optional[int] = None
    department_code: Optional[str] = None
    department_name: Optional[str] = None
    created_by_id: int
    created_by_name: Optional[str] = None
    is_active: bool
    last_used_at: Optional[datetime] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ApiKeyCreatedResponse(BaseModel):
    api_key: ApiKeyRead
    raw_secret_key: str = Field(
        ...,
        description="The plaintext API key secret. Save it securely; it will NOT be displayed again.",
    )
    message: str = "API Key successfully generated. Store this key safely as it cannot be recovered."


class ApiKeyListResponse(BaseModel):
    items: List[ApiKeyRead]
    total: int
