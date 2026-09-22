from datetime import datetime
from typing import Any, Dict, Optional
from pydantic import BaseModel, ConfigDict, Field

from app.models.ticket import TicketPriority
from app.schemas.auth import UserResponse
from app.schemas.workflow import DepartmentResponse


class RecurringWorkflowBase(BaseModel):
    title: str = Field(..., min_length=3, max_length=255)
    description: str = Field(..., min_length=3)
    department_id: int
    cron_expression: str = Field(default="0 9 1 * *", min_length=5, max_length=100)
    priority: TicketPriority = TicketPriority.MEDIUM
    metadata_template: Dict[str, Any] = Field(default_factory=dict)
    is_active: bool = True


class RecurringWorkflowCreate(RecurringWorkflowBase):
    pass


class RecurringWorkflowUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=3, max_length=255)
    description: Optional[str] = Field(None, min_length=3)
    department_id: Optional[int] = None
    cron_expression: Optional[str] = Field(None, min_length=5, max_length=100)
    priority: Optional[TicketPriority] = None
    metadata_template: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None


class RecurringWorkflowResponse(RecurringWorkflowBase):
    id: int
    creator_id: Optional[int] = None
    last_run_at: Optional[datetime] = None
    next_run_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    department: Optional[DepartmentResponse] = None
    creator: Optional[UserResponse] = None

    model_config = ConfigDict(from_attributes=True)
