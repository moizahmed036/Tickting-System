from datetime import datetime, timezone
from pathlib import Path
import random
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import HTMLResponse
from jinja2 import Environment, FileSystemLoader
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_active_user, get_db
from app.core.config import settings
from app.core.security import decode_action_token
from app.core.websocket_manager import ws_manager
from app.models.audit import AuditAction, TicketAuditLog
from app.models.department import Department
from app.models.ticket import Ticket, TicketPriority, TicketState
from app.models.user import User, UserRole
from app.schemas.ticket import (
    AuditLogResponse,
    CommentCreate,
    TicketCreate,
    TicketListResponse,
    TicketResponse,
    TicketTransitionRequest,
    TicketUpdate,
)
from app.schemas.workflow import AvailableTransitionResponse
from app.services.workflow_engine import workflow_engine

from app.services.sla_service import sla_service
from app.services.notification_service import notification_service
from app.services.ai_triage import ai_triage_service
from app.schemas.ai_triage import TriageRequest, TriageResponse

router = APIRouter()

TEMPLATES_DIR = Path(__file__).resolve().parent.parent.parent / "templates"
jinja_env = Environment(loader=FileSystemLoader(str(TEMPLATES_DIR)), autoescape=True)


@router.post("/smart-classify", response_model=TriageResponse, summary="AI smart triage and classification")
async def smart_classify(
    request: TriageRequest,
    current_user: User = Depends(get_current_active_user),
) -> TriageResponse:
    """
    Classify ticket details with AI to recommend department, priority, tags, and first response.
    """
    return ai_triage_service.classify_ticket(
        title=request.title,
        description=request.description,
    )


@router.get("/quick-action", response_class=HTMLResponse, summary="1-Click Magic Email Approval/Rejection")
async def quick_action(
    token: str = Query(..., description="Cryptographically signed action JWT token"),
    db: AsyncSession = Depends(get_db),
) -> HTMLResponse:
    """
    Execute an executive approval or rejection decision directly from a signed email link
    without requiring manual credentials login.
    """
    template = jinja_env.get_template("action_result.html")
    payload = decode_action_token(token)
    if not payload:
        html = template.render(
            is_success=False,
            error_message="The authorization link is invalid, altered, or has expired (exceeded 48 hours). Please sign in to the portal.",
            portal_url=settings.FRONTEND_HOST,
        )
        return HTMLResponse(content=html, status_code=status.HTTP_400_BAD_REQUEST)

    ticket_id = payload.get("ticket_id")
    user_id = payload.get("user_id")
    target_state_str = payload.get("target_state")

    # Fetch authorizer user
    user_stmt = select(User).where(User.id == user_id)
    user_res = await db.execute(user_stmt)
    actor_user = user_res.scalars().first()
    if not actor_user or not actor_user.is_active:
        html = template.render(
            is_success=False,
            error_message="The authorizer associated with this link is inactive or no longer registered in the directory.",
            portal_url=settings.FRONTEND_HOST,
        )
        return HTMLResponse(content=html, status_code=status.HTTP_403_FORBIDDEN)

    try:
        target_state = TicketState(target_state_str)
    except ValueError:
        html = template.render(
            is_success=False,
            error_message=f"Invalid target state '{target_state_str}' specified in the action token.",
            portal_url=settings.FRONTEND_HOST,
        )
        return HTMLResponse(content=html, status_code=status.HTTP_400_BAD_REQUEST)

    try:
        updated_ticket = await workflow_engine.execute_transition(
            db=db,
            ticket_id=ticket_id,
            target_state=target_state,
            actor=actor_user,
            comment=f"1-Click Direct Email Authorization ({target_state.value}) by {actor_user.full_name}",
        )
        now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
        html = template.render(
            is_success=True,
            target_state=target_state.value,
            ticket_number=updated_ticket.ticket_number,
            ticket_title=updated_ticket.title,
            actor_name=actor_user.full_name,
            actor_role=actor_user.role.value,
            timestamp=now_str,
            portal_url=f"{settings.FRONTEND_HOST}/tickets/{updated_ticket.id}",
        )
        return HTMLResponse(content=html, status_code=status.HTTP_200_OK)
    except Exception as e:
        error_detail = str(getattr(e, "detail", str(e)))
        html = template.render(
            is_success=False,
            error_message=error_detail,
            portal_url=f"{settings.FRONTEND_HOST}/tickets/{ticket_id}",
        )
        return HTMLResponse(content=html, status_code=status.HTTP_400_BAD_REQUEST)



async def generate_ticket_number(db: AsyncSession, department_code: str) -> str:
    """
    Generate a human-readable, unique enterprise ticket number.
    Format: TCK-{DEPT}-{YEAR}-{SEQUENCE} (e.g. TCK-IT-2026-0042)
    """
    current_year = datetime.now(timezone.utc).year
    count_stmt = select(func.count(Ticket.id))
    result = await db.execute(count_stmt)
    count = (result.scalar() or 0) + 1
    # Add random jitter to avoid collision on concurrency
    random_suffix = random.randint(10, 99)
    return f"TCK-{department_code.upper()}-{current_year}-{count:04d}{random_suffix}"


@router.post("/", response_model=TicketResponse, status_code=status.HTTP_201_CREATED, summary="Create a new ticket")
async def create_ticket(
    ticket_in: TicketCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> TicketResponse:
    """
    Create a new support or service ticket.
    Automatically assigns unique ticket number, computes SLA due date, and records an immutable CREATED audit event.
    """
    # Verify department exists and is active
    dept_stmt = select(Department).where(Department.id == ticket_in.department_id)
    dept_res = await db.execute(dept_stmt)
    department = dept_res.scalars().first()
    if not department:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Department with ID {ticket_in.department_id} not found",
        )
    if not department.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Department '{department.name}' is currently inactive",
        )

    ticket_number = await generate_ticket_number(db, department.code)

    now = datetime.now(timezone.utc)
    due_date = ticket_in.due_date or sla_service.calculate_due_date(ticket_in.priority, now)

    ticket = Ticket(
        ticket_number=ticket_number,
        title=ticket_in.title.strip(),
        description=ticket_in.description.strip(),
        priority=ticket_in.priority,
        current_state=TicketState.DRAFT,
        department_id=department.id,
        creator_id=current_user.id,
        assignee_id=None,
        metadata_payload=ticket_in.metadata_payload or {},
        due_date=due_date,
        is_escalated=False,
        created_at=now,
        updated_at=now,
    )
    db.add(ticket)
    await db.flush()  # Flush to get ticket.id

    # Create immutable audit log entry
    audit_log = TicketAuditLog(
        ticket_id=ticket.id,
        actor_id=current_user.id,
        action=AuditAction.CREATED,
        from_state=None,
        to_state=TicketState.DRAFT,
        comment="Ticket initiated in Draft state",
        payload={
            "initial_data": {
                "title": ticket.title,
                "priority": ticket.priority.value,
                "department": department.code,
                "due_date": due_date.isoformat() if due_date else None,
                "metadata": ticket.metadata_payload,
            }
        },
        created_at=now,
    )
    db.add(audit_log)
    await db.commit()

    # Load relations for full response
    full_ticket = await workflow_engine.get_ticket_with_relations(db, ticket.id)

    # Dispatch notification
    try:
        if full_ticket:
            await notification_service.send_ticket_created_notification(full_ticket)
    except Exception as e:
        print(f"Notification error: {e}")

    # Emit real-time WebSocket event to department and admins
    try:
        await ws_manager.emit_ticket_event(
            event_type="NEW_TICKET",
            ticket=ticket,
            message=f"New ticket {ticket.ticket_number} created: '{ticket.title}'",
            actor=current_user,
            department_code=department.code,
        )
    except Exception as e:
        print(f"WebSocket emit error: {e}")

    return TicketResponse.model_validate(full_ticket)



def check_ticket_access(ticket: Ticket, user: User) -> None:
    """
    Strict Department Isolation & RBAC access guard.
    Super Admins have universal visibility across all departments.
    Requesters can only access tickets they personally created.
    Department members (Assignee, Authorizer, Observer) can access tickets belonging
    to their assigned department or created by themselves.
    Cross-department queries by non-admins are strictly rejected with 403 Forbidden.
    """
    if user.role == UserRole.ADMIN:
        return

    if user.role == UserRole.REQUESTER:
        if ticket.creator_id != user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You can only access tickets you personally created.",
            )
        return

    # Non-admin operational roles (ASSIGNEE, AUTHORIZER, OBSERVER)
    if user.department_id is not None:
        if ticket.department_id != user.department_id and ticket.creator_id != user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied: You do not have permission to access tickets from other departments.",
            )
    else:
        if ticket.creator_id != user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You do not have permission to access this ticket.",
            )


@router.get("/", response_model=TicketListResponse, summary="List and filter tickets")
async def list_tickets(
    department_id: Optional[int] = Query(None, description="Filter by department"),
    state: Optional[TicketState] = Query(None, description="Filter by current state"),
    priority: Optional[TicketPriority] = Query(None, description="Filter by priority"),
    assignee_id: Optional[int] = Query(None, description="Filter by assigned user"),
    creator_id: Optional[int] = Query(None, description="Filter by creator user"),
    search: Optional[str] = Query(None, description="Search in ticket number or title"),
    my_queue: bool = Query(False, description="Filter tickets relevant to current user's role and queue"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=100, description="Items per page"),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> TicketListResponse:
    """
    Query tickets with strict multi-department isolation and role-based queue scopes.
    Super Admins have universal visibility; non-admins are restricted to their assigned department or created tickets.
    """
    # Strict Department Isolation Check for Non-Admins
    if current_user.role != UserRole.ADMIN:
        if department_id is not None:
            if current_user.department_id is None or department_id != current_user.department_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied: You do not have permission to view other department queues.",
                )

    stmt = (
        select(Ticket)
        .options(
            selectinload(Ticket.department),
            selectinload(Ticket.creator),
            selectinload(Ticket.assignee),
        )
    )

    # Scoping by Role & Department
    if current_user.role == UserRole.REQUESTER:
        # Requesters can only see their own tickets
        stmt = stmt.where(Ticket.creator_id == current_user.id)
    elif current_user.role != UserRole.ADMIN:
        # Assignees, Authorizers, Observers: isolate to own department queue OR own created tickets
        if current_user.department_id is not None:
            stmt = stmt.where(
                or_(
                    Ticket.department_id == current_user.department_id,
                    Ticket.creator_id == current_user.id,
                )
            )
        else:
            stmt = stmt.where(Ticket.creator_id == current_user.id)

        if my_queue:
            if current_user.role == UserRole.ASSIGNEE:
                stmt = stmt.where(
                    or_(
                        Ticket.assignee_id == current_user.id,
                        (Ticket.department_id == current_user.department_id)
                        & (Ticket.current_state.in_([TicketState.SUBMITTED, TicketState.APPROVED, TicketState.IN_PROGRESS])),
                    )
                )
            elif current_user.role == UserRole.AUTHORIZER:
                stmt = stmt.where(
                    Ticket.department_id == current_user.department_id,
                    Ticket.current_state == TicketState.PENDING_APPROVAL,
                )
    elif my_queue:
        # Admin my_queue view
        pass

    # General query filters
    if department_id is not None:
        stmt = stmt.where(Ticket.department_id == department_id)

    if state is not None:
        stmt = stmt.where(Ticket.current_state == state)
    if priority is not None:
        stmt = stmt.where(Ticket.priority == priority)
    if assignee_id is not None:
        stmt = stmt.where(Ticket.assignee_id == assignee_id)
    if creator_id is not None and current_user.role != UserRole.REQUESTER:
        stmt = stmt.where(Ticket.creator_id == creator_id)
    if search:
        search_pattern = f"%{search.strip()}%"
        stmt = stmt.where(
            or_(
                Ticket.ticket_number.ilike(search_pattern),
                Ticket.title.ilike(search_pattern),
            )
        )

    # Count total
    count_stmt = select(func.count()).select_from(stmt.subquery())
    total_res = await db.execute(count_stmt)
    total = total_res.scalar() or 0

    # Paginate
    offset = (page - 1) * limit
    stmt = stmt.order_by(Ticket.created_at.desc()).offset(offset).limit(limit)
    result = await db.execute(stmt)
    items = result.scalars().all()

    return TicketListResponse(
        total=total,
        items=[TicketResponse.model_validate(t) for t in items],
        page=page,
        limit=limit,
    )


@router.get("/{ticket_id}", response_model=TicketResponse, summary="Get ticket details")
async def get_ticket(
    ticket_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> TicketResponse:
    """
    Retrieve single ticket details by ID with permissions verification.
    """
    ticket = await workflow_engine.get_ticket_with_relations(db, ticket_id)
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Ticket with ID {ticket_id} not found",
        )

    check_ticket_access(ticket, current_user)
    return TicketResponse.model_validate(ticket)


@router.patch("/{ticket_id}", response_model=TicketResponse, summary="Update ticket fields or assign agent")
async def update_ticket(
    ticket_id: int,
    ticket_in: TicketUpdate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> TicketResponse:
    """
    Update ticket details (e.g. title, priority, assignee, metadata).
    Emits an immutable audit log capturing updated fields.
    """
    ticket = await workflow_engine.get_ticket_with_relations(db, ticket_id)
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Ticket with ID {ticket_id} not found",
        )

    check_ticket_access(ticket, current_user)

    # Permission check: Requesters can only edit their own draft tickets
    if current_user.role == UserRole.REQUESTER:
        if ticket.creator_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
        if ticket.current_state != TicketState.DRAFT:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Requesters cannot modify tickets once submitted. Use transitions or comments.",
            )

    diff: Dict[str, Any] = {}
    audit_action = AuditAction.FIELD_UPDATED

    if ticket_in.title is not None and ticket_in.title != ticket.title:
        diff["title"] = {"old": ticket.title, "new": ticket_in.title}
        ticket.title = ticket_in.title

    if ticket_in.description is not None and ticket_in.description != ticket.description:
        diff["description"] = {"old": ticket.description, "new": ticket_in.description}
        ticket.description = ticket_in.description

    if ticket_in.priority is not None and ticket_in.priority != ticket.priority:
        diff["priority"] = {"old": ticket.priority.value, "new": ticket_in.priority.value}
        ticket.priority = ticket_in.priority

    if ticket_in.assignee_id is not None and ticket_in.assignee_id != ticket.assignee_id:
        # Verify assignee is active
        assignee_stmt = select(User).where(User.id == ticket_in.assignee_id)
        assignee_res = await db.execute(assignee_stmt)
        assignee_user = assignee_res.scalars().first()
        if not assignee_user or not assignee_user.is_active:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid assignee user")
        
        diff["assignee_id"] = {"old": ticket.assignee_id, "new": ticket_in.assignee_id}
        ticket.assignee_id = ticket_in.assignee_id
        audit_action = AuditAction.ASSIGNED

    if ticket_in.metadata_payload is not None:
        merged_meta = dict(ticket.metadata_payload or {})
        merged_meta.update(ticket_in.metadata_payload)
        diff["metadata_payload"] = ticket_in.metadata_payload
        ticket.metadata_payload = merged_meta

    if diff:
        now = datetime.now(timezone.utc)
        ticket.updated_at = now
        audit_log = TicketAuditLog(
            ticket_id=ticket.id,
            actor_id=current_user.id,
            action=audit_action,
            from_state=ticket.current_state,
            to_state=ticket.current_state,
            comment=ticket_in.comment or "Ticket attributes updated",
            payload={"changes": diff},
            created_at=now,
        )
        db.add(audit_log)
        await db.commit()
        await db.refresh(ticket)

    updated_ticket = await workflow_engine.get_ticket_with_relations(db, ticket.id)

    if diff:
        try:
            dept_code = updated_ticket.department.code if updated_ticket.department else "GEN"
            await ws_manager.emit_ticket_event(
                event_type="TICKET_UPDATED",
                ticket=updated_ticket,
                message=f"Ticket {updated_ticket.ticket_number} updated by {current_user.full_name}",
                actor=current_user,
                department_code=dept_code,
            )
        except Exception as e:
            print(f"WebSocket emit error: {e}")

    return TicketResponse.model_validate(updated_ticket)


@router.post("/{ticket_id}/transition", response_model=TicketResponse, summary="Execute FSM state transition")
async def transition_ticket(
    ticket_id: int,
    request: TicketTransitionRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> TicketResponse:
    """
    Trigger a workflow transition through the FSM Workflow Engine.
    Strictly enforces role authorization, department queue boundary, and audit trail generation.
    """
    ticket = await workflow_engine.execute_transition(
        db=db,
        ticket_id=ticket_id,
        target_state=request.target_state,
        actor=current_user,
        comment=request.comment,
        metadata_patch=request.metadata_patch,
    )

    try:
        dept_code = ticket.department.code if ticket.department else "GEN"
        await ws_manager.emit_ticket_event(
            event_type="TICKET_UPDATED",
            ticket=ticket,
            message=f"Ticket {ticket.ticket_number} transitioned to {ticket.current_state.value}",
            actor=current_user,
            department_code=dept_code,
        )
    except Exception as e:
        print(f"WebSocket emit error: {e}")

    return TicketResponse.model_validate(ticket)


@router.get("/{ticket_id}/next-transitions", response_model=List[AvailableTransitionResponse], summary="Inspect available next transitions")
async def get_next_transitions(
    ticket_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> List[AvailableTransitionResponse]:
    """
    Retrieve all valid transitions possible from the ticket's current state,
    along with authorization flags for the requesting user.
    """
    ticket = await workflow_engine.get_ticket_with_relations(db, ticket_id)
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Ticket with ID {ticket_id} not found",
        )
    check_ticket_access(ticket, current_user)
    return await workflow_engine.get_available_transitions(db, ticket, current_user)


@router.get("/{ticket_id}/audit-trail", response_model=List[AuditLogResponse], summary="Get immutable audit history")
async def get_audit_trail(
    ticket_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> List[AuditLogResponse]:
    """
    Retrieve the complete, immutable chronological audit log for a ticket.
    Requesters cannot view internal staff-only notes.
    """
    ticket = await workflow_engine.get_ticket_with_relations(db, ticket_id)
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Ticket with ID {ticket_id} not found",
        )

    check_ticket_access(ticket, current_user)

    stmt = (
        select(TicketAuditLog)
        .where(TicketAuditLog.ticket_id == ticket_id)
        .options(selectinload(TicketAuditLog.actor))
        .order_by(TicketAuditLog.created_at.asc())
    )

    # Requesters cannot see internal staff-only logs or notes
    if current_user.role == UserRole.REQUESTER:
        stmt = stmt.where(TicketAuditLog.is_internal == False)

    result = await db.execute(stmt)
    logs = result.scalars().all()
    return [AuditLogResponse.model_validate(log) for log in logs]


@router.post("/{ticket_id}/comments", response_model=AuditLogResponse, summary="Add public comment or internal staff note")
async def add_comment(
    ticket_id: int,
    comment_in: CommentCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> AuditLogResponse:
    """
    Add a public communication comment or an internal staff-only note to a ticket.
    Requesters can only submit public comments.
    """
    ticket = await workflow_engine.get_ticket_with_relations(db, ticket_id)
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Ticket with ID {ticket_id} not found",
        )

    check_ticket_access(ticket, current_user)

    if comment_in.is_internal and current_user.role == UserRole.REQUESTER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Requesters cannot create internal staff-only notes.",
        )

    now = datetime.now(timezone.utc)
    audit_log = TicketAuditLog(
        ticket_id=ticket.id,
        actor_id=current_user.id,
        action=AuditAction.COMMENT_ADDED,
        from_state=ticket.current_state,
        to_state=ticket.current_state,
        comment=comment_in.comment.strip(),
        is_internal=comment_in.is_internal,
        payload={"is_internal": comment_in.is_internal},
        created_at=now,
    )
    db.add(audit_log)
    ticket.updated_at = now
    await db.commit()
    await db.refresh(audit_log)

    # Load actor relation
    stmt = (
        select(TicketAuditLog)
        .where(TicketAuditLog.id == audit_log.id)
        .options(selectinload(TicketAuditLog.actor))
    )
    res = await db.execute(stmt)
    full_log = res.scalars().first()

    try:
        dept_code = ticket.department.code if ticket.department else "GEN"
        note_type = "Internal note" if comment_in.is_internal else "Comment"
        await ws_manager.emit_ticket_event(
            event_type="TICKET_UPDATED",
            ticket=ticket,
            message=f"{note_type} added on {ticket.ticket_number} by {current_user.full_name}",
            actor=current_user,
            department_code=dept_code,
            is_internal=comment_in.is_internal,
        )
    except Exception as e:
        print(f"WebSocket emit error: {e}")

    return AuditLogResponse.model_validate(full_log)

