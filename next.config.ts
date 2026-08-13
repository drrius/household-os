import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  // Verification instances set HOUSEHOLD_OS_VERIFY_DIST_DIR so a second
  // `next dev` can run beside the user's ordinary server without sharing `.next`.
  distDir: process.env.HOUSEHOLD_OS_VERIFY_DIST_DIR ?? ".next",
  poweredByHeader: false,
  reactStrictMode: true,
};

export default nextConfig;
