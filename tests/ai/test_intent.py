from datetime import date

import pytest

from app.ai.intent import detect_intent, extract_periods, is_business_question


LATEST = date(2025, 12, 31)  # latest month in the fake data


def keys(periods):
    return [p.key for p in periods]


@pytest.mark.parametrize(
    "question, intent, metrics, periods",
    [
        # I1 lookup
        ("What was revenue in March 2025?", "lookup", ["revenue"], ["2025-03"]),
        ("Revenue in Mar 2025", "lookup", ["revenue"], ["2025-03"]),
        ("What were sales in 2025-03?", "lookup", ["revenue"], ["2025-03"]),
        ("What were earnings in Dec 2024?", "lookup", ["profit"], ["2024-12"]),
        ("How much did we spend in 2024?", "lookup", ["expenses"], ["2024"]),
        ("Revenue in 2015", "lookup", ["revenue"], ["2015"]),
        ("What is the latest profit?", "lookup", ["profit"], []),
        ("What was revenue in Q3 2024?", "lookup", ["revenue"], ["2024-Q3"]),
        # I2 summary
        ("How is the company doing?", "summary", [], []),
        ("Give me a KPI summary", "summary", [], []),
        # I3 trend
        ("How has revenue trended over the last 6 months?", "trend", ["revenue"], []),
        ("Is net profit growing?", "trend", ["profit"], []),
        # I4 compare
        ("Compare Q1 and Q2 2025 profit", "compare", ["profit"], ["2025-Q1", "2025-Q2"]),
        ("March vs February 2025 revenue", "compare", ["revenue"], ["2025-03", "2025-02"]),
        ("Revenue in 2024 versus 2025", "compare", ["revenue"], ["2024", "2025"]),
        # I5 why
        ("Why did revenue drop in March 2025?", "why", ["revenue"], ["2025-03"]),
        ("What caused profit to fall in March?", "why", ["profit"], ["2025-03"]),
        # I6 extremes
        ("Which month had the highest expenses?", "extremes", ["expenses"], []),
        ("What was the lowest revenue month in 2024?", "extremes", ["revenue"], ["2024"]),
        # I7 cross-metric
        ("Did costs grow faster than sales in 2025?", "cross_metric", ["expenses", "revenue"], ["2025"]),
        ("Did costs grow faster than revenue this year?", "cross_metric", ["expenses", "revenue"], []),
        # I11 unknown metric / outside data
        ("What is our customer churn?", "unknown_metric", [], []),
        ("What is our churn rate?", "unknown_metric", [], []),
        ("How does this compare to the industry average?", "unknown_metric", [], []),
        ("How does our revenue compare with competitors?", "unknown_metric", ["revenue"], []),
        # I12 off-topic
        ("Who won the IPL?", "off_topic", [], []),
        ("Tell me about the weather in Delhi", "off_topic", [], []),
    ],
)
def test_detect_intent(question, intent, metrics, periods):
    result = detect_intent(question, LATEST)
    assert result.intent == intent
    assert result.metrics == metrics
    assert keys(result.periods) == periods


def test_relative_windows_use_latest_data_date_not_today():
    result = detect_intent("How has revenue trended over the last 6 months?", LATEST)
    assert keys(result.window) == ["2025-07", "2025-12"]

    result = detect_intent("Did costs grow faster than revenue this year?", date(2025, 6, 30))
    assert keys(result.window) == ["2025-01", "2025-06"]

    _, window = extract_periods("over the past three months", date(2025, 2, 28))
    assert keys(window) == ["2024-12", "2025-02"]


def test_month_without_year_is_most_recent_occurrence():
    assert keys(extract_periods("revenue in march", LATEST)[0]) == ["2025-03"]
    # Data ends in Feb 2025, so "December" means December 2024.
    assert keys(extract_periods("revenue in december", date(2025, 2, 28))[0]) == ["2024-12"]
    # An explicit year elsewhere in the question wins.
    assert keys(extract_periods("Q1 and Q2 2024", LATEST)[0]) == ["2024-Q1", "2024-Q2"]


def test_last_year_and_quarters():
    assert keys(extract_periods("profit last year", LATEST)[0]) == ["2024"]
    assert keys(extract_periods("revenue last quarter", LATEST)[0]) == ["2025-Q3"]
    assert keys(extract_periods("revenue this quarter", LATEST)[0]) == ["2025-Q4"]


def test_may_as_a_word_is_not_a_month():
    assert extract_periods("may I see revenue", LATEST)[0] == []
    assert keys(extract_periods("revenue in may", LATEST)[0]) == ["2025-05"]


def test_follow_up_reuses_metric_from_history():
    history = [
        {"role": "user", "content": "What was revenue in March 2025?"},
        {"role": "assistant", "content": "Revenue in March 2025 was 82,97,362 INR."},
    ]
    result = detect_intent("And in April?", LATEST, history)
    assert result.intent == "lookup"
    assert result.metrics == ["revenue"]
    assert keys(result.periods) == ["2025-04"]
    assert result.from_history


def test_intent_codes():
    assert detect_intent("Why did revenue drop?", LATEST).code == "I5"
    assert detect_intent("Who won the IPL?", LATEST).code == "I12"


def test_is_business_question():
    assert is_business_question("How is the company doing?")
    assert is_business_question("What is our churn?")
    assert not is_business_question("Who won the IPL?")
