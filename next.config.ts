import type { NextConfig } from "next";

// Paper.js (for combining shapes) names these for running under Node; the browser never needs them.
const PAPER_NODE_ONLY = ['canvas', 'jsdom', 'jsdom/lib/jsdom/living/generated/utils', 'source-map-support'];

const SECURITY_HEADERS = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Referrer-Policy', value: 'origin-when-cross-origin' },
  // Only what can't break the page: scripts and styles aren't restricted here.
  { key: 'Content-Security-Policy', value: "frame-ancestors 'self'; object-src 'none'; base-uri 'self'" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: '/:path*', headers: SECURITY_HEADERS }];
  },
  turbopack: {
    resolveAlias: Object.fromEntries(PAPER_NODE_ONLY.map((name) => [name, './src/lib/stubs/empty.cjs'])),
  },
  webpack: (config) => {
    for (const name of PAPER_NODE_ONLY) config.resolve.alias[name] = false;
    return config;
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'upload.wikimedia.org',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'd2p6q917mww4yf.cloudfront.net',
        pathname: '/**',
      },
    ],
  },
  reactStrictMode: false,
  experimental: {
    // Posting a flag sends its PNG and its design, which can carry an imported coat of arms.
    serverActions: { bodySizeLimit: '4mb' },
  },
};

export default nextConfig;
