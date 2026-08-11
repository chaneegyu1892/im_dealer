"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PublicReview } from "@/types/review";
import { ReviewCard } from "./ReviewCard";
import { ReviewDetailModal } from "./ReviewDetailModal";

interface BestReviewSectionProps {
  reviews: PublicReview[];
  title?: string;
  description?: string;
  className?: string;
}

export function BestReviewSection({
  reviews,
  title = "베스트 후기",
  description = "관리자가 추천하는 인기 후기",
  className,
}: BestReviewSectionProps) {
  const [openReview, setOpenReview] = useState<PublicReview | null>(null);

  if (reviews.length === 0) return null;

  return (
    <section className={cn("space-y-5", className)}>
      <div>
        <p className="t-kick">
          <Sparkles size={13} />
          BEST
        </p>
        <h2 className="mt-2 t-h1">{title}</h2>
        <p className="mt-2 t-sub">{description}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {reviews.map((review) => (
          <ReviewCard
            key={review.id}
            review={review}
            variant="best"
            onOpen={setOpenReview}
          />
        ))}
      </div>

      {openReview ? (
        <ReviewDetailModal review={openReview} onClose={() => setOpenReview(null)} />
      ) : null}
    </section>
  );
}
