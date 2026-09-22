import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit import AuditAction, TicketAuditLog
from app.models.department import Department
from app.models.ticket import Ticket, TicketPriority, TicketState
from app.models.user import User
from app.services.workflow_engine import WorkflowEngine, WorkflowEngineException


@pytest.mark.asyncio
async def test_workflow_engine_direct_transition_and_audit(db_session: AsyncSession):
    # 1. Fetch Users and Department
    requester = (await db_session.execute(select(User).where(User.email == "requester@enterprise.local"))).scalars().first()
    fin_agent = (await db_session.execute(select(User).where(User.email == "fin.agent@enterprise.local"))).scalars().first()
    fin_director = (await db_session.execute(select(User).where(User.email == "fin.director@enterprise.local"))).scalars().first()
    fin_dept = (await db_session.execute(select(Department).where(Department.code == "FIN"))).scalars().first()

    # 2. Create Ticket in DRAFT state
    ticket = Ticket(
        ticket_number="TCK-FIN-2026-0001",
        title="Q1 Vendor Payment Requisition",
        description="Payment for cloud hosting provider",
        priority=TicketPriority.HIGH,
        current_state=TicketState.DRAFT,
        department_id=fin_dept.id,
        creator_id=requester.id,
        metadata_payload={"amount": 4500, "vendor": "CloudCorp"},
    )
    db_session.add(ticket)
    await db_session.commit()
    await db_session.refresh(ticket)

    # 3. Transition: DRAFT -> SUBMITTED by Requester
    updated_t = await WorkflowEngine.execute_transition(
        db=db_session,
        ticket_id=ticket.id,
        target_state=TicketState.SUBMITTED,
        actor=requester,
        comment="Submitting requisition for review",
    )
    assert updated_t.current_state == TicketState.SUBMITTED

    # 4. Transition: SUBMITTED -> PENDING_APPROVAL by Finance Agent
    updated_t = await WorkflowEngine.execute_transition(
        db=db_session,
        ticket_id=ticket.id,
        target_state=TicketState.PENDING_APPROVAL,
        actor=fin_agent,
        comment="Compliance checked. Ready for Director approval.",
    )
    assert updated_t.current_state == TicketState.PENDING_APPROVAL

    # 5. Transition: PENDING_APPROVAL -> APPROVED by Finance Director
    updated_t = await WorkflowEngine.execute_transition(
        db=db_session,
        ticket_id=ticket.id,
        target_state=TicketState.APPROVED,
        actor=fin_director,
        comment="Budget approved within Q1 limits.",
    )
    assert updated_t.current_state == TicketState.APPROVED

    # 6. Verify Immutable Audit Logs
    audit_stmt = (
        select(TicketAuditLog)
        .where(TicketAuditLog.ticket_id == ticket.id)
        .order_by(TicketAuditLog.created_at.asc())
    )
    audit_logs = (await db_session.execute(audit_stmt)).scalars().all()
    assert len(audit_logs) == 3

    assert audit_logs[0].action == AuditAction.STATE_TRANSITION
    assert audit_logs[0].from_state == TicketState.DRAFT
    assert audit_logs[0].to_state == TicketState.SUBMITTED
    assert audit_logs[0].actor_id == requester.id

    assert audit_logs[1].from_state == TicketState.SUBMITTED
    assert audit_logs[1].to_state == TicketState.PENDING_APPROVAL
    assert audit_logs[1].actor_id == fin_agent.id

    assert audit_logs[2].action == AuditAction.APPROVED
    assert audit_logs[2].from_state == TicketState.PENDING_APPROVAL
    assert audit_logs[2].to_state == TicketState.APPROVED
    assert audit_logs[2].actor_id == fin_director.id


@pytest.mark.asyncio
async def test_workflow_engine_unauthorized_role_rejection(db_session: AsyncSession):
    # Requester attempting to approve a ticket directly should raise 403 Forbidden
    requester = (await db_session.execute(select(User).where(User.email == "requester@enterprise.local"))).scalars().first()
    fin_dept = (await db_session.execute(select(Department).where(Department.code == "FIN"))).scalars().first()

    ticket = Ticket(
        ticket_number="TCK-FIN-2026-0002",
        title="Unauthorized Self-Approval Attempt",
        description="Testing security gating",
        priority=TicketPriority.MEDIUM,
        current_state=TicketState.PENDING_APPROVAL,
        department_id=fin_dept.id,
        creator_id=requester.id,
    )
    db_session.add(ticket)
    await db_session.commit()
    await db_session.refresh(ticket)

    with pytest.raises(WorkflowEngineException) as exc_info:
        await WorkflowEngine.execute_transition(
            db=db_session,
            ticket_id=ticket.id,
            target_state=TicketState.APPROVED,
            actor=requester,
        )
    assert exc_info.value.status_code == 403
