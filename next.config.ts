import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The demo event loads from dataset/ at runtime; make sure Vercel ships it with the server functions.
  outputFileTracingIncludes: {
    "/**": ["./dataset/**/*", "./data/readings/**/*"],
  },
  serverExternalPackages: ["exceljs", "mammoth", "unpdf"],
  // The exact allocation solver runs in the browser too; its optional command-line bridge (lp_solve) needs Node only.
  webpack: (config, { isServer }) => {
    if (!isServer) config.resolve.fallback = { ...config.resolve.fallback, fs: false, child_process: false };
    return config;
  },
};

export default nextConfig;
