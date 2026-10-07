from sqlalchemy.engine import Engine

from app.database import Base, engine
from app import models  # noqa: F401 - register every model with Base.metadata


def init_db(bind: Engine = engine) -> None:
    """Create any missing NEXORA tables on the supplied database engine."""
    Base.metadata.create_all(bind=bind)


if __name__ == "__main__":
    init_db()
    print("Database schema initialized successfully.")
