from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_active_user, get_db, require_admin
from app.core.security import create_access_token
from app.models.user import User, UserRole
from app.schemas.auth import (
    LoginRequest,
    Token,
    UserCreate,
    UserResponse,
    UserUpdate,
)
from app.services.auth_service import auth_service

router = APIRouter()


@router.post("/login", response_model=Token, summary="Authenticate and obtain JWT bearer token")
async def login_for_access_token(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> Token:
    """
    Authenticate user credentials and issue a signed JWT access token.
    Accepts standard JSON credentials or OAuth2 form payload.
    """
    content_type = request.headers.get("content-type", "")
    email: Optional[str] = None
    password: Optional[str] = None

    if "application/json" in content_type:
        try:
            body = await request.json()
            email = body.get("email") or body.get("username")
            password = body.get("password")
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid JSON payload",
            )
    else:
        try:
            form = await request.form()
            email = form.get("username") or form.get("email")
            password = form.get("password")
        except Exception:
            pass

    if not email or not password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Must provide username/email and password",
        )

    user = await auth_service.authenticate(db, email=str(email), password=str(password))
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(
        subject=user.id,
        role=user.role.value,
        department_id=user.department_id,
    )
    return Token(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse.model_validate(user),
    )



@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED, summary="Register a new user")
async def register_user(
    user_in: UserCreate,
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    """
    Register a new user in the enterprise system.
    """
    existing_user = await auth_service.get_by_email(db, email=user_in.email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"User with email '{user_in.email}' already exists",
        )

    user = await auth_service.create(db, user_in=user_in)
    return UserResponse.model_validate(user)


@router.get("/me", response_model=UserResponse, summary="Get current authenticated user profile")
async def get_my_profile(
    current_user: User = Depends(get_current_active_user),
) -> UserResponse:
    """
    Retrieve profile details for the currently authenticated user.
    """
    return UserResponse.model_validate(current_user)


@router.patch("/me", response_model=UserResponse, summary="Update current user profile")
async def update_my_profile(
    user_in: UserUpdate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    """
    Update details of the currently authenticated user profile.
    """
    # Non-admins cannot alter their own role
    if user_in.role is not None and current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can modify user roles",
        )

    user = await auth_service.update(db, user=current_user, user_in=user_in)
    return UserResponse.model_validate(user)


@router.get("/users", response_model=List[UserResponse], summary="List enterprise users")
async def list_users(
    department_id: Optional[int] = Query(None, description="Filter by department ID"),
    role: Optional[UserRole] = Query(None, description="Filter by user role"),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> List[UserResponse]:
    """
    List enterprise users with optional filters for assignment routing.
    """
    stmt = select(User).where(User.is_active == True)  # noqa: E712
    if department_id is not None:
        stmt = stmt.where(User.department_id == department_id)
    if role is not None:
        stmt = stmt.where(User.role == role)

    stmt = stmt.order_by(User.full_name.asc())
    result = await db.execute(stmt)
    users = result.scalars().all()
    return [UserResponse.model_validate(u) for u in users]
