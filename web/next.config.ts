import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const webDir = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // Self-contained Next app under web/ (no imports from repo root).
  outputFileTracingRoot: webDir,
  turbopack: {
    root: webDir,
  },
  poweredByHeader: false,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "api.dicebear.com",
        pathname: "/**",
      },
    ],
    minimumCacheTTL: 60 * 60 * 24 * 7,
  },
  experimental: {
    optimizePackageImports: [
      "thirdweb",
      "thirdweb/react",
      "thirdweb/wallets",
      "thirdweb/extensions",
      "thirdweb/chains",
    ],
    // Windows dev: filesystem cache often stalls first route compile for minutes.
    turbopackFileSystemCacheForDev: process.platform !== "win32",
  },
};

export default nextConfig;
