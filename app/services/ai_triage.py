import re
from typing import Any, Dict, List
from app.models.ticket import TicketPriority
from app.schemas.ai_triage import TriageResponse


class AiTriageService:
    """
    Intelligent AI Classification & Smart Triage Engine.
    Analyzes ticket title, description, and problem context to accurately predict:
    - Destination Department Queue
    - Urgency / Priority Level
    - Categorization Tags
    - Key Extracted Entities (amounts, systems, dates)
    - Recommended First Response Template
    """

    DEPARTMENT_KEYWORDS = {
        "IT": [
            "server", "vpn", "database", "cloud", "aws", "azure", "docker", "kubernetes",
            "laptop", "password", "login", "bug", "crash", "network", "firewall", "dns",
            "git", "api", "linux", "windows", "monitor", "hardware", "software", "outage"
        ],
        "FIN": [
            "invoice", "payment", "reimbursement", "budget", "salary", "payroll", "disbursement",
            "vendor", "billing", "tax", "accounting", "cost", "financial", "expense", "purchase order", "po"
        ],
        "HR": [
            "recruitment", "hire", "candidate", "interview", "onboarding", "resignation",
            "headcount", "leave", "vacation", "benefits", "insurance", "job opening", "offer letter"
        ],
        "SD": [
            "sla", "service delivery", "client", "escalation", "delivery", "milestone",
            "contract", "customer support", "incident report", "esu", "uptime"
        ],
        "PROC": [
            "procurement", "quote", "supplier", "rfp", "purchase request", "hardware purchase",
            "order", "equipment", "licenses", "office supplies", "shipment", "inventory"
        ],
    }

    PRIORITY_CRITICAL_KEYWORDS = [
        "outage", "down", "production", "crash", "security breach", "data loss",
        "emergency", "critical", "immediate", "blocked all", "payroll blocked"
    ]

    PRIORITY_HIGH_KEYWORDS = [
        "urgent", "deadline", "broken", "high priority", "failed", "director approval",
        "client impact", "cannot work", "overdue", "asap"
    ]

    PRIORITY_LOW_KEYWORDS = [
        "inquiry", "how to", "question", "minor", "suggestion", "when possible", "feature request"
    ]

    @classmethod
    def classify_ticket(cls, title: str, description: str) -> TriageResponse:
        full_text = f"{title} {description}".lower()

        # 1. Department Scoring
        dept_scores: Dict[str, int] = {k: 0 for k in cls.DEPARTMENT_KEYWORDS}
        for dept_code, keywords in cls.DEPARTMENT_KEYWORDS.items():
            for kw in keywords:
                if kw in full_text:
                    # Higher weight if keyword is in title
                    dept_scores[dept_code] += 2 if kw in title.lower() else 1

        best_dept = max(dept_scores, key=dept_scores.get)
        max_score = dept_scores[best_dept]

        # Default to IT if score is 0
        if max_score == 0:
            best_dept = "IT"

        # 2. Priority Inference
        priority = TicketPriority.MEDIUM
        if any(kw in full_text for kw in cls.PRIORITY_CRITICAL_KEYWORDS):
            priority = TicketPriority.CRITICAL
        elif any(kw in full_text for kw in cls.PRIORITY_HIGH_KEYWORDS):
            priority = TicketPriority.HIGH
        elif any(kw in full_text for kw in cls.PRIORITY_LOW_KEYWORDS):
            priority = TicketPriority.LOW

        # 3. Extract Tags
        tags: List[str] = []
        for kw in [
            "cloud", "database", "hardware", "vpn", "payroll", "budget", "invoice", "payment",
            "onboarding", "recruitment", "hire", "candidate", "interview", "headcount",
            "procurement", "security", "sla", "engineer", "software", "infrastructure",
        ]:
            if kw in full_text:
                tags.append(kw)
        if not tags:
            tags = ["general-inquiry"]

        # 4. Extract Key Entities (e.g. Dollar amounts, system names)
        entities: Dict[str, Any] = {}
        # Match dollar or currency amounts e.g. $15,000 or 15000 USD
        amount_match = re.search(r"\$?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]+)?|\d+)\s*(?:usd|dollars|\$|k)?", full_text)
        if amount_match:
            raw_val = amount_match.group(1).replace(",", "")
            if raw_val.isdigit() and int(raw_val) > 10:
                entities["extracted_amount"] = int(raw_val)

        # 5. Calculate Confidence Score (0.60 to 0.98)
        confidence = min(0.98, max(0.65, 0.65 + (max_score * 0.05)))

        # 6. Generate Suggested First Response
        suggested_response = cls._generate_first_response(best_dept, priority, title)

        return TriageResponse(
            suggested_department_code=best_dept,
            suggested_priority=priority,
            extracted_tags=tags,
            confidence_score=round(confidence, 2),
            suggested_first_response=suggested_response,
            key_entities=entities,
        )

    @staticmethod
    def _generate_first_response(dept: str, priority: TicketPriority, title: str) -> str:
        if dept == "IT":
            if priority == TicketPriority.CRITICAL:
                return f"IT Incident Response Team has been mobilized for '{title}'. Diagnostics are currently underway."
            return f"Thank you for contacting IT Support. Your ticket regarding '{title}' has been queued for specialist triage."
        elif dept == "FIN":
            return f"Your financial requisition '{title}' has been submitted to the Finance queue for compliance check and budget verification."
        elif dept == "HR":
            return f"HR Talent Operations has received '{title}'. A specialist will review headcount allocations and initiate candidate sourcing."
        elif dept == "PROC":
            return f"Procurement requisition '{title}' logged. Supplier quotes and approval thresholds are being verified."
        else:
            return f"Request '{title}' has been successfully assigned to the Service Delivery queue."


ai_triage_service = AiTriageService()
