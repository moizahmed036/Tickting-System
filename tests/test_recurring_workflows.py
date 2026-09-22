from datetime import datetime, timedelta, timezone
import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.scheduler import BackgroundScheduler
from app.models.department import Department
from app.models.recurring import RecurringWorkflow
from app.models.ticket import Ticket, TicketPriority, TicketState
from app.models.user import User


@pytest.mark.asyncio
async def test_recurring_workflow_scheduler_execution(db_session: AsyncSession):
    user = (await db_session.execute(select(User).where(User.email == "admin@enterprise.local"))).scalars().first()
    dept = (await db_session.execute(select(Department).where(Department.code == "IT"))).scalars().first()

    now = datetime.now(timezone.utc)
    # Recurring workflow with next_run_at in the past
    past_due = now - timedelta(minutes=5)

    wf = RecurringWorkflow(
        title="Weekly Automated SSL Certificate Check",
        description="Verify expiry of wildcard *.enterprise.local domain certificates.",
        department_id=dept.id,
        cron_expression="0 0 * * 1",  # Every Monday at midnight
        priority=TicketPriority.HIGH,
        metadata_template={"automated": True, "check_type": "SSL_EXPIRY"},
        creator_id=user.id,
        is_active=True,
        next_run_at=past_due,
    )
    db_session.add(wf)
    await db_session.commit()
    await db_session.refresh(wf)

    # Trigger scheduler task runner
    created_tickets = await BackgroundScheduler.process_recurring_workflows(db_session)
    assert len(created_tickets) >= 1

    # Verify newly created ticket
    created_t = next(t for t in created_tickets if "[Scheduled] Weekly Automated SSL Certificate Check" in t.title)
    assert created_t.current_state == TicketState.SUBMITTED
    assert created_t.priority == TicketPriority.HIGH
    assert created_t.metadata_payload.get("automated") is True
    assert created_t.due_date is not None

    # Verify workflow next_run_at advanced into the future
    await db_session.refresh(wf)
    assert wf.last_run_at is not None
    next_run = wf.next_run_at.replace(tzinfo=timezone.utc) if wf.next_run_at.tzinfo is None else wf.next_run_at
    assert next_run > now


@pytest.mark.asyncio
async def test_recurring_workflow_api_crud_and_manual_trigger(async_client: AsyncClient):
    # 1. Login
    login_res = await async_client.post(
        "/api/v1/auth/login",
        json={"email": "admin@enterprise.local", "password": "AdminPassword123!"},
    )
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Get Department ID
    dept_res = await async_client.get("/api/v1/workflows/departments", headers=headers)
    fin_dept = next(d for d in dept_res.json() if d["code"] == "FIN")

    # 3. Create Recurring Workflow
    create_res = await async_client.post(
        "/api/v1/recurring/",
        json={
            "title": "Monthly Payroll Tax Filing",
            "description": "Prepare and submit payroll withholding taxes.",
            "department_id": fin_dept["id"],
            "cron_expression": "0 9 15 * *",
            "priority": "HIGH",
            "metadata_template": {"tax_type": "Payroll Withholding"},
        },
        headers=headers,
    )
    assert create_res.status_code == 201
    wf_data = create_res.json()
    wf_id = wf_data["id"]
    assert wf_data["title"] == "Monthly Payroll Tax Filing"
    assert wf_data["next_run_at"] is not None

    # 4. Trigger Immediate Manual Run
    trigger_res = await async_client.post(f"/api/v1/recurring/{wf_id}/trigger", headers=headers)
    assert trigger_res.status_code == 200
    ticket_data = trigger_res.json()
    assert "[Manual Trigger] Monthly Payroll Tax Filing" in ticket_data["title"]
    assert ticket_data["current_state"] == "SUBMITTED"
