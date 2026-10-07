from datetime import date, datetime

from pydantic import BaseModel, Field


class ForecastRequest(BaseModel):
    metric_name: str = Field(min_length=1, max_length=100)
    periods: int = 3


class ForecastPoint(BaseModel):
    forecast_date: date
    forecast_value: float
    lower_bound: float
    upper_bound: float
    model_name: str


class ForecastEvaluation(BaseModel):
    backtest_points: int
    mae: float | None
    mape: float | None


class ForecastResponse(BaseModel):
    company_id: int
    metric_name: str
    historical_latest_value: float | None
    history_points: int
    minimum_history: int
    status: str
    model_name: str | None
    generated_at: datetime
    evaluation: ForecastEvaluation | None
    forecasts: list[ForecastPoint]
