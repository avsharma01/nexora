from datetime import date

import pytest
from sqlalchemy import func, inspect, select, text
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException

from app.api.routers.company import (
    create_company_endpoint,
    delete_company_endpoint,
    update_company_endpoint,
)
from app.api.routers.forecast import forecast_company_metric
from app.api.routers.kpi import (
    create_kpi_endpoint,
    delete_kpi_endpoint,
    get_company_kpis_endpoint,
    get_kpi_endpoint,
    update_kpi_endpoint,
)
from app.api.routers.auth import login_user, register_user
from app.core.dependencies import require_role
from app.core.roles import UserRole
from app.models import (
    Company,
    FinancialRecord,
    Forecast,
    KPI,
    ModelEvaluation,
    Scenario,
    User,
)
from app.schemas.auth import LoginRequest
from app.schemas.company import CompanyCreate, CompanyUpdate
from app.schemas.kpi import KPICreate, KPIUpdate
from app.schemas.forecast import ForecastRequest
from app.schemas.user import UserCreate
from app.services.analytics_service import get_company_analytics
from app.services.company_service import create_company
from app.seed_data import seed_data
from app.services.forecast_service import get_forecast


def test_schema_initialization_and_relationships(db_session):
    company = Company(name="Relationship Demo")
    company.kpis.append(
        KPI(metric_name="revenue", metric_value=1250, metric_date=date(2026, 1, 1))
    )
    db_session.add(company)
    db_session.commit()

    assert company.kpis[0].company_id == company.id
    assert company.kpis[0].company.name == "Relationship Demo"


def test_required_indexes_are_registered(db_session):
    inspector = inspect(db_session.get_bind())
    indexes = {
        table: {item["name"] for item in inspector.get_indexes(table)}
        for table in (
            "kpis",
            "forecasts",
            "scenarios",
            "users",
        )
    }
    assert "ix_kpis_company_metric_date" in indexes["kpis"]
    assert "ix_forecasts_company_metric_date" in indexes["forecasts"]
    assert "ix_scenarios_company_created" in indexes["scenarios"]
    assert "ix_users_company_id" in indexes["users"]
    company_indexes = {
        row[1]
        for row in db_session.execute(text("PRAGMA index_list('companies')"))
    }
    assert "uq_companies_name_normalized" in company_indexes


def test_seed_data_is_deterministic_and_idempotent(db_session):
    fixed_today = date(2026, 10, 6)

    assert seed_data(db_session, today=fixed_today) == 288
    assert seed_data(db_session, today=fixed_today) == 0

    assert db_session.scalar(select(func.count()).select_from(Company)) == 3
    assert db_session.scalar(select(func.count()).select_from(KPI)) == 216
    assert db_session.scalar(select(func.count()).select_from(FinancialRecord)) == 72

    months = db_session.scalars(
        select(KPI.metric_date)
        .where(KPI.company_id == 1, KPI.metric_name == "revenue")
        .order_by(KPI.metric_date)
    ).all()
    assert len(months) == 24
    assert months[0] == date(2024, 10, 1)
    assert months[-1] == date(2026, 9, 1)

    prior_september_value = db_session.scalar(
        select(KPI.metric_value).where(
            KPI.company_id == 1,
            KPI.metric_name == "revenue",
            KPI.metric_date == date(2026, 9, 1),
        )
    )
    assert seed_data(db_session, today=date(2026, 11, 6)) == 12
    assert db_session.scalar(
        select(KPI.metric_value).where(
            KPI.company_id == 1,
            KPI.metric_name == "revenue",
            KPI.metric_date == date(2026, 9, 1),
        )
    ) == prior_september_value


def test_company_names_are_normalized_and_duplicate_requests_are_rejected(db_session):
    created = create_company(db_session, CompanyCreate(name="  Unique Company  "))
    assert created is not None
    assert created.name == "Unique Company"
    assert create_company(db_session, CompanyCreate(name="unique company")) is None

    with pytest.raises(IntegrityError):
        db_session.add(Company(name="UNIQUE COMPANY"))
        db_session.commit()
    db_session.rollback()


def test_company_api_returns_conflict_for_duplicate_names(db_session):
    first = create_company_endpoint(
        CompanyCreate(name="Nexora Demo"), db_session, {"role": "admin"}
    )
    second = create_company_endpoint(
        CompanyCreate(name="Another Demo"), db_session, {"role": "admin"}
    )
    with pytest.raises(HTTPException) as create_error:
        create_company_endpoint(
            CompanyCreate(name="nexora demo"), db_session, {"role": "admin"}
        )
    assert create_error.value.status_code == 409

    with pytest.raises(HTTPException) as update_error:
        update_company_endpoint(
            first.id,
            CompanyUpdate(name="ANOTHER DEMO"),
            db_session,
            {"role": "admin"},
        )
    assert update_error.value.status_code == 409


def test_company_api_preserves_companies_with_historical_records(db_session):
    company = Company(name="Retained History Demo")
    db_session.add(company)
    db_session.flush()
    db_session.add(
        KPI(
            company_id=company.id,
            metric_name="revenue",
            metric_value=100,
            metric_date=date(2026, 1, 1),
        )
    )
    db_session.commit()

    with pytest.raises(HTTPException) as delete_error:
        delete_company_endpoint(company.id, db_session, {"role": "admin"})
    assert delete_error.value.status_code == 409
    assert db_session.get(Company, company.id) is not None


def test_company_and_kpi_crud_endpoints_keep_existing_flows(db_session):
    company = create_company_endpoint(
        CompanyCreate(name="CRUD Integration Demo"),
        db_session,
        {"role": "analyst"},
    )
    updated_company = update_company_endpoint(
        company.id,
        CompanyUpdate(industry="Technology"),
        db_session,
        {"role": "analyst"},
    )
    assert updated_company.industry == "Technology"

    kpi = create_kpi_endpoint(
        company.id,
        KPICreate(
            metric_name="revenue",
            metric_value=1000,
            metric_date=date(2026, 1, 1),
        ),
        db_session,
        {"role": "analyst"},
    )
    assert get_company_kpis_endpoint(
        company.id, db_session, {"role": "viewer"}
    )[0].id == kpi.id
    assert get_kpi_endpoint(kpi.id, db_session, {"role": "viewer"}).id == kpi.id
    updated_kpi = update_kpi_endpoint(
        kpi.id,
        KPIUpdate(metric_value=1200),
        db_session,
        {"role": "analyst"},
    )
    assert float(updated_kpi.metric_value) == 1200
    assert delete_kpi_endpoint(kpi.id, db_session, {"role": "admin"}) is None
    assert db_session.get(KPI, kpi.id) is None

    assert delete_company_endpoint(company.id, db_session, {"role": "admin"}) is None
    assert db_session.get(Company, company.id) is None


def test_auth_registration_login_and_role_checks_remain_valid(db_session):
    user = register_user(
        UserCreate(email="viewer@example.test", password="safe-demo-password"),
        db_session,
    )
    assert user.company_id is None
    login_response = login_user(
        LoginRequest(email="viewer@example.test", password="safe-demo-password"),
        db_session,
    )
    assert login_response["access_token"]
    assert login_response["role"] == UserRole.VIEWER

    viewer_check = require_role(UserRole.VIEWER)
    assert viewer_check({"role": UserRole.VIEWER.value})["role"] == UserRole.VIEWER.value
    with pytest.raises(HTTPException) as denied:
        require_role(UserRole.ADMIN)({"role": UserRole.VIEWER.value})
    assert denied.value.status_code == 403


def test_financial_records_are_company_scoped_and_unique_by_period(db_session):
    company = Company(name="Financial Integrity Demo")
    db_session.add(company)
    db_session.flush()
    record = FinancialRecord(
        company_id=company.id,
        record_date=date(2026, 1, 1),
        revenue=1000,
        expenses=700,
        profit=300,
        currency="USD",
    )
    db_session.add(record)
    db_session.commit()
    assert record.company.name == "Financial Integrity Demo"

    db_session.add(
        FinancialRecord(
            company_id=company.id,
            record_date=date(2026, 1, 1),
            revenue=1200,
            expenses=800,
            profit=400,
            currency="USD",
        )
    )
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


def test_kpi_rejects_missing_company_and_blank_metric(db_session):
    db_session.add(
        KPI(
            company_id=999,
            metric_name="revenue",
            metric_value=100,
            metric_date=date(2026, 1, 1),
        )
    )
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()

    company = Company(name="Data Quality Demo")
    db_session.add(company)
    db_session.flush()
    db_session.add(
        KPI(
            company_id=company.id,
            metric_name="   ",
            metric_value=100,
            metric_date=date(2026, 1, 1),
        )
    )
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


def test_forecast_reads_kpi_history_without_persisting_results(db_session):
    company = Company(name="Forecast Demo")
    db_session.add(company)
    db_session.flush()
    for month, value in ((1, 100), (2, 110), (4, 130), (4, 135)):
        db_session.add(
            KPI(
                company_id=company.id,
                metric_name="revenue",
                metric_value=value,
                metric_date=date(2026, month, 1),
            )
        )
    db_session.commit()

    response = get_forecast(db_session, company.id, "revenue", 2)
    assert response.status == "forecasted"
    assert response.history_points == 3
    assert response.forecasts[0].forecast_date == date(2026, 5, 1)
    assert response.forecasts[0].forecast_value > 135
    assert response.forecasts[0].lower_bound <= response.forecasts[0].upper_bound
    assert db_session.scalar(select(func.count()).select_from(Forecast)) == 0


def test_forecast_endpoint_validates_periods_with_http_400(db_session):
    company = Company(name="Forecast Period Validation Demo")
    db_session.add(company)
    db_session.flush()
    for month, value in ((1, 100), (2, 110), (3, 120)):
        db_session.add(
            KPI(
                company_id=company.id,
                metric_name="revenue",
                metric_value=value,
                metric_date=date(2026, month, 1),
            )
        )
    db_session.commit()

    valid_response = forecast_company_metric(
        company.id,
        ForecastRequest(metric_name="revenue", periods=1),
        db_session,
        {"role": "viewer"},
    )
    assert valid_response.status == "forecasted"
    assert len(valid_response.forecasts) == 1

    for invalid_periods in (0, -1, 13):
        with pytest.raises(HTTPException) as error:
            forecast_company_metric(
                company.id,
                ForecastRequest(metric_name="revenue", periods=invalid_periods),
                db_session,
                {"role": "viewer"},
            )
        assert error.value.status_code == 400


def test_kpi_request_rejects_non_finite_values_and_blank_names():
    with pytest.raises(ValueError):
        KPICreate(
            metric_name="revenue",
            metric_value=float("nan"),
            metric_date=date(2026, 1, 1),
        )
    with pytest.raises(ValueError):
        KPICreate(
            metric_name="   ",
            metric_value=1,
            metric_date=date(2026, 1, 1),
        )


def test_forecast_reports_insufficient_history_without_fabricating_months(db_session):
    company = Company(name="Short History Demo")
    db_session.add(company)
    db_session.flush()
    db_session.add(
        KPI(
            company_id=company.id,
            metric_name="revenue",
            metric_value=100,
            metric_date=date(2026, 1, 1),
        )
    )
    db_session.commit()

    response = get_forecast(db_session, company.id, "revenue", 3)
    assert response.status == "insufficient_data"
    assert response.forecasts == []
    assert response.history_points == 1


def test_analytics_compares_distinct_observed_periods(db_session):
    company = Company(name="Analytics Duplicate Demo")
    db_session.add(company)
    db_session.flush()
    for observed_date, value in (
        (date(2026, 1, 1), 100),
        (date(2026, 3, 1), 130),
        (date(2026, 3, 1), 140),
    ):
        db_session.add(
            KPI(
                company_id=company.id,
                metric_name="revenue",
                metric_value=value,
                metric_date=observed_date,
            )
        )
    db_session.commit()

    metric = get_company_analytics(db_session, company.id).metrics[0]
    assert metric.latest_value == 140
    assert metric.latest_date == date(2026, 3, 1)
    assert metric.previous_value == 100
    assert metric.previous_date == date(2026, 1, 1)
    assert metric.change_percentage == 40


def test_forecast_and_scenario_models_enforce_company_relationship(db_session):
    company = Company(name="Persisted Data Demo")
    db_session.add(company)
    db_session.flush()
    forecast = Forecast(
        company_id=company.id,
        metric_name="revenue",
        forecast_date=date(2027, 1, 1),
        predicted_value=125.0,
        lower_bound=100.0,
        upper_bound=150.0,
        model_version="linear_trend_v1",
    )
    scenario = Scenario(
        company_id=company.id,
        name="10 percent revenue growth",
        assumptions={"revenue_growth_percent": 10},
        projected_results={"revenue": 1100},
    )
    evaluation = ModelEvaluation(
        model_version="linear_trend_v1",
        metric="mae",
        value=2.5,
        evaluation_period="rolling-origin",
    )
    db_session.add_all([forecast, scenario, evaluation])
    db_session.commit()

    assert forecast.company.name == company.name
    assert scenario.company.name == company.name
    assert db_session.scalar(select(func.count()).select_from(ModelEvaluation)) == 1
