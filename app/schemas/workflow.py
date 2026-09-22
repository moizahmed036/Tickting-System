from datetime import datetime
from typing import Any, Dict, Optional
from pydantic import BaseModel, ConfigDict, Field

from app.models.ticket import TicketState
from app.models.user import UserRole


class DepartmentBase(BaseModel):
    code: str = Field(..., min_length=2, max_length=50, description="Unique department code e.g. IT, FIN")
    name: str = Field(..., min_length=2, max_length=150)
    description: Optional[str] = None
    is_active: bool = True


class DepartmentCreate(DepartmentBase):
    pass


class DepartmentUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=150)
    description: Optional[str] = None
    is_active: Optional[bool] = None


class DepartmentResponse(DepartmentBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class WorkflowStepBase(BaseModel):
    department_id: int
    name: str = Field(..., min_length=2, max_length=150)
    from_state: TicketState
    to_state: TicketState
    required_role: UserRole
    step_order: int = Field(default=1, ge=1)
    condition_rules: Dict[str, Any] = Field(default_factory=dict)
    is_active: bool = True


class WorkflowStepCreate(WorkflowStepBase):
    pass


class WorkflowStepUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=150)
    from_state: Optional[TicketState] = None
    to_state: Optional[TicketState] = None
    required_role: Optional[UserRole] = None
    step_order: Optional[int] = Field(None, ge=1)
    condition_rules: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None


class WorkflowStepResponse(WorkflowStepBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AvailableTransitionResponse(BaseModel):
    step_id: int
    name: str
    from_state: TicketState
    to_state: TicketState
    required_role: UserRole
    condition_rules: Dict[str, Any] = Field(default_factory=dict)
    is_allowed: bool = True
    reason: Optional[str] = None
