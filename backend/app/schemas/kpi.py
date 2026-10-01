from datetime import date

from pydantic import BaseModel, ConfigDict


class KPICreate(BaseModel):
    metric_name: str
    metric_value: float
    metric_date: date


class KPIUpdate(BaseModel):
    metric_name: str | None = None
    metric_value: float | None = None
    metric_date: date | None = None


class KPIResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    company_id: int
    metric_name: str
    metric_value: float
    metric_date: date