import asyncio
import logging
from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import get_password_hash
from app.db.base import Base
from app.db.session import async_session_factory, engine
from app.models.department import Department
from app.models.ticket import TicketPriority, TicketState
from app.models.user import User, UserRole
from app.models.workflow import WorkflowStep

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


DEPARTMENTS_DATA = [
    {
        "code": "IT",
        "name": "Information Technology & Infrastructure",
        "description": "IT infrastructure, software services, cloud operations, and user desktop support.",
    },
    {
        "code": "FIN",
        "name": "Finance & Budgeting",
        "description": "Corporate finance, vendor disbursements, payroll, budget approvals, and auditing.",
    },
    {
        "code": "HR",
        "name": "Human Resources & Recruitment",
        "description": "Talent acquisition, employee relations, onboarding, and workforce management.",
    },
    {
        "code": "SD",
        "name": "ESU / Service Delivery",
        "description": "Enterprise Service Unit, SLA monitoring, and client delivery operations.",
    },
    {
        "code": "PROC",
        "name": "Procurement & Vendor Management",
        "description": "Equipment requisition, vendor contracts, purchasing, and supply chain.",
    },
]


USERS_DATA = [
    {
        "email": settings.FIRST_SUPERUSER_EMAIL,
        "password": settings.FIRST_SUPERUSER_PASSWORD,
        "full_name": "System Administrator",
        "role": UserRole.ADMIN,
        "dept_code": None,
    },
    {
        "email": "requester@enterprise.local",
        "password": "RequesterPass123!",
        "full_name": "Alice Requester",
        "role": UserRole.REQUESTER,
        "dept_code": None,
    },
    {
        "email": "fin.agent@enterprise.local",
        "password": "AgentPass123!",
        "full_name": "Bob Finance Analyst",
        "role": UserRole.ASSIGNEE,
        "dept_code": "FIN",
    },
    {
        "email": "fin.director@enterprise.local",
        "password": "DirectorPass123!",
        "full_name": "Carol Finance Director",
        "role": UserRole.AUTHORIZER,
        "dept_code": "FIN",
    },
    {
        "email": "it.agent@enterprise.local",
        "password": "AgentPass123!",
        "full_name": "Dave IT Specialist",
        "role": UserRole.ASSIGNEE,
        "dept_code": "IT",
    },
    {
        "email": "it.lead@enterprise.local",
        "password": "LeadPass123!",
        "full_name": "Eve IT Lead",
        "role": UserRole.AUTHORIZER,
        "dept_code": "IT",
    },
    {
        "email": "hr.agent@enterprise.local",
        "password": "AgentPass123!",
        "full_name": "Frank HR Recruiter",
        "role": UserRole.ASSIGNEE,
        "dept_code": "HR",
    },
    {
        "email": "hr.manager@enterprise.local",
        "password": "ManagerPass123!",
        "full_name": "Grace HR Manager",
        "role": UserRole.AUTHORIZER,
        "dept_code": "HR",
    },
    {
        "email": "auditor@enterprise.local",
        "password": "AuditorPass123!",
        "full_name": "Oliver Compliance Auditor",
        "role": UserRole.OBSERVER,
        "dept_code": None,
    },
]


async def seed_departments(db: AsyncSession) -> dict[str, Department]:
    dept_map = {}
    for data in DEPARTMENTS_DATA:
        stmt = select(Department).where(Department.code == data["code"])
        result = await db.execute(stmt)
        dept = result.scalars().first()
        if not dept:
            dept = Department(
                code=data["code"],
                name=data["name"],
                description=data["description"],
                is_active=True,
            )
            db.add(dept)
            await db.flush()
            logger.info(f"Created department: {dept.code} ({dept.name})")
        dept_map[dept.code] = dept
    return dept_map


async def seed_users(db: AsyncSession, dept_map: dict[str, Department]):
    for data in USERS_DATA:
        stmt = select(User).where(User.email == data["email"])
        result = await db.execute(stmt)
        user = result.scalars().first()
        dept_id = dept_map[data["dept_code"]].id if data["dept_code"] and data["dept_code"] in dept_map else None

        if not user:
            user = User(
                email=data["email"],
                hashed_password=get_password_hash(data["password"]),
                full_name=data["full_name"],
                role=data["role"],
                department_id=dept_id,
                is_active=True,
            )
            db.add(user)
            logger.info(f"Created user: {user.email} (Role: {user.role.value})")


async def seed_workflow_steps(db: AsyncSession, dept_map: dict[str, Department]):
    # Define workflows per department
    fin_dept = dept_map.get("FIN")
    it_dept = dept_map.get("IT")
    hr_dept = dept_map.get("HR")
    sd_dept = dept_map.get("SD")
    proc_dept = dept_map.get("PROC")

    workflows = []

    # 1. Finance Payment & Budget Approval Workflow
    if fin_dept:
        workflows.extend([
            {
                "department_id": fin_dept.id,
                "name": "Submit Payment Requisition",
                "from_state": TicketState.DRAFT,
                "to_state": TicketState.SUBMITTED,
                "required_role": UserRole.REQUESTER,
                "step_order": 1,
                "condition_rules": {},
            },
            {
                "department_id": fin_dept.id,
                "name": "Finance Initial Compliance Triage",
                "from_state": TicketState.SUBMITTED,
                "to_state": TicketState.PENDING_APPROVAL,
                "required_role": UserRole.ASSIGNEE,
                "step_order": 2,
                "condition_rules": {},
            },
            {
                "department_id": fin_dept.id,
                "name": "Director Budget Authorization",
                "from_state": TicketState.PENDING_APPROVAL,
                "to_state": TicketState.APPROVED,
                "required_role": UserRole.AUTHORIZER,
                "step_order": 3,
                "condition_rules": {},
            },
            {
                "department_id": fin_dept.id,
                "name": "Director Budget Rejection",
                "from_state": TicketState.PENDING_APPROVAL,
                "to_state": TicketState.REJECTED,
                "required_role": UserRole.AUTHORIZER,
                "step_order": 4,
                "condition_rules": {},
            },
            {
                "department_id": fin_dept.id,
                "name": "Begin Disbursement Processing",
                "from_state": TicketState.APPROVED,
                "to_state": TicketState.IN_PROGRESS,
                "required_role": UserRole.ASSIGNEE,
                "step_order": 5,
                "condition_rules": {},
            },
            {
                "department_id": fin_dept.id,
                "name": "Complete Disbursement & Reconcile",
                "from_state": TicketState.IN_PROGRESS,
                "to_state": TicketState.RESOLVED,
                "required_role": UserRole.ASSIGNEE,
                "step_order": 6,
                "condition_rules": {},
            },
            {
                "department_id": fin_dept.id,
                "name": "Confirm Receipt and Close",
                "from_state": TicketState.RESOLVED,
                "to_state": TicketState.CLOSED,
                "required_role": UserRole.REQUESTER,
                "step_order": 7,
                "condition_rules": {},
            },
        ])

    # 2. IT Support & Infrastructure Incident Workflow
    if it_dept:
        workflows.extend([
            {
                "department_id": it_dept.id,
                "name": "Submit IT Request / Bug Report",
                "from_state": TicketState.DRAFT,
                "to_state": TicketState.SUBMITTED,
                "required_role": UserRole.REQUESTER,
                "step_order": 1,
                "condition_rules": {},
            },
            {
                "department_id": it_dept.id,
                "name": "Accept Ticket & Start Diagnosis",
                "from_state": TicketState.SUBMITTED,
                "to_state": TicketState.IN_PROGRESS,
                "required_role": UserRole.ASSIGNEE,
                "step_order": 2,
                "condition_rules": {},
            },
            {
                "department_id": it_dept.id,
                "name": "Escalate for Hardware Budget Approval",
                "from_state": TicketState.IN_PROGRESS,
                "to_state": TicketState.PENDING_APPROVAL,
                "required_role": UserRole.ASSIGNEE,
                "step_order": 3,
                "condition_rules": {},
            },
            {
                "department_id": it_dept.id,
                "name": "Approve Hardware Purchase",
                "from_state": TicketState.PENDING_APPROVAL,
                "to_state": TicketState.APPROVED,
                "required_role": UserRole.AUTHORIZER,
                "step_order": 4,
                "condition_rules": {},
            },
            {
                "department_id": it_dept.id,
                "name": "Reject Hardware Purchase",
                "from_state": TicketState.PENDING_APPROVAL,
                "to_state": TicketState.REJECTED,
                "required_role": UserRole.AUTHORIZER,
                "step_order": 5,
                "condition_rules": {},
            },
            {
                "department_id": it_dept.id,
                "name": "Resume Work Post-Approval",
                "from_state": TicketState.APPROVED,
                "to_state": TicketState.IN_PROGRESS,
                "required_role": UserRole.ASSIGNEE,
                "step_order": 6,
                "condition_rules": {},
            },
            {
                "department_id": it_dept.id,
                "name": "Mark Issue Resolved",
                "from_state": TicketState.IN_PROGRESS,
                "to_state": TicketState.RESOLVED,
                "required_role": UserRole.ASSIGNEE,
                "step_order": 7,
                "condition_rules": {},
            },
            {
                "department_id": it_dept.id,
                "name": "Confirm Resolution and Close",
                "from_state": TicketState.RESOLVED,
                "to_state": TicketState.CLOSED,
                "required_role": UserRole.REQUESTER,
                "step_order": 8,
                "condition_rules": {},
            },
        ])

    # 3. HR / Recruitment Workflow
    if hr_dept:
        workflows.extend([
            {
                "department_id": hr_dept.id,
                "name": "Submit Job Requisition",
                "from_state": TicketState.DRAFT,
                "to_state": TicketState.SUBMITTED,
                "required_role": UserRole.REQUESTER,
                "step_order": 1,
                "condition_rules": {},
            },
            {
                "department_id": hr_dept.id,
                "name": "Submit for Headcount Approval",
                "from_state": TicketState.SUBMITTED,
                "to_state": TicketState.PENDING_APPROVAL,
                "required_role": UserRole.ASSIGNEE,
                "step_order": 2,
                "condition_rules": {},
            },
            {
                "department_id": hr_dept.id,
                "name": "Authorize Headcount",
                "from_state": TicketState.PENDING_APPROVAL,
                "to_state": TicketState.APPROVED,
                "required_role": UserRole.AUTHORIZER,
                "step_order": 3,
                "condition_rules": {},
            },
            {
                "department_id": hr_dept.id,
                "name": "Reject Headcount Requisition",
                "from_state": TicketState.PENDING_APPROVAL,
                "to_state": TicketState.REJECTED,
                "required_role": UserRole.AUTHORIZER,
                "step_order": 4,
                "condition_rules": {},
            },
            {
                "department_id": hr_dept.id,
                "name": "Start Sourcing Candidates",
                "from_state": TicketState.APPROVED,
                "to_state": TicketState.IN_PROGRESS,
                "required_role": UserRole.ASSIGNEE,
                "step_order": 5,
                "condition_rules": {},
            },
            {
                "department_id": hr_dept.id,
                "name": "Candidate Hired & Onboarding Done",
                "from_state": TicketState.IN_PROGRESS,
                "to_state": TicketState.RESOLVED,
                "required_role": UserRole.ASSIGNEE,
                "step_order": 6,
                "condition_rules": {},
            },
            {
                "department_id": hr_dept.id,
                "name": "Hiring Manager Sign-Off",
                "from_state": TicketState.RESOLVED,
                "to_state": TicketState.CLOSED,
                "required_role": UserRole.REQUESTER,
                "step_order": 7,
                "condition_rules": {},
            },
        ])

    # 4. SD & PROC Generic Standard Workflows
    for dept in [sd_dept, proc_dept]:
        if dept:
            workflows.extend([
                {
                    "department_id": dept.id,
                    "name": f"{dept.code} Submit Request",
                    "from_state": TicketState.DRAFT,
                    "to_state": TicketState.SUBMITTED,
                    "required_role": UserRole.REQUESTER,
                    "step_order": 1,
                    "condition_rules": {},
                },
                {
                    "department_id": dept.id,
                    "name": f"{dept.code} Start Execution",
                    "from_state": TicketState.SUBMITTED,
                    "to_state": TicketState.IN_PROGRESS,
                    "required_role": UserRole.ASSIGNEE,
                    "step_order": 2,
                    "condition_rules": {},
                },
                {
                    "department_id": dept.id,
                    "name": f"{dept.code} Mark Resolved",
                    "from_state": TicketState.IN_PROGRESS,
                    "to_state": TicketState.RESOLVED,
                    "required_role": UserRole.ASSIGNEE,
                    "step_order": 3,
                    "condition_rules": {},
                },
                {
                    "department_id": dept.id,
                    "name": f"{dept.code} Close Ticket",
                    "from_state": TicketState.RESOLVED,
                    "to_state": TicketState.CLOSED,
                    "required_role": UserRole.REQUESTER,
                    "step_order": 4,
                    "condition_rules": {},
                },
            ])

    for wf_data in workflows:
        stmt = select(WorkflowStep).where(
            WorkflowStep.department_id == wf_data["department_id"],
            WorkflowStep.from_state == wf_data["from_state"],
            WorkflowStep.to_state == wf_data["to_state"],
        )
        res = await db.execute(stmt)
        step = res.scalars().first()
        if not step:
            step = WorkflowStep(
                department_id=wf_data["department_id"],
                name=wf_data["name"],
                from_state=wf_data["from_state"],
                to_state=wf_data["to_state"],
                required_role=wf_data["required_role"],
                step_order=wf_data["step_order"],
                condition_rules=wf_data["condition_rules"],
                is_active=True,
            )
            db.add(step)
            logger.info(
                f"Created Workflow Step: Dept #{step.department_id} - "
                f"[{step.from_state.value} -> {step.to_state.value}] ({step.name})"
            )


async def seed_recurring_workflows(db: AsyncSession, dept_map: dict[str, Department]):
    from app.models.recurring import RecurringWorkflow
    from croniter import croniter

    now = datetime.now(timezone.utc)
    it_dept = dept_map.get("IT")
    fin_dept = dept_map.get("FIN")
    hr_dept = dept_map.get("HR")

    recurring_data = []
    if it_dept:
        recurring_data.append({
            "title": "Monthly Cloud Infrastructure & Security Audit",
            "description": "Perform AWS/Azure IAM access reviews, check unused EC2 instances, and verify backup snapshot retention.",
            "department_id": it_dept.id,
            "cron_expression": "0 9 1 * *",
            "priority": TicketPriority.HIGH,
            "metadata_template": {"audit_type": "Security & Cost Optimization", "compliance_framework": "SOC2"},
        })
    if fin_dept:
        recurring_data.append({
            "title": "Quarterly Financial Compliance & Requisition Reconciliation",
            "description": "Reconcile corporate purchase orders against general ledger disbursements and verify tax documentation.",
            "department_id": fin_dept.id,
            "cron_expression": "0 9 1 1,4,7,10 *",
            "priority": TicketPriority.HIGH,
            "metadata_template": {"quarter": "Q1", "audit_scope": "Vendor Accounts"},
        })
    if hr_dept:
        recurring_data.append({
            "title": "Bi-Weekly Headcount Planning & Talent Review",
            "description": "Review open positions across engineering and operations against approved budget headcount allocations.",
            "department_id": hr_dept.id,
            "cron_expression": "0 9 1,15 * *",
            "priority": TicketPriority.MEDIUM,
            "metadata_template": {"recruitment_cycle": "Standard"},
        })

    for r_data in recurring_data:
        stmt = select(RecurringWorkflow).where(RecurringWorkflow.title == r_data["title"])
        res = await db.execute(stmt)
        if not res.scalars().first():
            iter_cron = croniter(r_data["cron_expression"], now)
            next_run = iter_cron.get_next(datetime)
            rw = RecurringWorkflow(
                title=r_data["title"],
                description=r_data["description"],
                department_id=r_data["department_id"],
                cron_expression=r_data["cron_expression"],
                priority=r_data["priority"],
                metadata_template=r_data["metadata_template"],
                is_active=True,
                next_run_at=next_run,
                created_at=now,
                updated_at=now,
            )
            db.add(rw)
            logger.info(f"Created Recurring Workflow: '{rw.title}' (Cron: {rw.cron_expression})")


async def main():
    logger.info("Starting enterprise database schema creation and seeding...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session_factory() as session:
        dept_map = await seed_departments(session)
        await session.commit()

        await seed_users(session, dept_map)
        await session.commit()

        await seed_workflow_steps(session, dept_map)
        await session.commit()

        await seed_recurring_workflows(session, dept_map)
        await session.commit()

    logger.info("Enterprise Seeding successfully completed!")


if __name__ == "__main__":
    asyncio.run(main())
