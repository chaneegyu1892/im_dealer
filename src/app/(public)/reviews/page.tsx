import type { Metadata } from "next";
import {
  getBestReviews,
  listPublicReviews,
  getVehiclesForReviewSelect,
} from "@/lib/admin-queries/reviews";
import { ReviewsGalleryClient } from "./ReviewsGalleryClient";
import { makeBrandComparator } from "@/lib/brand-sort";
import { getBrandSignals } from "@/lib/brand-signals";

export const metadata: Metadata = {
  title: "고객 후기 | 아임딜러",
  description:
    "아임딜러를 통해 장기렌트·리스를 이용한 실제 고객들의 후기를 확인해 보세요.",
};

export const dynamic = "force-dynamic";

export default async function ReviewsPage() {
  const [bestReviews, initialList, vehicles, brandSignals] = await Promise.all([
    getBestReviews({ limit: 6 }),
    listPublicReviews({ limit: 12, sort: "recent" }),
    getVehiclesForReviewSelect(),
    getBrandSignals(),
  ]);

  // 어드민/공개 일관 정렬 SSOT: isFeatured → 차량 수 → 가나다
  const cmp = makeBrandComparator(brandSignals);
  const brands = Array.from(new Set(vehicles.map((v) => v.brand))).sort(cmp);

  return (
    <div className="page-container py-10 md:py-14 space-y-10">
      <header className="space-y-2">
        <p className="section-label">REVIEWS</p>
        <h1 className="font-display text-headline-md text-ink leading-tight">
          고객들의 진짜 이야기
        </h1>
        <p className="text-[14px] text-ink-caption max-w-xl">
          아임딜러로 차를 선택한 분들의 솔직한 후기를 모았습니다. 차종별로
          살펴보고 마음에 드는 후기에 좋아요를 남겨 보세요.
        </p>
      </header>

      <ReviewsGalleryClient
        bestReviews={bestReviews}
        initialItems={initialList.items}
        initialNextCursor={initialList.nextCursor}
        vehicles={vehicles}
        brands={brands}
      />
    </div>
  );
}
