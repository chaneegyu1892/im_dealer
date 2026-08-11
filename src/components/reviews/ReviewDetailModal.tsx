"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, Star, X } from "lucide-react";
import { LikeButton } from "@/components/reviews/LikeButton";
import { getOrCreateAnonId } from "@/lib/anon-id";
import { cn } from "@/lib/utils";
import type { PublicReview } from "@/types/review";

type ReviewDetailModalProps = {
  readonly review: PublicReview;
  readonly onClose: () => void;
};

/**
 * 후기 목록/베스트에서 카드 클릭 시 페이지 이동 없이 상세를 보여 주는 모달.
 * /reviews/[id] 상세 카드 레이아웃을 유지한다.
 */
export function ReviewDetailModal({ review, onClose }: ReviewDetailModalProps) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [initialLiked, setInitialLiked] = useState(false);
  const [likedResolved, setLikedResolved] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    restoreFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const focusableSelector = [
      "a[href]",
      "button:not([disabled])",
      "textarea:not([disabled])",
      "input:not([disabled])",
      "select:not([disabled])",
      '[tabindex]:not([tabindex="-1"])',
    ].join(",");

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(focusableSelector) ?? [],
      ).filter((el) => !el.hasAttribute("disabled") && el.offsetParent !== null);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKey);
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.setTimeout(() => {
      dialogRef.current?.querySelector<HTMLElement>(focusableSelector)?.focus();
    }, 0);

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = original;
      restoreFocusRef.current?.focus();
    };
  }, [onClose]);

  useEffect(() => {
    setActiveIdx(0);
    setLikedResolved(false);
    setInitialLiked(false);
    const anonId = getOrCreateAnonId();
    if (!anonId) {
      void Promise.resolve().then(() => setLikedResolved(true));
      return;
    }
    let cancelled = false;
    fetch(`/api/public/reviews/${review.id}?anonId=${encodeURIComponent(anonId)}`, {
      cache: "no-store",
    })
      .then(async (res) => {
        if (!res.ok) return;
        const json = (await res.json()) as {
          success: boolean;
          data: { liked: boolean };
        };
        if (!cancelled && json.success) setInitialLiked(json.data.liked);
      })
      .catch(() => {
        if (!cancelled) setInitialLiked(false);
      })
      .finally(() => {
        if (!cancelled) setLikedResolved(true);
      });
    return () => {
      cancelled = true;
    };
  }, [review.id]);

  const initial = review.displayName.trim().charAt(0) || "익";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-text-strong/65 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`${review.displayName} 후기 상세`}
    >
      <div
        ref={dialogRef}
        className="relative flex max-h-[90vh] w-full max-w-[640px] flex-col overflow-hidden rounded-card-lg border border-border-subtle bg-surface shadow-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          aria-label="닫기"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 flex h-11 w-11 items-center justify-center rounded-full border border-border-subtle bg-surface/90 text-text-strong shadow-card transition-colors hover:bg-surface focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/40"
        >
          <X size={16} />
        </button>

        <div className="space-y-6 overflow-y-auto p-6 md:p-8">
          <header className="space-y-3 pr-10">
            <div className="flex items-center gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  size={18}
                  className={
                    i < review.rating
                      ? "fill-status-warning text-status-warning"
                      : "text-border-strong"
                  }
                />
              ))}
              <span className="ml-2 text-[14px] text-text-muted">{review.rating}/5</span>
              {review.isBest && (
                <span className="ml-3 inline-flex items-center gap-0.5 rounded-full bg-brand px-2 py-0.5 text-[11px] font-semibold text-white">
                  <Sparkles size={10} />
                  BEST
                </span>
              )}
            </div>

            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[15px] font-extrabold text-brand">
                  {initial}
                </span>
                <div className="min-w-0">
                  <p className="text-[15px] font-extrabold text-text-strong">
                    {review.displayName}
                  </p>
                  {review.vehicleName ? (
                    <p className="mt-0.5 truncate text-[13px] font-semibold text-text-muted">
                      {review.vehicleName}
                    </p>
                  ) : null}
                </div>
              </div>
              <p className="shrink-0 text-[13px] text-text-muted">{review.reviewDate}</p>
            </div>
          </header>

          <p className="whitespace-pre-wrap break-words text-[15px] leading-[1.75] text-text-body">
            {review.content}
          </p>

          {review.imageUrls.length > 0 && (
            <div className="space-y-3">
              <div className="aspect-[16/10] w-full overflow-hidden rounded-[14px] border border-border-subtle bg-surface-soft">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={review.imageUrls[activeIdx]}
                  alt={`첨부 ${activeIdx + 1}`}
                  className="h-full w-full object-contain bg-black/5"
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
                        "h-20 w-20 shrink-0 overflow-hidden rounded-[10px] border-2 transition-colors",
                        idx === activeIdx
                          ? "border-brand"
                          : "border-transparent opacity-70 hover:border-border-subtle hover:opacity-100",
                      )}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt={`썸네일 ${idx + 1}`} className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="border-t border-border-subtle pt-4">
            {likedResolved ? (
              <LikeButton
                reviewId={review.id}
                initialLikeCount={review.likeCount}
                initialLiked={initialLiked}
                size="md"
              />
            ) : (
              <div className="h-11 w-28 animate-pulse rounded-pill bg-surface-soft" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
