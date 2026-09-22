from datetime import datetime, timezone
from typing import List, Optional
from croniter import croniter
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_active_user, get_db, require_admin
from app.models.department import Department
from app.models.recurring import RecurringWorkflow
from app.models.ticket import Ticket, TicketState
from app.models.user import User
from app.schemas.recurring import (
    RecurringWorkflowCreate,
    RecurringWorkflowResponse,
    RecurringWorkflowUpdate,
)
from app.schemas.ticket import TicketResponse
from app.services.sla_service import sla_service
from app.services.workflow_engine import workflow_engine

router = APIRouter()


@router.get("/", response_model=List[RecurringWorkflowResponse], summary="List recurring workflow schedules")
async def list_recurring_workflows(
    department_id: Optional[int] = Query(None, description="Filter by department"),
    is_active: Optional[bool] = Query(None, description="Filter active/inactive schedules"),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> List[RecurringWorkflowResponse]:
    """
    Retrieve all configured recurring workflow templates.
    """
    stmt = (
        select(RecurringWorkflow)
        .options(
            selectinload(RecurringWorkflow.department),
            selectinload(RecurringWorkflow.creator),
        )
    )
    if department_id is not None:
        stmt = stmt.where(RecurringWorkflow.department_id == department_id)
    if is_active is not None:
        stmt = stmt.where(RecurringWorkflow.is_active == is_active)

    stmt = stmt.order_by(RecurringWorkflow.created_at.desc())
    result = await db.execute(stmt)
    workflows = result.scalars().all()
    return [RecurringWorkflowResponse.model_validate(w) for w in workflows]


@router.post("/", response_model=RecurringWorkflowResponse, status_code=status.HTTP_201_CREATED, summary="Create a recurring workflow schedule")
async def create_recurring_workflow(
    wf_in: RecurringWorkflowCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> RecurringWorkflowResponse:
    """
    Register a new scheduled recurring workflow template (e.g. Monthly audits).
    """
    # Verify department exists
    dept_stmt = select(Department).where(Department.id == wf_in.department_id)
    dept_res = await db.execute(dept_stmt)
    if not dept_res.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Department #{wf_in.department_id} not found",
        )

    # Validate cron expression
    now = datetime.now(timezone.utc)
    try:
        iter_cron = croniter(wf_in.cron_expression, now)
        next_run = iter_cron.get_next(datetime)
    except Exception as ex:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid cron expression '{wf_in.cron_expression}': {ex}",
        )

    wf = RecurringWorkflow(
        title=wf_in.title.strip(),
        description=wf_in.description.strip(),
        department_id=wf_in.department_id,
        cron_expression=wf_in.cron_expression.strip(),
        priority=wf_in.priority,
        metadata_template=wf_in.metadata_template or {},
        creator_id=current_user.id,
        is_active=wf_in.is_active,
        next_run_at=next_run,
        created_at=now,
        updated_at=now,
    )
    db.add(wf)
    await db.commit()

    # Re-fetch with relations
    stmt = (
        select(RecurringWorkflow)
        .where(RecurringWorkflow.id == wf.id)
        .options(
            selectinload(RecurringWorkflow.department),
            selectinload(RecurringWorkflow.creator),
        )
    )
    full_res = await db.execute(stmt)
    full_wf = full_res.scalars().first()
    return RecurringWorkflowResponse.model_validate(full_wf)


@router.get("/{id}", response_model=RecurringWorkflowResponse, summary="Get recurring workflow details")
async def get_recurring_workflow(
    id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> RecurringWorkflowResponse:
    stmt = (
        select(RecurringWorkflow)
        .where(RecurringWorkflow.id == id)
        .options(
            selectinload(RecurringWorkflow.department),
            selectinload(RecurringWorkflow.creator),
        )
    )
    result = await db.execute(stmt)
    wf = result.scalars().first()
    if not wf:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Recurring Workflow #{id} not found",
        )
    return RecurringWorkflowResponse.model_validate(wf)


@router.patch("/{id}", response_model=RecurringWorkflowResponse, summary="Update recurring workflow")
async def update_recurring_workflow(
    id: int,
    wf_in: RecurringWorkflowUpdate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> RecurringWorkflowResponse:
    stmt = select(RecurringWorkflow).where(RecurringWorkflow.id == id)
    result = await db.execute(stmt)
    wf = result.scalars().first()
    if not wf:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Recurring Workflow #{id} not found",
        )

    update_data = wf_in.model_dump(exclude_unset=True)

    if "cron_expression" in update_data and update_data["cron_expression"]:
        now = datetime.now(timezone.utc)
        try:
            iter_cron = croniter(update_data["cron_expression"], now)
            wf.next_run_at = iter_cron.get_next(datetime)
        except Exception as ex:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid cron expression: {ex}",
            )

    for field, value in update_data.items():
        setattr(wf, field, value)

    wf.updated_at = datetime.now(timezone.utc)
    db.add(wf)
    await db.commit()

    # Re-fetch with relations
    stmt_full = (
        select(RecurringWorkflow)
        .where(RecurringWorkflow.id == id)
        .options(
            selectinload(RecurringWorkflow.department),
            selectinload(RecurringWorkflow.creator),
        )
    )
    res_full = await db.execute(stmt_full)
    return RecurringWorkflowResponse.model_validate(res_full.scalars().first())


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete recurring workflow")
async def delete_recurring_workflow(
    id: int,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> None:
    stmt = select(RecurringWorkflow).where(RecurringWorkflow.id == id)
    result = await db.execute(stmt)
    wf = result.scalars().first()
    if not wf:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Recurring Workflow #{id} not found",
        )
    await db.delete(wf)
    await db.commit()


@router.post("/{id}/trigger", response_model=TicketResponse, summary="Manually trigger immediate execution")
async def trigger_recurring_workflow_now(
    id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> TicketResponse:
    """
    Instantly generate a ticket from this recurring workflow template on demand.
    """
    stmt = select(RecurringWorkflow).where(RecurringWorkflow.id == id)
    result = await db.execute(stmt)
    wf = result.scalars().first()
    if not wf:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Recurring Workflow #{id} not found",
        )

    dept_stmt = select(Department).where(Department.id == wf.department_id)
    dept_res = await db.execute(dept_stmt)
    dept = dept_res.scalars().first()
    dept_code = dept.code if dept else "GEN"

    now = datetime.now(timezone.utc)
    due_date = sla_service.calculate_due_date(wf.priority, now)
    tck_number = f"TCK-{dept_code.upper()}-{now.year}-MANUAL-{wf.id:03d}{now.strftime('%d%H%M')}"

    ticket = Ticket(
        ticket_number=tck_number,
        title=f"[Manual Trigger] {wf.title}",
        description=wf.description,
        priority=wf.priority,
        current_state=TicketState.SUBMITTED,
        department_id=wf.department_id,
        creator_id=current_user.id,
        assignee_id=None,
        metadata_payload=dict(wf.metadata_template or {}),
        due_date=due_date,
        is_escalated=False,
        created_at=now,
        updated_at=now,
    )
    db.add(ticket)
    await db.commit()

    full_t = await workflow_engine.get_ticket_with_relations(db, ticket.id)
    return TicketResponse.model_validate(full_t)
