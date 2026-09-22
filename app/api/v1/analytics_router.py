from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_active_user, get_db
from app.models.user import User, UserRole
from app.schemas.analytics import AnalyticsOverviewResponse
from app.services.analytics_service import analytics_service

router = APIRouter()


@router.get(
    "/overview",
    response_model=AnalyticsOverviewResponse,
    summary="Fetch executive analytics, SLA compliance, and MTTR metrics",
)
async def get_analytics_overview(
    days: int = Query(30, ge=1, le=365, description="Timeframe window in days"),
    department_id: Optional[int] = Query(None, description="Optional department filter"),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns high-level executive metrics including:
    - SLA Compliance Rate (%)
    - Mean Time to Resolution (MTTR in hours) per department
    - 30-day ticket volume trends and status distributions
    """
    # Department isolation: if not admin or authorizer, restrict to user's assigned department
    target_dept_id = department_id
    if current_user.role not in [UserRole.ADMIN, UserRole.AUTHORIZER, UserRole.OBSERVER]:
        if current_user.department_id:
            target_dept_id = current_user.department_id

    return await analytics_service.get_overview(
        db=db,
        days=days,
        department_id=target_dept_id,
    )
