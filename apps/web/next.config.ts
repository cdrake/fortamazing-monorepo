import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    unoptimized: true, // ✅ Disable image optimization if still required
    domains: ["lh3.googleusercontent.com"], // ✅ Allow Google profile pictures
  },
};

export default nextConfig;
