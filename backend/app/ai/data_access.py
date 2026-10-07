"""Read-only access to company KPI data for the AI pipeline ("the socket").

Every query is filtered by company_id. It does not know or care whether the
data is fake or real. Duplicate (metric, date) rows are returned as stored;
facts.py decides how to handle them.
"""

from datetime import date

from sqlalchemy import func, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.models.company import Company
from app.models.kpi import KPI


Series = list[tuple[date, float]]


def get_company(db: Session, company_id: int) -> Company | None:
    return db.get(Company, company_id)


def available_metrics(db: Session, company_id: int) -> list[str]:
    """Metric names in lower case: seeds disagree on case ("Revenue" vs "revenue")."""
    name = func.lower(func.trim(KPI.metric_name))
    rows = (
        db.query(name)
        .filter(KPI.company_id == company_id)
        .distinct()
        .order_by(name)
        .all()
    )
    return [metric for (metric,) in rows]


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
        func.lower(func.trim(KPI.metric_name)) == metric.strip().lower(),
    )
    if start is not None:
        query = query.filter(KPI.metric_date >= start)
    if end is not None:
        query = query.filter(KPI.metric_date <= end)

    rows = query.order_by(KPI.metric_date, KPI.id).all()
    return [(d, float(v)) for d, v in rows]


def latest_date(db: Session, company_id: int) -> date | None:
    """Most recent KPI date for the company; relative periods are measured from it."""
    return (
        db.query(func.max(KPI.metric_date))
        .filter(KPI.company_id == company_id)
        .scalar()
    )


def earliest_date(db: Session, company_id: int) -> date | None:
    return (
        db.query(func.min(KPI.metric_date))
        .filter(KPI.company_id == company_id)
        .scalar()
    )


def company_currency(db: Session, company_id: int) -> str | None:
    """The company's currency from financial_records (Athira's table), or None.

    None when the table does not exist yet (before her branch is merged) or the
    company has no financial records (e.g. the fake AI test companies).
    """
    try:
        if not db.execute(text("select to_regclass('financial_records') is not null")).scalar():
            return None
        return db.execute(
            text(
                "select currency from financial_records where company_id = :cid "
                "order by record_date desc limit 1"
            ),
            {"cid": company_id},
        ).scalar()
    except SQLAlchemyError:
        db.rollback()
        return None


def list_companies(db: Session) -> list[tuple[int, str]]:
    """[(id, name)] of all companies; used by the guard to spot other-company requests."""
    return [(cid, name) for cid, name in db.query(Company.id, Company.name).order_by(Company.id)]
