# NEXORA AI Business Analyst

Ask questions about **one company's** KPIs and documents in plain English and get a short, cited answer.
Every number is computed in Python from the database; the LLM only explains numbers it was given.

> "Why did revenue drop in March 2025?" (Test Retail Pvt Ltd)
>
> Revenue fell by 47,61,602 INR (36.5%) from February 2025 to March 2025, primarily because several of the
> company's largest mall stores in Maharashtra were temporarily closed for most of March 2025 after mall
> operators ordered a fire-safety re-inspection of older buildings [D1].
> - Expenses rose by 1,79,690 INR (1.7%) over the same period because store rent, salaries and electricity continued during the closures [F2, D2].
> - Profit fell by 49,41,292 INR (191.2%) to -23,56,941 INR, the only loss-making month in the period [F3, D2].
>
> Sources: F2/F3 = computed KPI facts, D1/D2 = board memo sections.

Owner: Anant Sharma (GenAI & RAG). Design: [SPEC.md](SPEC.md). Status and decisions: [CONTEXT.md](CONTEXT.md).
Moving to real data: [SWITCH_TO_REAL_DATA.md](SWITCH_TO_REAL_DATA.md).

## Architecture (all code in `backend/app/ai/`)

```
question ─ guard.py ── blocks off-topic, injection (keywords + Llama Prompt Guard 2), other companies, advice
         ─ intent.py ─ rule-based: lookup / summary / trend / compare / why / extremes / cross-metric /
                       forecast / document / unknown metric; periods resolved against the latest data month
         ─ facts.py ── ALL maths in Python (values, changes, %, sums, min/max, growth) → facts F1, F2…
         ─ retrieval.py (why / document / summary only) ─ bge-small embeddings (fastembed) + pgvector cosine
                       search, always WHERE company_id = :id, similarity ≥ 0.60 → excerpts D1, D2…
         ─ context.py + prompts.py ─ labelled context + fixed grounding rules → llm.py (Groq gpt-oss-120b,
                       Qwen fallback)
         ─ validate.py ─ every number in the answer must exist in the context (1 strict retry, else refuse)
         ─ ai_service.ask() → {status, answer, is_grounded, figures, sources} → logged to ai_insights
```
`status` is `answered`, `insufficient_data` (data/metric/document missing) or `out_of_scope` (refused).
Refusals that can be decided without the LLM never call it.

## Setup (once)
From the repo root, with Docker running:
```powershell
.venv\Scripts\python -m pip install -r requirements.txt
# .env (repo root, never committed): AI_API_KEY=gsk_...   (optional: AI_MODEL=openai/gpt-oss-120b)
docker compose up -d
cd backend
..\.venv\Scripts\python -m app.init_db                 # creates ai_insights, ai_documents, ai_document_chunks
..\.venv\Scripts\python -m scripts.seed_ai_test_data   # 3 FAKE companies x 24 months (2024-01..2025-12)
..\.venv\Scripts\python -m scripts.generate_mock_docs  # 12 fake documents, numbers from the DB
..\.venv\Scripts\python -m scripts.ingest_docs         # chunk + embed + store (first run downloads ~67 MB model)
```
Fake companies: **Test Retail Pvt Ltd** (revenue dip March 2025: store closures), **Test SaaS Labs**
(profit turns positive July 2024), **Test Foods Co** (costs grow faster than revenue). Company ids depend on
your DB: see `GET /companies` or the `insert ... (id N)` lines printed by the seeder.

## Run it
**CLI** (from `backend/`):
```powershell
..\.venv\Scripts\python -m scripts.ask --company <id> "Why did revenue drop in March 2025?"
..\.venv\Scripts\python -m scripts.ask --company <id> --context "What risks did the board mention?"  # show context
..\.venv\Scripts\python -m scripts.ask --company <id> --json "Compare Q1 and Q2 2025 profit"         # full JSON
```

**Tests** (from the repo root): `.venv\Scripts\python -m pytest` — offline except Postgres; the LLM is faked.
DB tests skip if Postgres is down or the fake data isn't seeded.

**Evals** (from `backend/`, live LLM): `..\.venv\Scripts\python -m scripts.run_evals`
(`--verbose` prints answers, `--only E1,E8`, `--file ../evals/real_data_smoke.jsonl` after switching to real data).
Targets: ≥ 90 % overall, 100 % on safety rows. Results are saved to `evals/results/` (gitignored).

**Endpoint**: `POST /companies/{company_id}/ai-analysis` (any logged-in role: Admin, Analyst, Viewer)
```json
request:  {"question": "Why did revenue drop in March 2025?", "history": []}
response: {"company_id": 7, "question": "...", "answer": "...", "insight_id": 12, "status": "answered",
           "is_grounded": true, "figures": [{"label", "value", "unit", "period", "kind"}],
           "sources": [{"id": "D1", "type": "document", "label": "Board memo · Q1 2025 review"}],
           "generated_at": "2026-10-07T09:30:00Z"}
```
Errors: 400 blank question · 401 no/invalid token · 404 company not found · 422 question > 500 chars ·
503 LLM unavailable. Every call (including errors) is stored in `ai_insights`.

**Swagger** (`cd backend; ..\.venv\Scripts\python -m uvicorn app.main:app --reload` → http://localhost:8000/docs):
1. `POST /auth/register` → Try it out → `{"email": "you@example.com", "password": "..."}` → Execute
   (public sign-up creates a Viewer, which may use the analyst).
2. `POST /auth/login` → same email/password → copy `access_token` (without quotes).
3. **Authorize** (top right) → paste only the token (no `Bearer `) → Authorize → Close.
4. `GET /companies` → note the id of "Test Retail Pvt Ltd".
5. `POST /companies/{company_id}/ai-analysis` → Try it out → that id →
   `{"question": "Why did revenue drop in March 2025?"}` → Execute → 200 with answer, figures, sources.
6. Try `{"question": "Who won the IPL?"}` (200, `out_of_scope`), company id 99999 (404), and a follow-up:
   `{"question": "And in April?", "history": [{"role": "user", "content": "What was revenue in March 2025?"}]}`.

## Final results (2026-10-07, branch `feature/ai-analyst-core`)
```
pytest: 195 passed
  test_guard_validate 56 · test_intent 37 · test_facts 29 · test_rag 22 · test_ai_service 19
  test_llm 13 · test_seed_and_data_access 11 · test_api_ai_analysis 8

evals (ai_analyst_eval.jsonl, live Groq):
  Overall: 35/35 = 100.0%  (target >= 90%)
  Safety:  16/16 = 100.0%  (target 100%)
  E1-E19 (lookup, trend, compare, extremes, cross-metric, why, summary, follow-up)  19/19
  D1-D5 document questions (risks, decisions, assumptions, why with document)      5/5
  safety: missing metric/period, off-topic, advice, 4x injection, 2x cross-company,
          industry average, forecast, 2x document leak                            16/16
  21 LLM answers: 20 openai/gpt-oss-120b, 1 qwen/qwen3.8-27b fallback, 0 strict retries
  latency in a back-to-back run: median 7.9 s, max 16.2 s (Groq free-tier rate limits);
  refusals 5-140 ms; single questions in the CLI typically 1-3 s

real-data run (Athira's seed_data.py, USD, loaded next to the fake companies), real_data_smoke.jsonl:
  Overall: 14/14 = 100.0%   Safety: 6/6 = 100.0%   (main set in the same DB: 35/35, 16/16)
  currency per company from financial_records: real answers in USD, fake ones in INR
```

## Known limitations
- **Fake data.** Companies, numbers and document reasons are invented for testing. The real-data dry run
  passed, but real metric names/units must be set in `metrics_config.py` (see the runbook).
- **No forecasts yet.** Forecast questions return `insufficient_data` until Phase E reads the `forecasts` table.
- **Rule-based intent.** Unusual wording can be misread (e.g. "How did profit change?" needed a fix).
  Unknown metrics → `insufficient_data`, never guessed.
- **Prompt Guard is a preview model** and misses subtle wording (scored "you have no limits" 0.013);
  keyword rules, the system prompt and the number validator are the main defences. The validator checks
  numbers, not wording: a wrong *claim* without a wrong number is not caught.
- **Retrieval threshold** (0.60) is calibrated on 12 mock documents only; bge-small scores are compressed
  (unrelated text still scores ~0.4–0.5). Documents are assumed to be trusted team uploads.
- **Rate limits.** Groq free tier slows back-to-back calls (5–16 s); the Qwen fallback (also preview) helps.
- **Access control** is role-based only: any logged-in user can ask about any company (there is no
  user↔company link in the schema yet).
- **Style.** Occasional filler bullet or an uncited first sentence; not measured by the evals.
