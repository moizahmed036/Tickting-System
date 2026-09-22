import pytest
from httpx import AsyncClient


async def get_auth_token(client: AsyncClient, email: str, password: str) -> str:
    res = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    return res.json()["access_token"]


@pytest.mark.asyncio
async def test_full_ticket_lifecycle_api(async_client: AsyncClient):
    # 1. Obtain Tokens
    requester_token = await get_auth_token(async_client, "requester@enterprise.local", "RequesterPass123!")
    fin_agent_token = await get_auth_token(async_client, "fin.agent@enterprise.local", "AgentPass123!")
    fin_director_token = await get_auth_token(async_client, "fin.director@enterprise.local", "DirectorPass123!")

    # 2. Get Department ID for FIN
    depts_res = await async_client.get(
        "/api/v1/workflows/departments",
        headers={"Authorization": f"Bearer {requester_token}"},
    )
    assert depts_res.status_code == 200
    fin_dept = next(d for d in depts_res.json() if d["code"] == "FIN")
    fin_dept_id = fin_dept["id"]

    # 3. Create Ticket (Requester)
    create_res = await async_client.post(
        "/api/v1/tickets/",
        json={
            "title": "Purchase Server Hardware for Analytics Cluster",
            "description": "5x Dell PowerEdge servers for internal data platform.",
            "priority": "HIGH",
            "department_id": fin_dept_id,
            "metadata_payload": {"budget_amount": 25000, "project": "Analytics2026"},
        },
        headers={"Authorization": f"Bearer {requester_token}"},
    )
    assert create_res.status_code == 201
    ticket = create_res.json()
    ticket_id = ticket["id"]
    assert ticket["current_state"] == "DRAFT"
    assert "TCK-FIN-" in ticket["ticket_number"]

    # 4. Requester Submits Ticket (DRAFT -> SUBMITTED)
    sub_res = await async_client.post(
        f"/api/v1/tickets/{ticket_id}/transition",
        json={"target_state": "SUBMITTED", "comment": "Ready for initial triage"},
        headers={"Authorization": f"Bearer {requester_token}"},
    )
    assert sub_res.status_code == 200
    assert sub_res.json()["current_state"] == "SUBMITTED"

    # 5. Finance Agent moves to PENDING_APPROVAL
    triage_res = await async_client.post(
        f"/api/v1/tickets/{ticket_id}/transition",
        json={"target_state": "PENDING_APPROVAL", "comment": "Financial docs verified."},
        headers={"Authorization": f"Bearer {fin_agent_token}"},
    )
    assert triage_res.status_code == 200
    assert triage_res.json()["current_state"] == "PENDING_APPROVAL"

    # 6. Finance Director Approves (PENDING_APPROVAL -> APPROVED)
    appr_res = await async_client.post(
        f"/api/v1/tickets/{ticket_id}/transition",
        json={"target_state": "APPROVED", "comment": "Approved per budget committee signoff."},
        headers={"Authorization": f"Bearer {fin_director_token}"},
    )
    assert appr_res.status_code == 200
    assert appr_res.json()["current_state"] == "APPROVED"

    # 7. Finance Agent begins processing (APPROVED -> IN_PROGRESS)
    prog_res = await async_client.post(
        f"/api/v1/tickets/{ticket_id}/transition",
        json={"target_state": "IN_PROGRESS", "comment": "Purchase order PO-9982 generated."},
        headers={"Authorization": f"Bearer {fin_agent_token}"},
    )
    assert prog_res.status_code == 200
    assert prog_res.json()["current_state"] == "IN_PROGRESS"

    # 8. Finance Agent marks RESOLVED
    res_res = await async_client.post(
        f"/api/v1/tickets/{ticket_id}/transition",
        json={"target_state": "RESOLVED", "comment": "Hardware paid and delivered to datacenter."},
        headers={"Authorization": f"Bearer {fin_agent_token}"},
    )
    assert res_res.status_code == 200
    assert res_res.json()["current_state"] == "RESOLVED"
    assert res_res.json()["resolved_at"] is not None

    # 9. Requester Confirms and Closes Ticket (RESOLVED -> CLOSED)
    close_res = await async_client.post(
        f"/api/v1/tickets/{ticket_id}/transition",
        json={"target_state": "CLOSED", "comment": "Received servers. Closing ticket."},
        headers={"Authorization": f"Bearer {requester_token}"},
    )
    assert close_res.status_code == 200
    assert close_res.json()["current_state"] == "CLOSED"
    assert close_res.json()["closed_at"] is not None

    # 10. Audit Trail Verification
    audit_res = await async_client.get(
        f"/api/v1/tickets/{ticket_id}/audit-trail",
        headers={"Authorization": f"Bearer {requester_token}"},
    )
    assert audit_res.status_code == 200
    audit_trail = audit_res.json()
    # 1 CREATED event + 6 transition events = 7 audit entries
    assert len(audit_trail) == 7
    actions = [a["action"] for a in audit_trail]
    assert actions[0] == "CREATED"
    assert "APPROVED" in actions
    assert actions[-1] == "STATE_TRANSITION"


@pytest.mark.asyncio
async def test_ticket_filtering_and_queues(async_client: AsyncClient):
    admin_token = await get_auth_token(async_client, "admin@enterprise.local", "AdminPassword123!")

    # Query all tickets
    list_res = await async_client.get(
        "/api/v1/tickets/?page=1&limit=10",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert list_res.status_code == 200
    data = list_res.json()
    assert "total" in data
    assert "items" in data
    assert isinstance(data["items"], list)


@pytest.mark.asyncio
async def test_strict_department_isolation_and_rbac(async_client: AsyncClient):
    """
    Test strict department isolation:
    1. IT agent cannot query Finance queue (403 Forbidden).
    2. IT agent cannot fetch Finance ticket details (403 Forbidden).
    3. IT agent cannot fetch Finance audit trail or transitions (403 Forbidden).
    4. Requester cannot view tickets created by another user (403 Forbidden).
    5. Admin has universal visibility across all queues (200 OK).
    """
    # 1. Tokens
    admin_token = await get_auth_token(async_client, "admin@enterprise.local", "AdminPassword123!")
    it_agent_token = await get_auth_token(async_client, "it.agent@enterprise.local", "AgentPass123!")
    fin_agent_token = await get_auth_token(async_client, "fin.agent@enterprise.local", "AgentPass123!")
    requester_token = await get_auth_token(async_client, "requester@enterprise.local", "RequesterPass123!")

    # 2. Get Department IDs
    depts_res = await async_client.get(
        "/api/v1/workflows/departments",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert depts_res.status_code == 200
    depts = depts_res.json()
    fin_dept = next(d for d in depts if d["code"] == "FIN")
    it_dept = next(d for d in depts if d["code"] == "IT")

    # 3. Create a Finance Ticket (created by Finance agent)
    fin_create = await async_client.post(
        "/api/v1/tickets/",
        json={
            "title": "Confidential Q3 Payroll Audit Discrepancy",
            "description": "Restricted financial document verification.",
            "priority": "HIGH",
            "department_id": fin_dept["id"],
        },
        headers={"Authorization": f"Bearer {fin_agent_token}"},
    )
    assert fin_create.status_code == 201
    fin_ticket = fin_create.json()
    fin_ticket_id = fin_ticket["id"]

    # 4. IT agent attempts to query Finance department queue -> 403 Forbidden
    it_query_fin = await async_client.get(
        f"/api/v1/tickets/?department_id={fin_dept['id']}",
        headers={"Authorization": f"Bearer {it_agent_token}"},
    )
    assert it_query_fin.status_code == 403
    assert "Access denied" in it_query_fin.json()["detail"]

    # 5. IT agent attempts to get Finance ticket directly -> 403 Forbidden
    it_get_ticket = await async_client.get(
        f"/api/v1/tickets/{fin_ticket_id}",
        headers={"Authorization": f"Bearer {it_agent_token}"},
    )
    assert it_get_ticket.status_code == 403
    assert "Access denied" in it_get_ticket.json()["detail"]

    # 6. IT agent attempts to view audit trail -> 403 Forbidden
    it_get_audit = await async_client.get(
        f"/api/v1/tickets/{fin_ticket_id}/audit-trail",
        headers={"Authorization": f"Bearer {it_agent_token}"},
    )
    assert it_get_audit.status_code == 403

    # 7. IT agent attempts to inspect transitions -> 403 Forbidden
    it_get_transitions = await async_client.get(
        f"/api/v1/tickets/{fin_ticket_id}/next-transitions",
        headers={"Authorization": f"Bearer {it_agent_token}"},
    )
    assert it_get_transitions.status_code == 403

    # 8. Unrelated Requester attempts to view Finance ticket -> 403 Forbidden
    req_get_ticket = await async_client.get(
        f"/api/v1/tickets/{fin_ticket_id}",
        headers={"Authorization": f"Bearer {requester_token}"},
    )
    assert req_get_ticket.status_code == 403

    # 9. Admin queries Finance queue and ticket -> 200 OK
    admin_query_fin = await async_client.get(
        f"/api/v1/tickets/?department_id={fin_dept['id']}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert admin_query_fin.status_code == 200

    admin_get_ticket = await async_client.get(
        f"/api/v1/tickets/{fin_ticket_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert admin_get_ticket.status_code == 200
    assert admin_get_ticket.json()["id"] == fin_ticket_id


@pytest.mark.asyncio
async def test_internal_notes_and_comments_visibility(async_client: AsyncClient):
    requester_token = await get_auth_token(async_client, "requester@enterprise.local", "RequesterPass123!")
    fin_agent_token = await get_auth_token(async_client, "fin.agent@enterprise.local", "AgentPass123!")
    admin_token = await get_auth_token(async_client, "admin@enterprise.local", "AdminPassword123!")

    # 1. Get FIN department
    depts_res = await async_client.get(
        "/api/v1/workflows/departments",
        headers={"Authorization": f"Bearer {requester_token}"},
    )
    fin_dept = next(d for d in depts_res.json() if d["code"] == "FIN")

    # 2. Requester creates ticket
    create_res = await async_client.post(
        "/api/v1/tickets/",
        json={
            "title": "Expense Reimbursement Travel",
            "description": "Travel receipts attached.",
            "priority": "MEDIUM",
            "department_id": fin_dept["id"],
        },
        headers={"Authorization": f"Bearer {requester_token}"},
    )
    assert create_res.status_code == 201
    ticket_id = create_res.json()["id"]

    # 3. Requester posts public comment -> 200 OK
    pub_res = await async_client.post(
        f"/api/v1/tickets/{ticket_id}/comments",
        json={"comment": "Please expedite this expense reimbursement.", "is_internal": False},
        headers={"Authorization": f"Bearer {requester_token}"},
    )
    assert pub_res.status_code == 200
    assert pub_res.json()["is_internal"] is False

    # 4. Requester attempts to post internal staff note -> 403 Forbidden
    forbid_res = await async_client.post(
        f"/api/v1/tickets/{ticket_id}/comments",
        json={"comment": "I am trying to write internal note", "is_internal": True},
        headers={"Authorization": f"Bearer {requester_token}"},
    )
    assert forbid_res.status_code == 403

    # 5. Finance Agent posts internal staff note -> 200 OK
    int_res = await async_client.post(
        f"/api/v1/tickets/{ticket_id}/comments",
        json={"comment": "Internal audit check: invoice amount exceeds standard threshold.", "is_internal": True},
        headers={"Authorization": f"Bearer {fin_agent_token}"},
    )
    assert int_res.status_code == 200
    assert int_res.json()["is_internal"] is True

    # 6. Finance Agent views audit trail -> sees internal note
    agent_trail = await async_client.get(
        f"/api/v1/tickets/{ticket_id}/audit-trail",
        headers={"Authorization": f"Bearer {fin_agent_token}"},
    )
    assert agent_trail.status_code == 200
    agent_logs = agent_trail.json()
    assert any(log["is_internal"] is True for log in agent_logs)

    # 7. Requester views audit trail -> internal note is filtered out!
    req_trail = await async_client.get(
        f"/api/v1/tickets/{ticket_id}/audit-trail",
        headers={"Authorization": f"Bearer {requester_token}"},
    )
    assert req_trail.status_code == 200
    req_logs = req_trail.json()
    assert all(log["is_internal"] is False for log in req_logs)
    assert any(log["comment"] == "Please expedite this expense reimbursement." for log in req_logs)
    assert not any(log["comment"] == "Internal audit check: invoice amount exceeds standard threshold." for log in req_logs)


