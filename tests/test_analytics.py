import pytest
from httpx import AsyncClient


async def get_auth_token(client: AsyncClient, email: str, password: str) -> str:
    res = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    return res.json()["access_token"]


@pytest.mark.asyncio
async def test_analytics_overview_admin(async_client: AsyncClient):
    admin_token = await get_auth_token(async_client, "admin@enterprise.local", "AdminPassword123!")
    
    res = await async_client.get(
        "/api/v1/analytics/overview?days=30",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res.status_code == 200
    data = res.json()

    # Validate top-level metric structure
    assert "total_tickets" in data
    assert "active_backlog" in data
    assert "resolved_tickets" in data
    assert "sla_compliance_rate" in data
    assert "overall_mttr_hours" in data
    assert "escalation_rate" in data
    assert "status_distribution" in data
    assert "priority_distribution" in data
    assert "department_breakdown" in data
    assert "time_series" in data

    # Verify types
    assert isinstance(data["sla_compliance_rate"], (int, float))
    assert isinstance(data["overall_mttr_hours"], (int, float))
    assert isinstance(data["time_series"], list)
    assert len(data["time_series"]) == 30
    assert isinstance(data["department_breakdown"], list)


@pytest.mark.asyncio
async def test_analytics_overview_department_isolation(async_client: AsyncClient):
    # Agent token
    fin_agent_token = await get_auth_token(async_client, "fin.agent@enterprise.local", "AgentPass123!")

    res = await async_client.get(
        "/api/v1/analytics/overview?days=7",
        headers={"Authorization": f"Bearer {fin_agent_token}"},
    )
    assert res.status_code == 200
    data = res.json()
    assert "sla_compliance_rate" in data
    assert len(data["time_series"]) == 7
