import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // 어드민/인증/사용자별 플로우는 색인 차단.
        disallow: [
          "/admin",
          "/admin/",
          "/api/",
          "/auth/",
          "/verify",
          "/login",
          "/quote", // 사용자 입력 기반 동적 페이지
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
