import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, MessageSquareText, Star } from "lucide-react";
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
  const initialReviewCount = initialList.items.length;

  return (
    <div className="home-showroom-scope min-h-screen bg-app-bg pb-[calc(112px+env(safe-area-inset-bottom,0px))] md:pb-16">
      <section className="border-b border-border-subtle bg-surface">
        <div className="mx-auto grid w-full max-w-[1120px] gap-7 px-4 py-9 sm:px-5 md:grid-cols-[1fr_320px] md:items-end md:py-14">
          <div>
            <p className="mb-3 inline-flex rounded-pill bg-brand-soft px-3 py-1.5 text-[12px] font-extrabold text-brand">
              고객 후기
            </p>
            <h1 className="break-keep text-[32px] font-extrabold leading-[1.14] tracking-[-0.04em] text-text-strong md:text-[46px]">
              실제로 비교하고
              <br />
              선택한 이야기
            </h1>
            <p className="mt-3 max-w-[580px] break-keep text-[15px] font-semibold leading-[1.7] text-text-body md:text-[17px]">
              차종별 경험과 상담 전 확인하면 좋은 포인트를 후기에서 먼저 살펴보세요.
            </p>
          </div>

          <div className="rounded-[24px] border border-border-subtle bg-app-bg p-4 shadow-card">
            <div className="flex items-center gap-3 rounded-[18px] bg-surface p-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] bg-brand-soft text-brand">
                <MessageSquareText size={22} />
              </span>
              <div>
                <p className="text-[12px] font-bold text-text-muted">등록된 공개 후기</p>
                <p className="mt-0.5 text-[22px] font-extrabold tracking-[-0.03em] text-text-strong">
                  {initialReviewCount > 0 ? (
                    <>
                      {initialReviewCount}
                      <span className="ml-1 text-[14px] text-text-body">개부터 보기</span>
                    </>
                  ) : (
                    <span className="text-[18px]">후기 준비 중</span>
                  )}
                </p>
              </div>
            </div>
            <Link
              href="/cars"
              className="mt-3 flex min-h-11 items-center justify-center gap-2 rounded-[15px] bg-text-strong px-4 text-[13px] font-extrabold text-surface transition-colors hover:bg-brand focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/25"
            >
              차량별 견적 확인하기
              <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </section>

      <div className="mx-auto w-full max-w-[1120px] px-4 py-8 sm:px-5 md:py-11">
        {bestReviews.length > 0 && (
          <div className="mb-7 inline-flex items-center gap-2 rounded-pill bg-surface px-3 py-2 text-[12px] font-extrabold text-text-body shadow-card">
            <Star size={13} className="fill-status-warning text-status-warning" />
            베스트 후기를 먼저 보여드려요
          </div>
        )}

        <ReviewsGalleryClient
          bestReviews={bestReviews}
          initialItems={initialList.items}
          initialNextCursor={initialList.nextCursor}
          vehicles={vehicles}
          brands={brands}
        />
      </div>
    </div>
  );
}
