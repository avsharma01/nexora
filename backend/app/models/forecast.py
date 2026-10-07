from datetime import date, datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Numeric,
    String,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.company import Company


class Forecast(Base):
    __tablename__ = "forecasts"
    __table_args__ = (
        CheckConstraint(
            "predicted_value > -100000000000000000 AND predicted_value < 100000000000000000",
            name="ck_forecasts_predicted_value_finite",
        ),
        CheckConstraint(
            "(lower_bound IS NULL AND upper_bound IS NULL) OR "
            "(lower_bound IS NOT NULL AND upper_bound IS NOT NULL AND "
            "lower_bound <= predicted_value AND predicted_value <= upper_bound)",
            name="ck_forecasts_bounds_ordered",
        ),
        Index(
            "ix_forecasts_company_metric_date",
            "company_id",
            "metric_name",
            "forecast_date",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(
        ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False
    )
    metric_name: Mapped[str] = mapped_column(String(100), nullable=False)
    forecast_date: Mapped[date] = mapped_column(Date, nullable=False)
    predicted_value: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    lower_bound: Mapped[Decimal | None] = mapped_column(Numeric(18, 2), nullable=True)
    upper_bound: Mapped[Decimal | None] = mapped_column(Numeric(18, 2), nullable=True)
    model_version: Mapped[str] = mapped_column(String(100), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    company: Mapped["Company"] = relationship(back_populates="forecasts")
