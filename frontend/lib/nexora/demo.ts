// DEMO ONLY. The accounts created by backend/scripts/seed_demo_users.py, with publicly known passwords.
// The login page shows them as "fill in" buttons in `npm run dev`, and in a production build only when
// NEXT_PUBLIC_DEMO_MODE=true. They only fill the form; signing in still goes through /auth/login,
// and the role shown in the app still comes from GET /auth/me.

import type { Role } from './api'

export const DEMO_ENABLED = process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

export const DEMO_ACCOUNTS: { label: string; role: Role; email: string; password: string }[] = [
  { label: 'Admin', role: 'admin', email: 'admin@nexora.demo', password: 'nexora-demo-admin' },
  { label: 'Analyst', role: 'analyst', email: 'analyst@nexora.demo', password: 'nexora-demo-analyst' },
  { label: 'Viewer', role: 'viewer', email: 'viewer@nexora.demo', password: 'nexora-demo-viewer' },
]
