from sqlalchemy.orm import Session

from app.models.kpi import KPI
from app.schemas.analytics import AnalyticsResponse, MetricAnalytics


def get_company_analytics(
    db: Session,
    company_id: int,
) -> AnalyticsResponse:
    kpis = (
        db.query(KPI)
        .filter(KPI.company_id == company_id)
        .order_by(KPI.metric_name, KPI.metric_date.desc())
        .all()
    )

    metrics: list[MetricAnalytics] = []

    metric_groups: dict[str, list[KPI]] = {}

    for kpi in kpis:
        metric_groups.setdefault(kpi.metric_name, []).append(kpi)

    for metric_name, metric_records in metric_groups.items():
        latest = metric_records[0]
        previous = metric_records[1] if len(metric_records) > 1 else None

        latest_value = float(latest.metric_value)

        if previous is None:
            metrics.append(
                MetricAnalytics(
                    metric_name=metric_name,
                    latest_value=latest_value,
                    previous_value=None,
                    change=None,
                    change_percentage=None,
                )
            )
            continue

        previous_value = float(previous.metric_value)
        change = latest_value - previous_value

        if previous_value == 0:
            change_percentage = None
        else:
            change_percentage = (change / previous_value) * 100

        metrics.append(
            MetricAnalytics(
                metric_name=metric_name,
                latest_value=latest_value,
                previous_value=previous_value,
                change=change,
                change_percentage=change_percentage,
            )
        )

    return AnalyticsResponse(
        company_id=company_id,
        metrics=metrics,
    )