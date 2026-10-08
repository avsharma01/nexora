# NEXORA frontend

Next.js 16 + React 19 + Tailwind v4 + Recharts. Dark and light glass theme (toggle in the header).
Every screen reads the FastAPI backend; there is no mock or fallback data.

## Run

```bash
# 1. backend (from backend/), Postgres must be up
../.venv/Scripts/python -m uvicorn app.main:app --port 8000

# 2. frontend (from frontend/)
npm install
npm run dev          # http://localhost:3000
```

The browser calls `/api/*`; `next.config.mjs` forwards that to `NEXORA_API` (default `http://localhost:8000`).
Set `NEXORA_API` to point at another backend. No CORS setup is needed for local use.

`npm run build` type-checks (type errors fail the build). `npm run typecheck` runs `tsc` on its own.

## Screens and the endpoints behind them

| Screen | Backend |
|---|---|
| Sign in / create account | `POST /auth/login`, then `GET /auth/me` for the role; `POST /auth/register` |
| Company page: edit details, delete company | `PUT /companies/{id}`, `DELETE /companies/{id}` |
| Company page: KPI records (add, edit value, delete) | `POST /companies/{id}/kpis`, `PUT /kpis/{id}`, `DELETE /kpis/{id}` |
| Portfolio: new company | `POST /companies/` |
| Company switcher, Portfolio | `GET /companies/`, then `GET /companies/{id}/kpis` per company |
| Dashboard, Financials, Analytics, Company, Scenarios, Reports | `GET /companies/{id}/kpis`, `GET /companies/{id}/analytics` |
| Forecast | `POST /companies/{id}/forecast` (estimate, 95% range, model, MAE/MAPE) |
| AI Analyst, Dashboard summary | `POST /companies/{id}/ai-analysis` |
| API status dot | `GET /health` |
| Anomalies | none yet: shows "Coming in the final version" until the backend ML service has an endpoint |

Computed in the browser from the KPI rows (display only): quarterly/yearly sums, margins, trend signals and
the Scenarios sliders (your assumptions applied to the last 12 months of actual totals; both start at 0%, and
the page is badged "Calculated in the browser from KPI data"). There is no browser anomaly detection.
The AI analyst never uses these numbers; it computes its own facts in the backend.

Numbers are converted with `Number()` where responses arrive (`lib/nexora/api.ts`), so Decimal values sent
as strings are safe everywhere.

## Roles

The backend decides permissions (`require_role` in each router). The frontend gets the role from
`GET /auth/me` after login and again whenever the app opens, never from the email. One map,
`lib/nexora/permissions.ts`, mirrors the routers, and `can(user, 'kpi:update')`-style checks decide which
buttons exist. Nothing else in the UI checks roles.

| Action | Admin | Analyst | Viewer |
|---|---|---|---|
| View everything, AI analyst, forecast, scenario sliders | yes | yes | yes |
| Create / edit company | yes | yes | no |
| Delete company | yes | no | no |
| Add / edit KPI | yes | yes | no |
| Delete KPI | yes | no | no |

All roles see the same sections; buttons a role can't use are not rendered, so no forbidden call is
ever sent. Opening an action from a link it can't perform (`#company/edit`, `#kpi/new`, `#company/new`)
shows "Access restricted". Deletes need a second click. Deleting a company that still has KPI records
returns 409 and the page says to delete its KPI records first. After any write the app refetches, so
charts, the forecast and the AI summary use the new numbers.

Errors: 401 → back to sign-in with a message; 403 → "You don't have permission"; 404 → not-found state;
409 / 422 → the backend's reason in plain words; 500 / 503 / no backend → "service unavailable".

Public sign-up always creates a Viewer. There is no endpoint to change roles, so this app has no
user-management screen.

## Notes

- KPIs carry no currency. A company's currency is learned from the analyst's first answer
  (INR for the fake test companies, USD for Athira's companies) and kept for the browser session.
- The layout started from a v0.app generation and was rebuilt on the real API.

## Layout

```
app/                 layout, page (session gate), globals.css (theme tokens, glass, grain)
components/nexora/   shell, login, theme toggle, workspace state, ui primitives
components/nexora/pages/   one file per screen
lib/nexora/          api client, KPI maths for display, formatting
```
