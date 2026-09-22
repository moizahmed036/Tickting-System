import os
import uuid
import logging
from pathlib import Path
from typing import List, Optional
from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    UploadFile,
    status,
)
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_active_user, get_db
from app.core.config import settings
from app.core.websocket_manager import ws_manager
from app.models.attachment import TicketAttachment
from app.models.audit import AuditAction, TicketAuditLog
from app.models.ticket import Ticket
from app.models.user import User, UserRole
from app.schemas.attachment import AttachmentListResponse, AttachmentRead

logger = logging.getLogger(__name__)

router = APIRouter()

ALLOWED_EXTENSIONS = {
    ".pdf",
    ".png",
    ".jpg",
    ".jpeg",
    ".docx",
    ".xlsx",
    ".log",
    ".txt",
    ".csv",
    ".json",
}
MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB
UPLOAD_BASE_DIR = Path("uploads/tickets")


def check_ticket_access(ticket: Ticket, user: User):
    """Ensure user has permission to view/interact with the ticket."""
    if user.role == UserRole.ADMIN or user.role == UserRole.OBSERVER:
        return True
    if user.role == UserRole.REQUESTER:
        if ticket.creator_id != user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You can only view attachments on your own submitted tickets.",
            )
    else:
        # Assignee or Authorizer: must belong to same department or be the direct assignee
        if user.department_id and ticket.department_id != user.department_id and ticket.assignee_id != user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: Department isolation restricts access to this queue.",
            )


@router.post(
    "/tickets/{ticket_id}/attachments",
    response_model=AttachmentRead,
    status_code=status.HTTP_201_CREATED,
    summary="Upload file evidence or document attachment to a ticket",
)
async def upload_attachment(
    ticket_id: int,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    # Fetch ticket
    stmt = select(Ticket).options(selectinload(Ticket.department)).where(Ticket.id == ticket_id)
    res = await db.execute(stmt)
    ticket = res.scalars().first()
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")

    check_ticket_access(ticket, current_user)

    # Validate file extension
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File extension '{ext}' is not supported. Allowed formats: {', '.join(sorted(ALLOWED_EXTENSIONS))}",
        )

    # Read and validate file size
    contents = await file.read()
    file_size = len(contents)
    if file_size > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File exceeds maximum allowed size of 10MB (Uploaded: {round(file_size / (1024*1024), 2)}MB)",
        )

    # Store file locally
    ticket_dir = UPLOAD_BASE_DIR / str(ticket_id)
    ticket_dir.mkdir(parents=True, exist_ok=True)

    safe_filename = Path(file.filename or "attachment").name
    unique_filename = f"{uuid.uuid4().hex[:8]}_{safe_filename}"
    file_path = ticket_dir / unique_filename

    with open(file_path, "wb") as f:
        f.write(contents)

    # Create Attachment DB record
    attachment = TicketAttachment(
        ticket_id=ticket.id,
        uploader_id=current_user.id,
        filename=safe_filename,
        file_size=file_size,
        content_type=file.content_type or "application/octet-stream",
        storage_path=str(file_path),
    )
    db.add(attachment)

    # Append immutable audit log
    audit_log = TicketAuditLog(
        ticket_id=ticket.id,
        actor_id=current_user.id,
        action=AuditAction.ATTACHMENT_ADDED,
        comment=f"Uploaded document attachment: {safe_filename} ({round(file_size/1024, 1)} KB)",
        payload={
            "filename": safe_filename,
            "file_size_bytes": file_size,
            "content_type": file.content_type,
        },
    )
    db.add(audit_log)
    await db.commit()
    await db.refresh(attachment)

    # Load uploader relationship for response
    await db.refresh(attachment, attribute_names=["uploader"])

    # Broadcast WebSocket notification
    await ws_manager.emit_ticket_event(
        event_type="ATTACHMENT_ADDED",
        ticket=ticket,
        message=f"{current_user.full_name} uploaded attachment '{safe_filename}'",
        actor=current_user,
        department_code=ticket.department.code if ticket.department else "IT",
    )

    return attachment


@router.get(
    "/tickets/{ticket_id}/attachments",
    response_model=AttachmentListResponse,
    summary="List all attachments uploaded to a ticket",
)
async def list_attachments(
    ticket_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Ticket).where(Ticket.id == ticket_id)
    res = await db.execute(stmt)
    ticket = res.scalars().first()
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")

    check_ticket_access(ticket, current_user)

    attach_stmt = (
        select(TicketAttachment)
        .options(selectinload(TicketAttachment.uploader))
        .where(TicketAttachment.ticket_id == ticket_id)
        .order_by(TicketAttachment.created_at.desc())
    )
    attach_res = await db.execute(attach_stmt)
    attachments = list(attach_res.scalars().all())

    return AttachmentListResponse(items=attachments, total=len(attachments))


@router.get(
    "/attachments/{attachment_id}/download",
    summary="Download or stream an attachment file with RBAC security validation",
)
async def download_attachment(
    attachment_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(TicketAttachment)
        .options(selectinload(TicketAttachment.ticket))
        .where(TicketAttachment.id == attachment_id)
    )
    res = await db.execute(stmt)
    attachment = res.scalars().first()
    if not attachment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attachment not found")

    check_ticket_access(attachment.ticket, current_user)

    if not os.path.exists(attachment.storage_path):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File content not found on server")

    return FileResponse(
        path=attachment.storage_path,
        filename=attachment.filename,
        media_type=attachment.content_type,
    )


@router.delete(
    "/attachments/{attachment_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete an uploaded attachment",
)
async def delete_attachment(
    attachment_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(TicketAttachment)
        .options(selectinload(TicketAttachment.ticket))
        .where(TicketAttachment.id == attachment_id)
    )
    res = await db.execute(stmt)
    attachment = res.scalars().first()
    if not attachment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attachment not found")

    ticket = attachment.ticket
    check_ticket_access(ticket, current_user)

    # Only uploader or Admin can delete
    if current_user.role != UserRole.ADMIN and attachment.uploader_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only delete attachments that you uploaded.",
        )

    # Remove file from disk
    if os.path.exists(attachment.storage_path):
        try:
            os.remove(attachment.storage_path)
        except Exception as e:
            logger.warning(f"Could not remove attachment file: {e}")

    filename = attachment.filename
    await db.delete(attachment)

    # Log audit event
    audit_log = TicketAuditLog(
        ticket_id=ticket.id,
        actor_id=current_user.id,
        action=AuditAction.ATTACHMENT_DELETED,
        comment=f"Deleted attachment: {filename}",
        payload={"filename": filename},
    )
    db.add(audit_log)
    await db.commit()

    return {"message": f"Attachment '{filename}' successfully deleted"}
