import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Default is 1 MB — raise to 20 MB to support file attachments
      bodySizeLimit: "20mb",
    },
  },
  images: {
    qualities: [100, 75],
    // Modern formats for the editorial imagery (Phase 6).
    formats: ["image/avif", "image/webp"],
    deviceSizes: [360, 480, 640, 768, 1024, 1240, 1440, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 240, 384],
  },
};

const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);
