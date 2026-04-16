/** @type {import('next').NextConfig} */
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
        destination: 'https://api.dmandevv.shop/api/:path*',
      },
    ];
  },
};

export default nextConfig;
