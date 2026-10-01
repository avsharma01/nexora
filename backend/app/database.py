from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import settings


DATABASE_URL = (
    f"postgresql+psycopg://"
    f"{settings.POSTGRES_USER}:{settings.POSTGRES_PASSWORD}"
    f"@{settings.POSTGRES_HOST}:{settings.POSTGRES_PORT}"
    f"/{settings.POSTGRES_DB}"
)


engine = create_engine(DATABASE_URL)


class Base(DeclarativeBase):
    pass

from collections.abc import Generator

from sqlalchemy.orm import Session


def get_db() -> Generator[Session, None, None]:
    db = Session(engine)

    try:
        yield db
    finally:
        db.close()