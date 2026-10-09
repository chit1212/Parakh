import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The demo event loads from dataset/ at runtime; make sure Vercel ships it with the server functions.
  outputFileTracingIncludes: {
    "/**": ["./dataset/**/*", "./data/readings/**/*"],
  },
  serverExternalPackages: ["exceljs", "mammoth", "unpdf"],
};

export default nextConfig;
