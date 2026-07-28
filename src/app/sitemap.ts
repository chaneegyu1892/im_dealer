import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { SITE_URL } from "@/lib/site-config";

export const revalidate = 3600; // 1시간마다 사이트맵 재생성

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // 정적 공개 페이지
  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/cars`, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/quote`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE_URL}/recommend`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE_URL}/reviews`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${SITE_URL}/about`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/finance-terms`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${SITE_URL}/privacy`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/terms`, changeFrequency: "yearly", priority: 0.3 },
    {
      url: `${SITE_URL}/marketing-consent`,
      changeFrequency: "yearly",
      priority: 0.2,
    },
  ];

  // 동적: 노출 가능한 모든 차량.
  // 빌드 타임 DB 장애로 전체 빌드가 죽지 않도록 실패 시 정적 페이지만 반환한다
  // (revalidate 주기에 다음 재생성 때 차량 목록이 다시 채워진다).
  let vehicleEntries: MetadataRoute.Sitemap = [];
  try {
    const vehicles = await prisma.vehicle.findMany({
      where: { isVisible: true },
      select: { slug: true, updatedAt: true },
    });
    vehicleEntries = vehicles.map((v) => ({
      url: `${SITE_URL}/cars/${v.slug}`,
      lastModified: v.updatedAt,
      changeFrequency: "weekly",
      priority: 0.8,
    }));
  } catch (error) {
    console.error("[sitemap] 차량 목록 조회 실패 — 정적 항목만 반환:", error);
  }

  // 동적: 공개 상태인 고객 후기.
  let reviewEntries: MetadataRoute.Sitemap = [];
  try {
    const reviews = await prisma.review.findMany({
      where: { isPublic: true },
      select: { id: true, updatedAt: true },
    });
    reviewEntries = reviews.map((review) => ({
      url: `${SITE_URL}/reviews/${review.id}`,
      lastModified: review.updatedAt,
      changeFrequency: "monthly",
      priority: 0.5,
    }));
  } catch (error) {
    console.error("[sitemap] 후기 목록 조회 실패 — 후기 항목 제외:", error);
  }

  return [...staticEntries, ...vehicleEntries, ...reviewEntries];
}
