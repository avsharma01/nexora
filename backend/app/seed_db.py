from datetime import date
from sqlalchemy.orm import Session

from app.core.roles import UserRole
from app.core.security import hash_password
from app.database import Base, engine
from app.models.company import Company
from app.models.kpi import KPI
from app.models.user import User


def seed_database():
    Base.metadata.create_all(bind=engine)

    with Session(engine) as db:
        # 1. Seed Demo Users
        users_data = [
            ("admin@nexora.io", "demo123", UserRole.ADMIN),
            ("analyst@nexora.io", "demo123", UserRole.ANALYST),
            ("viewer@nexora.io", "demo123", UserRole.VIEWER),
        ]

        for email, password, role in users_data:
            existing = db.query(User).filter(User.email == email).first()
            if not existing:
                user = User(
                    email=email,
                    hashed_password=hash_password(password),
                    role=role,
                    is_active=True,
                )
                db.add(user)

        # 2. Seed Companies
        companies_data = [
            {
                "name": "Bharat FinServe Ltd",
                "industry": "Retail Banking",
                "description": "Leading retail banking and financial services provider based in Mumbai.",
                "rev": [42, 44, 43, 47, 49, 52, 51, 55, 58, 57, 61, 64],
                "exp": [36, 37, 37, 39, 41, 43, 43, 45, 47, 47, 49, 51],
            },
            {
                "name": "Kisan Wealth Advisors",
                "industry": "Wealth Management",
                "description": "Wealth management and advisory firm based in Pune.",
                "rev": [18, 19, 19, 21, 20, 22, 24, 23, 25, 27, 26, 29],
                "exp": [15, 16, 15, 17, 17, 18, 19, 19, 20, 21, 21, 22],
            },
            {
                "name": "Sahaj Payments",
                "industry": "Payments / Fintech",
                "description": "Digital payments and fintech infrastructure provider based in Bengaluru.",
                "rev": [30, 31, 35, 33, 36, 38, 37, 41, 40, 44, 43, 47],
                "exp": [27, 27, 30, 29, 31, 32, 33, 35, 34, 37, 37, 39],
            },
        ]

        # Dates for 12 months (Oct to Sep)
        dates = [
            date(2025, 10, 1),
            date(2025, 11, 1),
            date(2025, 12, 1),
            date(2026, 1, 1),
            date(2026, 2, 1),
            date(2026, 3, 1),
            date(2026, 4, 1),
            date(2026, 5, 1),
            date(2026, 6, 1),
            date(2026, 7, 1),
            date(2026, 8, 1),
            date(2026, 9, 1),
        ]

        for c_data in companies_data:
            company = db.query(Company).filter(Company.name == c_data["name"]).first()
            if not company:
                company = Company(
                    name=c_data["name"],
                    industry=c_data["industry"],
                    description=c_data["description"],
                )
                db.add(company)
                db.flush()

                # Seed KPIs
                for i, d in enumerate(dates):
                    rev_kpi = KPI(
                        company_id=company.id,
                        metric_name="Revenue",
                        metric_value=float(c_data["rev"][i]),
                        metric_date=d,
                    )
                    exp_kpi = KPI(
                        company_id=company.id,
                        metric_name="Expenses",
                        metric_value=float(c_data["exp"][i]),
                        metric_date=d,
                    )
                    db.add(rev_kpi)
                    db.add(exp_kpi)

        db.commit()
        print("Database seeded successfully with demo users, companies, and KPIs.")


if __name__ == "__main__":
    seed_database()
