from typing import Any, Dict, List
from pydantic import BaseModel, Field

from app.models.ticket import TicketPriority


class TriageRequest(BaseModel):
    title: str = Field(..., min_length=2, max_length=255, description="Ticket title or summary")
    description: str = Field(..., min_length=5, description="Detailed problem statement or requisition")


class TriageResponse(BaseModel):
    suggested_department_code: str = Field(..., description="Suggested department code e.g. IT, FIN, HR, SD, PROC")
    suggested_priority: TicketPriority = Field(..., description="Inferred priority level based on severity")
    extracted_tags: List[str] = Field(default_factory=list, description="Categorization keywords")
    confidence_score: float = Field(..., ge=0.0, le=1.0, description="Confidence metric (0.0 to 1.0)")
    suggested_first_response: str = Field(..., description="AI suggested template acknowledgement or troubleshooting guide")
    key_entities: Dict[str, Any] = Field(default_factory=dict, description="Extracted structured parameters (amounts, systems, etc.)")
