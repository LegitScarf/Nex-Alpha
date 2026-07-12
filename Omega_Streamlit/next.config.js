/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.OMEGA_BACKEND_URL || 'http://127.0.0.1:8001'}/api/:path*`,
      },
    ]
  },
}

module.exports = nextConfig
