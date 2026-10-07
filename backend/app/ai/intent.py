"""Rule-based question understanding (no LLM): intent, metric(s) and period(s).

Relative periods ("last 6 months", "this year", "March" with no year) are
resolved against the LATEST DATE IN THE DATA, not today's date, so answers stay
stable when the data is a few months old.

Intents follow SPEC §2:
    lookup (I1) · summary (I2) · trend (I3) · compare (I4) · why (I5)
    extremes (I6) · cross_metric (I7) · unknown_metric (I11) · off_topic (I12)
Advice, injection and other-company requests are handled by guard.py.
"""

import re
from dataclasses import dataclass, field
from datetime import date

from app.ai.facts import Period, months_back, previous_period
from app.ai.metrics_config import find_metrics


INTENT_CODES = {
    "lookup": "I1",
    "summary": "I2",
    "trend": "I3",
    "compare": "I4",
    "why": "I5",
    "extremes": "I6",
    "cross_metric": "I7",
    "unknown_metric": "I11",
    "off_topic": "I12",
}

# Words that make a question "about the business" even without a known metric.
BUSINESS_WORDS = [
    "company", "business", "kpi", "kpis", "metric", "metrics", "performance", "performing",
    "doing", "summary", "summarise", "summarize", "overview", "financial", "financials",
    "growth", "grow", "grew", "trend", "trends", "trended", "quarter", "month", "year",
    "compare", "comparison", "data", "numbers", "results", "figures", "highest", "lowest",
    "increase", "decrease", "drop", "dropped", "decline", "declined", "rise", "rose",
    "fell", "fall", "forecast", "q1", "q2", "q3", "q4",
]

# Things people ask about that NEXORA has no data for (-> insufficient_data, not off-topic).
UNAVAILABLE_TERMS = [
    "churn", "customer", "customers", "client", "clients", "employee", "employees",
    "headcount", "staff", "margin", "margins", "ebitda", "cash flow", "cashflow", "cash",
    "debt", "loan", "inventory", "stock level", "market share", "nps", "retention",
    "users", "subscribers", "orders", "footfall", "share price", "stock price",
    "valuation", "dividend", "tax", "salary", "salaries", "budget",
]

# Outside knowledge we don't have, even when a known metric is mentioned.
OUTSIDE_DATA_TERMS = [
    "industry average", "industry benchmark", "benchmark", "competitor", "competitors",
    "market average", "peers", "other companies in", "sector average",
]

MONTHS = {
    "jan": 1, "january": 1, "feb": 2, "february": 2, "mar": 3, "march": 3,
    "apr": 4, "april": 4, "may": 5, "jun": 6, "june": 6, "jul": 7, "july": 7,
    "aug": 8, "august": 8, "sep": 9, "sept": 9, "september": 9, "oct": 10,
    "october": 10, "nov": 11, "november": 11, "dec": 12, "december": 12,
}

NUMBER_WORDS = {
    "one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7,
    "eight": 8, "nine": 9, "ten": 10, "eleven": 11, "twelve": 12, "eighteen": 18,
    "twenty-four": 24,
}

_MONTH_RE = re.compile(
    r"\b(" + "|".join(sorted(MONTHS, key=len, reverse=True)) + r")\b\.?(?:[\s,]+'?(\d{4}))?"
)
_QUARTER_RE = re.compile(r"\bq([1-4])\b(?:[\s,]+(?:of\s+|fy\s*)?(\d{4}))?")
_ISO_MONTH_RE = re.compile(r"\b(\d{4})-(\d{2})\b")
_YEAR_RE = re.compile(r"\b(20\d{2}|19\d{2})\b")
_LAST_N_RE = re.compile(
    r"\b(?:last|past|previous)\s+(\d+|" + "|".join(NUMBER_WORDS) + r")\s+months?\b"
)

_WHY_RE = re.compile(r"\b(why|reason|reasons|cause|caused|causes|explain|what happened|what drove|driver|drivers)\b")
_CROSS_RE = re.compile(r"\b(faster|slower|more than|less than|outpac\w*|relative to|ratio)\b")
_COMPARE_RE = re.compile(r"\b(compare|compared|comparison|vs\.?|versus|against|difference between)\b")
_EXTREME_RE = re.compile(r"\b(highest|lowest|best|worst|peak|maximum|minimum|max|min|most|least|biggest|smallest|record)\b")
_TREND_RE = re.compile(
    r"\b(trend|trends|trended|trending|over time|growing|grow|grew|growth|changed|"
    r"evolve\w*|progress\w*|over the (?:last|past)|direction|improving|declining)\b"
)


@dataclass
class Intent:
    intent: str
    metrics: list[str] = field(default_factory=list)
    periods: list[Period] = field(default_factory=list)
    window: tuple[Period, Period] | None = None
    unknown_terms: list[str] = field(default_factory=list)
    from_history: bool = False

    @property
    def code(self) -> str:
        return INTENT_CODES[self.intent]


def _has_any(text: str, words: list[str]) -> list[str]:
    return [w for w in words if re.search(rf"\b{re.escape(w)}\b", text)]


def is_business_question(text: str) -> bool:
    text = text.lower()
    return bool(
        find_metrics(text)
        or _has_any(text, BUSINESS_WORDS)
        or _has_any(text, UNAVAILABLE_TERMS)
        or _has_any(text, OUTSIDE_DATA_TERMS)
    )


def _resolve_year(month_or_quarter_last: int, kind: str, explicit_years: list[int], latest: date | None) -> int:
    """Year for a month/quarter given without one: an explicit year in the question,
    else the most recent occurrence not after the latest data date."""
    if explicit_years:
        return explicit_years[-1]
    ref = latest or date.today()
    last_month = month_or_quarter_last * 3 if kind == "quarter" else month_or_quarter_last
    return ref.year if last_month <= ref.month else ref.year - 1


def extract_periods(text: str, latest: date | None) -> tuple[list[Period], tuple[Period, Period] | None]:
    """Explicit periods in order of mention, plus a relative window if one was asked for."""
    text = text.lower()
    found: list[tuple[int, Period]] = []
    used: list[tuple[int, int]] = []
    explicit_years = [int(y) for y in _YEAR_RE.findall(text)]

    def free(span: tuple[int, int]) -> bool:
        return all(span[1] <= a or span[0] >= b for a, b in used)

    for m in _ISO_MONTH_RE.finditer(text):
        month = int(m.group(2))
        if 1 <= month <= 12:
            found.append((m.start(), Period("month", int(m.group(1)), month)))
            used.append(m.span())

    for m in _QUARTER_RE.finditer(text):
        if not free(m.span()):
            continue
        q = int(m.group(1))
        year = int(m.group(2)) if m.group(2) else None
        found.append((m.start(), Period("quarter", year or 0, q)))
        used.append(m.span())

    for m in _MONTH_RE.finditer(text):
        if not free(m.span()):
            continue
        word, year = m.group(1), m.group(2)
        # "may"/"mar" are also ordinary words; require a year or a preposition before them.
        if word in ("may", "mar") and not year:
            before = text[: m.start()].rstrip().split()[-1:] or [""]
            if before[0] not in ("in", "of", "for", "vs", "and", "to", "from", "since", "during"):
                continue
        found.append((m.start(), Period("month", int(year) if year else 0, MONTHS[word])))
        used.append(m.span())

    for m in _YEAR_RE.finditer(text):
        if free(m.span()):
            found.append((m.start(), Period("year", int(m.group(1)))))
            used.append(m.span())

    # Fill in missing years for "March" / "Q1" (year 0 = not given).
    periods = []
    for _, p in sorted(found, key=lambda item: item[0]):
        if p.year == 0:
            p = Period(p.kind, _resolve_year(p.index, p.kind, explicit_years, latest), p.index)
        periods.append(p)

    # Relative windows, measured from the latest data month.
    window = None
    if latest is not None:
        end = Period("month", latest.year, latest.month)
        if m := _LAST_N_RE.search(text):
            n = int(m.group(1)) if m.group(1).isdigit() else NUMBER_WORDS[m.group(1)]
            window = (months_back(end, n - 1), end)
        elif re.search(r"\b(this year|year to date|ytd|so far this year)\b", text):
            window = (Period("month", latest.year, 1), end)
        elif re.search(r"\b(last|previous|past) (year|12 months)\b", text):
            if "12 months" in text or "past year" in text:
                window = (months_back(end, 11), end)
            else:
                periods.append(Period("year", latest.year - 1))
        elif re.search(r"\b(this|current) quarter\b", text):
            periods.append(Period("quarter", latest.year, (latest.month - 1) // 3 + 1))
        elif re.search(r"\b(last|previous) quarter\b", text):
            periods.append(previous_period(Period("quarter", latest.year, (latest.month - 1) // 3 + 1)))
        elif re.search(r"\b(last|latest|previous) month\b", text) and not periods:
            periods.append(end)

    return periods, window



def detect_intent(
    question: str,
    latest: date | None = None,
    history: list[dict] | None = None,
) -> Intent:
    text = question.lower().strip()
    metrics = find_metrics(text)
    periods, window = extract_periods(text, latest)
    unknown = _has_any(text, UNAVAILABLE_TERMS)
    outside = _has_any(text, OUTSIDE_DATA_TERMS)

    from_history = False
    if not metrics and history:
        # Follow-up like "And in April?": reuse the metric(s) from the last user turn.
        for turn in reversed(history):
            if turn.get("role") == "user":
                previous = find_metrics(turn.get("content", ""))
                if previous:
                    metrics, from_history = previous, True
                    break

    def make(name: str) -> Intent:
        return Intent(name, metrics, periods, window, unknown + outside, from_history)

    if outside:
        return make("unknown_metric")
    if unknown and not metrics:
        return make("unknown_metric")
    if not metrics and not is_business_question(text):
        return make("off_topic")

    if metrics:
        if _WHY_RE.search(text):
            return make("why")
        if len(metrics) >= 2 and (_CROSS_RE.search(text) or _TREND_RE.search(text)):
            return make("cross_metric")
        if _COMPARE_RE.search(text) or len(periods) >= 2:
            return make("compare")
        if _EXTREME_RE.search(text):
            return make("extremes")
        if window is not None or _TREND_RE.search(text):
            return make("trend")
        return make("lookup")

    # Business question without a specific metric: "How is the company doing?"
    return make("summary")
