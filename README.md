# NEXORA — AI Company Intelligence Platform

NEXORA is an AI-powered company intelligence and financial forecasting platform. It provides real-time financial tracking, quarterly analytics, statistical forecasting (linear regression with backtested MAPE), scenario modeling ("What-If"), and a grounded AI Business Analyst.

---

## 🏗️ Project Architecture

```
nexora/
├── backend/            # FastAPI Python backend (SQLAlchemy, PostgreSQL, JWT auth, RBAC)
│   └── app/
│       ├── api/        # Routers for auth, company, kpi, analytics, forecast, ai_analyst
│       ├── core/       # Security, JWT tokens, RBAC dependencies
│       ├── models/     # SQLAlchemy database models
│       ├── schemas/    # Pydantic validation schemas
│       ├── services/   # Business logic, analytics, forecasting, and RAG preparation
│       └── seed_db.py  # Database seeder for demo companies and users
│
├── frontend/           # Next.js 16 (App Router, React 19, TypeScript)
│   ├── src/
│   │   ├── app/        # App Router pages and global design tokens
│   │   ├── components/ # Modular UI views, SVG charts, and layouts
│   │   ├── context/    # App state management (auth, live KPIs, RBAC)
│   │   └── lib/        # Financial calculations, types, and backend API client
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

- **Admin**: `admin@nexora.io` / `demo123` (Full access + live editable KPIs)
- **Analyst**: `analyst@nexora.io` / `demo123` (Full view access)
- **Viewer**: `viewer@nexora.io` / `demo123` (Read-only on Dashboard, KPIs, Analytics, Forecast)
