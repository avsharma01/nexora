from pydantic import BaseModel


class MetricAnalytics(BaseModel):
    metric_name: str
    latest_value: float | None
    previous_value: float | None
    change: float | None
    change_percentage: float | None


class AnalyticsResponse(BaseModel):
    company_id: int
    metrics: list[MetricAnalytics]