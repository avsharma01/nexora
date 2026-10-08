// The one place the UI decides what a role may do. It mirrors the backend's require_role(...) checks
// (backend/app/api/routers/*.py on develop a459a1f); the backend still enforces every rule, this only
// decides which buttons to show and which calls to make. If a router changes, change this map.

import type { Role, Session } from './api'

export type Action =
  | 'data:view' // companies, KPIs, analytics (GET)
  | 'ai:ask' // POST /companies/{id}/ai-analysis
  | 'forecast:run' // POST /companies/{id}/forecast
  | 'scenario:use' // browser-only sliders, nothing is saved
  | 'company:create' // POST /companies/
  | 'company:update' // PUT /companies/{id}
  | 'company:delete' // DELETE /companies/{id}
  | 'kpi:create' // POST /companies/{id}/kpis
  | 'kpi:update' // PUT /kpis/{id}
  | 'kpi:delete' // DELETE /kpis/{id}

const ALL: Role[] = ['admin', 'analyst', 'viewer']

export const PERMISSIONS: Record<Action, readonly Role[]> = {
  'data:view': ALL,
  'ai:ask': ALL,
  'forecast:run': ALL,
  'scenario:use': ALL,
  'company:create': ['admin', 'analyst'],
  'company:update': ['admin', 'analyst'],
  'company:delete': ['admin'],
  'kpi:create': ['admin', 'analyst'],
  'kpi:update': ['admin', 'analyst'],
  'kpi:delete': ['admin'],
}

export function can(user: Pick<Session, 'role'> | null | undefined, action: Action): boolean {
  return !!user && PERMISSIONS[action].includes(user.role)
}

export const ROLE_LABEL: Record<Role, string> = { admin: 'ADMIN', analyst: 'ANALYST', viewer: 'VIEWER' }
