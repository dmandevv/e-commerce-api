/** @type {import('next').NextConfig} */
// API_UPSTREAM_URL is server-only (no NEXT_PUBLIC_ prefix) — sets the rewrite destination.
// Falls back to the public var (production), then the hardcoded prod API.
const API_UPSTREAM = process.env.API_UPSTREAM_URL || process.env.NEXT_PUBLIC_API_URL || 'https://api.dmandevv.shop';

const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
    ],
  },
  // Proxy /api/* requests to the k3s backend so the frontend
  // and API share the same origin (no CORS, no api subdomain)
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${API_UPSTREAM}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
