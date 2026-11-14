'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import {
  ApiError, companyAnalytics, companyKpis, describeError, listCompanies, me,
  type Company, type KPI, type MetricAnalytics, type Session,
} from '@/lib/nexora/api'
import { extraMetrics, monthly, type MonthRow } from '@/lib/nexora/data'
import { can as canDo, type Action } from '@/lib/nexora/permissions'
import type { ChatMessage } from './pages/analyst'

export type Page =
  | 'Dashboard' | 'Company' | 'Financials' | 'Portfolio' | 'Analytics'
  | 'Forecast' | 'AI Analyst' | 'Anomalies' | 'Scenarios' | 'Reports' | 'Settings'

interface CompanyData {
  kpis: KPI[]
  rows: MonthRow[]
  /** Metrics beyond revenue/expenses/profit (CSV imports), in column order. */
  extras: string[]
  analytics: MetricAnalytics[]
}

interface Workspace {
  session: Session
  /** Permission check against the central map, using the role the backend reported. */
  can: (action: Action) => boolean
  companies: Company[] | null
  companiesError: string | null
  company: Company | null
  selectCompany: (id: number) => void
  data: CompanyData | null
  loading: boolean
  error: { message: string; notFound: boolean } | null
  /** Refetch the selected company's KPIs + analytics (charts, forecast and summaries follow). */
  reload: () => void
  /** Refetch the company list, e.g. after create / rename / delete. */
  reloadCompanies: (selectId?: number) => Promise<void>
  /** Bumps after every successful write, so cached views (AI summary, portfolio) refresh. */
  dataVersion: number
  /** Currency per company, learned from the analyst's answers (the KPI API has no units). */
  unit: string | null
  units: Record<number, string>
  learnUnit: (companyId: number, unit: string) => void
  chats: Record<number, ChatMessage[]>
  setChat: (companyId: number, update: (prev: ChatMessage[]) => ChatMessage[]) => void
  page: Page
  go: (p: Page) => void
  expired: () => void
}

const Ctx = createContext<Workspace | null>(null)

export const useWorkspace = () => {
  const ws = useContext(Ctx)
  if (!ws) throw new Error('useWorkspace outside WorkspaceProvider')
  return ws
}

const store = {
  get: (k: string) => { try { return sessionStorage.getItem(k) } catch { return null } },
  set: (k: string, v: string) => { try { sessionStorage.setItem(k, v) } catch { /* storage blocked */ } },
}

export function WorkspaceProvider({
  session: initial, onExpired, onSession, children,
}: { session: Session; onExpired: () => void; onSession: (s: Session) => void; children: React.ReactNode }) {
  const [session, setSession] = useState(initial)
  const [companies, setCompanies] = useState<Company[] | null>(null)
  const [companiesError, setCompaniesError] = useState<string | null>(null)
  const [companyId, setCompanyId] = useState<number | null>(() => Number(store.get('nexora.company')) || null)
  const [data, setData] = useState<CompanyData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Workspace['error']>(null)
  const [nonce, setNonce] = useState(0)
  const [units, setUnits] = useState<Record<number, string>>(() => {
    try { return JSON.parse(store.get('nexora.units') ?? '{}') } catch { return {} }
  })
  const [chats, setChats] = useState<Record<number, ChatMessage[]>>({})
  const [page, setPage] = useState<Page>(() => (store.get('nexora.page') as Page) || 'Dashboard')

  const expired = useCallback(() => onExpired(), [onExpired])

  // The role can change in the database at any time; ask the backend again whenever the app opens.
  useEffect(() => {
    me(session.token)
      .then((who) => {
        if (who.role !== session.role || who.user_id !== session.userId) {
          const next = { ...session, role: who.role, userId: who.user_id }
          setSession(next)
          onSession(next)
        }
      })
      .catch((err) => { if (err instanceof ApiError && err.status === 401) expired() })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.token])

  const reloadCompanies = useCallback(async (selectId?: number) => {
    try {
      const list = await listCompanies(session.token)
      const sorted = [...list].sort((a, b) => a.name.localeCompare(b.name))
      setCompanies(sorted)
      setCompaniesError(null)
      setCompanyId((cur) => {
        const want = selectId ?? cur
        const next = want && sorted.some((c) => c.id === want) ? want : sorted[0]?.id ?? null
        if (next) store.set('nexora.company', String(next))
        return next
      })
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return expired()
      setCompaniesError(describeError(err))
      setLoading(false)
    }
  }, [session.token, expired])

  useEffect(() => { void reloadCompanies() }, [reloadCompanies])

  // Which company `data` belongs to. Refreshing the SAME company (after a save or import) keeps the
  // page mounted with its current data; only switching company shows the loading skeleton. Otherwise
  // every save unmounted the page and its "saved" message was lost.
  const loadedFor = useRef<number | null>(null)

  useEffect(() => {
    if (!companyId) return
    let alive = true
    if (loadedFor.current !== companyId) setLoading(true)
    setError(null)
    Promise.all([companyKpis(companyId, session.token), companyAnalytics(companyId, session.token)])
      .then(([kpis, analytics]) => {
        if (!alive) return
        setData({ kpis, rows: monthly(kpis), extras: extraMetrics(kpis), analytics: analytics.metrics })
        loadedFor.current = companyId
        setLoading(false)
      })
      .catch((err) => {
        if (!alive) return
        if (err instanceof ApiError && err.status === 401) return expired()
        const notFound = err instanceof ApiError && err.status === 404
        setError({ message: describeError(err, { notFound: 'This company no longer exists.' }), notFound })
        setLoading(false)
      })
    return () => { alive = false }
  }, [companyId, session.token, nonce, expired])

  const selectCompany = useCallback((id: number) => {
    setCompanyId(id)
    store.set('nexora.company', String(id))
  }, [])

  const learnUnit = useCallback((id: number, unit: string) => {
    setUnits((all) => {
      if (all[id] === unit) return all
      const next = { ...all, [id]: unit }
      store.set('nexora.units', JSON.stringify(next))
      return next
    })
  }, [])

  const setChat = useCallback((id: number, update: (prev: ChatMessage[]) => ChatMessage[]) => {
    setChats((all) => ({ ...all, [id]: update(all[id] ?? []) }))
  }, [])

  const go = useCallback((p: Page) => {
    setPage(p)
    store.set('nexora.page', p)
    window.scrollTo({ top: 0 })
  }, [])

  const company = companies?.find((c) => c.id === companyId) ?? null

  const value = useMemo<Workspace>(
    () => ({
      session, can: (a: Action) => canDo(session, a),
      companies, companiesError, company, selectCompany,
      data: company ? data : null, loading, error, reload: () => setNonce((n) => n + 1),
      reloadCompanies, dataVersion: nonce,
      unit: company ? units[company.id] ?? null : null, units, learnUnit,
      chats, setChat, page, go, expired,
    }),
    [session, companies, companiesError, company, selectCompany, data, loading, error, reloadCompanies, nonce, units, learnUnit, chats, setChat, page, go, expired],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
