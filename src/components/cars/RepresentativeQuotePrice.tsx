"use client";

import { cn } from "@/lib/utils";
import {
  availableRepresentativeQuotes,
  type RepresentativeQuote,
} from "@/lib/representative-quote";

/**
 * 대표 견적가 표시 — 60개월 / 연 2만km / 무보증 기준.
 * 장기렌트·리스가 모두 있으면 두 줄로 나란히 노출.
 * 목록 카드·홈 인기차량·차량 상세에서 공통 사용해 표기를 통일한다.
 */

type Tone = "light" | "dark" | "brand";
type Size = "sm" | "md" | "lg" | "xl";
type Align = "start" | "end";

interface RepresentativeQuotePriceProps {
  quotes: RepresentativeQuote[] | undefined;
  tone?: Tone;
  size?: Size;
  /** 상단 캡션 표시 여부 */
  showCaption?: boolean;
  /** 캡션 문구 override */
  captionText?: string;
  /** 캡션 스타일 override */
  captionClassName?: string;
  /** 금액 숫자 스타일 override */
  numberClassName?: string;
  /** 금액 단위 스타일 override */
  unitClassName?: string;
  /** 견적 없을 때 문구 */
  emptyText?: string;
  /** 가격 묶음 정렬. 공용 기본값은 기존과 같은 왼쪽 정렬. */
  align?: Align;
  className?: string;
}

const DEFAULT_CAPTION = "월 납입금 · 60개월 · 연 2만km · 무보증";

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
    caption: "text-text-muted",
    label: "text-text-muted",
    number: "text-text-strong",
    unit: "text-text-body",
    empty: "text-text-muted",
  },
  brand: {
    caption: "text-text-muted",
    label: "text-text-muted",
    number: "text-brand",
    unit: "text-text-body",
    empty: "text-text-muted",
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
  captionClassName,
  numberClassName,
  unitClassName,
  emptyText = "견적 준비 중",
  align = "start",
  className,
}: RepresentativeQuotePriceProps) {
  const t = TONE_CLASS[tone];
  const list = availableRepresentativeQuotes(quotes);
  const showLabels = list.length > 1; // 둘 다 있을 때만 productType 라벨 노출

  return (
    <div className={cn(align === "end" && "text-right", className)}>
      {showCaption && (
        <span className={cn("mb-1 block text-[10px]", t.caption, captionClassName)}>
          {captionText}
        </span>
      )}

      {list.length === 0 ? (
        <span className={cn("text-[14px]", t.empty)}>{emptyText}</span>
      ) : (
        <div className={cn("space-y-0.5", align === "end" && "flex flex-col items-end")}>
          {list.map((q) => (
            <div
              key={q.productType}
              className={cn(
                "flex min-w-0 items-baseline gap-1.5 whitespace-nowrap",
                align === "end" && "justify-end",
              )}
            >
              {showLabels && (
                <span className={cn("text-[11px] font-medium shrink-0", t.label)}>
                  {q.productType}
                </span>
              )}
              <span
                className={cn(
                  "num shrink-0 font-extrabold leading-none",
                  NUMBER_SIZE[size],
                  t.number,
                  numberClassName,
                )}
              >
                {toManwon(q.monthlyPayment).toLocaleString("ko-KR")}
              </span>
              <span className={cn("shrink-0 whitespace-nowrap font-medium", UNIT_SIZE[size], t.unit, unitClassName)}>
                만원~
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
