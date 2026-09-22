from datetime import datetime, timezone
from typing import TYPE_CHECKING, Any, Dict, Optional
from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    Integer,
    String,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.ticket import TicketState
from app.models.user import UserRole

if TYPE_CHECKING:
    from app.models.department import Department


class WorkflowStep(Base):
    """
    Workflow Step defining valid transitions in the Finite State Machine (FSM).
    Transitions are constrained per department, from_state -> to_state, and acting user role.
    """
    __tablename__ = "workflow_steps"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True, autoincrement=True)
    department_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("departments.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    
    from_state: Mapped[TicketState] = mapped_column(
        SAEnum(TicketState, name="workflow_from_state_enum", native_enum=False),
        nullable=False,
        index=True,
    )
    to_state: Mapped[TicketState] = mapped_column(
        SAEnum(TicketState, name="workflow_to_state_enum", native_enum=False),
        nullable=False,
        index=True,
    )
    required_role: Mapped[UserRole] = mapped_column(
        SAEnum(UserRole, name="workflow_required_role_enum", native_enum=False),
        nullable=False,
        index=True,
    )
    
    step_order: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    condition_rules: Mapped[Dict[str, Any]] = mapped_column(
        JSON,
        default=dict,
        nullable=False,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
    )

    # Relationships
    department: Mapped["Department"] = relationship(
        "Department", back_populates="workflow_steps"
    )

    def __repr__(self) -> str:
        return (
            f"<WorkflowStep id={self.id} dept={self.department_id} "
            f"'{self.from_state.value}' -> '{self.to_state.value}' role={self.required_role.value}>"
        )
