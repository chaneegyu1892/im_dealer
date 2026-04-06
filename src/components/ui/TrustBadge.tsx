import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface TrustBadgeProps {
  label: string;
  className?: string;
}

function TrustBadge({ label, className }: TrustBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2",
        "bg-primary-100 text-primary rounded-pill px-[14px] py-[6px]",
        "text-label font-medium",
        className
      )}
    >
      <span className="flex-shrink-0 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
        <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
      </span>
      {label}
    </span>
  );
}

// 기본 배지 3종 묶음
const DEFAULT_BADGES = ["허위견적 없음", "개인정보 없이 견적 확인", "상담 압박 없음"] as const;

interface TrustBadgeGroupProps {
  badges?: string[];
  className?: string;
  itemClassName?: string;
}

function TrustBadgeGroup({
  badges = [...DEFAULT_BADGES],
  className,
  itemClassName,
}: TrustBadgeGroupProps) {
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {badges.map((label) => (
        <TrustBadge key={label} label={label} className={itemClassName} />
      ))}
    </div>
  );
}

export { TrustBadge, TrustBadgeGroup, DEFAULT_BADGES };
