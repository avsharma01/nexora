'use client'

import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'

export const THEME_KEY = 'nexora.theme'

/** Runs in <head> before paint, so a saved light theme never flashes dark first. */
export const themeScript = `try{if(localStorage.getItem('${THEME_KEY}')==='light'){var c=document.documentElement.classList;c.remove('dark');c.add('light')}}catch(e){}`

export function ThemeToggle({ className = '' }: { className?: string }) {
  const [light, setLight] = useState(false)

  useEffect(() => { setLight(document.documentElement.classList.contains('light')) }, [])

  function toggle() {
    const next = !light
    const c = document.documentElement.classList
    c.toggle('light', next)
    c.toggle('dark', !next)
    try { localStorage.setItem(THEME_KEY, next ? 'light' : 'dark') } catch { /* storage blocked */ }
    setLight(next)
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={light ? 'Switch to dark theme' : 'Switch to light theme'}
      title={light ? 'Dark theme' : 'Light theme'}
      className={`icon-button border border-border bg-tint/[0.03] ${className}`}
    >
      {light ? <Moon className="size-4" /> : <Sun className="size-4" />}
    </button>
  )
}
