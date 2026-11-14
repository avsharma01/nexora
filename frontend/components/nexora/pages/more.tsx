'use client'

// Anomalies, Scenarios, Reports and Settings. (Company is in company.tsx.)

import { useState } from 'react'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ArrowLeft, Building2, Check, Download, FileText, Minus, Printer, ShieldAlert } from 'lucide-react'
import type { Action } from '@/lib/nexora/permissions'
import { aggregate, download, flatRow, toCsv } from '@/lib/nexora/data'
import { amount, compact } from '@/lib/nexora/format'
import { axis, BrowserCalcBadge, Card, ChartTooltip, PageTitle, IllustrativeBadge, RoleBadge, SectionHeader } from '../ui'
import { useWorkspace } from '../workspace'

/** Placeholder until the backend has an anomaly endpoint. Deliberately shows no data. */
export function Anomalies() {
  const { go } = useWorkspace()
  return (
    <Card className="flex min-h-[60vh] items-center justify-center p-8">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl bg-tint/[0.06] text-muted-foreground">
          <ShieldAlert className="size-6" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Coming in the final version</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Anomaly detection will come from the backend ML service (Athira's module) and appear here once that endpoint exists.
        </p>
        <button type="button" onClick={() => go('Dashboard')} className="button-primary mt-6">
          <ArrowLeft className="size-3.5" /> Back to Dashboard
        </button>
      </div>
    </Card>
  )
}

export function Scenarios() {
  const { company, data, unit } = useWorkspace()
  // No preset assumptions: both start at "no change".
  const [rev, setRev] = useState(0)
  const [exp, setExp] = useState(0)
  if (!company || !data) return null
  const last12 = data.rows.slice(-12)
  const base = { revenue: last12.reduce((a, r) => a + (r.revenue ?? 0), 0), expenses: last12.reduce((a, r) => a + (r.expenses ?? 0), 0) }
  const baseProfit = base.revenue - base.expenses
  const sRev = base.revenue * (1 + rev / 100)
  const sExp = base.expenses * (1 + exp / 100)
  const sProfit = sRev - sExp
  const sliders: [string, number, (n: number) => void, string][] = [
    ['Revenue change', rev, setRev, `Last 12 months: ${compact(base.revenue, unit)}`],
    ['Expense change', exp, setExp, `Last 12 months: ${compact(base.expenses, unit)}`],
  ]
  return (
    <div className="flex flex-col gap-6">
      <PageTitle
        title="Business scenario simulator"
        subtitle="Uses your slider assumptions on the last 12 months of actual totals. A forecast-based simulator will replace this once the backend scenario endpoint exists."
        action={<div className="flex flex-wrap gap-2"><IllustrativeBadge label="Illustrative scenario" /><BrowserCalcBadge /></div>}
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_1.2fr]">
        <Card className="p-5">
          <SectionHeader title="Assumptions" subtitle="Starting point: this company's actual last 12 months" />
          <div className="flex flex-col gap-8">
            {sliders.map(([label, value, set, note]) => (
              <div key={label}>
                <div className="flex items-center justify-between">
                  <div><p className="text-sm font-medium">{label}</p><p className="mt-1 text-xs text-muted-foreground">{note}</p></div>
                  <span className="rounded-lg bg-tint/[0.07] px-2.5 py-1 text-sm font-semibold tabular">{value > 0 ? '+' : ''}{value}%</span>
                </div>
                <input aria-label={label} type="range" min={-30} max={30} value={value} onChange={(e) => set(Number(e.target.value))} className="mt-4 w-full accent-[var(--foreground)]" />
                <div className="mt-1 flex justify-between text-[11px] text-faint"><span>-30%</span><span>no change</span><span>+30%</span></div>
              </div>
            ))}
          </div>
        </Card>
        <Card strong className="p-5">
          <SectionHeader title="Impact on profit" subtitle="Scenario vs actual, last 12 months" />
          <div className="grid grid-cols-2 gap-3">
            <Box label="Actual profit" value={compact(baseProfit, unit)} />
            <Box label="Scenario profit" value={compact(sProfit, unit)} tone={sProfit >= baseProfit ? 'good' : 'bad'} />
            <Box label="Actual margin" value={base.revenue ? `${((baseProfit / base.revenue) * 100).toFixed(1)}%` : 'n/a'} />
            <Box label="Scenario margin" value={sRev ? `${((sProfit / sRev) * 100).toFixed(1)}%` : 'n/a'} tone={sRev && base.revenue && sProfit / sRev >= baseProfit / base.revenue ? 'good' : 'bad'} />
          </div>
          <div className="mt-6 h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={[{ name: 'Revenue', actual: base.revenue, scenario: sRev }, { name: 'Expenses', actual: base.expenses, scenario: sExp }, { name: 'Profit', actual: baseProfit, scenario: sProfit }]}>
                <XAxis dataKey="name" {...axis} />
                <YAxis hide />
                <Tooltip content={<ChartTooltip format={(v: number) => amount(v, unit)} />} cursor={{ fill: 'rgb(var(--tint-rgb) / 0.04)' }} />
                <Bar dataKey="actual" name="Actual" fill="var(--chart-5)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="scenario" name="Scenario" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-3 text-center text-xs text-muted-foreground">Simple arithmetic on actual totals, not a prediction.</p>
        </Card>
      </div>
    </div>
  )
}

function Box({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'bad' }) {
  return (
    <div className={`rounded-xl p-4 ${tone === 'good' ? 'bg-good-soft' : tone === 'bad' ? 'bg-bad-soft' : 'bg-tint/[0.04]'}`}>
      <p className={`text-xs ${tone === 'good' ? 'text-good' : tone === 'bad' ? 'text-bad' : 'text-muted-foreground'}`}>{label}</p>
      <p className={`mt-2 text-xl font-semibold tabular ${tone === 'good' ? 'text-good' : tone === 'bad' ? 'text-bad' : ''}`}>{value}</p>
    </div>
  )
}

export function Reports() {
  const { company, data } = useWorkspace()
  if (!company || !data) return null
  const items: [string, string, () => void][] = [
    ['Monthly performance', 'Revenue, expenses, profit and margin per month', () => download(`${company.name} monthly.csv`, toCsv(data.rows.map(flatRow)))],
    ['Quarterly summary', 'Months summed into quarters, partial quarters marked', () => download(`${company.name} quarterly.csv`, toCsv(aggregate(data.rows, 'quarter').map(flatRow)))],
    ['Raw KPI rows', 'Exactly as stored in the kpis table', () => download(`${company.name} kpis.csv`, toCsv(data.kpis as any))],
  ]
  return (
    <div className="flex flex-col gap-6">
      <PageTitle title="Reports & exports" subtitle={<>Download {company.name}'s data as CSV, or print the current page.</>} action={<button type="button" className="button-secondary" onClick={() => window.print()}><Printer className="size-3.5" /> Print</button>} />
      <div className="grid gap-4 md:grid-cols-2">
        {items.map(([title, text, run]) => (
          <Card key={title} className="p-5">
            <div className="flex size-10 items-center justify-center rounded-xl bg-tint/[0.06] text-muted-foreground"><FileText className="size-4" /></div>
            <h2 className="mt-5 font-semibold">{title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{text}</p>
            <button type="button" onClick={run} className="button-secondary mt-5"><Download className="size-3.5" /> Download CSV</button>
          </Card>
        ))}
      </div>
    </div>
  )
}

export function SettingsPage() {
  const { session, companies, units, can } = useWorkspace()
  const abilities: [Action, string][] = [
    ['data:view', 'View dashboards, financials, analytics and the portfolio'],
    ['ai:ask', 'Ask the AI analyst'],
    ['forecast:run', 'Run forecasts'],
    ['scenario:use', 'Use the scenario simulator'],
    ['report:export', 'Download reports and CSV exports'],
    ['company:create', 'Create companies'],
    ['company:update', 'Edit company details'],
    ['company:delete', 'Delete companies'],
    ['kpi:create', 'Add KPI records and import CSV files'],
    ['kpi:update', 'Edit KPI values'],
    ['kpi:delete', 'Delete KPI records'],
  ]
  return (
    <div className="flex flex-col gap-6">
      <PageTitle title="Workspace settings" subtitle="Your account and the backend this app talks to." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <SectionHeader title="Account" />
          <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-3 text-sm">
            <dt className="text-muted-foreground">Email</dt><dd>{session.email}</dd>
            <dt className="text-muted-foreground">Role</dt><dd><RoleBadge role={session.role} /> <span className="ml-1 text-xs text-faint">from GET /auth/me</span></dd>
            <dt className="text-muted-foreground">Session</dt><dd>JWT, kept in this browser tab only</dd>
          </dl>
          <h3 className="mt-6 text-xs font-semibold uppercase tracking-wide text-muted-foreground">What your role can do</h3>
          <ul className="mt-3 grid gap-1.5 text-sm">
            {abilities.map(([action, label]) => (
              <li key={action} className={`flex items-center gap-2 ${can(action) ? '' : 'text-faint'}`}>
                {can(action) ? <Check className="size-3.5 text-good" /> : <Minus className="size-3.5" />}
                {label}
                <span className="sr-only">{can(action) ? '(allowed)' : '(not allowed)'}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-muted-foreground">Roles are assigned in the backend. Public sign-up always creates a Viewer.</p>
        </Card>
        <Card className="p-5">
          <SectionHeader title="Backend" />
          <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-3 text-sm">
            <dt className="text-muted-foreground">API</dt><dd className="font-mono text-xs">/api → http://localhost:8000</dd>
            <dt className="text-muted-foreground">Companies</dt><dd>{companies?.length ?? 'n/a'}</dd>
            <dt className="text-muted-foreground">Currencies known</dt>
            <dd>{Object.keys(units).length ? Object.entries(units).map(([id, u]) => `${companies?.find((c) => c.id === Number(id))?.name ?? id}: ${u}`).join(' · ') : 'none yet'}</dd>
          </dl>
        </Card>
      </div>
      <Card className="flex items-start gap-3 p-5">
        <Building2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <p className="text-sm leading-6 text-muted-foreground">
          The backend checks every request against your role. This app only hides buttons your role can't use; it never decides permissions itself.
        </p>
      </Card>
    </div>
  )
}
