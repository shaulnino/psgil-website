import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Default is 1 MB — raise to 20 MB to support file attachments
      bodySizeLimit: "20mb",
    },
  },
};

export default nextConfig;
