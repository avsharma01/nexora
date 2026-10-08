// Turns the raw KPI rows into series the screens can draw. Display arithmetic only:
// the AI analyst never sees these numbers, it computes its own facts in the backend.

import type { KPI } from './api'

export type Metric = 'revenue' | 'expenses' | 'profit'
export const METRICS: Metric[] = ['revenue', 'expenses', 'profit']

export interface MonthRow {
  month: string // "2025-03"
  date: string // last stored date in that month
  revenue: number | null
  expenses: number | null
  profit: number | null
  margin: number | null // profit / revenue, %
}

/** One row per month. Same rules as the backend: duplicate dates -> last stored row wins; several dates in a month -> latest wins. */
export function monthly(kpis: KPI[]): MonthRow[] {
  const byMonth = new Map<string, { date: Partial<Record<Metric, string>>; v: Partial<Record<Metric, number>> }>()
  for (const k of [...kpis].sort((a, b) => a.id - b.id)) {
    const m = k.metric_name.trim().toLowerCase() as Metric
    if (!METRICS.includes(m)) continue
    const month = k.metric_date.slice(0, 7)
    const row = byMonth.get(month) ?? { date: {}, v: {} }
    if (!row.date[m] || k.metric_date >= row.date[m]!) {
      row.date[m] = k.metric_date
      row.v[m] = Number(k.metric_value)
    }
    byMonth.set(month, row)
  }
  return [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, { date, v }]) => {
      const revenue = v.revenue ?? null
      const expenses = v.expenses ?? null
      const profit = v.profit ?? (revenue !== null && expenses !== null ? revenue - expenses : null)
      return {
        month,
        date: date.revenue ?? date.profit ?? date.expenses ?? `${month}-01`,
        revenue,
        expenses,
        profit,
        margin: revenue && profit !== null ? (profit / revenue) * 100 : null,
      }
    })
}

export const change = (prev: number | null | undefined, curr: number | null | undefined) =>
  prev === null || prev === undefined || curr === null || curr === undefined || prev === 0
    ? null
    : ((curr - prev) / Math.abs(prev)) * 100

const sum = (rows: MonthRow[], m: Metric) => {
  const vals = rows.map((r) => r[m]).filter((x): x is number => x !== null)
  return vals.length ? vals.reduce((a, b) => a + b, 0) : null
}

export type Grain = 'month' | 'quarter' | 'year'

export interface PeriodRow {
  period: string
  label: string
  months: number
  revenue: number | null
  expenses: number | null
  profit: number | null
  margin: number | null
}

/** Sum months into quarters or years. `months` tells partial periods apart. */
export function aggregate(rows: MonthRow[], grain: Grain): PeriodRow[] {
  const key = (m: string) => {
    const [y, mo] = m.split('-').map(Number)
    return grain === 'month' ? m : grain === 'quarter' ? `${y}-Q${Math.ceil(mo / 3)}` : String(y)
  }
  const groups = new Map<string, MonthRow[]>()
  for (const r of rows) groups.set(key(r.month), [...(groups.get(key(r.month)) ?? []), r])
  return [...groups.entries()].map(([period, g]) => {
    const revenue = sum(g, 'revenue')
    const profit = sum(g, 'profit')
    return {
      period,
      label: grain === 'month' ? shortLabel(period) : period.replace(/^(\d{4})-Q(\d)$/, "Q$2 '") + (grain === 'quarter' ? period.slice(2, 4) : ''),
      months: g.length,
      revenue,
      expenses: sum(g, 'expenses'),
      profit,
      margin: revenue && profit !== null ? (profit / revenue) * 100 : null,
    }
  })
}

function shortLabel(month: string) {
  const [y, m] = month.split('-').map(Number)
  return `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1]} '${String(y).slice(2)}`
}

/** Last 12 months vs the 12 before, when there is enough history. */
export function trailingYear(rows: MonthRow[], m: Metric) {
  const last = rows.slice(-12)
  const prev = rows.slice(-24, -12)
  const curr = last.length === 12 ? sum(last, m) : null
  const before = prev.length === 12 ? sum(prev, m) : null
  return { curr, before, change: change(before, curr) }
}

export function extreme(rows: MonthRow[], m: Metric, kind: 'max' | 'min') {
  const vals = rows.filter((r) => r[m] !== null)
  if (!vals.length) return null
  return vals.reduce((best, r) => ((kind === 'max' ? r[m]! > best[m]! : r[m]! < best[m]!) ? r : best))
}

export function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return ''
  const cols = Object.keys(rows[0])
  const cell = (v: unknown) => (v === null || v === undefined ? '' : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v))
  return [cols.join(','), ...rows.map((r) => cols.map((c) => cell(r[c])).join(','))].join('\n')
}

export function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }))
  const a = Object.assign(document.createElement('a'), { href: url, download: name })
  a.click()
  URL.revokeObjectURL(url)
}
