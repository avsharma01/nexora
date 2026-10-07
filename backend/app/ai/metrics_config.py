"""The ONE place that knows metric names, units, display names and synonyms.

The kpis table stores no unit/currency, so units live here. When the team's real
seed data arrives, only this file should need to change.
"""

import re


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


def unit_of(metric: str) -> str | None:
    return METRICS.get(metric, {}).get("unit")


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
