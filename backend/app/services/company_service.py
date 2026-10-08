from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.company import Company
from app.schemas.company import CompanyCreate, CompanyUpdate


def create_company(
    db: Session,
    company_data: CompanyCreate,
) -> Company | None:
    name_key = company_data.name.strip().lower()
    existing = db.query(Company.id).filter(
        func.lower(Company.name) == name_key
    ).first()
    if existing is not None:
        return None

    company = Company(
        name=company_data.name.strip(),
        industry=company_data.industry,
        description=company_data.description,
    )

    db.add(company)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        return None
    db.refresh(company)

    return company


def get_companies(db: Session) -> list[Company]:
    return db.query(Company).all()
def get_company(
    db: Session,
    company_id: int,
) -> Company | None:
    return db.get(Company, company_id)
def update_company(
    db: Session,
    company_id: int,
    company_data: CompanyUpdate,
) -> Company | None:
    company = db.get(Company, company_id)

    if company is None:
        return None

    if company_data.name is not None:
        name = company_data.name.strip()
        existing = db.query(Company.id).filter(
            func.lower(Company.name) == name.lower(),
            Company.id != company_id,
        ).first()
        if existing is not None:
            return None
        company.name = name

    if company_data.industry is not None:
        company.industry = company_data.industry

    if company_data.description is not None:
        company.description = company_data.description

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        return None
    db.refresh(company)

    return company
def delete_company(
    db: Session,
    company_id: int,
) -> bool:
    company = db.get(Company, company_id)

    if company is None:
        return False

    db.delete(company)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        return False

    return True
