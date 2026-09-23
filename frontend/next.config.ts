import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  distDir: process.env.MEMORICKS_E2E === "1" ? ".next-e2e" : ".next",
};

export default nextConfig;
