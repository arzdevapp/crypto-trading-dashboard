import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['ccxt', 'protobufjs'],
  allowedDevOrigins: ['192.168.0.175'],
};

export default nextConfig;
