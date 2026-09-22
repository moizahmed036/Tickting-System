"""
API v1 route handlers.
"""
from fastapi import APIRouter

from app.api.v1.auth_router import router as auth_router
from app.api.v1.admin_router import router as admin_router
from app.api.v1.ticket_router import router as ticket_router
from app.api.v1.workflow_router import router as workflow_router
from app.api.v1.recurring_router import router as recurring_router
from app.api.v1.ai_router import router as ai_router
from app.api.v1.email_webhook_router import router as email_webhook_router
from app.api.v1.email_reader_router import router as email_reader_router

api_v1_router = APIRouter()

api_v1_router.include_router(auth_router, prefix="/auth", tags=["Authentication"])
api_v1_router.include_router(admin_router, prefix="/admin", tags=["Super Admin Management"])
api_v1_router.include_router(ticket_router, prefix="/tickets", tags=["Tickets & Queue Management"])
api_v1_router.include_router(workflow_router, prefix="/workflows", tags=["Workflow & Department Configuration"])
api_v1_router.include_router(recurring_router, prefix="/recurring", tags=["Recurring Scheduled Workflows"])
api_v1_router.include_router(ai_router, prefix="/ai", tags=["AI Classification & Triage"])
api_v1_router.include_router(email_webhook_router, prefix="/webhooks", tags=["Inbound Email Webhooks"])
api_v1_router.include_router(email_reader_router, prefix="/emails", tags=["AI Email Reader & Tasks"])

__all__ = ["api_v1_router"]


