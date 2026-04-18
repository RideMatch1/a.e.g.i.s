import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Strict by default — disable only if a build genuinely needs to
  // emit despite typescript errors (rare, intentional).
  typescript: { ignoreBuildErrors: false },
};

export default config;
