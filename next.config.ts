import type { NextConfig } from "next";

// Paper.js (for combining shapes) names these for running under Node; the browser never needs them.
const PAPER_NODE_ONLY = ['canvas', 'jsdom', 'jsdom/lib/jsdom/living/generated/utils', 'source-map-support'];

const nextConfig: NextConfig = {
  turbopack: {
    resolveAlias: Object.fromEntries(PAPER_NODE_ONLY.map((name) => [name, './src/lib/stubs/empty.cjs'])),
  },
  webpack: (config) => {
    for (const name of PAPER_NODE_ONLY) config.resolve.alias[name] = false;
    return config;
  },
  images: {
    dangerouslyAllowSVG: true,
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
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  reactStrictMode: false,
};

export default nextConfig;
