from typing import Any, Dict, List, Optional
from pydantic import BaseModel


class DepartmentMetrics(BaseModel):
    department_id: int
    department_code: str
    department_name: str
    total_tickets: int
    resolved_tickets: int
    active_tickets: int
    mttr_hours: float
    sla_compliance_rate: float


class TimeSeriesDataPoint(BaseModel):
    date: str
    created_count: int
    resolved_count: int
    escalated_count: int


class AnalyticsOverviewResponse(BaseModel):
    total_tickets: int
    active_backlog: int
    resolved_tickets: int
    sla_compliance_rate: float
    overall_mttr_hours: float
    escalation_rate: float
    priority_distribution: Dict[str, int]
    status_distribution: Dict[str, int]
    department_breakdown: List[DepartmentMetrics]
    time_series: List[TimeSeriesDataPoint]
    timeframe_days: int
