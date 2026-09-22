import enum
from datetime import datetime, timezone
from typing import TYPE_CHECKING, List, Optional
from sqlalchemy import Boolean, DateTime, Enum as SAEnum, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.department import Department
    from app.models.ticket import Ticket
    from app.models.audit import TicketAuditLog


class UserRole(str, enum.Enum):
    """
    Role-Based Access Control (RBAC) definitions.
    - REQUESTER: Submits requests and tracks own tickets.
    - ASSIGNEE: Executes tasks within their department queue.
    - AUTHORIZER: Approves or rejects budget/policy/clearance gates.
    - OBSERVER: Read-only access for compliance and audit visibility.
    - ADMIN: Full operational override and configuration control.
    """
    REQUESTER = "REQUESTER"
    ASSIGNEE = "ASSIGNEE"
    AUTHORIZER = "AUTHORIZER"
    OBSERVER = "OBSERVER"
    ADMIN = "ADMIN"


class User(Base):
    """
    User entity representing enterprise personnel across various departments and roles.
    """
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(150), nullable=False)
    role: Mapped[UserRole] = mapped_column(
        SAEnum(UserRole, name="user_role_enum", native_enum=False),
        default=UserRole.REQUESTER,
        nullable=False,
        index=True,
    )
    department_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("departments.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
    )

    # Relationships
    department: Mapped[Optional["Department"]] = relationship(
        "Department", back_populates="users"
    )
    created_tickets: Mapped[List["Ticket"]] = relationship(
        "Ticket",
        foreign_keys="[Ticket.creator_id]",
        back_populates="creator",
        cascade="all, delete-orphan",
    )
    assigned_tickets: Mapped[List["Ticket"]] = relationship(
        "Ticket",
        foreign_keys="[Ticket.assignee_id]",
        back_populates="assignee",
    )
    audit_logs: Mapped[List["TicketAuditLog"]] = relationship(
        "TicketAuditLog",
        back_populates="actor",
    )

    def __repr__(self) -> str:
        return f"<User id={self.id} email='{self.email}' role='{self.role.value}'>"
