'use client'

import { useCallback, useEffect, useState } from 'react'
import { Building2, SearchX } from 'lucide-react'
import type { Session } from '@/lib/nexora/api'
import { Login } from '@/components/nexora/login'
import { Shell } from '@/components/nexora/shell'
import { AccessRestricted, Empty, ErrorBox, PageSkeleton } from '@/components/nexora/ui'
import { PAGE_ACTION } from '@/lib/nexora/permissions'
import { useWorkspace, WorkspaceProvider } from '@/components/nexora/workspace'
import { Dashboard } from '@/components/nexora/pages/dashboard'
import { Financials } from '@/components/nexora/pages/financials'
import { AnalyticsPage } from '@/components/nexora/pages/analytics'
import { Forecast } from '@/components/nexora/pages/forecast'
import { AnalystPage } from '@/components/nexora/pages/analyst'
import { Portfolio } from '@/components/nexora/pages/portfolio'
import { CompanyPage } from '@/components/nexora/pages/company'
import { Reports, Scenarios, SettingsPage } from '@/components/nexora/pages/more'

const KEY = 'nexora.session'
const save = (s: Session) => { try { sessionStorage.setItem(KEY, JSON.stringify(s)) } catch { /* storage blocked */ } }

export default function Page() {
  // undefined = not read from storage yet (avoids a flash of the login page on reload).
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [notice, setNotice] = useState<string | undefined>()

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(KEY)
      setSession(raw ? JSON.parse(raw) : null)
    } catch {
      setSession(null)
    }
  }, [])

  const signIn = (s: Session) => {
    save(s)
    setNotice(undefined)
    setSession(s)
  }
  const signOut = useCallback((reason?: string) => {
    try { sessionStorage.removeItem(KEY) } catch { /* storage blocked */ }
    setNotice(reason)
    setSession(null)
  }, [])
  const expired = useCallback(() => signOut('Your session expired or was signed out. Sign in again.'), [signOut])

  if (session === undefined) return null
  if (!session) return <Login onSignedIn={signIn} notice={notice} />
  return (
    <WorkspaceProvider session={session} onExpired={expired} onSession={save}>
      <Shell onSignOut={() => signOut()}>
        <Current />
      </Shell>
    </WorkspaceProvider>
  )
}

function Current() {
  const { page, company, companies, companiesError, data, loading, error, reload, can, go } = useWorkspace()

  // A page the role can't use (e.g. Viewer opening Forecast from a saved link) explains why instead.
  const need = PAGE_ACTION[page]
  if (need && !can(need)) return <AccessRestricted what={`use ${page}`} onBack={() => go('Dashboard')} />

  if (companiesError) return <ErrorBox message={companiesError} action={<button type="button" onClick={() => location.reload()} className="font-semibold underline underline-offset-4">Try again</button>} />
  if (page === 'Settings') return <SettingsPage />
  if (page === 'Portfolio') return <Portfolio />
  if (companies && companies.length === 0)
    return (
      <Empty
        icon={Building2}
        title="No companies yet"
        text={can('company:create') ? 'Create the first one from the Portfolio page.' : 'An admin needs to add a company first.'}
      />
    )
  if (error?.notFound) return <Empty icon={SearchX} title="Company not found" text="It may have been deleted. Pick another company from the switcher at the top." />
  if (error) return <ErrorBox message={error.message} action={<button type="button" onClick={reload} className="font-semibold underline underline-offset-4">Try again</button>} />
  if (loading || !company || !data) return <PageSkeleton />
  if (data.rows.length === 0 && page !== 'AI Analyst' && page !== 'Company')
    return (
      <Empty
        icon={Building2}
        title={`No KPI data for ${company.name}`}
        text={can('kpi:create') ? 'Add revenue, expenses or profit rows on the Company page and they appear here.' : 'This company has no revenue, expenses or profit rows yet.'}
      />
    )

  const k = company.id
  switch (page) {
    case 'Dashboard': return <Dashboard key={k} />
    case 'Company': return <CompanyPage key={k} />
    case 'Financials': return <Financials key={k} />
    case 'Analytics': return <AnalyticsPage key={k} />
    case 'Forecast': return <Forecast key={k} />
    case 'AI Analyst': return <AnalystPage key={k} />
    case 'Scenarios': return <Scenarios key={k} />
    case 'Reports': return <Reports key={k} />
    default: return <Dashboard key={k} />
  }
}
