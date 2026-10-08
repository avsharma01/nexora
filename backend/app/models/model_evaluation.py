from datetime import datetime
from decimal import Decimal

from sqlalchemy import CheckConstraint, DateTime, Index, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ModelEvaluation(Base):
    __tablename__ = "model_evaluations"
    __table_args__ = (
        CheckConstraint(
            "value > -100000000000000000 AND value < 100000000000000000",
            name="ck_model_evaluations_value_finite",
        ),
        Index("ix_model_evaluations_model_metric", "model_version", "metric"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    model_version: Mapped[str] = mapped_column(String(100), nullable=False)
    metric: Mapped[str] = mapped_column(String(100), nullable=False)
    value: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    evaluation_period: Mapped[str] = mapped_column(String(100), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
