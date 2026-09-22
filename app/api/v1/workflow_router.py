from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_active_user, get_db, require_admin
from app.models.department import Department
from app.models.user import User
from app.models.workflow import WorkflowStep
from app.schemas.workflow import (
    DepartmentCreate,
    DepartmentResponse,
    DepartmentUpdate,
    WorkflowStepCreate,
    WorkflowStepResponse,
    WorkflowStepUpdate,
)

router = APIRouter()


# ============================================================================
# Departments Endpoints
# ============================================================================

@router.get("/departments", response_model=List[DepartmentResponse], summary="List all departments")
async def list_departments(
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> List[DepartmentResponse]:
    """
    Retrieve all departments in the enterprise organization.
    """
    stmt = select(Department)
    if is_active is not None:
        stmt = stmt.where(Department.is_active == is_active)
    stmt = stmt.order_by(Department.name.asc())
    result = await db.execute(stmt)
    departments = result.scalars().all()
    return [DepartmentResponse.model_validate(d) for d in departments]


@router.post("/departments", response_model=DepartmentResponse, status_code=status.HTTP_201_CREATED, summary="Create a new department")
async def create_department(
    dept_in: DepartmentCreate,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> DepartmentResponse:
    """
    Register a new department (Admin only).
    """
    stmt = select(Department).where(Department.code == dept_in.code.upper().strip())
    existing = await db.execute(stmt)
    if existing.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Department with code '{dept_in.code}' already exists",
        )

    dept = Department(
        code=dept_in.code.upper().strip(),
        name=dept_in.name.strip(),
        description=dept_in.description,
        is_active=dept_in.is_active,
    )
    db.add(dept)
    await db.commit()
    await db.refresh(dept)
    return DepartmentResponse.model_validate(dept)


@router.get("/departments/{dept_id}", response_model=DepartmentResponse, summary="Get department details")
async def get_department(
    dept_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> DepartmentResponse:
    """
    Retrieve details of a specific department.
    """
    stmt = select(Department).where(Department.id == dept_id)
    result = await db.execute(stmt)
    dept = result.scalars().first()
    if not dept:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Department #{dept_id} not found",
        )
    return DepartmentResponse.model_validate(dept)


@router.patch("/departments/{dept_id}", response_model=DepartmentResponse, summary="Update department")
async def update_department(
    dept_id: int,
    dept_in: DepartmentUpdate,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> DepartmentResponse:
    """
    Update department metadata or toggle active state (Admin only).
    """
    stmt = select(Department).where(Department.id == dept_id)
    result = await db.execute(stmt)
    dept = result.scalars().first()
    if not dept:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Department #{dept_id} not found",
        )

    update_data = dept_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(dept, field, value)

    db.add(dept)
    await db.commit()
    await db.refresh(dept)
    return DepartmentResponse.model_validate(dept)


# ============================================================================
# Workflow Step Configuration Endpoints
# ============================================================================

@router.get("/steps", response_model=List[WorkflowStepResponse], summary="List workflow transition steps")
async def list_workflow_steps(
    department_id: Optional[int] = Query(None, description="Filter by department"),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> List[WorkflowStepResponse]:
    """
    Retrieve configured workflow steps and state transitions.
    """
    stmt = select(WorkflowStep)
    if department_id is not None:
        stmt = stmt.where(WorkflowStep.department_id == department_id)
    stmt = stmt.order_by(WorkflowStep.department_id.asc(), WorkflowStep.step_order.asc())
    result = await db.execute(stmt)
    steps = result.scalars().all()
    return [WorkflowStepResponse.model_validate(s) for s in steps]


@router.post("/steps", response_model=WorkflowStepResponse, status_code=status.HTTP_201_CREATED, summary="Create a workflow transition rule")
async def create_workflow_step(
    step_in: WorkflowStepCreate,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> WorkflowStepResponse:
    """
    Define a new transition rule in the state machine (Admin only).
    """
    # Verify department exists
    dept_stmt = select(Department).where(Department.id == step_in.department_id)
    dept_res = await db.execute(dept_stmt)
    if not dept_res.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Department #{step_in.department_id} not found",
        )

    step = WorkflowStep(
        department_id=step_in.department_id,
        name=step_in.name.strip(),
        from_state=step_in.from_state,
        to_state=step_in.to_state,
        required_role=step_in.required_role,
        step_order=step_in.step_order,
        condition_rules=step_in.condition_rules or {},
        is_active=step_in.is_active,
    )
    db.add(step)
    await db.commit()
    await db.refresh(step)
    return WorkflowStepResponse.model_validate(step)


@router.patch("/steps/{step_id}", response_model=WorkflowStepResponse, summary="Update a workflow step")
async def update_workflow_step(
    step_id: int,
    step_in: WorkflowStepUpdate,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> WorkflowStepResponse:
    """
    Update an existing workflow transition step (Admin only).
    """
    stmt = select(WorkflowStep).where(WorkflowStep.id == step_id)
    result = await db.execute(stmt)
    step = result.scalars().first()
    if not step:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Workflow Step #{step_id} not found",
        )

    update_data = step_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(step, field, value)

    db.add(step)
    await db.commit()
    await db.refresh(step)
    return WorkflowStepResponse.model_validate(step)


@router.delete("/steps/{step_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete a workflow step")
async def delete_workflow_step(
    step_id: int,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> None:
    """
    Remove a workflow step from the state machine (Admin only).
    """
    stmt = select(WorkflowStep).where(WorkflowStep.id == step_id)
    result = await db.execute(stmt)
    step = result.scalars().first()
    if not step:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Workflow Step #{step_id} not found",
        )
    await db.delete(step)
    await db.commit()
