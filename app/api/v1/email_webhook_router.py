import logging
import random
import re
import secrets
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_db
from app.core.security import get_password_hash
from app.models.audit import AuditAction, TicketAuditLog
from app.models.department import Department
from app.models.ticket import Ticket, TicketPriority, TicketState
from app.models.user import User, UserRole
from app.services.ai_triage import ai_triage_service
from app.services.notification_service import notification_service
from app.services.sla_service import sla_service
from app.services.workflow_engine import workflow_engine

logger = logging.getLogger(__name__)

router = APIRouter()

TICKET_PATTERN = re.compile(r"TCK-[A-Z]+-[0-9]+-[0-9]+", re.IGNORECASE)
TICKET_PATTERN_ALT = re.compile(r"TCK-[A-Z]+-\d{4}-\d+", re.IGNORECASE)


def extract_ticket_number_from_text(text: str) -> Optional[str]:
    """Scan text or email subject/body for ticket identification pattern."""
    if not text:
        return None
    match = TICKET_PATTERN.search(text) or TICKET_PATTERN_ALT.search(text)
    return match.group(0).upper() if match else None


class InboundEmailPayload(BaseModel):
    """
    Standardized inbound email webhook ingestion schema.
    Compatible with SendGrid Inbound Parse, Mailgun Routes, Postmark, and custom SMTP webhooks.
    """
    sender: str = Field(..., min_length=3, max_length=255, description="Email address of the sender/requester")
    subject: str = Field(..., min_length=1, max_length=255, description="Email subject line")
    body_plain: Optional[str] = Field(None, description="Plain text email content")
    body_html: Optional[str] = Field(None, description="HTML formatted email content")
    sender_name: Optional[str] = Field(None, description="Display name of the sender")
    attachments: Optional[List[Dict[str, Any]]] = Field(default_factory=list, description="Attachment metadata")



class InboundEmailResponse(BaseModel):
    status: str
    ticket_id: int
    ticket_number: str
    title: str
    department_code: str
    priority: str
    auto_provisioned_user: bool
    ai_confidence: float
    message: str


async def generate_ticket_number(db: AsyncSession, department_code: str) -> str:
    """Generate a unique enterprise ticket identifier."""
    current_year = datetime.now(timezone.utc).year
    count_stmt = select(func.count(Ticket.id))
    result = await db.execute(count_stmt)
    count = (result.scalar() or 0) + 1
    random_suffix = random.randint(10, 99)
    return f"TCK-{department_code.upper()}-{current_year}-{count:04d}{random_suffix}"


@router.post(
    "/inbound-email",
    response_model=InboundEmailResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Inbound Email Ingestion Webhook",
)
async def inbound_email_webhook(
    payload: InboundEmailPayload,
    db: AsyncSession = Depends(get_db),
) -> InboundEmailResponse:
    """
    Ingest emails from external mail transfer agents (SendGrid/Mailgun/SMTP).
    1. Resolves or auto-provisions user account.
    2. Thread Check: Scans subject and body for existing ticket patterns (e.g. TCK-IT-2026-0042).
       If match is found, appends the email as a comment (COMMENT_ADDED) instead of duplicating tickets.
    3. New Ticket Creation: Runs AI Triage, categorizes department & priority.
       If IT department, tags with [IT-Support] and source='EMAIL_INBOUND'.
    4. Auto-creates the Ticket in SUBMITTED state with SLA due date.
    5. Dispatches an automated confirmation email back to the sender.
    """
    sender_email = payload.sender.lower().strip()
    subject = payload.subject.strip()
    body_content = (payload.body_plain or payload.body_html or "No content provided in email body.").strip()

    # 1. Resolve or Auto-Provision User Account
    user_stmt = select(User).where(User.email == sender_email)
    user_res = await db.execute(user_stmt)
    user = user_res.scalars().first()
    auto_provisioned = False

    if not user:
        auto_provisioned = True
        full_name = payload.sender_name or sender_email.split("@")[0].replace(".", " ").title()
        random_pwd = secrets.token_urlsafe(16)
        user = User(
            email=sender_email,
            full_name=full_name,
            hashed_password=get_password_hash(random_pwd),
            role=UserRole.REQUESTER,
            department_id=None,
            is_active=True,
        )
        db.add(user)
        await db.flush()
        logger.info(f"[EMAIL WEBHOOK] Auto-provisioned external user: {sender_email} (ID: {user.id})")

    # 2. Thread Check: Scan subject and body for existing ticket numbers
    existing_ticket_num = extract_ticket_number_from_text(subject) or extract_ticket_number_from_text(body_content)
    if existing_ticket_num:
        t_stmt = (
            select(Ticket)
            .where(Ticket.ticket_number == existing_ticket_num)
            .options(selectinload(Ticket.department))
        )
        t_res = await db.execute(t_stmt)
        existing_ticket = t_res.scalars().first()
        if existing_ticket:
            now = datetime.now(timezone.utc)
            comment_text = f"Inbound email reply from {sender_email}:\n\n{body_content}"
            audit_log = TicketAuditLog(
                ticket_id=existing_ticket.id,
                actor_id=user.id,
                action=AuditAction.COMMENT_ADDED,
                from_state=existing_ticket.current_state,
                to_state=existing_ticket.current_state,
                comment=comment_text[:1000],
                payload={
                    "source": "INBOUND_EMAIL_THREAD",
                    "sender": sender_email,
                    "subject": subject,
                    "body": body_content,
                },
                created_at=now,
            )
            existing_ticket.updated_at = now
            db.add(audit_log)
            await db.commit()
            await db.refresh(existing_ticket)

            logger.info(f"[EMAIL WEBHOOK] Appended email comment to existing Ticket #{existing_ticket.ticket_number}")
            return InboundEmailResponse(
                status="THREAD_UPDATED",
                ticket_id=existing_ticket.id,
                ticket_number=existing_ticket.ticket_number,
                title=existing_ticket.title,
                department_code=existing_ticket.department.code if existing_ticket.department else "IT",
                priority=existing_ticket.priority.value,
                auto_provisioned_user=auto_provisioned,
                ai_confidence=1.0,
                message=f"Email successfully appended as comment to existing ticket {existing_ticket.ticket_number}",
            )

    # 3. AI Smart Triage Classification for New Ticket
    triage_result = ai_triage_service.classify_ticket(
        title=subject,
        description=body_content,
    )
    suggested_dept_code = triage_result.suggested_department_code.upper()

    # Match Target Department
    dept_stmt = select(Department).where(Department.code == suggested_dept_code)
    dept_res = await db.execute(dept_stmt)
    department = dept_res.scalars().first()

    # Fallback to IT if matching code is not active or found
    if not department or not department.is_active:
        dept_fallback_stmt = select(Department).where(Department.code == "IT")
        fallback_res = await db.execute(dept_fallback_stmt)
        department = fallback_res.scalars().first()
        if not department:
            first_active_stmt = select(Department).where(Department.is_active == True).limit(1)  # noqa: E712
            first_active_res = await db.execute(first_active_stmt)
            department = first_active_res.scalars().first()

    if not department:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No operational departments configured in the enterprise system",
        )

    # 4. IT Queue Rules & Tags
    tags = list(triage_result.extracted_tags or [])
    if department.code == "IT":
        if "IT-Support" not in tags:
            tags.insert(0, "IT-Support")
        source_label = "EMAIL_INBOUND"
    else:
        source_label = "EMAIL_INBOUND"

    # Create Ticket & SLA Due Date
    ticket_number = await generate_ticket_number(db, department.code)
    now = datetime.now(timezone.utc)
    due_date = sla_service.calculate_due_date(triage_result.suggested_priority, now)

    ticket = Ticket(
        ticket_number=ticket_number,
        title=subject,
        description=body_content,
        priority=triage_result.suggested_priority,
        current_state=TicketState.SUBMITTED,
        department_id=department.id,
        creator_id=user.id,
        assignee_id=None,
        metadata_payload={
            "source": source_label,
            "raw_sender": sender_email,
            "sender_name": payload.sender_name,
            "tags": tags,
            "has_attachments": len(payload.attachments) > 0,
            "attachment_count": len(payload.attachments),
            "ai_triage": {
                "confidence_score": triage_result.confidence_score,
                "suggested_tags": tags,
                "suggested_first_response": triage_result.suggested_first_response,
            },
        },
        due_date=due_date,
        is_escalated=False,
        created_at=now,
        updated_at=now,
    )
    db.add(ticket)
    await db.flush()

    # 5. Append-Only Audit Trail Log
    audit_log = TicketAuditLog(
        ticket_id=ticket.id,
        actor_id=user.id,
        action=AuditAction.CREATED,
        from_state=None,
        to_state=TicketState.SUBMITTED,
        comment=f"Ingested via Inbound Email Gateway from {sender_email}. AI classified to {department.code} ({triage_result.suggested_priority.value}).",
        payload={
            "source": source_label,
            "sender": sender_email,
            "ai_confidence": triage_result.confidence_score,
            "tags": tags,
        },
        created_at=now,
    )

    db.add(audit_log)
    await db.commit()

    # 6. Dispatch Confirmation Notification
    full_ticket = await workflow_engine.get_ticket_with_relations(db, ticket.id)
    try:
        if full_ticket:
            await notification_service.send_ticket_created_notification(full_ticket)
    except Exception as e:
        logger.warning(f"[EMAIL WEBHOOK] Notification dispatch error: {e}")

    return InboundEmailResponse(
        status="PROCESSED",
        ticket_id=ticket.id,
        ticket_number=ticket.ticket_number,
        title=ticket.title,
        department_code=department.code,
        priority=ticket.priority.value,
        auto_provisioned_user=auto_provisioned,
        ai_confidence=triage_result.confidence_score,
        message=f"Ticket {ticket.ticket_number} created and routed to {department.name}",
    )
