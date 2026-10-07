# Switch the AI Analyst from fake to real data (≈ 30 minutes)

Run every command from `backend/` with the venv Python (`..\.venv\Scripts\python`, shown as `python`).
Dry-run on 2026-10-07 with companies built like Athira's `seed_data.py` (Northstar Retail, Cedar Health,
Orbit Software; USD; month-start dates): **real-data smoke evals 14/14, safety 6/6**.

## Before you start (5 min)
1. `git pull` on `develop` and make sure **Athira's data branch is merged** (it changes `init_db.py`,
   `models/__init__.py` and `models/kpi.py`). After the merge, check that `init_db.py`:
   - still runs `CREATE EXTENSION IF NOT EXISTS vector` (her version dropped it), and
   - still creates `ai_insights`, `ai_documents`, `ai_document_chunks` (they are imported via `app.models`).
2. `docker compose up -d`, then `python -m app.init_db` (creates missing tables only, never alters).
3. Look at the real data once:
   ```
   python -c "from sqlalchemy.orm import Session; from app.database import engine; from app.models.kpi import KPI; s=Session(engine); print(sorted({m for (m,) in s.query(KPI.metric_name).distinct()}))"
   ```
   Note the metric names and the currency (Athira's seed: `revenue`, `expenses`, `profit`, **USD**).

## Switch (15 min)
4. Remove the fake companies (deletes only them + their KPIs, documents and ai_insights rows):
   `python -m scripts.seed_ai_test_data --reset`
5. Load the team's data: `python -m app.seed_data` (or whatever the data owner says).
6. Edit **only** `app/ai/metrics_config.py`:
   - one entry per real `metric_name` (key = exact DB name),
   - `"unit"`: the real currency code (`"USD"`; amounts then print as `1,234,567 USD`; `"INR"` keeps Indian grouping),
   - add synonyms people will type (e.g. `"cogs"`, `"opex"`); a metric missing here can't be asked about.
7. Documents:
   - real documents (board memos, reports) → `../data/real_docs/<company-slug>/*.md` with `## ` section headers
     and a `company.json` `{"company_name": "<exact name in DB>"}`;
   - and/or numbers-only summaries generated from the real KPIs (no invented reasons):
     `python -m scripts.generate_mock_docs --all --out ../data/real_docs`
8. Ingest: `python -m scripts.ingest_docs --dir ../data/real_docs`
   (re-runnable; also remove the old fake documents from the DB if you skipped step 4).

## Check (10 min)
9. `python -m pytest ../tests/ai -q`. DB tests that need the fake companies **skip** (expected); everything
   else must pass.
10. `python -m scripts.run_evals --file ../evals/real_data_smoke.jsonl`
    - It uses Athira's company names; if the real names differ, edit the `company` fields first.
    - **Expect ≥ 90 % overall and 100 % safety** (dry run: 100 % / 100 %). Any safety failure = stop and fix.
    - The fake-data set (`ai_analyst_eval.jsonl`) needs the fake companies: run it in a dev DB with
      `python -m scripts.seed_ai_test_data` + `generate_mock_docs` + `ingest_docs`, not in the demo DB.
11. Ask 3 questions by hand: `python -m scripts.ask --company <id> "How is the company doing?"`
    (ids: `GET /companies` in Swagger). Check the currency, the months and the citations.

## What does NOT change automatically
- **Forecasts**: forecast questions keep answering `insufficient_data` until Phase E1 reads Athira's
  `forecasts` table (`metric_name, forecast_date, predicted_value, lower_bound, upper_bound, model_version`)
  into `[FORECASTS — ESTIMATES, NOT ACTUALS]`. That is a coding task (~2 h), not part of this runbook.
- **Retrieval threshold** (`retrieval.MIN_SIMILARITY = 0.60`) was calibrated on the mock docs. With real
  documents, try 5 "why"/"risk" questions with `python -m scripts.ask --context` and lower/raise it if good
  excerpts are missing or unrelated ones appear.
- "Why" questions without a real document stating the cause will (correctly) say
  "The available data does not explain the cause."
