import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
