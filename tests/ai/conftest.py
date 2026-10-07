"""Shared fixtures for AI analyst tests.

DB tests use the FAKE companies from backend/scripts/seed_ai_test_data.py and are
skipped (not failed) when Postgres is down or the fake data isn't seeded.
"""

import pytest
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from app.database import engine
from app.models.company import Company
from scripts.seed_ai_test_data import FAKE_COMPANIES, FAKE_DESCRIPTION


@pytest.fixture(scope="session")
def db():
    session = Session(engine)
    try:
        session.execute(Company.__table__.select().limit(1))
    except OperationalError:
        session.close()
        pytest.skip("Postgres not reachable (docker compose up -d)")
    yield session
    session.close()


@pytest.fixture(scope="session")
def fake_ids(db) -> dict[str, int]:
    """{"Test Retail Pvt Ltd": id, ...}"""
    ids = {}
    for spec in FAKE_COMPANIES:
        company = (
            db.query(Company)
            .filter(Company.name == spec["name"], Company.description == FAKE_DESCRIPTION)
            .first()
        )
        if company is None:
            pytest.skip("Fake data not seeded (python -m scripts.seed_ai_test_data)")
        ids[spec["name"]] = company.id
    return ids
