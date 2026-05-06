"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Star, X, ArrowRight } from "lucide-react";
import type { PublicReview } from "@/types/review";

const CARD_WIDTH = 320;
const CARD_GAP = 20;
const STEP = CARD_WIDTH + CARD_GAP;
const SPEED_PX_PER_SEC = 40;

function ReviewCard({
  review,
  showImages,
  onOpen,
}: {
  review: PublicReview;
  showImages: boolean;
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
      className="w-[320px] shrink-0 bg-white rounded-card border border-[#F0F0F0] p-5 shadow-card cursor-pointer hover:border-primary/30 hover:shadow-md transition-all"
    >
      <div className="flex items-center gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            size={14}
            className={
              i < review.rating
                ? "fill-primary text-primary"
                : "text-neutral-600"
            }
          />
        ))}
      </div>
      <p className="mt-3 text-[14px] text-ink-body leading-relaxed line-clamp-3 min-h-[66px]">
        {review.content}
      </p>
      {images.length > 0 && (
        <div className="mt-3 grid grid-cols-3 gap-1.5">
          {images.map((url, idx) => {
            const isLast = idx === images.length - 1 && extraCount > 0;
            return (
              <div
                key={url}
                className="relative aspect-square rounded-[8px] overflow-hidden border border-[#F0F0F0] bg-[#F5F5F5]"
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
      <div className="mt-4 pt-4 border-t border-[#F0F0F0] flex items-center justify-between">
        <div>
          <p className="text-[13px] font-medium text-ink">{review.displayName}</p>
          {review.vehicleName && (
            <p className="text-[11px] text-ink-caption mt-0.5">{review.vehicleName}</p>
          )}
        </div>
        <p className="text-[11px] text-ink-caption">{review.reviewDate}</p>
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
        className="relative w-full max-w-[640px] max-h-[90vh] bg-white rounded-card shadow-xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          aria-label="닫기"
          onClick={onClose}
          className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-white/90 hover:bg-white border border-[#E0E0E0] flex items-center justify-center text-ink"
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
                  i < review.rating ? "fill-primary text-primary" : "text-neutral-600"
                }
              />
            ))}
            <span className="ml-2 text-[13px] text-ink-caption">
              {review.rating}/5
            </span>
          </div>

          <p className="text-[15px] text-ink-body leading-[1.7] whitespace-pre-wrap break-words">
            {review.content}
          </p>

          {images.length > 0 && (
            <div className="space-y-2">
              <div className="aspect-[4/3] w-full bg-[#F5F5F5] rounded-[10px] overflow-hidden border border-[#F0F0F0]">
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
                        (idx === activeIdx ? "border-primary" : "border-transparent opacity-70 hover:opacity-100")
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

          <div className="pt-4 border-t border-[#F0F0F0] flex items-center justify-between">
            <div>
              <p className="text-[14px] font-medium text-ink">{review.displayName}</p>
              {review.vehicleName && (
                <p className="text-[12px] text-ink-caption mt-0.5">
                  {review.vehicleName}
                </p>
              )}
            </div>
            <p className="text-[12px] text-ink-caption">{review.reviewDate}</p>
          </div>

          <Link
            href={`/reviews/${review.id}`}
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-primary hover:underline"
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
}

export function CustomerReviewsSection({
  reviews,
  sectionLabel = "고객 후기",
  title = "실제 이용자들의 이야기",
  showImages = false,
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
    <section className="page-container py-16">
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <p className="section-label mb-2">{sectionLabel}</p>
          <h2 className="font-display text-headline-sm text-ink">{title}</h2>
        </div>
        <Link
          href="/reviews"
          className="hidden sm:inline-flex items-center gap-1 text-[13px] font-medium text-ink-caption hover:text-ink transition-colors"
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
