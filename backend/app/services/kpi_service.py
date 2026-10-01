from sqlalchemy.orm import Session

from app.models.kpi import KPI
from app.schemas.kpi import KPICreate, KPIUpdate


def create_kpi(
    db: Session,
    company_id: int,
    kpi_data: KPICreate,
) -> KPI:
    kpi = KPI(
        company_id=company_id,
        metric_name=kpi_data.metric_name,
        metric_value=kpi_data.metric_value,
        metric_date=kpi_data.metric_date,
    )

    db.add(kpi)
    db.commit()
    db.refresh(kpi)

    return kpi


def get_company_kpis(
    db: Session,
    company_id: int,
) -> list[KPI]:
    return (
        db.query(KPI)
        .filter(KPI.company_id == company_id)
        .all()
    )


def get_kpi(
    db: Session,
    kpi_id: int,
) -> KPI | None:
    return db.get(KPI, kpi_id)


def update_kpi(
    db: Session,
    kpi_id: int,
    kpi_data: KPIUpdate,
) -> KPI | None:
    kpi = db.get(KPI, kpi_id)

    if kpi is None:
        return None

    if kpi_data.metric_name is not None:
        kpi.metric_name = kpi_data.metric_name

    if kpi_data.metric_value is not None:
        kpi.metric_value = kpi_data.metric_value

    if kpi_data.metric_date is not None:
        kpi.metric_date = kpi_data.metric_date

    db.commit()
    db.refresh(kpi)

    return kpi


def delete_kpi(
    db: Session,
    kpi_id: int,
) -> bool:
    kpi = db.get(KPI, kpi_id)

    if kpi is None:
        return False

    db.delete(kpi)
    db.commit()

    return True