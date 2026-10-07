# Switch the AI Analyst from fake to real data (≈ 30 minutes)

Run every command from `backend/` with the venv Python (`..\.venv\Scripts\python`, shown as `python`).

**Real run on 2026-10-07** with Athira's actual `seed_data.py` (origin/feature/athira-forecasting @ 6f267d1):
Northstar Retail, Cedar Health, Orbit Software (local ids 10, 11, 12), Oct 2024 – Sep 2026, USD,
loaded **next to** the fake companies. Results with both in one DB: **real-data smoke evals 14/14
(safety 6/6), main evals 35/35 (safety 16/16), pytest 194/194.** Answers came out in USD automatically.

## What we learned from the real run
- Fake and real companies **can live in the same DB**: the analyst picks each company's currency from
  `financial_records.currency` (Athira's table) and falls back to `metrics_config.py` (INR) when a company
  has no financial records. So you no longer edit the unit for Athira's data.
- Her seed only **inserts** (no drop/truncate/delete): 3 companies (matched by case-insensitive name),
  216 KPI rows, 72 `financial_records` rows. It never touches the fake companies, `ai_*` tables or the
  vector extension.
- **Before her branch is merged, her seed cannot run as-is** on `feature/ai-analyst-core`: it imports
  `FinancialRecord` (her model) and her `Company` model relies on a database default for `created_at` that our
  existing `companies` table does not have. We ran her `seed_data()` unchanged through a temp runner wired to
  our models + her `FinancialRecord` (creating only the missing `financial_records` table). **After the merge
  this problem disappears**: just run `python -m app.seed_data`.
- Her dates move with today (the 24 complete months before today), so real answers drift month by month;
  that is why the real-data evals check behaviour, not fixed numbers.
- Her data is smooth (no events, no documents): "why" questions correctly answer
  "The available data does not explain the cause."

## Before you start (5 min)
1. `git pull` on `develop` and make sure **Athira's data branch is merged** (it changes `init_db.py`,
   `models/__init__.py` and `models/kpi.py`). After the merge, check that `init_db.py`:
   - still runs `CREATE EXTENSION IF NOT EXISTS vector` (her version dropped it), and
   - still creates `ai_insights`, `ai_documents`, `ai_document_chunks` (imported via `app.models`).
2. `docker compose up -d`, then `python -m app.init_db` (creates missing tables only, never alters).
   An existing local DB will not get her new `users.company_id` column this way: reset the DB volume or
   add the column by hand, as agreed with Athira.
3. Look at the real data once:
   ```
   python -c "from sqlalchemy.orm import Session; from app.database import engine; from app.models.kpi import KPI; s=Session(engine); print(sorted({m for (m,) in s.query(KPI.metric_name).distinct()}))"
   ```
   Athira's seed: `revenue`, `expenses`, `profit`, currency **USD** (in `financial_records`).

## Switch (15 min)
4. Load the team's data: `python -m app.seed_data` (insert-only, safe to re-run).
5. Only if real data adds **new metric names**: add one entry per name to `app/ai/metrics_config.py`
   (key = exact DB name, `"unit"` = currency code or `"%"`, synonyms people will type). Currency comes from
   `financial_records` per company; a company without financial records uses the unit in this file.
6. Documents:
   - numbers-only summaries from the real KPIs (no invented reasons):
     `python -m scripts.generate_mock_docs --all` → `data/real_docs/<company>/data_summary.md`
     (fake company documents always stay in `data/mock_docs/`; `data/real_docs/` is not committed);
   - real documents (board memos, reports), when the team has them → `data/real_docs/<company-slug>/*.md`
     with `## ` section headers and a `company.json` `{"company_name": "<exact name in DB>"}`.
7. Ingest: `python -m scripts.ingest_docs --dir ../data/real_docs` (re-runnable, skips unchanged files).
8. Demo DB only: remove the fake companies with `python -m scripts.seed_ai_test_data --reset` (deletes only
   them + their KPIs, documents and ai_insights rows). Keep them in a dev DB for the main evals.

## Check (10 min)
9. `python -m pytest ../tests/ai -q` → everything passes (DB tests that need the fake companies skip if
   you removed them).
10. `python -m scripts.run_evals --file ../evals/real_data_smoke.jsonl`
    - Uses Athira's company names; if the real names differ, edit the `company` fields first.
    - **Expect ≥ 90 % overall and 100 % safety** (real run: 100 % / 100 %). Any safety failure = stop and fix.
    - With the fake companies still loaded, also run `python -m scripts.run_evals` (real run: 35/35).
11. Ask 3 questions by hand and check currency, months and citations
    (ids: `GET /companies` in Swagger, or the seed output):
    `python -m scripts.ask --company <id> "How is the company doing?"`

## What does NOT change automatically
- **Forecasts**: forecast questions keep answering `insufficient_data` until Phase E1. Athira's forecasts
  are computed on demand by `forecast_service.get_forecast(db, company_id, metric_name, periods)`
  (`linear_trend_v1`; returns `forecast_value`, `lower_bound`, `upper_bound`, MAE/MAPE, `status`) and are
  **not** saved to the `forecasts` table, so E1 should call that service and put its points into
  `[FORECASTS — ESTIMATES, NOT ACTUALS]`. That is a coding task (~2 h), not part of this runbook.
- **Retrieval threshold** (`retrieval.MIN_SIMILARITY = 0.60`) was calibrated on the mock docs. With real
  documents, try 5 "why"/"risk" questions with `python -m scripts.ask --context` and lower/raise it if good
  excerpts are missing or unrelated ones appear.
- Style: on real data the model sometimes writes "over the last 12 months" instead of naming the months
  in the first sentence (the cited fact still names them).
