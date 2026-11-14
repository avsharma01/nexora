from fastapi import FastAPI
from sqlalchemy import text

from app.api.routers import (
    ai_analyst,
    analytics,
    auth,
    company,
    forecast,
    kpi,
    kpi_import,
)
from app.database import engine

from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="NEXORA API",
    description="AI Company Intelligence Platform",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    # The browser reaches the API through the Next.js /api proxy (same origin);
    # only the frontend's own address needs direct access.
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(company.router)
app.include_router(kpi.router)
app.include_router(kpi_import.router)
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