# AI Analyst — Claude Code prompts, step by step

Save as `docs/ai-analyst/PROMPTS.md`. Paste ONE prompt per step into Claude Code, run what it tells you,
check the "Done when", commit, then move on. Each step is a fresh conversation (your context loads
automatically from CLAUDE.local.md → CONTEXT.md + SPEC.md).

---

## Every session — start
```
Continue the roadmap in docs/ai-analyst/CONTEXT.md §10. Tell me which step is next, what it builds,
and why, in simple words. Teach mode: explain before writing code, write small pieces, and let me run
each command myself.
```

## Every session — end
```
Update docs/ai-analyst/CONTEXT.md: tick finished Progress items, add any new Decisions or Open
questions. Then show me git status and git diff, and suggest a commit message. Don't commit.
```
Then: `git add <files>` → `git commit -m "..."` → `git push`

---

## Step 0 — Sync with develop
```
Merge develop into my branch (feature/ai-analyst-core). If there are conflicts, explain each one
simply and propose the fix before applying. Then confirm the backend still starts (uvicorn) and
record in CONTEXT.md: analytics PR #10 is reusable for intent I2 (with the comparison_available and
duplicate-date checks), and the placeholder AI endpoint needs a contract agreement with Vaibhav.
```
**Done when:** `git status` is clean and http://localhost:8000/docs works.

---

## Step B1 — Fake test data
```
Teach mode. Create backend/scripts/seed_ai_test_data.py that inserts FAKE data through the team's
existing SQLAlchemy models (Company, KPI) and app.database — the same tables real data uses.
- 3 companies, description "AI test data (fake)":
  1. "Test Retail Pvt Ltd" (Retail): revenue dips sharply in March 2025, then recovers
  2. "Test SaaS Labs" (Software): steady monthly growth; profit goes from negative to positive in mid-2024
  3. "Test Foods Co" (FMCG): revenue grows but expenses grow faster, so profit shrinks
- 24 months each (Jan 2024–Dec 2025, month-end dates); metrics revenue, expenses, profit
  (profit = revenue − expenses exactly); realistic INR values
- Idempotent (skip existing fake companies); --reset deletes ONLY these fake companies + their KPIs
Tell me how to run it from backend/ and how to check it in Swagger and via
GET /companies/{id}/analytics.
```
**Done when:** 3 companies × 72 KPI rows are visible, and the analytics endpoint shows dates.

---

## Step B2 — Metrics config + data access ("the socket")
```
Teach mode. Following SPEC §3–4, create:
1. backend/app/ai/__init__.py and backend/app/ai/metrics_config.py — the ONE place for metric names,
   units (INR), display names and synonyms ("sales"→revenue, "costs"/"spend"→expenses,
   "earnings"/"net"→profit).
2. backend/app/ai/data_access.py — read-only, always filtered by company_id:
   available_metrics(db, company_id), get_series(db, company_id, metric, start=None, end=None)
   → sorted [(date, value)], plus get_company(db, company_id).
   It must not know or care whether data is fake or real.
3. pytest tests in tests/ai/ using the fake companies. Tell me how to install pytest and run them.
```
**Done when:** the tests pass.

---

## Step B3 — Facts (all the maths, in Python)
```
Teach mode. Create backend/app/ai/facts.py with PURE functions over [(date, value)] lists.
Each returns Fact objects {id, text, value, unit, period, kind="historical"}:
- pct_change(prev, curr) using abs(prev) as denominator (same formula as analytics PR #10); None if prev == 0
- value_at(series, period)
- latest_summary(db, company_id): REUSE analytics_service.get_company_analytics; if
  comparison_available is false → latest only; if latest_date == previous_date → no change, add a
  data-quality note
- trend(series, start, end): start/end values, abs + % change, direction, number of points, gaps
- compare_periods(series, period_a, period_b): months, quarters (sum) or years (sum)
- extremes(series): highest and lowest with dates
- cross_metric_growth(series_a, series_b, start, end)
Round only when formatting text (1 decimal for %, Indian digit grouping for INR).
Unit tests: negative→positive, missing month, duplicate dates, a single row, quarter sums.
```
**Done when:** all tests pass, and you can explain what each function does.

---

## Step B4 — First LLM call
```
Teach mode. I'm using [Groq / xAI Grok]. Create backend/app/ai/llm.py: a small wrapper on the
openai Python package using the provider's OpenAI-compatible base_url. Read AI_API_KEY, AI_MODEL,
AI_BASE_URL from .env (never hardcode the key). Defaults: temperature 0.2, max_tokens 400, timeout 30s,
with a clear error if the key is missing. Look up the correct base_url and a current model name in the
provider's docs; don't guess. Add backend/scripts/llm_hello.py that prints a one-sentence reply.
Tell me exactly what to add to .env.
```
**Done when:** the hello script prints a reply from the model.

---

## Step B5 — Understand the question (intent)
```
Teach mode. Create backend/app/ai/intent.py, rule-based (no LLM): from a question, detect
- the intent (SPEC §2: I1 lookup, I2 summary, I3 trend, I4 compare, I5 why, I6 extremes,
  I7 cross-metric, I11 unknown metric, I12 off-topic)
- the metric(s) via metrics_config synonyms
- the period(s): "March 2025", "Mar 2025", "Q1 2025", "2024", "last 6 months", "this year"
  (relative to the latest date in the data, NOT today's date)
Return a dataclass. Add tests with ~25 example questions.
```
**Done when:** the tests pass on all the example questions.

---

## Step B6 — Context + prompt = first grounded answer (mini-RAG)
```
Teach mode. Create:
- backend/app/ai/context.py: given intent + facts, build the labeled context block from SPEC §4
  ([COMPANY], [HISTORICAL DATA], [COMPUTED FACTS] with ids F1, F2…, [FORECASTS — ESTIMATES] empty for now)
- backend/app/ai/prompts.py: the fixed system prompt (SPEC §5 rules 1–8) and the two refusal templates
- backend/app/ai/ai_service.py: ask(db, company_id, question, history=None) → dict in the SPEC §7 shape
  (status, answer, is_grounded, figures, sources)
- backend/scripts/ask.py: python -m scripts.ask --company 1 "Why did revenue drop in March 2025?"
Explain the flow: question → intent → facts → context → LLM → answer.
```
**Done when:** the answer uses only your facts, states the period, and cites F-ids.

---

## Step B7 — Safety: guard + validator
```
Teach mode. Create:
- backend/app/ai/guard.py: runs BEFORE the LLM. Flags off-topic (no business/metric words),
  prompt injection ("ignore previous", "system prompt", "you are now"), requests about another
  company (by name or id), and investment/legal advice → returns out_of_scope with the template.
- backend/app/ai/validate.py: extract every number in the LLM answer and check it against the
  context numbers (allow formatting differences: 1,050,000 / 10.5 lakh / 15.3%). If any is unmatched →
  regenerate once with a stricter note; still bad → insufficient_data, is_grounded=false.
Wire both into ai_service.ask and add tests.
```
**Done when:** "Who won the IPL?" is refused, and a fake invented number gets caught.

---

## Step B8 — Evaluation runner
```
Teach mode. Create evals/ai_analyst_eval.jsonl from SPEC §8 (E1–E19, adapted to the fake companies,
each with expected status and the key numbers that must appear), and backend/scripts/run_evals.py
that runs them through ai_service.ask and prints a pass/fail table + overall % + safety %.
Save each run's results to evals/results/<timestamp>.json (gitignored).
```
**Done when:** ≥ 90% overall and 100% on the safety rows. **→ Open PR: feature/ai-analyst-core → develop.**

---

## Step C1 — Real endpoint (after agreeing the contract with Vaibhav)
```
Teach mode. Vaibhav agreed the contract: [paste what he said]. Implement the AI endpoint:
- schemas/ai.py (request/response exactly as agreed), models/ai_insight.py (SPEC §7 fields + user_id)
- implement the existing placeholder router (or api/routers/ai.py if agreed) calling ai_service.ask
- use the team's get_current_user / require_role; 404 if the company doesn't exist; 503 if the LLM is down
- log every call to ai_insights with latency_ms
Show me every change to a file I don't own, so I can flag it in the PR.
```
**Done when:** you can log in on Swagger, ask a question, and see a row in `ai_insights`.

---

## Step D1 — Fake company documents
```
Teach mode. For each fake company, write 4 markdown documents in data/mock_docs/<slug>/ —
board_memo.md, annual_narrative.md, risk_commentary.md, forecast_assumptions.md — with ## section
headers. Every number in them must come from the DB (generate them with a script that reads the
fake KPIs, so they can be regenerated from real data later). Include reasons for changes
(e.g. store closures in March 2025) that the KPIs alone can't explain.
```
**Done when:** the docs read realistically and their numbers match Swagger.

---

## Step D2 — Document RAG (chunk → embed → pgvector → retrieve)
```
Teach mode. Explain embeddings simply first. Then:
- models for ai_documents and ai_document_chunks (embedding Vector(384), company_id, section_header)
- backend/app/ai/chunking.py: split by ## headers, then 300–500 tokens with ~50 overlap, header kept
- backend/app/ai/embeddings.py: sentence-transformers BAAI/bge-small-en-v1.5 (384-dim), loaded once
- backend/scripts/ingest_docs.py: docs folder → chunks → embeddings → DB (re-runnable)
- backend/app/ai/retrieval.py: embed question → cosine search filtered by company_id → top 5 above
  a similarity threshold
- add [DOCUMENT EXCERPTS] D1, D2… to the context; cite them in sources
Add evals for document questions.
```
**Done when:** "What risks did the board mention?" answers from the docs with D-citations, and the evals still pass.

---

## Switching fake → real data (when the team's seed arrives)
```
Real seed data is ready: [paste metric names/units]. Run seed_ai_test_data.py --reset, then the
team's seed. Update metrics_config.py only. Adapt evals to the real companies, rerun them, and
report anything that broke.
```
