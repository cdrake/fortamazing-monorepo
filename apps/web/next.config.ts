import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    unoptimized: true, // ✅ Required for static export (since Next.js image optimization won't work)
    domains: ['lh3.googleusercontent.com'], // ✅ Allow Google profile pictures
  },
  distDir: '.next',
  reactStrictMode: true,
  pageExtensions: ['js', 'jsx', 'ts', 'tsx'],
  // output: 'export', // ✅ Switch from 'standalone' to 'export' for static export
  trailingSlash: true,
}

export default nextConfig
