'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Calculator, FlaskConical, Lock, Minus } from 'lucide-react'
import type { Role } from '@/lib/nexora/api'
import { pct } from '@/lib/nexora/format'
import { ROLE_LABEL } from '@/lib/nexora/permissions'

/** Role as text (not colour only), straight from the backend's answer. */
export function RoleBadge({ role }: { role: Role }) {
  return (
    <span className="inline-flex items-center rounded-md border border-role/30 bg-role/[0.12] px-2 py-0.5 font-mono text-[10px] font-semibold tracking-[0.12em] text-role" title="Your role, as reported by the backend">
      {ROLE_LABEL[role]}
    </span>
  )
}

/** Shown when someone reaches an action their role can't perform (e.g. via a shared link). */
export function AccessRestricted({ what, onBack }: { what: string; onBack?: () => void }) {
  return (
    <Card className="flex items-start gap-4 p-5" >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-tint/[0.06] text-muted-foreground"><Lock className="size-4" /></span>
      <div className="space-y-1">
        <p className="font-semibold">Access restricted</p>
        <p className="text-sm text-muted-foreground">Your role can't {what}. Ask an admin if you need this.</p>
        {onBack && <button type="button" onClick={onBack} className="button-ghost -ml-2.5 mt-1">Close</button>}
      </div>
    </Card>
  )
}

/** Two-step destructive button: first click arms it, second click within 5 s runs it. */
export function ConfirmButton({ label, confirmLabel, onConfirm, busy, className = '' }: {
  label: React.ReactNode; confirmLabel: string; onConfirm: () => void; busy?: boolean; className?: string
}) {
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setArmed(false), 5000)
    return () => clearTimeout(t)
  }, [armed])
  if (!armed) {
    return <button type="button" disabled={busy} onClick={() => setArmed(true)} className={`button-ghost text-bad hover:text-bad ${className}`}>{label}</button>
  }
  return (
    <span className="inline-flex items-center gap-1">
      <button type="button" disabled={busy} onClick={() => { setArmed(false); onConfirm() }} className={`inline-flex h-8 items-center gap-1.5 rounded-[10px] bg-bad px-2.5 text-xs font-semibold text-white disabled:opacity-50 ${className}`}>
        {confirmLabel}
      </button>
      <button type="button" onClick={() => setArmed(false)} className="button-ghost">Cancel</button>
    </span>
  )
}

export const inputCls =
  'h-10 w-full rounded-[10px] border border-input bg-tint/[0.03] px-3 text-sm outline-none transition placeholder:text-faint focus:border-tint/30 focus:ring-2 focus:ring-tint/10'

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground">
      {label}
      {children}
    </label>
  )
}

export function Notice({ tone, children }: { tone: 'good' | 'bad'; children: React.ReactNode }) {
  return (
    <p role={tone === 'bad' ? 'alert' : 'status'} className={`rounded-xl border px-3 py-2 text-sm ${tone === 'good' ? 'border-good/25 bg-good-soft text-good' : 'border-bad/25 bg-bad-soft text-bad'}`}>
      {children}
    </p>
  )
}

export function Card({ children, className = '', strong = false }: { children: React.ReactNode; className?: string; strong?: boolean }) {
  return <section className={`${strong ? 'glass-strong' : 'glass'} rounded-2xl ${className}`}>{children}</section>
}

type Tone = 'good' | 'bad' | 'warn' | 'gray'
const TONE: Record<Tone, string> = {
  good: 'bg-good-soft text-good',
  bad: 'bg-bad-soft text-bad',
  warn: 'bg-warn-soft text-warn',
  gray: 'bg-tint/[0.06] text-muted-foreground',
}

export function Badge({ children, tone = 'gray' }: { children: React.ReactNode; tone?: Tone }) {
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${TONE[tone]}`}>{children}</span>
}

/** Marks numbers the browser calculates from KPI rows (no backend endpoint behind them). */
export function BrowserCalcBadge() {
  return (
    <span title="No backend endpoint: this page does arithmetic on the KPI rows the API returned" className="inline-flex items-center gap-1.5 rounded-full border border-border bg-tint/[0.04] px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
      <Calculator className="size-3" /> Calculated in the browser from KPI data
    </span>
  )
}

/** Marks "what if" numbers: computed from the real KPIs, but not actuals and not a forecast. */
export function IllustrativeBadge({ label }: { label: string }) {
  return (
    <span title="Computed from actual totals with your assumptions; not a prediction" className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-tint/20 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
      <FlaskConical className="size-3" /> {label}
    </span>
  )
}

export function SectionHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-5 flex items-start justify-between gap-4">
      <div>
        <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export function PageTitle({ title, subtitle, action, eyebrow }: { title: string; subtitle?: React.ReactNode; action?: React.ReactNode; eyebrow?: React.ReactNode }) {
  return (
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        {eyebrow && <div className="mb-2">{eyebrow}</div>}
        <h1 className="text-2xl font-semibold tracking-tight sm:text-[32px] sm:leading-[1.1]">{title}</h1>
        {subtitle && <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

/** Up / down chip. For costs, up is the bad direction. */
export function Delta({ value, inverse = false, suffix }: { value: number | null; inverse?: boolean; suffix?: string }) {
  if (value === null || !Number.isFinite(value)) return <span className="text-xs text-faint">no comparison</span>
  const flat = Math.round(value * 10) === 0
  const up = value > 0
  const good = flat ? null : up !== inverse
  const Icon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold tabular ${good === null ? 'text-muted-foreground' : good ? 'text-good' : 'text-bad'}`}>
      <Icon className="size-3.5" />
      {pct(value, false).replace('-', '')}
      {suffix && <span className="ml-1 font-normal text-muted-foreground">{suffix}</span>}
    </span>
  )
}

export function Sparkline({ data, accent = false }: { data: (number | null)[]; accent?: boolean }) {
  const vals = data.filter((v): v is number => v !== null)
  if (vals.length < 2) return <svg className="h-8 w-24" aria-hidden="true" />
  const lo = Math.min(...vals)
  const hi = Math.max(...vals)
  const span = hi - lo || 1
  const pts = vals.map((v, i) => `${((i / (vals.length - 1)) * 92 + 2).toFixed(1)},${(26 - ((v - lo) / span) * 22).toFixed(1)}`)
  return (
    <svg viewBox="0 0 96 28" className="h-8 w-24" aria-hidden="true">
      <polyline points={pts.join(' ')} fill="none" stroke={accent ? 'var(--good)' : 'rgb(var(--tint-rgb) / 0.55)'} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function ChartTooltip({ active, payload, label, format }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="glass-strong rounded-xl px-3 py-2 text-xs">
      <p className="mb-1 font-medium text-muted-foreground">{label}</p>
      {payload
        .filter((p: any) => p.value !== null && p.value !== undefined && p.name)
        .map((p: any) => (
          <p key={p.dataKey} className="flex items-center gap-2 font-semibold tabular">
            <i className="size-1.5 rounded-full" style={{ background: p.color === 'none' ? p.fill : p.color }} />
            <span className="font-normal text-muted-foreground">{p.name}</span>
            {format ? format(p.value) : p.value}
          </p>
        ))}
    </div>
  )
}

export const axis = { tickLine: false, axisLine: false, tick: { fontSize: 11, fill: 'var(--faint)' } } as const

export function ErrorBox({ message, action }: { message: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-bad/25 bg-bad-soft px-4 py-3 text-sm text-bad">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <div className="space-y-1">
        <p>{message}</p>
        {action}
      </div>
    </div>
  )
}

export function Empty({ icon: Icon, title, text }: { icon: any; title: string; text: string }) {
  return (
    <Card className="flex min-h-64 items-center justify-center p-8">
      <div className="max-w-sm text-center">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-tint/[0.06] text-muted-foreground">
          <Icon className="size-5" />
        </div>
        <h2 className="font-semibold">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
      </div>
    </Card>
  )
}

export function PageSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading company data">
      <div className="skeleton h-9 w-72" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i} className="space-y-3 p-4">
            <div className="skeleton h-9 w-9" />
            <div className="skeleton h-3 w-20" />
            <div className="skeleton h-7 w-32" />
          </Card>
        ))}
      </div>
      <Card className="p-5">
        <div className="skeleton h-72 w-full" />
      </Card>
    </div>
  )
}

export function Mark({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const s = size === 'lg' ? 'size-10 text-base' : size === 'sm' ? 'size-7 text-xs' : 'size-9 text-sm'
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-xl border border-role/40 bg-gradient-to-b from-role/[0.38] to-role/[0.10] font-mono font-semibold text-foreground shadow-[inset_0_1px_0_rgb(var(--tint-rgb) / 0.18)] ${s}`}>
      N
    </span>
  )
}
