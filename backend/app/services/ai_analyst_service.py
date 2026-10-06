from sqlalchemy.orm import Session

from app.models.kpi import KPI
from app.schemas.ai_analyst import AIAnalystResponse


def get_ai_analysis(
    db: Session,
    company_id: int,
    question: str,
) -> AIAnalystResponse:

    kpis = (
        db.query(KPI)
        .filter(KPI.company_id == company_id)
        .order_by(KPI.metric_date.desc())
        .all()
    )

    if not kpis:
        answer = (
            "There is not enough KPI data available for this company "
            "to provide a business analysis."
        )

        return AIAnalystResponse(
            company_id=company_id,
            question=question,
            answer=answer,
        )

    latest_kpis = kpis[:5]

    context_lines = [
        f"{kpi.metric_name}: {float(kpi.metric_value)} "
        f"on {kpi.metric_date}"
        for kpi in latest_kpis
    ]

    context = "\n".join(context_lines)

    answer = (
        "AI analysis is not connected yet. "
        "The available business context is:\n"
        f"{context}\n\n"
        f"Question received: {question}"
    )

    return AIAnalystResponse(
        company_id=company_id,
        question=question,
        answer=answer,
    )