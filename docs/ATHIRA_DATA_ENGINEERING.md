# Athira Ravi Pillai — Data Engineering & ML Implementation

## 1. Responsibility

This branch covers the PostgreSQL data layer, SQLAlchemy models, deterministic synthetic seed data, data validation, forecasting, forecast evaluation metrics, and database support for analytics and scenarios. PostgreSQL containerization, Docker changes, and local infrastructure orchestration are owned by Anant Vaibhav and are intentionally outside this branch.

## 2. Database Architecture

PostgreSQL is the authoritative structured data store. The backend uses SQLAlchemy 2.x as its ORM. Database initialization currently calls `Base.metadata.create_all`; the project has no Alembic or other migration system. Consequently, initialization is intended for a fresh PostgreSQL database.

The application data flow is:

```text
PostgreSQL
→ SQLAlchemy models
→ FastAPI services
→ APIs
→ frontend
```

## Python Dependencies

The repository previously had no Python dependency configuration. The root
`requirements.txt` now specifies bounded dependencies for the existing
FastAPI, SQLAlchemy/PostgreSQL, authentication, Pydantic, forecasting/analytics,
and pytest test suite. Python 3.12 is the tested runtime. This file configures
Python packages only; it does not configure Docker or containerization.

## 3. Database Models

### `companies`

The existing table now has ORM relationships to company-owned data, a functional unique index on normalized (case-insensitive) company names, and protected deletion behavior. Names are trimmed and uniqueness is enforced without regard to case.

### `users`

The existing table now includes nullable `company_id`, a foreign key to `companies`, and the corresponding relationship. Deleting a company sets a linked user's company reference to null. The current registration flow does not assign a company.

### `kpis`

The existing table has input validation and an index on company, metric name, and metric date. Duplicate company/metric/date rows are allowed. Analytics and forecasting resolve duplicate dates by selecting the row with the highest ID.

### `financial_records`

New company-owned financial history with company, record date, revenue, expenses, profit, currency, and creation timestamp. A company/date uniqueness constraint prevents duplicate financial records for the same period.

### `forecasts`

New storage structure for company, metric, forecast date, predicted value, lower and upper bounds, model version, and creation timestamp. The current forecast API calculates and returns forecasts but does **not** persist results to this table.

### `model_evaluations`

New structure for model version, metric, evaluation value, evaluation period, and creation timestamp. The current forecast response exposes evaluation metrics but does **not** persist them to this table.

### `scenarios`

New company-scoped structure for assumptions and projected results. The database model exists, but a scenario API is not implemented in this branch.

## 4. Database Relationships

Company has relationships to users, KPIs, financial records, forecasts, and scenarios. Company-owned historical/business records use restrictive foreign-key deletion behavior: deleting a company with related records is blocked rather than deleting that history through a cascade. The user relationship is the exception: `users.company_id` is nullable and uses `ON DELETE SET NULL`.

## 5. Indexes

The implemented indexes and uniqueness support include:

- `users.email` is unique (the unique constraint provides its supporting index); `users.company_id` is indexed.
- `financial_records(company_id, record_date)` is unique, enforcing one financial record per company and date.
- `kpis(company_id, metric_name, metric_date)` is indexed and non-unique.
- `forecasts(company_id, metric_name, forecast_date)` is indexed.
- `scenarios(company_id, created_at)` is indexed.
- `companies` has a functional unique index on `lower(name)`.
- `model_evaluations` has an index on model version and metric.

## 6. Seed / Synthetic Data

The seed script creates three synthetic companies with 24 monthly periods each: 72 financial records and 216 KPI records. Seed values are deterministic. Re-running the script is idempotent for matching company names and company/date or company/metric/date records; existing records are not overwritten, and a later run can add a newly completed period.

The seed script creates no user credentials. Users must register through the existing authentication API.

Run these commands from the `backend/` directory:

```bash
python -m app.init_db
python -m app.seed_data
```

Initialization and seed behavior were tested against SQLite, and PostgreSQL DDL was compiled. No live PostgreSQL server was available during development testing.

## 7. Forecasting

The existing forecast API reads metric history from PostgreSQL-backed KPI data. Duplicate dates are resolved using the highest-ID KPI record. Missing months remain calendar gaps; the service does not invent observations. The service detects insufficient history and requires at least three distinct historical dates.

Forecasts use a simple linear trend, identified as `linear_trend_v1`; this is not a more complex machine-learning model. The API returns predictions with lower and upper residual-based bounds, model name/version information, and rolling-origin evaluation metrics (MAE/MAPE when enough history is available). The bounds are indicative, not calibrated confidence intervals. Results are returned through the existing API and are not persisted in the new forecast or evaluation tables.

## 8. Data Quality and Validation

- Company names are trimmed, required, and unique without regard to case.
- KPI metric names are trimmed and nonblank; KPI numeric values are checked for valid finite values.
- Duplicate KPI company/metric/date rows are permitted and consistently resolved to the highest ID for analytics and forecasting.
- Insufficient forecast history is detected instead of producing a forecast from too little data.
- Foreign keys enforce company references in the database.
- Deleting a company with related business/history records is blocked.
- Invalid forecast period values preserve the existing HTTP 400 response behavior.

## 9. Testing

Final verified results:

- `python -m pytest -q`: **16 passed**
- `compileall`: **passed**
- `git diff --check develop`: **passed**
- Application import: **passed**
- Routes registered: **13**
- PostgreSQL DDL compilation: **14 statements compiled**

Tests were executed against SQLite; no live PostgreSQL server was available.

## 10. Integration and Team Boundaries

**Athira Ravi Pillai:** PostgreSQL/data layer, data models, seed data, data validation, forecasting/data support, and model evaluation support.

**Anant Vaibhav:** Docker/PostgreSQL containerization, infrastructure and local container orchestration, and deployment integration.

## 11. Fresh Database Requirement

The project currently uses SQLAlchemy `Base.metadata.create_all` and has no migration framework. A fresh PostgreSQL database can be initialized with `python -m app.init_db`. `create_all` creates missing tables but does not migrate existing tables or add newly declared columns, indexes, or constraints to them. Existing PostgreSQL databases therefore require a coordinated schema migration before running this branch against them. No migration framework or automatic/manual destructive migration behavior is introduced here.

## 12. Intentionally Out of Scope

This branch does not implement Docker/PostgreSQL containerization, `customers`, `portfolio_items`, `portfolio_metrics`, `anomalies`, AI insights persistence, advanced scenario simulation, multiple forecasting models, or a migration framework. The scenario database model is present, but its API and simulation are outside this implementation.

## 13. Future Integration

For integration with the containerized environment, Anant's infrastructure work needs to provide the PostgreSQL container and configure the backend's PostgreSQL connection environment variables (`POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_HOST`, and `POSTGRES_PORT`; or the connection configuration supported by the deployment). On a fresh database, initialize the schema with `python -m app.init_db`, load sample data with `python -m app.seed_data`, and verify backend connectivity. Existing databases need a coordinated schema migration first. Docker files are outside this branch and were not modified.

## 14. Summary

This branch delivers the data models and PostgreSQL-oriented data support for company/KPI history, synthetic seed data, validation, analytics inputs, and a linear-trend forecast API with evaluation metrics. It is ready to integrate against a fresh initialized database; existing databases need a coordinated schema migration. Testing used SQLite plus PostgreSQL DDL compilation, not a live PostgreSQL server.
