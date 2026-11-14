"""CSV import of monthly KPI data.

Format: one row per MONTH, a period column first, then one column per metric.

    period,revenue,expenses,profit,customers
    2025-01,520000,370000,150000,1200
    2025-02,531000,372500,,1240

* period: 2025-01, 2025-01-01, 2025/01 or 01/2025. Quarters ("2025-Q1") and years ("2025")
  are rejected: charts, forecasts and the AI analyst build quarters and years by adding up
  months, so a quarterly total stored as one row would be read as a single month.
* Metric columns: any name. Headers are normalised to lower_snake_case ("Cash Flow" ->
  "cash_flow"), so "Revenue" and "revenue" are the same metric.
* Values: "1,234.50", "$1200", "₹ 5,00,000" and "(1200)" (negative) are accepted.
  An empty cell means "no value for that month".
* profit: when a month has revenue and expenses but no profit, profit = revenue - expenses.

Importing into a company that already has data replaces the value for the same metric and
month (it never adds a second row for a month), and leaves every other month untouched.
"""

import csv
import io
import math
import re
from dataclasses import dataclass, field
from datetime import date

from sqlalchemy.orm import Session

from app.models.kpi import KPI

MAX_CHARS = 1_000_000
MAX_ROWS = 600  # 50 years of months
MAX_METRICS = 20
MAX_ERRORS = 8
VALUE_LIMIT = 1e15  # well inside the kpis Numeric(18, 2) column and its check constraint

PERIOD_HEADERS = {"period", "month", "date", "metric_date"}

_MONTH_RES = [
    re.compile(r"^(?P<y>\d{4})-(?P<m>\d{1,2})(?:-\d{1,2})?$"),  # 2025-01, 2025-01-01
    re.compile(r"^(?P<y>\d{4})/(?P<m>\d{1,2})(?:/\d{1,2})?$"),  # 2025/01
    re.compile(r"^(?P<m>\d{1,2})[/-](?P<y>\d{4})$"),  # 01/2025, 01-2025
]
_QUARTER_RE = re.compile(r"^(\d{4}\s*[-/ ]?\s*q[1-4]|q[1-4]\s*[-/ ]?\s*\d{4})$", re.IGNORECASE)
_YEAR_RE = re.compile(r"^(fy\s*)?\d{4}$", re.IGNORECASE)


class CsvImportError(ValueError):
    def __init__(self, errors: list[str]):
        super().__init__("\n".join(errors))
        self.errors = errors


@dataclass
class ParsedCsv:
    metrics: list[str]
    rows: dict[date, dict[str, float]] = field(default_factory=dict)
    profit_computed: int = 0

    @property
    def months(self) -> list[date]:
        return sorted(self.rows)


def normalize_metric(header: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", header.strip().lower()).strip("_")


def _parse_period(raw: str) -> date | str:
    """A month's first day, or an error message."""
    text = raw.strip()
    if _QUARTER_RE.match(text):
        return f"'{text}' is a quarter. Use one row per month (for example 2025-01, 2025-02, 2025-03)."
    if _YEAR_RE.match(text):
        return f"'{text}' is a whole year. Use one row per month (for example 2025-01 ... 2025-12)."
    for pattern in _MONTH_RES:
        match = pattern.match(text)
        if match:
            year, month = int(match["y"]), int(match["m"])
            if 1 <= month <= 12 and 1900 <= year <= 2100:
                return date(year, month, 1)
            break
    return f"'{text}' is not a month. Use YYYY-MM, for example 2025-01."


def _parse_value(raw: str) -> float | None | str:
    """A number, None for an empty cell, or an error message."""
    text = raw.strip()
    if not text or text in {"-", "—"}:
        return None
    negative = text.startswith("(") and text.endswith(")")
    cleaned = re.sub(r"[\s,$₹€£]|INR|USD|EUR|GBP", "", text.strip("()"), flags=re.IGNORECASE)
    try:
        value = float(cleaned)
    except ValueError:
        return f"'{text}' is not a number"
    if not math.isfinite(value) or abs(value) >= VALUE_LIMIT:
        return f"'{text}' is too large"
    return -value if negative else value


def _unwrap_rows(rows, delimiter: str):
    """Spreadsheet apps sometimes save each whole row as ONE quoted cell:
    "period,revenue,expenses" (this happens when the CSV was opened with everything in column A,
    for example when Excel's list separator is not a comma, and then saved again). A row that
    arrives as a single cell containing the delimiter is split again."""
    for row in rows:
        if len(row) == 1 and delimiter in row[0]:
            yield next(csv.reader([row[0]], delimiter=delimiter))
        else:
            yield row


def parse_kpi_csv(text: str) -> ParsedCsv:
    text = text.lstrip("﻿")
    if not text.strip():
        raise CsvImportError(["The file is empty."])
    if len(text) > MAX_CHARS:
        raise CsvImportError(["The file is too large (limit 1 MB)."])

    first_line = text.splitlines()[0]
    delimiter = ";" if first_line.count(";") > first_line.count(",") else ","
    reader = _unwrap_rows(csv.reader(io.StringIO(text), delimiter=delimiter), delimiter)
    header = next(reader, None) or []
    columns = [normalize_metric(h) for h in header]

    errors: list[str] = []
    if not columns or columns[0] not in PERIOD_HEADERS:
        raise CsvImportError([
            "The first column must be 'period' (one month per row, like 2025-01). "
            "Download the template to see the format."
        ])
    metrics = columns[1:]
    if not metrics:
        raise CsvImportError(["Add at least one metric column after 'period', such as revenue."])
    if len(metrics) > MAX_METRICS:
        raise CsvImportError([f"Too many metric columns ({len(metrics)}); the limit is {MAX_METRICS}."])
    for index, name in enumerate(metrics, start=2):
        if not name:
            errors.append(f"Column {index} has no name.")
        elif len(name) > 100:
            errors.append(f"Column {index}: the name is longer than 100 characters.")
        elif name in PERIOD_HEADERS:
            errors.append(f"Column {index}: '{header[index - 1].strip()}' can't be a metric name.")
    duplicates = sorted({m for m in metrics if m and metrics.count(m) > 1})
    if duplicates:
        errors.append(f"These columns appear twice: {', '.join(duplicates)}.")
    if errors:
        raise CsvImportError(errors)

    parsed = ParsedCsv(metrics=metrics)
    seen_rows: dict[date, int] = {}
    for line_no, cells in enumerate(reader, start=2):
        if len(errors) >= MAX_ERRORS:
            errors.append("... more problems not shown. Fix these first.")
            break
        if not any(c.strip() for c in cells):
            continue  # blank line
        if len(seen_rows) >= MAX_ROWS:
            errors.append(f"Too many rows; the limit is {MAX_ROWS} months.")
            break
        if len(cells) > len(columns):
            errors.append(f"Row {line_no}: has {len(cells)} cells but the header has {len(columns)} columns.")
            continue

        period = _parse_period(cells[0])
        if isinstance(period, str):
            errors.append(f"Row {line_no}: {period}")
            continue
        if period in seen_rows:
            errors.append(
                f"Row {line_no}: {period:%Y-%m} already appears on row {seen_rows[period]}. "
                "Each month can only appear once."
            )
            continue
        seen_rows[period] = line_no

        values: dict[str, float] = {}
        for metric, raw in zip(metrics, cells[1:]):
            value = _parse_value(raw)
            if isinstance(value, str):
                errors.append(f"Row {line_no}, {metric}: {value}.")
            elif value is not None:
                values[metric] = value
        if "profit" not in values and "revenue" in values and "expenses" in values:
            values["profit"] = round(values["revenue"] - values["expenses"], 2)
            parsed.profit_computed += 1
        if values:
            parsed.rows[period] = values

    if not errors and not parsed.rows:
        errors.append("No values found. Add at least one month with a number in it.")
    if errors:
        raise CsvImportError(errors)
    if parsed.profit_computed and "profit" not in parsed.metrics:
        parsed.metrics.append("profit")
    return parsed


@dataclass
class ImportCounts:
    created: int = 0
    updated: int = 0


def apply_import(db: Session, company_id: int, parsed: ParsedCsv) -> ImportCounts:
    """Write the parsed months into kpis. Does NOT commit: the caller commits or rolls back."""
    existing: dict[tuple[str, int, int], list[KPI]] = {}
    for kpi in db.query(KPI).filter(KPI.company_id == company_id).order_by(KPI.id):
        key = (normalize_metric(kpi.metric_name), kpi.metric_date.year, kpi.metric_date.month)
        existing.setdefault(key, []).append(kpi)

    counts = ImportCounts()
    for month, values in parsed.rows.items():
        for metric, value in values.items():
            matches = existing.get((metric, month.year, month.month))
            if matches:
                keep, *extra = matches
                keep.metric_name = metric
                keep.metric_value = value
                keep.metric_date = month
                for duplicate in extra:  # older duplicate rows for the same month
                    db.delete(duplicate)
                counts.updated += 1
            else:
                db.add(KPI(company_id=company_id, metric_name=metric, metric_value=value, metric_date=month))
                counts.created += 1
    return counts


TEMPLATE = (
    "period,revenue,expenses,profit\n"
    "2025-01,520000,370000,150000\n"
    "2025-02,531000,372500,158500\n"
    "2025-03,540250,378000,\n"
)
