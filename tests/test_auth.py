import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_admin_login_success(async_client: AsyncClient):
    response = await async_client.post(
        "/api/v1/auth/login",
        json={"email": "admin@enterprise.local", "password": "AdminPassword123!"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == "admin@enterprise.local"
    assert data["user"]["role"] == "ADMIN"


@pytest.mark.asyncio
async def test_login_invalid_password(async_client: AsyncClient):
    response = await async_client.post(
        "/api/v1/auth/login",
        json={"email": "admin@enterprise.local", "password": "WrongPassword!"},
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_user_registration(async_client: AsyncClient):
    response = await async_client.post(
        "/api/v1/auth/register",
        json={
            "email": "new.employee@enterprise.local",
            "password": "SecurePassword123!",
            "full_name": "New Employee",
            "role": "REQUESTER",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == "new.employee@enterprise.local"
    assert data["role"] == "REQUESTER"
    assert data["is_active"] is True


@pytest.mark.asyncio
async def test_get_current_user_profile(async_client: AsyncClient):
    # 1. Login
    login_res = await async_client.post(
        "/api/v1/auth/login",
        json={"email": "requester@enterprise.local", "password": "RequesterPass123!"},
    )
    token = login_res.json()["access_token"]

    # 2. Get profile
    me_res = await async_client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert me_res.status_code == 200
    me_data = me_res.json()
    assert me_data["email"] == "requester@enterprise.local"
    assert me_data["role"] == "REQUESTER"
