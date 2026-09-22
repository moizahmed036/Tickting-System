import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit import AuditAction, TicketAuditLog
from app.models.ticket import Ticket, TicketState
from app.models.user import User, UserRole


@pytest.mark.asyncio
async def test_inbound_email_existing_user(async_client: AsyncClient, db_session: AsyncSession):
    """
    Test inbound email webhook ingestion from an already registered enterprise employee.
    Should route to IT department based on AI classification.
    """
    payload = {
        "sender": "requester@enterprise.local",
        "subject": "VPN Gateway Timeout and WiFi Connection Failure",
        "body_plain": "I cannot connect to the enterprise VPN and office WiFi is dropping packets continuously.",
        "sender_name": "Standard Requester",
    }

    response = await async_client.post("/api/v1/webhooks/inbound-email", json=payload)
    assert response.status_code == 201
    data = response.json()

    assert data["status"] == "PROCESSED"
    assert data["department_code"] == "IT"
    assert data["auto_provisioned_user"] is False
    assert data["ticket_number"].startswith("TCK-IT-")
    assert data["ai_confidence"] > 0

    # Verify ticket in database
    ticket_stmt = select(Ticket).where(Ticket.id == data["ticket_id"])
    ticket_res = await db_session.execute(ticket_stmt)
    ticket = ticket_res.scalars().first()
    assert ticket is not None
    assert ticket.current_state == TicketState.SUBMITTED
    assert ticket.due_date is not None
    assert ticket.metadata_payload.get("source") in ("EMAIL_INBOUND", "INBOUND_EMAIL")

    # Verify audit log
    audit_stmt = select(TicketAuditLog).where(TicketAuditLog.ticket_id == ticket.id)
    audit_res = await db_session.execute(audit_stmt)
    logs = audit_res.scalars().all()
    assert len(logs) >= 1
    assert logs[0].action == AuditAction.CREATED
    assert logs[0].to_state == TicketState.SUBMITTED


@pytest.mark.asyncio
async def test_inbound_email_auto_provision_new_user(async_client: AsyncClient, db_session: AsyncSession):
    """
    Test inbound email webhook ingestion from an unknown external sender.
    Should auto-provision an unverified REQUESTER user account and route to Finance.
    """
    sender_email = "sarah.connor@vendor-partners.com"
    payload = {
        "sender": sender_email,
        "subject": "Invoice Payment & Expense Reimbursement ($45,000)",
        "body_plain": "Please process the quarterly vendor payment invoice of $45,000 for infrastructure services.",
        "sender_name": "Sarah Connor",
    }

    response = await async_client.post("/api/v1/webhooks/inbound-email", json=payload)
    assert response.status_code == 201
    data = response.json()

    assert data["status"] == "PROCESSED"
    assert data["department_code"] == "FIN"
    assert data["auto_provisioned_user"] is True

    # Verify auto-provisioned user in DB
    user_stmt = select(User).where(User.email == sender_email)
    user_res = await db_session.execute(user_stmt)
    user = user_res.scalars().first()
    assert user is not None
    assert user.full_name == "Sarah Connor"
    assert user.role == UserRole.REQUESTER
    assert user.is_active is True


@pytest.mark.asyncio
async def test_inbound_email_validation_error(async_client: AsyncClient):
    """Test webhook rejection on invalid or empty email payload."""
    payload = {
        "sender": "not-a-valid-email",
        "subject": "",
    }
    response = await async_client.post("/api/v1/webhooks/inbound-email", json=payload)
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_inbound_email_threading_into_existing_ticket(async_client: AsyncClient, db_session: AsyncSession):
    """
    Test email reply threading:
    1. First email arrives and creates Ticket #1.
    2. Second email arrives referencing Ticket #1's ticket number in the subject line (e.g. 'Re: [TCK-IT-2026-0001] ...').
    3. Webhook detects existing ticket number, appends email body as a COMMENT_ADDED audit event,
       and does NOT create a duplicate ticket.
    """
    # 1. First Inbound Email creates initial ticket
    initial_payload = {
        "sender": "dave.engineer@enterprise.local",
        "subject": "Critical Server Rack Thermal Alert & Fan Malfunction",
        "body_plain": "Server rack #4 in datacenter B is reaching 85C. Cooling fans are not spinning.",
        "sender_name": "Dave Engineer",
    }
    res1 = await async_client.post("/api/v1/webhooks/inbound-email", json=initial_payload)
    assert res1.status_code == 201
    data1 = res1.json()
    assert data1["status"] == "PROCESSED"
    ticket_id = data1["ticket_id"]
    ticket_number = data1["ticket_number"]
    assert data1["department_code"] == "IT"

    # Verify initial audit log count
    audit1_stmt = select(TicketAuditLog).where(TicketAuditLog.ticket_id == ticket_id)
    audit1_res = await db_session.execute(audit1_stmt)
    logs1 = audit1_res.scalars().all()
    assert len(logs1) == 1
    assert logs1[0].action == AuditAction.CREATED

    # Verify IT tagging
    ticket_stmt = select(Ticket).where(Ticket.id == ticket_id)
    ticket_res = await db_session.execute(ticket_stmt)
    ticket_obj = ticket_res.scalars().first()
    assert "IT-Support" in ticket_obj.metadata_payload.get("tags", [])

    # Count total tickets before reply
    total_tickets_before_stmt = select(Ticket)
    tickets_before_res = await db_session.execute(total_tickets_before_stmt)
    total_before = len(tickets_before_res.scalars().all())

    # 2. Reply Email referencing ticket number in subject
    reply_payload = {
        "sender": "dave.engineer@enterprise.local",
        "subject": f"Re: [{ticket_number}] Critical Server Rack Thermal Alert & Fan Malfunction",
        "body_plain": "Facility engineers have inspected the HVAC unit. Replacement fans are on site.",
        "sender_name": "Dave Engineer",
    }
    res2 = await async_client.post("/api/v1/webhooks/inbound-email", json=reply_payload)
    assert res2.status_code == 201
    data2 = res2.json()

    # 3. Assert status is THREAD_UPDATED and ticket_id matches
    assert data2["status"] == "THREAD_UPDATED"
    assert data2["ticket_id"] == ticket_id
    assert data2["ticket_number"] == ticket_number
    assert "appended as comment" in data2["message"]

    # 4. Verify no new duplicate ticket was created
    tickets_after_res = await db_session.execute(select(Ticket))
    total_after = len(tickets_after_res.scalars().all())
    assert total_after == total_before

    # 5. Verify COMMENT_ADDED log appended to existing ticket
    audit2_res = await db_session.execute(
        select(TicketAuditLog)
        .where(TicketAuditLog.ticket_id == ticket_id)
        .order_by(TicketAuditLog.id.asc())
    )
    logs2 = audit2_res.scalars().all()
    assert len(logs2) == 2
    assert logs2[0].action == AuditAction.CREATED
    assert logs2[1].action == AuditAction.COMMENT_ADDED
    assert "Facility engineers have inspected the HVAC unit" in logs2[1].comment

