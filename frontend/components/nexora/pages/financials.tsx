'use client'

import { useState } from 'react'
import { Bar, CartesianGrid, ComposedChart, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Download } from 'lucide-react'
import { aggregate, change, download, flatRow, toCsv, type Grain } from '@/lib/nexora/data'
import { AGG_HINT, metricInfo } from '@/lib/nexora/metrics'
import { amount, compact } from '@/lib/nexora/format'
import { axis, Badge, Card, ChartTooltip, Delta, PageTitle, SectionHeader } from '../ui'
import { useWorkspace } from '../workspace'

const GRAINS: [Grain, string][] = [['month', 'Monthly'], ['quarter', 'Quarterly'], ['year', 'Yearly']]
const FULL: Record<Grain, number> = { month: 1, quarter: 3, year: 12 }

export function Financials() {
  const { company, data, unit, can } = useWorkspace()
  const [grain, setGrain] = useState<Grain>('quarter')
  if (!company || !data) return null

  const all = aggregate(data.rows, grain)
  const periods = grain === 'month' ? all.slice(-12) : all
  const complete = all.filter((p) => p.months === FULL[grain])
  const cur = complete.at(-1)
  const prev = complete.at(-2)
  const prevLabel = prev ? `vs ${prev.label}` : undefined

  const cards: [string, number | null, number | null, boolean?][] = [
    ['Revenue', cur?.revenue ?? null, change(prev?.revenue, cur?.revenue)],
    ['Expenses', cur?.expenses ?? null, change(prev?.expenses, cur?.expenses), true],
    ['Profit', cur?.profit ?? null, change(prev?.profit, cur?.profit)],
  ]

  return (
    <div className="flex flex-col gap-6">
      <PageTitle
        title="Financial performance"
        subtitle={<>Revenue, costs and margins for {company.name}{data.extras.length ? `, plus ${data.extras.length} more metrics` : ''}, built from the monthly KPIs.</>}
        action={
          can('report:export') && (
            <button type="button" className="button-secondary" onClick={() => download(`${company.name} ${grain}ly.csv`, toCsv(all.map(flatRow)))}>
              <Download className="size-3.5" /> Export CSV
            </button>
          )
        }
      />
      <div className="flex flex-wrap items-center gap-2">
        {GRAINS.map(([g, label]) => (
          <button key={g} type="button" onClick={() => setGrain(g)} className={grain === g ? 'filter-active' : 'filter-button'}>{label}</button>
        ))}
        <span className="ml-auto text-xs text-faint">Cards show the latest complete {grain}{cur ? `: ${cur.label}` : ''}</span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(([label, value, delta, inverse]) => (
          <Card key={label} className="p-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-2 text-xl font-semibold tabular">{compact(value, unit)}</p>
            <p className="mt-1"><Delta value={delta} inverse={inverse} suffix={prevLabel} /></p>
          </Card>
        ))}
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Profit margin</p>
          <p className="mt-2 text-xl font-semibold tabular">{cur?.margin === null || !cur ? 'n/a' : `${cur.margin.toFixed(1)}%`}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {cur?.margin != null && prev?.margin != null ? `${cur.margin - prev.margin >= 0 ? '+' : ''}${(cur.margin - prev.margin).toFixed(1)} pts ${prevLabel}` : 'no comparison'}
          </p>
        </Card>
      </div>

      {data.extras.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {data.extras.map((m) => {
            const info = metricInfo(m)
            const v = cur?.extras[m] ?? null
            return (
              <Card key={m} className="p-4">
                <p className="text-xs text-muted-foreground">{info.label} <span className="text-faint">· {grain === 'month' ? 'month' : AGG_HINT[info.agg]}</span></p>
                <p className="mt-2 text-xl font-semibold tabular">{compact(v, info.money ? unit : null)}</p>
                <p className="mt-1"><Delta value={change(prev?.extras[m], v)} inverse={!info.higherIsBetter} suffix={prevLabel} /></p>
              </Card>
            )
          })}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <Card className="p-5">
          <SectionHeader title="Revenue vs expenses" subtitle={`${GRAINS.find(([g]) => g === grain)![1]}${grain === 'month' ? ', last 12 months' : ''}${unit ? ` · ${unit}` : ''}`} />
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={periods} margin={{ left: 4, right: 8 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="label" {...axis} minTickGap={12} />
                <YAxis {...axis} width={64} tickFormatter={(v) => compact(v, unit)} />
                <Tooltip content={<ChartTooltip format={(v: number) => amount(v, unit)} />} cursor={{ fill: 'rgb(var(--tint-rgb) / 0.04)' }} />
                <ReferenceLine y={0} stroke="rgb(var(--tint-rgb) / 0.18)" />
                <Bar dataKey="revenue" name="Revenue" fill="var(--chart-1)" fillOpacity={0.85} radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" name="Expenses" fill="var(--chart-5)" radius={[4, 4, 0, 0]} />
                <Line dataKey="profit" name="Profit" stroke="var(--good)" strokeWidth={2.25} dot={{ r: 2.5, fill: 'var(--good)' }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="p-5">
          <SectionHeader title="Profit margin" subtitle="Profit as a share of revenue" />
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={periods} margin={{ left: 4, right: 8 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="label" {...axis} minTickGap={12} />
                <YAxis {...axis} width={44} tickFormatter={(v) => `${v.toFixed(0)}%`} />
                <Tooltip content={<ChartTooltip format={(v: number) => `${v.toFixed(1)}%`} />} cursor={{ stroke: 'rgb(var(--tint-rgb) / 0.15)' }} />
                <ReferenceLine y={0} stroke="rgb(var(--tint-rgb) / 0.18)" />
                <Line dataKey="margin" name="Margin" stroke="var(--chart-1)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-border p-5">
          <div>
            <h2 className="text-[15px] font-semibold">Financial records</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Every {grain} in the data, newest first.
              {data.extras.length > 0 && grain !== 'month' && ' Other metrics combine months by type: totals for flows (orders), end-of-period for counts (customers), averages for rates.'}
            </p>
          </div>
        </div>
        <div className="max-h-[480px] overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-popover/95 text-xs text-muted-foreground backdrop-blur">
              <tr>
                {['Period', 'Revenue', 'Expenses', 'Profit', 'Margin'].map((h) => <th key={h} className="whitespace-nowrap px-5 py-3 font-medium">{h}</th>)}
                {data.extras.map((m) => {
                  const info = metricInfo(m)
                  return (
                    <th key={m} className="whitespace-nowrap px-5 py-3 font-medium">
                      {info.label}{grain !== 'month' && <span className="ml-1 font-normal text-faint">({AGG_HINT[info.agg]})</span>}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {[...all].reverse().map((r) => (
                <tr key={r.period} className="border-t border-border/70 transition hover:bg-tint/[0.025]">
                  <td className="px-5 py-3 font-medium">
                    {r.label}
                    {r.months < FULL[grain] && <span className="ml-2"><Badge tone="warn">partial · {r.months} mo</Badge></span>}
                  </td>
                  <td className="px-5 py-3 tabular">{amount(r.revenue, unit)}</td>
                  <td className="px-5 py-3 tabular text-muted-foreground">{amount(r.expenses, unit)}</td>
                  <td className={`px-5 py-3 tabular ${r.profit !== null && r.profit < 0 ? 'text-bad' : ''}`}>{amount(r.profit, unit)}</td>
                  <td className={`px-5 py-3 tabular ${r.margin !== null && r.margin < 0 ? 'text-bad' : 'text-good'}`}>{r.margin === null ? 'n/a' : `${r.margin.toFixed(1)}%`}</td>
                  {data.extras.map((m) => (
                    <td key={m} className="whitespace-nowrap px-5 py-3 tabular text-muted-foreground">{amount(r.extras[m], metricInfo(m).money ? unit : null)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
