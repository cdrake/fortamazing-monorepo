/** @type {import('next').NextConfig} */

const nextConfig = {
  images: {
    unoptimized: true, // ✅ Disable image optimization if still required
    domains: ["lh3.googleusercontent.com"], // ✅ Allow Google profile pictures
  },
  distDir: '.next',
  reactStrictMode: true,
  // Add this if using `src/app` or `src/pages`
  pageExtensions: ['js', 'jsx', 'ts', 'tsx'],
  output: 'standalone',
  trailingSlash: true,
  serverExternalPackages: ['firebase-admin']
}

export default nextConfig