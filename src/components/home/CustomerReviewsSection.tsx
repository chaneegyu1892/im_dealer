"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Star, X, ArrowRight, Heart } from "lucide-react";
import type { PublicReview } from "@/types/review";

const CARD_WIDTH = 320;
const CARD_GAP = 20;
const STEP = CARD_WIDTH + CARD_GAP;
const SPEED_PX_PER_SEC = 40;

function ReviewCard({
  review,
  showImages,
  showBestBadge,
  onOpen,
}: {
  review: PublicReview;
  showImages: boolean;
  showBestBadge: boolean;
  onOpen: (review: PublicReview) => void;
}) {
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
      className="w-[320px] shrink-0 bg-white rounded-[18px] border border-line2 p-5 shadow-soft cursor-pointer hover:border-brand/30 hover:shadow-md transition-all"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-0.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              size={15}
              className={
                i < review.rating
                  ? "fill-[#FFB020] text-[#FFB020]"
                  : "text-line2"
              }
            />
          ))}
        </div>
        {showBestBadge && (
          <span className="inline-flex items-center gap-1 bg-brand text-white text-[11px] font-extrabold px-2.5 py-1 rounded-pill">
            BEST 리뷰
          </span>
        )}
      </div>
      <p className="mt-3 text-[14px] text-ink-body leading-[1.6] line-clamp-3 min-h-[66px]">
        {review.content}
      </p>
      {images.length > 0 && (
        <div className="mt-3 grid grid-cols-3 gap-1.5">
          {images.map((url, idx) => {
            const isLast = idx === images.length - 1 && extraCount > 0;
            return (
              <div
                key={url}
                className="relative aspect-square rounded-[10px] overflow-hidden border border-line2 bg-sec"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={`첨부 ${idx + 1}`}
                  className="w-full h-full object-cover pointer-events-none select-none"
                  draggable={false}
                />
                {isLast && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white text-[13px] font-semibold pointer-events-none">
                    +{extraCount}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      <div className="mt-4 pt-4 border-t border-line2 flex items-center justify-between">
        <div>
          <p className="text-[13.5px] font-extrabold text-ink">{review.displayName}</p>
          {review.vehicleName && (
            <p className="text-[11.5px] text-g2 mt-0.5">{review.vehicleName}</p>
          )}
        </div>
        <div className="flex items-center gap-2 text-[11.5px] text-g2">
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

function ReviewModal({
  review,
  showImages,
  onClose,
}: {
  review: PublicReview;
  showImages: boolean;
  onClose: () => void;
}) {
  const images = showImages ? review.imageUrls : [];
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = original;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="후기 상세"
    >
      <div
        className="relative w-full max-w-[640px] max-h-[90vh] bg-white rounded-[18px] shadow-xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          aria-label="닫기"
          onClick={onClose}
          className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-white/90 hover:bg-white border border-line2 flex items-center justify-center text-ink"
        >
          <X size={16} />
        </button>

        <div className="overflow-y-auto p-6 sm:p-7 space-y-5">
          <div className="flex items-center gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                size={16}
                className={
                  i < review.rating ? "fill-[#FFB020] text-[#FFB020]" : "text-line2"
                }
              />
            ))}
            <span className="ml-2 text-[13px] font-bold text-g2">
              {review.rating}/5
            </span>
          </div>

          <p className="text-[15px] text-ink-body leading-[1.7] whitespace-pre-wrap break-words">
            {review.content}
          </p>

          {images.length > 0 && (
            <div className="space-y-2">
              <div className="aspect-[4/3] w-full bg-sec rounded-[12px] overflow-hidden border border-line2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={images[activeIdx]}
                  alt={`첨부 ${activeIdx + 1}`}
                  className="w-full h-full object-contain select-none"
                  draggable={false}
                />
              </div>
              {images.length > 1 && (
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                  {images.map((url, idx) => (
                    <button
                      type="button"
                      key={url}
                      onClick={() => setActiveIdx(idx)}
                      className={
                        "shrink-0 w-16 h-16 rounded-[6px] overflow-hidden border-2 transition-colors " +
                        (idx === activeIdx ? "border-brand" : "border-transparent opacity-70 hover:opacity-100")
                      }
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt={`썸네일 ${idx + 1}`}
                        className="w-full h-full object-cover"
                        draggable={false}
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="pt-4 border-t border-line2 flex items-center justify-between">
            <div>
              <p className="text-[14px] font-extrabold text-ink">{review.displayName}</p>
              {review.vehicleName && (
                <p className="text-[12px] text-g2 mt-0.5">
                  {review.vehicleName}
                </p>
              )}
            </div>
            <p className="text-[12px] text-g2">{review.reviewDate}</p>
          </div>

          <Link
            href={`/reviews/${review.id}`}
            className="inline-flex items-center gap-1.5 text-[13px] font-extrabold text-brand hover:underline"
          >
            이 후기 자세히 보기
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </div>
  );
}

interface CustomerReviewsSectionProps {
  reviews: PublicReview[];
  sectionLabel?: string;
  title?: string;
  showImages?: boolean;
  forceBestBadge?: boolean;
}

export function CustomerReviewsSection({
  reviews,
  sectionLabel = "고객 후기",
  title = "실제 이용자들의 이야기",
  showImages = false,
  forceBestBadge = false,
}: CustomerReviewsSectionProps) {
  const items = reviews.slice(0, 10);
  const setWidth = items.length * STEP;

  const trackRef = useRef<HTMLDivElement>(null);
  const positionRef = useRef(0);
  const [isHovered, setIsHovered] = useState(false);
  const [openReview, setOpenReview] = useState<PublicReview | null>(null);

  useEffect(() => {
    const el = trackRef.current;
    if (!el || items.length === 0) return;

    if (isHovered || openReview) {
      el.style.transition = "transform 400ms cubic-bezier(0.22, 1, 0.36, 1)";
      return;
    }

    el.style.transition = "none";
    let rafId = 0;
    let lastTime = performance.now();

    const tick = (now: number) => {
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      let next = positionRef.current - SPEED_PX_PER_SEC * dt;
      if (next <= -setWidth) next += setWidth;
      positionRef.current = next;

      el.style.transform = `translate3d(${next}px, 0, 0)`;
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isHovered, openReview, setWidth, items.length]);

  if (items.length === 0) return null;

  const nudge = (delta: number) => {
    let next = positionRef.current + delta;
    while (next <= -setWidth) next += setWidth;
    while (next > 0) next -= setWidth;
    positionRef.current = next;
    if (trackRef.current) {
      trackRef.current.style.transform = `translate3d(${next}px, 0, 0)`;
    }
  };

  return (
    <section className="t-shell-wide py-14">
      <div className="mb-7 flex items-end justify-between gap-4">
        <div>
          <div className="t-kick mb-2">
            <Star size={13} className="fill-[#FFB020] text-[#FFB020]" />
            {sectionLabel}
          </div>
          <h2 className="t-h1">{title}</h2>
        </div>
        <Link
          href="/reviews"
          className="hidden sm:inline-flex items-center gap-1 text-[13px] font-bold text-g2 hover:text-ink transition-colors"
        >
          전체 후기 보기
          <ArrowRight size={14} />
        </Link>
      </div>

      <div
        className="group/reviews relative overflow-hidden"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div
          ref={trackRef}
          className="flex w-max will-change-transform"
          style={{ gap: `${CARD_GAP}px`, transform: "translate3d(0, 0, 0)" }}
        >
          {[...items, ...items].map((review, i) => (
            <ReviewCard
              key={`${review.id}-${i}`}
              review={review}
              showImages={showImages}
              showBestBadge={forceBestBadge || review.isBest}
              onOpen={setOpenReview}
            />
          ))}
        </div>

        <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-white to-transparent z-10" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-white to-transparent z-10" />

        <button
          type="button"
          aria-label="이전 후기"
          onClick={() => nudge(STEP)}
          className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full
                     bg-white/60 backdrop-blur-sm border border-white/40 text-ink
                     flex items-center justify-center
                     opacity-0 group-hover/reviews:opacity-100
                     transition-all duration-200 hover:bg-white/90 hover:scale-105 shadow-card"
        >
          <ChevronLeft size={18} />
        </button>
        <button
          type="button"
          aria-label="다음 후기"
          onClick={() => nudge(-STEP)}
          className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full
                     bg-white/60 backdrop-blur-sm border border-white/40 text-ink
                     flex items-center justify-center
                     opacity-0 group-hover/reviews:opacity-100
                     transition-all duration-200 hover:bg-white/90 hover:scale-105 shadow-card"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {openReview && (
        <ReviewModal
          review={openReview}
          showImages={showImages}
          onClose={() => setOpenReview(null)}
        />
      )}
    </section>
  );
}
