"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type SortOption = "popular" | "price-asc" | "price-desc";

export const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "popular", label: "인기순" },
  { value: "price-asc", label: "가격 낮은순" },
  { value: "price-desc", label: "가격 높은순" },
];

const MOBILE_SORT_LABELS: Record<SortOption, string> = {
  popular: "인기순",
  "price-asc": "낮은가격",
  "price-desc": "높은가격",
};

interface SortMenuProps {
  currentSortLabel: string;
  sortBy: SortOption;
  sortOpen: boolean;
  onToggle: () => void;
  onChange: (sort: SortOption) => void;
  compact?: boolean;
  fullWidthOnNarrow?: boolean;
}

export function SortMenu({
  currentSortLabel,
  sortBy,
  sortOpen,
  onToggle,
  onChange,
  compact = false,
  fullWidthOnNarrow = false,
}: SortMenuProps) {
  return (
    <div className={cn("relative shrink-0", fullWidthOnNarrow && "max-[340px]:w-full")}>
      <button
        type="button"
        aria-label={currentSortLabel}
        onClick={(event) => {
          event.stopPropagation();
          onToggle();
        }}
        className={cn(
          "inline-flex items-center justify-center gap-1.5 rounded-pill bg-surface-soft font-extrabold text-text-strong transition-colors hover:bg-brand-soft hover:text-brand focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/25",
          compact
            ? "h-12 min-w-[112px] px-4 text-[14px] max-[430px]:h-11 max-[430px]:w-[88px] max-[430px]:min-w-[88px] max-[430px]:px-2 max-[430px]:text-[12px]"
            : "h-12 min-w-[112px] px-4 text-[14px] max-[430px]:w-[96px] max-[430px]:min-w-[96px] max-[430px]:px-3 max-[430px]:text-[12px]",
          fullWidthOnNarrow && "max-[340px]:w-full max-[340px]:min-w-0",
        )}
      >
        <span aria-hidden="true" className="max-[430px]:hidden">
          {currentSortLabel}
        </span>
        <span aria-hidden="true" className="hidden max-[430px]:inline">
          {MOBILE_SORT_LABELS[sortBy]}
        </span>
        <ChevronDown
          size={13}
          className={cn("text-text-muted transition-transform duration-200", sortOpen && "rotate-180")}
        />
      </button>
      <AnimatePresence>
        {sortOpen && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className={cn(
              "absolute right-0 top-full z-50 mt-2 w-40 overflow-hidden rounded-[18px] border border-border-subtle bg-surface shadow-lift",
              fullWidthOnNarrow &&
                "max-[430px]:bottom-full max-[430px]:top-auto max-[430px]:mb-2 max-[430px]:mt-0 max-[340px]:w-full",
            )}
            onClick={(event) => event.stopPropagation()}
          >
            {SORT_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => onChange(option.value)}
                className={cn(
                  "w-full px-4 py-3 text-left text-[13px] transition-colors",
                  sortBy === option.value
                    ? "bg-brand-soft text-brand font-extrabold"
                    : "text-text-strong hover:bg-surface-soft",
                )}
              >
                {option.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface CarsSearchControlProps {
  compact?: boolean;
  searchQuery: string;
  onSearchChange: (value: string) => void;
}

export function CarsSearchControl({
  compact = false,
  searchQuery,
  onSearchChange,
}: CarsSearchControlProps) {
  return (
    <div
      className={cn(
        "flex min-h-11 flex-1 items-center gap-2 rounded-pill bg-surface-soft transition-colors focus-within:bg-surface focus-within:ring-4 focus-within:ring-focus-ring/20",
        compact
          ? "h-11 min-w-[180px] px-3 max-[430px]:min-w-0"
          : "h-12 min-w-[180px] px-4 max-[430px]:min-w-0 max-[340px]:w-full max-[340px]:flex-none",
      )}
    >
      <Search size={compact ? 13 : 16} className="shrink-0 text-text-muted" />
      <input
        type="text"
        autoComplete="off"
        suppressHydrationWarning
        value={searchQuery}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder={compact ? "검색" : "차량·브랜드·용도"}
        className="min-h-11 min-w-0 flex-1 self-stretch bg-transparent text-[16px] font-semibold text-text-strong outline-none placeholder:text-text-muted placeholder:font-semibold"
      />
      {searchQuery && (
        <button
          type="button"
          onClick={() => onSearchChange("")}
          aria-label="검색어 지우기"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-text-muted transition-colors hover:bg-brand-soft hover:text-brand"
        >
          <X size={13} />
        </button>
      )}
    </div>
  );
}
