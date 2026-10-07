from sqlalchemy import text
from sqlalchemy.engine import Engine

from app.database import Base, engine

# Import all models so they are registered in Base.metadata.
import app.models


def init_db(db_engine: Engine = engine):
    """Initialize the database schema."""

    # pgvector is PostgreSQL-specific.
    if db_engine.dialect.name == "postgresql":
        with db_engine.begin() as connection:
            connection.execute(
                text("CREATE EXTENSION IF NOT EXISTS vector")
            )

    Base.metadata.create_all(bind=db_engine)


if __name__ == "__main__":
    init_db()
    print("Database schema initialized successfully.")