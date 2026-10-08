'use client'

import { useEffect, useRef, useState } from 'react'
import {
  ArrowUp, BadgeCheck, Bot, Check, Copy, Database, FileText, Info, Ban, RotateCw, Trash2, TriangleAlert,
} from 'lucide-react'
import { ApiError, askAnalyst, describeError, type AiResponse, type ChatTurn } from '@/lib/nexora/api'
import { amount, periodLabel } from '@/lib/nexora/format'
import { Badge, Card, PageTitle } from '../ui'
import { useWorkspace } from '../workspace'

export type ChatMessage =
  | { id: string; role: 'user'; text: string }
  | { id: string; role: 'assistant'; state: 'loading'; question: string }
  | { id: string; role: 'assistant'; state: 'done'; question: string; res: AiResponse }
  | { id: string; role: 'assistant'; state: 'error'; question: string; error: string }

const MAX = 500
const SUGGESTIONS = [
  'How is the company doing?',
  'How has revenue trended over the last 6 months?',
  'Which month had the highest expenses?',
  'Did costs grow faster than revenue over the last 12 months?',
  'Why did profit change in the latest month?',
  'What risks did the board mention?',
]

const uid = () => Math.random().toString(36).slice(2, 10)

/** 3-letter figure units ("INR", "USD") tell us the company's currency. */
export function currencyOf(res: AiResponse) {
  return res.figures.find((f) => f.unit && /^[A-Z]{3}$/.test(f.unit))?.unit ?? null
}

export function errorText(err: unknown) {
  if (err instanceof ApiError && err.status === 503) return 'The AI service is busy or unavailable right now. Try again in a moment.'
  return describeError(err, { notFound: 'This company no longer exists in the database.' })
}

export function AnalystPage() {
  const { company, session, chats, setChat, expired, learnUnit } = useWorkspace()
  const [draft, setDraft] = useState('')
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const messages = company ? chats[company.id] ?? [] : []
  const busy = messages.some((m) => m.role === 'assistant' && m.state === 'loading')

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [messages.length, busy])

  if (!company) return null
  const id = company.id

  async function ask(question: string, replaceId?: string) {
    const q = question.trim()
    if (!q || busy) return
    const history: ChatTurn[] = []
    for (const m of messages) {
      if (m.role === 'user') history.push({ role: 'user', content: m.text })
      else if (m.state === 'done') history.push({ role: 'assistant', content: m.res.answer })
    }
    const pending = replaceId ?? uid()
    setChat(id, (prev) =>
      replaceId
        ? prev.map((m) => (m.id === replaceId ? { id: pending, role: 'assistant', state: 'loading', question: q } : m))
        : [...prev, { id: uid(), role: 'user', text: q }, { id: pending, role: 'assistant', state: 'loading', question: q }],
    )
    try {
      const res = await askAnalyst(id, q, history, session.token)
      const cur = currencyOf(res)
      if (cur) learnUnit(id, cur)
      setChat(id, (prev) => prev.map((m) => (m.id === pending ? { id: pending, role: 'assistant', state: 'done', question: q, res } : m)))
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return expired()
      setChat(id, (prev) => prev.map((m) => (m.id === pending ? { id: pending, role: 'assistant', state: 'error', question: q, error: errorText(err) } : m)))
    }
  }

  function submit(e?: React.FormEvent) {
    e?.preventDefault()
    if (!draft.trim() || draft.length > MAX) return
    ask(draft)
    setDraft('')
    inputRef.current?.focus()
  }

  return (
    <div className="flex flex-col gap-6">
      <PageTitle
        title="AI business analyst"
        subtitle={<>Ask about {company.name}. Numbers are computed from its KPIs and checked before you see them.</>}
        action={<Badge tone="good"><BadgeCheck className="size-3" /> Live: your RAG pipeline</Badge>}
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <Card strong className="flex h-[calc(100dvh-15rem)] min-h-[520px] flex-col overflow-hidden">
          <div className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-5">
            <span className="flex size-8 items-center justify-center rounded-lg bg-good-soft text-good"><Bot className="size-4" /></span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Analyst</p>
              <p className="truncate text-[11px] text-muted-foreground">Answers about {company.name} only</p>
            </div>
            {messages.length > 0 && (
              <button type="button" onClick={() => setChat(id, () => [])} disabled={busy} className="button-ghost disabled:opacity-40">
                <Trash2 className="size-3.5" /> Clear
              </button>
            )}
          </div>

          <div className="flex-1 space-y-6 overflow-y-auto px-5 py-6" aria-live="polite">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-start justify-end gap-3 pb-2">
                <p className="text-lg font-semibold tracking-tight">What would you like to know?</p>
                <p className="max-w-[52ch] text-sm leading-6 text-muted-foreground">
                  Reasons are quoted from company documents when they exist. When the data cannot answer, the analyst says so instead of guessing.
                </p>
              </div>
            ) : (
              messages.map((m) =>
                m.role === 'user' ? (
                  <div key={m.id} className="rise flex justify-end">
                    <p className="max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm leading-6 text-primary-foreground">{m.text}</p>
                  </div>
                ) : (
                  <AssistantMessage key={m.id} message={m} onRetry={() => ask(m.question, m.id)} />
                ),
              )
            )}
            <div ref={endRef} />
          </div>

          <form onSubmit={submit} className="shrink-0 border-t border-border bg-tint/[0.02] p-3">
            <label htmlFor="question" className="sr-only">Your question</label>
            <div className="flex items-end gap-2 rounded-xl border border-input bg-tint/[0.03] px-3 py-2 focus-within:border-tint/30 focus-within:ring-2 focus-within:ring-tint/10">
              <textarea
                id="question"
                ref={inputRef}
                rows={1}
                value={draft}
                placeholder={`Ask about ${company.name}…`}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit() } }}
                className="field-sizing-content max-h-36 min-w-0 flex-1 resize-none bg-transparent text-sm leading-6 outline-none placeholder:text-faint"
              />
              <button type="submit" disabled={busy || !draft.trim() || draft.length > MAX} aria-label="Send question" className="button-primary size-9 justify-center px-0">
                <ArrowUp className="size-4" />
              </button>
            </div>
            <div className="flex justify-between px-1 pt-1.5 text-[11px] text-faint">
              <span>Enter to send · Shift + Enter for a new line</span>
              <span className={`tabular ${draft.length > MAX ? 'text-bad' : ''}`}>{draft.length > MAX - 100 ? `${draft.length} / ${MAX}` : ''}</span>
            </div>
          </form>
        </Card>

        <Card className="h-fit p-5">
          <h2 className="text-sm font-semibold">Try asking</h2>
          <div className="mt-4 flex flex-col gap-2">
            {SUGGESTIONS.map((s) => (
              <button key={s} type="button" disabled={busy} onClick={() => ask(s)} className="rounded-xl border border-border bg-tint/[0.02] p-3 text-left text-xs leading-5 text-muted-foreground transition hover:border-tint/20 hover:text-foreground disabled:opacity-50">
                {s}
              </button>
            ))}
          </div>
          <div className="mt-5 space-y-2 border-t border-border pt-4 text-[11px] leading-5 text-muted-foreground">
            <p><span className="font-mono text-good">F1</span> tags are facts computed in Python from the KPIs.</p>
            <p><span className="font-mono text-good">D1</span> tags are excerpts from the company's own documents.</p>
            <p>Off-topic questions, other companies and investment advice are refused before the model is called.</p>
          </div>
        </Card>
      </div>
    </div>
  )
}

export function AssistantMessage({ message, onRetry }: { message: Exclude<ChatMessage, { role: 'user' }>; onRetry?: () => void }) {
  const [flash, setFlash] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  if (message.state === 'loading') {
    return (
      <div className="max-w-[90%] space-y-2.5" aria-label="The analyst is checking the numbers">
        <p className="text-xs text-muted-foreground">Computing facts and checking the numbers…</p>
        <div className="skeleton h-4 w-[92%]" />
        <div className="skeleton h-4 w-[76%]" />
        <div className="skeleton h-4 w-[60%]" />
      </div>
    )
  }

  if (message.state === 'error') {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-bad/25 bg-bad-soft px-4 py-3 text-sm text-bad">
        <TriangleAlert className="mt-0.5 size-4 shrink-0" />
        <div className="space-y-2">
          <p>{message.error}</p>
          {onRetry && (
            <button type="button" onClick={onRetry} className="inline-flex items-center gap-1.5 font-semibold underline-offset-4 hover:underline">
              <RotateCw className="size-3.5" /> Try again
            </button>
          )}
        </div>
      </div>
    )
  }

  const { res } = message
  const known = new Set(res.sources.map((s) => s.id))

  function showSource(id: string) {
    setFlash(null)
    requestAnimationFrame(() => setFlash(id))
    document.getElementById(`${message.id}-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(res.answer)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { /* clipboard refused */ }
  }

  if (res.status !== 'answered') {
    const out = res.status === 'out_of_scope'
    const Icon = out ? Ban : Info
    return (
      <div className={`rise flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm leading-6 ${out ? 'border-border bg-tint/[0.03]' : 'border-warn/25 bg-warn-soft'}`}>
        <Icon className={`mt-1 size-4 shrink-0 ${out ? 'text-muted-foreground' : 'text-warn'}`} />
        <div className="space-y-1">
          <p className={`text-[11px] font-semibold uppercase tracking-wide ${out ? 'text-muted-foreground' : 'text-warn'}`}>{out ? 'Outside what I can answer' : 'Not in the data'}</p>
          <p>{res.answer}</p>
        </div>
      </div>
    )
  }

  return (
    <article className="rise space-y-4">
      <div className="space-y-2 text-sm leading-6">
        <AnswerText text={res.answer} known={known} onTag={showSource} />
      </div>

      {res.figures.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2">
          {res.figures.slice(0, 4).map((f, i) => (
            <div key={i} className="rounded-xl border border-border bg-tint/[0.03] px-3 py-2.5">
              <p className="truncate text-[11px] text-muted-foreground" title={f.label}>{f.label}</p>
              <p className="text-sm font-semibold tabular">{amount(f.value, f.unit)}</p>
              <p className="text-[11px] text-faint">{periodLabel(f.period)}{f.kind !== 'historical' ? ` · ${f.kind}` : ''}</p>
            </div>
          ))}
        </div>
      )}

      {res.sources.length > 0 && (
        <ul className="space-y-1">
          {res.sources.map((s) => {
            const Icon = s.type === 'document' ? FileText : Database
            return (
              <li key={s.id} id={`${message.id}-${s.id}`} className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-xs ${flash === s.id ? 'flash' : ''}`}>
                <span className="rounded-full bg-good-soft px-2 py-0.5 font-mono text-[11px] text-good">{s.id}</span>
                <Icon className="size-3.5 shrink-0 text-faint" />
                <span className="truncate text-muted-foreground">{s.label}</span>
              </li>
            )
          })}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-3 text-[11px]">
        {res.is_grounded ? (
          <span className="inline-flex items-center gap-1.5 text-good"><BadgeCheck className="size-3.5" /> Every number checked against the data</span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-bad"><TriangleAlert className="size-3.5" /> Numbers could not be verified</span>
        )}
        <button type="button" onClick={copy} className="ml-auto inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />} {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </article>
  )
}

const TAG_RE = /\[((?:[FD]\d+)(?:\s*,\s*[FD]\d+)*)\]/g

export function AnswerText({ text, known, onTag }: { text: string; known: Set<string>; onTag?: (id: string) => void }) {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
  const lead = lines.filter((l) => !l.startsWith('- '))
  const bullets = lines.filter((l) => l.startsWith('- ')).map((l) => l.slice(2))
  return (
    <>
      {lead.map((l, i) => <p key={i} className={i === 0 ? 'font-medium' : ''}>{withTags(l, known, onTag)}</p>)}
      {bullets.length > 0 && (
        <ul className="list-disc space-y-1.5 pl-4 text-foreground/85 marker:text-faint">
          {bullets.map((b, i) => <li key={i}>{withTags(b, known, onTag)}</li>)}
        </ul>
      )}
    </>
  )
}

function withTags(line: string, known: Set<string>, onTag?: (id: string) => void) {
  const parts: React.ReactNode[] = []
  let last = 0
  for (const match of line.matchAll(TAG_RE)) {
    parts.push(line.slice(last, match.index))
    match[1].split(/\s*,\s*/).forEach((id) =>
      parts.push(
        known.has(id) && onTag ? (
          <button key={`${match.index}-${id}`} type="button" onClick={() => onTag(id)} className="mx-0.5 rounded-full bg-good-soft px-1.5 py-px align-baseline font-mono text-[11px] text-good transition hover:bg-good hover:text-black">
            {id}
          </button>
        ) : (
          <span key={`${match.index}-${id}`} className="mx-0.5 rounded-full bg-good-soft px-1.5 py-px font-mono text-[11px] text-good">{id}</span>
        ),
      ),
    )
    last = (match.index ?? 0) + match[0].length
  }
  parts.push(line.slice(last))
  return parts
}
