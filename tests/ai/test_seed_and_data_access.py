from datetime import date
from decimal import Decimal

from app.ai.data_access import available_metrics, get_company, get_series
from app.ai.metrics_config import display_name, find_metrics, resolve_metric, unit_of
from scripts.seed_ai_test_data import FAKE_COMPANIES, build_rows


RETAIL, SAAS, FOODS = FAKE_COMPANIES


def _series(spec, metric):
    return {d: v for m, d, v in build_rows(spec) if m == metric}


# --- seed generator (pure) -------------------------------------------------- #

def test_seed_shape_and_profit_identity():
    for spec in FAKE_COMPANIES:
        rows = build_rows(spec)
        assert len(rows) == 72
        rev, exp, prof = (_series(spec, m) for m in ("revenue", "expenses", "profit"))
        assert min(rev) == date(2024, 1, 31) and max(rev) == date(2025, 12, 31)
        assert all(prof[d] == rev[d] - exp[d] for d in rev)


def test_seed_stories():
    rev = _series(RETAIL, "revenue")
    assert rev[date(2025, 3, 31)] < rev[date(2025, 2, 28)] * Decimal("0.7")
    assert rev[date(2025, 6, 30)] > rev[date(2025, 2, 28)]

    saas_profit = _series(SAAS, "profit")
    assert saas_profit[date(2024, 1, 31)] < 0 < saas_profit[date(2024, 12, 31)]

    foods_profit = _series(FOODS, "profit")
    assert _series(FOODS, "revenue")[date(2025, 12, 31)] > _series(FOODS, "revenue")[date(2024, 1, 31)]
    assert 0 < foods_profit[date(2025, 12, 31)] < foods_profit[date(2024, 1, 31)]


# --- metrics_config --------------------------------------------------------- #

def test_synonyms():
    assert resolve_metric("Sales") == "revenue"
    assert resolve_metric("costs") == "expenses"
    assert resolve_metric("spend") == "expenses"
    assert resolve_metric("earnings") == "profit"
    assert resolve_metric("net") == "profit"
    assert resolve_metric("churn") is None
    assert unit_of("revenue") == "INR"
    assert display_name("profit") == "Profit"


def test_find_metrics_in_text():
    assert find_metrics("Did costs grow faster than sales?") == ["expenses", "revenue"]
    assert find_metrics("What was net income in March?") == ["profit"]
    assert find_metrics("What is our churn rate?") == []


# --- data_access (DB) ------------------------------------------------------- #

def test_get_company(db, fake_ids):
    company = get_company(db, fake_ids["Test SaaS Labs"])
    assert company.name == "Test SaaS Labs"
    assert company.industry == "Software"
    assert get_company(db, 10**9) is None


def test_available_metrics(db, fake_ids):
    for company_id in fake_ids.values():
        assert available_metrics(db, company_id) == ["expenses", "profit", "revenue"]
    assert available_metrics(db, 10**9) == []


def test_get_series_matches_seed_and_is_sorted(db, fake_ids):
    series = get_series(db, fake_ids["Test Retail Pvt Ltd"], "revenue")
    assert len(series) == 24
    assert [d for d, _ in series] == sorted(d for d, _ in series)
    expected = _series(RETAIL, "revenue")
    assert all(value == float(expected[d]) for d, value in series)


def test_get_series_filtered_by_company_and_dates(db, fake_ids):
    retail = get_series(db, fake_ids["Test Retail Pvt Ltd"], "revenue")
    foods = get_series(db, fake_ids["Test Foods Co"], "revenue")
    assert retail != foods

    window = get_series(
        db, fake_ids["Test Retail Pvt Ltd"], "revenue",
        start=date(2025, 1, 1), end=date(2025, 3, 31),
    )
    assert [d for d, _ in window] == [date(2025, 1, 31), date(2025, 2, 28), date(2025, 3, 31)]
    assert get_series(db, fake_ids["Test Retail Pvt Ltd"], "churn") == []


# --- per-company currency ----------------------------------------------------- #

def test_company_currency_overrides_money_units_only_inside_the_block():
    from app.ai.metrics_config import company_currency

    assert unit_of("revenue") == "INR"
    with company_currency("usd"):
        assert unit_of("revenue") == "USD"
        assert unit_of("profit") == "USD"
    assert unit_of("revenue") == "INR"
    with company_currency(None):
        assert unit_of("revenue") == "INR"


def test_fake_companies_have_no_company_currency(db, fake_ids):
    from app.ai.data_access import company_currency

    assert company_currency(db, fake_ids["Test Retail Pvt Ltd"]) is None


def test_metric_names_are_case_insensitive(db):
    """develop's seed_db.py writes "Revenue"/"Expenses"; the analyst must still find them."""
    from app.models.company import Company
    from app.models.kpi import KPI

    company = Company(name="Case Test Co (temp)", industry="Test", description="temporary test row")
    db.add(company)
    db.flush()
    db.add_all([
        KPI(company_id=company.id, metric_name="Revenue", metric_value=42, metric_date=date(2025, 10, 1)),
        KPI(company_id=company.id, metric_name=" Revenue ", metric_value=44, metric_date=date(2025, 11, 1)),
        KPI(company_id=company.id, metric_name="Expenses", metric_value=36, metric_date=date(2025, 10, 1)),
    ])
    db.flush()
    try:
        assert available_metrics(db, company.id) == ["expenses", "revenue"]
        assert get_series(db, company.id, "revenue") == [(date(2025, 10, 1), 42.0), (date(2025, 11, 1), 44.0)]
        assert get_series(db, company.id, "Revenue") == get_series(db, company.id, "revenue")
    finally:
        db.rollback()
