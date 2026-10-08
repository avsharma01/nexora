'use client'

import { useEffect, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ArrowUpRight, Info, Plus } from 'lucide-react'
import { ApiError, companyKpis, createCompany, describeError } from '@/lib/nexora/api'
import { monthly, trailingYear, type MonthRow } from '@/lib/nexora/data'
import { compact, monthLabel, pct } from '@/lib/nexora/format'
import { AccessRestricted, axis, Badge, BrowserCalcBadge, Card, ChartTooltip, ErrorBox, Notice, PageTitle, SectionHeader } from '../ui'
import { useWorkspace } from '../workspace'
import { NewCompanyForm } from './company'

interface Row {
  id: number
  name: string
  industry: string | null
  months: number
  last: MonthRow | undefined
  growth: number | null
}

export function Portfolio() {
  const { companies, session, units, company, selectCompany, go, expired, can, reloadCompanies, dataVersion } = useWorkspace()
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  // #company/new opens the form directly; a role without company:create sees "Access restricted".
  const [creating, setCreating] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ tone: 'good' | 'bad'; text: string } | null>(null)

  useEffect(() => {
    const sync = () => setCreating(window.location.hash === '#company/new')
    sync()
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [])
  const open = (on: boolean) => {
    history.replaceState(null, '', on ? '#company/new' : location.pathname + location.search)
    setCreating(on)
    setMsg(null)
  }

  async function create(v: { name: string; industry: string; description: string }) {
    setBusy(true)
    setMsg(null)
    try {
      const c = await createCompany({ name: v.name.trim(), industry: v.industry.trim() || null, description: v.description.trim() || null }, session.token)
      await reloadCompanies(c.id)
      open(false)
      setMsg({ tone: 'good', text: `${c.name} created. Add its KPI records on the Company page.` })
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return expired()
      setMsg({ tone: 'bad', text: describeError(err, { conflict: 'A company with that name already exists.' }) })
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (!companies) return
    let alive = true
    Promise.all(
      companies.map(async (c) => {
        const m = monthly(await companyKpis(c.id, session.token))
        return { id: c.id, name: c.name, industry: c.industry, months: m.length, last: m.at(-1), growth: trailingYear(m, 'revenue').change }
      }),
    )
      .then((r) => alive && setRows(r))
      .catch((err) => {
        if (!alive) return
        if (err instanceof ApiError && err.status === 401) return expired()
        setError(describeError(err))
      })
    return () => { alive = false }
  }, [companies, session.token, expired, dataVersion])

  const status = (r: Row) =>
    r.last?.margin == null ? ['No data', 'gray'] : r.last.margin < 0 ? ['Loss', 'bad'] : r.growth !== null && r.growth < 0 ? ['Watch', 'warn'] : ['Healthy', 'good']

  return (
    <div className="flex flex-col gap-6">
      <PageTitle
        title="Company portfolio"
        subtitle="Every company in the NEXORA database, side by side."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <BrowserCalcBadge />
            {can('company:create') && !creating && (
              <button type="button" className="button-primary" onClick={() => open(true)}><Plus className="size-3.5" /> New company</button>
            )}
          </div>
        }
      />
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      {creating && !can('company:create') && <AccessRestricted what="create companies" onBack={() => open(false)} />}
      {creating && can('company:create') && <NewCompanyForm busy={busy} onSave={create} onCancel={() => open(false)} />}
      {error && <ErrorBox message={error} />}
      <p className="text-xs text-muted-foreground">
        Status rule (calculated here, not a backend score): <span className="font-medium text-foreground/80">Loss</span> = latest month's profit is negative ·{' '}
        <span className="font-medium text-foreground/80">Watch</span> = revenue down over the last 12 months · <span className="font-medium text-foreground/80">Healthy</span> = neither.
      </p>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {(rows ?? Array.from({ length: companies?.length ?? 3 }, () => null)).map((r, i) =>
          r ? (
            <Card key={r.id} className={`p-5 transition ${r.id === company?.id ? 'ring-1 ring-tint/20' : ''}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{r.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{r.industry ?? 'Industry not set'}</p>
                </div>
                <Badge tone={status(r)[1] as any}>{status(r)[0]}</Badge>
              </div>
              <div className="mt-5 grid grid-cols-3 gap-3">
                <Metric label="Revenue" value={compact(r.last?.revenue, units[r.id])} />
                <Metric label="Margin" value={r.last?.margin == null ? 'n/a' : `${r.last.margin.toFixed(1)}%`} tone={r.last?.margin != null && r.last.margin < 0 ? 'bad' : undefined} />
                <Metric label="12M growth" value={pct(r.growth)} tone={r.growth === null ? undefined : r.growth >= 0 ? 'good' : 'bad'} />
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-[11px] text-faint">
                <span>{r.months} months · latest {monthLabel(r.last?.date)}{units[r.id] ? ` · ${units[r.id]}` : ''}</span>
                <button type="button" onClick={() => { selectCompany(r.id); go('Dashboard') }} className="inline-flex items-center gap-1 font-semibold text-foreground/80 hover:text-foreground">
                  Open <ArrowUpRight className="size-3" />
                </button>
              </div>
            </Card>
          ) : (
            <Card key={i} className="space-y-4 p-5"><div className="skeleton h-5 w-40" /><div className="skeleton h-10 w-full" /></Card>
          ),
        )}
      </div>

      {rows && (
        <div className="grid gap-6 xl:grid-cols-2">
          <Card className="p-5">
            <SectionHeader title="Profit margin, latest month" subtitle="A percentage, so companies in different currencies compare fairly" />
            <ChartBars data={rows.map((r) => ({ name: r.name, value: r.last?.margin ?? null }))} />
          </Card>
          <Card className="p-5">
            <SectionHeader title="Revenue growth, last 12 months" subtitle="Against the 12 months before" />
            <ChartBars data={rows.map((r) => ({ name: r.name, value: r.growth }))} />
          </Card>
        </div>
      )}

      <Card className="flex items-start gap-3 p-5">
        <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <p className="text-sm leading-6 text-muted-foreground">
          Amounts stay in each company's own currency and are never added together. A currency code appears once the analyst has answered a question
          about that company, because the KPI API does not return units.
        </p>
      </Card>
    </div>
  )
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'bad' }) {
  return (
    <div>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className={`mt-1 text-base font-semibold tabular ${tone === 'good' ? 'text-good' : tone === 'bad' ? 'text-bad' : ''}`}>{value}</p>
    </div>
  )
}

function ChartBars({ data }: { data: { name: string; value: number | null }[] }) {
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
          <CartesianGrid horizontal={false} stroke="var(--border)" />
          <XAxis type="number" {...axis} tickFormatter={(v) => `${v.toFixed(0)}%`} />
          <YAxis type="category" dataKey="name" {...axis} width={130} />
          <Tooltip content={<ChartTooltip format={(v: number) => `${v.toFixed(1)}%`} />} cursor={{ fill: 'rgb(var(--tint-rgb) / 0.04)' }} />
          <ReferenceLine x={0} stroke="rgb(var(--tint-rgb) / 0.2)" />
          <Bar dataKey="value" name="Value" radius={4} barSize={14}>
            {data.map((d) => <Cell key={d.name} fill={d.value !== null && d.value < 0 ? 'var(--bad)' : 'var(--chart-1)'} fillOpacity={0.85} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
