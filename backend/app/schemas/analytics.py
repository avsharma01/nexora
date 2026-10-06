from datetime import date

from pydantic import BaseModel


class MetricAnalytics(BaseModel):
    metric_name: str

    latest_value: float | None
    latest_date: date | None

    previous_value: float | None
    previous_date: date | None

    change: float | None
    change_percentage: float | None

    comparison_available: bool


class AnalyticsResponse(BaseModel):
    company_id: int
    metrics: list[MetricAnalytics]