import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ticket import Ticket, TicketState
from app.services.email_reader_service import email_reader_service


@pytest.mark.asyncio
async def test_get_pending_actions(async_client: AsyncClient):
    """
    Test retrieving real-time AI classified actionable emails with priority counts.
    """
    # 1. Login
    login_res = await async_client.post(
        "/api/v1/auth/login",
        json={"email": "admin@enterprise.local", "password": "AdminPassword123!"},
    )
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Query Pending Actions
    response = await async_client.get("/api/v1/emails/pending-actions", headers=headers)
    assert response.status_code == 200
    data = response.json()

    assert "critical_count" in data
    assert "high_count" in data
    assert "medium_count" in data
    assert "normal_count" in data
    assert data["total_pending"] > 0
    assert len(data["items"]) == data["total_pending"]

    # Verify first item properties
    first_item = data["items"][0]
    assert first_item["is_action_required"] is True
    assert first_item["status"] == "PENDING"
    assert len(first_item["summary"]) > 0
    assert first_item["suggested_department"] in ("IT", "FIN", "HR", "SD", "PROC")


@pytest.mark.asyncio
async def test_convert_email_to_ticket(async_client: AsyncClient, db_session: AsyncSession):
    """
    Test 1-click converting a pending email into an official system Ticket.
    """
    # 1. Login
    login_res = await async_client.post(
        "/api/v1/auth/login",
        json={"email": "admin@enterprise.local", "password": "AdminPassword123!"},
    )
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Ingest a dedicated test email
    test_item = email_reader_service.sync_new_email(
        sender="engineer@partner.com",
        sender_name="Partner Engineer",
        subject="URGENT: Cloud Storage Bucket Permission Denied 403",
        body="Our microservices are receiving 403 Forbidden on S3 upload endpoint. Please fix IAM roles immediately.",
    )

    # 3. Convert to Ticket
    response = await async_client.post(
        f"/api/v1/emails/{test_item.id}/convert-to-ticket",
        headers=headers,
    )
    assert response.status_code == 201
    data = response.json()

    assert data["status"] == "CONVERTED"
    assert data["ticket_number"].startswith("TCK-")
    assert data["ticket_id"] > 0
    assert data["department_code"] == "IT"

    # 4. Verify in DB
    ticket_stmt = select(Ticket).where(Ticket.id == data["ticket_id"])
    ticket_res = await db_session.execute(ticket_stmt)
    ticket = ticket_res.scalars().first()
    assert ticket is not None
    assert ticket.current_state == TicketState.SUBMITTED
    assert ticket.title == test_item.subject
    assert ticket.metadata_payload.get("source") == "EMAIL_READER_WIDGET"


@pytest.mark.asyncio
async def test_mark_email_resolved(async_client: AsyncClient):
    """
    Test marking an actionable email task as resolved.
    """
    login_res = await async_client.post(
        "/api/v1/auth/login",
        json={"email": "admin@enterprise.local", "password": "AdminPassword123!"},
    )
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Ingest a test email
    test_item = email_reader_service.sync_new_email(
        sender="vendor@services.com",
        sender_name="Vendor Services",
        subject="Monthly Certificate Rotation Notice",
        body="Please confirm that the TLS certificates have been renewed for domain staging.enterprise.local.",
    )

    # Mark as resolved
    response = await async_client.post(
        f"/api/v1/emails/{test_item.id}/mark-resolved",
        headers=headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "RESOLVED"
    assert data["email_id"] == test_item.id

    # Verify not present in pending
    pending_res = await async_client.get("/api/v1/emails/pending-actions", headers=headers)
    pending_items = pending_res.json()["items"]
    assert all(item["id"] != test_item.id for item in pending_items)
