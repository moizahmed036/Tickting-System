from datetime import datetime, timedelta, timezone
import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_action_token
from app.models.audit import AuditAction, TicketAuditLog
from app.models.department import Department
from app.models.ticket import Ticket, TicketPriority, TicketState
from app.models.user import User, UserRole


@pytest.mark.asyncio
async def test_quick_action_approval_success(async_client: AsyncClient, db_session: AsyncSession):
    """
    Test 1-click executive approval via cryptographically signed magic token.
    """
    # 1. Fetch Finance authorizer and Finance department
    auth_stmt = select(User).where(User.email == "fin.director@enterprise.local")
    auth_res = await db_session.execute(auth_stmt)
    authorizer = auth_res.scalars().first()
    assert authorizer is not None


    dept_stmt = select(Department).where(Department.code == "FIN")
    dept_res = await db_session.execute(dept_stmt)
    department = dept_res.scalars().first()
    assert department is not None

    req_stmt = select(User).where(User.email == "requester@enterprise.local")
    req_res = await db_session.execute(req_stmt)
    requester = req_res.scalars().first()

    # 2. Create ticket in PENDING_APPROVAL state
    now = datetime.now(timezone.utc)
    ticket = Ticket(
        ticket_number="TCK-FIN-2026-9901",
        title="Software License Renewal - JetBrains",
        description="Renewal of 50 enterprise licenses.",
        priority=TicketPriority.HIGH,
        current_state=TicketState.PENDING_APPROVAL,
        department_id=department.id,
        creator_id=requester.id,
        assignee_id=None,
        metadata_payload={},
        due_date=now + timedelta(hours=24),
        is_escalated=False,
        created_at=now,
        updated_at=now,
    )
    db_session.add(ticket)
    await db_session.commit()
    await db_session.refresh(ticket)

    # 3. Create signed action token for APPROVAL
    token = create_action_token(
        ticket_id=ticket.id,
        user_id=authorizer.id,
        target_state="APPROVED",
    )

    # 4. Trigger Quick Action GET endpoint
    response = await async_client.get(f"/api/v1/tickets/quick-action?token={token}")
    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]
    assert "Ticket Approved" in response.text
    assert ticket.ticket_number in response.text
    assert authorizer.full_name in response.text

    # 5. Verify database state mutation
    await db_session.refresh(ticket)
    assert ticket.current_state == TicketState.APPROVED

    # 6. Verify audit log entry
    audit_stmt = (
        select(TicketAuditLog)
        .where(TicketAuditLog.ticket_id == ticket.id)
        .order_by(TicketAuditLog.created_at.desc())
    )
    audit_res = await db_session.execute(audit_stmt)
    last_audit = audit_res.scalars().first()
    assert last_audit is not None
    assert last_audit.action == AuditAction.APPROVED
    assert last_audit.actor_id == authorizer.id


@pytest.mark.asyncio
async def test_quick_action_rejection_success(async_client: AsyncClient, db_session: AsyncSession):
    """
    Test 1-click executive rejection via signed magic token.
    """
    auth_stmt = select(User).where(User.email == "fin.director@enterprise.local")
    auth_res = await db_session.execute(auth_stmt)
    authorizer = auth_res.scalars().first()
    assert authorizer is not None


    dept_stmt = select(Department).where(Department.code == "FIN")
    dept_res = await db_session.execute(dept_stmt)
    department = dept_res.scalars().first()

    req_stmt = select(User).where(User.email == "requester@enterprise.local")
    req_res = await db_session.execute(req_stmt)
    requester = req_res.scalars().first()

    now = datetime.now(timezone.utc)
    ticket = Ticket(
        ticket_number="TCK-FIN-2026-9902",
        title="Unbudgeted Luxury Office Supplies",
        description="Coffee machine upgrade request.",
        priority=TicketPriority.LOW,
        current_state=TicketState.PENDING_APPROVAL,
        department_id=department.id,
        creator_id=requester.id,
        assignee_id=None,
        metadata_payload={},
        due_date=now + timedelta(hours=48),
        is_escalated=False,
        created_at=now,
        updated_at=now,
    )
    db_session.add(ticket)
    await db_session.commit()
    await db_session.refresh(ticket)

    # Generate REJECT action token
    token = create_action_token(
        ticket_id=ticket.id,
        user_id=authorizer.id,
        target_state="REJECTED",
    )

    response = await async_client.get(f"/api/v1/tickets/quick-action?token={token}")
    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]
    assert "Ticket Rejected" in response.text

    await db_session.refresh(ticket)
    assert ticket.current_state == TicketState.REJECTED


@pytest.mark.asyncio
async def test_quick_action_invalid_token(async_client: AsyncClient):
    """
    Test quick-action failure on corrupted or forged token.
    """
    response = await async_client.get("/api/v1/tickets/quick-action?token=invalid.malformed.jwt")
    assert response.status_code == 400
    assert "text/html" in response.headers["content-type"]
    assert "Unable to Process Action" in response.text
