from datetime import datetime

from sqlalchemy import DateTime, Index, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.financial_record import FinancialRecord
    from app.models.forecast import Forecast
    from app.models.kpi import KPI
    from app.models.scenario import Scenario
    from app.models.user import User

class Company(Base):
    __tablename__ = "companies"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    industry: Mapped[str | None] = mapped_column(String(100), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        server_default=func.now(),
        nullable=False,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    kpis: Mapped[list["KPI"]] = relationship(
        back_populates="company",
        passive_deletes=True,
    )
    users: Mapped[list["User"]] = relationship(
        back_populates="company",
        passive_deletes=True,
    )
    financial_records: Mapped[list["FinancialRecord"]] = relationship(
        back_populates="company",
        passive_deletes=True,
    )
    forecasts: Mapped[list["Forecast"]] = relationship(
        back_populates="company",
        passive_deletes=True,
    )
    scenarios: Mapped[list["Scenario"]] = relationship(
        back_populates="company",
        passive_deletes=True,
    )


Index("uq_companies_name_normalized", func.lower(Company.name), unique=True)
