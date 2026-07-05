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
        "flex w-full items-center gap-3 rounded-[16px] p-4 text-left transition-all duration-200 active:scale-[0.99]",
        selected
          ? "bg-brand-soft ring-[1.5px] ring-brand"
          : "bg-[#F8FAFC] ring-[1.5px] ring-transparent hover:ring-[#E5E8EB]"
      )}
    >
      {icon && (
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-[15px] font-bold transition-colors",
            selected ? "bg-brand text-white" : "bg-white text-text-body"
          )}
        >
          {icon}
        </span>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "text-[15px] font-extrabold",
              selected ? "text-brand" : "text-text-strong"
            )}
          >
            {label}
          </span>
          {recommended && !selected && (
            <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-bold text-brand">
              추천
            </span>
          )}
        </div>
        {desc && (
          <p
            className={cn(
              "mt-0.5 text-[12.5px]",
              selected ? "text-brand/70" : "text-text-muted"
            )}
          >
            {desc}
          </p>
        )}
        {detail && <p className="mt-1 text-[11px] text-text-muted">{detail}</p>}
      </div>

      <span
        className={cn(
          "flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-[1.5px] transition-colors",
          selected ? "border-brand bg-brand" : "border-[#D7DCE2] bg-transparent"
        )}
      >
        {selected && <Check size={13} className="text-white" strokeWidth={3} />}
      </span>
    </button>
  );
}
