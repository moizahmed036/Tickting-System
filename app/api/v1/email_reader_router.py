from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_active_user, get_db
from app.models.user import User
from app.schemas.email_task import (
    ConvertEmailResponse,
    MarkResolvedResponse,
    PendingEmailsResponse,
)
from app.services.email_reader_service import email_reader_service

router = APIRouter()


@router.get(
    "/pending-actions",
    response_model=PendingEmailsResponse,
    summary="Get pending actionable emails for the active user",
)
async def get_pending_action_emails(
    current_user: User = Depends(get_current_active_user),
) -> PendingEmailsResponse:
    """
    Fetch categorized incoming emails filtered by action-required status.
    Returns grouped metric counts (Critical, High, Medium, Normal) and actionable cards.
    """
    return email_reader_service.get_pending_actions()


@router.post(
    "/{email_id}/convert-to-ticket",
    response_model=ConvertEmailResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Convert pending email to an official system Ticket",
)
async def convert_email_to_ticket(
    email_id: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> ConvertEmailResponse:
    """
    Convert a pending email directly into an enterprise Ticket with the AI-detected
    priority level, target department queue, SLA target, and an immutable CREATED audit log.
    """
    return await email_reader_service.convert_to_ticket(
        email_id=email_id,
        db=db,
        current_user=current_user,
    )


@router.post(
    "/{email_id}/mark-resolved",
    response_model=MarkResolvedResponse,
    summary="Mark email task as done/resolved",
)
async def mark_email_resolved(
    email_id: str,
    current_user: User = Depends(get_current_active_user),
) -> MarkResolvedResponse:
    """
    Mark an actionable email task as resolved/dismissed without creating a ticket.
    """
    return email_reader_service.mark_resolved(email_id=email_id)


@router.post(
    "/sync",
    response_model=PendingEmailsResponse,
    summary="Trigger immediate inbox sync",
)
async def sync_inbox_now(
    current_user: User = Depends(get_current_active_user),
) -> PendingEmailsResponse:
    """
    Trigger real-time inbox synchronization and return updated pending action items.
    """
    return email_reader_service.get_pending_actions()
