import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User, UserRole


async def get_auth_token(client: AsyncClient, email: str, password: str) -> str:
    res = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    return res.json()["access_token"]


@pytest.mark.asyncio
async def test_admin_endpoints_non_admin_forbidden(async_client: AsyncClient):
    """Verify that non-admin roles (Requester, Assignee, Authorizer) are rejected with 403."""
    requester_token = await get_auth_token(async_client, "requester@enterprise.local", "RequesterPass123!")
    fin_agent_token = await get_auth_token(async_client, "fin.agent@enterprise.local", "AgentPass123!")

    # 1. Requester cannot list admin users
    req_res = await async_client.get(
        "/api/v1/admin/users",
        headers={"Authorization": f"Bearer {requester_token}"},
    )
    assert req_res.status_code == 403

    # 2. Agent cannot create user via admin endpoint
    agent_create = await async_client.post(
        "/api/v1/admin/users",
        json={
            "email": "rogue@enterprise.local",
            "full_name": "Rogue Agent",
            "password": "RoguePassword123!",
            "role": "ADMIN",
        },
        headers={"Authorization": f"Bearer {fin_agent_token}"},
    )
    assert agent_create.status_code == 403

    # 3. Agent cannot modify user via admin endpoint
    agent_patch = await async_client.patch(
        "/api/v1/admin/users/1",
        json={"role": "ADMIN"},
        headers={"Authorization": f"Bearer {fin_agent_token}"},
    )
    assert agent_patch.status_code == 403


@pytest.mark.asyncio
async def test_admin_user_crud_and_overrides(async_client: AsyncClient, db_session: AsyncSession):
    """Verify complete Super Admin user lifecycle management."""
    admin_token = await get_auth_token(async_client, "admin@enterprise.local", "AdminPassword123!")

    # 1. Get Departments to obtain valid department ID
    depts_res = await async_client.get(
        "/api/v1/workflows/departments",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert depts_res.status_code == 200
    it_dept = next(d for d in depts_res.json() if d["code"] == "IT")
    hr_dept = next(d for d in depts_res.json() if d["code"] == "HR")

    # 2. Admin creates a new user
    new_user_email = "marcus.vance@enterprise.local"
    create_res = await async_client.post(
        "/api/v1/admin/users",
        json={
            "email": new_user_email,
            "full_name": "Marcus Vance",
            "password": "MarcusPass123!Secure",
            "role": "ASSIGNEE",
            "department_id": it_dept["id"],
            "is_active": True,
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert create_res.status_code == 201
    created_user = create_res.json()
    user_id = created_user["id"]
    assert created_user["email"] == new_user_email
    assert created_user["role"] == "ASSIGNEE"
    assert created_user["department_id"] == it_dept["id"]
    assert created_user["is_active"] is True

    # 3. Admin lists users with search
    list_res = await async_client.get(
        f"/api/v1/admin/users?search=Marcus&page=1&limit=10",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert list_res.status_code == 200
    list_data = list_res.json()
    assert list_data["total"] >= 1
    assert any(u["id"] == user_id for u in list_data["items"])

    # 4. Admin updates user role to AUTHORIZER and transfers to HR
    patch_res = await async_client.patch(
        f"/api/v1/admin/users/{user_id}",
        json={
            "role": "AUTHORIZER",
            "department_id": hr_dept["id"],
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert patch_res.status_code == 200
    updated = patch_res.json()
    assert updated["role"] == "AUTHORIZER"
    assert updated["department_id"] == hr_dept["id"]

    # 5. Admin deactivates user
    deact_res = await async_client.patch(
        f"/api/v1/admin/users/{user_id}",
        json={"is_active": False},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert deact_res.status_code == 200
    assert deact_res.json()["is_active"] is False

    # 6. Verify deactivated user cannot login
    login_res = await async_client.post(
        "/api/v1/auth/login",
        json={"email": new_user_email, "password": "MarcusPass123!Secure"},
    )
    assert login_res.status_code == 401
