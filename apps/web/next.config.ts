import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  output: 'export',
  images: {
    unoptimized: true, // ✅ Disable optimization for static export
    domains: ["lh3.googleusercontent.com"], // ✅ Add Google for profile pictures
  }
};

export default nextConfig;
