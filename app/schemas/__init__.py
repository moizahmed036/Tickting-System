"""
Pydantic v2 schemas for authentication, tickets, workflows, and audit.
"""
from app.schemas.auth import (
    LoginRequest,
    Token,
    TokenPayload,
    UserBase,
    UserCreate,
    UserResponse,
    UserUpdate,
)
from app.schemas.ticket import (
    AuditLogResponse,
    TicketBase,
    TicketCreate,
    TicketListResponse,
    TicketResponse,
    TicketTransitionRequest,
    TicketUpdate,
)
from app.schemas.workflow import (
    AvailableTransitionResponse,
    DepartmentBase,
    DepartmentCreate,
    DepartmentResponse,
    DepartmentUpdate,
    WorkflowStepBase,
    WorkflowStepCreate,
    WorkflowStepResponse,
    WorkflowStepUpdate,
)
from app.schemas.recurring import (
    RecurringWorkflowBase,
    RecurringWorkflowCreate,
    RecurringWorkflowResponse,
    RecurringWorkflowUpdate,
)
from app.schemas.ai_triage import (
    TriageRequest,
    TriageResponse,
)

__all__ = [
    "LoginRequest",
    "Token",
    "TokenPayload",
    "UserBase",
    "UserCreate",
    "UserResponse",
    "UserUpdate",
    "AuditLogResponse",
    "TicketBase",
    "TicketCreate",
    "TicketListResponse",
    "TicketResponse",
    "TicketTransitionRequest",
    "TicketUpdate",
    "AvailableTransitionResponse",
    "DepartmentBase",
    "DepartmentCreate",
    "DepartmentResponse",
    "DepartmentUpdate",
    "WorkflowStepBase",
    "WorkflowStepCreate",
    "WorkflowStepResponse",
    "WorkflowStepUpdate",
    "RecurringWorkflowBase",
    "RecurringWorkflowCreate",
    "RecurringWorkflowResponse",
    "RecurringWorkflowUpdate",
    "TriageRequest",
    "TriageResponse",
]
