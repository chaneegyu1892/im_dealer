"use client";

import Link from "next/link";
import { Star, Image as ImageIcon, Sparkles } from "lucide-react";
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

  return (
    <article
      className={cn(
        "group relative bg-white rounded-card border border-[#F0F0F0] overflow-hidden flex flex-col transition-all hover:border-primary/30 hover:shadow-md",
        className
      )}
    >
      <Link
        href={`/reviews/${review.id}`}
        className="flex flex-col flex-1"
        prefetch={false}
      >
        <div className="relative aspect-[4/3] bg-[#F5F5F5]">
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={cover}
              alt="후기 이미지"
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-ink-caption">
              <ImageIcon size={28} className="opacity-40" />
            </div>
          )}
          {extra > 0 && (
            <div className="absolute bottom-2 right-2 bg-black/60 text-white text-[11px] font-medium px-2 py-0.5 rounded-full">
              +{extra}
            </div>
          )}
          {isBest && (
            <div className="absolute top-2 left-2 inline-flex items-center gap-1 bg-primary text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">
              <Sparkles size={10} />
              BEST
            </div>
          )}
        </div>

        <div className="p-4 flex-1 flex flex-col gap-2">
          <div className="flex items-center gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                size={13}
                className={
                  i < review.rating
                    ? "fill-primary text-primary"
                    : "text-neutral-600"
                }
              />
            ))}
          </div>
          <p className="text-[14px] text-ink-body leading-relaxed line-clamp-3 flex-1 min-h-[60px]">
            {review.content}
          </p>
          <div className="pt-2 mt-auto border-t border-[#F0F0F0] flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[12px] font-medium text-ink truncate">
                {review.displayName}
              </p>
              {review.vehicleName && (
                <p className="text-[11px] text-ink-caption truncate">
                  {review.vehicleName}
                </p>
              )}
            </div>
            <p className="text-[11px] text-ink-caption shrink-0">
              {review.reviewDate}
            </p>
          </div>
        </div>
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
