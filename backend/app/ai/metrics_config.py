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


DEFAULT_CURRENCY = "INR"

# Company-specific metrics (CSV imports) have no config entry, so their behaviour comes from the
# words in their name. Keep these lists in step with frontend/lib/nexora/metrics.ts.
_AVERAGE_WORDS = {
    "avg", "average", "mean", "rate", "ratio", "margin", "pct", "percent", "percentage", "per",
    "nps", "score", "aov", "price", "yield", "utilization", "utilisation", "occupancy",
    "conversion", "retention", "churn", "arpu", "arpa",
}
_FLOW_WORDS = {
    "new", "added", "acquired", "churned", "lost", "signups", "orders", "sales", "spend",
    "spending", "cost", "costs", "expense", "expenses", "revenue", "income", "payroll", "visits",
    "sessions", "transactions", "units", "shipments", "deliveries", "tickets", "hires", "leads",
}
_STOCK_WORDS = {
    "customers", "customer", "subscribers", "users", "members", "accounts", "headcount",
    "employees", "staff", "stores", "outlets", "branches", "locations", "cash", "balance",
    "inventory", "arr", "mrr", "backlog", "pipeline", "active",
}
_MONEY_WORDS = {
    "revenue", "sales", "income", "expense", "expenses", "cost", "costs", "spend", "spending",
    "cash", "balance", "profit", "ebitda", "price", "value", "payroll", "salary", "salaries",
    "budget", "arr", "mrr", "gmv", "aov", "capex", "opex", "fees", "burn", "arpu", "arpa",
}


def _words(metric: str) -> set[str]:
    return set(re.split(r"[^a-z0-9]+", metric.lower())) - {""}


def aggregation_of(metric: str) -> str:
    """How months combine into a quarter or year: "sum" (flows: revenue, orders, new customers),
    "last" (stocks: customers, headcount, cash balance = value at the period's end) or
    "average" (rates and averages: average order value, conversion rate)."""
    if metric in METRICS:
        return "sum"
    words = _words(metric)
    if words & _AVERAGE_WORDS:
        return "average"
    if words & _FLOW_WORDS:
        return "sum"
    if words & _STOCK_WORDS:
        return "last"
    return "sum"


def is_money(metric: str) -> bool:
    if metric in METRICS:
        return _is_currency(METRICS[metric].get("unit"))
    return bool(_words(metric) & _MONEY_WORDS)


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
    if unit is None and metric and is_money(metric):
        unit = DEFAULT_CURRENCY  # imported money metric (cash_balance, marketing_spend, ...)
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


def extra_metric_phrases(name: str) -> list[str]:
    """How a question may name a company-specific metric imported from CSV:
    "cash_flow" -> ["cash flow", "cash flows"], "customers" -> ["customers", "customer"]."""
    base = name.replace("_", " ").strip().lower()
    if not base:
        return []
    other = base[:-1] if base.endswith("s") and len(base) > 3 else base + "s"
    return [base, other]


def find_metrics(text: str, extra: list[str] | tuple[str, ...] = ()) -> list[str]:
    """All canonical metrics mentioned in free text, in order of first mention.

    `extra`: the company's own metrics beyond the configured ones (from a CSV import, such as
    "customers" or "cash_flow"); they are matched by name and returned as stored."""
    text = text.lower()
    candidates = [(name, cfg["synonyms"]) for name, cfg in METRICS.items()]
    candidates += [(name, extra_metric_phrases(name)) for name in extra if name not in METRICS]
    spans: dict[str, list[tuple[int, int]]] = {}
    for name, phrases in candidates:
        found = [
            (m.start(), m.end())
            for phrase in phrases
            for m in re.finditer(rf"\b{re.escape(phrase)}\b", text)
        ]
        if found:
            spans[name] = found

    # The most specific name wins: in "new customers", "customers" only matched inside the
    # "new_customers" phrase, so it is not a separate metric.
    def inside_other(name: str) -> bool:
        return all(
            any(o_start <= start and end <= o_end and (o_end - o_start) > (end - start)
                for other, other_spans in spans.items() if other != name
                for o_start, o_end in other_spans)
            for start, end in spans[name]
        )

    hits = [(min(s for s, _ in found), name) for name, found in spans.items() if not inside_other(name)]
    return [name for _, name in sorted(hits)]
