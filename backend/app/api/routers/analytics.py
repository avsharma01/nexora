from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import require_role
from app.core.roles import UserRole
from app.database import get_db
from app.models.company import Company
from app.schemas.analytics import AnalyticsResponse
from app.services.analytics_service import get_company_analytics


router = APIRouter(
    prefix="/companies",
    tags=["Analytics"],
)


@router.get(
    "/{company_id}/analytics",
    response_model=AnalyticsResponse,
)
def get_company_analytics_endpoint(
    company_id: int,
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

    return get_company_analytics(db, company_id)