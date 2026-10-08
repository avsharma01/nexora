'use client'

import { useEffect, useState } from 'react'
import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Info, RotateCw, TriangleAlert } from 'lucide-react'
import { ApiError, companyForecast, describeError, type ForecastResponse } from '@/lib/nexora/api'
import { METRICS, type Metric } from '@/lib/nexora/data'
import { amount, compact, monthLabel, titleCase } from '@/lib/nexora/format'
import { axis, Badge, Card, ErrorBox, PageTitle, SectionHeader } from '../ui'
import { useWorkspace } from '../workspace'

const HORIZON = 6

type State = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready'; res: Partial<Record<Metric, ForecastResponse>> }

interface ChartRow {
  month: string
  actual: number | null
  estimate: number | null
  band: [number, number] | null // 95% interval, drawn as one shaded area
}

export function Forecast() {
  const { company, data, unit, session, expired } = useWorkspace()
  const [metric, setMetric] = useState<Metric>('revenue')
  const [state, setState] = useState<State>({ kind: 'loading' })
  const [nonce, setNonce] = useState(0)

  // The forecast endpoint matches metric names exactly, so send the name as stored ("revenue" or "Revenue").
  const stored = (m: Metric) => data?.kpis.find((k) => k.metric_name.trim().toLowerCase() === m)?.metric_name ?? m

  useEffect(() => {
    if (!company || !data) return
    let alive = true
    setState({ kind: 'loading' })
    Promise.all(METRICS.map((m) => companyForecast(company.id, stored(m), HORIZON, session.token).then((r) => [m, r] as const)))
      .then((pairs) => alive && setState({ kind: 'ready', res: Object.fromEntries(pairs) }))
      .catch((err) => {
        if (!alive) return
        if (err instanceof ApiError && err.status === 401) return expired()
        setState({ kind: 'error', message: describeError(err, { notFound: 'This company no longer exists.' }) })
      })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company?.id, data, nonce])

  if (!company || !data) return null

  const res = state.kind === 'ready' ? state.res[metric] : undefined
  const points = res?.forecasts ?? []
  const insufficient = res?.status === 'insufficient_data'
  // The old placeholder repeated the latest value; only warn if the backend still does that.
  const flat = points.length > 1 && points.every((p) => p.forecast_value === points[0].forecast_value && p.forecast_value === res?.historical_latest_value)

  const history: ChartRow[] = data.rows.slice(-18).map((r) => ({ month: r.month, actual: r[metric], estimate: null, band: null }))
  // Join the estimate line to the last actual point so the two read as one story.
  if (history.length && points.length) {
    const last = history[history.length - 1]
    last.estimate = last.actual
    last.band = last.actual === null ? null : [last.actual, last.actual]
  }
  const chart: ChartRow[] = [
    ...history,
    ...points.map((p) => ({ month: p.forecast_date.slice(0, 7), actual: null, estimate: p.forecast_value, band: [p.lower_bound, p.upper_bound] as [number, number] })),
  ]
  const lastActual = data.rows.at(-1)
  const end = points.at(-1)
  const ev = res?.evaluation ?? null

  return (
    <div className="flex flex-col gap-6">
      <PageTitle
        title="Growth forecast"
        subtitle={<>Live from <span className="font-mono text-foreground/80">POST /companies/{company.id}/forecast</span>, {HORIZON} months ahead.</>}
        action={<button type="button" className="button-secondary" onClick={() => setNonce((n) => n + 1)}><RotateCw className="size-3.5" /> Re-run</button>}
      />

      {flat && (
        <div className="flex items-start gap-3 rounded-2xl border border-warn/25 bg-warn-soft px-4 py-3 text-sm">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warn" />
          <div className="space-y-1">
            <p className="font-semibold text-warn">The forecast is flat</p>
            <p className="text-foreground/80">Every future month equals the latest actual value, so the backend is still returning a placeholder forecast.</p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {METRICS.map((m) => (
          <button key={m} type="button" onClick={() => setMetric(m)} className={metric === m ? 'filter-active' : 'filter-button'}>{titleCase(m)}</button>
        ))}
      </div>

      {state.kind === 'error' && <ErrorBox message={state.message} />}

      {insufficient ? (
        <Card className="flex items-start gap-3 p-5">
          <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <div className="space-y-1 text-sm leading-6">
            <p className="font-semibold">Not enough history to forecast {titleCase(metric).toLowerCase()}</p>
            <p className="text-muted-foreground">
              The model needs at least {res?.minimum_history} months of {titleCase(metric).toLowerCase()}; this company has {res?.history_points}.
              No estimate is shown rather than a guess.
            </p>
          </div>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Latest actual" value={compact(res?.historical_latest_value ?? lastActual?.[metric] ?? null, unit)} note={monthLabel(lastActual?.date)} />
            <Stat
              label={`Estimate, ${HORIZON} months out`}
              value={end ? compact(end.forecast_value, unit) : 'n/a'}
              note={end ? `${monthLabel(end.forecast_date)} · 95% range ${compact(end.lower_bound, unit)} to ${compact(end.upper_bound, unit)}` : ''}
            />
            <Stat label="Model" value={res?.model_name ?? 'n/a'} note={res ? `Trained on ${res.history_points} months` : ''} mono />
            <Stat
              label="Backtest accuracy"
              value={ev?.mape != null ? `${ev.mape.toFixed(1)}% MAPE` : 'n/a'}
              note={ev ? `MAE ${ev.mae != null ? compact(ev.mae, unit) : 'n/a'} over ${ev.backtest_points} past months` : 'Not enough history to backtest'}
            />
          </div>

          <Card className="p-5">
            <SectionHeader
              title={`${titleCase(metric)}: history and estimate`}
              subtitle="Solid line = actual KPIs. Dashed line = estimate. Shaded band = 95% range of the estimate."
              action={<Badge tone="warn">Estimate, not a fact</Badge>}
            />
            <div className="h-80">
              {state.kind === 'loading' ? (
                <div className="skeleton h-full w-full" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chart} margin={{ left: 4, right: 8 }}>
                    <CartesianGrid vertical={false} stroke="var(--border)" />
                    <XAxis dataKey="month" {...axis} tickFormatter={(m) => monthLabel(`${m}-01`).replace(' 20', " '")} minTickGap={24} />
                    <YAxis {...axis} width={64} tickFormatter={(v) => compact(v, unit)} domain={['auto', 'auto']} />
                    <Tooltip content={<ForecastTooltip unit={unit} />} cursor={{ stroke: 'rgb(var(--tint-rgb) / 0.15)' }} />
                    {lastActual && <ReferenceLine x={lastActual.month} stroke="rgb(var(--tint-rgb) / 0.2)" strokeDasharray="3 3" label={{ value: 'latest actual', fill: 'var(--faint)', fontSize: 11, position: 'insideTopLeft' }} />}
                    <Area dataKey="band" name="95% range" stroke="none" fill="var(--good)" fillOpacity={0.14} isAnimationActive={false} connectNulls={false} />
                    <Line dataKey="actual" name="Actual" stroke="var(--chart-1)" strokeWidth={2.25} dot={false} connectNulls={false} />
                    <Line dataKey="estimate" name="Estimate" stroke="var(--good)" strokeWidth={2.25} strokeDasharray="6 5" dot={{ r: 2.5, fill: 'var(--good)' }} connectNulls={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-5 text-xs text-muted-foreground">
              <span className="flex items-center gap-2"><i className="h-0.5 w-4 rounded bg-[var(--chart-1)]" />Actual</span>
              <span className="flex items-center gap-2"><i className="h-0.5 w-4 border-t-2 border-dashed border-good" />Estimate</span>
              <span className="flex items-center gap-2"><i className="h-2.5 w-4 rounded-sm bg-good-soft" />95% range</span>
            </div>
          </Card>
        </>
      )}

      <Card className="flex items-start gap-3 p-5">
        <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <p className="text-sm leading-6 text-muted-foreground">
          Estimates come from a linear trend fitted to the monthly history, with a 95% range from how far past months strayed from that trend.
          They are not guaranteed results. The AI analyst does not answer forecast questions yet, so it cannot contradict this page.
        </p>
      </Card>
    </div>
  )
}

function ForecastTooltip({ active, payload, label, unit }: any) {
  if (!active || !payload?.length) return null
  const row: ChartRow = payload[0].payload
  const isFuture = row.actual === null
  return (
    <div className="glass-strong rounded-xl px-3 py-2 text-xs">
      <p className="mb-1 font-medium text-muted-foreground">{monthLabel(`${label}-01`)}{isFuture ? ' · estimate' : ''}</p>
      {row.actual !== null && <p className="tabular"><span className="text-muted-foreground">Actual </span><span className="font-semibold">{amount(row.actual, unit)}</span></p>}
      {isFuture && row.estimate !== null && <p className="tabular"><span className="text-muted-foreground">Estimate </span><span className="font-semibold text-good">{amount(row.estimate, unit)}</span></p>}
      {isFuture && row.band && <p className="tabular text-muted-foreground">95% range {amount(row.band[0], unit)} to {amount(row.band[1], unit)}</p>}
    </div>
  )
}

function Stat({ label, value, note, mono }: { label: string; value: string; note?: string; mono?: boolean }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-2 text-xl font-semibold tabular ${mono ? 'font-mono text-lg' : ''}`}>{value}</p>
      {note && <p className="mt-1 text-[11px] text-faint">{note}</p>}
    </Card>
  )
}
