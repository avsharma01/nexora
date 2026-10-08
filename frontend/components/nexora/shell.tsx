'use client'

import { useEffect, useState } from 'react'
import {
  BarChart3, Bot, BriefcaseBusiness, Building2, ChevronDown, ChevronLeft, ChevronRight, CircleDollarSign,
  FileText, Home, LogOut, Menu, Settings, ShieldAlert, SlidersHorizontal, TrendingUp, X, type LucideIcon,
} from 'lucide-react'
import { health } from '@/lib/nexora/api'
import { ThemeToggle } from './theme-toggle'
import { Mark, RoleBadge } from './ui'
import { useWorkspace, type Page } from './workspace'

const NAV: { label: string; items: [Page, LucideIcon][] }[] = [
  { label: 'MAIN', items: [['Dashboard', Home], ['Company', Building2], ['Financials', CircleDollarSign], ['Portfolio', BriefcaseBusiness], ['Analytics', BarChart3]] },
  { label: 'INTELLIGENCE', items: [['Forecast', TrendingUp], ['AI Analyst', Bot], ['Anomalies', ShieldAlert], ['Scenarios', SlidersHorizontal]] },
  { label: 'REPORTING', items: [['Reports', FileText]] },
  { label: 'SYSTEM', items: [['Settings', Settings]] },
]

export function Shell({ onSignOut, children }: { onSignOut: () => void; children: React.ReactNode }) {
  const { page, go, session, companies, company, selectCompany } = useWorkspace()
  const [collapsed, setCollapsed] = useState(false)
  const [mobile, setMobile] = useState(false)
  const [up, setUp] = useState<boolean | null>(null)
  const initials = session.email.slice(0, 2).toUpperCase()
  const width = collapsed ? 76 : 252

  useEffect(() => {
    let alive = true
    const check = () => health().then(() => alive && setUp(true)).catch(() => alive && setUp(false))
    check()
    const t = setInterval(check, 15000)
    return () => { alive = false; clearInterval(t) }
  }, [])

  const navTo = (p: Page) => { go(p); setMobile(false) }

  return (
    <div className="min-h-[100dvh]" style={{ ['--side' as any]: `${width}px` }}>
      <aside className="glass-strong fixed inset-y-0 left-0 z-20 hidden flex-col rounded-none border-y-0 border-l-0 transition-[width] lg:flex" style={{ width }}>
        <div className="flex h-20 items-center gap-3 px-5">
          <Mark />
          {!collapsed && (
            <div>
              <p className="font-mono text-sm font-semibold tracking-[0.24em]">NEXORA</p>
              <p className="text-[9px] uppercase tracking-[0.14em] text-faint">Intelligence platform</p>
            </div>
          )}
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-3" aria-label="Main">
          {NAV.map((group) => (
            <div key={group.label} className="mb-6">
              <p className={`mb-2 px-3 text-[10px] font-semibold tracking-[0.16em] text-faint ${collapsed ? 'text-center' : ''}`}>{collapsed ? '·' : group.label}</p>
              {group.items.map(([label, Icon]) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => navTo(label as Page)}
                  title={collapsed ? label : undefined}
                  aria-current={page === label ? 'page' : undefined}
                  className={`relative mb-0.5 flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm transition ${collapsed ? 'justify-center' : ''} ${page === label ? 'bg-tint/[0.08] text-foreground shadow-[inset_0_1px_0_rgb(var(--tint-rgb) / 0.06)]' : 'text-muted-foreground hover:bg-tint/[0.04] hover:text-foreground'}`}
                >
                  {page === label && <span aria-hidden="true" className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-good" />}
                  <Icon className="size-4 shrink-0" />
                  {!collapsed && label}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="border-t border-tint/[0.06] p-3">
          <div className={`flex items-center gap-3 rounded-xl bg-tint/[0.04] p-2 ${collapsed ? 'justify-center' : ''}`}>
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-tint/[0.1] text-xs font-semibold">{initials}</span>
            {!collapsed && (
              <>
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold">{session.email}</p>
                  <p className="truncate text-[11px] capitalize text-faint">{session.role}</p>
                </div>
                <button type="button" onClick={onSignOut} className="ml-auto text-muted-foreground hover:text-foreground" title="Sign out" aria-label="Sign out">
                  <LogOut className="size-4" />
                </button>
              </>
            )}
          </div>
        </div>
        <button type="button" onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} className="glass-strong absolute -right-3 top-24 flex size-6 items-center justify-center rounded-full text-foreground">
          {collapsed ? <ChevronRight className="size-3.5" /> : <ChevronLeft className="size-3.5" />}
        </button>
      </aside>

      <header className="fixed inset-x-0 top-0 z-10 flex h-20 items-center justify-between gap-3 border-b border-tint/[0.06] bg-background/60 px-4 backdrop-blur-xl lg:left-[var(--side)] lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <button type="button" onClick={() => setMobile(true)} className="icon-button lg:hidden" aria-label="Open menu"><Menu className="size-5" /></button>
          <div className="hidden items-center gap-2 text-sm text-muted-foreground md:flex">
            <span>Workspace</span><span className="text-faint">/</span><span className="font-medium text-foreground">{page}</span>
          </div>
        </div>
        <div className="flex min-w-0 items-center gap-2">
          {companies && companies.length > 0 && (
            <label className="relative">
              <span className="sr-only">Company</span>
              <Building2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <select
                value={company?.id ?? ''}
                onChange={(e) => selectCompany(Number(e.target.value))}
                className="h-10 max-w-[220px] appearance-none truncate rounded-[10px] border border-border bg-tint/[0.04] pl-9 pr-9 text-sm font-medium outline-none transition hover:bg-tint/[0.07] focus:border-tint/30 sm:max-w-[280px]"
              >
                {companies.map((c) => <option key={c.id} value={c.id} className="bg-popover">{c.name}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            </label>
          )}
          <span className="hidden items-center gap-2 rounded-full border border-border px-3 py-1.5 text-[11px] text-muted-foreground sm:inline-flex" role="status">
            <span className={`size-1.5 rounded-full ${up === null ? 'bg-faint' : up ? 'bg-good' : 'bg-bad'}`} />
            {up === null ? 'Checking' : up ? 'API live' : 'API offline'}
          </span>
          <ThemeToggle />
          <span className="ml-1 hidden items-center gap-2 border-l border-border pl-3 lg:flex">
            <span className="max-w-[180px] truncate text-xs text-muted-foreground" title={session.email}>{session.email}</span>
            <RoleBadge role={session.role} />
          </span>
          <span className="lg:hidden"><RoleBadge role={session.role} /></span>
        </div>
      </header>

      {mobile && (
        <div className="glass-strong fixed inset-0 z-30 rounded-none p-5 lg:hidden">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-3"><Mark size="sm" /><span className="font-mono text-sm font-semibold tracking-[0.24em]">NEXORA</span></span>
            <button type="button" onClick={() => setMobile(false)} className="icon-button" aria-label="Close menu"><X className="size-5" /></button>
          </div>
          <div className="mt-8 flex flex-col gap-1">
            {NAV.flatMap((g) => g.items).map(([label, Icon]) => (
              <button key={label} type="button" onClick={() => navTo(label as Page)} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-left text-sm ${page === label ? 'bg-tint/[0.08]' : 'hover:bg-tint/[0.04]'}`}>
                <Icon className="size-4" />{label}
              </button>
            ))}
            <button type="button" onClick={onSignOut} className="mt-4 flex items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-muted-foreground"><LogOut className="size-4" /> Sign out</button>
          </div>
        </div>
      )}

      <main className="pt-20 lg:pl-[var(--side)]">
        <div className="mx-auto max-w-[1500px] p-4 sm:p-6 lg:p-8">{children}</div>
      </main>
    </div>
  )
}
