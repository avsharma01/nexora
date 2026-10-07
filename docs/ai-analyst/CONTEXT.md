# NEXORA — AI Business Analyst (GenAI & RAG) · Context & Progress

> Living file. Claude Code loads it automatically via `CLAUDE.local.md`.
> For any other AI chat, attach this file + `SPEC.md` and say "continue from the current phase".
> Update **Progress**, **Decisions** and **Open questions** at the end of every work session.

## 1. Project in one paragraph
NEXORA is an AI Company Intelligence Platform ("Understand your business. Predict what comes next.")
built by a 5-person college team. The stack is Next.js/React/TypeScript frontend → FastAPI backend →
PostgreSQL + SQLAlchemy, plus an Analytics/ML layer and an AI/RAG layer. The frontend talks only to
FastAPI over HTTP/JSON and never touches the database. ML and AI are exposed only through
backend-controlled endpoints.

## 2. Team & who I depend on
| Member | Role | What I need from them |
|---|---|---|
| **Anant Sharma (me)** | GenAI & RAG Lead | Owns the AI Business Analyst: retrieval, prompting, grounding, AI evaluation |
| Anant Vaibhav | Team Lead & System Architect | API conventions, final AI API contract, auth/RBAC dependency, schema + Docker changes (pgvector), LLM key/secrets policy |
| Athira Ravi Pillai | Data Eng & ML Lead | Seed data (metric names, units, history), forecast + anomaly output shape |
| Piyush Yadav | Full-Stack / Frontend | Builds the AI Analyst chat UI against my response contract (mock JSON first) |
| Arth Saxena | QA, Product & Docs | Turns my eval checklist into test cases; regression checks |

## 3. What already exists in the repo (per team guide v1.0)
- Branches: `main` = stable, `develop` = integration, work on `feature/*` → PR → `develop`. Never push directly to main/develop.
- FastAPI + PostgreSQL + SQLAlchemy configured.
- **Company** CRUD: id, name, industry, description, timestamps.
- **KPI** CRUD: company_id, metric_name, metric_value, metric_date (long format, one row per metric per date).
- Auth: register/login, Argon2, JWT, roles Admin / Analyst / Viewer, reusable `require_role` dependency.
- NOT yet there: analytics, forecasting (Athira, in progress), anomalies, Docker integration (later stage).
- Verified in code (2026-10-06): `require_role` exists but is NOT applied to company/kpi routes (they're open). No CORS middleware.
  Docker = only `postgres:18` (no pgvector) on host port 5433; `.env.example` POSTGRES_HOST=postgres only works inside Docker → locally use localhost:5433.

## 4. Architecture of my module (target)
```
question ─► guard (off-topic / injection gate) ─► intent + metric + period detection
        ─► fetch KPI history from Postgres (filtered by company_id)        ┐
        ─► compute facts in Python (changes, % change, min/max, trend)    ├─► labeled context block
        ─► fetch forecast rows (when Athira's module exists)              │   HISTORICAL DATA
        ─► vector search over company docs (pgvector, company_id filter)  ┘   COMPUTED FACTS
                                                                              FORECASTS (estimates)
                                                                              DOCUMENT EXCERPTS
        ─► LLM with fixed grounding system prompt (temp 0.2–0.3)
        ─► validate (numbers in answer ⊆ numbers in context) ─► response JSON ─► log to ai_insights
```
Key principle: **the LLM never does arithmetic.** Python computes every number; the LLM only explains them.

## 5. Phases
| Phase | What | Needs others? |
|---|---|---|
| **A. Design** (start here) | `SPEC.md`: question catalog, question→data mapping, grounding rules, number format, response contract, eval checklist | Reviews only |
| B. Local prototype | `backend/app/ai/` pipeline on KPI data only (no vector DB yet), runnable from a script, passes eval set | Seed data from Athira, LLM key decision |
| C. Endpoint | `POST /api/ai/ask` with JWT + RBAC, logging to `ai_insights` | Vaibhav: contract, conventions, migration |
| D. RAG docs | Mock company documents → chunk → embed → pgvector → retrieval | Vaibhav: pgvector image + schema approval |
| E. Forecast/anomaly context | Add forecast rows labeled as estimates | Athira: forecast interface |
| F. UI integration + QA | Piyush wires chat UI; Arth runs eval/acceptance | Piyush, Arth |

## 6. Real repo layout (develop @ 88d038f) and where my code goes
The team backend uses layers: **routers → services → models**, with Pydantic **schemas** alongside.
```
repo/
  .env.example, .gitignore, docker-compose.yml
  ai/  ml/  database/  docs/  frontend/  tests/     (top-level placeholders)
  backend/app/
    main.py, config.py, database.py, init_db.py (create_all, no Alembic, run by hand)
    api/routers/   auth.py, company.py, kpi.py      → I add: ai.py        (POST /ai/ask)
    core/          dependencies.py, roles.py, security.py   (auth + require_role, reuse, don't edit)
    models/        company.py, kpi.py, user.py      → I add: ai_insight.py (Phase C)
    schemas/       auth, company, kpi, user         → I add: ai.py        (request/response contract)
    services/      *_service.py                     → I add: ai_service.py (thin entry point)
```
Planned AI pipeline modules (location to confirm with Vaibhav: top-level `ai/` vs `backend/app/ai/`):
```
llm.py (provider wrapper) · guard.py (off-topic/injection) · intent.py (metric + period detection)
facts.py (KPI fetch + Python calculations) · context.py (labeled context) · prompts.py
validate.py (numeric grounding check) · retrieval.py (pgvector, Phase D)
```
Also: `docs/ai-analyst/` (this file + SPEC.md), `tests/` (eval runner), mock docs later.
LLM key → add a placeholder to `.env.example`, real value only in `.env`.

## 7. Decisions
| Decision | Choice | Status |
|---|---|---|
| Vector store | pgvector in the existing Postgres | Proposed, needs Vaibhav approval (Docker image + extension) |
| Embeddings | `BAAI/bge-small-en-v1.5` local, 384-dim | Proposed (free, no key) |
| Generation LLM | Groq, `llama-3.3-70b-versatile` (production model per console.groq.com/docs/models, 2026-10-07) via `openai` pkg + base_url `https://api.groq.com/openai/v1`; env `AI_API_KEY` / `AI_MODEL` / `AI_BASE_URL`; temp 0.2, max_tokens 400, timeout 30s, 1 retry; all failures → `LLMError` (→ 503) | Decided 2026-10-07 |
| Arithmetic | Done in Python, never by the LLM | Decided |
| Branches | `feature/ai-analyst-spec` (Phase A), then one branch per phase | Decided |
| Pipeline location | `backend/app/ai/` (importable as `app.ai.*`; top-level `ai/` isn't on the path) | Decided 2026-10-07 |
| Test data | Fake seeder `backend/scripts/seed_ai_test_data.py` → same `companies`/`kpis` tables via team models; 3 cos × 24 months (2024-01..2025-12, month-end) × revenue/expenses/profit; `--reset` deletes only fakes | Decided 2026-10-07 |
| Metric names/units | Only in `app/ai/metrics_config.py` (all INR for now); swap to real names there only | Decided 2026-10-07 |
| Facts rules | Monthly buckets; duplicate date → last stored row wins, several dates in a month → latest date wins (both add a data-quality note); quarter/year = SUM of months, partial periods flagged; % = (curr−prev)/abs(prev), None if prev=0 (same as analytics); round only in text (1-dp %, Indian grouping INR, ASCII "-") | Decided 2026-10-07 |
| I2 summary | Reuse `analytics_service.get_company_analytics` (PR #10): `comparison_available=false` → latest only; `latest_date==previous_date` → no change + data-quality note | Decided 2026-10-07 |
| Tests | `pytest.ini` at repo root (`pythonpath = backend`, cache off); `tests/ai/`; DB tests skip if Postgres down / fakes not seeded. Run: `.venv\Scripts\python -m pytest` | Decided 2026-10-07 |

## 8. Progress
- [x] A0. Branch `feature/ai-analyst-spec` created from `develop`, `docs/ai-analyst/` committed, `CLAUDE.local.md` excluded via `.git/info/exclude` (verified 2026-10-06: b5cb595 on top of develop 88d038f, pushed)
- [ ] A1. Repo explored by Claude Code; Open questions below answered where possible
- [ ] A2. Messages sent to Vaibhav / Athira / Piyush / Arth
- [ ] A3. SPEC.md finalized with real metric names + team feedback → PR to `develop`
- [ ] A4. Mock response JSON shared with Piyush; eval checklist shared with Arth
- [x] Step 0. `origin/develop` merged into `feature/ai-analyst-core` (2026-10-07, no conflicts: forecast API, placeholder AI endpoint, analytics PR #10); uvicorn starts, `/docs` 200, `/health/db` ok
- [x] B1 (PROMPTS). Fake seeder written + run: companies 1–3 × 72 KPI rows, idempotent
- [x] B2 (PROMPTS). `app/ai/metrics_config.py` + `app/ai/data_access.py` + tests
- [x] B3 (PROMPTS). `app/ai/facts.py` (pct_change, value_at, trend, compare_periods, extremes, cross_metric_growth, latest_summary) + unit tests — 36/36 tests pass
- [ ] B4 (PROMPTS). `app/ai/llm.py` + `scripts/llm_hello.py` + 8 offline tests done (44/44 pass); **pending: real Groq key in `.env`, then `python -m scripts.llm_hello` prints a reply**
- [ ] B5–B8 (PROMPTS). Intent, context + prompt, guard + validator, eval runner passing ≥90% / 100% safety
- [ ] C1. `/api/ai/ask` endpoint + RBAC + `ai_insights` logging → PR
- [ ] D1. Mock docs written to match seed numbers
- [ ] D2. Chunk/embed/ingest + retrieval → PR
- [ ] E1. Forecast context added
- [ ] F1. UI integrated, QA pass, demo questions rehearsed

## 9. Open questions
- [x] Where do routers/models/schemas live? → `backend/app/api/routers`, `models`, `schemas`, `services` (see §6)
- [x] Is the top-level `ai/` folder meant for my pipeline code? → went with `backend/app/ai/` (importable); tell Vaibhav in the PR.
- [ ] **Placeholder AI endpoint (from develop, f03dd54, not mine):** `POST /companies/{company_id}/ai-analysis` in `api/routers/ai_analyst.py` + `services/ai_analyst_service.py` + `schemas/ai_analyst.py` (request `{question}`, response `{company_id, question, answer}`, roles Admin/Analyst/Viewer, 400 on blank question). Differs from SPEC §7 (`POST /ai/ask`, status/figures/sources). → Agree ONE contract with Vaibhav before C1: either I implement inside his placeholder or replace it.
- [x] Analytics PR #10 (`GET /companies/{id}/analytics`) is reusable for intent I2 — done in `facts.latest_summary` with the `comparison_available` and duplicate-date checks.
- [ ] Endpoints now require a JWT (company/analytics return 401 without a token) — update §3 "routes are open" note after confirming with Vaibhav.
- [ ] Root `requirements.txt` (untracked) is UTF-16 encoded (PowerShell `pip freeze >`) and has no pytest → regenerate as UTF-8 before committing (`.venv\Scripts\python -m pip freeze | Out-File -Encoding utf8 requirements.txt`) and agree with Vaibhav who owns it.
- [x] Router registration / init_db / tables → `app.include_router(x.router)` in main.py, no global prefix. `init_db.py` = `Base.metadata.create_all` (no Alembic), run manually (`python -m app.init_db`), creates missing tables only, never alters. Tables: `companies`, `kpis`, `users`. New models must be imported in `init_db.py` + `models/__init__.py`.
- [x] Dependencies → `app.core.dependencies.get_current_user` returns `{"user_id": int, "role": "admin"|"analyst"|"viewer"}` (401 bad/expired token, unknown or inactive user). `require_role(*roles: UserRole)` factory: `Depends(require_role(UserRole.ADMIN, UserRole.ANALYST))` → same dict, 403 "Insufficient permissions". JWT HS256, `sub` = user id.
- [x] API conventions → no `/api` prefix; routers set their own (`/auth`, `/companies`). Errors = FastAPI default `{"detail": "<msg>"}` (422: `{"detail": [{loc,msg,type}]}`). No envelope: return `response_model` directly. 201 create / 204 delete. Existence 404s live in the router. → mine: `POST /ai/ask`, `APIRouter(prefix="/ai", tags=["AI Analyst"])`.
- [ ] Seed data: which `metric_name`s exist, units/currency, granularity, how much history, how many companies? — Code facts: `metric_name` free-text String(100), `metric_value` Numeric(18,2), `metric_date` any Date, no unit/currency column (KPI or Company), no unique (company_id, metric_name, metric_date) → duplicates possible. No seed script in repo. Rest → Athira.
- [ ] Forecast output shape and table name (Athira)?
- [x] LLM provider → Groq (my key, my `.env` only). `llm.py` reads env itself, so `config.py` (not mine) is untouched; `change_me` is treated as missing.
- [ ] Propose to Vaibhav: add `AI_MODEL=llama-3.3-70b-versatile` and `AI_BASE_URL=https://api.groq.com/openai/v1` under `# AI` in `.env.example`; add `openai` (and `pytest`) to requirements.
- [ ] Can a Viewer use the AI Analyst? (policy → Vaibhav) — the develop placeholder already allows Viewer. — Company scoping: code has none (`User` has no company link; company/kpi routes have no auth at all).
- [ ] FastAPI version? No requirements file in repo; `HTTPBearer` returns 403 (not 401) for a missing header in some versions → affects E20.
