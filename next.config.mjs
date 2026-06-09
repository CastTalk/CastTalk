/** @type {import('next').NextConfig} */
const nextConfig = {
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
};

export default nextConfig;
