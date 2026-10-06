from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import require_role
from app.core.roles import UserRole
from app.database import get_db
from app.models.company import Company
from app.schemas.ai_analyst import AIAnalystRequest, AIAnalystResponse
from app.services.ai_analyst_service import get_ai_analysis


router = APIRouter(
    prefix="/companies",
    tags=["AI Business Analyst"],
)


@router.post(
    "/{company_id}/ai-analysis",
    response_model=AIAnalystResponse,
)
def analyze_company(
    company_id: int,
    request_data: AIAnalystRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(
        require_role(
            UserRole.ADMIN,
            UserRole.ANALYST,
            UserRole.VIEWER,
        )
    ),
):
    company = db.get(Company, company_id)

    if company is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found",
        )

    if not request_data.question.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Question cannot be empty",
        )

    return get_ai_analysis(
        db=db,
        company_id=company_id,
        question=request_data.question,
    )