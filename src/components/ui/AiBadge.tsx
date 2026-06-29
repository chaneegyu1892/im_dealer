import { cn } from "@/lib/utils";

/**
 * "AI" 레터마크 배지 — 장식용 반짝이(Sparkles) 아이콘을 대체한다.
 * AI 가치를 깔끔한 타이포 배지로 살리되 'AI가 만든 화면' 느낌(슬롭)을 제거.
 */

type AiBadgeTone = "solid" | "soft" | "onDark";

interface AiBadgeProps {
  tone?: AiBadgeTone;
  className?: string;
}

const TONE: Record<AiBadgeTone, string> = {
  solid: "bg-brand text-white",
  soft: "bg-brand-soft text-brand",
  onDark: "bg-white/15 text-white",
};

export function AiBadge({ tone = "solid", className }: AiBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-[5px] px-1.5 py-[3px]",
        "text-[10px] font-extrabold leading-none tracking-[0.02em]",
        TONE[tone],
        className
      )}
    >
      AI
    </span>
  );
}
