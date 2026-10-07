from datetime import timedelta

from sqlalchemy.orm import Session

from app.models.kpi import KPI
from app.schemas.forecast import (
    ForecastPoint,
    ForecastResponse,
)


def get_forecast(
    db: Session,
    company_id: int,
    metric_name: str,
    periods: int,
) -> ForecastResponse:

    kpis = (
        db.query(KPI)
        .filter(
            KPI.company_id == company_id,
            KPI.metric_name == metric_name,
        )
        .order_by(KPI.metric_date.asc())
        .all()
    )

    if not kpis:
        return ForecastResponse(
            company_id=company_id,
            metric_name=metric_name,
            historical_latest_value=None,
            forecasts=[],
        )

    latest_kpi = kpis[-1]
    latest_value = float(latest_kpi.metric_value)

    forecasts = []

    for i in range(1, periods + 1):
        forecast_date = latest_kpi.metric_date + timedelta(days=30 * i)

        forecasts.append(
            ForecastPoint(
                forecast_date=forecast_date,
                forecast_value=latest_value,
            )
        )

    return ForecastResponse(
        company_id=company_id,
        metric_name=metric_name,
        historical_latest_value=latest_value,
        forecasts=forecasts,
    )