from sqlalchemy import text

from app.database import Base, engine
from app.models.company import Company
from app.models.kpi import KPI
from app.models.user import User


def init_db():
    with engine.begin() as connection:
        connection.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        Base.metadata.create_all(bind=connection)


if __name__ == "__main__":
    init_db()
    print("Database tables created successfully.")