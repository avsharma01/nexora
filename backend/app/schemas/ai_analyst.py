from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class ChatTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(max_length=4000)


class AIAnalystRequest(BaseModel):
    question: str = Field(max_length=500)

    # Optional previous turns for follow-ups ("And in April?"); last 6 are used.
    history: list[ChatTurn] = []


class AIFigure(BaseModel):
    label: str
    value: float
    unit: str | None
    period: str
    kind: Literal["historical", "forecast", "scenario"]


class AISource(BaseModel):
    id: str
    type: Literal["kpi", "document"]
    label: str


class AIAnalystResponse(BaseModel):
    company_id: int
    question: str
    answer: str

    insight_id: int | None = None
    status: Literal["answered", "insufficient_data", "out_of_scope"] = "answered"
    is_grounded: bool = True
    figures: list[AIFigure] = []
    sources: list[AISource] = []
    generated_at: datetime | None = None
