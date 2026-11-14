from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import PlainTextResponse
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.dependencies import require_role
from app.core.roles import UserRole
from app.database import get_db
from app.models.company import Company
from app.schemas.kpi_import import CompanyImportRequest, KPIImportRequest, KPIImportResult
from app.services.kpi_import import TEMPLATE, CsvImportError, ParsedCsv, apply_import, parse_kpi_csv

router = APIRouter(tags=["KPI import"])

# Every data change (create, edit, import, delete) is Admin-only.
WRITERS = require_role(UserRole.ADMIN)


def _parse(text: str) -> ParsedCsv:
    try:
        return parse_kpi_csv(text)
    except CsvImportError as exc:
        # One problem per line, so the UI can show them as a list.
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))


def _result(company: Company, parsed: ParsedCsv, counts) -> KPIImportResult:
    months = parsed.months
    return KPIImportResult(
        company=company,
        months=len(months),
        first_month=months[0],
        last_month=months[-1],
        metrics=parsed.metrics,
        created=counts.created,
        updated=counts.updated,
        profit_computed=parsed.profit_computed,
    )


@router.get("/kpis/import/template", response_class=PlainTextResponse)
def import_template(current_user: dict = Depends(WRITERS)):
    return PlainTextResponse(TEMPLATE, media_type="text/csv")


@router.post(
    "/companies/import",
    response_model=KPIImportResult,
    status_code=status.HTTP_201_CREATED,
)
def create_company_from_csv(
    data: CompanyImportRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(WRITERS),
):
    """Create a company and its monthly KPIs in one transaction (all or nothing)."""
    parsed = _parse(data.csv)  # validate before creating anything

    if db.query(Company.id).filter(func.lower(Company.name) == data.name.lower()).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Company name already exists")

    company = Company(name=data.name, industry=data.industry, description=data.description)
    db.add(company)
    try:
        db.flush()
        counts = apply_import(db, company.id, parsed)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Company name already exists")
    db.refresh(company)
    return _result(company, parsed, counts)


@router.post("/companies/{company_id}/kpis/import", response_model=KPIImportResult)
def import_company_kpis(
    company_id: int,
    data: KPIImportRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(WRITERS),
):
    """Add or replace monthly values for an existing company (same metric + month = replaced)."""
    company = db.get(Company, company_id)
    if company is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Company not found")
    parsed = _parse(data.csv)
    try:
        counts = apply_import(db, company_id, parsed)
        db.commit()
    except Exception:
        db.rollback()
        raise
    return _result(company, parsed, counts)
