import { dirname } from "path";
import { fileURLToPath } from "url";
import { withSentryConfig } from "@sentry/nextjs";
import { vehicleImageE2ENextConfig } from "./scripts/lib/vehicle-image-e2e-next-config.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

const quoteImageTraceIncludes = [
  "./src/lib/pdf/fonts/**",
  "./src/lib/pdf/brand/**",
  "./node_modules/.pnpm/pdfjs-dist@*/node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
  "./node_modules/.pnpm/@napi-rs+canvas*/node_modules/@napi-rs/canvas/**",
  "./node_modules/.pnpm/@napi-rs+canvas-*/node_modules/@napi-rs/canvas-*/**",
];

const vehicleImageE2ENext = vehicleImageE2ENextConfig(process.env);

/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(vehicleImageE2ENext.distDir ? { distDir: vehicleImageE2ENext.distDir } : {}),
  ...(vehicleImageE2ENext.tsconfigPath ? { typescript: { tsconfigPath: vehicleImageE2ENext.tsconfigPath } } : {}),
  turbopack: {
    root: __dirname,
  },
  serverExternalPackages: ["@napi-rs/canvas"],
  // 견적서 이미지가 내부 PDF 렌더링 중 process.cwd()로 읽는 한글 TTF와 브랜드 로고(PNG)를
  // 서버리스 함수 번들에 포함시킨다. PDF.js의 Node canvas polyfill은 런타임 require라
  // 정적 분석으로 추적되지 않으므로 native canvas 패키지도 함께 명시한다.
  outputFileTracingIncludes: {
    "/api/quote/image": quoteImageTraceIncludes,
    "/api/quote/deliver": quoteImageTraceIncludes,
    "/api/admin/quotes/[id]/image": quoteImageTraceIncludes,
    "/api/admin/quotes/*/image": quoteImageTraceIncludes,
  },
  async headers() {
    // CSP 정책. Next.js 16 + Sentry + Supabase + Upstash + 외부 차량 이미지 도메인을 모두 허용.
    // 첫 단계는 Report-Only로 운영 위반을 모니터링한 뒤 enforce 전환은 후속 PR.
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' *.sentry.io",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "connect-src 'self' *.supabase.co *.sentry.io *.upstash.io",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ");

    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          // 모든 https 요청을 1년간 강제 (preload 등록 시 브라우저 내장 목록에 포함).
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
          // 위치/마이크/카메라/결제 API 차단 — 차량 견적 사이트에 불필요.
          { key: "Permissions-Policy", value: "geolocation=(), microphone=(), camera=(), payment=()" },
          // CSP는 우선 Report-Only로 도입. 대시보드 모니터링 후 enforce 전환.
          { key: "Content-Security-Policy-Report-Only", value: csp },
        ],
      },
    ];
  },
  images: {
    dangerouslyAllowLocalIP: vehicleImageE2ENext.images.dangerouslyAllowLocalIP,
    remotePatterns: [
      ...vehicleImageE2ENext.images.remotePatterns,
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      // 차량 브랜드 이미지 CDN
      { protocol: "https", hostname: "www.hyundai.com" },
      { protocol: "https", hostname: "*.hyundai.com" },
      { protocol: "https", hostname: "www.kia.com" },
      { protocol: "https", hostname: "*.kia.com" },
      { protocol: "https", hostname: "www.genesis.com" },
      { protocol: "https", hostname: "*.genesis.com" },
      { protocol: "https", hostname: "www.bmw.co.kr" },
      { protocol: "https", hostname: "*.bmw.co.kr" },
      { protocol: "https", hostname: "www.mercedes-benz.co.kr" },
      { protocol: "https", hostname: "*.mercedes-benz.co.kr" },
      { protocol: "https", hostname: "www.audi.co.kr" },
      { protocol: "https", hostname: "*.audi.co.kr" },
      { protocol: "https", hostname: "www.volkswagen.co.kr" },
      { protocol: "https", hostname: "*.volkswagen.co.kr" },
      { protocol: "https", hostname: "www.tesla.com" },
      { protocol: "https", hostname: "*.tesla.com" },
      { protocol: "https", hostname: "www.volvo.co.kr" },
      { protocol: "https", hostname: "*.volvo.co.kr" },
      // 카판2 크롤링 차량 이미지 CDN
      { protocol: "https", hostname: "www.carpan.co.kr" },
      // 카카오 프로필 이미지
      { protocol: "https", hostname: "*.kakaocdn.net" },
      { protocol: "http", hostname: "*.kakaocdn.net" },
      // 기타 외부 이미지 도메인 (필요 시 추가)
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "cdn.imdealers.com" },
    ],
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  disableLogger: true,
});
