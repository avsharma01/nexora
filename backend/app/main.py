from fastapi import FastAPI
from sqlalchemy import text

from app.api.routers import (
    ai_analyst,
    analytics,
    auth,
    company,
    forecast,
    kpi,
)
from app.database import engine

app = FastAPI(
    title="NEXORA API",
    description="AI Company Intelligence Platform",
    version="1.0.0",
)


app.include_router(company.router)
app.include_router(kpi.router)
app.include_router(auth.router)
app.include_router(analytics.router)
app.include_router(forecast.router)
app.include_router(ai_analyst.router)


@app.get("/")
def root():
    return {
        "message": "NEXORA API is running"
    }


@app.get("/health")
def health_check():
    return {
        "status": "healthy"
    }


@app.get("/health/db")
def database_health_check():
    with engine.connect() as connection:
        result = connection.execute(text("SELECT 1"))
        value = result.scalar()

    return {
        "database": "connected",
        "test_result": value
    }