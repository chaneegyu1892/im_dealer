"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useReducedMotion } from "framer-motion";
import { ArrowRight, ChevronLeft, ChevronRight, Star } from "lucide-react";
import { HomeReviewCard } from "@/components/home/HomeReviewCard";
import { HomeReviewModal } from "@/components/home/HomeReviewModal";
import type { PublicReview } from "@/types/review";

const CARD_WIDTH = 320;
const CARD_GAP = 20;
/** 연속 슬라이드 속도(px/초). 시간 흐름에 따라 부드럽게 흐른다. */
const DRIFT_SPEED_PX_PER_SEC = 45;
/** 수동 버튼 1회 이동 트윈 시간(ms). */
const SEEK_DURATION_MS = 380;
/** 단일 rAF 프레임당 최대 dt(ms). 탭 비활성 후 복귀 시 한 번에 크게 밀리지 않게 캡. */
const MAX_FRAME_MS = 64;

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
  // 현재 translateX(px). rAF 매 프레임 갱신.
  const offsetRef = useRef(0);
  const rafIdRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);
  // 수동 버튼 트윈 상태. null 이 아니면 드리프트 대신 이 트윈을 따라간다.
  const seekRef = useRef<{ from: number; to: number; elapsed: number } | null>(null);
  const reducedMotion = useReducedMotion();
  const [openReview, setOpenReview] = useState<PublicReview | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isFocusWithin, setIsFocusWithin] = useState(false);
  const paused = isHovered || isFocusWithin || !!openReview;

  /** 카드 한 칸 폭(px). DOM 측정이 불가능하면 상수 폭으로 대체. */
  const getStep = useCallback(() => {
    const track = trackRef.current;
    const first = track?.children[0] as HTMLElement | undefined;
    const second = track?.children[1] as HTMLElement | undefined;
    const measured = first && second ? second.offsetLeft - first.offsetLeft : 0;
    return measured > 0 ? measured : (first?.offsetWidth || CARD_WIDTH) + CARD_GAP;
  }, []);

  /** 한 세트 폭 = items 한 묶음. 카드가 두 번 복제돼 있어 이 폭만큼 빼면 이어진다. */
  const getSetWidth = useCallback(() => items.length * getStep(), [items.length, getStep]);

  /** 무한 루프: offset 을 [-setWidth, 0] 범위로 정규화. */
  const wrapOffset = useCallback((offset: number) => {
    const setW = getSetWidth();
    if (setW <= 0) return offset;
    let next = offset;
    while (next <= -setW) next += setW;
    while (next > 0) next -= setW;
    return next;
  }, [getSetWidth]);

  const applyTransform = useCallback(() => {
    if (trackRef.current) {
      trackRef.current.style.transform = `translate3d(${offsetRef.current}px, 0, 0)`;
    }
  }, []);

  // 연속 드리프트 + 수동 시크 트윈을 rAF 하나로 처리. paused 면 드리프트는 멈추되
  // 진행 중인 시크는 끝까지 완료한다(reducedMotion 이면 아예 시작하지 않는다).
  useEffect(() => {
    if (items.length < 2 || reducedMotion) return;
    lastTsRef.current = null;

    const tick = (ts: number) => {
      if (lastTsRef.current == null) lastTsRef.current = ts;
      const dt = Math.min(MAX_FRAME_MS, ts - lastTsRef.current) / 1000;
      lastTsRef.current = ts;

      if (seekRef.current) {
        // easeOutCubic 트윈으로 한 칸 부드럽게 이동.
        seekRef.current.elapsed += dt * 1000;
        const p = Math.min(1, seekRef.current.elapsed / SEEK_DURATION_MS);
        const eased = 1 - Math.pow(1 - p, 3);
        offsetRef.current =
          seekRef.current.from + (seekRef.current.to - seekRef.current.from) * eased;
        if (p >= 1) seekRef.current = null;
      } else if (!paused) {
        // 시간 흐름에 따른 연속 드리프트.
        offsetRef.current = wrapOffset(offsetRef.current - DRIFT_SPEED_PX_PER_SEC * dt);
      }

      applyTransform();
      rafIdRef.current = requestAnimationFrame(tick);
    };

    rafIdRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafIdRef.current != null) cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    };
  }, [items.length, reducedMotion, paused, wrapOffset, applyTransform]);

  // 뷰포트 폭이 바뉴면 카드 폭이 달라지므로 첫 카드로 재정렬.
  useEffect(() => {
    const resetPosition = () => {
      offsetRef.current = 0;
      seekRef.current = null;
      applyTransform();
    };
    window.addEventListener("resize", resetPosition);
    return () => window.removeEventListener("resize", resetPosition);
  }, [applyTransform]);

  /** 수동 버튼: 한 칸 부드럽게 이동. reducedMotion 이면 즉시 이동. */
  const seekBy = useCallback(
    (deltaCards: number) => {
      const step = getStep() * deltaCards;
      if (reducedMotion) {
        offsetRef.current = wrapOffset(offsetRef.current + step);
        applyTransform();
        return;
      }
      const from = seekRef.current ? seekRef.current.to : offsetRef.current;
      seekRef.current = { from, to: wrapOffset(from + step), elapsed: 0 };
    },
    [getStep, wrapOffset, applyTransform, reducedMotion],
  );

  if (items.length === 0) return null;

  return (
    <section className="mx-auto w-full max-w-[1120px] px-4 py-14 sm:px-5">
      <div className="mb-7 flex items-end justify-between gap-4 max-[340px]:flex-col max-[340px]:items-start max-[340px]:gap-2">
        <div>
          <div className="mb-2 inline-flex items-center gap-1.5 text-[12.5px] font-extrabold uppercase tracking-[0.08em] text-brand">
            <Star size={13} className="fill-status-warning text-status-warning" />
            {sectionLabel}
          </div>
          <h2 className="break-keep text-[27px] font-extrabold leading-[1.25] text-text-strong max-[340px]:text-[25px] md:text-[32px]">{title}</h2>
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
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onFocus={() => setIsFocusWithin(true)}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setIsFocusWithin(false);
          }
        }}
      >
        <div
          ref={trackRef}
          className="flex w-max will-change-transform"
          style={{ gap: `${CARD_GAP}px`, transform: "translate3d(0px, 0, 0)" }}
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
          onClick={() => seekBy(1)}
          className="absolute left-3 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-border-subtle bg-surface/80 text-text-strong opacity-100 shadow-card backdrop-blur-sm transition-all duration-state hover:scale-105 hover:bg-surface focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/40 max-[340px]:bottom-3 max-[340px]:top-auto max-[340px]:translate-y-0 sm:opacity-0 sm:group-hover/reviews:opacity-100"
        >
          <ChevronLeft size={18} />
        </button>
        <button
          type="button"
          aria-label="다음 후기"
          onClick={() => seekBy(-1)}
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
