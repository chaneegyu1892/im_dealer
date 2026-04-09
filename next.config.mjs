import { dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    root: __dirname,
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
      // 기타 외부 이미지 도메인 (필요 시 추가)
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "cdn.imdealers.com" },
    ],
  },
};

export default nextConfig;
