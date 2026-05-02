"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Star } from "lucide-react";
import type { PublicReview } from "@/types/review";

const CARD_WIDTH = 320;
const CARD_GAP = 20;
const STEP = CARD_WIDTH + CARD_GAP;
const SPEED_PX_PER_SEC = 40;

function ReviewCard({ review }: { review: PublicReview }) {
  return (
    <article className="w-[320px] shrink-0 bg-white rounded-card border border-[#F0F0F0] p-5 shadow-card">
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

interface CustomerReviewsSectionProps {
  reviews: PublicReview[];
  sectionLabel?: string;
  title?: string;
}

export function CustomerReviewsSection({
  reviews,
  sectionLabel = "고객 후기",
  title = "실제 이용자들의 이야기",
}: CustomerReviewsSectionProps) {
  const items = reviews.slice(0, 10);
  const setWidth = items.length * STEP;

  const trackRef = useRef<HTMLDivElement>(null);
  const positionRef = useRef(0);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    const el = trackRef.current;
    if (!el || items.length === 0) return;

    if (isHovered) {
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
  }, [isHovered, setWidth, items.length]);

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
      <div className="mb-8">
        <p className="section-label mb-2">{sectionLabel}</p>
        <h2 className="font-display text-headline-sm text-ink">{title}</h2>
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
            <ReviewCard key={`${review.id}-${i}`} review={review} />
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
    </section>
  );
}
