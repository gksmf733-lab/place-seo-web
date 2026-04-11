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
  // @sparticuz/chromium 과 playwright-core 는 서버 런타임에서만 실행되는
  // 네이티브 바이너리/큰 패키지이므로 번들러가 건드리지 않도록 외부 처리.
  serverExternalPackages: [
    "@sparticuz/chromium",
    "playwright-core",
    "playwright",
  ],
  // 서버리스 함수 번들에 @sparticuz/chromium 의 브로틀리 압축 바이너리를
  // 강제로 포함시킨다. Next.js 의 파일 추적(file tracing)은 정적 import 만
  // 따라가므로 동적 load 되는 바이너리 파일은 직접 지정해야 한다.
  outputFileTracingIncludes: {
    "/api/order": ["./node_modules/@sparticuz/chromium/bin/**"],
    "/api/scrape/**": ["./node_modules/@sparticuz/chromium/bin/**"],
  },
};

export default nextConfig;
