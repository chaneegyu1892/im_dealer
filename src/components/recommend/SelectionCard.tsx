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
        "w-full min-h-[72px] rounded-[14px] border p-4 text-left transition-all duration-200",
        "flex items-center gap-3 active:scale-[0.99]",
        selected
          ? "border-primary bg-primary/[0.06] shadow-[0_8px_20px_rgba(0,6,102,0.07)]"
          : "border-public-border bg-white shadow-[0_6px_18px_rgba(18,24,40,0.035)] hover:border-primary/25"
      )}
    >
      {icon && (
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-public-bg text-[20px] leading-none">
          {icon}
        </span>
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
          <p className={cn("mt-0.5 text-[12px] leading-relaxed", selected ? "text-primary/70" : "text-public-muted")}>
            {desc}
          </p>
        )}
        {detail && (
          <p className="mt-1 text-[11px] text-public-muted">{detail}</p>
        )}
      </div>

      <div
        className={cn(
          "flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border transition-all",
          selected ? "border-primary bg-primary" : "border-public-border bg-white"
        )}
      >
        {selected && <Check size={13} className="text-white" strokeWidth={3} />}
      </div>
    </button>
  );
}
