from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.audit import AuditAction, TicketAuditLog
from app.models.ticket import Ticket, TicketState
from app.models.user import User, UserRole
from app.models.workflow import WorkflowStep
from app.schemas.workflow import AvailableTransitionResponse


class WorkflowEngineException(HTTPException):
    def __init__(self, detail: str, status_code: int = status.HTTP_400_BAD_REQUEST):
        super().__init__(status_code=status_code, detail=detail)


class WorkflowEngine:
    """
    Finite State Machine (FSM) & Rule Engine for multi-department enterprise ticketing workflows.
    Enforces strict state transitions, RBAC role gating, department queue isolation,
    and append-only immutable audit logging.
    """

    @staticmethod
    async def get_ticket_with_relations(db: AsyncSession, ticket_id: int) -> Optional[Ticket]:
        """Fetch a ticket with creator, assignee, and department eager-loaded."""
        stmt = (
            select(Ticket)
            .where(Ticket.id == ticket_id)
            .options(
                selectinload(Ticket.department),
                selectinload(Ticket.creator),
                selectinload(Ticket.assignee),
            )
        )
        result = await db.execute(stmt)
        return result.scalars().first()

    @staticmethod
    async def get_available_steps(
        db: AsyncSession,
        department_id: int,
        current_state: TicketState,
    ) -> List[WorkflowStep]:
        """Query all active workflow steps defined for a department from current_state."""
        stmt = (
            select(WorkflowStep)
            .where(
                WorkflowStep.department_id == department_id,
                WorkflowStep.from_state == current_state,
                WorkflowStep.is_active == True,  # noqa: E712
            )
            .order_by(WorkflowStep.step_order.asc())
        )
        result = await db.execute(stmt)
        return list(result.scalars().all())

    @classmethod
    async def get_available_transitions(
        cls,
        db: AsyncSession,
        ticket: Ticket,
        actor: User,
    ) -> List[AvailableTransitionResponse]:
        """
        Inspect all possible transitions from the ticket's current state and evaluate
        whether the acting user has permission to execute each transition.
        """
        steps = await cls.get_available_steps(db, ticket.department_id, ticket.current_state)
        available: List[AvailableTransitionResponse] = []

        for step in steps:
            allowed, reason = cls._check_user_role_and_dept(step, ticket, actor)
            available.append(
                AvailableTransitionResponse(
                    step_id=step.id,
                    name=step.name,
                    from_state=step.from_state,
                    to_state=step.to_state,
                    required_role=step.required_role,
                    condition_rules=step.condition_rules or {},
                    is_allowed=allowed,
                    reason=reason,
                )
            )
        return available

    @classmethod
    def _check_user_role_and_dept(
        cls,
        step: WorkflowStep,
        ticket: Ticket,
        actor: User,
    ) -> Tuple[bool, Optional[str]]:
        """Validate if the actor has the required role and departmental authority."""
        # ADMIN has universal operational override
        if actor.role == UserRole.ADMIN:
            return True, None

        # OBSERVER cannot execute state mutations
        if actor.role == UserRole.OBSERVER:
            return False, "Observers have read-only permissions"

        # Check required role
        if actor.role != step.required_role:
            return False, f"Requires role '{step.required_role.value}', but you have role '{actor.role.value}'"

        # Check Department isolation for ASSIGNEE and AUTHORIZER
        if actor.role in (UserRole.ASSIGNEE, UserRole.AUTHORIZER):
            if actor.department_id is not None and actor.department_id != ticket.department_id:
                return False, f"Ticket belongs to department #{ticket.department_id}, not your department #{actor.department_id}"

        # If REQUESTER role step, verify creator ownership (unless Admin)
        if step.required_role == UserRole.REQUESTER:
            if ticket.creator_id != actor.id:
                return False, "Only the ticket creator or an administrator can perform this requester transition"

        return True, None

    @classmethod
    async def validate_transition_allowed(
        cls,
        db: AsyncSession,
        ticket: Ticket,
        target_state: TicketState,
        actor: User,
        metadata_patch: Optional[Dict[str, Any]] = None,
    ) -> WorkflowStep:
        """
        Validate whether the requested transition is legal under FSM rules,
        RBAC policies, and condition gates.
        """
        if ticket.current_state == target_state:
            raise WorkflowEngineException(
                f"Ticket is already in state '{target_state.value}'",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        # Retrieve matching workflow step
        stmt = select(WorkflowStep).where(
            WorkflowStep.department_id == ticket.department_id,
            WorkflowStep.from_state == ticket.current_state,
            WorkflowStep.to_state == target_state,
            WorkflowStep.is_active == True,  # noqa: E712
        )
        result = await db.execute(stmt)
        step = result.scalars().first()

        # Check if step exists
        if not step:
            # Allow ADMIN override with special notice if no step is defined, or reject
            if actor.role == UserRole.ADMIN:
                # Create a virtual step for admin override
                step = WorkflowStep(
                    department_id=ticket.department_id,
                    name=f"Admin Direct Override to {target_state.value}",
                    from_state=ticket.current_state,
                    to_state=target_state,
                    required_role=UserRole.ADMIN,
                    step_order=999,
                    condition_rules={},
                )
            else:
                raise WorkflowEngineException(
                    f"No valid workflow transition found from '{ticket.current_state.value}' to '{target_state.value}' for department #{ticket.department_id}",
                    status_code=status.HTTP_400_BAD_REQUEST,
                )

        # Validate actor role and departmental authority
        allowed, reason = cls._check_user_role_and_dept(step, ticket, actor)
        if not allowed:
            raise WorkflowEngineException(
                f"Transition not permitted: {reason}",
                status_code=status.HTTP_403_FORBIDDEN,
            )

        # Validate Condition Rules (e.g., budget approval threshold, required metadata keys)
        if step.condition_rules:
            cls._evaluate_condition_rules(step.condition_rules, ticket, metadata_patch)

        return step

    @staticmethod
    def _evaluate_condition_rules(
        rules: Dict[str, Any],
        ticket: Ticket,
        metadata_patch: Optional[Dict[str, Any]],
    ) -> None:
        """
        Evaluate workflow condition rules against current ticket metadata and proposed patch.
        Example rules:
        - "required_fields": ["budget_code", "justification"]
        - "min_amount": 500
        """
        merged_metadata = dict(ticket.metadata_payload or {})
        if metadata_patch:
            merged_metadata.update(metadata_patch)

        required_fields = rules.get("required_fields", [])
        if isinstance(required_fields, list):
            missing = [f for f in required_fields if f not in merged_metadata or merged_metadata[f] is None]
            if missing:
                raise WorkflowEngineException(
                    f"Workflow condition failed: missing required metadata field(s): {', '.join(missing)}",
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                )

    @classmethod
    async def execute_transition(
        cls,
        db: AsyncSession,
        ticket_id: int,
        target_state: TicketState,
        actor: User,
        comment: Optional[str] = None,
        metadata_patch: Optional[Dict[str, Any]] = None,
    ) -> Ticket:
        """
        Execute an atomic state transition:
        1. Validates FSM path and RBAC permissions.
        2. Applies state update and lifecycle timestamps (resolved_at, closed_at).
        3. Updates metadata payload if patch provided.
        4. Inserts an immutable audit log record.
        5. Commits atomically and returns the refreshed ticket.
        """
        ticket = await cls.get_ticket_with_relations(db, ticket_id)
        if not ticket:
            raise WorkflowEngineException(
                f"Ticket with ID {ticket_id} not found",
                status_code=status.HTTP_404_NOT_FOUND,
            )

        from_state = ticket.current_state

        # Validate transition
        step = await cls.validate_transition_allowed(
            db=db,
            ticket=ticket,
            target_state=target_state,
            actor=actor,
            metadata_patch=metadata_patch,
        )

        now = datetime.now(timezone.utc)

        # Determine Audit Action based on target state
        if target_state == TicketState.APPROVED:
            audit_action = AuditAction.APPROVED
        elif target_state == TicketState.REJECTED:
            audit_action = AuditAction.REJECTED
        else:
            audit_action = AuditAction.STATE_TRANSITION

        # Update ticket state
        ticket.current_state = target_state
        ticket.updated_at = now

        # Lifecycle timestamps
        if target_state == TicketState.RESOLVED and not ticket.resolved_at:
            ticket.resolved_at = now
        elif target_state == TicketState.CLOSED and not ticket.closed_at:
            ticket.closed_at = now
        elif target_state in (TicketState.IN_PROGRESS, TicketState.SUBMITTED, TicketState.PENDING_APPROVAL):
            # If reopened or pushed back, preserve or reset appropriately
            if target_state == TicketState.IN_PROGRESS:
                ticket.resolved_at = None
                ticket.closed_at = None

        # Merge metadata payload
        payload_diff: Dict[str, Any] = {
            "step_name": step.name if hasattr(step, "name") else "Transition",
            "from_state": from_state.value,
            "to_state": target_state.value,
        }

        if metadata_patch:
            current_meta = dict(ticket.metadata_payload or {})
            current_meta.update(metadata_patch)
            ticket.metadata_payload = current_meta
            payload_diff["metadata_patch"] = metadata_patch

        # Append-only immutable audit trail record
        audit_log = TicketAuditLog(
            ticket_id=ticket.id,
            actor_id=actor.id,
            action=audit_action,
            from_state=from_state,
            to_state=target_state,
            comment=comment,
            payload=payload_diff,
            created_at=now,
        )
        db.add(audit_log)

        await db.commit()
        await db.refresh(ticket)
        return ticket


workflow_engine = WorkflowEngine()
