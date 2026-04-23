import { dirname } from "path";
import { fileURLToPath } from "url";
import { withSentryConfig } from "@sentry/nextjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    root: __dirname,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
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
