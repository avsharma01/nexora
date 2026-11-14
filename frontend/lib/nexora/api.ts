// Typed client for the NEXORA FastAPI backend. Requests go to /api, which next.config.mjs forwards to :8000.

export type Role = 'admin' | 'analyst' | 'viewer'

/** The role always comes from the backend (GET /auth/me); it is never guessed or hard-coded. */
export interface Session {
  token: string
  email: string
  userId: number
  role: Role
}

export interface Company {
  id: number
  name: string
  industry: string | null
  description: string | null
}

export interface KPI {
  id: number
  company_id: number
  metric_name: string
  metric_value: number
  metric_date: string
}

export interface MetricAnalytics {
  metric_name: string
  latest_value: number | null
  latest_date: string | null
  previous_value: number | null
  previous_date: string | null
  change: number | null
  change_percentage: number | null
  comparison_available: boolean
}

export interface ForecastPoint {
  forecast_date: string
  forecast_value: number
  lower_bound: number
  upper_bound: number
  model_name: string
}

/** Athira's forecast service (linear_trend_v1): estimate + 95% bounds + backtest accuracy. */
export interface ForecastResponse {
  company_id: number
  metric_name: string
  historical_latest_value: number | null
  history_points: number
  minimum_history: number
  status: 'forecasted' | 'insufficient_data' | string
  model_name: string | null
  generated_at: string
  evaluation: { backtest_points: number; mae: number | null; mape: number | null } | null
  forecasts: ForecastPoint[]
}

export type AiStatus = 'answered' | 'insufficient_data' | 'out_of_scope'

export interface AiFigure {
  label: string
  value: number
  unit: string | null
  period: string
  kind: 'historical' | 'forecast' | 'scenario'
}

export interface AiSource {
  id: string
  type: 'kpi' | 'document'
  label: string
}

export interface AiResponse {
  company_id: number
  question: string
  answer: string
  insight_id: number | null
  status: AiStatus
  is_grounded: boolean
  figures: AiFigure[]
  sources: AiSource[]
  generated_at: string | null
}

export interface ChatTurn {
  role: 'user' | 'assistant'
  content: string
}

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

const OFFLINE = 'The backend is not reachable. Start it on port 8000.'

function describe(status: number, detail: unknown): string {
  if (typeof detail === 'string' && detail) return detail
  // 422: [{loc: ["body", "metric_value"], msg: "..."}] -> "metric value: ..."
  if (Array.isArray(detail) && detail[0]?.msg) {
    const field = Array.isArray(detail[0].loc) ? String(detail[0].loc.at(-1)).replace(/_/g, ' ') : ''
    return `${field ? `${field}: ` : ''}${String(detail[0].msg)}`
  }
  if (status === 0) return OFFLINE
  return `Request failed (${status}).`
}

async function request<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.body) headers.set('Content-Type', 'application/json')
  if (token) headers.set('Authorization', `Bearer ${token}`)

  let res: Response
  try {
    res = await fetch(`/api${path}`, { ...init, headers, cache: 'no-store' })
  } catch {
    throw new ApiError(0, OFFLINE)
  }
  if (!res.ok) {
    let detail: unknown = null
    try {
      detail = (await res.json()).detail
    } catch {
      /* body was not JSON */
    }
    // The Next proxy answers 500 with no JSON detail when nothing listens on :8000.
    if (res.status >= 500 && res.status !== 503 && detail === null) throw new ApiError(0, OFFLINE)
    throw new ApiError(res.status, describe(res.status, detail))
  }
  if (res.status === 204) return null as T // DELETE: no body
  return res.json() as Promise<T>
}

/** Current user as the backend sees it right now (role read from the database on every request). */
export const me = (token: string) => request<{ user_id: number; role: Role }>('/auth/me', {}, token)

export async function login(email: string, password: string): Promise<Session> {
  const data = await request<{ access_token: string; email: string }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  const who = await me(data.access_token)
  return { token: data.access_token, email: data.email, userId: who.user_id, role: who.role }
}

export const register = (email: string, password: string) =>
  request('/auth/register', { method: 'POST', body: JSON.stringify({ email, password }) })

export const health = () => request<{ status: string }>('/health')

// Decimal columns (KPI values etc.) can arrive as JSON strings ("12345.67"). Every number is
// converted here, at the edge, so nothing downstream compares, charts or formats a string.
export function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : NaN
}
export function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = num(v)
  return Number.isNaN(n) ? null : n
}

export const listCompanies = (token: string) => request<Company[]>('/companies/', {}, token)

export const companyKpis = async (id: number, token: string): Promise<KPI[]> =>
  (await request<KPI[]>(`/companies/${id}/kpis`, {}, token)).map((k) => ({ ...k, metric_value: num(k.metric_value) }))

export const companyAnalytics = async (id: number, token: string) => {
  const res = await request<{ company_id: number; metrics: MetricAnalytics[] }>(`/companies/${id}/analytics`, {}, token)
  return {
    ...res,
    metrics: res.metrics.map((m) => ({
      ...m,
      latest_value: numOrNull(m.latest_value),
      previous_value: numOrNull(m.previous_value),
      change: numOrNull(m.change),
      change_percentage: numOrNull(m.change_percentage),
    })),
  }
}

export const companyForecast = async (id: number, metric: string, periods: number, token: string): Promise<ForecastResponse> => {
  const res = await request<ForecastResponse>(
    `/companies/${id}/forecast`,
    { method: 'POST', body: JSON.stringify({ metric_name: metric, periods }) },
    token,
  )
  return {
    ...res,
    historical_latest_value: numOrNull(res.historical_latest_value),
    history_points: num(res.history_points),
    minimum_history: num(res.minimum_history),
    evaluation: res.evaluation && {
      backtest_points: num(res.evaluation.backtest_points),
      mae: numOrNull(res.evaluation.mae),
      mape: numOrNull(res.evaluation.mape),
    },
    forecasts: (res.forecasts ?? []).map((p) => ({
      ...p,
      forecast_value: num(p.forecast_value),
      lower_bound: num(p.lower_bound),
      upper_bound: num(p.upper_bound),
    })),
  }
}

// ---- writes (the backend enforces roles; the UI only hides what a role can't use) ----

export type CompanyInput = { name?: string; industry?: string | null; description?: string | null }
export type KpiInput = { metric_name?: string; metric_value?: number; metric_date?: string }

const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) })

export const createCompany = (body: CompanyInput & { name: string }, token: string) =>
  request<Company>('/companies/', json('POST', body), token)
export const updateCompany = (id: number, body: CompanyInput, token: string) =>
  request<Company>(`/companies/${id}`, json('PUT', body), token)
export const deleteCompany = (id: number, token: string) =>
  request<null>(`/companies/${id}`, { method: 'DELETE' }, token)

// ---- CSV import (monthly rows; see backend/app/services/kpi_import.py for the format) ----

export interface ImportResult {
  company: Company
  months: number
  first_month: string
  last_month: string
  metrics: string[]
  created: number
  updated: number
  profit_computed: number
}

/** Create a company and its monthly KPIs in one step (all or nothing). */
export const importNewCompany = (body: CompanyInput & { name: string; csv: string }, token: string) =>
  request<ImportResult>('/companies/import', json('POST', body), token)

/** Add or replace monthly values for an existing company (same metric + month is replaced). */
export const importKpis = (companyId: number, csv: string, token: string) =>
  request<ImportResult>(`/companies/${companyId}/kpis/import`, json('POST', { csv }), token)

export const createKpi = (companyId: number, body: Required<KpiInput>, token: string) =>
  request<KPI>(`/companies/${companyId}/kpis`, json('POST', body), token)
export const updateKpi = (id: number, body: KpiInput, token: string) =>
  request<KPI>(`/kpis/${id}`, json('PUT', body), token)
export const deleteKpi = (id: number, token: string) => request<null>(`/kpis/${id}`, { method: 'DELETE' }, token)

/**
 * One place that turns any failure into a sentence for the user. 401 is handled by the caller
 * (back to sign-in); `context` lets a screen word 404/409 for what it was doing.
 */
export function describeError(err: unknown, context: { notFound?: string; conflict?: string } = {}): string {
  if (!(err instanceof ApiError)) return 'Something went wrong. Try again.'
  switch (true) {
    case err.status === 0 || err.status >= 500:
      return 'The service is unavailable right now. Try again in a moment.'
    case err.status === 403:
      return "You don't have permission to do that."
    case err.status === 404:
      return context.notFound ?? 'That record no longer exists. It may have been deleted.'
    case err.status === 409:
      return context.conflict ?? err.message
    case err.status === 422 || err.status === 400:
      return err.message.replace(/^Value error, /, '')
    default:
      return err.message
  }
}

export const askAnalyst = async (id: number, question: string, history: ChatTurn[], token: string): Promise<AiResponse> => {
  const res = await request<AiResponse>(
    `/companies/${id}/ai-analysis`,
    { method: 'POST', body: JSON.stringify({ question, history: history.slice(-6) }) },
    token,
  )
  return { ...res, figures: (res.figures ?? []).map((f) => ({ ...f, value: num(f.value) })) }
}
