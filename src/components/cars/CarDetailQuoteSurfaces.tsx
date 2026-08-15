"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Calculator, Check, ChevronRight } from "lucide-react";
import { RepresentativeQuotePrice } from "@/components/cars/RepresentativeQuotePrice";
import { STACK_OFFSET_EXPANDED } from "@/components/layout/dock";
import { ChannelTalkButton } from "@/components/quote/ChannelTalkButton";
import { hasRepresentativeQuote, type RepresentativeQuote } from "@/lib/representative-quote";
import { readRememberedCarsBrowseUrl } from "@/lib/cars-browse-state";

const TRUST_ITEMS = [
  "허위·낚시 견적 없음",
  "개인정보 없이 견적 확인",
  "상담 압박 없음",
  "실제 운영 가능한 조건만",
];

const MOBILE_STICKY_SUMMARY_SCROLL_Y = 180;

export function MobileQuoteSummary({
  vehicleName,
  vehicleSlug,
  quotes,
}: {
  vehicleName: string;
  vehicleSlug: string;
  quotes: RepresentativeQuote[];
}) {
  return (
    <div className="relative z-20 mb-4 block lg:hidden">
      <div className="t-card p-4 shadow-soft">
        <div className="flex items-start justify-between gap-3">
          <RepresentativeQuotePrice
            quotes={quotes}
            tone="brand"
            size="lg"
            captionText="60개월 · 연 2만km · 무보증"
            className="min-w-0"
          />
          <ChannelTalkButton
            vehicleName={vehicleName}
            label="상담"
            size="sm"
            className="min-h-11 shrink-0 rounded-pill border border-line bg-surface px-4 py-2.5 text-[13px] font-bold text-ink hover:bg-surface-muted hover:opacity-100"
          />
        </div>
        <Link
          href={`/quote?vehicle=${vehicleSlug}`}
          className="mt-3 inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-btn bg-brand px-5 text-[15px] font-extrabold text-white transition-colors duration-150 hover:bg-brand-pressed"
        >
          <Calculator size={17} strokeWidth={2.3} />
          견적 내기
        </Link>
      </div>
      <MobileStickyQuoteBar vehicleName={vehicleName} vehicleSlug={vehicleSlug} quotes={quotes} />
    </div>
  );
}

const consultBtnClass =
  "h-14 max-w-full shrink-0 gap-1.5 rounded-full border border-line bg-surface/95 px-5 text-[15px] font-extrabold text-ink shadow-[0_2px_12px_rgb(var(--color-text-strong-rgb)/0.08)] backdrop-blur-md hover:bg-surface-muted hover:opacity-100";

const quoteBtnClass =
  "inline-flex h-14 max-w-full shrink-0 items-center justify-center gap-1.5 rounded-full bg-brand px-5 text-[15px] font-extrabold text-white shadow-[0_2px_12px_rgb(var(--color-text-strong-rgb)/0.12)] transition-colors duration-150 hover:bg-brand-pressed";

function MobileStickyQuoteBar({
  vehicleName,
  vehicleSlug,
}: {
  vehicleName: string;
  vehicleSlug: string;
  quotes: RepresentativeQuote[];
}) {
  const prefersReducedMotion = useReducedMotion();
  const [hasScrolledPastSummary, setHasScrolledPastSummary] = useState(false);
  /** BottomNav 축소 여부 — 펼침일 때 CTA를 우측 정렬 */
  const [navCollapsed, setNavCollapsed] = useState(false);
  const showStickyDock = hasScrolledPastSummary;

  useEffect(() => {
    let animationFrameId: number | null = null;

    const readScrollY = () =>
      window.scrollY ||
      document.documentElement.scrollTop ||
      document.body.scrollTop ||
      0;

    const applyScrollState = () => {
      animationFrameId = null;
      const nextHasScrolledPastSummary = readScrollY() >= MOBILE_STICKY_SUMMARY_SCROLL_Y;
      setHasScrolledPastSummary((current) =>
        current === nextHasScrolledPastSummary ? current : nextHasScrolledPastSummary
      );
    };

    const updateScrollState = () => {
      if (animationFrameId !== null) return;
      animationFrameId = window.requestAnimationFrame(applyScrollState);
    };

    applyScrollState();
    window.addEventListener("scroll", updateScrollState, { passive: true });

    return () => {
      window.removeEventListener("scroll", updateScrollState);
      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId);
      }
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const syncNavCollapsed = () => {
      // dataset 없으면 펼침(기본 메뉴바)으로 본다
      setNavCollapsed(root.dataset.bottomNavCollapsed === "true");
    };
    syncNavCollapsed();
    const observer = new MutationObserver(syncNavCollapsed);
    observer.observe(root, { attributes: true, attributeFilter: ["data-bottom-nav-collapsed"] });
    return () => observer.disconnect();
  }, []);

  const quoteLink = (
    <Link href={`/quote?vehicle=${vehicleSlug}`} className={quoteBtnClass}>
      <Calculator size={17} strokeWidth={2.3} />
      견적 내기
    </Link>
  );

  const consultButton = (
    <ChannelTalkButton
      vehicleName={vehicleName}
      label="상담"
      size="sm"
      className={consultBtnClass}
    />
  );

  return (
    <AnimatePresence initial={false}>
      {showStickyDock && (
        <motion.div
          key="mobile-sticky-quote-dock"
          className="mobile-sticky-quote-dock pointer-events-none fixed left-0 right-0 z-[60] px-3 lg:hidden"
          style={{
            // 축소: 중앙 FAB과 같은 바닥선 / 펼침: 메뉴바 위로 상승
            bottom:
              `calc(var(--bottom-nav-stack-offset, ${STACK_OFFSET_EXPANDED}) + env(safe-area-inset-bottom, 0px))`,
          }}
          initial={prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={prefersReducedMotion ? { opacity: 0, y: 0 } : { opacity: 0, y: 8 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.18, ease: "easeOut" }}
        >
          {navCollapsed ? (
            /* 축소: 점 기준 왼쪽 상담 · 오른쪽 견적 */
            <div className="mx-auto grid max-w-[480px] grid-cols-[1fr_4rem_1fr] items-center gap-2">
              <div className="pointer-events-auto flex min-w-0 justify-end">{consultButton}</div>
              <div className="pointer-events-none h-16 w-16 shrink-0" aria-hidden />
              <div className="pointer-events-auto flex min-w-0 justify-start">{quoteLink}</div>
            </div>
          ) : (
            /* 펼침: 상담 + 견적 모두 우측 정렬, 메뉴바와 가깝게 */
            <div className="pointer-events-auto mx-auto flex max-w-[480px] items-center justify-end gap-2.5">
              {consultButton}
              {quoteLink}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function CarDetailSidebar({
  vehicleName,
  vehicleSlug,
  quotes,
}: {
  vehicleName: string;
  vehicleSlug: string;
  quotes: RepresentativeQuote[];
}) {
  const hasQuote = hasRepresentativeQuote(quotes);
  const [carsListHref, setCarsListHref] = useState("/cars");

  useEffect(() => {
    setCarsListHref(readRememberedCarsBrowseUrl());
  }, []);

  return (
    <div className="hidden lg:col-span-1 lg:block">
      <div className="sticky top-24 space-y-4">
        <motion.div
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.35 }}
          className="t-card p-5 shadow-soft"
        >
          <RepresentativeQuotePrice
            quotes={quotes}
            tone="light"
            size="lg"
            captionText="월 납입금 · 무보증"
          />
          <p className="mt-0.5 text-[11.5px] text-ink-label">
            60개월 · 연 2만km · 반납형 기준
          </p>
          <div className="my-4 h-px bg-line" />
          {hasQuote ? (
            <>
              <Link
                href={`/quote?vehicle=${vehicleSlug}`}
                className="cta mb-2.5 hover:bg-brand-pressed"
              >
                <Calculator size={16} strokeWidth={2} />
                견적 내기
              </Link>
              <ChannelTalkButton vehicleName={vehicleName} label="상담하기" size="md" />
            </>
          ) : (
            <>
              <Link
                href={`/quote?vehicle=${vehicleSlug}`}
                className="cta mb-2.5 hover:bg-brand-pressed"
              >
                <Calculator size={16} strokeWidth={2} />
                견적 내기
              </Link>
              <p className="rounded-[12px] bg-surface-soft px-3 py-2 text-center text-[12px] leading-relaxed text-ink-label">
                조건 선택 후 상담 필요 여부를 안내해드려요
              </p>
            </>
          )}
          <p className="mt-3 text-center text-[11.5px] text-ink-label">
            상담 전 이름·전화번호 요구 없음
          </p>
        </motion.div>

        <div className="t-card p-4 shadow-soft">
          <p className="t-kick mb-3">아임딜러 약속</p>
          <ul className="space-y-2.5">
            {TRUST_ITEMS.map((item) => (
              <li key={item} className="flex items-center gap-2 text-[12.5px] text-ink-label">
                <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-brand-soft">
                  <Check size={10} strokeWidth={2.5} className="text-brand" />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <Link
          href={carsListHref}
          className="group flex w-full items-center justify-between text-[13px] font-bold text-ink-label transition-colors duration-150 hover:text-ink"
        >
          <span>다른 차량 탐색하기</span>
          <ChevronRight size={14} className="transition-transform duration-150 group-hover:translate-x-0.5" />
        </Link>
      </div>
    </div>
  );
}
