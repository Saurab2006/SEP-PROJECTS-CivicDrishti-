/** @type {import('next').NextConfig} */
const BACKEND_URL =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  (process.env.NODE_ENV === 'development'
    ? 'http://localhost:5000'
    : 'https://sep-projects-civic-drishti-backend.vercel.app');

module.exports = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${BACKEND_URL.replace(/\/$/, '')}/api/:path*`,
      },
    ];
  },
  webpack: (config) => {

    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      encoding: false,
    };
    return config;
  },
};