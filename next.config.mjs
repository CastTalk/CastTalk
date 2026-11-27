/** @type {import('next').NextConfig} */
const nextConfig = {
  // Overridable so a production build can run beside `next dev` (which uses .next)
  distDir: process.env.NEXT_DIST_DIR || '.next',
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'img.clerk.com',
      },
    ],
  },
  experimental: {
    serverComponentsExternalPackages: ['node-appwrite', 'undici'],
  },
  webpack: (config, { dev }) => {
    if (dev) {
      config.cache = false;
    }
    return config;
  },
};

export default nextConfig;
