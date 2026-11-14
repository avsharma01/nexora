"""CSV import parser (app/services/kpi_import.py) and AI matching of imported metrics."""

from datetime import date

import pytest

from app.ai.intent import detect_intent
from app.services.kpi_import import CsvImportError, normalize_metric, parse_kpi_csv


def errors_of(text: str) -> str:
    with pytest.raises(CsvImportError) as exc:
        parse_kpi_csv(text)
    return str(exc.value)


def test_basic_monthly_csv():
    parsed = parse_kpi_csv("period,revenue,expenses,profit\n2025-01,100,60,40\n2025-02,110,65,45\n")
    assert parsed.metrics == ["revenue", "expenses", "profit"]
    assert parsed.rows[date(2025, 1, 1)] == {"revenue": 100, "expenses": 60, "profit": 40}
    assert parsed.months == [date(2025, 1, 1), date(2025, 2, 1)]


def test_profit_computed_when_missing():
    parsed = parse_kpi_csv("period,revenue,expenses\n2025-01,100,60\n")
    assert parsed.rows[date(2025, 1, 1)]["profit"] == 40
    assert parsed.profit_computed == 1
    assert "profit" in parsed.metrics


def test_empty_profit_cell_is_computed_but_given_profit_kept():
    parsed = parse_kpi_csv("period,revenue,expenses,profit\n2025-01,100,60,\n2025-02,100,60,30\n")
    assert parsed.rows[date(2025, 1, 1)]["profit"] == 40
    assert parsed.rows[date(2025, 2, 1)]["profit"] == 30


def test_headers_normalised_and_custom_metrics_kept():
    parsed = parse_kpi_csv("Month,Revenue,Cash Flow,Customers\n2025-01,100,20,7\n")
    assert parsed.metrics == ["revenue", "cash_flow", "customers"]
    assert normalize_metric("  Net Revenue (USD) ") == "net_revenue_usd"


@pytest.mark.parametrize("period", ["2025-01", "2025-1", "2025-01-15", "2025/01", "01/2025", "1-2025"])
def test_period_formats(period):
    assert parse_kpi_csv(f"period,revenue\n{period},5\n").months == [date(2025, 1, 1)]


@pytest.mark.parametrize(
    "value, expected",
    [("1,234.50", 1234.5), ("$1200", 1200), ("₹ 5,00,000", 500000), ("(1200)", -1200), ("-3.5", -3.5), ("1200 USD", 1200)],
)
def test_value_formats(value, expected):
    parsed = parse_kpi_csv(f'period,revenue\n2025-01,"{value}"\n')
    assert parsed.rows[date(2025, 1, 1)]["revenue"] == expected


def test_semicolon_delimiter():
    assert parse_kpi_csv("period;revenue\n2025-01;5\n").rows[date(2025, 1, 1)]["revenue"] == 5


def test_quarter_and_year_rejected_with_clear_message():
    assert "is a quarter" in errors_of("period,revenue\n2025-Q1,5\n")
    assert "is a whole year" in errors_of("period,revenue\n2025,5\n")


def test_errors_name_the_row_and_column():
    message = errors_of("period,revenue,expenses\n2025-01,abc,5\n2025-13,1,1\n2025-01,1,1\n")
    assert "Row 2, revenue: 'abc' is not a number" in message
    assert "Row 3: '2025-13' is not a month" in message
    assert "Row 4: 2025-01 already appears on row 2" in message


def test_header_problems():
    assert "first column must be 'period'" in errors_of("revenue,expenses\n1,2\n")
    assert "appear twice" in errors_of("period,revenue,Revenue\n2025-01,1,2\n")
    assert "at least one metric" in errors_of("period\n2025-01\n")
    assert "empty" in errors_of("  \n")


def test_blank_lines_and_empty_cells_skipped():
    parsed = parse_kpi_csv("﻿period,revenue,customers\n2025-01,5,\n\n2025-02,,9\n")
    assert parsed.rows == {date(2025, 1, 1): {"revenue": 5}, date(2025, 2, 1): {"customers": 9}}


def test_no_values_at_all():
    assert "No values found" in errors_of("period,revenue\n2025-01,\n")


def test_ai_matches_imported_metric_only_when_company_has_it():
    latest = date(2026, 9, 1)
    without = detect_intent("How many customers did we have in August 2026?", latest)
    assert without.intent == "unknown_metric"

    with_metric = detect_intent("How many customers did we have in August 2026?", latest, extra_metrics=["customers"])
    assert with_metric.intent == "lookup"
    assert with_metric.metrics == ["customers"]

    cash = detect_intent("What is the cash flow trend?", latest, extra_metrics=["cash_flow"])
    assert cash.metrics == ["cash_flow"] and cash.intent == "trend"


# --- imported metrics: how quarters/years combine months, and which are money ---------------

from app.ai.facts import value_at  # noqa: E402
from app.ai.metrics_config import aggregation_of, is_money, unit_of  # noqa: E402


@pytest.mark.parametrize(
    "metric, how",
    [
        ("revenue", "sum"), ("orders", "sum"), ("new_customers", "sum"), ("marketing_spend", "sum"),
        ("customers", "last"), ("active_customers", "last"), ("headcount", "last"), ("cash_balance", "last"),
        ("avg_order_value", "average"), ("conversion_rate", "average"), ("churn_rate", "average"),
        ("widgets", "sum"),
    ],
)
def test_aggregation_rules(metric, how):
    assert aggregation_of(metric) == how


def test_money_detection():
    assert is_money("cash_balance") and is_money("marketing_spend") and is_money("avg_order_value")
    assert not is_money("customers") and not is_money("orders") and not is_money("headcount")
    assert unit_of("marketing_spend") == "INR" and unit_of("customers") is None


def test_quarter_values_use_the_right_aggregation():
    series = [(date(2025, 1, 1), 100.0), (date(2025, 2, 1), 110.0), (date(2025, 3, 1), 130.0)]
    assert value_at(series, "2025-Q1", "orders").value == 340  # flow: sum
    assert value_at(series, "2025-Q1", "customers").value == 130  # stock: end of quarter
    assert value_at(series, "2025-Q1", "avg_order_value").value == pytest.approx(113.33, abs=0.01)
    assert "end of period" in value_at(series, "2025-Q1", "customers").text


def test_most_specific_imported_metric_wins():
    from app.ai.metrics_config import find_metrics
    extra = ["customers", "new_customers", "average_order_value"]
    assert find_metrics("how many new customers did we add?", extra) == ["new_customers"]
    assert find_metrics("how many customers do we have?", extra) == ["customers"]
    assert find_metrics("customers and new customers in march", extra) == ["customers", "new_customers"]
    assert find_metrics("what is the average order value?", extra) == ["average_order_value"]
    assert find_metrics("revenue vs profit") == ["revenue", "profit"]


def test_guard_accepts_questions_about_the_companys_own_metrics():
    from app.ai.guard import keyword_check
    q = "What was the average order value in December 2025?"
    companies = [(1, "Tamarind Lane Coffee Co.")]
    assert not keyword_check(q, 1, companies).allowed  # unknown words without the company's metrics
    assert keyword_check(q, 1, companies, extra_metrics=["average_order_value"]).allowed
    assert not keyword_check("write me a poem", 1, companies, extra_metrics=["average_order_value"]).allowed


def test_relative_period_is_spelled_out_for_the_llm():
    from app.ai.ai_service import _resolved_period_note
    intent = detect_intent("What was revenue last month?", date(2026, 10, 1))
    assert "October 2026" in _resolved_period_note("What was revenue last month?", intent)
    plain = detect_intent("What was revenue in March 2026?", date(2026, 10, 1))
    assert _resolved_period_note("What was revenue in March 2026?", plain) == ""


def test_rows_saved_as_one_quoted_cell_are_unwrapped():
    # What Excel/Sheets produce when the CSV was opened with everything in column A and re-saved.
    text = '"period,revenue,expenses,customers"\n"2025-01,100,60,7"\n"2025-02,110,65,9"\n'
    parsed = parse_kpi_csv(text)
    assert parsed.metrics == ["revenue", "expenses", "customers", "profit"]
    assert parsed.rows[date(2025, 2, 1)] == {"revenue": 110, "expenses": 65, "customers": 9, "profit": 45}
    # A normal quoted value with a comma inside still works.
    assert parse_kpi_csv('period,revenue\n2025-01,"1,234"\n').rows[date(2025, 1, 1)]["revenue"] == 1234
