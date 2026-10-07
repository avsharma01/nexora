from pydantic import BaseModel


class AIAnalystRequest(BaseModel):
    question: str


class AIAnalystResponse(BaseModel):
    company_id: int
    question: str
    answer: str