"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight, Star } from "lucide-react";
import { HomeReviewCard } from "@/components/home/HomeReviewCard";
import { HomeReviewModal } from "@/components/home/HomeReviewModal";
import type { PublicReview } from "@/types/review";

const CARD_WIDTH = 320;
const CARD_GAP = 20;
/** 연속 자동 스크롤 속도 (px/sec) — 부드럽게 흘러가는 느낌 */
const AUTO_SPEED_PX_PER_SEC = 28;
/** 수동 버튼 한 번 이동 시 카드 수 */
const MANUAL_STEP_CARDS = 1;

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
  const trackRef = useRef<HTMLDivElement>(null);
  const positionRef = useRef(0);
  const setWidthRef = useRef(0);
  const pausedRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);
  const [openReview, setOpenReview] = useState<PublicReview | null>(null);

  const measureSetWidth = useCallback(() => {
    const track = trackRef.current;
    if (!track || items.length === 0) return 0;
    // 복제 전 원본 세트 너비 = 전체의 절반 (items를 2번 렌더)
    const total = track.scrollWidth;
    return total > 0 ? total / 2 : items.length * (CARD_WIDTH + CARD_GAP);
  }, [items.length]);

  const applyTransform = useCallback((x: number, withTransition: boolean) => {
    const track = trackRef.current;
    if (!track) return;
    if (withTransition) {
      track.style.transition = "transform 480ms cubic-bezier(0.22, 1, 0.36, 1)";
    } else {
      track.style.transition = "none";
    }
    track.style.transform = `translate3d(${x}px, 0, 0)`;
  }, []);

  const wrapPosition = useCallback((x: number, setWidth: number) => {
    if (setWidth <= 0) return x;
    let next = x;
    // 왼쪽으로 흘러가며 음수가 커질 때, 한 세트만큼 되돌린다.
    while (next <= -setWidth) next += setWidth;
    while (next > 0) next -= setWidth;
    return next;
  }, []);

  const nudge = useCallback(
    (direction: 1 | -1) => {
      const track = trackRef.current;
      const firstCard = track?.children[0] as HTMLElement | undefined;
      const secondCard = track?.children[1] as HTMLElement | undefined;
      const measuredStep =
        firstCard && secondCard ? secondCard.offsetLeft - firstCard.offsetLeft : 0;
      const fallbackStep = (firstCard?.offsetWidth || CARD_WIDTH) + CARD_GAP;
      const renderedStep = measuredStep > 0 ? measuredStep : fallbackStep;
      const setWidth = measureSetWidth() || items.length * renderedStep;
      setWidthRef.current = setWidth;

      let next = positionRef.current + direction * renderedStep * MANUAL_STEP_CARDS;
      next = wrapPosition(next, setWidth);
      positionRef.current = next;
      applyTransform(next, true);
    },
    [applyTransform, items.length, measureSetWidth, wrapPosition],
  );

  // 연속 자동 스크롤 (requestAnimationFrame)
  useEffect(() => {
    if (items.length < 2) return;

    const prefersReducedMotion =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return;

    // 레이아웃 안정 후 세트 너비 측정
    setWidthRef.current = measureSetWidth();

    const tick = (ts: number) => {
      if (lastTsRef.current == null) lastTsRef.current = ts;
      const dt = Math.min(48, ts - lastTsRef.current) / 1000;
      lastTsRef.current = ts;

      if (!pausedRef.current && !openReview) {
        const setWidth = setWidthRef.current || measureSetWidth();
        setWidthRef.current = setWidth;
        if (setWidth > 0) {
          let next = positionRef.current - AUTO_SPEED_PX_PER_SEC * dt;
          // 세트 경계를 넘으면 transition 없이 랩 — 끊김 없이 이어짐
          if (next <= -setWidth) {
            next += setWidth;
          }
          positionRef.current = next;
          applyTransform(next, false);
        }
      }

      rafRef.current = window.requestAnimationFrame(tick);
    };

    rafRef.current = window.requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lastTsRef.current = null;
    };
  }, [applyTransform, items.length, measureSetWidth, openReview]);

  useEffect(() => {
    const onResize = () => {
      setWidthRef.current = measureSetWidth();
      positionRef.current = 0;
      applyTransform(0, false);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [applyTransform, measureSetWidth]);

  if (items.length === 0) return null;

  return (
    <section className="mx-auto w-full max-w-[1120px] px-4 py-14 sm:px-5">
      <div className="mb-7 flex items-end justify-between gap-4 max-[340px]:flex-col max-[340px]:items-start max-[340px]:gap-2">
        <div>
          <div className="mb-2 inline-flex items-center gap-1.5 text-[12.5px] font-extrabold uppercase tracking-[0.08em] text-brand">
            <Star size={13} className="fill-status-warning text-status-warning" />
            {sectionLabel}
          </div>
          <h2 className="break-keep text-[27px] font-extrabold leading-[1.25] text-text-strong max-[340px]:text-[25px] md:text-[32px]">
            {title}
          </h2>
        </div>
        <Link
          href="/reviews"
          className="inline-flex min-h-11 items-center gap-1 rounded-pill px-1 text-[13px] font-bold text-text-muted transition-colors hover:text-text-strong focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/40"
        >
          전체 후기 보기
          <ArrowRight size={14} />
        </Link>
      </div>

      <div
        className="group/reviews relative -mx-4 overflow-hidden px-4 py-4 max-[340px]:pb-[72px] sm:-mx-5 sm:px-5"
        onMouseEnter={() => {
          pausedRef.current = true;
        }}
        onMouseLeave={() => {
          pausedRef.current = false;
          lastTsRef.current = null;
        }}
        onFocusCapture={() => {
          pausedRef.current = true;
        }}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            pausedRef.current = false;
            lastTsRef.current = null;
          }
        }}
      >
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
          onClick={() => nudge(1)}
          className="absolute left-3 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-border-subtle bg-surface/80 text-text-strong opacity-100 shadow-card backdrop-blur-sm transition-all duration-state hover:scale-105 hover:bg-surface focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/40 max-[340px]:bottom-3 max-[340px]:top-auto max-[340px]:translate-y-0 sm:opacity-0 sm:group-hover/reviews:opacity-100"
        >
          <ChevronLeft size={18} />
        </button>
        <button
          type="button"
          aria-label="다음 후기"
          onClick={() => nudge(-1)}
          className="absolute right-3 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-border-subtle bg-surface/80 text-text-strong opacity-100 shadow-card backdrop-blur-sm transition-all duration-state hover:scale-105 hover:bg-surface focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/40 max-[340px]:bottom-3 max-[340px]:top-auto max-[340px]:translate-y-0 sm:opacity-0 sm:group-hover/reviews:opacity-100"
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
