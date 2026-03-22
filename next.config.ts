import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['ccxt', 'protobufjs'],
};

export default nextConfig;
