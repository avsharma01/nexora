# PostgreSQL data layer

NEXORA uses PostgreSQL through SQLAlchemy 2.x. Models are registered in
`app.models`; `Base.metadata.create_all` is the repository's schema initializer.
No Alembic or other migration system exists in this repository.

## Initialize and seed a fresh database

Set `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_HOST`, and
`POSTGRES_PORT` in the environment or `.env`. Start PostgreSQL using the
team-owned setup, then run from this directory:

```powershell
python -m app.init_db
python -m app.seed_data
```

`init_db` is for a fresh PostgreSQL database. It creates the schema from the
current SQLAlchemy models and can be rerun, but `Base.metadata.create_all`
does not alter existing tables or apply new columns, indexes, or constraints.
This MVP assumes a fresh database: do not point this version at a database
created by an older schema until the team has separately upgraded that database.
The repository has no migration system, and this work does not add one.

The seed command inserts three synthetic companies, 24 completed monthly
periods per company, USD financial records, and `revenue`, `expenses`, and
`profit` KPI rows. That is 72 financial records and 216 KPIs (288 data rows).
It does not create user credentials: register a user through `/auth/register`
and log in through `/auth/login`. Seeding is idempotent by company name and
company/date or company/metric/date; rerunning it does not overwrite existing
values. KPI duplicates remain allowed pending agreement on the shared API
write behavior; analytics and forecasts resolve same-date duplicates by
highest row id.
Missing months are not interpolated by the forecast service.

## Tables and scope

The MVP schema contains `companies`, `users`, `financial_records`, `kpis`,
`forecasts`, `model_evaluations`, and `scenarios`. Company data uses restrictive
foreign keys so historical data cannot become detached or be deleted by
cascading from a company. User `company_id` is nullable because the current
registration API does not accept a company; Anant must coordinate that shared
ownership/access contract before company-level user authorization can be
enforced.

`ai_insights` is left to the AI integration owner; the existing AI endpoint does
not persist insights. `customers`, portfolio tables, and `anomalies` are not
implemented because no current MVP API uses them and anomaly detection is
outside MVP scope.

## Forecast behavior

`POST /companies/{company_id}/forecast` reads the selected metric's historical
rows from `kpis` and returns a least-squares trend estimate. It requires three
distinct observation dates, preserves calendar gaps, and returns
`insufficient_data` rather than fabricating missing months. Forecast results
are returned by the API but not written to `forecasts`; that table is available
for a later persistence decision. Evaluation metrics are included in the
response and are not persisted to `model_evaluations`.

Forecast bounds are indicative residual-based ranges, not calibrated
confidence intervals. `model_name`, generation time, history count, and
rolling-origin MAE/MAPE are included in the response.

## Indexes and constraints

- `users.email` is unique (and therefore indexed).
- Financial records are unique per company/date; the unique index supports
  company/date queries.
- KPIs have a non-unique `(company_id, metric_name, metric_date)` index. Same
  date duplicates are intentionally not prohibited while the API owner decides
  their write behavior.
- Forecasts have `(company_id, metric_name, forecast_date)` index.
- Scenarios have `(company_id, created_at)` index.
- Company names are case-insensitively unique. Duplicate create/update requests
  return HTTP 409. Financial and forecast history uses restrictive
  company foreign keys; user membership uses `SET NULL` until registration is
  updated to collect company ownership.
- Deleting a company with related business/history records returns HTTP 409 so
  those rows are retained; an empty company can still be deleted.

Run the database tests from the repository root with `pytest`.
