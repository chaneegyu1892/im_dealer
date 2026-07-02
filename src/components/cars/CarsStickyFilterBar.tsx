"use client";

import { SlidersHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { CarsSearchControl, SortMenu, type SortOption } from "@/components/cars/CarsFilterControls";
import type { CategoryFilter } from "@/components/cars/CarsFilterPanel";

interface CarsStickyFilterBarProps {
  brandFilter: string;
  categoryFilter: CategoryFilter;
  activeFilterCount: number;
  currentSortLabel: string;
  searchQuery: string;
  sortBy: SortOption;
  sortOpen: boolean;
  onBrandChange: (brand: string) => void;
  onCategoryChange: (category: CategoryFilter) => void;
  onSearchChange: (value: string) => void;
  onSortChange: (sort: SortOption) => void;
  onSortToggle: () => void;
  onScrollToFilters: () => void;
}

export function CarsStickyFilterBar({
  brandFilter,
  categoryFilter,
  activeFilterCount,
  currentSortLabel,
  searchQuery,
  sortBy,
  sortOpen,
  onBrandChange,
  onCategoryChange,
  onSearchChange,
  onSortChange,
  onSortToggle,
  onScrollToFilters,
}: CarsStickyFilterBarProps) {
  return (
    <div className="fixed left-0 right-0 top-[57px] z-50 bg-surface-glass shadow-float backdrop-blur-xl lg:top-[72px]">
      <div className="page-container py-2.5">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onScrollToFilters}
            className={cn(
              "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-pill border px-3.5 text-[12px] font-extrabold transition-all",
              activeFilterCount > 0
                ? "border-brand bg-brand text-white"
                : "border-transparent bg-surface-soft text-text-strong hover:bg-brand-soft hover:text-brand",
            )}
          >
            <SlidersHorizontal size={13} />
            필터
            {activeFilterCount > 0 && (
              <span className="grid h-4 min-w-4 place-items-center rounded-full bg-white/18 px-1 text-[10px] text-white">
                {activeFilterCount}
              </span>
            )}
          </button>
          {brandFilter !== "전체" && (
            <button
              type="button"
              onClick={() => onBrandChange("전체")}
              className="inline-flex h-10 shrink-0 items-center gap-1 rounded-pill bg-brand-soft px-3 text-[12px] font-extrabold text-brand"
            >
              {brandFilter}
              <X size={11} />
            </button>
          )}
          {categoryFilter !== "전체" && (
            <button
              type="button"
              onClick={() => onCategoryChange("전체")}
              className="inline-flex h-10 shrink-0 items-center gap-1 rounded-pill bg-brand-soft px-3 text-[12px] font-extrabold text-brand"
            >
              {categoryFilter}
              <X size={11} />
            </button>
          )}
          <CarsSearchControl compact searchQuery={searchQuery} onSearchChange={onSearchChange} />
          <SortMenu
            currentSortLabel={currentSortLabel}
            sortBy={sortBy}
            sortOpen={sortOpen}
            onToggle={onSortToggle}
            onChange={onSortChange}
          />
        </div>
      </div>
    </div>
  );
}
