/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['bcryptjs'],
    optimizePackageImports: ['lucide-react', 'recharts'],
  },
  async rewrites() {
    return [
      // /api/v1/* → /api/* (versioning shim — routes stay at /api/)
      {
        source: '/api/v1/:path*',
        destination: '/api/:path*',
      },
    ]
  },
}

export default nextConfig
