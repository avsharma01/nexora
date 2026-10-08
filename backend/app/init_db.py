from sqlalchemy import text
from sqlalchemy.engine import Engine

from app.database import Base, engine
from app import models  # noqa: F401 - register every model with Base.metadata


def init_db(bind: Engine = engine) -> None:
    """Create any missing NEXORA tables on the supplied database engine.

    PostgreSQL requires the pgvector extension before its vector column types
    can be created. Other dialects, including SQLite test databases, skip it.
    All models are imported by app.models before metadata is created.
    """
    if bind.dialect.name == "postgresql":
        with bind.begin() as connection:
            connection.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
            Base.metadata.create_all(bind=connection)
    else:
        Base.metadata.create_all(bind=bind)


if __name__ == "__main__":
    init_db()
    print("Database schema initialized successfully.")
