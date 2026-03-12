import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@beacon/core', '@beacon/ai', '@beacon/db']
};

export default nextConfig;
