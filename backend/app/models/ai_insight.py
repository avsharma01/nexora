from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class AIInsight(Base):
    """One row per AI Analyst call (SPEC §7 persistence), including failed ones."""

    __tablename__ = "ai_insights"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"),
        nullable=True,
        index=True,
    )

    company_id: Mapped[int] = mapped_column(
        ForeignKey("companies.id"),
        nullable=False,
        index=True,
    )

    question: Mapped[str] = mapped_column(Text, nullable=False)
    answer: Mapped[str | None] = mapped_column(Text, nullable=True)

    # answered | insufficient_data | out_of_scope | error (LLM unavailable)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    is_grounded: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    figures: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    sources: Mapped[list] = mapped_column(JSON, nullable=False, default=list)

    intent: Mapped[str | None] = mapped_column(String(8), nullable=True)
    guard_reason: Mapped[str | None] = mapped_column(String(32), nullable=True)
    model: Mapped[str | None] = mapped_column(String(100), nullable=True)
    retried: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    latency_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )
