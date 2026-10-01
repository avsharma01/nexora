from sqlalchemy.orm import Session

from app.models.company import Company
from app.schemas.company import CompanyCreate, CompanyUpdate


def create_company(
    db: Session,
    company_data: CompanyCreate,
) -> Company:
    company = Company(
        name=company_data.name,
        industry=company_data.industry,
        description=company_data.description,
    )

    db.add(company)
    db.commit()
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
        company.name = company_data.name

    if company_data.industry is not None:
        company.industry = company_data.industry

    if company_data.description is not None:
        company.description = company_data.description

    db.commit()
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
    db.commit()

    return True