/** @type {import('next').NextConfig} */
const nextConfig = {
  // Always defined at build time, so a normal production build compiles the demo login buttons
  // (and their public demo passwords) out entirely. Set NEXT_PUBLIC_DEMO_MODE=true to keep them.
  env: { NEXT_PUBLIC_DEMO_MODE: process.env.NEXT_PUBLIC_DEMO_MODE === 'true' ? 'true' : 'false' },
  // FastAPI routes like /companies/ need their trailing slash kept.
  skipTrailingSlashRedirect: true,
  // The browser talks to /api/*; Next forwards it to the FastAPI backend (NEXORA_API, default localhost:8000).
  async rewrites() {
    const api = process.env.NEXORA_API ?? 'http://localhost:8000'
    return [
      // Keep a trailing slash: without it FastAPI redirects and the browser drops the Authorization header.
      { source: '/api/:path*/', destination: `${api}/:path*/` },
      { source: '/api/:path*', destination: `${api}/:path*` },
    ]
  },
}

export default nextConfig
