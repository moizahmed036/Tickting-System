from datetime import datetime, timezone
import random
import re
import secrets
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_db
from app.core.api_key_auth import get_api_key
from app.core.security import get_password_hash
from app.core.websocket_manager import ws_manager
from app.models.api_key import ApiKey
from app.models.audit import AuditAction, TicketAuditLog
from app.models.department import Department
from app.models.ticket import Ticket, TicketPriority, TicketState
from app.models.user import User, UserRole
from app.schemas.integrations import (
    ExternalEmailIngestPayload,
    ExternalEmailIngestResponse,
    ThirdPartyTicketCreate,
    ThirdPartyTicketResponse,
)
from app.services.ai_triage import ai_triage_service
from app.services.sla_service import sla_service

router = APIRouter()

TICKET_PATTERN = re.compile(r"TCK-([A-Z]+)-\d+-\d+", re.IGNORECASE)


async def generate_ticket_number(db: AsyncSession, department_code: str) -> str:
    """Generate unique enterprise ticket number."""
    current_year = datetime.now(timezone.utc).year
    count_stmt = select(func.count(Ticket.id))
    result = await db.execute(count_stmt)
    count = (result.scalar() or 0) + 1
    random_suffix = random.randint(10, 99)
    return f"TCK-{department_code.upper()}-{current_year}-{count:04d}{random_suffix}"


async def get_or_create_requester(
    db: AsyncSession, email: str, full_name: Optional[str] = None
) -> User:
    """Retrieve existing user or auto-provision as a REQUESTER."""
    clean_email = email.strip().lower()
    stmt = select(User).where(User.email == clean_email)
    res = await db.execute(stmt)
    user = res.scalars().first()
    if user:
        return user

    # Auto-provision user account
    generated_name = full_name.strip() if full_name else clean_email.split("@")[0].replace(".", " ").title()
    random_pw = secrets.token_urlsafe(16)
    new_user = User(
        email=clean_email,
        full_name=generated_name,
        role=UserRole.REQUESTER,
        hashed_password=get_password_hash(random_pw),
        is_active=True,
    )
    db.add(new_user)
    await db.flush()
    return new_user


@router.post(
    "/tickets",
    response_model=ThirdPartyTicketResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Programmatic Ticket Ingestion Gateway",
)
async def create_third_party_ticket(
    payload: ThirdPartyTicketCreate,
    api_key: ApiKey = Depends(get_api_key),
    db: AsyncSession = Depends(get_db),
):
    """
    Ingests tickets programmatically from external systems (CRMs, ERPs, Monitoring, Zapier).
    Secured by X-API-Key header. Automatically triages department and priority if omitted.
    """
    now = datetime.now(timezone.utc)

    # 1. Resolve or provision requester user
    sender_user = await get_or_create_requester(db, payload.sender_email, payload.sender_name)

    # 2. Resolve Department
    target_dept: Optional[Department] = None
    if api_key.department_id is not None:
        # Key is locked to a specific department
        dept_stmt = select(Department).where(Department.id == api_key.department_id)
        dept_res = await db.execute(dept_stmt)
        target_dept = dept_res.scalars().first()

        if payload.department_code and target_dept:
            if payload.department_code.upper() != target_dept.code.upper():
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"API key is restricted to department '{target_dept.code}'. Cannot create tickets for '{payload.department_code}'.",
                )
    else:
        # Universal Key: resolve from payload or AI classification
        if payload.department_code:
            dept_stmt = select(Department).where(
                Department.code == payload.department_code.upper(), Department.is_active == True
            )
            dept_res = await db.execute(dept_stmt)
            target_dept = dept_res.scalars().first()
            if not target_dept:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Department with code '{payload.department_code}' does not exist or is inactive.",
                )
        else:
            # AI Auto-triage
            triage_res = ai_triage_service.classify_ticket(payload.title, payload.description)
            dept_stmt = select(Department).where(
                Department.code == triage_res.suggested_department_code, Department.is_active == True
            )
            dept_res = await db.execute(dept_stmt)
            target_dept = dept_res.scalars().first()

            if not target_dept:
                # Fallback to first active department
                first_dept_res = await db.execute(
                    select(Department).where(Department.is_active == True).order_by(Department.id.asc())
                )
                target_dept = first_dept_res.scalars().first()

    if not target_dept:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not resolve active department destination.",
        )

    # 3. Resolve Priority
    priority = payload.priority
    if not priority:
        triage = ai_triage_service.classify_ticket(payload.title, payload.description)
        priority = triage.suggested_priority or TicketPriority.MEDIUM

    # 4. Generate Ticket Number & SLA Due Date
    ticket_num = await generate_ticket_number(db, target_dept.code)
    due_date = sla_service.calculate_due_date(priority, now)

    # 5. Build Metadata Payload
    meta = dict(payload.metadata or {})
    meta.update({
        "source_system": payload.source_system or "THIRD_PARTY_API",
        "api_key_name": api_key.name,
        "api_key_prefix": api_key.key_prefix,
    })

    # 6. Create Ticket in SUBMITTED state
    ticket = Ticket(
        ticket_number=ticket_num,
        title=payload.title.strip(),
        description=payload.description.strip(),
        priority=priority,
        current_state=TicketState.SUBMITTED,
        department_id=target_dept.id,
        creator_id=sender_user.id,
        metadata_payload=meta,
        due_date=due_date,
        is_escalated=False,
        created_at=now,
        updated_at=now,
    )
    db.add(ticket)
    await db.flush()

    # 7. Immutable Audit Record
    audit = TicketAuditLog(
        ticket_id=ticket.id,
        actor_id=sender_user.id,
        action=AuditAction.CREATED,
        from_state=None,
        to_state=TicketState.SUBMITTED,
        comment=f"Programmatic ingestion via API Key '{api_key.name}' from {payload.source_system}",
        payload={
            "source": payload.source_system,
            "api_key_prefix": api_key.key_prefix,
            "sender_email": sender_user.email,
        },
        created_at=now,
    )
    db.add(audit)
    await db.commit()
    await db.refresh(ticket)

    # 8. Dispatch Real-time WebSocket Broadcast
    try:
        await ws_manager.emit_ticket_event(
            event_type="NEW_TICKET",
            ticket=ticket,
            message=f"New ticket {ticket.ticket_number} created via API: '{ticket.title}'",
            actor=sender_user,
            department_code=target_dept.code,
        )
    except Exception as e:
        print(f"WebSocket broadcast error: {e}")

    return ThirdPartyTicketResponse(
        ticket_id=ticket.id,
        ticket_number=ticket.ticket_number,
        current_state=ticket.current_state,
        status="CREATED",
        department_code=target_dept.code,
        priority=ticket.priority,
        due_date=ticket.due_date,
        created_at=ticket.created_at,
    )


@router.post(
    "/email-ingest",
    response_model=ExternalEmailIngestResponse,
    status_code=status.HTTP_200_OK,
    summary="Third-Party Email Bot & Mailhook Ingestion Endpoint",
)
async def ingest_external_email(
    payload: ExternalEmailIngestPayload,
    api_key: ApiKey = Depends(get_api_key),
    db: AsyncSession = Depends(get_db),
):
    """
    Ingests raw/parsed inbound emails from external scrapers or webhooks (Zapier, SendGrid, Mailgun).
    Automatically matches existing ticket IDs to thread comments or provisions new tickets.
    """
    now = datetime.now(timezone.utc)

    # Resolve sender
    sender_user = await get_or_create_requester(db, payload.from_email, payload.from_name)

    # Check for Ticket Key reference in Subject or Body
    search_text = f"{payload.subject} {payload.body_text}"
    match = TICKET_PATTERN.search(search_text)

    if match:
        extracted_key = match.group(0).upper()
        # Find matching ticket
        stmt = (
            select(Ticket)
            .options(selectinload(Ticket.department), selectinload(Ticket.creator))
            .where(Ticket.ticket_number == extracted_key)
        )
        res = await db.execute(stmt)
        existing_ticket = res.scalars().first()

        if existing_ticket:
            # Enforce department isolation if key is locked
            if api_key.department_id and existing_ticket.department_id != api_key.department_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"API key restricted to department #{api_key.department_id}. Cannot thread email into ticket #{existing_ticket.department_id}.",
                )

            # Thread email as COMMENT_ADDED audit log
            comment_body = (
                f"Inbound Email Reply from {payload.from_email}:\n"
                f"Subject: {payload.subject}\n\n"
                f"{payload.body_text}"
            )
            audit = TicketAuditLog(
                ticket_id=existing_ticket.id,
                actor_id=sender_user.id,
                action=AuditAction.COMMENT_ADDED,
                from_state=existing_ticket.current_state,
                to_state=existing_ticket.current_state,
                comment=comment_body,
                is_internal=False,
                payload={
                    "from_email": payload.from_email,
                    "subject": payload.subject,
                    "message_id": payload.message_id,
                    "source": "EXTERNAL_EMAIL_BOT",
                    "api_key_prefix": api_key.key_prefix,
                },
                created_at=now,
            )
            db.add(audit)
            existing_ticket.updated_at = now
            await db.commit()

            # Emit WebSocket update
            dept_code = existing_ticket.department.code if existing_ticket.department else "IT"
            try:
                await ws_manager.emit_ticket_event(
                    event_type="TICKET_UPDATED",
                    ticket=existing_ticket,
                    message=f"New email response threaded on {existing_ticket.ticket_number} from {payload.from_email}",
                    actor=sender_user,
                    department_code=dept_code,
                )
            except Exception as e:
                print(f"WebSocket broadcast error: {e}")

            return ExternalEmailIngestResponse(
                status="THREADED",
                message=f"Inbound email successfully appended to ticket {existing_ticket.ticket_number}",
                ticket_id=existing_ticket.id,
                ticket_number=existing_ticket.ticket_number,
                department_code=dept_code,
                action="COMMENT_ADDED",
            )

    # If no existing ticket matched -> Create New Ticket from Inbound Email
    triage = ai_triage_service.classify_ticket(payload.subject, payload.body_text)

    # Resolve department
    target_dept: Optional[Department] = None
    if api_key.department_id is not None:
        dept_stmt = select(Department).where(Department.id == api_key.department_id)
        dept_res = await db.execute(dept_stmt)
        target_dept = dept_res.scalars().first()
    else:
        dept_stmt = select(Department).where(
            Department.code == triage.suggested_department_code, Department.is_active == True
        )
        dept_res = await db.execute(dept_stmt)
        target_dept = dept_res.scalars().first()
        if not target_dept:
            first_dept_res = await db.execute(
                select(Department).where(Department.is_active == True).order_by(Department.id.asc())
            )
            target_dept = first_dept_res.scalars().first()

    if not target_dept:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No active department found to assign email ticket.",
        )

    priority = triage.suggested_priority or TicketPriority.MEDIUM
    ticket_num = await generate_ticket_number(db, target_dept.code)
    due_date = sla_service.calculate_due_date(priority, now)

    meta = {
        "source": "EXTERNAL_EMAIL_BOT",
        "from_email": payload.from_email,
        "from_name": payload.from_name,
        "to_email": payload.to_email,
        "email_subject": payload.subject,
        "message_id": payload.message_id,
        "api_key_prefix": api_key.key_prefix,
        "ai_confidence": triage.confidence_score,
        "ai_tags": triage.extracted_tags,
    }

    ticket = Ticket(
        ticket_number=ticket_num,
        title=payload.subject.strip(),
        description=payload.body_text.strip(),
        priority=priority,
        current_state=TicketState.SUBMITTED,
        department_id=target_dept.id,
        creator_id=sender_user.id,
        metadata_payload=meta,
        due_date=due_date,
        is_escalated=False,
        created_at=now,
        updated_at=now,
    )
    db.add(ticket)
    await db.flush()

    audit = TicketAuditLog(
        ticket_id=ticket.id,
        actor_id=sender_user.id,
        action=AuditAction.CREATED,
        from_state=None,
        to_state=TicketState.SUBMITTED,
        comment=f"Ingested from external email bot: '{payload.subject}'",
        payload={
            "source": "EXTERNAL_EMAIL_BOT",
            "from_email": payload.from_email,
            "message_id": payload.message_id,
            "api_key_name": api_key.name,
        },
        created_at=now,
    )
    db.add(audit)
    await db.commit()
    await db.refresh(ticket)

    # Broadcast WebSocket event
    try:
        await ws_manager.emit_ticket_event(
            event_type="NEW_TICKET",
            ticket=ticket,
            message=f"New email ticket {ticket.ticket_number} created: '{ticket.title}'",
            actor=sender_user,
            department_code=target_dept.code,
        )
    except Exception as e:
        print(f"WebSocket broadcast error: {e}")

    return ExternalEmailIngestResponse(
        status="CONVERTED",
        message=f"Inbound email successfully converted into ticket {ticket.ticket_number}",
        ticket_id=ticket.id,
        ticket_number=ticket.ticket_number,
        department_code=target_dept.code,
        action="NEW_TICKET_CREATED",
    )
