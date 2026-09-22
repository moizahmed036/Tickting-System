import logging
from typing import Any, Dict, List, Optional
from jinja2 import Template

from app.core.config import settings
from app.core.security import create_action_token
from app.models.ticket import Ticket
from app.models.user import User

logger = logging.getLogger(__name__)


# Standard HTML/Text notification templates
TICKET_CREATED_TEMPLATE = Template("""
Hello {{ creator_name }},

Your ticket has been successfully registered in the NexusFlow Enterprise System.

Ticket Number: {{ ticket_number }}
Title: {{ title }}
Priority: {{ priority }}
Department: {{ department_name }}
Estimated SLA Target: {{ due_date }}

You can track your ticket progress anytime via the Employee Portal.
""")

TICKET_ASSIGNED_TEMPLATE = Template("""
Hello {{ assignee_name }},

A new enterprise ticket has been assigned to your department queue.

Ticket Number: {{ ticket_number }}
Title: {{ title }}
Priority: {{ priority }}
Department: {{ department_name }}
Submitted By: {{ creator_name }}

Please review and begin processing at your earliest convenience.
""")

PENDING_APPROVAL_TEMPLATE = Template("""
ATTENTION: Authorization Required for {{ ticket_number }}

A requisition gate requires your review and approval.

Ticket Number: {{ ticket_number }}
Title: {{ title }}
Department: {{ department_name }}
Priority: {{ priority }}
Submitted By: {{ creator_name }}

--------------------------------------------------
1-CLICK EXECUTIVE DECISION LINKS:
--------------------------------------------------
[ APPROVE TICKET ]: {{ approve_url }}
[ REJECT TICKET ]:  {{ reject_url }}

Or log in to the Executive Authorization Portal: {{ portal_url }}
""")


TICKET_RESOLVED_TEMPLATE = Template("""
Hello {{ creator_name }},

Your ticket {{ ticket_number }} ("{{ title }}") has been marked as RESOLVED.

Department: {{ department_name }}
Resolution Timestamp: {{ resolved_at }}

Please review the resolution in the portal and confirm closure.
""")

SLA_ESCALATION_TEMPLATE = Template("""
HIGH PRIORITY ALERT: SLA TARGET BREACHED

Ticket {{ ticket_number }} has exceeded its resolution SLA target!

Title: {{ title }}
Priority: {{ priority }}
Department: {{ department_name }}
Target Due Date: {{ due_date }}
Assigned Specialist: {{ assignee_name }}

The ticket has been automatically marked as ESCALATED in the queue.
""")


class NotificationService:
    """
    Asynchronous notification dispatcher for transactional email alerts,
    lifecycle milestone confirmations, and urgent escalation warnings.
    """

    @staticmethod
    async def send_email(
        recipient_email: str,
        subject: str,
        body: str,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> bool:
        """
        Deliver email notification via SMTP or mock dispatcher.
        """
        logger.info(
            f"[EMAIL DISPATCH] To: {recipient_email} | Subject: '{subject}' | Meta: {metadata or {}}"
        )
        # In production this integrates with aiosmtplib or SendGrid/Mailgun client
        return True

    @classmethod
    async def send_ticket_created_notification(cls, ticket: Ticket):
        """Send confirmation to requester upon ticket creation."""
        if not ticket.creator:
            return
        subject = f"[NexusFlow] Ticket Created: {ticket.ticket_number} - {ticket.title}"
        body = TICKET_CREATED_TEMPLATE.render(
            creator_name=ticket.creator.full_name,
            ticket_number=ticket.ticket_number,
            title=ticket.title,
            priority=ticket.priority.value,
            department_name=ticket.department.name if ticket.department else "General",
            due_date=str(ticket.due_date) if ticket.due_date else "Standard Queue",
        )
        await cls.send_email(
            recipient_email=ticket.creator.email,
            subject=subject,
            body=body,
            metadata={"event": "TICKET_CREATED", "ticket_id": ticket.id},
        )

    @classmethod
    async def send_ticket_assigned_notification(cls, ticket: Ticket, assignee: User):
        """Send notification to assignee when a ticket is routed to them."""
        subject = f"[NexusFlow] Ticket Assigned: {ticket.ticket_number} - {ticket.title}"
        body = TICKET_ASSIGNED_TEMPLATE.render(
            assignee_name=assignee.full_name,
            ticket_number=ticket.ticket_number,
            title=ticket.title,
            priority=ticket.priority.value,
            department_name=ticket.department.name if ticket.department else "General",
            creator_name=ticket.creator.full_name if ticket.creator else "Employee",
        )
        await cls.send_email(
            recipient_email=assignee.email,
            subject=subject,
            body=body,
            metadata={"event": "TICKET_ASSIGNED", "ticket_id": ticket.id, "assignee_id": assignee.id},
        )

    @classmethod
    async def send_pending_approval_notification(
        cls,
        ticket: Ticket,
        authorizers: Optional[List[User]] = None,
    ):
        """Send high-priority alert with 1-click magic action links to department authorizers."""
        subject = f"[ACTION REQUIRED] Approval Needed for {ticket.ticket_number}"
        portal_url = f"{settings.FRONTEND_HOST}/tickets/{ticket.id}"

        if authorizers:
            for auth in authorizers:
                # Generate signed 1-click action tokens (48-hour lifetime)
                approve_token = create_action_token(
                    ticket_id=ticket.id,
                    user_id=auth.id,
                    target_state="APPROVED",
                )
                reject_token = create_action_token(
                    ticket_id=ticket.id,
                    user_id=auth.id,
                    target_state="REJECTED",
                )

                approve_url = f"{settings.SERVER_HOST}{settings.API_V1_STR}/tickets/quick-action?token={approve_token}"
                reject_url = f"{settings.SERVER_HOST}{settings.API_V1_STR}/tickets/quick-action?token={reject_token}"

                body = PENDING_APPROVAL_TEMPLATE.render(
                    ticket_number=ticket.ticket_number,
                    title=ticket.title,
                    department_name=ticket.department.name if ticket.department else "General",
                    priority=ticket.priority.value,
                    creator_name=ticket.creator.full_name if ticket.creator else "Employee",
                    approve_url=approve_url,
                    reject_url=reject_url,
                    portal_url=portal_url,
                )

                await cls.send_email(
                    recipient_email=auth.email,
                    subject=subject,
                    body=body,
                    metadata={
                        "event": "PENDING_APPROVAL",
                        "ticket_id": ticket.id,
                        "authorizer_id": auth.id,
                        "approve_url": approve_url,
                        "reject_url": reject_url,
                    },
                )
        else:
            logger.info(f"Broadcasted approval alert for {ticket.ticket_number}")


    @classmethod
    async def send_ticket_resolved_notification(cls, ticket: Ticket):
        """Send notification to requester upon resolution."""
        if not ticket.creator:
            return
        subject = f"[NexusFlow] Ticket Resolved: {ticket.ticket_number}"
        body = TICKET_RESOLVED_TEMPLATE.render(
            creator_name=ticket.creator.full_name,
            ticket_number=ticket.ticket_number,
            title=ticket.title,
            department_name=ticket.department.name if ticket.department else "General",
            resolved_at=str(ticket.resolved_at),
        )
        await cls.send_email(
            recipient_email=ticket.creator.email,
            subject=subject,
            body=body,
            metadata={"event": "TICKET_RESOLVED", "ticket_id": ticket.id},
        )

    @classmethod
    async def send_sla_escalation_alert(cls, ticket: Ticket):
        """Send escalation alert to department stakeholders when SLA is breached."""
        subject = f"[ESCALATION WARNING] SLA Breached for {ticket.ticket_number} ({ticket.priority.value})"
        body = SLA_ESCALATION_TEMPLATE.render(
            ticket_number=ticket.ticket_number,
            title=ticket.title,
            priority=ticket.priority.value,
            department_name=ticket.department.name if ticket.department else "General",
            due_date=str(ticket.due_date),
            assignee_name=ticket.assignee.full_name if ticket.assignee else "Unassigned Pool",
        )
        # Send to assignee or department lead
        target_email = ticket.assignee.email if ticket.assignee else "support-leads@enterprise.local"
        await cls.send_email(
            recipient_email=target_email,
            subject=subject,
            body=body,
            metadata={"event": "SLA_ESCALATED", "ticket_id": ticket.id},
        )


notification_service = NotificationService()
