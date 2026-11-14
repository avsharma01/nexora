'use client'

// CSV picker shared by "New company" (Portfolio) and "Import CSV" (Company page).
// The file is read in the browser and sent as text; the backend validates every row
// (backend/app/services/kpi_import.py) and imports all of it or nothing.

import { useRef, useState } from 'react'
import { Download, FileSpreadsheet, X } from 'lucide-react'
import type { ImportResult } from '@/lib/nexora/api'
import { download } from '@/lib/nexora/data'
import { monthLabel, titleCase } from '@/lib/nexora/format'

const TEMPLATE = [
  'period,revenue,expenses,profit',
  '2025-01,520000,370000,150000',
  '2025-02,531000,372500,158500',
  '2025-03,540250,378000,',
].join('\n')

const MAX_BYTES = 1_000_000

export interface PickedCsv {
  name: string
  text: string
  rows: number
  columns: string[]
}

export function CsvPicker({ value, onChange, disabled }: { value: PickedCsv | null; onChange: (v: PickedCsv | null) => void; disabled?: boolean }) {
  const input = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)

  async function pick(file: File | undefined) {
    setError(null)
    if (!file) return
    if (file.size > MAX_BYTES) return setError('That file is larger than 1 MB.')
    const text = await file.text()
    const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim())
    if (lines.length < 2) return setError('The file needs a header row and at least one month.')
    const sep = (lines[0].match(/;/g)?.length ?? 0) > (lines[0].match(/,/g)?.length ?? 0) ? ';' : ','
    // A row saved as one quoted cell ("period,revenue,...") is unwrapped; the backend does the same.
    const header = /^".*"$/.test(lines[0].trim()) ? lines[0].trim().slice(1, -1) : lines[0]
    onChange({ name: file.name, text, rows: lines.length - 1, columns: header.split(sep).map((c) => c.trim().replace(/^"|"$/g, '')) })
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <input ref={input} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = '' }} />
        {value ? (
          <span className="inline-flex max-w-full items-center gap-2 rounded-[10px] border border-role/30 bg-role/[0.08] px-3 py-2 text-xs">
            <FileSpreadsheet className="size-3.5 shrink-0 text-role" />
            <span className="truncate font-medium">{value.name}</span>
            <span className="shrink-0 text-muted-foreground">{value.rows} {value.rows === 1 ? 'month' : 'months'} · {value.columns.slice(1).map(titleCase).join(', ')}</span>
            <button type="button" disabled={disabled} onClick={() => onChange(null)} className="text-muted-foreground hover:text-foreground" aria-label="Remove file"><X className="size-3.5" /></button>
          </span>
        ) : (
          <button type="button" disabled={disabled} onClick={() => input.current?.click()} className="button-secondary">
            <FileSpreadsheet className="size-3.5" /> Choose CSV file
          </button>
        )}
        <button type="button" onClick={() => download('nexora-monthly-template.csv', TEMPLATE)} className="button-ghost">
          <Download className="size-3.5" /> Template
        </button>
      </div>
      <p className="text-[11px] leading-5 text-muted-foreground">
        One row per <span className="font-medium text-foreground/80">month</span> (period like 2025-01), then a column per metric.
        Every column becomes a metric with its own charts, forecast and AI answers. Extra columns (customers, orders, cash balance, …)
        are combined into quarters and years by type: totals for flows, end-of-period for counts, averages for rates.
        Missing profit is calculated as revenue − expenses.
      </p>
      {error && <p className="text-xs text-bad">{error}</p>}
    </div>
  )
}

/** Backend validation errors arrive one per line; show them as a list. */
export function ImportErrors({ message }: { message: string }) {
  const lines = message.split('\n').filter(Boolean)
  return (
    <div role="alert" className="rounded-xl border border-bad/25 bg-bad-soft px-3 py-2 text-sm text-bad">
      <p className="font-medium">The CSV wasn't imported. Nothing was saved.</p>
      <ul className="mt-1 list-disc pl-5 text-xs leading-5">
        {lines.map((l, i) => <li key={i}>{l}</li>)}
      </ul>
    </div>
  )
}

export function importSummary(r: ImportResult): string {
  const span = r.months === 1 ? monthLabel(r.first_month) : `${monthLabel(r.first_month)} – ${monthLabel(r.last_month)}`
  const parts = [`${r.months} ${r.months === 1 ? 'month' : 'months'} (${span})`, `metrics: ${r.metrics.map(titleCase).join(', ')}`]
  if (r.updated) parts.push(`${r.updated} existing ${r.updated === 1 ? 'value' : 'values'} replaced`)
  if (r.profit_computed) parts.push(`profit calculated for ${r.profit_computed} ${r.profit_computed === 1 ? 'month' : 'months'}`)
  return parts.join(' · ')
}
