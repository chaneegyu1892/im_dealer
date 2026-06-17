import { dirname } from "path";
import { fileURLToPath } from "url";
import { withSentryConfig } from "@sentry/nextjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    root: __dirname,
  },
  // 견적서 PDF(react-pdf)가 런타임에 process.cwd()로 읽는 한글 TTF를
  // 서버리스 함수 번들에 포함시킨다(정적 분석으로는 추적 불가하므로 명시).
  outputFileTracingIncludes: {
    "/api/quote/pdf": ["./src/lib/pdf/fonts/**"],
    "/api/admin/quotes/[id]/pdf": ["./src/lib/pdf/fonts/**"],
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
    remotePatterns: [
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
