import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The demo event and its saved readings load at runtime; make sure Vercel ships them with the server functions.
  outputFileTracingIncludes: {
    "/**": ["./dataset/**/*", "./data/**/*"],
  },
  serverExternalPackages: ["exceljs", "mammoth", "unpdf"],
};

export default nextConfig;
