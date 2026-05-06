import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Star } from "lucide-react";
import {
  getPublicReviewById,
  getBestReviews,
  getPublicReviewsByVehicleId,
} from "@/lib/admin-queries/reviews";
import { ReviewDetailClient } from "./ReviewDetailClient";
import { ReviewCard } from "@/components/reviews/ReviewCard";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  const review = await getPublicReviewById(id);
  if (!review) {
    return { title: "후기를 찾을 수 없습니다 | 아임딜러" };
  }
  const snippet = review.content.slice(0, 100).replace(/\s+/g, " ");
  const titleParts = [
    `${review.displayName}님의 후기`,
    review.vehicleName ?? null,
  ].filter(Boolean);
  return {
    title: `${titleParts.join(" · ")} | 아임딜러`,
    description: snippet,
    openGraph: {
      title: titleParts.join(" · "),
      description: snippet,
      images: review.imageUrls.length > 0 ? [review.imageUrls[0]] : undefined,
    },
  };
}

export const dynamic = "force-dynamic";

export default async function ReviewDetailPage({ params }: PageProps) {
  const { id } = await params;
  const review = await getPublicReviewById(id);
  if (!review) notFound();

  const relatedPromise = review.vehicleId
    ? getPublicReviewsByVehicleId(review.vehicleId, 6)
    : getBestReviews({ limit: 6 });
  const related = (await relatedPromise).filter((r) => r.id !== review.id).slice(0, 4);

  return (
    <div className="page-container py-10 md:py-14 space-y-10">
      <div>
        <Link
          href="/reviews"
          className="inline-flex items-center gap-1 text-[13px] text-ink-caption hover:text-ink"
        >
          <ChevronLeft size={14} />
          전체 후기
        </Link>
      </div>

      <article className="bg-white rounded-card border border-[#F0F0F0] p-6 md:p-10 space-y-6">
        <header className="space-y-3">
          <div className="flex items-center gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                size={18}
                className={
                  i < review.rating
                    ? "fill-primary text-primary"
                    : "text-neutral-600"
                }
              />
            ))}
            <span className="ml-2 text-[14px] text-ink-caption">
              {review.rating}/5
            </span>
            {review.isBest && (
              <span className="ml-3 inline-flex items-center text-[11px] font-semibold bg-primary text-white px-2 py-0.5 rounded-full">
                BEST
              </span>
            )}
          </div>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-[15px] font-medium text-ink">
                {review.displayName}
              </p>
              {review.vehicleName && (
                <p className="text-[13px] text-ink-caption mt-0.5">
                  {review.vehicleName}
                </p>
              )}
            </div>
            <p className="text-[13px] text-ink-caption">{review.reviewDate}</p>
          </div>
        </header>

        <ReviewDetailClient review={review} />
      </article>

      {related.length > 0 && (
        <section className="space-y-5">
          <h2 className="font-display text-headline-sm text-ink">
            {review.vehicleName
              ? `${review.vehicleName} 후기 더 보기`
              : "다른 베스트 후기"}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {related.map((r) => (
              <ReviewCard key={r.id} review={r} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
