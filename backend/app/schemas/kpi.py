from datetime import date

from pydantic import BaseModel, ConfigDict, Field, field_validator


class KPICreate(BaseModel):
    metric_name: str = Field(min_length=1, max_length=100)
    metric_value: float = Field(allow_inf_nan=False)
    metric_date: date

    @field_validator("metric_name")
    @classmethod
    def normalize_metric_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Metric name cannot be blank")
        return value


class KPIUpdate(BaseModel):
    metric_name: str | None = Field(default=None, min_length=1, max_length=100)
    metric_value: float | None = Field(default=None, allow_inf_nan=False)
    metric_date: date | None = None

    @field_validator("metric_name")
    @classmethod
    def normalize_metric_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        if not value:
            raise ValueError("Metric name cannot be blank")
        return value


class KPIResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    company_id: int
    metric_name: str
    metric_value: float
    metric_date: date
