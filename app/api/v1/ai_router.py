from fastapi import APIRouter, Depends
from app.api.deps import get_current_active_user
from app.models.user import User
from app.schemas.ai_triage import TriageRequest, TriageResponse
from app.services.ai_triage import ai_triage_service

router = APIRouter()


@router.post("/smart-classify", response_model=TriageResponse, summary="AI-powered smart classification and triage")
async def smart_classify_ticket(
    request: TriageRequest,
    current_user: User = Depends(get_current_active_user),
) -> TriageResponse:
    """
    Intelligently classify incoming ticket text to suggest target department,
    priority level, tags, structured entity attributes, and a recommended first response.
    """
    return ai_triage_service.classify_ticket(
        title=request.title,
        description=request.description,
    )
