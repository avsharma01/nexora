import sys
from pathlib import Path

import pytest
from sqlalchemy import create_engine, event
from sqlalchemy import inspect
from sqlalchemy.orm import Session

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from app.init_db import init_db  # noqa: E402


@pytest.fixture
def db_session():
    engine = create_engine("sqlite+pysqlite:///:memory:")

    @event.listens_for(engine, "connect")
    def enable_foreign_keys(connection, _record):
        cursor = connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    init_db(engine)
    init_db(engine)
    assert {
        "companies",
        "users",
        "financial_records",
        "kpis",
        "forecasts",
        "model_evaluations",
        "scenarios",
    } <= set(inspect(engine).get_table_names())
    with Session(engine) as session:
        yield session
    engine.dispose()
