"use client";

import { cn } from "@/lib/utils";
import type { RepresentativeQuote } from "@/lib/representative-quote";

/**
 * 대표 견적가 표시 — 60개월 / 초기 비용 0원 / 2만km 기준.
 * 장기렌트·리스가 모두 있으면 두 줄로 나란히 노출.
 * 목록 카드·홈 인기차량·차량 상세에서 공통 사용해 표기를 통일한다.
 */

type Tone = "light" | "dark" | "brand";
type Size = "sm" | "md" | "lg" | "xl";

interface RepresentativeQuotePriceProps {
  quotes: RepresentativeQuote[] | undefined;
  tone?: Tone;
  size?: Size;
  /** 상단 캡션 표시 여부 */
  showCaption?: boolean;
  /** 캡션 문구 override */
  captionText?: string;
  /** 견적 없을 때 문구 */
  emptyText?: string;
  className?: string;
}

const DEFAULT_CAPTION = "월 납입금 · 60개월 · 초기 비용 0원";

const NUMBER_SIZE: Record<Size, string> = {
  sm: "text-[20px]",
  md: "text-[22px]",
  lg: "text-[28px]",
  xl: "text-[34px] md:text-[36px]",
};

const UNIT_SIZE: Record<Size, string> = {
  sm: "text-[13px]",
  md: "text-[13px]",
  lg: "text-[14px]",
  xl: "text-[15px]",
};

const TONE_CLASS: Record<
  Tone,
  { caption: string; label: string; number: string; unit: string; empty: string }
> = {
  light: {
    caption: "text-ink-caption",
    label: "text-ink-caption",
    number: "text-ink",
    unit: "text-ink-label",
    empty: "text-ink-label",
  },
  brand: {
    caption: "text-g2",
    label: "text-g2",
    number: "text-brand",
    unit: "text-g1",
    empty: "text-g2",
  },
  dark: {
    caption: "text-white/40",
    label: "text-white/45",
    number: "text-white",
    unit: "text-white/60",
    empty: "text-white/60",
  },
};

function toManwon(won: number): number {
  return Math.round(won / 10_000);
}

export function RepresentativeQuotePrice({
  quotes,
  tone = "light",
  size = "md",
  showCaption = true,
  captionText = DEFAULT_CAPTION,
  emptyText = "견적 준비중",
  className,
}: RepresentativeQuotePriceProps) {
  const t = TONE_CLASS[tone];
  const list = quotes ?? [];
  const showLabels = list.length > 1; // 둘 다 있을 때만 productType 라벨 노출

  return (
    <div className={className}>
      {showCaption && (
        <span className={cn("block mb-1 text-[10px]", t.caption)}>
          {captionText}
        </span>
      )}

      {list.length === 0 ? (
        <span className={cn("text-[14px]", t.empty)}>{emptyText}</span>
      ) : (
        <div className="space-y-0.5">
          {list.map((q) => (
            <div key={q.productType} className="flex items-baseline gap-1.5">
              {showLabels && (
                <span className={cn("text-[11px] font-medium shrink-0", t.label)}>
                  {q.productType}
                </span>
              )}
              <span
                className={cn(
                  "num font-extrabold leading-none",
                  NUMBER_SIZE[size],
                  t.number,
                )}
              >
                {toManwon(q.monthlyPayment).toLocaleString("ko-KR")}
              </span>
              <span className={cn("font-medium", UNIT_SIZE[size], t.unit)}>
                만원~
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
