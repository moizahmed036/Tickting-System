import logging
import random
import re
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional
from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit import AuditAction, TicketAuditLog
from app.models.department import Department
from app.models.ticket import Ticket, TicketPriority, TicketState
from app.models.user import User
from app.schemas.email_task import (
    ConvertEmailResponse,
    EmailTaskItem,
    MarkResolvedResponse,
    PendingEmailsResponse,
)
from app.services.ai_triage import ai_triage_service
from app.services.notification_service import notification_service
from app.services.sla_service import sla_service

logger = logging.getLogger(__name__)


# Non-actionable keywords for automatic noise filtering
INFORMATIONAL_KEYWORDS = [
    "newsletter", "weekly digest", "no-reply", "noreply", "automated notification",
    "all systems operational", "maintenance completed", "fyi only", "subscription receipt",
    "marketing", "webinar invitation", "daily report summary"
]


class EmailReaderService:
    """
    Real-time AI Email Ingestion & Task Extraction Service.
    Connects to IMAP/Exchange mailboxes or mock inbox, analyzes incoming messages
    using the AI Triage Engine, extracts priority, intent, and one-line summaries,
    and enables 1-click ticket conversion and resolution.
    """

    def __init__(self):
        self._email_store: Dict[str, EmailTaskItem] = {}
        self._initialize_seed_inbox()

    def _initialize_seed_inbox(self):
        """Populate initial realistic enterprise emails representing incoming inbox items."""
        now = datetime.now(timezone.utc)

        seed_raw_emails = [
            {
                "id": "EML-IT-901",
                "sender": "david.chen@enterprise.local",
                "sender_name": "David Chen (DevOps Lead)",
                "subject": "CRITICAL: PostgreSQL Primary Cluster High Replication Lag & Connection Timeouts",
                "body": "The primary database in US-East region is showing connection pool exhaustion and 45-second replication lag. User checkouts are failing with 504 Gateway Timeouts. Please investigate urgently.",
                "timestamp": now - timedelta(minutes=14),
            },
            {
                "id": "EML-FIN-842",
                "sender": "billing@cloudinfra-partners.io",
                "sender_name": "CloudInfra Accounts",
                "subject": "Overdue AWS Infrastructure Invoice Payment ($28,450) - Executive Approval Required",
                "body": "Invoice #INV-2026-8812 for enterprise AWS compute instances ($28,450.00) is pending director signoff before 5 PM today to prevent service throttling.",
                "timestamp": now - timedelta(minutes=38),
            },
            {
                "id": "EML-HR-731",
                "sender": "elena.rostova@recruitment-agency.com",
                "sender_name": "Elena Rostova (Senior Recruiter)",
                "subject": "Candidate Offer Letter Authorization: Lead Security Architect",
                "body": "Candidate Marcus Vance has passed all technical panels. Please review the compensation package and authorize the formal offer letter for candidate onboarding.",
                "timestamp": now - timedelta(hours=1, minutes=15),
            },
            {
                "id": "EML-PROC-619",
                "sender": "supplies@hardware-direct.com",
                "sender_name": "Hardware Direct B2B",
                "subject": "Vendor Quote Review: 20x High-Performance Engineering Workstations",
                "body": "Attached is the revised vendor RFP quote ($42,000) for the 20 developer laptops and 4K displays for the upcoming engineering cohort. Awaiting procurement approval.",
                "timestamp": now - timedelta(hours=2, minutes=45),
            },
            {
                "id": "EML-IT-512",
                "sender": "rachel.adams@enterprise.local",
                "sender_name": "Rachel Adams (Product Marketing)",
                "subject": "Cannot access corporate VPN after OS security update",
                "body": "My MacBook updated to macOS 15.2 and now the Cisco AnyConnect VPN client fails to authenticate. I am unable to access internal staging servers.",
                "timestamp": now - timedelta(hours=3, minutes=20),
            },
            {
                "id": "EML-INFO-101",
                "sender": "updates@tech-news-digest.com",
                "sender_name": "Tech Weekly Digest",
                "subject": "Weekly Cloud Architecture & Kubernetes Newsletter (Issue #142)",
                "body": "Here are the top cloud engineering and Kubernetes updates for this week. No action required.",
                "timestamp": now - timedelta(hours=6),
            }
        ]

        for raw in seed_raw_emails:
            item = self._process_and_classify_email(
                email_id=raw["id"],
                sender=raw["sender"],
                sender_name=raw["sender_name"],
                subject=raw["subject"],
                body=raw["body"],
                timestamp=raw["timestamp"],
            )
            self._email_store[item.id] = item

    def _process_and_classify_email(
        self,
        email_id: str,
        sender: str,
        sender_name: str,
        subject: str,
        body: str,
        timestamp: datetime,
    ) -> EmailTaskItem:
        """Analyze email with AI Triage to extract priority, action required flag, and one-line summary."""
        full_text = f"{subject} {body}".lower()

        # 1. Action Required Detection
        is_informational = any(kw in full_text for kw in INFORMATIONAL_KEYWORDS)
        action_triggers = [
            "please", "urgent", "approve", "approval", "review", "failed", "broken",
            "critical", "outage", "timeout", "action required", "signoff", "payment",
            "invoice", "due", "cannot", "help", "investigate", "fix", "authorize", "quote"
        ]
        has_action_trigger = any(kw in full_text for kw in action_triggers)
        is_action_required = has_action_trigger and not is_informational

        # 2. AI Triage Classification
        triage = ai_triage_service.classify_ticket(title=subject, description=body)
        dept = triage.suggested_department_code

        # Map Priority
        if triage.suggested_priority == TicketPriority.CRITICAL:
            priority_str = "CRITICAL"
        elif triage.suggested_priority in (TicketPriority.HIGH, TicketPriority.URGENT):
            priority_str = "HIGH"
        elif triage.suggested_priority == TicketPriority.MEDIUM:
            priority_str = "MEDIUM"
        else:
            priority_str = "NORMAL"

        # 3. Concise Actionable One-Line Summary
        summary = self._generate_one_line_summary(subject, body, dept, priority_str, triage.key_entities)

        return EmailTaskItem(
            id=email_id,
            sender=sender,
            sender_name=sender_name,
            subject=subject,
            body=body,
            timestamp=timestamp,
            priority=priority_str,
            is_action_required=is_action_required,
            summary=summary,
            suggested_department=dept,
            status="PENDING",
        )

    def _generate_one_line_summary(
        self,
        subject: str,
        body: str,
        dept: str,
        priority: str,
        entities: Dict,
    ) -> str:
        """Generate a punchy, human-readable one-line action item."""
        amount = entities.get("extracted_amount")
        if dept == "FIN" and amount:
            return f"Review and authorize ${amount:,} requisition payment"
        elif "replication lag" in body.lower() or "cluster" in body.lower():
            return "Investigate PostgreSQL primary cluster connection pool & replication lag"
        elif "vpn" in subject.lower():
            return "Assist employee with VPN client connection and gateway authentication"
        elif "offer letter" in subject.lower() or "candidate" in subject.lower():
            return "Review and approve candidate compensation package for hiring signoff"
        elif "quote" in subject.lower() or "workstation" in subject.lower():
            return "Review and approve developer hardware workstation RFP quote"
        elif priority == "CRITICAL":
            return f"Immediate action required: {subject[:70]}"
        else:
            clean_sub = re.sub(r"^(re:|fwd:|critical:|urgent:)\s*", "", subject, flags=re.IGNORECASE)
            return f"Action item: {clean_sub[:75]}"

    def get_pending_actions(self) -> PendingEmailsResponse:
        """Retrieve all active actionable emails grouped with priority counts."""
        pending_items = [
            item for item in self._email_store.values()
            if item.is_action_required and item.status == "PENDING"
        ]

        # Sort: CRITICAL first, then HIGH, MEDIUM, NORMAL, then by timestamp desc
        priority_weight = {"CRITICAL": 4, "HIGH": 3, "MEDIUM": 2, "NORMAL": 1}
        pending_items.sort(
            key=lambda x: (priority_weight.get(x.priority, 0), x.timestamp.timestamp()),
            reverse=True,
        )

        critical_count = sum(1 for item in pending_items if item.priority == "CRITICAL")
        high_count = sum(1 for item in pending_items if item.priority == "HIGH")
        medium_count = sum(1 for item in pending_items if item.priority == "MEDIUM")
        normal_count = sum(1 for item in pending_items if item.priority == "NORMAL")

        return PendingEmailsResponse(
            critical_count=critical_count,
            high_count=high_count,
            medium_count=medium_count,
            normal_count=normal_count,
            total_pending=len(pending_items),
            items=pending_items,
        )

    async def convert_to_ticket(
        self,
        email_id: str,
        db: AsyncSession,
        current_user: User,
    ) -> ConvertEmailResponse:
        """Convert a pending email directly into an official system Ticket or thread into an existing ticket."""
        item = self._email_store.get(email_id)
        if not item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Email task with ID '{email_id}' not found",
            )
        if item.status == "CONVERTED":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Email '{email_id}' has already been converted to Ticket #{item.converted_ticket_number}",
            )
        if item.status == "RESOLVED":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Email '{email_id}' has already been marked as resolved",
            )

        # Thread Check: Scan subject and body for existing ticket pattern
        match = re.search(r"TCK-[A-Z]+-[0-9]+-[0-9]+", f"{item.subject} {item.body}", re.IGNORECASE) or re.search(r"TCK-[A-Z]+-\d{4}-\d+", f"{item.subject} {item.body}", re.IGNORECASE)
        if match:
            existing_ticket_num = match.group(0).upper()
            t_stmt = (
                select(Ticket)
                .where(Ticket.ticket_number == existing_ticket_num)
                .options(selectinload(Ticket.department))
            )
            t_res = await db.execute(t_stmt)
            existing_ticket = t_res.scalars().first()
            if existing_ticket:
                now = datetime.now(timezone.utc)
                audit_log = TicketAuditLog(
                    ticket_id=existing_ticket.id,
                    actor_id=current_user.id,
                    action=AuditAction.COMMENT_ADDED,
                    from_state=existing_ticket.current_state,
                    to_state=existing_ticket.current_state,
                    comment=f"Email Task '{item.id}' threaded from {item.sender}: {item.summary}",
                    payload={
                        "source": "EMAIL_READER_THREAD",
                        "email_id": item.id,
                        "sender": item.sender,
                        "subject": item.subject,
                        "body": item.body,
                    },
                    created_at=now,
                )
                existing_ticket.updated_at = now
                db.add(audit_log)
                await db.commit()

                item.status = "CONVERTED"
                item.converted_ticket_id = existing_ticket.id
                item.converted_ticket_number = existing_ticket.ticket_number

                return ConvertEmailResponse(
                    status="CONVERTED",
                    message=f"Email threaded into existing Ticket {existing_ticket.ticket_number}",
                    ticket_id=existing_ticket.id,
                    ticket_number=existing_ticket.ticket_number,
                    department_code=existing_ticket.department.code if existing_ticket.department else "IT",
                    priority=existing_ticket.priority.value,
                    email_id=email_id,
                )

        # 1. Resolve Target Department
        dept_stmt = select(Department).where(Department.code == item.suggested_department)
        dept_res = await db.execute(dept_stmt)
        department = dept_res.scalars().first()

        if not department or not department.is_active:
            fallback_stmt = select(Department).where(Department.is_active == True).limit(1)  # noqa: E712
            fallback_res = await db.execute(fallback_stmt)
            department = fallback_res.scalars().first()

        if not department:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="No operational departments configured in the enterprise system",
            )

        # 2. Map Priority to Enum
        priority_enum_map = {
            "CRITICAL": TicketPriority.CRITICAL,
            "HIGH": TicketPriority.HIGH,
            "MEDIUM": TicketPriority.MEDIUM,
            "NORMAL": TicketPriority.LOW,
        }
        priority_val = priority_enum_map.get(item.priority, TicketPriority.MEDIUM)

        # 3. IT Queue Rules & Tags
        tags = []
        if department.code == "IT":
            tags.append("IT-Support")

        # Generate Ticket Number & SLA
        current_year = datetime.now(timezone.utc).year
        count_stmt = select(func.count(Ticket.id))
        count_res = await db.execute(count_stmt)
        seq = (count_res.scalar() or 0) + 1
        random_suffix = random.randint(10, 99)
        ticket_number = f"TCK-{department.code.upper()}-{current_year}-{seq:04d}{random_suffix}"

        now = datetime.now(timezone.utc)
        due_date = sla_service.calculate_due_date(priority_val, now)

        ticket = Ticket(
            ticket_number=ticket_number,
            title=item.subject.strip(),
            description=item.body.strip(),
            priority=priority_val,
            current_state=TicketState.SUBMITTED,
            department_id=department.id,
            creator_id=current_user.id,
            assignee_id=None,
            metadata_payload={
                "source": "EMAIL_READER_WIDGET",
                "email_id": item.id,
                "raw_sender": item.sender,
                "sender_name": item.sender_name,
                "ai_summary": item.summary,
                "tags": tags,
            },
            due_date=due_date,
            is_escalated=False,
            created_at=now,
            updated_at=now,
        )
        db.add(ticket)
        await db.flush()

        # 4. Immutable Audit Trail
        audit_log = TicketAuditLog(
            ticket_id=ticket.id,
            actor_id=current_user.id,
            action=AuditAction.CREATED,
            from_state=None,
            to_state=TicketState.SUBMITTED,
            comment=f"Converted from Email Task '{item.id}' via AI Ingestion Widget. Summary: {item.summary}",
            payload={
                "source": "EMAIL_READER_WIDGET",
                "email_id": item.id,
                "sender": item.sender,
                "summary": item.summary,
                "tags": tags,
            },
            created_at=now,
        )
        db.add(audit_log)
        await db.commit()

        # 5. Update In-Memory Email Item State
        item.status = "CONVERTED"
        item.converted_ticket_id = ticket.id
        item.converted_ticket_number = ticket.ticket_number

        logger.info(f"[EMAIL READER] Converted email '{email_id}' to Ticket {ticket_number} (ID: {ticket.id})")

        return ConvertEmailResponse(
            status="CONVERTED",
            message=f"Successfully converted email to Ticket {ticket.ticket_number}",
            ticket_id=ticket.id,
            ticket_number=ticket.ticket_number,
            department_code=department.code,
            priority=ticket.priority.value,
            email_id=email_id,
        )

    def mark_resolved(self, email_id: str) -> MarkResolvedResponse:
        """Mark an email task as completed/resolved without creating a ticket."""
        item = self._email_store.get(email_id)
        if not item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Email task with ID '{email_id}' not found",
            )
        item.status = "RESOLVED"
        logger.info(f"[EMAIL READER] Marked email '{email_id}' as RESOLVED")
        return MarkResolvedResponse(
            status="RESOLVED",
            message=f"Email task '{email_id}' marked as resolved",
            email_id=email_id,
        )

    def sync_new_email(
        self,
        sender: str,
        sender_name: str,
        subject: str,
        body: str,
    ) -> EmailTaskItem:
        """Simulate/Ingest an incoming email dynamically."""
        email_id = f"EML-DYN-{random.randint(1000, 9999)}"
        item = self._process_and_classify_email(
            email_id=email_id,
            sender=sender,
            sender_name=sender_name,
            subject=subject,
            body=body,
            timestamp=datetime.now(timezone.utc),
        )
        self._email_store[item.id] = item
        return item


email_reader_service = EmailReaderService()
