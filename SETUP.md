# NEXORA local setup (from scratch)

About 15 minutes. You need: **Git**, **Docker Desktop** (running), **Python 3.12+** (tested on 3.14),
**Node.js 20+** (tested on 24) and your own **Groq API key** (free at console.groq.com).
Commands are for PowerShell on Windows; macOS/Linux differences are noted.

## 1. Clone

```powershell
git clone https://github.com/avsharma01/nexora.git C:\dev\nexora
cd C:\dev\nexora
git checkout develop
```

**Windows: clone into a short path** such as `C:\dev\nexora`. `pip install` fails on one of `onnxruntime`'s
long file names when the project sits deep in folders such as OneDrive (Windows' 260-character path limit),
unless long paths are enabled in Windows.

## 2. `.env` (repo root)

```powershell
copy .env.example .env        # macOS/Linux: cp .env.example .env
```

Edit `.env`:

| Key | Set to |
|---|---|
| `POSTGRES_PASSWORD` | any password you like (used to create the database in step 3) |
| `POSTGRES_HOST` | `localhost` (the example's `postgres` only works inside Docker) |
| `POSTGRES_PORT` | `5433` (the port Docker publishes) |
| `JWT_SECRET_KEY` | any long random string (32+ characters) |
| `AI_API_KEY` | your Groq key (`gsk_...`). **Never commit `.env`.** |

## 3. Database (Postgres + pgvector in Docker)

```powershell
docker compose up -d
docker ps                      # nexora-postgres should be "Up"
```

## 4. Python environment

```powershell
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
# macOS/Linux: python3 -m venv .venv && .venv/bin/python -m pip install -r requirements.txt
```

All backend commands below run **from `backend/`** with that interpreter
(`..\.venv\Scripts\python` on Windows, `../.venv/bin/python` on macOS/Linux).

## 5. Tables and data

```powershell
cd backend
..\.venv\Scripts\python -m app.init_db                      # tables + pgvector extension
..\.venv\Scripts\python -m app.seed_data                    # Athira's companies: Northstar Retail, Cedar Health, Orbit Software (USD)
..\.venv\Scripts\python -m scripts.seed_ai_test_data        # fake test companies: Test Retail, Test SaaS Labs, Test Foods (INR)
..\.venv\Scripts\python -m scripts.generate_mock_docs --all # company documents for the AI analyst
..\.venv\Scripts\python -m scripts.ingest_docs              # embeds the fake companies' documents (first run downloads a ~67 MB model)
..\.venv\Scripts\python -m scripts.ingest_docs --dir ../data/real_docs   # embeds the real companies' data summaries
..\.venv\Scripts\python -m scripts.seed_demo_users          # DEMO ONLY accounts, see below
```

Every step is safe to run again: it skips what already exists.

## 6. Backend

```powershell
..\.venv\Scripts\python -m uvicorn app.main:app --port 8000
```

Leave it running. Check http://localhost:8000/health shows `{"status":"healthy"}`; API docs at http://localhost:8000/docs.

## 7. Frontend (second terminal)

```powershell
cd frontend
npm install
npm run dev
```

Open **http://localhost:3000**, click **Sign in as Admin / Analyst / Viewer** (it fills the form), then press **Sign in**.

## Demo accounts (DEMO ONLY)

Created by `scripts/seed_demo_users.py`. The passwords are public, so **never run that script on a deployed server.**

| Email | Role | Password |
|---|---|---|
| admin@nexora.demo | Admin: everything, including deletes | nexora-demo-admin |
| analyst@nexora.demo | Analyst: create/edit companies and KPIs | nexora-demo-analyst |
| viewer@nexora.demo | Viewer: read, forecast, AI analyst | nexora-demo-viewer |

The demo buttons show in `npm run dev`. A production build (`npm run build && npm start`) shows them only
when built with `NEXT_PUBLIC_DEMO_MODE=true`. Public sign-up always creates a Viewer.

## Already had a database before 2026-10-08?

`init_db` only creates missing tables; it never changes existing ones. If your Docker volume is older than
develop `a459a1f` (Athira's data layer), back it up and run `docs/db/upgrade_2026-10-08.sql` (instructions
are at the top of that file). A **fresh** database from step 3 doesn't need it.

## Checks

```powershell
.venv\Scripts\python -m pytest                              # from the repo root
cd backend; ..\.venv\Scripts\python -m scripts.run_evals    # AI evals, uses your Groq key
cd frontend; npm run build                                  # type-checks the frontend
```

## Troubleshooting

| Symptom | Fix |
|---|---|
| `pip install` fails with `OSError: [Errno 2] No such file or directory ... onnxruntime\...` (Windows) | Path too long: move the clone to a short path like `C:\dev\nexora`, or enable Windows long paths |
| AI says the real companies' documents don't exist | Run the second ingest line (`--dir ../data/real_docs`) |
| Scripts hang or "connection refused" | Docker Desktop isn't running, or `.env` still says `POSTGRES_HOST=postgres` / `5432` |
| `password authentication failed` | The volume was created with a different `POSTGRES_PASSWORD`. Use that one, or `docker compose down -v` (deletes local data) and start again |
| Port 5433 or 8000 already in use | Stop the other process, or change the port (backend: `--port 8001`, then start the frontend with `NEXORA_API=http://localhost:8001`) |
| AI answers: "service unavailable" | `AI_API_KEY` missing or wrong in `.env`; restart the backend after editing |
| Frontend: "The backend is not reachable" | Start the backend (step 6) |
