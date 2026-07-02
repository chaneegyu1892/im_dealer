import { Heart, Star } from "lucide-react";
import type { PublicReview } from "@/types/review";

type HomeReviewCardProps = {
  readonly review: PublicReview;
  readonly showImages: boolean;
  readonly showBestBadge: boolean;
  readonly onOpen: (review: PublicReview) => void;
};

export function HomeReviewCard({
  review,
  showImages,
  showBestBadge,
  onOpen,
}: HomeReviewCardProps) {
  const images = showImages ? review.imageUrls.slice(0, 3) : [];
  const extraCount = showImages ? Math.max(0, review.imageUrls.length - 3) : 0;

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => onOpen(review)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(review);
        }
      }}
      className="w-[320px] shrink-0 cursor-pointer rounded-card-lg border border-border-subtle bg-surface p-5 shadow-card transition-all duration-state hover:border-brand/35 hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-app-bg"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-0.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              size={15}
              className={
                i < review.rating
                  ? "fill-status-warning text-status-warning"
                  : "text-border-strong"
              }
            />
          ))}
        </div>
        {showBestBadge && (
          <span className="inline-flex items-center gap-1 rounded-pill bg-brand px-2.5 py-1 text-[11px] font-extrabold text-white">
            BEST 리뷰
          </span>
        )}
      </div>

      <p className="mt-3 line-clamp-3 min-h-[66px] text-[14px] leading-[1.6] text-text-body">
        {review.content}
      </p>

      {images.length > 0 && (
        <div className="mt-3 grid grid-cols-3 gap-1.5">
          {images.map((url, idx) => {
            const isLast = idx === images.length - 1 && extraCount > 0;

            return (
              <div
                key={url}
                className="relative aspect-square overflow-hidden rounded-[10px] border border-border-subtle bg-surface-soft"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={`첨부 ${idx + 1}`}
                  className="h-full w-full select-none object-cover pointer-events-none"
                  draggable={false}
                />
                {isLast && (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-text-strong/60 text-[13px] font-semibold text-white">
                    +{extraCount}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between border-t border-border-subtle pt-4">
        <div>
          <p className="text-[13.5px] font-extrabold text-text-strong">{review.displayName}</p>
          {review.vehicleName && (
            <p className="mt-0.5 text-[11.5px] text-text-muted">{review.vehicleName}</p>
          )}
        </div>
        <div className="flex items-center gap-2 text-[11.5px] text-text-muted">
          {review.likeCount > 0 && (
            <span className="inline-flex items-center gap-0.5 text-brand font-bold">
              <Heart size={11} className="fill-current" />
              {review.likeCount}
            </span>
          )}
          <span>{review.reviewDate}</span>
        </div>
      </div>
    </article>
  );
}
