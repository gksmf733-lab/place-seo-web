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
  // playwright-core 는 서버 런타임에서만 실행되는 큰 패키지이므로 번들러가
  // 건드리지 않도록 외부 처리. 실제 브라우저는 Browserbase 원격 세션에
  // CDP 로 접속해 사용하므로 함수 번들에 chromium 바이너리를 포함시킬
  // 필요가 없다.
  serverExternalPackages: ["playwright-core", "playwright"],
};

export default nextConfig;
