import { prisma } from "@/lib/prisma";
import type { BrandSignal, BrandSignalMap } from "@/lib/brand-sort";

/**
 * 브랜드 정렬에 필요한 신호(isFeatured + vehicleCount)를 한 번의 DB 호출로 수집해
 * Map 형태로 반환한다.
 *
 * - Brand 테이블에 있지만 차량이 한 대도 없는 브랜드 → vehicleCount = 0
 * - Vehicle.brand 문자열로만 존재하고 Brand 테이블엔 없는 잔여값 → isFeatured = false 로 안전망 추가
 *
 * 어드민·공개 페이지 어디서 호출해도 동일한 결과를 반환한다.
 */
export async function getBrandSignals(): Promise<BrandSignalMap> {
  const [brands, counts] = await Promise.all([
    prisma.brand.findMany({
      select: { name: true, isFeatured: true, displayOrder: true },
    }),
    prisma.vehicle.groupBy({
      by: ["brand"],
      _count: { id: true },
    }),
  ]);

  const countByBrand = new Map(counts.map((g) => [g.brand, g._count.id]));
  const map = new Map<string, BrandSignal>();

  for (const b of brands) {
    map.set(b.name, {
      isFeatured: b.isFeatured,
      displayOrder: b.displayOrder,
      vehicleCount: countByBrand.get(b.name) ?? 0,
    });
  }

  // Vehicle.brand 문자열로만 존재하는 브랜드 안전망
  for (const [name, count] of countByBrand) {
    if (!map.has(name)) {
      map.set(name, { isFeatured: false, displayOrder: 1000, vehicleCount: count });
    }
  }

  return map;
}
