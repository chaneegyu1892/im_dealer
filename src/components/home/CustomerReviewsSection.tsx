"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight, Star } from "lucide-react";
import { HomeReviewCard } from "@/components/home/HomeReviewCard";
import { HomeReviewModal } from "@/components/home/HomeReviewModal";
import type { PublicReview } from "@/types/review";

const CARD_WIDTH = 320;
const CARD_GAP = 20;
const STEP = CARD_WIDTH + CARD_GAP;

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
  const [openReview, setOpenReview] = useState<PublicReview | null>(null);

  useEffect(() => {
    const el = trackRef.current;
    if (!el || items.length === 0) return;
    el.style.transition = "transform 260ms cubic-bezier(0.16, 1, 0.3, 1)";
  }, [items.length]);

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
    <section className="mx-auto w-full max-w-[1120px] px-4 py-14 sm:px-5">
      <div className="mb-7 flex items-end justify-between gap-4">
        <div>
          <div className="mb-2 inline-flex items-center gap-1.5 text-[12.5px] font-extrabold uppercase tracking-[0.08em] text-brand">
            <Star size={13} className="fill-status-warning text-status-warning" />
            {sectionLabel}
          </div>
          <h2 className="text-[27px] font-extrabold leading-[1.25] text-text-strong md:text-[32px]">{title}</h2>
        </div>
        <Link
          href="/reviews"
          className="hidden min-h-11 items-center gap-1 rounded-pill px-1 text-[13px] font-bold text-text-muted transition-colors hover:text-text-strong focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/40 sm:inline-flex"
        >
          전체 후기 보기
          <ArrowRight size={14} />
        </Link>
      </div>

      <div className="group/reviews relative -mx-4 overflow-hidden px-4 py-4 sm:-mx-5 sm:px-5">
        <div
          ref={trackRef}
          className="flex w-max will-change-transform"
          style={{ gap: `${CARD_GAP}px`, transform: "translate3d(0, 0, 0)" }}
        >
          {[...items, ...items].map((review, i) => (
            <HomeReviewCard
              key={`${review.id}-${i}`}
              review={review}
              showImages={showImages}
              showBestBadge={forceBestBadge || review.isBest}
              onOpen={setOpenReview}
            />
          ))}
        </div>

        <button
          type="button"
          aria-label="이전 후기"
          onClick={() => nudge(STEP)}
          className="absolute left-3 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-border-subtle bg-surface/80 text-text-strong opacity-0 shadow-card backdrop-blur-sm transition-all duration-state hover:scale-105 hover:bg-surface focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/40 group-hover/reviews:opacity-100"
        >
          <ChevronLeft size={18} />
        </button>
        <button
          type="button"
          aria-label="다음 후기"
          onClick={() => nudge(-STEP)}
          className="absolute right-3 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-border-subtle bg-surface/80 text-text-strong opacity-0 shadow-card backdrop-blur-sm transition-all duration-state hover:scale-105 hover:bg-surface focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/40 group-hover/reviews:opacity-100"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {openReview && (
        <HomeReviewModal
          review={openReview}
          showImages={showImages}
          onClose={() => setOpenReview(null)}
        />
      )}
    </section>
  );
}
