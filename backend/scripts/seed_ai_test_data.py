"""Seed FAKE test data for the AI Business Analyst.

Inserts 3 fake companies x 24 months (Jan 2024 - Dec 2025) x 3 metrics
(revenue, expenses, profit) through the team's own models, i.e. into the
same `companies` / `kpis` tables that real data uses.

Run from backend/:
    python -m scripts.seed_ai_test_data           # insert (skips companies that already exist)
    python -m scripts.seed_ai_test_data --reset   # delete ONLY the fake companies + their KPIs
"""

import argparse
import calendar
import random
from datetime import date
from decimal import Decimal

from sqlalchemy.orm import Session

from app.database import engine
from app.models.company import Company
from app.models.kpi import KPI


FAKE_DESCRIPTION = "AI test data (fake)"

START_YEAR = 2024
MONTHS = 24


def month_end(year: int, month: int) -> date:
    return date(year, month, calendar.monthrange(year, month)[1])


def month_dates() -> list[date]:
    dates = []
    for i in range(MONTHS):
        year = START_YEAR + i // 12
        month = i % 12 + 1
        dates.append(month_end(year, month))
    return dates


def _retail(t: int, d: date, rng: random.Random) -> tuple[float, float]:
    """Revenue dips sharply in March 2025, then recovers over Apr-May."""
    revenue = 12_000_000 * (1.008 ** t) * rng.uniform(0.98, 1.02)
    dip = {(2025, 3): 0.62, (2025, 4): 0.85, (2025, 5): 0.96}
    revenue *= dip.get((d.year, d.month), 1.0)
    # Expenses are mostly fixed (rent, salaries), so they barely follow the dip.
    expenses = 9_800_000 * (1.006 ** t) * rng.uniform(0.98, 1.02)
    return revenue, expenses


def _saas(t: int, d: date, rng: random.Random) -> tuple[float, float]:
    """Steady growth; profit turns from negative to positive in mid-2024."""
    revenue = 2_000_000 * (1.05 ** t) * rng.uniform(0.995, 1.005)
    expenses = 2_400_000 * (1.015 ** t) * rng.uniform(0.995, 1.005)
    return revenue, expenses


def _foods(t: int, d: date, rng: random.Random) -> tuple[float, float]:
    """Revenue grows, expenses grow faster, so profit shrinks."""
    revenue = 8_000_000 * (1.01 ** t) * rng.uniform(0.99, 1.01)
    expenses = 6_800_000 * (1.016 ** t) * rng.uniform(0.99, 1.01)
    return revenue, expenses


FAKE_COMPANIES = [
    {"name": "Test Retail Pvt Ltd", "industry": "Retail", "model": _retail, "seed": 1},
    {"name": "Test SaaS Labs", "industry": "Software", "model": _saas, "seed": 2},
    {"name": "Test Foods Co", "industry": "FMCG", "model": _foods, "seed": 3},
]


def build_rows(company: dict) -> list[tuple[str, date, Decimal]]:
    """Pure: the (metric_name, metric_date, metric_value) rows for one fake company.

    Values are whole rupees; profit = revenue - expenses exactly.
    """
    rng = random.Random(company["seed"])
    rows = []
    for t, d in enumerate(month_dates()):
        revenue, expenses = company["model"](t, d, rng)
        revenue = Decimal(round(revenue))
        expenses = Decimal(round(expenses))
        rows.append(("revenue", d, revenue))
        rows.append(("expenses", d, expenses))
        rows.append(("profit", d, revenue - expenses))
    return rows


def _existing(db: Session, name: str) -> Company | None:
    return (
        db.query(Company)
        .filter(Company.name == name, Company.description == FAKE_DESCRIPTION)
        .first()
    )


def seed(db: Session) -> None:
    for spec in FAKE_COMPANIES:
        company = _existing(db, spec["name"])
        if company is not None:
            print(f"skip   {spec['name']} (id {company.id}) - already exists")
            continue

        company = Company(
            name=spec["name"],
            industry=spec["industry"],
            description=FAKE_DESCRIPTION,
        )
        db.add(company)
        db.flush()

        rows = build_rows(spec)
        db.add_all(
            KPI(
                company_id=company.id,
                metric_name=metric,
                metric_date=d,
                metric_value=value,
            )
            for metric, d, value in rows
        )
        print(f"insert {spec['name']} (id {company.id}) - {len(rows)} KPI rows")
    db.commit()


def reset(db: Session) -> None:
    for spec in FAKE_COMPANIES:
        company = _existing(db, spec["name"])
        if company is None:
            continue
        deleted = db.query(KPI).filter(KPI.company_id == company.id).delete()
        db.delete(company)
        print(f"delete {spec['name']} (id {company.id}) - {deleted} KPI rows")
    db.commit()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument(
        "--reset",
        action="store_true",
        help="delete only the fake companies and their KPIs",
    )
    args = parser.parse_args()

    with Session(engine) as db:
        if args.reset:
            reset(db)
        else:
            seed(db)


if __name__ == "__main__":
    main()
