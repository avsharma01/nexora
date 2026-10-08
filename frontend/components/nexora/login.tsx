'use client'

import { useEffect, useState } from 'react'
import { ArrowUpRight, Eye, EyeOff, Loader2, TriangleAlert } from 'lucide-react'
import { ApiError, describeError, health, login, register, type Session } from '@/lib/nexora/api'
import { DEMO_ACCOUNTS, DEMO_ENABLED } from '@/lib/nexora/demo'
import { ThemeToggle } from './theme-toggle'
import { Mark } from './ui'


export function Login({ onSignedIn, notice }: { onSignedIn: (s: Session) => void; notice?: string }) {
  const [signup, setSignup] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [backend, setBackend] = useState<'checking' | 'up' | 'down'>('checking')

  useEffect(() => {
    let alive = true
    const check = () => health().then(() => alive && setBackend('up')).catch(() => alive && setBackend('down'))
    check()
    const t = setInterval(check, 10000)
    return () => { alive = false; clearInterval(t) }
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (signup && password !== confirm) return setError('The two passwords do not match.')
    setBusy(true)
    setError(null)
    try {
      if (signup) await register(email.trim(), password)
      onSignedIn(await login(email.trim(), password))
    } catch (err) {
      // 401 here means wrong email/password (not an expired session), so show the backend's message.
      setError(err instanceof ApiError && err.status === 401 ? err.message : describeError(err, { conflict: 'That email is already registered. Sign in instead.' }))
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="flex min-h-[100dvh]">
      <div className="relative hidden flex-1 flex-col justify-between overflow-hidden border-r border-tint/[0.06] p-10 lg:flex">
        <div className="flex items-center gap-3">
          <Mark />
          <span className="font-mono text-sm font-semibold tracking-[0.24em]">NEXORA</span>
        </div>
        <div className="max-w-xl">
          <p className="font-mono text-xs tracking-[0.2em] text-muted-foreground">AI COMPANY INTELLIGENCE PLATFORM</p>
          <h1 className="mt-5 text-5xl font-semibold leading-[1.05] tracking-[-0.03em]">
            Understand your business.
            <br />
            <span className="text-muted-foreground">Predict what comes next.</span>
          </h1>
          <p className="mt-6 max-w-md text-base leading-7 text-muted-foreground">
            Ask questions about your company's data. Every number is computed from your KPIs and checked before you see it.
          </p>
          <div className="mt-10 grid max-w-lg grid-cols-3 gap-3">
            {[['Grounded', 'numbers checked'], ['Cited', 'facts & documents'], ['Scoped', 'one company at a time']].map(([a, b]) => (
              <div key={a} className="glass rounded-2xl p-4">
                <p className="text-sm font-semibold">{a}</p>
                <p className="mt-1 text-xs text-muted-foreground">{b}</p>
              </div>
            ))}
          </div>
        </div>
        <svg viewBox="0 0 600 160" className="w-full max-w-xl opacity-80" aria-hidden="true">
          <defs>
            <linearGradient id="lg" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#3ecf9a" stopOpacity=".25" /><stop offset="1" stopColor="#3ecf9a" stopOpacity="0" /></linearGradient>
          </defs>
          <path d="M0 150 L0 125 C 80 90,105 115,170 85 S270 115,330 55 S445 85,600 12 L600 160 L0 160Z" fill="url(#lg)" />
          <path d="M0 125 C 80 90, 105 115, 170 85 S 270 115, 330 55 S 445 85, 600 12" fill="none" stroke="#3ecf9a" strokeWidth="2.5" />
          <path d="M0 150 C 100 130, 150 140, 220 105 S 330 128, 390 90 S 500 112, 600 60" fill="none" stroke="rgb(var(--tint-rgb) / 0.45)" strokeWidth="2" strokeDasharray="6 5" />
        </svg>
      </div>

      <div className="flex w-full flex-col justify-center p-6 sm:p-12 lg:w-[540px] lg:p-16">
        <div className="mb-10 flex items-center justify-between">
          <div className="flex items-center gap-3 lg:invisible">
            <Mark size="sm" />
            <span className="font-mono text-sm font-semibold tracking-[0.24em]">NEXORA</span>
          </div>
          <div className="flex items-center">
          <span className="glass inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] text-muted-foreground" role="status">
            <span className="relative flex size-2">
              {backend === 'up' && <span className="absolute inset-0 animate-ping rounded-full bg-good opacity-60" />}
              <span className={`relative size-2 rounded-full ${backend === 'up' ? 'bg-good' : backend === 'down' ? 'bg-bad' : 'bg-faint'}`} />
            </span>
            {backend === 'up' ? 'Backend connected' : backend === 'down' ? 'Backend offline' : 'Checking backend'}
          </span>
          <ThemeToggle className="ml-2" />
          </div>
        </div>

        <form onSubmit={submit} noValidate className="glass-strong rise rounded-3xl p-7 sm:p-8">
          <p className="text-sm font-medium text-muted-foreground">{signup ? 'Create your account' : 'Welcome back'}</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight">{signup ? 'Join your workspace' : 'Sign in to Nexora'}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{signup ? 'New accounts start as Viewer, which can use every page.' : 'Use your NEXORA backend account.'}</p>

          {notice && !error && <p className="mt-6 rounded-xl border border-warn/25 bg-warn-soft px-3 py-2 text-sm text-warn">{notice}</p>}

          {DEMO_ENABLED && !signup && (
            <div className="mt-6 rounded-2xl border border-dashed border-tint/20 p-3">
              <p className="px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Demo accounts · fill in, then press Sign in</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                {DEMO_ACCOUNTS.map((a) => (
                  <button
                    key={a.email}
                    type="button"
                    onClick={() => { setEmail(a.email); setPassword(a.password); setError(null) }}
                    aria-pressed={email === a.email}
                    className={`rounded-xl border px-3 py-2 text-left transition ${email === a.email ? 'border-tint/30 bg-tint/[0.08]' : 'border-border bg-tint/[0.02] hover:bg-tint/[0.05]'}`}
                  >
                    <span className="block text-xs font-semibold">Sign in as {a.label}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">{a.email}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-7 flex flex-col gap-4">
            <label className="text-sm font-medium">
              Work email
              <input className="auth-input" type="email" autoComplete="email" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label className="text-sm font-medium">
              Password
              <span className="relative block">
                <input className="auth-input pr-11" type={show ? 'text' : 'password'} autoComplete={signup ? 'new-password' : 'current-password'} value={password} onChange={(e) => setPassword(e.target.value)} />
                <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'} className="absolute right-1.5 top-[calc(50%+4px)] flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground hover:bg-tint/[0.06] hover:text-foreground">
                  {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </span>
            </label>
            {signup && (
              <label className="text-sm font-medium">
                Confirm password
                <input className="auth-input" type={show ? 'text' : 'password'} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
              </label>
            )}

            {error && (
              <p role="alert" className="flex items-start gap-2 text-sm text-bad"><TriangleAlert className="mt-0.5 size-4 shrink-0" />{error}</p>
            )}

            <button type="submit" disabled={busy || !email || !password} className="button-primary mt-2 h-11 justify-center text-sm">
              {busy && <Loader2 className="size-4 animate-spin" />}
              {signup ? 'Create account' : 'Sign in to workspace'}
              {!busy && <ArrowUpRight className="size-4" />}
            </button>
          </div>
        </form>

        <p className="mt-8 text-center text-sm text-muted-foreground">
          {signup ? 'Already have an account?' : 'New to Nexora?'}{' '}
          <button type="button" onClick={() => { setSignup(!signup); setError(null) }} className="font-semibold text-foreground underline-offset-4 hover:underline">
            {signup ? 'Sign in' : 'Create an account'}
          </button>
        </p>
      </div>
    </main>
  )
}
