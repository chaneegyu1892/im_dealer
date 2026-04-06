import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface SelectionCardProps {
  label: string;
  desc?: string;
  detail?: string;
  icon?: string;
  selected: boolean;
  recommended?: boolean;
  onClick: () => void;
}

export function SelectionCard({
  label,
  desc,
  detail,
  icon,
  selected,
  recommended = false,
  onClick,
}: SelectionCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full text-left rounded-card p-4 border transition-all duration-200",
        "flex items-start gap-3",
        selected
          ? "border-primary bg-primary-100 shadow-none"
          : "border-[#F0F0F0] bg-white shadow-card hover:border-primary-200 hover:shadow-card-hover hover:-translate-y-0.5"
      )}
    >
      {/* 이모지 아이콘 */}
      {icon && (
        <span className="text-2xl flex-shrink-0 leading-none mt-0.5">{icon}</span>
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={cn(
              "text-sm font-medium",
              selected ? "text-primary" : "text-ink"
            )}
          >
            {label}
          </span>
          {recommended && !selected && (
            <span className="text-[10px] font-medium text-primary bg-primary-100 px-2 py-0.5 rounded-pill">
              추천
            </span>
          )}
        </div>
        {desc && (
          <p className={cn("text-[13px] mt-0.5", selected ? "text-primary/70" : "text-ink-label")}>
            {desc}
          </p>
        )}
        {detail && (
          <p className="text-[12px] mt-1 text-ink-caption">{detail}</p>
        )}
      </div>

      {/* 선택 체크 */}
      <div
        className={cn(
          "flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 transition-all",
          selected ? "border-primary bg-primary" : "border-neutral-800 bg-white"
        )}
      >
        {selected && <Check size={11} className="text-white" strokeWidth={3} />}
      </div>
    </button>
  );
}
