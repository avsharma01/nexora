from sqlalchemy.orm import Session

from app.ai import ai_service
from app.ai.llm import LLMError
from app.models.ai_insight import AIInsight
from app.schemas.ai_analyst import AIAnalystResponse


def _log_insight(db: Session, **fields) -> AIInsight:
    insight = AIInsight(**fields)
    db.add(insight)
    db.commit()
    db.refresh(insight)
    return insight


def get_ai_analysis(
    db: Session,
    company_id: int,
    question: str,
    user_id: int | None = None,
    history: list[dict] | None = None,
) -> AIAnalystResponse:
    """Run the AI Business Analyst pipeline (app/ai) and log the call to ai_insights.

    Raises LLMError when the LLM provider is unavailable (logged with status "error").
    """
    try:
        result = ai_service.ask(db, company_id, question, history)
    except LLMError as exc:
        _log_insight(
            db,
            user_id=user_id,
            company_id=company_id,
            question=question,
            status="error",
            is_grounded=False,
            error=str(exc)[:2000],
        )
        raise

    meta = result["meta"]
    insight = _log_insight(
        db,
        user_id=user_id,
        company_id=company_id,
        question=question,
        answer=result["answer"],
        status=result["status"],
        is_grounded=result["is_grounded"],
        figures=result["figures"],
        sources=result["sources"],
        intent=(meta.get("intent") or {}).get("code"),
        guard_reason=(meta.get("guard") or {}).get("reason"),
        model=meta.get("model"),
        retried=bool(meta.get("retried")),
        latency_ms=meta.get("latency_ms"),
    )

    return AIAnalystResponse(
        company_id=company_id,
        question=question,
        answer=result["answer"],
        insight_id=insight.id,
        status=result["status"],
        is_grounded=result["is_grounded"],
        figures=result["figures"],
        sources=result["sources"],
        generated_at=result["generated_at"],
    )
