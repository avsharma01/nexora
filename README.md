# NEXORA — AI Company Intelligence Platform

NEXORA is an AI-powered company intelligence and financial forecasting platform. It provides real-time financial tracking, quarterly analytics, statistical forecasting (linear regression with backtested MAPE), scenario modeling ("What-If"), and a grounded AI Business Analyst.

---

## 🏗️ Project Architecture

```
nexora/
├── backend/            # FastAPI Python backend (SQLAlchemy, PostgreSQL, JWT auth, RBAC)
│   ├── scripts/        # Demo users, AI test data, document ingestion, evals
│   └── app/
│       ├── ai/         # AI Business Analyst: guard, intent, facts, RAG, LLM, number check
│       ├── api/        # Routers for auth, company, kpi, analytics, forecast, ai_analyst
│       ├── core/       # Security, JWT tokens, RBAC dependencies
│       ├── models/     # SQLAlchemy database models
│       ├── schemas/    # Pydantic validation schemas
│       ├── services/   # Business logic, analytics, forecasting, and RAG preparation
│       └── seed_db.py  # Database seeder for demo companies and users
│
├── frontend/           # Next.js 16 (App Router, React 19, TypeScript)
│   ├── app/            # App Router entry: page.tsx, layout.tsx, globals.css
│   ├── components/nexora/  # Login, shell, workspace state (React context) and one file per page
│   ├── lib/nexora/     # API client, role permissions, monthly maths, formatting
│   └── README.md       # Frontend documentation
│
└── docker-compose.yml  # PostgreSQL container definition
```

---

## 🚀 Quick Start

### 1. Run the Frontend (Next.js)

```bash
cd frontend
npm install
npm run dev
```

Frontend will run at: **http://localhost:3000**

### 2. Run the Backend (FastAPI, Optional)

```bash
cd backend
# Create and activate virtual environment
python3 -m venv venv
source venv/bin/activate
pip install fastapi uvicorn sqlalchemy psycopg pwdlib pyjwt python-dotenv

# Start FastAPI dev server
uvicorn app.main:app --reload --port 8000
```

### 3. Seed the Database

```bash
cd backend
python -m app.seed_db
```

---

## 🔑 Demo Credentials

Two seed scripts create demo accounts. Run either (or both) from `backend/`.

| Role | `python -m scripts.seed_demo_users` | `python -m app.seed_db` |
| --- | --- | --- |
| Admin | `admin@nexora.demo` / `nexora-demo-admin` | `admin@nexora.io` / `demo123` |
| Analyst | `analyst@nexora.demo` / `nexora-demo-analyst` | `analyst@nexora.io` / `demo123` |
| Viewer | `viewer@nexora.demo` / `nexora-demo-viewer` | `viewer@nexora.io` / `demo123` |

What each role can do:

- **Admin**: everything, and the only role that changes data (create, edit and delete companies and KPI rows, CSV import)
- **Analyst**: the analysis tools: AI analyst, forecasts, scenario simulator, reports and CSV exports (no data changes)
- **Viewer**: read-only dashboards (dashboard, company, financials, portfolio, analytics)

Public sign-up always creates a Viewer and needs a password of at least 8 characters.
