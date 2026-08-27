const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000';

/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${BACKEND_URL}/api/:path*` }];
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