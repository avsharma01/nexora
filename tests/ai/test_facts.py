from datetime import date

import pytest

from app.ai import facts
from app.ai.data_access import get_series
from app.ai.facts import (
    compare_periods,
    cross_metric_growth,
    extremes,
    format_inr,
    format_pct,
    latest_summary,
    parse_period,
    pct_change,
    trend,
    value_at,
)
from app.schemas.analytics import AnalyticsResponse, MetricAnalytics


def me(year, month):
    """Month-end date."""
    return parse_period(f"{year}-{month:02d}").end


def monthly_series(values, year=2025, first_month=1):
    return [(me(year, first_month + i), float(v)) for i, v in enumerate(values)]


# --- pct_change + formatting ------------------------------------------------ #

def test_pct_change_basic_and_zero():
    assert pct_change(100, 115) == pytest.approx(15.0)
    assert pct_change(1_240_000, 1_050_000) == pytest.approx(-15.3226, abs=1e-4)
    assert pct_change(0, 50) is None


def test_pct_change_negative_to_positive_uses_abs_denominator():
    # -100 -> 50 is an improvement: +150%, not -150%.
    assert pct_change(-100, 50) == pytest.approx(150.0)
    assert pct_change(-100, -150) == pytest.approx(-50.0)


def test_formatting_rounds_only_in_text():
    assert format_inr(1050000) == "10,50,000"
    assert format_inr(-190000) == "-1,90,000"
    assert format_inr(123) == "123"
    assert format_inr(12345678.5) == "1,23,45,678.50"
    assert format_pct(-15.32258) == "-15.3%"
    assert format_pct(0.04) == "0.0%"
    assert format_pct(None).startswith("n/a")


def test_parse_period():
    assert parse_period("2025-03").label == "March 2025"
    assert parse_period("2025-q2").months == [(2025, 4), (2025, 5), (2025, 6)]
    assert parse_period("2024").end == date(2024, 12, 31)
    assert parse_period(date(2025, 2, 14)).key == "2025-02"
    with pytest.raises(ValueError):
        parse_period("March")


# --- value_at --------------------------------------------------------------- #

def test_value_at_month():
    series = monthly_series([1_240_000, 1_050_000], first_month=2)
    fact = value_at(series, "2025-03", metric="revenue")
    assert fact.value == 1_050_000
    assert fact.kind == "historical"
    assert fact.unit == "INR"
    assert fact.text == "Revenue in March 2025: 10,50,000 INR"
    assert value_at(series, "2015-03", metric="revenue") is None


def test_value_at_unrounded():
    fact = value_at([(me(2025, 1), 10.126)], "2025-01")
    assert fact.value == 10.126


# --- trend ------------------------------------------------------------------ #

def test_trend_basic():
    fact = trend(monthly_series([100, 80, 120]), metric="revenue")
    assert fact.data["start_value"] == 100
    assert fact.data["end_value"] == 120
    assert fact.value == 20
    assert fact.data["pct_change"] == pytest.approx(20.0)
    assert fact.data["direction"] == "up"
    assert fact.data["points"] == 3
    assert fact.data["min"] == {"period": "2025-02", "value": 80}
    assert "+20 INR (+20.0%)" in fact.text
    assert fact.period == "2025-01..2025-03"


def test_trend_negative_to_positive():
    fact = trend(monthly_series([-400_000, -20_000, 56_000]), metric="profit")
    assert fact.data["direction"] == "up"
    assert fact.data["pct_change"] == pytest.approx(114.0)
    assert "+114.0%" in fact.text


def test_trend_missing_month():
    series = [(me(2025, 1), 100.0), (me(2025, 2), 110.0), (me(2025, 4), 130.0)]
    fact = trend(series)
    assert fact.data["points"] == 3
    assert fact.data["gaps"] == ["2025-03"]
    assert any("March 2025" in n for n in fact.notes)


def test_trend_window():
    fact = trend(monthly_series([1, 2, 3, 4, 5, 6]), start="2025-02", end="2025-04")
    assert (fact.data["start_value"], fact.data["end_value"]) == (2, 4)
    assert trend(monthly_series([1, 2]), start="2030-01") is None


def test_trend_single_row():
    fact = trend([(me(2025, 1), 500.0)], metric="revenue")
    assert fact.value is None
    assert fact.data["points"] == 1
    assert "only one data point" in fact.text
    assert any("limited data" in n for n in fact.notes)


def test_trend_empty():
    assert trend([]) is None


# --- duplicates ------------------------------------------------------------- #

def test_duplicate_dates_keep_last_stored_value():
    series = [(me(2025, 1), 100.0), (me(2025, 2), 999.0), (me(2025, 2), 120.0)]
    fact = trend(series)
    assert fact.data["end_value"] == 120
    assert fact.data["points"] == 2
    assert any("several rows for 2025-02-28" in n for n in fact.notes)

    assert value_at(series, "2025-02").value == 120


def test_several_dates_in_one_month_latest_wins():
    series = [(date(2025, 3, 15), 50.0), (date(2025, 3, 31), 70.0)]
    fact = value_at(series, "2025-03")
    assert fact.value == 70
    assert any("several dates in March 2025" in n for n in fact.notes)


# --- compare_periods -------------------------------------------------------- #

def test_compare_months():
    series = monthly_series([1_240_000, 1_050_000], first_month=2)
    fact = compare_periods(series, "2025-02", "2025-03", metric="revenue")
    assert fact.value == -190_000
    assert fact.data["pct_change"] == pytest.approx(-15.3226, abs=1e-4)
    assert "-1,90,000 INR (-15.3%)" in fact.text
    assert fact.data["direction"] == "down"


def test_compare_quarter_sums():
    series = monthly_series([10, 20, 30, 40, 50, 60])
    fact = compare_periods(series, "2025-Q1", "2025-Q2")
    assert fact.data["a"]["value"] == 60
    assert fact.data["b"]["value"] == 150
    assert fact.value == 90
    assert fact.data["pct_change"] == pytest.approx(150.0)
    assert "Q1 2025 (sum of 3 months)" in fact.text
    assert fact.notes == []


def test_compare_partial_quarter_is_flagged():
    series = monthly_series([10, 20, 30, 40, 50])  # June missing
    fact = compare_periods(series, "2025-Q1", "2025-Q2")
    assert fact.data["b"]["value"] == 90
    assert fact.data["b"]["missing"] == ["2025-06"]
    assert any("Q2 2025 is incomplete" in n for n in fact.notes)


def test_compare_years():
    series = monthly_series([1] * 12, year=2024) + monthly_series([2] * 12, year=2025)
    fact = compare_periods(series, "2024", "2025")
    assert (fact.data["a"]["value"], fact.data["b"]["value"]) == (12, 24)


def test_compare_missing_period():
    assert compare_periods(monthly_series([1, 2]), "2015-01", "2025-01") is None


def test_value_at_quarter_is_sum():
    fact = value_at(monthly_series([10, 20, 30]), "2025-Q1", metric="revenue")
    assert fact.value == 60
    assert fact.text == "Revenue in Q1 2025 (sum of 3 months): 60 INR"


# --- extremes --------------------------------------------------------------- #

def test_extremes():
    high, low = extremes(monthly_series([5, 9, 1, 7]), metric="expenses")
    assert (high.period, high.value) == ("2025-02", 9)
    assert (low.period, low.value) == ("2025-03", 1)
    assert "February 2025" in high.text


def test_extremes_single_row_and_ties():
    high, low = extremes([(me(2025, 1), 3.0)])
    assert high.value == low.value == 3
    assert any("limited data" in n for n in high.notes)

    high, _ = extremes(monthly_series([9, 9, 1]))
    assert high.data["ties"] == ["2025-01", "2025-02"]
    assert extremes([]) == []


# --- cross_metric_growth ---------------------------------------------------- #

def test_cross_metric_growth():
    revenue = monthly_series([100, 110])
    expenses = monthly_series([80, 100])
    fact = cross_metric_growth(revenue, expenses, metric_a="revenue", metric_b="expenses")
    assert fact.data["a"]["pct_change"] == pytest.approx(10.0)
    assert fact.data["b"]["pct_change"] == pytest.approx(25.0)
    assert fact.data["faster"] == "expenses"
    assert "Expenses had the higher growth rate" in fact.text


def test_cross_metric_uses_common_months_only():
    revenue = monthly_series([100, 110, 120])
    expenses = monthly_series([80, 100])  # no March
    fact = cross_metric_growth(revenue, expenses, metric_a="revenue", metric_b="expenses")
    assert fact.period == "2025-01..2025-02"


def test_cross_metric_not_comparable():
    fact = cross_metric_growth(monthly_series([0, 5]), monthly_series([1, 2]))
    assert fact.data["faster"] is None
    assert "cannot be compared" in fact.text


# --- latest_summary --------------------------------------------------------- #

def _analytics(*metrics):
    return lambda db, company_id: AnalyticsResponse(company_id=company_id, metrics=list(metrics))


def test_latest_summary_cases(monkeypatch):
    normal = MetricAnalytics(
        metric_name="revenue", latest_value=1_050_000, latest_date=date(2025, 3, 31),
        previous_value=1_240_000, previous_date=date(2025, 2, 28), change=-190_000,
        change_percentage=-15.32, comparison_available=True,
    )
    single = MetricAnalytics(
        metric_name="profit", latest_value=10, latest_date=date(2025, 3, 31),
        previous_value=None, previous_date=None, change=None,
        change_percentage=None, comparison_available=False,
    )
    duplicate = MetricAnalytics(
        metric_name="expenses", latest_value=7, latest_date=date(2025, 3, 31),
        previous_value=5, previous_date=date(2025, 3, 31), change=2,
        change_percentage=40.0, comparison_available=True,
    )
    monkeypatch.setattr(facts, "get_company_analytics", _analytics(normal, single, duplicate))

    rev, prof, exp = latest_summary(db=None, company_id=1)

    assert rev.data["change"] == -190_000
    assert "-1,90,000 INR (-15.3%)" in rev.text
    assert "February 2025" in rev.text

    assert prof.data["change"] is None
    assert "no earlier value" in prof.text

    assert exp.data["change"] is None
    assert any("Data quality" in n for n in exp.notes)


# --- against the fake DB data ----------------------------------------------- #

def test_facts_on_fake_retail(db, fake_ids):
    company_id = fake_ids["Test Retail Pvt Ltd"]
    revenue = get_series(db, company_id, "revenue")

    dip = compare_periods(revenue, "2025-02", "2025-03", metric="revenue")
    assert dip.data["direction"] == "down"
    assert dip.data["pct_change"] < -30

    _, low = extremes(revenue, metric="revenue")
    assert low.period == "2025-03"

    summary = latest_summary(db, company_id)
    assert {f.id for f in summary} == {"revenue.latest", "expenses.latest", "profit.latest"}
    assert all(f.period == "2025-12" for f in summary)


def test_facts_on_fake_foods_costs_grow_faster(db, fake_ids):
    company_id = fake_ids["Test Foods Co"]
    fact = cross_metric_growth(
        get_series(db, company_id, "revenue"),
        get_series(db, company_id, "expenses"),
        metric_a="revenue", metric_b="expenses",
    )
    assert fact.data["faster"] == "expenses"
    assert fact.period == "2024-01..2025-12"
