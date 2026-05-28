"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { getOrCreateAnonId } from "@/lib/anon-id";
import { LikeButton } from "@/components/reviews/LikeButton";
import type { PublicReview } from "@/types/review";

interface ReviewDetailClientProps {
  review: PublicReview;
}

export function ReviewDetailClient({ review }: ReviewDetailClientProps) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [initialLiked, setInitialLiked] = useState(false);
  const [likedResolved, setLikedResolved] = useState(false);

  useEffect(() => {
    const anonId = getOrCreateAnonId();
    if (!anonId) {
      setLikedResolved(true);
      return;
    }
    let cancelled = false;
    fetch(
      `/api/public/reviews/${review.id}?anonId=${encodeURIComponent(anonId)}`,
      { cache: "no-store" }
    )
      .then(async (res) => {
        if (!res.ok) return;
        const json = (await res.json()) as {
          success: boolean;
          data: { liked: boolean };
        };
        if (!cancelled && json.success) setInitialLiked(json.data.liked);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLikedResolved(true);
      });
    return () => {
      cancelled = true;
    };
  }, [review.id]);

  return (
    <div className="space-y-6">
      <p className="text-[16px] text-ink-body leading-[1.8] whitespace-pre-wrap break-words">
        {review.content}
      </p>

      {review.imageUrls.length > 0 && (
        <div className="space-y-3">
          <div className="aspect-[16/10] w-full bg-[#F5F5F5] rounded-[12px] overflow-hidden border border-[#F0F0F0]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={review.imageUrls[activeIdx]}
              alt={`첨부 ${activeIdx + 1}`}
              className="w-full h-full object-contain bg-black/5"
            />
          </div>
          {review.imageUrls.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {review.imageUrls.map((url, idx) => (
                <button
                  type="button"
                  key={url}
                  onClick={() => setActiveIdx(idx)}
                  className={cn(
                    "shrink-0 w-20 h-20 rounded-[8px] overflow-hidden border-2 transition-colors",
                    idx === activeIdx
                      ? "border-primary"
                      : "border-transparent opacity-70 hover:opacity-100"
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={`썸네일 ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="pt-4 border-t border-[#F0F0F0] flex items-center justify-between gap-4">
        <span className="text-[13px] text-ink-caption">
          이 후기가 도움이 되었나요?
        </span>
        {likedResolved ? (
          <LikeButton
            reviewId={review.id}
            initialLikeCount={review.likeCount}
            initialLiked={initialLiked}
            size="md"
            variant="filled"
          />
        ) : (
          <div className="h-9 w-20 rounded-full bg-[#F4F5FA] animate-pulse" />
        )}
      </div>
    </div>
  );
}
