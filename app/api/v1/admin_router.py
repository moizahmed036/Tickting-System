import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_active_user, get_db, require_admin
from app.core.security import get_password_hash
from app.models.api_key import ApiKey
from app.models.department import Department
from app.models.user import User, UserRole
from app.schemas.api_key import (
    ApiKeyCreate,
    ApiKeyCreatedResponse,
    ApiKeyListResponse,
    ApiKeyRead,
)
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


# ==========================================
# Developer API Key Management
# ==========================================

@router.get(
    "/api-keys",
    response_model=ApiKeyListResponse,
    summary="List all developer API keys (Admin only)",
)
async def admin_list_api_keys(
    current_admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> ApiKeyListResponse:
    """
    List all active and historical developer API keys with masked prefixes and usage statistics.
    """
    stmt = (
        select(ApiKey)
        .options(selectinload(ApiKey.department), selectinload(ApiKey.created_by))
        .order_by(ApiKey.created_at.desc())
    )
    result = await db.execute(stmt)
    keys = result.scalars().all()

    items = []
    for k in keys:
        items.append(
            ApiKeyRead(
                id=k.id,
                name=k.name,
                key_prefix=k.key_prefix,
                department_id=k.department_id,
                department_code=k.department.code if k.department else None,
                department_name=k.department.name if k.department else "All Queues (Universal)",
                created_by_id=k.created_by_id,
                created_by_name=k.created_by.full_name if k.created_by else "Admin",
                is_active=k.is_active,
                last_used_at=k.last_used_at,
                created_at=k.created_at,
            )
        )

    return ApiKeyListResponse(items=items, total=len(items))


@router.post(
    "/api-keys",
    response_model=ApiKeyCreatedResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Generate new cryptographically secure API key (Admin only)",
)
async def admin_create_api_key(
    data: ApiKeyCreate,
    current_admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> ApiKeyCreatedResponse:
    """
    Issue a new API Key with optional departmental scoping.
    The raw plaintext secret is returned ONLY ONCE in this response.
    """
    if data.department_id is not None:
        dept_stmt = select(Department).where(Department.id == data.department_id)
        dept_res = await db.execute(dept_stmt)
        department = dept_res.scalars().first()
        if not department:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Department with ID {data.department_id} not found",
            )

    api_key_entity, raw_secret = ApiKey.generate_key_pair(
        name=data.name.strip(),
        created_by_id=current_admin.id,
        department_id=data.department_id,
    )
    db.add(api_key_entity)
    await db.commit()
    await db.refresh(api_key_entity)

    # Reload with relations
    stmt = (
        select(ApiKey)
        .options(selectinload(ApiKey.department), selectinload(ApiKey.created_by))
        .where(ApiKey.id == api_key_entity.id)
    )
    res = await db.execute(stmt)
    full_key = res.scalars().first()

    logger.info(
        f"[ADMIN] Admin {current_admin.email} generated API Key '{full_key.name}' (Prefix: {full_key.key_prefix}, Dept: {full_key.department_id})"
    )

    return ApiKeyCreatedResponse(
        api_key=ApiKeyRead(
            id=full_key.id,
            name=full_key.name,
            key_prefix=full_key.key_prefix,
            department_id=full_key.department_id,
            department_code=full_key.department.code if full_key.department else None,
            department_name=full_key.department.name if full_key.department else "All Queues (Universal)",
            created_by_id=full_key.created_by_id,
            created_by_name=full_key.created_by.full_name if full_key.created_by else current_admin.full_name,
            is_active=full_key.is_active,
            last_used_at=full_key.last_used_at,
            created_at=full_key.created_at,
        ),
        raw_secret_key=raw_secret,
        message="API Key generated successfully. Copy and securely store this key now — you will not be able to view it again.",
    )


@router.delete(
    "/api-keys/{api_key_id}",
    status_code=status.HTTP_200_OK,
    summary="Revoke and delete an API key (Admin only)",
)
async def admin_delete_api_key(
    api_key_id: int,
    current_admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Instantly revoke and purge an API key.
    """
    stmt = select(ApiKey).where(ApiKey.id == api_key_id)
    res = await db.execute(stmt)
    key = res.scalars().first()

    if not key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"API Key with ID {api_key_id} not found",
        )

    key_name = key.name
    await db.delete(key)
    await db.commit()

    logger.info(f"[ADMIN] Admin {current_admin.email} revoked API Key #{api_key_id} ('{key_name}')")
    return {"message": f"API Key '{key_name}' has been successfully revoked."}

