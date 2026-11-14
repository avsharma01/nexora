from datetime import date

from pydantic import BaseModel, Field

from app.schemas.company import CompanyCreate, CompanyResponse

CSV_FIELD = Field(min_length=1, max_length=1_000_000, description="Monthly CSV text: period,metric,...")


class KPIImportRequest(BaseModel):
    csv: str = CSV_FIELD


class CompanyImportRequest(CompanyCreate):
    csv: str = CSV_FIELD


class KPIImportResult(BaseModel):
    company: CompanyResponse
    months: int
    first_month: date
    last_month: date
    metrics: list[str]
    created: int
    updated: int
    profit_computed: int
