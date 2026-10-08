'use client'

import { useState } from 'react'
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Activity, AlertTriangle, TrendingDown, TrendingUp } from 'lucide-react'
import { change, extreme, type MonthRow } from '@/lib/nexora/data'
import { amount, compact, monthLabel, pct } from '@/lib/nexora/format'
import { axis, Card, ChartTooltip, PageTitle, SectionHeader } from '../ui'
import { useWorkspace } from '../workspace'

type Key = 'revenue' | 'expenses' | 'profit' | 'margin'
const CHARTS: [Key, string, string][] = [
  ['revenue', 'Revenue', 'var(--chart-1)'],
  ['expenses', 'Expenses', 'var(--chart-4)'],
  ['profit', 'Profit', 'var(--good)'],
  ['margin', 'Profit margin', 'var(--chart-1)'],
]
const RANGES = [6, 12, 24, 0] as const

export function AnalyticsPage() {
  const { company, data, unit } = useWorkspace()
  const [range, setRange] = useState<(typeof RANGES)[number]>(12)
  if (!company || !data) return null
  const rows = range ? data.rows.slice(-range) : data.rows

  return (
    <div className="flex flex-col gap-6">
      <PageTitle title="Business analytics" subtitle={<>How {company.name}'s numbers moved over time. Every signal below is computed from its KPIs.</>} />
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-xs text-muted-foreground">Time period</span>
        {RANGES.map((r) => (
          <button key={r} type="button" onClick={() => setRange(r)} className={range === r ? 'filter-active' : 'filter-button'}>{r ? `Last ${r} months` : 'All data'}</button>
        ))}
        <span className="ml-auto text-xs text-faint">{monthLabel(rows[0]?.date)} to {monthLabel(rows.at(-1)?.date)}</span>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {CHARTS.map(([key, title, color]) => <MiniChart key={key} rows={rows} k={key} title={title} color={color} unit={unit} />)}
      </div>

      <Card className="p-5">
        <SectionHeader title="Key trends" subtitle="Signals detected in the selected period" />
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{signals(rows, unit).map((s) => <Trend key={s.title} {...s} />)}</div>
      </Card>
    </div>
  )
}

function MiniChart({ rows, k, title, color, unit }: { rows: MonthRow[]; k: Key; title: string; color: string; unit: string | null }) {
  const first = rows.find((r) => r[k] !== null)?.[k] ?? null
  const last = rows.at(-1)?.[k] ?? null
  const isPct = k === 'margin'
  const move = isPct ? (first !== null && last !== null ? last - first : null) : change(first, last)
  const fmt = (v: number) => (isPct ? `${v.toFixed(1)}%` : amount(v, unit))
  return (
    <Card className="p-5">
      <SectionHeader
        title={title}
        subtitle={last === null ? 'n/a' : `Latest ${isPct ? `${last.toFixed(1)}%` : compact(last, unit)}`}
        action={
          <span className={`text-xs font-semibold tabular ${move === null ? 'text-faint' : (move >= 0) !== (k === 'expenses') ? 'text-good' : 'text-bad'}`}>
            {move === null ? 'n/a' : isPct ? `${move >= 0 ? '+' : ''}${move.toFixed(1)} pts` : pct(move)} <span className="font-normal text-faint">over the period</span>
          </span>
        }
      />
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ left: 0, right: 4 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="month" {...axis} tickFormatter={(m) => monthLabel(`${m}-01`).replace(' 20', " '")} minTickGap={28} />
            <YAxis {...axis} width={isPct ? 40 : 56} tickFormatter={(v) => (isPct ? `${v.toFixed(0)}%` : compact(v, unit))} />
            <Tooltip content={<ChartTooltip format={fmt} />} cursor={{ stroke: 'rgb(var(--tint-rgb) / 0.15)' }} />
            <ReferenceLine y={0} stroke="rgb(var(--tint-rgb) / 0.15)" />
            <Line type="monotone" dataKey={k} name={title} stroke={color} strokeWidth={2.25} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}

interface Signal { title: string; text: string; icon: any; tone: 'good' | 'bad' | 'warn' | 'gray' }

function signals(rows: MonthRow[], unit: string | null): Signal[] {
  const out: Signal[] = []
  const first = rows[0]
  const last = rows.at(-1)
  if (!first || !last || rows.length < 2) return [{ title: 'Not enough data', text: 'At least two months are needed to see a trend.', icon: Activity, tone: 'gray' }]
  const span = `${monthLabel(first.date)} to ${monthLabel(last.date)}`

  const rev = change(first.revenue, last.revenue)
  if (rev !== null) out.push({ title: `Revenue ${rev >= 0 ? 'up' : 'down'} ${pct(Math.abs(rev), false)}`, text: `From ${amount(first.revenue, unit)} to ${amount(last.revenue, unit)}, ${span}.`, icon: rev >= 0 ? TrendingUp : TrendingDown, tone: rev >= 0 ? 'good' : 'bad' })

  const exp = change(first.expenses, last.expenses)
  if (rev !== null && exp !== null) {
    const faster = exp > rev
    out.push({ title: faster ? 'Costs grew faster than revenue' : 'Revenue outpaced costs', text: `Expenses ${pct(exp)} vs revenue ${pct(rev)} over the same months.`, icon: Activity, tone: faster ? 'warn' : 'good' })
  }

  const losses = rows.filter((r) => r.profit !== null && r.profit < 0)
  if (losses.length) out.push({ title: `${losses.length} loss-making month${losses.length > 1 ? 's' : ''}`, text: `Most recent: ${monthLabel(losses.at(-1)!.date)}, profit ${amount(losses.at(-1)!.profit, unit)}.`, icon: AlertTriangle, tone: 'bad' })
  else out.push({ title: 'Profitable every month', text: `No month in ${span} had a loss.`, icon: TrendingUp, tone: 'good' })

  let streak = 0
  for (let i = rows.length - 1; i > 0 && rows[i].revenue !== null && rows[i - 1].revenue !== null && rows[i].revenue! > rows[i - 1].revenue!; i--) streak++
  const best = extreme(rows, 'revenue', 'max')
  out.push(
    streak >= 2
      ? { title: `Revenue up ${streak} months in a row`, text: `Each month since ${monthLabel(rows[rows.length - 1 - streak].date)} beat the one before.`, icon: TrendingUp, tone: 'good' }
      : { title: 'Peak revenue month', text: best ? `${monthLabel(best.date)}: ${amount(best.revenue, unit)}.` : 'n/a', icon: Activity, tone: 'gray' },
  )
  return out
}

function Trend({ title, text, icon: Icon, tone }: Signal) {
  const cls = tone === 'good' ? 'bg-good-soft text-good' : tone === 'bad' ? 'bg-bad-soft text-bad' : tone === 'warn' ? 'bg-warn-soft text-warn' : 'bg-tint/[0.06] text-muted-foreground'
  return (
    <div className="rounded-xl border border-border bg-tint/[0.02] p-4">
      <div className={`mb-4 flex size-9 items-center justify-center rounded-lg ${cls}`}><Icon className="size-4" /></div>
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{text}</p>
    </div>
  )
}
