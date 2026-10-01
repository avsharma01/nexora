from sqlalchemy import create_engine

from app.config import settings


DATABASE_URL = (
    f"postgresql+psycopg://"
    f"{settings.POSTGRES_USER}:{settings.POSTGRES_PASSWORD}"
    f"@{settings.POSTGRES_HOST}:{settings.POSTGRES_PORT}"
    f"/{settings.POSTGRES_DB}"
)


engine = create_engine(DATABASE_URL)