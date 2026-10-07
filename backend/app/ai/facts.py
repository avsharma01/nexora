"""All the maths for the AI Business Analyst, in Python.

The LLM never calculates. These functions turn [(date, value)] series into Fact
objects whose `text` already contains every number the LLM may quote. Values in
`value` / `data` are unrounded; rounding happens only when formatting `text`
(1 decimal for %, Indian digit grouping for INR).

Data is treated as monthly: if a month has several dates, the latest date wins;
if a date has several rows, the last stored row wins (same rule as the
analytics service). Both cases add a data-quality note.

Periods are written as "2025-03" (month), "2025-Q1" (quarter) or "2025" (year).
Quarter and year values are SUMS of the monthly values (flow metrics).
"""

import calendar
import re
from dataclasses import dataclass, field
from datetime import date

from sqlalchemy.orm import Session

from app.ai.metrics_config import display_name, unit_of
from app.services.analytics_service import get_company_analytics


Series = list[tuple[date, float]]
MonthKey = tuple[int, int]


# --------------------------------------------------------------------------- #
# Fact
# --------------------------------------------------------------------------- #

@dataclass
class Fact:
    id: str
    text: str
    value: float | None
    unit: str | None
    period: str
    kind: str = "historical"
    data: dict = field(default_factory=dict)
    notes: list[str] = field(default_factory=list)
    metric: str | None = None
    label: str = ""  # short human label for UI figures / sources


# --------------------------------------------------------------------------- #
# Formatting (the only place where rounding happens)
# --------------------------------------------------------------------------- #

def _indian_group(digits: str) -> str:
    if len(digits) <= 3:
        return digits
    head, tail = digits[:-3], digits[-3:]
    pairs = []
    while len(head) > 2:
        pairs.insert(0, head[-2:])
        head = head[:-2]
    if head:
        pairs.insert(0, head)
    return ",".join(pairs + [tail])


def format_inr(value: float) -> str:
    """12345678.0 -> '1,23,45,678'; keeps 2 decimals only when there are paise."""
    rounded = round(value, 2)
    sign = "-" if rounded < 0 else ""
    whole, _, frac = f"{abs(rounded):.2f}".partition(".")
    text = _indian_group(whole)
    if frac != "00":
        text += "." + frac
    return sign + text


def _plain_number(value: float) -> str:
    rounded = round(value, 2)
    if float(rounded).is_integer():
        return f"{int(rounded):,}"
    return f"{rounded:,.2f}"


def format_value(value: float, unit: str | None) -> str:
    """INR -> Indian grouping ('10,50,000 INR'); other currency codes -> western
    grouping ('1,050,000 USD'); '%' -> 1 decimal; no unit -> plain number."""
    if unit == "INR":
        return f"{format_inr(value)} INR"
    if unit == "%":
        return f"{round(value, 1):.1f}%"
    if unit:
        return f"{_plain_number(value)} {unit}"
    return _plain_number(value)


def format_change(value: float, unit: str | None) -> str:
    text = format_value(value, unit)
    return text if text.startswith("-") or round(value, 2) == 0 else "+" + text


def format_pct(pct: float | None) -> str:
    if pct is None:
        return "n/a (previous value is 0)"
    rounded = round(pct, 1)
    if rounded == 0:
        return "0.0%"
    return f"{rounded:+.1f}%"


# --------------------------------------------------------------------------- #
# Periods
# --------------------------------------------------------------------------- #

@dataclass(frozen=True)
class Period:
    kind: str  # "month" | "quarter" | "year"
    year: int
    index: int = 0  # month 1-12, quarter 1-4, 0 for a year

    @property
    def months(self) -> list[MonthKey]:
        if self.kind == "month":
            return [(self.year, self.index)]
        if self.kind == "quarter":
            first = 3 * (self.index - 1) + 1
            return [(self.year, m) for m in range(first, first + 3)]
        return [(self.year, m) for m in range(1, 13)]

    @property
    def start(self) -> date:
        y, m = self.months[0]
        return date(y, m, 1)

    @property
    def end(self) -> date:
        y, m = self.months[-1]
        return date(y, m, calendar.monthrange(y, m)[1])

    @property
    def key(self) -> str:
        if self.kind == "month":
            return f"{self.year}-{self.index:02d}"
        if self.kind == "quarter":
            return f"{self.year}-Q{self.index}"
        return str(self.year)

    @property
    def label(self) -> str:
        if self.kind == "month":
            return month_label((self.year, self.index))
        if self.kind == "quarter":
            return f"Q{self.index} {self.year}"
        return str(self.year)


def previous_period(period: "Period") -> "Period":
    """The period just before: month -> previous month, Q1 -> Q4 of last year, etc."""
    if period.kind == "month":
        y, m = period.year, period.index
        return Period("month", y - 1, 12) if m == 1 else Period("month", y, m - 1)
    if period.kind == "quarter":
        y, q = period.year, period.index
        return Period("quarter", y - 1, 4) if q == 1 else Period("quarter", y, q - 1)
    return Period("year", period.year - 1)


def months_back(end: "Period", n: int) -> "Period":
    """The month n months before `end` (a month Period)."""
    y, m = end.year, end.index - n
    while m < 1:
        m, y = m + 12, y - 1
    return Period("month", y, m)


def parse_period(period: "str | date | Period") -> Period:
    if isinstance(period, Period):
        return period
    if isinstance(period, date):
        return Period("month", period.year, period.month)

    text = period.strip().upper()
    if m := re.fullmatch(r"(\d{4})-(\d{1,2})", text):
        month = int(m.group(2))
        if 1 <= month <= 12:
            return Period("month", int(m.group(1)), month)
    if m := re.fullmatch(r"(\d{4})-?Q([1-4])", text):
        return Period("quarter", int(m.group(1)), int(m.group(2)))
    if m := re.fullmatch(r"(\d{4})", text):
        return Period("year", int(m.group(1)))
    raise ValueError(f"Unrecognised period: {period!r} (use 2025-03, 2025-Q1 or 2025)")


def month_label(key: MonthKey) -> str:
    return f"{calendar.month_name[key[1]]} {key[0]}"


def _month_key(key: MonthKey) -> str:
    return f"{key[0]}-{key[1]:02d}"


def _months_between(first: MonthKey, last: MonthKey) -> list[MonthKey]:
    keys = []
    y, m = first
    while (y, m) <= last:
        keys.append((y, m))
        y, m = (y + 1, 1) if m == 12 else (y, m + 1)
    return keys


# --------------------------------------------------------------------------- #
# Cleaning
# --------------------------------------------------------------------------- #

def clean_series(series: Series) -> tuple[Series, list[str]]:
    """Sort by date; for duplicate dates keep the last stored value."""
    by_date: dict[date, float] = {}
    duplicates: list[date] = []
    for d, v in sorted(series, key=lambda row: row[0]):
        if d in by_date and d not in duplicates:
            duplicates.append(d)
        by_date[d] = float(v)

    notes = [
        f"Data quality: several rows for {d.isoformat()}; used the last stored value."
        for d in duplicates
    ]
    return sorted(by_date.items()), notes


def monthly(series: Series) -> tuple[dict[MonthKey, tuple[date, float]], list[str]]:
    """One (date, value) per month; the latest date in a month wins."""
    cleaned, notes = clean_series(series)
    months: dict[MonthKey, tuple[date, float]] = {}
    multi: list[MonthKey] = []
    for d, v in cleaned:
        key = (d.year, d.month)
        if key in months and key not in multi:
            multi.append(key)
        months[key] = (d, v)

    notes += [
        f"Data quality: several dates in {month_label(k)}; used the latest one "
        f"({months[k][0].isoformat()})."
        for k in multi
    ]
    return dict(sorted(months.items())), notes


def _window(
    months: dict[MonthKey, tuple[date, float]],
    start: "str | date | Period | None",
    end: "str | date | Period | None",
) -> dict[MonthKey, tuple[date, float]]:
    lo = parse_period(start).months[0] if start is not None else None
    hi = parse_period(end).months[-1] if end is not None else None
    return {
        k: v
        for k, v in months.items()
        if (lo is None or k >= lo) and (hi is None or k <= hi)
    }


# --------------------------------------------------------------------------- #
# Calculations
# --------------------------------------------------------------------------- #

def pct_change(prev: float, curr: float) -> float | None:
    """% change using abs(prev) as denominator (same formula as analytics_service).

    -100 -> 50 gives +150.0 (an improvement), not -150.0. None if prev == 0.
    """
    if prev == 0:
        return None
    return (curr - prev) / abs(prev) * 100


def _direction(change: float) -> str:
    if change > 0:
        return "up"
    if change < 0:
        return "down"
    return "flat"


def _period_total(
    months: dict[MonthKey, tuple[date, float]], period: Period
) -> dict | None:
    present = [k for k in period.months if k in months]
    if not present:
        return None
    missing = [k for k in period.months if k not in months]
    return {
        "value": sum(months[k][1] for k in present),
        "months_present": len(present),
        "months_expected": len(period.months),
        "missing": [_month_key(k) for k in missing],
        "missing_labels": [month_label(k) for k in missing],
    }


def _partial_note(period: Period, total: dict) -> list[str]:
    if not total["missing"]:
        return []
    return [
        f"{period.label} is incomplete: {total['months_present']} of "
        f"{total['months_expected']} months available (missing: "
        f"{', '.join(total['missing_labels'])})."
    ]


def _period_phrase(period: Period, total: dict) -> str:
    if period.kind == "month":
        return period.label
    return f"{period.label} (sum of {total['months_present']} months)"


def value_at(
    series: Series, period: "str | date | Period", metric: str | None = None
) -> Fact | None:
    """Value for one month, or the sum for a quarter/year. None if no data."""
    p = parse_period(period)
    months, notes = monthly(series)
    total = _period_total(months, p)
    if total is None:
        return None

    name, unit = display_name(metric or "value"), unit_of(metric or "")
    data = dict(total)
    if p.kind == "month":
        data["date"] = months[p.months[0]][0]

    return Fact(
        id=f"{metric or 'value'}.value.{p.key}",
        text=f"{name} in {_period_phrase(p, total)}: {format_value(total['value'], unit)}",
        value=total["value"],
        unit=unit,
        period=p.key,
        data=data,
        notes=notes + _partial_note(p, total),
        metric=metric,
        label=f"{name}, {p.label}",
    )


def trend(
    series: Series,
    start: "str | date | Period | None" = None,
    end: "str | date | Period | None" = None,
    metric: str | None = None,
) -> Fact | None:
    """Start/end values, abs + % change, direction, number of points, gaps, min/max."""
    months, notes = monthly(series)
    months = _window(months, start, end)
    if not months:
        return None

    name, unit = display_name(metric or "value"), unit_of(metric or "")
    keys = list(months)
    first, last = keys[0], keys[-1]
    first_value, last_value = months[first][1], months[last][1]
    period = f"{_month_key(first)}..{_month_key(last)}"

    if len(keys) == 1:
        return Fact(
            id=f"{metric or 'value'}.trend.{period}",
            text=(
                f"{name}: only one data point ({month_label(first)}: "
                f"{format_value(first_value, unit)}); no trend can be computed."
            ),
            value=None,
            unit=unit,
            period=_month_key(first),
            data={
                "start": _month_key(first), "end": _month_key(last),
                "start_value": first_value, "end_value": last_value,
                "change": None, "pct_change": None, "direction": None,
                "points": 1, "gaps": [],
            },
            notes=notes + ["Based on limited data: a single data point."],
            metric=metric,
            label=f"{name}, {month_label(first)}",
        )

    change = last_value - first_value
    pct = pct_change(first_value, last_value)
    gaps = [k for k in _months_between(first, last) if k not in months]
    high = max(keys, key=lambda k: months[k][1])
    low = min(keys, key=lambda k: months[k][1])

    text = (
        f"{name} from {month_label(first)} to {month_label(last)} "
        f"({len(keys)} monthly data points): {format_value(first_value, unit)} -> "
        f"{format_value(last_value, unit)}, change {format_change(change, unit)} "
        f"({format_pct(pct)}), direction {_direction(change)}. "
        f"Highest: {format_value(months[high][1], unit)} ({month_label(high)}); "
        f"lowest: {format_value(months[low][1], unit)} ({month_label(low)})."
    )
    if gaps:
        notes.append(f"Missing months: {', '.join(month_label(k) for k in gaps)}.")

    return Fact(
        id=f"{metric or 'value'}.trend.{period}",
        text=text,
        value=change,
        unit=unit,
        period=period,
        data={
            "start": _month_key(first), "end": _month_key(last),
            "start_value": first_value, "end_value": last_value,
            "change": change, "pct_change": pct, "direction": _direction(change),
            "points": len(keys), "gaps": [_month_key(k) for k in gaps],
            "max": {"period": _month_key(high), "value": months[high][1]},
            "min": {"period": _month_key(low), "value": months[low][1]},
        },
        notes=notes,
        metric=metric,
        label=f"{name} change, {month_label(first)} to {month_label(last)}",
    )


def compare_periods(
    series: Series,
    period_a: "str | date | Period",
    period_b: "str | date | Period",
    metric: str | None = None,
) -> Fact | None:
    """Compare two months, quarters (sum) or years (sum): b relative to a."""
    pa, pb = parse_period(period_a), parse_period(period_b)
    months, notes = monthly(series)
    ta, tb = _period_total(months, pa), _period_total(months, pb)
    if ta is None or tb is None:
        return None

    name, unit = display_name(metric or "value"), unit_of(metric or "")
    change = tb["value"] - ta["value"]
    pct = pct_change(ta["value"], tb["value"])

    text = (
        f"{name}: {_period_phrase(pa, ta)} = {format_value(ta['value'], unit)}; "
        f"{_period_phrase(pb, tb)} = {format_value(tb['value'], unit)}; "
        f"change {format_change(change, unit)} ({format_pct(pct)}), "
        f"direction {_direction(change)}."
    )
    if pa.kind != pb.kind:
        notes.append(f"Comparing a {pa.kind} with a {pb.kind}; totals cover different lengths.")

    return Fact(
        id=f"{metric or 'value'}.compare.{pa.key}..{pb.key}",
        text=text,
        value=change,
        unit=unit,
        period=f"{pa.key}..{pb.key}",
        data={
            "a": {"period": pa.key, **ta},
            "b": {"period": pb.key, **tb},
            "change": change,
            "pct_change": pct,
            "direction": _direction(change),
        },
        notes=notes + _partial_note(pa, ta) + _partial_note(pb, tb),
        metric=metric,
        label=f"{name} change, {pa.label} to {pb.label}",
    )


def extremes(
    series: Series,
    metric: str | None = None,
    start: "str | date | Period | None" = None,
    end: "str | date | Period | None" = None,
) -> list[Fact]:
    """[highest, lowest] monthly values with their months. Empty list if no data."""
    months, notes = monthly(series)
    months = _window(months, start, end)
    if not months:
        return []

    name, unit = display_name(metric or "value"), unit_of(metric or "")
    if len(months) == 1:
        notes = notes + ["Based on limited data: a single data point."]

    facts = []
    for label, pick in (("highest", max), ("lowest", min)):
        best_value = pick(v for _, v in months.values())
        ties = [k for k, (_, v) in months.items() if v == best_value]
        fact_notes = list(notes)
        if len(ties) > 1:
            fact_notes.append(
                f"Tie for {label}: {', '.join(month_label(k) for k in ties)}."
            )
        key = ties[0]
        facts.append(
            Fact(
                id=f"{metric or 'value'}.{label}",
                text=(
                    f"{name} {label} month: {month_label(key)} "
                    f"({format_value(best_value, unit)}), out of {len(months)} months."
                ),
                value=best_value,
                unit=unit,
                period=_month_key(key),
                data={"months": len(months), "ties": [_month_key(k) for k in ties]},
                notes=fact_notes,
                metric=metric,
                label=f"{name} {label} month ({month_label(key)})",
            )
        )
    return facts


def cross_metric_growth(
    series_a: Series,
    series_b: Series,
    start: "str | date | Period | None" = None,
    end: "str | date | Period | None" = None,
    metric_a: str | None = None,
    metric_b: str | None = None,
) -> Fact | None:
    """Growth of two metrics over the same months (their common first/last month)."""
    months_a, notes_a = monthly(series_a)
    months_b, notes_b = monthly(series_b)
    common = sorted(set(_window(months_a, start, end)) & set(_window(months_b, start, end)))
    if not common:
        return None

    first, last = common[0], common[-1]
    window = (Period("month", *first), Period("month", *last))
    ta = trend(series_a, *window, metric=metric_a)
    tb = trend(series_b, *window, metric=metric_b)
    name_a, name_b = display_name(metric_a or "a"), display_name(metric_b or "b")
    pa, pb = ta.data["pct_change"], tb.data["pct_change"]
    period = f"{_month_key(first)}..{_month_key(last)}"
    notes = notes_a + notes_b

    if len(common) < 2 or pa is None or pb is None:
        verdict = "growth rates cannot be compared"
        faster = None
        notes.append(
            "Growth rates need two months for both metrics and a non-zero start value."
        )
    elif round(pa, 1) == round(pb, 1):
        verdict = "both grew at the same rate"
        faster = "same"
    else:
        faster = metric_a if pa > pb else metric_b
        verdict = f"{display_name(faster)} had the higher growth rate"

    text = (
        f"From {month_label(first)} to {month_label(last)}: "
        f"{name_a} {format_pct(pa)}, {name_b} {format_pct(pb)}; {verdict}."
    )
    return Fact(
        id=f"{metric_a or 'a'}_vs_{metric_b or 'b'}.growth.{period}",
        text=text,
        value=None if faster is None else (pa - pb),
        unit="pp",
        period=period,
        data={"a": ta.data, "b": tb.data, "faster": faster, "metrics": [metric_a, metric_b]},
        notes=notes,
        metric=metric_a,
        label=f"{name_a} vs {name_b} growth, {month_label(first)} to {month_label(last)}",
    )


def latest_summary(db: Session, company_id: int) -> list[Fact]:
    """Latest value per metric (+ change vs previous), reusing the analytics service."""
    facts = []
    for m in get_company_analytics(db, company_id).metrics:
        if m.latest_value is None or m.latest_date is None:
            continue

        metric = m.metric_name.strip().lower()  # seeds disagree on case ("Revenue")
        name, unit = display_name(metric), unit_of(metric)
        latest = (m.latest_date.year, m.latest_date.month)
        base = f"{name} latest ({month_label(latest)}): {format_value(m.latest_value, unit)}"
        data = {"latest_date": m.latest_date, "latest_value": m.latest_value}
        notes: list[str] = []

        if not m.comparison_available:
            text = base + "; no earlier value to compare with."
            notes.append("Based on limited data: a single data point.")
        elif m.latest_date == m.previous_date:
            text = base + "; change not computed."
            notes.append(
                f"Data quality: several rows for {m.latest_date.isoformat()}; "
                "change vs previous period not computed."
            )
        else:
            previous = (m.previous_date.year, m.previous_date.month)
            text = (
                f"{base}; previous ({month_label(previous)}): "
                f"{format_value(m.previous_value, unit)}; change "
                f"{format_change(m.change, unit)} ({format_pct(m.change_percentage)})."
            )
            data.update(
                previous_date=m.previous_date,
                previous_value=m.previous_value,
                change=m.change,
                pct_change=m.change_percentage,
            )
        data.setdefault("change", None)
        data.setdefault("pct_change", None)

        facts.append(
            Fact(
                id=f"{metric}.latest",
                text=text,
                value=m.latest_value,
                unit=unit,
                period=_month_key(latest),
                data=data,
                notes=notes,
                metric=metric,
                label=f"{name}, latest ({month_label(latest)})",
            )
        )
    return facts
