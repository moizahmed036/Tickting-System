import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional
from croniter import croniter
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import async_session_factory
from app.models.audit import AuditAction, TicketAuditLog
from app.models.department import Department
from app.models.recurring import RecurringWorkflow
from app.models.ticket import Ticket, TicketState
from app.services.sla_service import sla_service

logger = logging.getLogger(__name__)


class BackgroundScheduler:
    """
    Asynchronous Background Automation Engine managing:
    1. Periodic SLA breach scanning and auto-escalation.
    2. Cron-based recurring workflow ticket instantiation.
    """

    def __init__(self, sla_interval_seconds: int = 60, recurring_interval_seconds: int = 120):
        self.sla_interval = sla_interval_seconds
        self.recurring_interval = recurring_interval_seconds
        self._running = False
        self._sla_task: Optional[asyncio.Task] = None
        self._recurring_task: Optional[asyncio.Task] = None

    async def start(self):
        """Start the async automation loops."""
        if self._running:
            return
        self._running = True
        self._sla_task = asyncio.create_task(self._run_sla_loop())
        self._recurring_task = asyncio.create_task(self._run_recurring_loop())
        logger.info("Background Automation & Scheduler Engine started successfully.")

    async def stop(self):
        """Gracefully stop automation tasks."""
        self._running = False
        if self._sla_task:
            self._sla_task.cancel()
        if self._recurring_task:
            self._recurring_task.cancel()
        logger.info("Background Automation & Scheduler Engine stopped.")

    async def _run_sla_loop(self):
        """Periodic SLA escalation loop."""
        while self._running:
            try:
                async with async_session_factory() as session:
                    escalated = await sla_service.process_sla_escalations(session)
                    if escalated:
                        logger.info(f"[SLA Worker] Escalated {len(escalated)} overdue tickets.")
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"[SLA Worker Error] {e}")

            await asyncio.sleep(self.sla_interval)

    async def _run_recurring_loop(self):
        """Periodic recurring ticket generation loop."""
        while self._running:
            try:
                async with async_session_factory() as session:
                    created_tickets = await self.process_recurring_workflows(session)
                    if created_tickets:
                        logger.info(f"[Recurring Worker] Instantiated {len(created_tickets)} scheduled tickets.")
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"[Recurring Worker Error] {e}")

            await asyncio.sleep(self.recurring_interval)

    @staticmethod
    def _make_aware(dt: Optional[datetime]) -> Optional[datetime]:
        if dt is None:
            return None
        if dt.tzinfo is None:
            return dt.replace(tzinfo=timezone.utc)
        return dt

    @classmethod
    async def process_recurring_workflows(cls, db: AsyncSession) -> list[Ticket]:
        """
        Check all active RecurringWorkflows. If current time is past next_run_at,
        automatically generate a new ticket, log audit creation, and compute next_run_at.
        """
        now = datetime.now(timezone.utc)
        stmt = select(RecurringWorkflow).where(RecurringWorkflow.is_active == True)  # noqa: E712
        result = await db.execute(stmt)
        workflows = result.scalars().all()

        created_tickets: list[Ticket] = []

        for wf in workflows:
            # If next_run_at is not set, initialize it from cron
            next_run = cls._make_aware(wf.next_run_at)
            if not next_run:
                try:
                    iter_cron = croniter(wf.cron_expression, now)
                    next_run = cls._make_aware(iter_cron.get_next(datetime))
                    wf.next_run_at = next_run
                except Exception as ex:
                    logger.error(f"Invalid cron expression '{wf.cron_expression}' on workflow #{wf.id}: {ex}")
                    continue

            # Check if execution is due
            if next_run and now >= next_run:
                # Fetch department code
                dept_stmt = select(Department).where(Department.id == wf.department_id)
                dept_res = await db.execute(dept_stmt)
                dept = dept_res.scalars().first()
                dept_code = dept.code if dept else "GEN"

                # Generate ticket number
                tck_number = f"TCK-{dept_code.upper()}-{now.year}-AUTO-{wf.id:03d}{now.strftime('%d%H%M')}"
                due_date = sla_service.calculate_due_date(wf.priority, now)

                # Instantiate ticket
                ticket = Ticket(
                    ticket_number=tck_number,
                    title=f"[Scheduled] {wf.title}",
                    description=wf.description,
                    priority=wf.priority,
                    current_state=TicketState.SUBMITTED,  # Scheduled tickets enter Submitted directly
                    department_id=wf.department_id,
                    creator_id=wf.creator_id or 1,  # Default to admin/system creator
                    assignee_id=None,
                    metadata_payload=dict(wf.metadata_template or {}),
                    due_date=due_date,
                    is_escalated=False,
                    created_at=now,
                    updated_at=now,
                )
                db.add(ticket)
                await db.flush()

                # Audit log for scheduled ticket creation
                audit = TicketAuditLog(
                    ticket_id=ticket.id,
                    actor_id=wf.creator_id,
                    action=AuditAction.CREATED,
                    from_state=None,
                    to_state=TicketState.SUBMITTED,
                    comment=f"Automated creation from Recurring Workflow #{wf.id} (Cron: {wf.cron_expression})",
                    payload={"recurring_workflow_id": wf.id, "cron": wf.cron_expression},
                    created_at=now,
                )
                db.add(audit)

                # Advance next_run_at and last_run_at
                wf.last_run_at = now
                try:
                    iter_cron = croniter(wf.cron_expression, now)
                    wf.next_run_at = cls._make_aware(iter_cron.get_next(datetime))
                except Exception:
                    wf.next_run_at = None

                created_tickets.append(ticket)

        if created_tickets:
            await db.commit()

        return created_tickets


scheduler = BackgroundScheduler()
