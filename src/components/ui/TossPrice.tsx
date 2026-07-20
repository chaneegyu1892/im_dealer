import { cn } from "@/lib/utils";

/**
 * 토스풍 거대 분할 금액 표시 — 예: 561,680원 → "56만 1,680원"
 * 만 단위 숫자를 크고 굵게(.num), 단위(만·원)는 작게.
 * 표시 전용 컴포넌트 — 금액 값/계산 로직과 무관하다.
 */

type TossPriceSize = "sm" | "md" | "lg" | "xl";
type TossPriceTone = "ink" | "brand" | "white" | "onBrand";

interface TossPriceProps {
  won: number;
  size?: TossPriceSize;
  tone?: TossPriceTone;
  /** 앞에 붙는 작은 접두 라벨 (예: "월") */
  prefix?: string;
  className?: string;
}

const SIZE: Record<
  TossPriceSize,
  { num: string; man: string; rest: string; won: string; prefix: string }
> = {
  sm: { num: "text-[24px]", man: "text-[15px]", rest: "text-[15px]", won: "text-[13px]", prefix: "text-[13px]" },
  md: { num: "text-[28px]", man: "text-[16px]", rest: "text-[16px]", won: "text-[13px]", prefix: "text-[13px]" },
  lg: { num: "text-[32px]", man: "text-[18px]", rest: "text-[18px]", won: "text-[14px]", prefix: "text-[14px]" },
  xl: { num: "text-[38px] md:text-[44px]", man: "text-[20px]", rest: "text-[20px]", won: "text-[14px]", prefix: "text-[14px]" },
};

const TONE: Record<TossPriceTone, { num: string; unit: string }> = {
  ink: { num: "text-text-strong", unit: "text-text-body" },
  brand: { num: "text-brand", unit: "text-text-body" },
  white: { num: "text-white", unit: "text-white/70" },
  onBrand: { num: "text-[var(--color-brand-ink)]", unit: "text-[var(--color-brand-ink)]" },
};

export function TossPrice({ won, size = "md", tone = "ink", prefix, className }: TossPriceProps) {
  const s = SIZE[size];
  const t = TONE[tone];
  const safe = Math.max(0, Math.round(won));
  const man = Math.floor(safe / 10_000);
  const rest = safe % 10_000;

  return (
    <span className={cn("inline-flex items-baseline gap-[1px]", className)}>
      {prefix && (
        <span className={cn("mr-1 font-bold", s.prefix, t.unit)}>{prefix}</span>
      )}
      <span className={cn("num font-extrabold leading-none", s.num, t.num)}>
        {man.toLocaleString("ko-KR")}
      </span>
      <span className={cn("font-extrabold leading-none", s.man, t.num)}>만</span>
      {rest > 0 && (
        <span className={cn("num font-extrabold leading-none", s.rest, t.num)}>
          {rest.toLocaleString("ko-KR")}
        </span>
      )}
      <span className={cn("font-bold leading-none", s.won, t.unit)}>원</span>
    </span>
  );
}
