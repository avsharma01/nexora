"""Builds the labeled context block the LLM is allowed to use (SPEC §4).

    [COMPANY] ...
    [DATA COVERAGE] ...
    [HISTORICAL DATA] (source: kpis)
    [COMPUTED FACTS]                    F1, F2, ... (numbered here, in order)
    [FORECASTS — ESTIMATES, NOT ACTUALS] (none yet, Phase E)
    [DOCUMENT EXCERPTS]                 (none yet, Phase D)

Also turns facts into the response's `figures` and `sources` (SPEC §7).
"""

from dataclasses import dataclass, field
from datetime import date

from app.ai.facts import Fact, format_value, month_label
from app.ai.metrics_config import display_name, unit_of


MAX_ROWS_PER_METRIC = 24


@dataclass
class Context:
    text: str
    facts: dict[str, Fact] = field(default_factory=dict)  # "F1" -> Fact


def _row(metric: str, d: date, value: float) -> str:
    return f"  {metric} · {d.strftime('%Y-%m')} · {format_value(value, unit_of(metric))}"


def build_context(
    company_name: str,
    company_id: int,
    industry: str | None,
    metrics: list[str],
    coverage: tuple[date, date] | None,
    rows: dict[str, list[tuple[date, float]]],
    facts: list[Fact],
) -> Context:
    lines = [f"[COMPANY] {company_name} (id {company_id}) · industry: {industry or 'n/a'}"]

    if coverage:
        start, end = coverage
        lines.append(
            f"[DATA COVERAGE] metrics: {', '.join(display_name(m) for m in metrics)} · "
            f"{month_label((start.year, start.month))} to {month_label((end.year, end.month))} (monthly)"
        )

    lines.append("[HISTORICAL DATA] (source: kpis)")
    any_rows = False
    for metric, series in rows.items():
        for d, v in series[-MAX_ROWS_PER_METRIC:]:
            lines.append(_row(metric, d, v))
            any_rows = True
    if not any_rows:
        lines.append("  (none)")

    lines.append("[COMPUTED FACTS]")
    numbered: dict[str, Fact] = {}
    for i, fact in enumerate(facts, start=1):
        tag = f"F{i}"
        numbered[tag] = fact
        lines.append(f"  {tag}: {fact.text}")
        for note in fact.notes:
            lines.append(f"      note: {note}")
    if not facts:
        lines.append("  (none)")

    lines.append("[FORECASTS — ESTIMATES, NOT ACTUALS]")
    lines.append("  (none available)")
    lines.append("[DOCUMENT EXCERPTS]")
    lines.append("  (none available)")

    return Context(text="\n".join(lines), facts=numbered)


def figures_for(fact: Fact) -> list[dict]:
    """UI figures for one fact: the main value plus its % change when there is one."""
    kind = fact.kind
    data = fact.data
    figures = []

    if "faster" in data:  # cross-metric growth: one % figure per metric
        for metric, side in zip(data.get("metrics", []), ("a", "b")):
            pct = data[side].get("pct_change")
            if pct is not None:
                figures.append({
                    "label": f"{display_name(metric or side)} growth",
                    "value": round(pct, 1),
                    "unit": "%",
                    "period": fact.period,
                    "kind": kind,
                })
        return figures

    if fact.value is not None:
        figures.append({
            "label": fact.label or fact.id,
            "value": round(fact.value, 2),
            "unit": fact.unit,
            "period": fact.period,
            "kind": kind,
        })
    if data.get("pct_change") is not None:
        figures.append({
            "label": f"{fact.label or fact.id} (% change)",
            "value": round(data["pct_change"], 1),
            "unit": "%",
            "period": fact.period,
            "kind": kind,
        })
    return figures


def source_for(tag: str, fact: Fact) -> dict:
    return {"id": tag, "type": "kpi", "label": fact.label or fact.id}
