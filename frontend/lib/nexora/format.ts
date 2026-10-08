// Number and date formatting. INR uses Indian grouping (lakh / crore), every other currency western grouping.
// The KPI API returns no units, so `unit` is null until the analyst has reported the company's currency.

import { numOrNull } from './api'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

type Num = number | string | null | undefined

export function amount(raw: Num, unit?: string | null): string {
  const value = numOrNull(raw)
  if (value === null) return 'n/a'
  if (unit === '%') return `${value.toFixed(1)}%`
  const locale = unit === 'INR' ? 'en-IN' : 'en-US'
  const text = new Intl.NumberFormat(locale, { maximumFractionDigits: Math.abs(value) < 100 ? 2 : 0 }).format(value)
  return unit ? `${text} ${unit}` : text
}

/** Short form for tiles and axes: 1.3 Cr / 8.3 L for INR, 1.3M / 830K otherwise. */
export function compact(raw: Num, unit?: string | null): string {
  const value = numOrNull(raw)
  if (value === null) return 'n/a'
  const sign = value < 0 ? '-' : ''
  const v = Math.abs(value)
  if (unit === 'INR') {
    const s = v >= 1e7 ? `${(v / 1e7).toFixed(2)} Cr` : v >= 1e5 ? `${(v / 1e5).toFixed(1)} L` : new Intl.NumberFormat('en-IN').format(Math.round(v))
    return `${sign}₹${s}`
  }
  const s = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: v >= 1e6 ? 2 : 1 }).format(v)
  return `${sign}${unit === 'USD' ? '$' : ''}${s}${unit && unit !== 'USD' ? ` ${unit}` : ''}`
}

export function pct(raw: Num, signed = true): string {
  const value = numOrNull(raw)
  if (value === null) return 'n/a'
  const r = Math.round(value * 10) / 10
  return `${signed && r > 0 ? '+' : ''}${r.toFixed(1)}%`
}

export function monthLabel(iso: string | null | undefined): string {
  if (!iso) return ''
  const [y, m] = iso.split('-').map(Number)
  return `${MONTHS[m - 1]} ${y}`
}

export function shortMonth(iso: string): string {
  const [y, m] = iso.split('-').map(Number)
  return `${MONTHS[m - 1]} '${String(y).slice(2)}`
}

export function titleCase(name: string): string {
  return name.trim().replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

/** Readable period from the analyst's figure periods ("2025-02..2025-03", "2025-Q1", "2025"). */
export function periodLabel(period: string): string {
  const one = (p: string) => (/^\d{4}-\d{2}$/.test(p) ? monthLabel(`${p}-01`) : p.replace(/^(\d{4})-Q(\d)$/, 'Q$2 $1'))
  return period.split('..').map(one).join(' to ')
}
