from datetime import date
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, Date, ForeignKey, Index, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.company import Company

class KPI(Base):
    __tablename__ = "kpis"
    __table_args__ = (
        CheckConstraint("length(trim(metric_name)) > 0", name="ck_kpis_metric_name_nonempty"),
        CheckConstraint(
            "metric_value > -100000000000000000 AND metric_value < 100000000000000000",
            name="ck_kpis_metric_value_finite",
        ),
        Index("ix_kpis_company_metric_date", "company_id", "metric_name", "metric_date"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)

    company_id: Mapped[int] = mapped_column(
        ForeignKey("companies.id", ondelete="RESTRICT"),
        nullable=False,
    )

    metric_name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    metric_value: Mapped[Decimal] = mapped_column(
        Numeric(18, 2),
        nullable=False,
    )

    metric_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
    )

    company: Mapped["Company"] = relationship(
        back_populates="kpis"
    )
