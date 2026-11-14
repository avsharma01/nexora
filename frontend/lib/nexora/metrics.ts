// What the app knows about a metric it may never have seen before (CSV imports: customers, orders,
// cash_balance, ...). Mirrors backend/app/ai/metrics_config.py (aggregation_of, is_money) so the
// screens and the AI analyst combine months the same way. Keep the word lists in step.

import { titleCase } from './format'

export type Aggregation = 'sum' | 'last' | 'average'

const CORE = new Set(['revenue', 'expenses', 'profit'])

const AVERAGE = new Set(['avg', 'average', 'mean', 'rate', 'ratio', 'margin', 'pct', 'percent', 'percentage', 'per', 'nps', 'score', 'aov', 'price', 'yield', 'utilization', 'utilisation', 'occupancy', 'conversion', 'retention', 'churn', 'arpu', 'arpa'])
const FLOW = new Set(['new', 'added', 'acquired', 'churned', 'lost', 'signups', 'orders', 'sales', 'spend', 'spending', 'cost', 'costs', 'expense', 'expenses', 'revenue', 'income', 'payroll', 'visits', 'sessions', 'transactions', 'units', 'shipments', 'deliveries', 'tickets', 'hires', 'leads'])
const STOCK = new Set(['customers', 'customer', 'subscribers', 'users', 'members', 'accounts', 'headcount', 'employees', 'staff', 'stores', 'outlets', 'branches', 'locations', 'cash', 'balance', 'inventory', 'arr', 'mrr', 'backlog', 'pipeline', 'active'])
const MONEY = new Set(['revenue', 'sales', 'income', 'expense', 'expenses', 'cost', 'costs', 'spend', 'spending', 'cash', 'balance', 'profit', 'ebitda', 'price', 'value', 'payroll', 'salary', 'salaries', 'budget', 'arr', 'mrr', 'gmv', 'aov', 'capex', 'opex', 'fees', 'burn', 'arpu', 'arpa'])
// Going up is bad news for these (shown red instead of green).
const LOWER_IS_BETTER = new Set(['expense', 'expenses', 'cost', 'costs', 'spend', 'spending', 'churn', 'churned', 'lost', 'burn', 'returns', 'refunds', 'complaints', 'defects', 'cac'])

const words = (metric: string) => new Set(metric.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean))
const any = (w: Set<string>, list: Set<string>) => [...w].some((x) => list.has(x))

export interface MetricInfo {
  key: string
  label: string
  money: boolean
  agg: Aggregation
  /** false when an increase is bad (expenses, churn, marketing spend, ...) */
  higherIsBetter: boolean
}

export function metricInfo(metric: string): MetricInfo {
  const key = metric.trim().toLowerCase()
  const w = words(key)
  const agg: Aggregation = CORE.has(key) ? 'sum' : any(w, AVERAGE) ? 'average' : any(w, FLOW) ? 'sum' : any(w, STOCK) ? 'last' : 'sum'
  return { key, label: titleCase(key), money: CORE.has(key) || any(w, MONEY), agg, higherIsBetter: !any(w, LOWER_IS_BETTER) }
}

export const AGG_HINT: Record<Aggregation, string> = {
  sum: 'total',
  last: 'end of period',
  average: 'monthly average',
}

/** Combine monthly values into one quarter/year value using the metric's rule. */
export function combine(values: number[], agg: Aggregation): number | null {
  if (!values.length) return null
  if (agg === 'last') return values[values.length - 1]
  const total = values.reduce((a, b) => a + b, 0)
  return agg === 'average' ? total / values.length : total
}
