"""Insert a small, repeatable synthetic monthly dataset for local demos.

Run from the backend directory with ``python -m app.seed_data`` after the
database has been initialized. These values are illustrative, not real company
financial data.
"""

from datetime import date

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import Base, engine
from app.models import Company, FinancialRecord, KPI, User  # noqa: F401
from app.models.company import Company as CompanyModel


HISTORY_MONTHS = 24
SEED_EPOCH = date(2024, 10, 1)
COMPANIES = (
    # name, industry, opening monthly revenue, monthly trend, volatility
    ("Northstar Retail", "Retail", 420_000, 5_200, 13_000),
    ("Cedar Health", "Healthcare", 610_000, 4_100, 9_000),
    ("Orbit Software", "Software", 285_000, 7_500, 11_000),
)


def _month_start(months_ago: int, today: date) -> date:
    month_index = today.year * 12 + today.month - 1 - months_ago
    year, month = divmod(month_index, 12)
    return date(year, month + 1, 1)


def seed_data(db: Session, today: date | None = None) -> int:
    """Insert missing synthetic records; return the number of inserted rows."""
    today = today or date.today()
    inserted = 0

    for company_name, industry, opening, trend, amplitude in COMPANIES:
        company = (
            db.query(CompanyModel)
            .filter(func.lower(CompanyModel.name) == company_name.lower())
            .one_or_none()
        )
        if company is None:
            company = Company(
                name=company_name,
                industry=industry,
                description="Synthetic demonstration company data.",
            )
            db.add(company)
            db.flush()

        existing = {
            (row.metric_name, row.metric_date)
            for row in db.query(KPI)
            .filter(KPI.company_id == company.id)
            .all()
        }
        existing_financial_dates = {
            row.record_date
            for row in db.query(FinancialRecord)
            .filter(FinancialRecord.company_id == company.id)
            .all()
        }

        for months_ago in range(HISTORY_MONTHS, 0, -1):
            # Seed complete calendar months only; the current month is partial.
            period = _month_start(months_ago, today)
            # Anchor synthetic values to the month, not the moving seed window,
            # so future reruns never change the trend for a given period.
            index = (period.year - SEED_EPOCH.year) * 12 + period.month - SEED_EPOCH.month
            seasonal = (0, 4, -2, 1, -3, 2, -1, 3, -2, 1, 5, 8)[period.month - 1]
            revenue = round(opening + trend * index + amplitude * seasonal / 8, 2)
            expenses = round(revenue * (0.68 + (index % 5) * 0.005), 2)
            values = {
                "revenue": revenue,
                "expenses": expenses,
                "profit": round(revenue - expenses, 2),
            }

            if period not in existing_financial_dates:
                db.add(
                    FinancialRecord(
                        company_id=company.id,
                        record_date=period,
                        revenue=revenue,
                        expenses=expenses,
                        profit=values["profit"],
                        currency="USD",
                    )
                )
                existing_financial_dates.add(period)
                inserted += 1

            for metric_name, metric_value in values.items():
                key = (metric_name, period)
                if key in existing:
                    continue
                db.add(
                    KPI(
                        company_id=company.id,
                        metric_name=metric_name,
                        metric_value=metric_value,
                        metric_date=period,
                    )
                )
                existing.add(key)
                inserted += 1

    db.commit()
    return inserted


def main() -> None:
    with Session(engine) as db:
        inserted = seed_data(db)
    print(f"Seed complete: inserted {inserted} rows across {len(COMPANIES)} companies.")


if __name__ == "__main__":
    # Import models above before create_all so all tables are registered.
    Base.metadata.create_all(bind=engine)
    main()
