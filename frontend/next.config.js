/** @type {import('next').NextConfig} */
const BACKEND_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL;

module.exports = {
  reactStrictMode: true,
  async rewrites() {
    if (BACKEND_URL) {
      return [
        {
          source: '/api/:path*',
          destination: `${BACKEND_URL.replace(/\/$/, '')}/api/:path*`,
        },
      ];
    }
    if (process.env.NODE_ENV === 'development') {
      return [
        {
          source: '/api/:path*',
          destination: 'http://localhost:5000/api/:path*',
        },
      ];
    }
    return [];
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