from datetime import datetime, timedelta, timezone
import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit import AuditAction, TicketAuditLog
from app.models.department import Department
from app.models.ticket import Ticket, TicketPriority, TicketState
from app.models.user import User
from app.services.sla_service import sla_service


@pytest.mark.asyncio
async def test_sla_due_date_calculation():
    now = datetime(2026, 1, 1, 10, 0, 0, tzinfo=timezone.utc)
    
    # Critical = 4 hours
    critical_due = sla_service.calculate_due_date(TicketPriority.CRITICAL, start_time=now)
    assert critical_due == now + timedelta(hours=4)

    # High = 12 hours
    high_due = sla_service.calculate_due_date(TicketPriority.HIGH, start_time=now)
    assert high_due == now + timedelta(hours=12)

    # Medium = 24 hours
    medium_due = sla_service.calculate_due_date(TicketPriority.MEDIUM, start_time=now)
    assert medium_due == now + timedelta(hours=24)

    # Low = 48 hours
    low_due = sla_service.calculate_due_date(TicketPriority.LOW, start_time=now)
    assert low_due == now + timedelta(hours=48)


@pytest.mark.asyncio
async def test_sla_auto_escalation_process(db_session: AsyncSession):
    # Fetch admin and IT dept
    user = (await db_session.execute(select(User).where(User.email == "admin@enterprise.local"))).scalars().first()
    dept = (await db_session.execute(select(Department).where(Department.code == "IT"))).scalars().first()

    now = datetime.now(timezone.utc)
    # Create an overdue ticket (due_date was 2 hours ago)
    overdue_time = now - timedelta(hours=2)

    ticket = Ticket(
        ticket_number="TCK-IT-2026-SLA-001",
        title="Critical Gateway Outage (Overdue SLA Test)",
        description="Main API gateway is failing healthchecks.",
        priority=TicketPriority.CRITICAL,
        current_state=TicketState.IN_PROGRESS,
        department_id=dept.id,
        creator_id=user.id,
        due_date=overdue_time,
        is_escalated=False,
    )
    db_session.add(ticket)
    await db_session.commit()
    await db_session.refresh(ticket)

    assert ticket.is_escalated is False

    # Execute SLA Scanner
    escalated_tickets = await sla_service.process_sla_escalations(db_session)
    assert len(escalated_tickets) >= 1

    # Verify ticket state is updated
    await db_session.refresh(ticket)
    assert ticket.is_escalated is True

    # Verify immutable audit log recorded
    stmt = (
        select(TicketAuditLog)
        .where(TicketAuditLog.ticket_id == ticket.id)
        .order_by(TicketAuditLog.created_at.desc())
    )
    audit = (await db_session.execute(stmt)).scalars().first()
    assert audit is not None
    assert audit.action == AuditAction.ESCALATED
    assert "SLA Breach" in audit.comment
    assert audit.payload.get("event") == "SLA_BREACH"
