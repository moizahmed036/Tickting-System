from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field

from app.models.audit import AuditAction
from app.models.ticket import TicketPriority, TicketState
from app.schemas.auth import UserResponse
from app.schemas.workflow import DepartmentResponse


class AuditLogResponse(BaseModel):
    id: int
    ticket_id: int
    actor_id: Optional[int] = None
    action: AuditAction
    from_state: Optional[TicketState] = None
    to_state: Optional[TicketState] = None
    comment: Optional[str] = None
    is_internal: bool = False
    payload: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
    actor: Optional[UserResponse] = None

    model_config = ConfigDict(from_attributes=True)


class CommentCreate(BaseModel):
    comment: str = Field(..., min_length=1, max_length=5000)
    is_internal: bool = Field(False, description="True for staff-only internal notes, False for public comments")


class TicketBase(BaseModel):
    title: str = Field(..., min_length=3, max_length=255)
    description: str = Field(..., min_length=3)
    priority: TicketPriority = TicketPriority.MEDIUM
    department_id: int
    metadata_payload: Dict[str, Any] = Field(default_factory=dict)
    due_date: Optional[datetime] = None


class TicketCreate(TicketBase):
    pass


class TicketUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=3, max_length=255)
    description: Optional[str] = Field(None, min_length=3)
    priority: Optional[TicketPriority] = None
    assignee_id: Optional[int] = None
    metadata_payload: Optional[Dict[str, Any]] = None
    due_date: Optional[datetime] = None
    comment: Optional[str] = Field(None, description="Optional audit reason for change")


class TicketTransitionRequest(BaseModel):
    target_state: TicketState
    comment: Optional[str] = Field(None, description="Reason or justification for transition")
    metadata_patch: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Metadata key-values to merge")


class TicketResponse(TicketBase):
    id: int
    ticket_number: str
    current_state: TicketState
    creator_id: int
    assignee_id: Optional[int] = None
    is_escalated: bool = False
    created_at: datetime
    updated_at: datetime
    resolved_at: Optional[datetime] = None
    closed_at: Optional[datetime] = None
    
    creator: Optional[UserResponse] = None
    assignee: Optional[UserResponse] = None
    department: Optional[DepartmentResponse] = None

    model_config = ConfigDict(from_attributes=True)


class TicketListResponse(BaseModel):
    total: int
    items: List[TicketResponse]
    page: int
    limit: int
