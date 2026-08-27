/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,
  async rewrites() {
    return [{ source: '/api/:path*', destination: 'http://localhost:5000/api/:path*' }];
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