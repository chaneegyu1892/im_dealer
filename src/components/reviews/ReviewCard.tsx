"use client";

import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PublicReview } from "@/types/review";
import { LikeButton } from "./LikeButton";

interface ReviewCardProps {
  review: PublicReview;
  initialLiked?: boolean;
  variant?: "default" | "best";
  className?: string;
  /** 있으면 페이지 이동 대신 모달 오픈 콜백 */
  onOpen?: (review: PublicReview) => void;
}

export function ReviewCard({
  review,
  initialLiked = false,
  variant = "default",
  className,
  onOpen,
}: ReviewCardProps) {
  const cover = review.imageUrls[0];
  const extra = Math.max(0, review.imageUrls.length - 1);
  const isBest = variant === "best" || review.isBest;
  const initial = review.displayName.trim().charAt(0) || "익";
  const purpleAvatar =
    (review.id.charCodeAt(review.id.length - 1) || 0) % 3 === 0;

  const body = (
    <>
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[15px] font-extrabold",
            purpleAvatar
              ? "bg-purple-soft text-purple"
              : "bg-brand-soft text-brand",
          )}
        >
          {initial}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-[14px] font-extrabold text-ink">
              {review.displayName}
            </p>
            {isBest && (
              <span className="inline-flex shrink-0 items-center gap-0.5 rounded-pill bg-brand px-1.5 py-0.5 text-[10px] font-bold text-white">
                <Sparkles size={9} />
                BEST
              </span>
            )}
          </div>
          <p className="mt-0.5 t-stars text-[14px] leading-none">
            {"★".repeat(review.rating)}
            <span className="text-line2">{"★".repeat(5 - review.rating)}</span>
          </p>
        </div>
      </div>

      {review.vehicleName ? (
        <span
          className={cn(
            "t-tag mt-2.5 max-w-full self-start truncate",
            purpleAvatar && "t-tag-pp",
          )}
          title={review.vehicleName}
        >
          {review.vehicleName}
        </span>
      ) : null}

      <p className="mt-3 line-clamp-3 min-h-[60px] flex-1 text-[14px] leading-[1.55] text-g1">
        {review.content}
      </p>

      {cover ? (
        <div className="relative mt-3 aspect-[5/3] w-full overflow-hidden rounded-[12px] bg-sec">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={cover}
            alt="후기 이미지"
            className="h-full w-full object-cover"
            loading="lazy"
          />
          {extra > 0 && (
            <div className="absolute bottom-2 right-2 rounded-pill bg-black/60 px-2 py-0.5 text-[11px] font-bold text-white">
              +{extra}
            </div>
          )}
        </div>
      ) : null}

      <p className="mt-3 text-[12px] text-g2">{review.reviewDate}</p>
    </>
  );

  return (
    <article
      className={cn(
        "group relative flex flex-col t-card overflow-hidden transition-shadow hover:shadow-soft",
        className,
      )}
    >
      {onOpen ? (
        <button
          type="button"
          onClick={() => onOpen(review)}
          className="flex flex-1 flex-col p-4 text-left focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/40 focus-visible:ring-inset"
        >
          {body}
        </button>
      ) : (
        <a
          href={`/reviews/${review.id}`}
          className="flex flex-1 flex-col p-4"
        >
          {body}
        </a>
      )}

      <div className="px-4 pb-4">
        <LikeButton
          reviewId={review.id}
          initialLikeCount={review.likeCount}
          initialLiked={initialLiked}
          size="sm"
          stopPropagation
        />
      </div>
    </article>
  );
}
