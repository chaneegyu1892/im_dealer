"use client";

import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectRowProps {
  label: string;
  value: string;
  placeholder: string;
  options: SelectOption[];
  onChange: (v: string) => void;
  disabled?: boolean;
}

export function SelectRow({
  label,
  value,
  placeholder,
  options,
  onChange,
  disabled = false,
}: SelectRowProps) {
  return (
    <div>
      <p className="text-[12px] font-medium text-ink-caption mb-1.5 uppercase tracking-wide">
        {label}
      </p>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={cn(
            "w-full appearance-none bg-white border border-line2 rounded-btn",
            "px-4 py-2.5 text-[14px] pr-9",
            "focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/10",
            "transition-colors duration-150 cursor-pointer",
            "text-ink disabled:text-ink-caption disabled:cursor-not-allowed disabled:bg-neutral",
          )}
        >
          <option value="">{placeholder}</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown
          size={15}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-caption pointer-events-none"
        />
      </div>
    </div>
  );
}

interface OptionButtonProps {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  size?: "md" | "sm";
}

export function OptionButton({ selected, onClick, children, size = "md" }: OptionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-btn font-bold transition-all duration-150 border",
        size === "sm" ? "px-3 py-1.5 text-[12px]" : "px-5 py-2.5 text-[14px]",
        selected
          ? "bg-brand text-white border-brand"
          : "bg-white text-ink-label border-line2 hover:border-brand/30 hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}
