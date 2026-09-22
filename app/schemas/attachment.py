from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class AttachmentUploader(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: str
    email: str


class AttachmentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    ticket_id: int
    uploader_id: Optional[int] = None
    filename: str
    file_size: int
    content_type: str
    created_at: datetime
    uploader: Optional[AttachmentUploader] = None


class AttachmentListResponse(BaseModel):
    items: list[AttachmentRead]
    total: int
