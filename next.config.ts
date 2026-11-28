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

/**
 * Flag pages are the same for every visitor (favorites are filled in by the browser), and nearly
 * all of their traffic is crawlers, so Vercel's CDN keeps each one for a day instead of rendering
 * it per request. Only the CDN reads this header; browsers still get Next's "don't store". The
 * page tags itself `flags`, so a flag edit clears the copies. Not the edit form (`?mode=edit`).
 */
const FLAG_PAGE_CDN_CACHE = {
  source: '/flag/:flagName',
  missing: [{ type: 'query' as const, key: 'mode' }],
  headers: [{ key: 'Vercel-CDN-Cache-Control', value: 's-maxage=86400' }],
};

/**
 * The flag grid used to be the homepage, so searches and filters were `/?q=…`. `/` is now the hub;
 * any of those old query links goes to the same view on /browse (the query string comes along).
 */
const OLD_BROWSE_QUERY_KEYS = ['q', 'tag', 'color', 'trait', 'favorites', 'page', 'orderBy', 'orderDirection'];

const nextConfig: NextConfig = {
  async redirects() {
    return OLD_BROWSE_QUERY_KEYS.map((key) => ({
      source: '/',
      has: [{ type: 'query' as const, key }],
      destination: '/browse',
      permanent: true,
    }));
  },
  // Profiles and posts live at /@username and /@username/slug; "@" can't start a route folder, so they're served from /u.
  async rewrites() {
    return [
      { source: '/@:username', destination: '/u/:username' },
      { source: '/@:username/:rest*', destination: '/u/:username/:rest*' },
    ];
  },
  async headers() {
    return [{ source: '/:path*', headers: SECURITY_HEADERS }, FLAG_PAGE_CDN_CACHE];
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
