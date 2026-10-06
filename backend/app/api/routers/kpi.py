from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import require_role
from app.core.roles import UserRole
from app.database import get_db
from app.models.company import Company
from app.schemas.kpi import KPICreate, KPIResponse, KPIUpdate
from app.services.kpi_service import (
    create_kpi,
    get_company_kpis,
    get_kpi,
    update_kpi,
    delete_kpi,
)

router = APIRouter(
    tags=["KPIs"],
)


@router.post(
    "/companies/{company_id}/kpis",
    response_model=KPIResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_kpi_endpoint(
    company_id: int,
    kpi_data: KPICreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(
        require_role(UserRole.ADMIN, UserRole.ANALYST)
    ),
):
    company = db.get(Company, company_id)

    if company is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found",
        )

    return create_kpi(db, company_id, kpi_data)


@router.get(
    "/companies/{company_id}/kpis",
    response_model=list[KPIResponse],
)
def get_company_kpis_endpoint(
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

    return get_company_kpis(db, company_id)


@router.get(
    "/kpis/{kpi_id}",
    response_model=KPIResponse,
)
def get_kpi_endpoint(
    kpi_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(
        require_role(
            UserRole.ADMIN,
            UserRole.ANALYST,
            UserRole.VIEWER,
        )
    ),
):
    kpi = get_kpi(db, kpi_id)

    if kpi is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="KPI not found",
        )

    return kpi


@router.put(
    "/kpis/{kpi_id}",
    response_model=KPIResponse,
)
def update_kpi_endpoint(
    kpi_id: int,
    kpi_data: KPIUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(
        require_role(UserRole.ADMIN, UserRole.ANALYST)
    ),
):
    kpi = update_kpi(db, kpi_id, kpi_data)

    if kpi is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="KPI not found",
        )

    return kpi


@router.delete(
    "/kpis/{kpi_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_kpi_endpoint(
    kpi_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(
        require_role(UserRole.ADMIN)
    ),
):
    deleted = delete_kpi(db, kpi_id)

    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="KPI not found",
        )