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
            "w-full appearance-none bg-white border border-neutral-800 rounded-btn",
            "px-4 py-2.5 text-[14px] pr-9",
            "focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10",
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
        "rounded-btn font-medium transition-all duration-150 border",
        size === "sm" ? "px-3 py-1.5 text-[12px]" : "px-5 py-2.5 text-[14px]",
        selected
          ? "bg-primary text-white border-primary"
          : "bg-white text-ink-label border-neutral-800 hover:border-secondary-400 hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}
