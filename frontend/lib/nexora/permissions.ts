// The one place the UI decides what a role may do. It mirrors the backend's require_role(...) checks
// (backend/app/api/routers/*.py on develop a459a1f); the backend still enforces every rule, this only
// decides which buttons to show and which calls to make. If a router changes, change this map.

import type { Role, Session } from './api'

export type Action =
  | 'data:view' // companies, KPIs, analytics (GET)
  | 'ai:ask' // POST /companies/{id}/ai-analysis
  | 'forecast:run' // POST /companies/{id}/forecast
  | 'scenario:use' // browser-only sliders, nothing is saved
  | 'report:export' // Reports page, CSV downloads, print
  | 'company:create' // POST /companies/
  | 'company:update' // PUT /companies/{id}
  | 'company:delete' // DELETE /companies/{id}
  | 'kpi:create' // POST /companies/{id}/kpis
  | 'kpi:update' // PUT /kpis/{id}
  | 'kpi:delete' // DELETE /kpis/{id}

const ALL: Role[] = ['admin', 'analyst', 'viewer']
// Admin: every data change. Analyst: the analysis tools. Viewer: read-only dashboards.
const ANALYSIS: Role[] = ['admin', 'analyst']
const ADMIN: Role[] = ['admin']

export const PERMISSIONS: Record<Action, readonly Role[]> = {
  'data:view': ALL,
  'ai:ask': ANALYSIS,
  'forecast:run': ANALYSIS,
  'scenario:use': ANALYSIS,
  'report:export': ANALYSIS,
  'company:create': ADMIN,
  'company:update': ADMIN,
  'company:delete': ADMIN,
  'kpi:create': ADMIN,
  'kpi:update': ADMIN,
  'kpi:delete': ADMIN,
}

/** Pages that need more than read access; the menu hides them and the page shows "Access restricted". */
export const PAGE_ACTION: Partial<Record<string, Action>> = {
  Forecast: 'forecast:run',
  'AI Analyst': 'ai:ask',
  Scenarios: 'scenario:use',
  Reports: 'report:export',
}

export function can(user: Pick<Session, 'role'> | null | undefined, action: Action): boolean {
  return !!user && PERMISSIONS[action].includes(user.role)
}

export const ROLE_LABEL: Record<Role, string> = { admin: 'ADMIN', analyst: 'ANALYST', viewer: 'VIEWER' }
