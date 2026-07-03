"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Calculator, Check, ChevronRight } from "lucide-react";
import { RepresentativeQuotePrice } from "@/components/cars/RepresentativeQuotePrice";
import { AiInsight } from "@/components/quote/AiInsight";
import { ChannelTalkButton } from "@/components/quote/ChannelTalkButton";
import { hasRepresentativeQuote, type RepresentativeQuote } from "@/lib/representative-quote";

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
            captionText="60개월 · 초기 비용 0원 · 2만km 기준"
            className="min-w-0"
          />
          <ChannelTalkButton
            vehicleName={vehicleName}
            label="상담"
            size="sm"
            className="shrink-0 rounded-pill border border-line bg-surface px-3.5 py-2 text-[12.5px] font-bold text-ink hover:bg-surface-muted hover:opacity-100"
          />
        </div>
        <Link
          href={`/quote?vehicle=${vehicleSlug}`}
          className="mt-3 inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-btn bg-primary px-5 text-[15px] font-extrabold text-white transition-colors duration-150 hover:bg-primary-strong"
        >
          <Calculator size={17} strokeWidth={2.3} />
          견적 내기
        </Link>
      </div>
      <MobileStickyQuoteBar vehicleName={vehicleName} vehicleSlug={vehicleSlug} quotes={quotes} />
    </div>
  );
}

function MobileStickyQuoteBar({
  vehicleName,
  vehicleSlug,
  quotes,
}: {
  vehicleName: string;
  vehicleSlug: string;
  quotes: RepresentativeQuote[];
}) {
  const hasQuote = hasRepresentativeQuote(quotes);
  const prefersReducedMotion = useReducedMotion();
  const [hasScrolledPastSummary, setHasScrolledPastSummary] = useState(false);
  const showStickyDock = hasScrolledPastSummary;
  const showDockSummary = hasQuote;

  useEffect(() => {
    let animationFrameId: number | null = null;

    const updateScrollState = () => {
      if (animationFrameId !== null) return;

      animationFrameId = window.requestAnimationFrame(() => {
        animationFrameId = null;
        const nextHasScrolledPastSummary = window.scrollY >= MOBILE_STICKY_SUMMARY_SCROLL_Y;
        setHasScrolledPastSummary((current) =>
          current === nextHasScrolledPastSummary ? current : nextHasScrolledPastSummary
        );
      });
    };

    updateScrollState();
    window.addEventListener("scroll", updateScrollState, { passive: true });

    return () => {
      window.removeEventListener("scroll", updateScrollState);
      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId);
      }
    };
  }, []);

  return (
    <AnimatePresence initial={false}>
      {showStickyDock && (
        <motion.div
          key="mobile-sticky-quote-dock"
          className="fixed left-0 right-0 z-40 px-3 lg:hidden"
          style={{ bottom: "calc(104px + env(safe-area-inset-bottom, 0px))" }}
          initial={prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          exit={prefersReducedMotion ? { opacity: 0, y: 0 } : { opacity: 0, y: 12 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.2, ease: "easeOut" }}
        >
          <div className="rounded-[18px] border border-line bg-surface/95 p-3 shadow-[0_-2px_24px_rgb(var(--color-text-strong-rgb)/0.12)] backdrop-blur-md">
            {showDockSummary && (
              <div className="mb-3 min-w-0 px-1">
                <RepresentativeQuotePrice
                  quotes={quotes}
                  tone="brand"
                  size="sm"
                  captionText="60개월 · 초기 비용 0원 · 2만km 기준"
                  captionClassName="text-[10.5px]"
                  className="min-w-0"
                />
              </div>
            )}
            {hasQuote ? (
              <div className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.25fr)] gap-2">
                <ChannelTalkButton
                  vehicleName={vehicleName}
                  label="상담"
                  size="sm"
                  className="min-h-[48px] w-full rounded-btn border border-line bg-surface px-3 py-2 text-[14px] font-extrabold text-ink hover:bg-surface-muted hover:opacity-100"
                />
                <Link
                  href={`/quote?vehicle=${vehicleSlug}`}
                  className="inline-flex min-h-[48px] w-full items-center justify-center gap-1.5 rounded-btn bg-primary px-3 text-[15px] font-extrabold text-white transition-colors duration-150 hover:bg-primary-strong"
                >
                  <Calculator size={16} strokeWidth={2.3} />
                  견적 내기
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="px-1 text-[12px] font-medium leading-relaxed text-ink-label">
                  조건을 선택하면 상담 필요 여부를 바로 확인할 수 있어요.
                </p>
                <Link
                  href={`/quote?vehicle=${vehicleSlug}`}
                  className="inline-flex min-h-[48px] w-full items-center justify-center gap-1.5 rounded-btn bg-primary px-3 text-[15px] font-extrabold text-white transition-colors duration-150 hover:bg-primary-strong"
                >
                  <Calculator size={16} strokeWidth={2.3} />
                  견적 내기
                </Link>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function CarDetailSidebar({
  vehicleName,
  vehicleSlug,
  quotes,
  aiReason,
  highlights,
}: {
  vehicleName: string;
  vehicleSlug: string;
  quotes: RepresentativeQuote[];
  aiReason: string;
  highlights: string[];
}) {
  const hasQuote = hasRepresentativeQuote(quotes);

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
            captionText="월 납입금 (초기 비용 0원)"
          />
          <p className="mt-0.5 text-[11.5px] text-ink-label">
            60개월 · 연 2만km · 반납형 기준
          </p>
          <div className="my-4 h-px bg-line" />
          {hasQuote ? (
            <>
              <Link
                href={`/quote?vehicle=${vehicleSlug}`}
                className="cta mb-2.5 hover:bg-primary-strong"
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
                className="cta mb-2.5 hover:bg-primary-strong"
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

        <AiInsight reason={aiReason} highlights={highlights} />

        <div className="t-card p-4 shadow-soft">
          <p className="t-kick mb-3">아임딜러 약속</p>
          <ul className="space-y-2.5">
            {TRUST_ITEMS.map((item) => (
              <li key={item} className="flex items-center gap-2 text-[12.5px] text-ink-label">
                <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-primary-soft">
                  <Check size={10} strokeWidth={2.5} className="text-primary" />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <Link
          href="/cars"
          className="group flex w-full items-center justify-between text-[13px] font-bold text-ink-label transition-colors duration-150 hover:text-ink"
        >
          <span>다른 차량 탐색하기</span>
          <ChevronRight size={14} className="transition-transform duration-150 group-hover:translate-x-0.5" />
        </Link>
      </div>
    </div>
  );
}
