import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site-config";

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
          "/login",
          "/mypage",
          "/quote/delivery/",
          "/recommend/result",
          "/reviews/write/",
          "/unauthorized",
          "/verify",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
