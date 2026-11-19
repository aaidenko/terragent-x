import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Live EO APIs + in-memory mission state need a classic dynamic server. */
  cacheComponents: false,
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
