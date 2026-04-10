import type { NextConfig } from "next";

/**
 * Next.js 16 config.
 *
 * Note: Next 16 uses Turbopack by default. Webpack-style watchOptions are
 * not supported here. The Plan document's `watchOptions.ignored: data/` is
 * handled in Phase 2 by either:
 *   1) placing DATA_DIR outside the Turbopack root, or
 *   2) using `turbopack.root` to scope the watcher.
 *
 * For Phase 1 (bootstrap) an empty turbopack config is enough to silence
 * the legacy-webpack-config warning.
 */
const nextConfig: NextConfig = {
  turbopack: {},
};

export default nextConfig;
