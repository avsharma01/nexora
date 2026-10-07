"""The ONE place that knows metric names, units, display names and synonyms.

The kpis table stores no unit/currency, so units live here. When the team's real
seed data arrives, only this file should need to change. A company's own currency
(financial_records.currency, see data_access.company_currency) overrides the
currency here while answering about that company.
"""

import re
from contextlib import contextmanager
from contextvars import ContextVar


METRICS: dict[str, dict] = {
    "revenue": {
        "display": "Revenue",
        "unit": "INR",
        "synonyms": ["revenue", "revenues", "sales", "turnover", "top line", "topline"],
    },
    "expenses": {
        "display": "Expenses",
        "unit": "INR",
        "synonyms": ["expenses", "expense", "costs", "cost", "spend", "spending", "opex", "expenditure"],
    },
    "profit": {
        "display": "Profit",
        "unit": "INR",
        "synonyms": ["profit", "profits", "earnings", "net", "net income", "bottom line"],
    },
}


def display_name(metric: str) -> str:
    return METRICS.get(metric, {}).get("display", metric.replace("_", " ").title())


def _is_currency(unit: str | None) -> bool:
    return bool(unit) and len(unit) == 3 and unit.isalpha() and unit.isupper()


# The company's own currency (e.g. "USD" from financial_records) overrides the
# currency above for money metrics, for the duration of one question. A
# ContextVar keeps concurrent requests for different companies apart.
_company_currency: ContextVar[str | None] = ContextVar("company_currency", default=None)


@contextmanager
def company_currency(code: str | None):
    token = _company_currency.set(code.strip().upper() if code else None)
    try:
        yield
    finally:
        _company_currency.reset(token)


def unit_of(metric: str) -> str | None:
    unit = METRICS.get(metric, {}).get("unit")
    override = _company_currency.get()
    if override and _is_currency(unit):
        return override
    return unit


def resolve_metric(word: str) -> str | None:
    """Map one word/phrase ("sales") to its canonical metric name ("revenue")."""
    word = word.strip().lower()
    for name, cfg in METRICS.items():
        if word == name or word in cfg["synonyms"]:
            return name
    return None


def find_metrics(text: str) -> list[str]:
    """All canonical metrics mentioned in free text, in order of first mention."""
    text = text.lower()
    hits: list[tuple[int, str]] = []
    for name, cfg in METRICS.items():
        positions = [
            m.start()
            for syn in cfg["synonyms"]
            for m in re.finditer(rf"\b{re.escape(syn)}\b", text)
        ]
        if positions:
            hits.append((min(positions), name))
    return [name for _, name in sorted(hits)]
