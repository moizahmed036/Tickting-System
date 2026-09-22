import pytest
from httpx import AsyncClient
from app.models.ticket import TicketPriority
from app.services.ai_triage import ai_triage_service


@pytest.mark.asyncio
async def test_ai_triage_it_critical_outage():
    res = ai_triage_service.classify_ticket(
        title="Production PostgreSQL Database Cluster Crash",
        description="The main RDS cluster is unresponsive. All API gateways are returning 502 errors and user traffic is completely blocked.",
    )
    assert res.suggested_department_code == "IT"
    assert res.suggested_priority == TicketPriority.CRITICAL
    assert "database" in res.extracted_tags
    assert res.confidence_score >= 0.70
    assert "Incident Response Team" in res.suggested_first_response


@pytest.mark.asyncio
async def test_ai_triage_finance_invoice_reimbursement():
    res = ai_triage_service.classify_ticket(
        title="Vendor Invoice Payment Approval for Cloud Hosting",
        description="Please process reimbursement for AWS infrastructure invoice totaling $25,000 for Q1 usage.",
    )
    assert res.suggested_department_code == "FIN"
    assert res.suggested_priority in (TicketPriority.HIGH, TicketPriority.MEDIUM)
    assert "budget" in res.extracted_tags or "payroll" in res.extracted_tags or len(res.extracted_tags) > 0
    assert res.key_entities.get("extracted_amount") == 25000


@pytest.mark.asyncio
async def test_ai_triage_hr_recruitment():
    res = ai_triage_service.classify_ticket(
        title="Job Opening: Senior Fullstack Engineer (Recruitment)",
        description="We need to open recruitment candidate sourcing and schedule technical interviews for 2 new headcount additions.",
    )
    assert res.suggested_department_code == "HR"
    assert "recruitment" in res.extracted_tags or "candidate" in res.extracted_tags or "headcount" in res.extracted_tags


@pytest.mark.asyncio
async def test_ai_triage_api_endpoint(async_client: AsyncClient):
    login_res = await async_client.post(
        "/api/v1/auth/login",
        json={"email": "requester@enterprise.local", "password": "RequesterPass123!"},
    )
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    response = await async_client.post(
        "/api/v1/ai/smart-classify",
        json={
            "title": "VPN Access and Laptop Hardware Issue",
            "description": "Cannot connect to the corporate VPN from home and laptop screen is flickering.",
        },
        headers=headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["suggested_department_code"] == "IT"
    assert "vpn" in data["extracted_tags"] or "hardware" in data["extracted_tags"]
    assert data["confidence_score"] > 0
