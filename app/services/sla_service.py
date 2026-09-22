import logging
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.audit import AuditAction, TicketAuditLog
from app.models.ticket import Ticket, TicketPriority, TicketState

logger = logging.getLogger(__name__)

# SLA Duration policies by priority level
SLA_POLICIES: Dict[TicketPriority, timedelta] = {
    TicketPriority.CRITICAL: timedelta(hours=4),
    TicketPriority.URGENT: timedelta(hours=8),
    TicketPriority.HIGH: timedelta(hours=12),
    TicketPriority.MEDIUM: timedelta(hours=24),
    TicketPriority.LOW: timedelta(hours=48),
}


class SlaService:
    """
    Service responsible for computing SLA resolution deadlines and executing
    periodic auto-escalation scanning across active multi-department tickets.
    """

    @staticmethod
    def calculate_due_date(
        priority: TicketPriority,
        start_time: Optional[datetime] = None,
    ) -> datetime:
        """
        Compute ticket due_date according to enterprise SLA priority policies.
        """
        base_time = start_time or datetime.now(timezone.utc)
        duration = SLA_POLICIES.get(priority, timedelta(hours=24))
        return base_time + duration

    @classmethod
    async def process_sla_escalations(cls, db: AsyncSession) -> List[Ticket]:
        """
        Scan for active tickets that have breached their SLA resolution target.
        Automatically flags is_escalated = True, logs an immutable ESCALATED audit trail record,
        and triggers high-priority escalation notifications.
        """
        now = datetime.now(timezone.utc)

        # Select overdue active tickets
        stmt = (
            select(Ticket)
            .where(
                Ticket.due_date.is_not(None),
                Ticket.due_date < now,
                Ticket.is_escalated == False,  # noqa: E712
                Ticket.current_state.notin_([TicketState.RESOLVED, TicketState.CLOSED]),
            )
            .options(
                selectinload(Ticket.department),
                selectinload(Ticket.creator),
                selectinload(Ticket.assignee),
            )
        )
        result = await db.execute(stmt)
        overdue_tickets = result.scalars().all()

        if not overdue_tickets:
            return []

        logger.warning(f"SLA Scanner detected {len(overdue_tickets)} overdue tickets breaching SLA targets.")

        for ticket in overdue_tickets:
            ticket.is_escalated = True
            ticket.updated_at = now

            # Record immutable audit log
            audit_log = TicketAuditLog(
                ticket_id=ticket.id,
                actor_id=None,  # Automated System Actor
                action=AuditAction.ESCALATED,
                from_state=ticket.current_state,
                to_state=ticket.current_state,
                comment=f"Automated SLA Breach Escalation: Exceeded {ticket.priority.value} deadline target ({ticket.due_date})",
                payload={
                    "event": "SLA_BREACH",
                    "due_date": ticket.due_date.isoformat() if ticket.due_date else None,
                    "breach_time": now.isoformat(),
                    "priority": ticket.priority.value,
                },
                created_at=now,
            )
            db.add(audit_log)

        await db.commit()

        # Trigger background notifications for escalated tickets
        try:
            from app.services.notification_service import notification_service
            for ticket in overdue_tickets:
                await notification_service.send_sla_escalation_alert(ticket)
        except Exception as e:
            logger.error(f"Failed to dispatch SLA escalation alerts: {e}")

        return list(overdue_tickets)


sla_service = SlaService()
