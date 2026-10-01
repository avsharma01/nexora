from datetime import date

from sqlalchemy import Date, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from datetime import date
from typing import TYPE_CHECKING

from sqlalchemy import Date, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.company import Company

class KPI(Base):
    __tablename__ = "kpis"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    company_id: Mapped[int] = mapped_column(
        ForeignKey("companies.id"),
        nullable=False,
    )

    metric_name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    metric_value: Mapped[float] = mapped_column(
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