"""Read-only access to company KPI data for the AI pipeline ("the socket").

Every query is filtered by company_id. It does not know or care whether the
data is fake or real. Duplicate (metric, date) rows are returned as stored;
facts.py decides how to handle them.
"""

from datetime import date

from sqlalchemy.orm import Session

from app.models.company import Company
from app.models.kpi import KPI


Series = list[tuple[date, float]]


def get_company(db: Session, company_id: int) -> Company | None:
    return db.get(Company, company_id)


def available_metrics(db: Session, company_id: int) -> list[str]:
    rows = (
        db.query(KPI.metric_name)
        .filter(KPI.company_id == company_id)
        .distinct()
        .order_by(KPI.metric_name)
        .all()
    )
    return [name for (name,) in rows]


def get_series(
    db: Session,
    company_id: int,
    metric: str,
    start: date | None = None,
    end: date | None = None,
) -> Series:
    """[(date, value)] sorted by date (then insertion order), start/end inclusive."""
    query = db.query(KPI.metric_date, KPI.metric_value).filter(
        KPI.company_id == company_id,
        KPI.metric_name == metric,
    )
    if start is not None:
        query = query.filter(KPI.metric_date >= start)
    if end is not None:
        query = query.filter(KPI.metric_date <= end)

    rows = query.order_by(KPI.metric_date, KPI.id).all()
    return [(d, float(v)) for d, v in rows]
