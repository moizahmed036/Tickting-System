import enum
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Any, Dict, Optional
from sqlalchemy import (
    JSON,
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    Integer,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.ticket import TicketState

if TYPE_CHECKING:
    from app.models.ticket import Ticket
    from app.models.user import User


class AuditAction(str, enum.Enum):
    """
    Immutable audit action types recorded in ticket history.
    """
    CREATED = "CREATED"
    FIELD_UPDATED = "FIELD_UPDATED"
    STATE_TRANSITION = "STATE_TRANSITION"
    ASSIGNED = "ASSIGNED"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    COMMENT_ADDED = "COMMENT_ADDED"
    ESCALATED = "ESCALATED"
    NOTIFICATION_SENT = "NOTIFICATION_SENT"



class TicketAuditLog(Base):
    """
    Append-only, immutable audit trail capturing every state change, field mutation,
    assignment, approval, and decision event.
    """
    __tablename__ = "ticket_audit_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True, autoincrement=True)
    ticket_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("tickets.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    actor_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    action: Mapped[AuditAction] = mapped_column(
        SAEnum(AuditAction, name="audit_action_enum", native_enum=False),
        nullable=False,
        index=True,
    )
    from_state: Mapped[Optional[TicketState]] = mapped_column(
        SAEnum(TicketState, name="audit_from_state_enum", native_enum=False),
        nullable=True,
    )
    to_state: Mapped[Optional[TicketState]] = mapped_column(
        SAEnum(TicketState, name="audit_to_state_enum", native_enum=False),
        nullable=True,
    )
    comment: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    payload: Mapped[Dict[str, Any]] = mapped_column(
        JSON,
        default=dict,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
        index=True,
    )

    # Relationships
    ticket: Mapped["Ticket"] = relationship(
        "Ticket", back_populates="audit_logs"
    )
    actor: Mapped[Optional["User"]] = relationship(
        "User", back_populates="audit_logs"
    )

    def __repr__(self) -> str:
        return (
            f"<TicketAuditLog id={self.id} ticket_id={self.ticket_id} "
            f"action='{self.action.value}' actor_id={self.actor_id}>"
        )
