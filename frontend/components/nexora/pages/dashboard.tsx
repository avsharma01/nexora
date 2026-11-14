'use client'

import { useMemo, useState } from 'react'
import { Area, AreaChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Activity, ArrowUpRight, Bot, Building2, CircleDollarSign, Download, Gauge, Sparkles, TrendingDown, TrendingUp, Trophy } from 'lucide-react'
import { ApiError, askAnalyst, type AiResponse } from '@/lib/nexora/api'
import { change, download, extreme, flatRow, latestTwo, toCsv, trailingYear } from '@/lib/nexora/data'
import { metricInfo } from '@/lib/nexora/metrics'
import { amount, compact, monthLabel, pct, titleCase } from '@/lib/nexora/format'
import { axis, Card, ChartTooltip, Delta, ErrorBox, PageTitle, SectionHeader, Sparkline } from '../ui'
import { useWorkspace } from '../workspace'
import { AnswerText, currencyOf, errorText } from './analyst'

// Dashboard summaries survive page switches, per company.
// Keyed by company + data version: any KPI edit invalidates the old summary.
const insightCache = new Map<string, AiResponse>()

export function Dashboard() {
  const { session, company, data, unit, go, companies, selectCompany, learnUnit, expired, dataVersion, can } = useWorkspace()
  const [range, setRange] = useState<12 | 24 | 0>(24)
  const [insight, setInsight] = useState<AiResponse | null>(() => (company ? insightCache.get(`${company.id}:${dataVersion}`) ?? null : null))
  const [insightBusy, setInsightBusy] = useState(false)
  const [insightError, setInsightError] = useState<string | null>(null)

  const rows = data?.rows ?? []
  const shown = range ? rows.slice(-range) : rows
  const last = rows.at(-1)
  const prev = rows.at(-2)
  const byName = useMemo(() => new Map((data?.analytics ?? []).map((m) => [m.metric_name.trim().toLowerCase(), m])), [data])

  if (!company || !data) return null
  const cid = company.id

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const name = titleCase(session.email.split('@')[0].replace(/[._]/g, ' '))

  const ty = { revenue: trailingYear(rows, 'revenue'), expenses: trailingYear(rows, 'expenses') }
  const best = extreme(rows, 'revenue', 'max')
  const worst = extreme(rows, 'profit', 'min')

  async function summarise() {
    setInsightBusy(true)
    setInsightError(null)
    try {
      const res = await askAnalyst(cid, 'How is the company doing?', [], session.token)
      insightCache.set(`${cid}:${dataVersion}`, res)
      const cur = currencyOf(res)
      if (cur) learnUnit(cid, cur)
      setInsight(res)
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return expired()
      setInsightError(errorText(err))
    } finally {
      setInsightBusy(false)
    }
  }

  const kpi = (metric: 'revenue' | 'expenses' | 'profit') => {
    const a = byName.get(metric)
    return { value: a?.latest_value ?? last?.[metric] ?? null, change: a?.comparison_available ? a.change_percentage : change(prev?.[metric], last?.[metric]) }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageTitle
        eyebrow={<p className="text-sm text-muted-foreground">{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>}
        title={`${greeting}, ${name}`}
        subtitle={<>Here is <span className="text-foreground">{company.name}</span> up to {monthLabel(last?.date)}.</>}
        action={
          <div className="flex gap-2">
            {can('report:export') && (
              <button type="button" className="button-secondary" onClick={() => download(`${company.name} monthly.csv`, toCsv(rows.map(flatRow)))}>
                <Download className="size-3.5" /> Export CSV
              </button>
            )}
            {can('ai:ask') && (
              <button type="button" className="button-primary" onClick={() => go('AI Analyst')}>
                <Bot className="size-3.5" /> Ask the analyst
              </button>
            )}
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard icon={CircleDollarSign} label="Revenue" value={compact(kpi('revenue').value, unit)} delta={kpi('revenue').change} spark={rows.slice(-12).map((r) => r.revenue)} />
        <KpiCard icon={Activity} label="Expenses" value={compact(kpi('expenses').value, unit)} delta={kpi('expenses').change} inverse spark={rows.slice(-12).map((r) => r.expenses)} />
        <KpiCard icon={TrendingUp} label="Profit" value={compact(kpi('profit').value, unit)} delta={kpi('profit').change} spark={rows.slice(-12).map((r) => r.profit)} accent />
        <KpiCard icon={Gauge} label="Profit margin" value={last?.margin === null || !last ? 'n/a' : `${last.margin.toFixed(1)}%`} delta={last?.margin !== null && prev?.margin !== null && last && prev ? (last.margin! - prev.margin!) : null} deltaIsPoints spark={rows.slice(-12).map((r) => r.margin)} />
      </div>

      {data.extras.length > 0 && (
        <div className="flex flex-col gap-3">
          <SectionHeader
            title="More metrics"
            subtitle={`${data.extras.length} more ${data.extras.length === 1 ? 'metric' : 'metrics'} from this company's data · each tile: latest month vs the one before`}
          />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {data.extras.map((m) => {
              const info = metricInfo(m)
              const { last: v, prev: p } = latestTwo(rows, m)
              return (
                <KpiCard
                  key={m}
                  icon={info.money ? CircleDollarSign : info.agg === 'average' ? Gauge : Activity}
                  label={info.label}
                  value={v !== null && Math.abs(v) < 10_000 ? amount(v, info.money ? unit : null) : compact(v, info.money ? unit : null)}
                  delta={change(p, v)}
                  inverse={!info.higherIsBetter}
                  spark={rows.slice(-12).map((r) => r.extras[m] ?? null)}
                />
              )
            })}
          </div>
        </div>
      )}

      <div className={`grid gap-6 ${can('ai:ask') ? 'xl:grid-cols-[1.6fr_1fr]' : ''}`}>
        <Card className="p-5">
          <SectionHeader
            title="Revenue, expenses and profit"
            subtitle={`Monthly, ${shown.length} months${unit ? ` · ${unit}` : ''}`}
            action={
              <div className="flex gap-1">
                {([12, 24, 0] as const).map((r) => (
                  <button key={r} type="button" onClick={() => setRange(r)} className={range === r ? 'filter-active py-1.5' : 'filter-button py-1.5'}>{r ? `${r}M` : 'All'}</button>
                ))}
              </div>
            }
          />
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={shown} margin={{ left: 4, right: 8 }}>
                <defs>
                  <linearGradient id="profitFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--good)" stopOpacity={0.22} />
                    <stop offset="100%" stopColor="var(--good)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#fff" stopOpacity={0.08} />
                    <stop offset="100%" stopColor="#fff" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="month" {...axis} tickFormatter={(m) => monthLabel(`${m}-01`).replace(' 20', " '")} minTickGap={24} />
                <YAxis {...axis} width={64} tickFormatter={(v) => compact(v, unit)} />
                <Tooltip content={<ChartTooltip format={(v: number) => amount(v, unit)} />} cursor={{ stroke: 'rgb(var(--tint-rgb) / 0.15)' }} />
                <Area type="monotone" dataKey="revenue" name="Revenue" stroke="var(--chart-1)" fill="url(#revFill)" strokeWidth={2} />
                <Line type="monotone" dataKey="expenses" name="Expenses" stroke="var(--chart-2)" strokeDasharray="5 4" strokeWidth={1.75} dot={false} />
                <Area type="monotone" dataKey="profit" name="Profit" stroke="var(--good)" fill="url(#profitFill)" strokeWidth={2.25} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex gap-5 text-xs text-muted-foreground">
            <span className="flex items-center gap-2"><i className="h-0.5 w-4 rounded bg-[var(--chart-1)]" />Revenue</span>
            <span className="flex items-center gap-2"><i className="h-0.5 w-4 rounded border-t border-dashed border-[var(--chart-2)]" />Expenses</span>
            <span className="flex items-center gap-2"><i className="h-0.5 w-4 rounded bg-good" />Profit</span>
          </div>
        </Card>

        {can('ai:ask') && <Card strong className="flex flex-col p-5">
          <SectionHeader title="AI business insight" subtitle="From your analyst, grounded in this company's data" action={<span className="flex size-8 items-center justify-center rounded-lg bg-good-soft text-good"><Sparkles className="size-4" /></span>} />
          {insight ? (
            <div className="rise flex-1 space-y-3 text-sm leading-6">
              {insight.status === 'answered' ? (
                <AnswerText text={insight.answer} known={new Set(insight.sources.map((s) => s.id))} />
              ) : (
                <p className="text-muted-foreground">{insight.answer}</p>
              )}
              <p className={`text-[11px] ${insight.is_grounded ? 'text-good' : 'text-bad'}`}>
                {insight.is_grounded ? 'Every number checked against the data' : 'Numbers could not be verified'}
              </p>
            </div>
          ) : insightBusy ? (
            <div className="flex-1 space-y-2.5">
              <p className="text-xs text-muted-foreground">Asking the analyst…</p>
              <div className="skeleton h-4 w-[94%]" /><div className="skeleton h-4 w-[82%]" /><div className="skeleton h-4 w-[70%]" /><div className="skeleton h-4 w-[56%]" />
            </div>
          ) : (
            <div className="flex-1 space-y-3">
              <p className="text-sm leading-6 text-muted-foreground">
                Get a short summary of the latest month: values, changes and what moved, with every number checked against the KPIs.
              </p>
              {insightError && <ErrorBox message={insightError} />}
            </div>
          )}
          <div className="mt-4 flex gap-2">
            <button type="button" onClick={summarise} disabled={insightBusy} className={insight ? 'button-secondary flex-1 justify-center' : 'button-primary flex-1 justify-center'}>
              <Sparkles className="size-3.5" /> {insight ? 'Refresh' : 'Generate summary'}
            </button>
            <button type="button" onClick={() => go('AI Analyst')} className="button-secondary flex-1 justify-center">
              Open analyst <ArrowUpRight className="size-3.5" />
            </button>
          </div>
        </Card>}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <Card className="p-5">
          <SectionHeader title="Business growth" subtitle="Computed from the monthly KPIs" />
          <div className="grid grid-cols-2 gap-3">
            <MiniMetric icon={TrendingUp} label="Revenue, last 12 months" value={compact(ty.revenue.curr, unit)} detail={ty.revenue.change === null ? 'Needs 24 months of history' : `${pct(ty.revenue.change)} vs the 12 before`} tone={ty.revenue.change !== null && ty.revenue.change < 0 ? 'bad' : undefined} />
            <MiniMetric icon={Activity} label="Expenses, last 12 months" value={compact(ty.expenses.curr, unit)} detail={ty.expenses.change === null ? 'Needs 24 months of history' : `${pct(ty.expenses.change)} vs the 12 before`} tone={ty.expenses.change !== null && ty.expenses.change > 0 ? 'warn' : undefined} />
            <MiniMetric icon={Trophy} label="Best revenue month" value={best ? monthLabel(best.date) : 'n/a'} detail={best ? amount(best.revenue, unit) : ''} />
            <MiniMetric icon={TrendingDown} label="Weakest profit month" value={worst ? monthLabel(worst.date) : 'n/a'} detail={worst ? amount(worst.profit, unit) : ''} tone={worst && worst.profit! < 0 ? 'bad' : undefined} />
          </div>
        </Card>

        <Card className="p-5">
          <SectionHeader title="Companies in this workspace" subtitle="From the database" action={<button type="button" onClick={() => go('Portfolio')} className="button-ghost">Compare <ArrowUpRight className="size-3.5" /></button>} />
          <div className="flex flex-col gap-1">
            {(companies ?? []).map((c) => (
              <button key={c.id} type="button" onClick={() => selectCompany(c.id)} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${c.id === company.id ? 'bg-tint/[0.07]' : 'hover:bg-tint/[0.04]'}`}>
                <span className="flex size-8 items-center justify-center rounded-lg bg-tint/[0.06] text-muted-foreground"><Building2 className="size-4" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{c.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{c.industry ?? 'Industry not set'}</span>
                </span>
                {c.id === company.id && <span className="size-1.5 rounded-full bg-good" aria-label="Selected" />}
              </button>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}

function KpiCard({ icon: Icon, label, value, delta, inverse, spark, accent, deltaIsPoints }: any) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <span className="flex size-9 items-center justify-center rounded-xl bg-tint/[0.06] text-foreground/80"><Icon className="size-4" /></span>
        <Sparkline data={spark} accent={accent} />
      </div>
      <p className="mt-4 text-xs font-medium text-muted-foreground">{label}</p>
      <div className="mt-1 flex items-end justify-between gap-2">
        <p className="text-2xl font-semibold tracking-tight tabular">{value}</p>
        {deltaIsPoints ? (
          <span className={`mb-1 text-xs font-semibold tabular ${delta === null ? 'text-faint' : delta >= 0 ? 'text-good' : 'text-bad'}`}>
            {delta === null ? 'n/a' : `${delta >= 0 ? '+' : ''}${delta.toFixed(1)} pts`}
          </span>
        ) : (
          <span className="mb-1"><Delta value={delta} inverse={inverse} /></span>
        )}
      </div>
      <p className="mt-1 text-[11px] text-faint">latest month vs the month before</p>
    </Card>
  )
}

function MiniMetric({ label, value, detail, icon: Icon, tone }: any) {
  return (
    <div className="rounded-xl border border-border bg-tint/[0.02] p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{label}</p>
        <Icon className="size-3.5 text-faint" />
      </div>
      <p className={`mt-3 text-lg font-semibold tabular ${tone === 'bad' ? 'text-bad' : tone === 'warn' ? 'text-warn' : ''}`}>{value}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">{detail}</p>
    </div>
  )
}
