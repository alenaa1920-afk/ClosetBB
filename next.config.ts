import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /** Pin tracing to this project; a lockfile sits above it in the home dir. */
  outputFileTracingRoot: path.join(__dirname),
  images: {
    /**
     * Product photographs come from whichever boutique she shopped at, and the
     * point of Mon Amour is that a new store can be added without a code
     * change — so any https host is allowed and served through Next's
     * optimiser. SVG is deliberately not trusted.
     */
    remotePatterns: [{ protocol: "https", hostname: "**" }],
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24 * 7,
    dangerouslyAllowSVG: false,
  },
  experimental: {
    optimizePackageImports: ["lucide-react", "framer-motion"],
  },
};

export default nextConfig;
