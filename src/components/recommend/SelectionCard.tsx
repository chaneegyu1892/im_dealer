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
      className={cn("tile active:scale-[0.99]", selected && "tile-on")}
    >
      {icon && <span className="ic text-[20px] leading-none">{icon}</span>}

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn("nm", selected && "text-brand")}>{label}</span>
          {recommended && !selected && (
            <span className="rounded-pill bg-brand-soft px-2 py-0.5 text-[10px] font-bold text-brand">
              추천
            </span>
          )}
        </div>
        {desc && (
          <p className={cn("ds mt-0.5", selected && "text-brand/70")}>{desc}</p>
        )}
        {detail && <p className="mt-1 text-[11px] text-g2">{detail}</p>}
      </div>

      <span
        className={cn(
          "flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border transition-colors",
          selected ? "border-brand bg-brand" : "border-line2 bg-white"
        )}
      >
        {selected && <Check size={13} className="text-white" strokeWidth={3} />}
      </span>
    </button>
  );
}
