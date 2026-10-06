from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import require_role
from app.core.roles import UserRole
from app.database import get_db
from app.schemas.company import CompanyCreate, CompanyResponse, CompanyUpdate
from app.services.company_service import (
    create_company,
    get_companies,
    get_company,
    update_company,
    delete_company,
)

router = APIRouter(
    prefix="/companies",
    tags=["Companies"],
)


@router.post(
    "/",
    response_model=CompanyResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_company_endpoint(
    company_data: CompanyCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(
        require_role(UserRole.ADMIN, UserRole.ANALYST)
    ),
):
    return create_company(db, company_data)


@router.get(
    "/",
    response_model=list[CompanyResponse],
)
def get_companies_endpoint(
    db: Session = Depends(get_db),
    current_user: dict = Depends(
        require_role(
            UserRole.ADMIN,
            UserRole.ANALYST,
            UserRole.VIEWER,
        )
    ),
):
    return get_companies(db)


@router.get(
    "/{company_id}",
    response_model=CompanyResponse,
)
def get_company_endpoint(
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
    company = get_company(db, company_id)

    if company is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found",
        )

    return company


@router.put(
    "/{company_id}",
    response_model=CompanyResponse,
)
def update_company_endpoint(
    company_id: int,
    company_data: CompanyUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(
        require_role(UserRole.ADMIN, UserRole.ANALYST)
    ),
):
    company = update_company(db, company_id, company_data)

    if company is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found",
        )

    return company


@router.delete(
    "/{company_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_company_endpoint(
    company_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(
        require_role(UserRole.ADMIN)
    ),
):
    deleted = delete_company(db, company_id)

    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found",
        )