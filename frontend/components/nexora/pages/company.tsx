'use client'

import { useEffect, useMemo, useState } from 'react'
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react'
import {
  ApiError, createKpi, deleteCompany, deleteKpi, describeError, updateCompany, updateKpi, type KPI,
} from '@/lib/nexora/api'
import { trailingYear } from '@/lib/nexora/data'
import { amount, compact, monthLabel, titleCase } from '@/lib/nexora/format'
import type { Action } from '@/lib/nexora/permissions'
import { AccessRestricted, Badge, Card, ConfirmButton, Field, inputCls, Notice, PageTitle, SectionHeader } from '../ui'
import { useWorkspace } from '../workspace'

// Actions can be opened from the URL (#company/edit, #kpi/new, ...), so a shared link to an action
// the viewer's role can't perform shows "Access restricted" instead of a form.
type Mode = null | 'company/edit' | 'kpi/new'
const MODE_ACTION: Record<Exclude<Mode, null>, [Action, string]> = {
  'company/edit': ['company:update', 'edit company details'],
  'kpi/new': ['kpi:create', 'add KPI records'],
}
const readMode = (): Mode => {
  const h = typeof window === 'undefined' ? '' : window.location.hash.replace('#', '')
  return h === 'company/edit' || h === 'kpi/new' ? h : null
}
const setHash = (m: Mode) => history.replaceState(null, '', m ? `#${m}` : window.location.pathname + window.location.search)

const PAGE = 24

export function CompanyPage() {
  const { company, data, unit, can, session, reload, reloadCompanies, expired, go } = useWorkspace()
  const [mode, setModeState] = useState<Mode>(null)
  const [msg, setMsg] = useState<{ tone: 'good' | 'bad'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [metricFilter, setMetricFilter] = useState('all')
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    const sync = () => setModeState(readMode())
    sync()
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [])
  const setMode = (m: Mode) => { setHash(m); setModeState(m); setMsg(null) }

  const kpis = useMemo(
    () => [...(data?.kpis ?? [])].sort((a, b) => b.metric_date.localeCompare(a.metric_date) || a.metric_name.localeCompare(b.metric_name)),
    [data],
  )
  if (!company || !data) return null
  const rows = data.rows
  const metrics = [...new Set(data.kpis.map((k) => k.metric_name))].sort()
  const ty = trailingYear(rows, 'revenue')
  const shown = kpis.filter((k) => metricFilter === 'all' || k.metric_name === metricFilter)
  const visible = showAll ? shown : shown.slice(0, PAGE)

  /** Run a write, then refetch so every chart, the forecast and summaries use the new numbers. */
  async function write(run: () => Promise<unknown>, ok: string, ctx: Parameters<typeof describeError>[1] = {}, after?: () => Promise<void> | void) {
    setBusy(true)
    setMsg(null)
    try {
      await run()
      await (after ? after() : reload())
      setMsg({ tone: 'good', text: ok })
      return true
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) { expired(); return false }
      setMsg({ tone: 'bad', text: describeError(err, ctx) })
      return false
    } finally {
      setBusy(false)
    }
  }

  const restricted = mode && !can(MODE_ACTION[mode][0])

  return (
    <div className="flex flex-col gap-6">
      <PageTitle
        title="Company overview"
        subtitle="What NEXORA holds for this company."
        action={
          <div className="flex flex-wrap items-center gap-2">
            {can('company:update') && mode !== 'company/edit' && (
              <button type="button" className="button-secondary" onClick={() => setMode('company/edit')}><Pencil className="size-3.5" /> Edit details</button>
            )}
            {can('company:delete') && (
              <ConfirmButton
                busy={busy}
                label={<><Trash2 className="size-3.5" /> Delete company</>}
                confirmLabel={`Delete ${company.name}?`}
                onConfirm={() =>
                  write(
                    () => deleteCompany(company.id, session.token),
                    `${company.name} was deleted.`,
                    { conflict: `${company.name} still has KPI records (or other records linked to it), so it can't be deleted. Delete its KPI records first.` },
                    async () => { await reloadCompanies(); go('Dashboard') },
                  )
                }
              />
            )}
          </div>
        }
      />

      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      {restricted && <AccessRestricted what={MODE_ACTION[mode!][1]} onBack={() => setMode(null)} />}

      {mode === 'company/edit' && !restricted ? (
        <CompanyForm
          key={company.id}
          initial={{ name: company.name, industry: company.industry ?? '', description: company.description ?? '' }}
          busy={busy}
          onCancel={() => setMode(null)}
          onSave={async (v) => {
            const ok = await write(
              () => updateCompany(company.id, { name: v.name.trim(), industry: v.industry.trim() || null, description: v.description.trim() || null }, session.token),
              'Company details saved.',
              { conflict: 'Another company already has that name.', notFound: 'This company no longer exists.' },
              () => reloadCompanies(company.id),
            )
            if (ok) setMode(null)
          }}
        />
      ) : (
        <Card strong className="p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <div className="flex size-16 items-center justify-center rounded-2xl border border-tint/15 bg-gradient-to-b from-tint/[0.14] to-tint/[0.03] text-2xl font-semibold">
              {company.name.charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-semibold">{company.name}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{company.industry ?? 'Industry not set'} · company id {company.id}</p>
            </div>
            <Badge tone="good">In the database</Badge>
          </div>
          {company.description && <p className="mt-5 max-w-[70ch] text-sm leading-6 text-muted-foreground">{company.description}</p>}
          <div className="mt-6 grid gap-5 border-t border-border pt-5 sm:grid-cols-2 lg:grid-cols-5">
            {[
              ['Data from', monthLabel(rows[0]?.date)],
              ['Data to', monthLabel(rows.at(-1)?.date)],
              ['Months of data', String(rows.length)],
              ['KPI rows', String(data.kpis.length)],
              ['Revenue, last 12 months', compact(ty.curr, unit)],
            ].map(([l, v]) => (
              <div key={l}>
                <p className="text-xs text-muted-foreground">{l}</p>
                <p className="mt-1 text-sm font-semibold tabular">{v || 'n/a'}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5">
          <div>
            <h2 className="text-[15px] font-semibold">KPI records</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Rows in the kpis table, newest first.{can('kpi:update') ? ' Edit a value and every chart, the forecast and the analyst use it straight away.' : ''}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select value={metricFilter} onChange={(e) => setMetricFilter(e.target.value)} className={`${inputCls} h-9 w-auto`} aria-label="Filter by metric">
              <option value="all" className="bg-popover">All metrics</option>
              {metrics.map((m) => <option key={m} value={m} className="bg-popover">{titleCase(m)}</option>)}
            </select>
            {can('kpi:create') && mode !== 'kpi/new' && (
              <button type="button" className="button-primary" onClick={() => setMode('kpi/new')}><Plus className="size-3.5" /> Add KPI</button>
            )}
          </div>
        </div>

        {mode === 'kpi/new' && !restricted && (
          <NewKpiForm
            metrics={metrics}
            busy={busy}
            onCancel={() => setMode(null)}
            onSave={async (v) => {
              const ok = await write(
                () => createKpi(company.id, v, session.token),
                `${titleCase(v.metric_name)} for ${monthLabel(v.metric_date)} added.`,
                { notFound: 'This company no longer exists.' },
              )
              if (ok) setMode(null)
            }}
          />
        )}

        <div className="max-h-[560px] overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-popover/95 text-xs text-muted-foreground backdrop-blur">
              <tr>
                {['Date', 'Metric', 'Value', ''].map((h, i) => <th key={i} className={`px-5 py-3 font-medium ${i === 3 ? 'text-right' : ''}`}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {visible.map((k) => (
                <KpiRow
                  key={k.id}
                  kpi={k}
                  unit={unit}
                  canEdit={can('kpi:update')}
                  canDelete={can('kpi:delete')}
                  busy={busy}
                  onSave={(value) => write(() => updateKpi(k.id, { metric_value: value }, session.token), `${titleCase(k.metric_name)} for ${monthLabel(k.metric_date)} updated.`)}
                  onDelete={() => write(() => deleteKpi(k.id, session.token), `${titleCase(k.metric_name)} for ${monthLabel(k.metric_date)} deleted.`)}
                />
              ))}
              {visible.length === 0 && (
                <tr><td colSpan={4} className="px-5 py-8 text-center text-sm text-muted-foreground">No KPI records for this company yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {shown.length > PAGE && (
          <div className="border-t border-border p-3 text-center">
            <button type="button" className="button-ghost" onClick={() => setShowAll((s) => !s)}>
              {showAll ? `Show the newest ${PAGE}` : `Show all ${shown.length} rows`}
            </button>
          </div>
        )}
      </Card>
    </div>
  )
}

function KpiRow({ kpi, unit, canEdit, canDelete, busy, onSave, onDelete }: {
  kpi: KPI; unit: string | null; canEdit: boolean; canDelete: boolean; busy: boolean
  onSave: (v: number) => Promise<boolean>; onDelete: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(kpi.metric_value))
  const value = Number(draft)
  const valid = draft.trim() !== '' && Number.isFinite(value)

  return (
    <tr className="border-t border-border/70 transition hover:bg-tint/[0.025]">
      <td className="px-5 py-2.5 tabular text-muted-foreground">{kpi.metric_date}</td>
      <td className="px-5 py-2.5 font-medium">{titleCase(kpi.metric_name)}</td>
      <td className="px-5 py-2.5 tabular">
        {editing ? (
          <form
            className="flex items-center gap-1.5"
            onSubmit={async (e) => {
              e.preventDefault()
              if (!valid) return
              if (await onSave(value)) setEditing(false)
            }}
          >
            <input autoFocus inputMode="decimal" value={draft} onChange={(e) => setDraft(e.target.value)} aria-label={`New value for ${kpi.metric_name} on ${kpi.metric_date}`} className={`${inputCls} h-8 w-40`} />
            <button type="submit" disabled={busy || !valid} className="icon-button size-8" aria-label="Save"><Check className="size-4" /></button>
            <button type="button" onClick={() => { setEditing(false); setDraft(String(kpi.metric_value)) }} className="icon-button size-8" aria-label="Cancel"><X className="size-4" /></button>
          </form>
        ) : (
          amount(kpi.metric_value, unit)
        )}
      </td>
      <td className="px-5 py-2.5 text-right">
        <span className="inline-flex items-center gap-1">
          {canEdit && !editing && (
            <button type="button" onClick={() => { setDraft(String(kpi.metric_value)); setEditing(true) }} className="button-ghost" aria-label={`Edit ${kpi.metric_name} on ${kpi.metric_date}`}><Pencil className="size-3.5" /> Edit</button>
          )}
          {canDelete && !editing && (
            <ConfirmButton busy={busy} label={<Trash2 className="size-3.5" />} confirmLabel="Delete row?" onConfirm={onDelete} />
          )}
        </span>
      </td>
    </tr>
  )
}

function CompanyForm({ initial, busy, onSave, onCancel }: {
  initial: { name: string; industry: string; description: string }; busy: boolean
  onSave: (v: { name: string; industry: string; description: string }) => void; onCancel: () => void
}) {
  const [v, setV] = useState(initial)
  return (
    <Card strong className="p-6">
      <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); if (v.name.trim()) onSave(v) }}>
        <Field label="Company name"><input required maxLength={150} value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} className={inputCls} /></Field>
        <Field label="Industry"><input value={v.industry} onChange={(e) => setV({ ...v, industry: e.target.value })} className={inputCls} /></Field>
        <div className="sm:col-span-2">
          <Field label="Description">
            <textarea rows={3} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} className={`${inputCls} h-auto py-2`} />
          </Field>
        </div>
        <div className="flex gap-2 sm:col-span-2">
          <button type="submit" disabled={busy || !v.name.trim()} className="button-primary">Save details</button>
          <button type="button" onClick={onCancel} className="button-secondary">Cancel</button>
        </div>
      </form>
    </Card>
  )
}

export function NewCompanyForm({ busy, onSave, onCancel }: { busy: boolean; onSave: (v: { name: string; industry: string; description: string }) => void; onCancel: () => void }) {
  return <CompanyForm initial={{ name: '', industry: '', description: '' }} busy={busy} onSave={onSave} onCancel={onCancel} />
}

function NewKpiForm({ metrics, busy, onSave, onCancel }: {
  metrics: string[]; busy: boolean; onSave: (v: { metric_name: string; metric_value: number; metric_date: string }) => void; onCancel: () => void
}) {
  const [metric, setMetric] = useState(metrics[0] ?? 'revenue')
  const [date, setDate] = useState('')
  const [value, setValue] = useState('')
  const n = Number(value)
  const valid = metric.trim() !== '' && date !== '' && value.trim() !== '' && Number.isFinite(n)
  return (
    <form
      className="grid gap-3 border-b border-border bg-tint/[0.02] p-5 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end"
      onSubmit={(e) => { e.preventDefault(); if (valid) onSave({ metric_name: metric.trim(), metric_value: n, metric_date: date }) }}
    >
      <Field label="Metric">
        <input list="kpi-metrics" required value={metric} onChange={(e) => setMetric(e.target.value)} className={inputCls} />
        <datalist id="kpi-metrics">{metrics.map((m) => <option key={m} value={m} />)}</datalist>
      </Field>
      <Field label="Date"><input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} /></Field>
      <Field label="Value"><input inputMode="decimal" required value={value} onChange={(e) => setValue(e.target.value)} className={inputCls} /></Field>
      <div className="flex gap-2">
        <button type="submit" disabled={busy || !valid} className="button-primary h-10">Add</button>
        <button type="button" onClick={onCancel} className="button-secondary h-10">Cancel</button>
      </div>
    </form>
  )
}
