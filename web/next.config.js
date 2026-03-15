/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',

  // Security: only allow images served through our own proxy
  images: {
    domains: [], // no external image domains — images proxied via /api/image
  },

  // Strict headers on every page
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options',        value: 'DENY' },
          { key: 'X-XSS-Protection',       value: '1; mode=block' },
          { key: 'Referrer-Policy',         value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
