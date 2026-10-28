import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@ecom/ui', '@ecom/themes', '@ecom/i18n-messages', '@ecom/sdk-api'],
};

export default nextConfig;
