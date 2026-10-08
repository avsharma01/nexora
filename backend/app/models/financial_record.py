from datetime import date, datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Numeric,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.company import Company


class FinancialRecord(Base):
    __tablename__ = "financial_records"
    __table_args__ = (
        UniqueConstraint(
            "company_id", "record_date", name="uq_financial_records_company_date"
        ),
        CheckConstraint(
            "revenue > -100000000000000000 AND revenue < 100000000000000000",
            name="ck_financial_records_revenue_finite",
        ),
        CheckConstraint(
            "expenses >= 0 AND expenses < 100000000000000000",
            name="ck_financial_records_expenses_valid",
        ),
        CheckConstraint(
            "profit > -100000000000000000 AND profit < 100000000000000000",
            name="ck_financial_records_profit_finite",
        ),
        CheckConstraint("length(trim(currency)) = 3", name="ck_financial_records_currency"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(
        ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False
    )
    record_date: Mapped[date] = mapped_column(Date, nullable=False)
    revenue: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    expenses: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    profit: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="USD")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    company: Mapped["Company"] = relationship(back_populates="financial_records")
