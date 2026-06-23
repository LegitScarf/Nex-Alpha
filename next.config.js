/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // We can also configure rewrites here as a backup for local dev
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://127.0.0.1:8000/api/:path*', // Proxy to FastAPI in local dev
      },
    ]
  },
}

module.exports = nextConfig
