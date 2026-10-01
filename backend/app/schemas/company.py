from pydantic import BaseModel, ConfigDict


class CompanyCreate(BaseModel):
    name: str
    industry: str | None = None
    description: str | None = None

class CompanyUpdate(BaseModel):
    name: str | None = None
    industry: str | None = None
    description: str | None = None


class CompanyResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    industry: str | None
    description: str | None