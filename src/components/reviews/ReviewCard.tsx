"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PublicReview } from "@/types/review";
import { LikeButton } from "./LikeButton";

interface ReviewCardProps {
  review: PublicReview;
  initialLiked?: boolean;
  variant?: "default" | "best";
  className?: string;
}

export function ReviewCard({
  review,
  initialLiked = false,
  variant = "default",
  className,
}: ReviewCardProps) {
  const cover = review.imageUrls[0];
  const extra = Math.max(0, review.imageUrls.length - 1);
  const isBest = variant === "best" || review.isBest;
  const initial = review.displayName.trim().charAt(0) || "익";
  // id 기준으로 아바타 톤을 결정적으로 분배 (purple-soft 일부)
  const purpleAvatar =
    (review.id.charCodeAt(review.id.length - 1) || 0) % 3 === 0;

  return (
    <article
      className={cn(
        "group relative flex flex-col t-card overflow-hidden transition-shadow hover:shadow-soft",
        className
      )}
    >
      <Link
        href={`/reviews/${review.id}`}
        className="flex flex-1 flex-col p-4"
        prefetch={false}
      >
        {/* 작성자 + 별점 + 차량 태그 */}
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[15px] font-extrabold",
              purpleAvatar
                ? "bg-purple-soft text-purple"
                : "bg-brand-soft text-brand"
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
              <span className="text-line2">
                {"★".repeat(5 - review.rating)}
              </span>
            </p>
          </div>
          {review.vehicleName && (
            <span
              className={cn(
                "t-tag shrink-0 max-w-[40%] truncate",
                purpleAvatar && "t-tag-pp"
              )}
            >
              {review.vehicleName}
            </span>
          )}
        </div>

        {/* 본문 */}
        <p className="mt-3 line-clamp-3 min-h-[60px] flex-1 text-[14px] leading-[1.55] text-g1">
          {review.content}
        </p>

        {/* 이미지 썸네일 */}
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

        {/* 날짜 */}
        <p className="mt-3 text-[12px] text-g2">{review.reviewDate}</p>
      </Link>

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
