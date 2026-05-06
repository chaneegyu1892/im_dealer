import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PublicReview } from "@/types/review";
import { ReviewCard } from "./ReviewCard";

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
  if (reviews.length === 0) return null;

  return (
    <section className={cn("space-y-5", className)}>
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-primary mb-1.5">
            <Sparkles size={12} />
            BEST
          </p>
          <h2 className="font-display text-headline-sm text-ink leading-tight">
            {title}
          </h2>
          <p className="text-[13px] text-ink-caption mt-1">{description}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {reviews.map((review) => (
          <ReviewCard key={review.id} review={review} variant="best" />
        ))}
      </div>
    </section>
  );
}
