from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field


class EmailTaskItem(BaseModel):
    id: str = Field(..., description="Unique email identifier")
    sender: str = Field(..., description="Sender email address")
    sender_name: str = Field(..., description="Sender display name")
    subject: str = Field(..., description="Email subject line")
    body: str = Field(..., description="Plain text or excerpt of email body")
    timestamp: datetime = Field(..., description="Received timestamp")
    priority: str = Field(..., description="Inferred priority: CRITICAL, HIGH, MEDIUM, NORMAL")
    is_action_required: bool = Field(..., description="Whether user action or response is required")
    summary: str = Field(..., description="One-line AI generated actionable summary")
    suggested_department: str = Field(..., description="Target department code (IT, FIN, HR, SD, PROC)")
    status: str = Field("PENDING", description="Status: PENDING, CONVERTED, RESOLVED")
    converted_ticket_id: Optional[int] = Field(None, description="Linked ticket ID if converted")
    converted_ticket_number: Optional[str] = Field(None, description="Linked ticket number if converted")


class PendingEmailsResponse(BaseModel):
    critical_count: int = Field(0, description="Count of pending critical emails")
    high_count: int = Field(0, description="Count of pending high priority emails")
    medium_count: int = Field(0, description="Count of pending medium priority emails")
    normal_count: int = Field(0, description="Count of pending normal priority emails")
    total_pending: int = Field(0, description="Total actionable pending emails")
    items: List[EmailTaskItem] = Field(default_factory=list, description="List of actionable email items")


class ConvertEmailResponse(BaseModel):
    status: str
    message: str
    ticket_id: int
    ticket_number: str
    department_code: str
    priority: str
    email_id: str


class MarkResolvedResponse(BaseModel):
    status: str
    message: str
    email_id: str
