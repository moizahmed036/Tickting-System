import pytest
from httpx import AsyncClient


async def get_auth_token(client: AsyncClient, email: str, password: str) -> str:
    res = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    return res.json()["access_token"]


@pytest.mark.asyncio
async def test_api_key_management_and_auth_flow(async_client: AsyncClient):
    admin_token = await get_auth_token(async_client, "admin@enterprise.local", "AdminPassword123!")

    # 1. Admin generates new universal API key
    create_key_res = await async_client.post(
        "/api/v1/admin/api-keys",
        json={"name": "Salesforce Integration Bot", "department_id": None},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert create_key_res.status_code == 201
    key_data = create_key_res.json()
    assert "raw_secret_key" in key_data
    raw_key = key_data["raw_secret_key"]
    key_id = key_data["api_key"]["id"]
    assert raw_key.startswith("nxf_live_")

    # 2. List API keys
    list_keys_res = await async_client.get(
        "/api/v1/admin/api-keys",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert list_keys_res.status_code == 200
    all_keys = list_keys_res.json()["items"]
    assert any(k["id"] == key_id for k in all_keys)

    # 3. Test invalid API Key rejection (401)
    bad_req = await async_client.post(
        "/api/v1/integrations/tickets",
        json={
            "sender_email": "customer@acme.com",
            "title": "API Key Rejection Test",
            "description": "Should fail with 401",
        },
        headers={"X-API-Key": "nxf_live_invalid_secret_token_12345"},
    )
    assert bad_req.status_code == 401

    # 4. Test missing API Key header rejection (401)
    no_key_req = await async_client.post(
        "/api/v1/integrations/tickets",
        json={
            "sender_email": "customer@acme.com",
            "title": "Missing Header Test",
            "description": "Should fail with 401",
        },
    )
    assert no_key_req.status_code == 401

    # 5. Revoke API Key
    del_res = await async_client.delete(
        f"/api/v1/admin/api-keys/{key_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert del_res.status_code == 200

    # 6. Verify revoked key is now rejected (401)
    revoked_req = await async_client.post(
        "/api/v1/integrations/tickets",
        json={
            "sender_email": "customer@acme.com",
            "title": "Revoked Key Test",
            "description": "Should fail with 401",
        },
        headers={"X-API-Key": raw_key},
    )
    assert revoked_req.status_code == 401


@pytest.mark.asyncio
async def test_third_party_ticket_creation_and_ai_fallback(async_client: AsyncClient):
    admin_token = await get_auth_token(async_client, "admin@enterprise.local", "AdminPassword123!")

    # 1. Create Universal API Key
    create_key_res = await async_client.post(
        "/api/v1/admin/api-keys",
        json={"name": "Universal Monitoring Gateway", "department_id": None},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert create_key_res.status_code == 201
    raw_key = create_key_res.json()["raw_secret_key"]

    # 2. Ingest Ticket with explicit department & priority
    ticket_res = await async_client.post(
        "/api/v1/integrations/tickets",
        json={
            "sender_email": "devops.lead@external-partner.com",
            "sender_name": "DevOps Partner",
            "title": "Production Redis Cache Eviction Spike",
            "description": "Eviction count exceeded 50,000/sec on cluster node 3.",
            "department_code": "IT",
            "priority": "CRITICAL",
            "metadata": {"cluster_id": "redis-prod-03", "memory_usage": "98%"},
            "source_system": "DATADOG_ALERTS",
        },
        headers={"X-API-Key": raw_key},
    )
    assert ticket_res.status_code == 201
    t_data = ticket_res.json()
    assert t_data["department_code"] == "IT"
    assert t_data["priority"] == "CRITICAL"
    assert t_data["current_state"] == "SUBMITTED"
    assert t_data["ticket_number"].startswith("TCK-IT-")

    # 3. Ingest Ticket with omitted department & priority (verify AI triage fallback)
    ai_ticket_res = await async_client.post(
        "/api/v1/integrations/tickets",
        json={
            "sender_email": "billing@external-client.com",
            "title": "Vendor invoice #9948 payment reconciliation required",
            "description": "Please disburse payment of $12,450 for Q3 cloud hosting license.",
        },
        headers={"X-API-Key": raw_key},
    )
    assert ai_ticket_res.status_code == 201
    ai_data = ai_ticket_res.json()
    assert ai_data["department_code"] in ["FIN", "PROC", "IT"]
    assert ai_data["current_state"] == "SUBMITTED"


@pytest.mark.asyncio
async def test_department_locked_api_key_enforcement(async_client: AsyncClient):
    admin_token = await get_auth_token(async_client, "admin@enterprise.local", "AdminPassword123!")

    # 1. Fetch IT department ID
    depts_res = await async_client.get(
        "/api/v1/workflows/departments",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    it_dept = next(d for d in depts_res.json() if d["code"] == "IT")

    # 2. Create IT-locked API key
    it_key_res = await async_client.post(
        "/api/v1/admin/api-keys",
        json={"name": "IT Jira Gateway", "department_id": it_dept["id"]},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert it_key_res.status_code == 201
    it_raw_key = it_key_res.json()["raw_secret_key"]

    # 3. Create ticket targeted at IT -> 201 OK
    it_ticket_res = await async_client.post(
        "/api/v1/integrations/tickets",
        json={
            "sender_email": "employee@enterprise.local",
            "title": "VPN Profile Refresh",
            "description": "Reset VPN certificates for remote worker.",
            "department_code": "IT",
        },
        headers={"X-API-Key": it_raw_key},
    )
    assert it_ticket_res.status_code == 201

    # 4. Attempt to create ticket targeted at Finance with IT-locked key -> 403 Forbidden
    forbidden_res = await async_client.post(
        "/api/v1/integrations/tickets",
        json={
            "sender_email": "employee@enterprise.local",
            "title": "Travel Reimbursement Claim",
            "description": "Submit travel receipts to finance.",
            "department_code": "FIN",
        },
        headers={"X-API-Key": it_raw_key},
    )
    assert forbidden_res.status_code == 403
    assert "restricted to department 'IT'" in forbidden_res.json()["detail"]


@pytest.mark.asyncio
async def test_external_email_bot_ingestion(async_client: AsyncClient):
    admin_token = await get_auth_token(async_client, "admin@enterprise.local", "AdminPassword123!")

    # 1. Create API key for email scraper
    key_res = await async_client.post(
        "/api/v1/admin/api-keys",
        json={"name": "Zapier Mail Ingestion Bot", "department_id": None},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    raw_key = key_res.json()["raw_secret_key"]

    # 2. Inbound email with no existing ticket -> Converts to NEW_TICKET
    new_email_res = await async_client.post(
        "/api/v1/integrations/email-ingest",
        json={
            "from_email": "sarah.connor@external.org",
            "from_name": "Sarah Connor",
            "to_email": "support@enterprise.local",
            "subject": "Urgent payroll tax withholding inquiry",
            "body_text": "I noticed an incorrect withholding code on my latest payslip. Please review.",
            "message_id": "<msg-unique-001@external.org>",
        },
        headers={"X-API-Key": raw_key},
    )
    assert new_email_res.status_code == 200
    email_data = new_email_res.json()
    assert email_data["status"] == "CONVERTED"
    assert email_data["action"] == "NEW_TICKET_CREATED"
    generated_ticket_number = email_data["ticket_number"]
    ticket_id = email_data["ticket_id"]

    # 3. Inbound reply referencing ticket number in subject -> Threads as COMMENT_ADDED
    reply_email_res = await async_client.post(
        "/api/v1/integrations/email-ingest",
        json={
            "from_email": "sarah.connor@external.org",
            "from_name": "Sarah Connor",
            "to_email": "support@enterprise.local",
            "subject": f"Re: {generated_ticket_number} - Attached proof of W-4 form",
            "body_text": "Here is the updated W-4 document for verification.",
            "message_id": "<msg-unique-002@external.org>",
        },
        headers={"X-API-Key": raw_key},
    )
    assert reply_email_res.status_code == 200
    reply_data = reply_email_res.json()
    assert reply_data["status"] == "THREADED"
    assert reply_data["action"] == "COMMENT_ADDED"
    assert reply_data["ticket_id"] == ticket_id
