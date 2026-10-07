# NEXORA — AI Company Intelligence Platform (Frontend)

Modern Next.js (App Router, React 19, TypeScript) implementation of the NEXORA AI Company Intelligence platform, faithfully preserving the design system, micro-animations, and interactive financial workflows of the original prototype while integrating with the FastAPI backend.

---

## 🚀 Features

- **Pixel-Accurate Design System**:
  - CSS custom properties supporting dynamic light and dark theme switching (`data-theme="dark"` / `data-theme="light"` / `prefers-color-scheme`).
  - Sleek cards, KPI tiles, custom SVG interactive line, bar, and donut charts.
  - Fully responsive desktop sidebar and mobile horizontal navigation.

- **Role-Based Access Control (RBAC)**:
  - **Admin** (`admin@nexora.io` / `demo123`): Access to all 6 views + inline editing of company monthly financials (Revenue & Expenses).
  - **Analyst** (`analyst@nexora.io` / `demo123`): Access to all 6 views (read-only KPI tables).
  - **Viewer** (`viewer@nexora.io` / `demo123`): Access to Dashboard, Company & KPIs, Analytics, and Forecast. AI Analyst and What-If are locked with explicit visual permission badges.

- **6 Intelligence Modules**:
  1. **Dashboard (`dash`)**: Real-time quarterly revenue/expense/profit metrics, margin % with QoQ deltas, revenue vs expenses bar chart, monthly profit line chart, segment revenue mix, expense breakdown mix, profit margin trend, quarterly comparison.
  2. **Company & KPIs (`kpi`)**: Company profile overview + interactive 12-month financial tables. Live editing updates all charts, models, and AI analyst outputs.
  3. **Analytics (`ana`)**: 12-month YoY growth, QoQ revenue and profit changes, best revenue month, combined revenue & profit trendlines, quarter-over-quarter comparison table, and month-over-month revenue growth bars.
  4. **Forecast (`fc`)**: Statistical linear trend regression projection for the next 6 months, backtested with Mean Absolute Percentage Error (MAPE) against historical quarters.
  5. **AI Business Analyst (`ai`)**: Grounded chat interface with quick suggestion chips. Answers are verified and cited against approved financial datasets or backend RAG services.
  6. **What-If Scenario Simulator (`wi`)**: Interactive revenue growth rate slider (-3.0% to +8.0% per month) with baseline comparisons, comparative KPIs, scenario line charts, and monthly projections.

- **Multi-Language Localization (i18n)**:
  - **English (Default)** (`en`)
  - **Japanese** (`ja` / 日本語)
  - **French** (`fr` / Français)
  - **Hindi** (`hi` / हिन्दी)
  - Instant language switcher available on the Login screen, Top Header, and Sidebar.
  - Full UI localization including navigation titles, KPI cards, table column headers, chart legends, period comparison labels, month names, suggested question chips, and grounded AI responses.
  - Persistent language selection stored in `localStorage`.

- **Backend Integration**:
  - Live status indicator in the sidebar and login view.
  - Connects to the FastAPI backend (`http://localhost:8000`) for authentication (`/auth/login`), company management (`/companies/`), KPI syncing (`/companies/{id}/kpis`), analytics (`/companies/{id}/analytics`), forecasts (`/companies/{id}/forecast`), and AI analyst questions (`/companies/{id}/ai-analysis`).
  - Seamless offline/standalone fallback mode ensures all calculations, charts, and interactions continue working smoothly without interruption.

---

## 🛠️ Getting Started

### Prerequisites
- Node.js 18+ (tested on Node 22)
- npm or yarn

### Installation & Run

```bash
# Navigate to frontend
cd nexora/frontend

# Install dependencies (if not already installed)
npm install

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Environment Configuration

Configure `.env.local` to point to your FastAPI backend:
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## 🏢 Demo Credentials

| Role | Email | Password | Allowed Views |
|---|---|---|---|
| **Admin** | `admin@nexora.io` | `demo123` | Dashboard, Company & KPIs (Editable), Analytics, Forecast, AI Analyst, What-If |
| **Analyst** | `analyst@nexora.io` | `demo123` | Dashboard, Company & KPIs, Analytics, Forecast, AI Analyst, What-If |
| **Viewer** | `viewer@nexora.io` | `demo123` | Dashboard, Company & KPIs, Analytics, Forecast (AI & What-If locked) |
