import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // The floating dev badge would cover the Generate button; errors still surface.
  devIndicators: false,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
