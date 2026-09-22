import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_active_user, get_db, require_admin
from app.core.security import get_password_hash
from app.models.department import Department
from app.models.user import User, UserRole
from app.schemas.auth import (
    AdminUserListResponse,
    UserCreate,
    UserResponse,
    UserUpdate,
)
from app.services.auth_service import auth_service

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get(
    "/users",
    response_model=AdminUserListResponse,
    summary="List all users with pagination and filtering (Admin only)",
)
async def admin_list_users(
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=100, description="Items per page"),
    department_id: Optional[int] = Query(None, description="Filter by department ID"),
    role: Optional[UserRole] = Query(None, description="Filter by user role"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    search: Optional[str] = Query(None, description="Search by name or email"),
    current_admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> AdminUserListResponse:
    """
    Super Admin endpoint to list enterprise users with full pagination,
    department filtering, role filtering, and search.
    """
    stmt = select(User)

    if department_id is not None:
        stmt = stmt.where(User.department_id == department_id)
    if role is not None:
        stmt = stmt.where(User.role == role)
    if is_active is not None:
        stmt = stmt.where(User.is_active == is_active)
    if search:
        search_pattern = f"%{search.strip()}%"
        stmt = stmt.where(
            or_(
                User.full_name.ilike(search_pattern),
                User.email.ilike(search_pattern),
            )
        )

    # Total count
    count_stmt = select(func.count()).select_from(stmt.subquery())
    total_res = await db.execute(count_stmt)
    total = total_res.scalar() or 0

    # Pagination
    offset = (page - 1) * limit
    stmt = stmt.order_by(User.id.asc()).offset(offset).limit(limit)
    result = await db.execute(stmt)
    users = result.scalars().all()

    return AdminUserListResponse(
        total=total,
        items=[UserResponse.model_validate(u) for u in users],
        page=page,
        limit=limit,
    )


@router.post(
    "/users",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create user with explicit role and department assignment (Admin only)",
)
async def admin_create_user(
    user_in: UserCreate,
    current_admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    """
    Super Admin endpoint to create a new enterprise user with assigned role and department.
    """
    existing_user = await auth_service.get_by_email(db, email=user_in.email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"User with email '{user_in.email}' already exists",
        )

    if user_in.department_id is not None:
        dept_stmt = select(Department).where(Department.id == user_in.department_id)
        dept_res = await db.execute(dept_stmt)
        department = dept_res.scalars().first()
        if not department:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Department with ID {user_in.department_id} not found",
            )

    user = await auth_service.create(db, user_in=user_in)
    logger.info(f"[ADMIN] Admin {current_admin.email} created user {user.email} (Role: {user.role.value}, Dept: {user.department_id})")
    return UserResponse.model_validate(user)


@router.patch(
    "/users/{user_id}",
    response_model=UserResponse,
    summary="Update user role, department, active status or profile (Admin only)",
)
async def admin_update_user(
    user_id: int,
    user_in: UserUpdate,
    current_admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    """
    Super Admin endpoint to update any user's role, department assignment,
    active/inactive status, full name, or password.
    """
    user = await auth_service.get_by_id(db, user_id=user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with ID {user_id} not found",
        )

    if user_in.email is not None and user_in.email != user.email:
        existing = await auth_service.get_by_email(db, email=user_in.email)
        if existing and existing.id != user.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Email '{user_in.email}' is already in use by another account",
            )

    if user_in.department_id is not None:
        dept_stmt = select(Department).where(Department.id == user_in.department_id)
        dept_res = await db.execute(dept_stmt)
        department = dept_res.scalars().first()
        if not department:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Department with ID {user_in.department_id} not found",
            )

    updated_user = await auth_service.update(db, user=user, user_in=user_in)
    logger.info(f"[ADMIN] Admin {current_admin.email} updated user {user.id} (Email: {updated_user.email}, Role: {updated_user.role.value}, Dept: {updated_user.department_id}, Active: {updated_user.is_active})")
    return UserResponse.model_validate(updated_user)
