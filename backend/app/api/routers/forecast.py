from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import require_role
from app.core.roles import UserRole
from app.database import get_db
from app.models.company import Company
from app.schemas.forecast import ForecastRequest, ForecastResponse
from app.services.forecast_service import get_forecast


router = APIRouter(
    prefix="/companies",
    tags=["Forecast"],
)


@router.post(
    "/{company_id}/forecast",
    response_model=ForecastResponse,
)
def forecast_company_metric(
    company_id: int,
    forecast_data: ForecastRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(
        # Analysis tools: Admin and Analyst. Viewer sees dashboards only.
        require_role(
            UserRole.ADMIN,
            UserRole.ANALYST,
        )
    ),
):
    company = db.get(Company, company_id)

    if company is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found",
        )

    if forecast_data.periods < 1 or forecast_data.periods > 12:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Periods must be between 1 and 12",
        )

    return get_forecast(
        db=db,
        company_id=company_id,
        metric_name=forecast_data.metric_name,
        periods=forecast_data.periods,
    )