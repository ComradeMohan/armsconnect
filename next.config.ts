import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Vercel: allow API routes up to 60s before timeout.
  // The marks route can take 20-25s on slow ARMS responses.
  // Hobby plan max is 60s; Pro plan allows up to 300s.
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
};

export default nextConfig;
