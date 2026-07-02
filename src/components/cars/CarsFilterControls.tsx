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

interface SortMenuProps {
  currentSortLabel: string;
  sortBy: SortOption;
  sortOpen: boolean;
  onToggle: () => void;
  onChange: (sort: SortOption) => void;
}

export function SortMenu({
  currentSortLabel,
  sortBy,
  sortOpen,
  onToggle,
  onChange,
}: SortMenuProps) {
  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onToggle();
        }}
        className="inline-flex h-12 min-w-[112px] items-center justify-center gap-1.5 rounded-pill bg-surface-soft px-4 text-[14px] font-extrabold text-text-strong transition-colors hover:bg-brand-soft hover:text-brand focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/25"
      >
        {currentSortLabel}
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
            className="absolute right-0 top-full z-50 mt-2 w-40 overflow-hidden rounded-[18px] border border-border-subtle bg-surface shadow-lift"
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
        "flex min-w-[180px] flex-1 items-center gap-2 rounded-pill bg-surface-soft transition-colors focus-within:bg-surface focus-within:ring-4 focus-within:ring-focus-ring/20",
            compact ? "h-10 px-3" : "h-12 px-4",
      )}
    >
      <Search size={compact ? 13 : 16} className="shrink-0 text-text-muted" />
      <input
        type="text"
        autoComplete="off"
        suppressHydrationWarning
        value={searchQuery}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder={compact ? "검색" : "차량, 브랜드, 용도 검색"}
        className="min-w-0 flex-1 bg-transparent text-[15px] font-semibold text-text-strong outline-none placeholder:text-text-muted placeholder:font-semibold"
      />
      {searchQuery && (
        <button
          type="button"
          onClick={() => onSearchChange("")}
          aria-label="검색어 지우기"
          className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-text-muted transition-colors hover:bg-brand-soft hover:text-brand"
        >
          <X size={13} />
        </button>
      )}
    </div>
  );
}
