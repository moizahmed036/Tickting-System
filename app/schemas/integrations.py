from datetime import datetime
from typing import Any, Dict, Optional
from pydantic import BaseModel, Field

from app.models.ticket import TicketPriority, TicketState


class ThirdPartyTicketCreate(BaseModel):
    """
    Programmatic ticket creation payload for CRMs, ERPs, Zapier, and third-party monitoring tools.
    """
    sender_email: str = Field(..., description="Email of the external user or requester")
    sender_name: Optional[str] = Field(None, description="Full name of the requester")
    title: str = Field(..., min_length=3, max_length=255, description="Ticket subject line or title")
    description: str = Field(..., min_length=3, description="Issue description, error dump, or request details")
    department_code: Optional[str] = Field(
        None, description="Target department queue (e.g., 'IT', 'FIN', 'HR', 'SD', 'PROC'). Auto-triaged if omitted."
    )
    priority: Optional[TicketPriority] = Field(
        None, description="Ticket priority level (LOW, MEDIUM, HIGH, URGENT, CRITICAL). AI triaged if omitted."
    )
    metadata: Optional[Dict[str, Any]] = Field(
        default_factory=dict, description="Custom domain payload, invoice IDs, telemetry tags, etc."
    )
    source_system: Optional[str] = Field("THIRD_PARTY_API", description="Origin software identifier")


class ThirdPartyTicketResponse(BaseModel):
    ticket_id: int
    ticket_number: str
    current_state: TicketState
    status: str = "CREATED"
    department_code: str
    priority: TicketPriority
    due_date: Optional[datetime] = None
    created_at: datetime


class ExternalEmailIngestPayload(BaseModel):
    """
    Raw or parsed inbound email payload forwarded by external mail bots, Mailgun, SendGrid, or custom forwarders.
    """
    from_email: str = Field(..., description="Sender email address")
    from_name: Optional[str] = Field(None, description="Sender display name")
    to_email: str = Field(..., description="Destination support mailbox or intake alias")
    subject: str = Field(..., description="Raw email subject line")
    body_text: str = Field(..., description="Plain text email body")
    body_html: Optional[str] = Field(None, description="HTML formatted email body if available")
    message_id: Optional[str] = Field(None, description="RFC 2822 Message-ID or external UID")


class ExternalEmailIngestResponse(BaseModel):
    status: str
    message: str
    ticket_id: int
    ticket_number: str
    department_code: str
    action: str
