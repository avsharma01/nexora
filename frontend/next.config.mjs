/** @type {import('next').NextConfig} */
const nextConfig = {
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
