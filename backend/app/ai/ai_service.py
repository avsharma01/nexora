"""AI Business Analyst pipeline: ask(db, company_id, question, history) -> SPEC §7 dict.

    question -> guard -> intent -> facts (Python maths) -> context -> LLM
             -> clean + validate numbers (one strict retry) -> response

Refusals (out_of_scope / insufficient_data) that can be decided without the LLM
never call it. Raises CompanyNotFoundError (-> 404) and llm.LLMError (-> 503).
"""

import re
import time
from datetime import date, datetime, timezone

from sqlalchemy.orm import Session

from app.ai import data_access, guard, llm
from app.ai.context import Context, build_context, figures_for, source_for
from app.ai.facts import (
    Fact,
    Period,
    compare_periods,
    cross_metric_growth,
    extremes,
    latest_summary,
    month_label,
    months_back,
    previous_period,
    trend,
    value_at,
)
from app.ai.intent import Intent, detect_intent
from app.ai.metrics_config import display_name
from app.ai.prompts import (
    STRICT_RETRY_NOTE,
    insufficient_answer,
    out_of_scope_answer,
    system_prompt,
)
from app.ai.validate import clean_text, ungrounded_numbers


MAX_HISTORY_TURNS = 6
MAX_HISTORY_CHARS = 1000
DEFAULT_WINDOW_MONTHS = 12

_CITATION_RE = re.compile(r"\b([FD]\d+)\b")


class CompanyNotFoundError(LookupError):
    pass


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #

def _month(d: date) -> Period:
    return Period("month", d.year, d.month)


def _window(intent: Intent, latest: date, default: int | None) -> tuple[Period, Period] | None:
    if intent.window:
        return intent.window
    if intent.periods:
        first, last = intent.periods[0], intent.periods[-1]
        return Period("month", *first.months[0]), Period("month", *last.months[-1])
    if default is None:
        return None
    end = _month(latest)
    return months_back(end, default - 1), end


def _rows_between(series, start: Period | None, end: Period | None):
    lo = start.start if start else date.min
    hi = end.end if end else date.max
    return [(d, v) for d, v in series if lo <= d <= hi]


def _clean_history(history: list[dict] | None) -> list[dict]:
    turns = [
        {"role": t["role"], "content": str(t.get("content", ""))[:MAX_HISTORY_CHARS]}
        for t in (history or [])
        if isinstance(t, dict) and t.get("role") in ("user", "assistant") and t.get("content")
    ]
    return turns[-MAX_HISTORY_TURNS:]


# --------------------------------------------------------------------------- #
# Planning: which facts and rows does this intent need?
# --------------------------------------------------------------------------- #

def plan(
    db: Session,
    company_id: int,
    intent: Intent,
    latest: date,
    available: list[str],
) -> tuple[list[Fact], dict]:
    """(facts, historical rows per metric) for the detected intent."""
    if intent.intent == "summary":
        rows = {m: data_access.get_series(db, company_id, m)[-2:] for m in available}
        return latest_summary(db, company_id), rows

    metrics = intent.metrics
    series = {m: data_access.get_series(db, company_id, m) for m in available}
    facts: list[Fact | None] = []
    rows: dict = {}

    if intent.intent == "lookup":
        periods = intent.periods or ([_month(latest)] if not intent.window else [])
        for m in metrics:
            if intent.window and not intent.periods:
                facts.append(trend(series[m], *intent.window, metric=m))
                rows[m] = _rows_between(series[m], *intent.window)
                continue
            for p in periods:
                before = previous_period(p)
                facts.append(value_at(series[m], p, metric=m))
                # Context for the value: change vs the period before (month vs month, Q vs Q).
                facts.append(compare_periods(series[m], before, p, metric=m))
                rows.setdefault(m, []).extend(
                    _rows_between(series[m], Period("month", *before.months[0]), Period("month", *p.months[-1]))
                )

    elif intent.intent == "trend":
        window = _window(intent, latest, DEFAULT_WINDOW_MONTHS)
        for m in metrics:
            facts.append(trend(series[m], *window, metric=m))
            rows[m] = _rows_between(series[m], *window)

    elif intent.intent in ("compare", "why"):
        periods = sorted(intent.periods, key=lambda p: p.start)
        if len(periods) >= 2:
            a, b = periods[0], periods[-1]
        else:
            b = periods[0] if periods else _month(latest)
            a = previous_period(b)
        # "why" also looks at the other metrics over the same two periods.
        targets = metrics if intent.intent == "compare" else metrics + [m for m in available if m not in metrics]
        for m in targets:
            facts.append(compare_periods(series[m], a, b, metric=m))
            rows[m] = _rows_between(series[m], Period("month", *a.months[0]), Period("month", *b.months[-1]))

    elif intent.intent == "extremes":
        window = _window(intent, latest, None) or (None, None)
        for m in metrics:
            facts.extend(extremes(series[m], metric=m, start=window[0], end=window[1]))
            rows[m] = _rows_between(series[m], *window)

    elif intent.intent == "cross_metric":
        window = _window(intent, latest, DEFAULT_WINDOW_MONTHS)
        a, b = metrics[0], metrics[1]
        facts.append(cross_metric_growth(series[a], series[b], *window, metric_a=a, metric_b=b))
        for m in (a, b):
            facts.append(trend(series[m], *window, metric=m))
            rows[m] = _rows_between(series[m], *window)

    return [f for f in facts if f is not None], rows


# --------------------------------------------------------------------------- #
# Main entry point
# --------------------------------------------------------------------------- #

def _response(status, answer, *, is_grounded=True, figures=None, sources=None, meta=None) -> dict:
    return {
        "insight_id": None,  # set when logged to ai_insights (Phase C)
        "status": status,
        "answer": answer,
        "is_grounded": is_grounded,
        "figures": figures or [],
        "sources": sources or [],
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
        "meta": meta or {},
    }


def _status_of(answer: str) -> str:
    if answer.startswith("I don't have that information"):
        return "insufficient_data"
    if answer.startswith("I can only answer questions about"):
        return "out_of_scope"
    return "answered"


def ask(
    db: Session,
    company_id: int,
    question: str,
    history: list[dict] | None = None,
    *,
    use_guard_model: bool = True,
) -> dict:
    started = time.perf_counter()
    company = data_access.get_company(db, company_id)
    if company is None:
        raise CompanyNotFoundError(f"Company {company_id} not found")

    question = question.strip()
    history = _clean_history(history)
    available = data_access.available_metrics(db, company_id)
    first, latest = data_access.earliest_date(db, company_id), data_access.latest_date(db, company_id)

    if available:
        available_text = (
            f"{', '.join(display_name(m) for m in available)} "
            f"({month_label((first.year, first.month))} to {month_label((latest.year, latest.month))})"
        )
        lead = "revenue" if "revenue" in available else available[0]
        example = f"{display_name(lead).lower()} in {month_label((latest.year, latest.month))}"
    else:
        available_text = "no KPI data has been added yet"
        example = "its KPIs once data has been added"

    meta = {"company": company.name}

    def done(status, answer, **kwargs):
        meta["latency_ms"] = round((time.perf_counter() - started) * 1000)
        return _response(status, answer, meta=meta, **kwargs)

    def refuse_scope():
        return done("out_of_scope", out_of_scope_answer(company.name, example))

    def refuse_data():
        return done("insufficient_data", insufficient_answer(company.name, available_text))

    # 1. Guard (before any data reaches the LLM)
    verdict = guard.check(
        question, company_id, data_access.list_companies(db), history, use_model=use_guard_model
    )
    meta["guard"] = {"reason": verdict.reason, "detail": verdict.detail, "injection_score": verdict.injection_score}
    if not verdict.allowed:
        return refuse_scope()

    # 2. Intent
    intent = detect_intent(question, latest, history)
    meta["intent"] = {"code": intent.code, "name": intent.intent, "metrics": intent.metrics,
                      "periods": [p.key for p in intent.periods],
                      "window": [p.key for p in intent.window] if intent.window else None}
    if intent.intent == "off_topic":
        return refuse_scope()
    if intent.intent in ("unknown_metric", "forecast") or not available:
        # forecast: no forecast data in the context until Phase E
        return refuse_data()
    if intent.intent != "summary":
        intent.metrics = [m for m in intent.metrics if m in available]
        if not intent.metrics or (intent.intent == "cross_metric" and len(intent.metrics) < 2):
            return refuse_data()

    # 3. Facts (all maths in Python)
    facts, rows = plan(db, company_id, intent, latest, available)
    if not facts:
        return refuse_data()

    # 4. Context + LLM
    context: Context = build_context(
        company.name, company.id, company.industry, available, (first, latest), rows, facts
    )
    messages = [
        {"role": "system", "content": system_prompt(company.name, available_text, example)},
        *history,
        {"role": "user", "content": f"CONTEXT:\n{context.text}\n\nQUESTION: {question}"},
    ]
    reply = llm.chat(messages)
    answer = clean_text(reply.text)
    bad = ungrounded_numbers(answer, context.text, question)
    meta.update(model=reply.model, retried=False)

    # 5. Validate: one strict retry, then give up with insufficient_data
    if bad:
        meta.update(retried=True, first_unmatched=bad)
        retry = messages + [
            {"role": "assistant", "content": reply.text},
            {"role": "user", "content": STRICT_RETRY_NOTE.format(numbers=", ".join(bad))},
        ]
        reply = llm.chat(retry)
        answer = clean_text(reply.text)
        bad = ungrounded_numbers(answer, context.text, question)
        meta["model"] = reply.model
    if bad:
        meta["unmatched"] = bad
        return done(
            "insufficient_data",
            insufficient_answer(company.name, available_text),
            is_grounded=False,
        )

    status = _status_of(answer)
    if status != "answered":
        return done(status, answer)

    cited = [tag for tag in dict.fromkeys(_CITATION_RE.findall(answer)) if tag in context.facts]
    used = cited or list(context.facts)
    meta["context"] = context.text
    return done(
        "answered",
        answer,
        figures=[fig for tag in used for fig in figures_for(context.facts[tag])],
        sources=[source_for(tag, context.facts[tag]) for tag in used],
    )
