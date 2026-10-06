from datetime import date

from pydantic import BaseModel


class ForecastRequest(BaseModel):
    metric_name: str
    periods: int = 3


class ForecastPoint(BaseModel):
    forecast_date: date
    forecast_value: float


class ForecastResponse(BaseModel):
    company_id: int
    metric_name: str
    historical_latest_value: float | None
    forecasts: list[ForecastPoint]