"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, LayoutGrid, Leaf, X, Zap } from "lucide-react";
import { CarsSearchControl, SortMenu, type SortOption } from "@/components/cars/CarsFilterControls";
import {
  VEHICLE_CATEGORIES,
  type CategoryFilter,
} from "@/lib/vehicle-quick-filters";
import { cn } from "@/lib/utils";

export { VEHICLE_CATEGORIES, type CategoryFilter };

const BRAND_LOGO_MAP: Record<string, string> = {
  현대: "/images/vehicles/logos/hyundai.svg",
  기아: "/images/vehicles/logos/kia.svg",
  제네시스: "/images/vehicles/logos/genesis.svg",
  BMW: "/images/vehicles/logos/bmw.svg",
  쉐보레: "/images/vehicles/logos/chevrolet.svg",
  KGM: "/images/vehicles/logos/kgm.svg",
  벤츠: "/images/vehicles/logos/mercedes.svg",
  "Mercedes-Benz": "/images/vehicles/logos/mercedes.svg",
  르노: "/images/vehicles/logos/renault.svg",
  테슬라: "/images/vehicles/logos/tesla.svg",
};

/** 참고 UI: 승용 · RV · 승합 · 화물 · EV · HEV 실루엣 */
function CategoryIcon({ category }: { category: CategoryFilter }) {
  if (category === "전체") return <LayoutGrid size={16} strokeWidth={1.9} />;
  if (category === "EV") return <Zap size={15} strokeWidth={2.3} className="text-emerald-500" />;
  if (category === "HEV") {
    return <Leaf size={15} strokeWidth={2.2} className="text-emerald-600" />;
  }

  // 화물: 캡 + 적재함
  if (category === "화물") {
    return (
      <svg viewBox="0 0 36 16" className="h-[12px] w-[24px]" fill="currentColor" aria-hidden>
        <path d="M2.5 5.2h10.2c.5 0 1 .3 1.2.8L15.5 10H32c.7 0 1.3.6 1.3 1.3v1.1H2.2V6a.8.8 0 0 1 .8-.8z" />
        <rect x="16.5" y="4" width="15.5" height="6.5" rx="1.2" opacity="0.95" />
        <rect x="4" y="6.2" width="5.5" height="2.6" rx="0.5" opacity="0.25" />
        <circle cx="9" cy="13.3" r="1.85" />
        <circle cx="26.5" cy="13.3" r="1.85" />
      </svg>
    );
  }

  // 승합: 박스형 원박스 밴
  if (category === "승합") {
    return (
      <svg viewBox="0 0 36 16" className="h-[12px] w-[24px]" fill="currentColor" aria-hidden>
        <path d="M3 4h22.5c.6 0 1.1.3 1.4.8L30 10.2h2.2c.7 0 1.3.5 1.3 1.2v1H2.5V4.9A.9.9 0 0 1 3.4 4H3z" />
        <rect x="5" y="5.4" width="6" height="3.2" rx="0.5" opacity="0.22" />
        <rect x="12.5" y="5.4" width="8" height="3.2" rx="0.5" opacity="0.22" />
        <circle cx="10" cy="13.3" r="1.85" />
        <circle cx="26" cy="13.3" r="1.85" />
      </svg>
    );
  }

  // RV: 높은 차고 SUV
  if (category === "RV") {
    return (
      <svg viewBox="0 0 36 16" className="h-[12px] w-[24px]" fill="currentColor" aria-hidden>
        <path d="M3 10.2 5.2 4.6C5.6 3.6 6.6 3 7.7 3h18.5c1.1 0 2.1.7 2.5 1.7L31.5 10.2H3z" />
        <path d="M2.2 10.2h31.6v1.6c0 .5-.4.9-.9.9H3.1a.9.9 0 0 1-.9-.9v-1.6z" />
        <path d="M8 4.2h8.5v4.2H8z" opacity="0.22" />
        <path d="M18 4.2h7.2v4.2H18z" opacity="0.22" />
        <circle cx="10" cy="13.5" r="2" />
        <circle cx="26.5" cy="13.5" r="2" />
      </svg>
    );
  }

  // 승용: 세단 실루엣
  return (
    <svg viewBox="0 0 36 16" className="h-[12px] w-[24px]" fill="currentColor" aria-hidden>
      <path d="M3.2 10.4 6.4 5.6C6.9 4.8 7.8 4.3 8.8 4.3h12.2c.9 0 1.7.4 2.2 1.1l2.4 3.2H30c1.1 0 2 .8 2 1.8v0H3.2z" />
      <path d="M2.4 10.4h31.2v1.5c0 .45-.36.8-.8.8H3.2a.8.8 0 0 1-.8-.8v-1.5z" />
      <path d="M9 5.1h10.5l1.6 3.5H7.8L9 5.1z" opacity="0.22" />
      <path d="M24.2 8.2 25.6 6.4h3.2l1.1 1.8H24.2z" opacity="0.22" />
      <circle cx="10.5" cy="13.4" r="1.85" />
      <circle cx="26.5" cy="13.4" r="1.85" />
    </svg>
  );
}

function BrandMark({ brand, active = false }: { brand: string; active?: boolean }) {
  const logoSrc = BRAND_LOGO_MAP[brand];

  if (brand === "전체") {
    return (
      <span
        className={cn(
          "inline-flex h-8 w-8 items-center justify-center rounded-full",
          active ? "bg-white/15 text-white" : "bg-brand-soft text-brand",
        )}
      >
        <LayoutGrid size={15} strokeWidth={1.9} />
      </span>
    );
  }

  if (!logoSrc) {
    return (
      <span
        className={cn(
          "inline-flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-extrabold",
          active ? "bg-white/15 text-white" : "bg-surface-soft text-brand",
        )}
      >
        {brand.slice(0, 1)}
      </span>
    );
  }

  return (
    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-[inset_0_0_0_1px_rgba(20,24,38,0.08)]">
      <Image
        src={logoSrc}
        alt=""
        width={22}
        height={22}
        className="max-h-[18px] max-w-[22px] object-contain"
      />
    </span>
  );
}

interface CarsFilterPanelProps {
  brands: string[];
  categoryFilter: CategoryFilter;
  brandFilter: string;
  sortBy: SortOption;
  searchQuery: string;
  sortOpen: boolean;
  activeFilterCount: number;
  currentSortLabel: string;
  totalCount: number;
  onCategoryChange: (category: CategoryFilter) => void;
  onBrandChange: (brand: string) => void;
  onSortChange: (sort: SortOption) => void;
  onSortToggle: () => void;
  onSearchChange: (value: string) => void;
  onResetFilters: () => void;
}

export function CarsFilterPanel({
  brands,
  categoryFilter,
  brandFilter,
  sortBy,
  searchQuery,
  sortOpen,
  activeFilterCount,
  currentSortLabel,
  totalCount,
  onCategoryChange,
  onBrandChange,
  onSortChange,
  onSortToggle,
  onSearchChange,
  onResetFilters,
}: CarsFilterPanelProps) {
  const [brandOpen, setBrandOpen] = useState(false);
  const brandMenuRef = useRef<HTMLDivElement>(null);
  const brandOptions = useMemo(() => ["전체", ...brands], [brands]);

  useEffect(() => {
    if (!brandOpen) return;

    const closeBrandMenu = (event: MouseEvent) => {
      if (!brandMenuRef.current?.contains(event.target as Node)) {
        setBrandOpen(false);
      }
    };

    document.addEventListener("click", closeBrandMenu);
    return () => document.removeEventListener("click", closeBrandMenu);
  }, [brandOpen]);

  const selectBrand = (brand: string) => {
    onBrandChange(brand);
    setBrandOpen(false);
  };

  return (
    <div className="rounded-[28px] bg-surface p-4 shadow-float ring-1 ring-border-subtle/80 max-[340px]:rounded-[24px] max-[340px]:p-3 sm:p-5 lg:p-6">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[14px] font-extrabold text-text-strong">빠른 탐색</p>
          <p className="mt-0.5 text-[13px] font-semibold text-text-muted">
            총 {totalCount.toLocaleString("ko-KR")}개 모델
          </p>
        </div>
        {activeFilterCount > 0 && (
          <div className="flex min-w-0 flex-wrap items-center justify-end gap-1.5">
            {brandFilter !== "전체" && (
              <button
                type="button"
                onClick={() => onBrandChange("전체")}
                className="inline-flex min-h-9 items-center gap-1 rounded-pill bg-brand-soft px-3 text-[12px] font-extrabold text-brand"
              >
                {brandFilter}
                <X size={12} />
              </button>
            )}
            {categoryFilter !== "전체" && (
              <button
                type="button"
                onClick={() => onCategoryChange("전체")}
                className="inline-flex min-h-9 items-center gap-1 rounded-pill bg-brand-soft px-3 text-[12px] font-extrabold text-brand"
              >
                {categoryFilter}
                <X size={12} />
              </button>
            )}
            <button
              type="button"
              onClick={onResetFilters}
              className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-pill bg-surface-soft px-3 text-[12px] font-extrabold text-text-body transition-colors hover:text-brand"
            >
              <X size={12} />
              초기화
            </button>
          </div>
        )}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(260px,0.45fr)_1fr] lg:items-start">
        <div ref={brandMenuRef} className="relative">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setBrandOpen((value) => !value);
            }}
            className={cn(
              "flex h-16 w-full items-center justify-between gap-3 rounded-[20px] border px-4 text-left transition-all duration-state",
              brandOpen || brandFilter !== "전체"
                ? "border-brand/35 bg-brand-soft shadow-[0_0_0_3px_rgb(var(--color-brand-primary-rgb)/0.08)]"
                : "border-border-subtle bg-surface-soft hover:border-brand/25 hover:bg-brand-soft/70",
            )}
            aria-expanded={brandOpen}
            aria-haspopup="listbox"
          >
            <span className="flex min-w-0 items-center gap-3">
              <BrandMark brand={brandFilter} />
              <span className="min-w-0">
                <span className="block text-[12px] font-extrabold text-text-muted">브랜드</span>
                <span className="block truncate text-[15.5px] font-extrabold text-text-strong">
                  {brandFilter === "전체" ? "전체 브랜드" : brandFilter}
                </span>
              </span>
            </span>
            <ChevronDown
              size={16}
              strokeWidth={2.2}
              className={cn("shrink-0 text-text-muted transition-transform", brandOpen && "rotate-180 text-brand")}
            />
          </button>

          {brandOpen && (
            <div
              className="absolute left-0 right-0 top-[calc(100%+8px)] z-30 overflow-hidden rounded-[20px] border border-border-subtle bg-surface shadow-float max-[430px]:bottom-[calc(100%+8px)] max-[430px]:top-auto"
              role="listbox"
            >
              <div className="max-h-[286px] overflow-y-auto p-2">
                {brandOptions.map((brand) => {
                  const isActive = brandFilter === brand;

                  return (
                    <button
                      key={brand}
                      type="button"
                      onClick={() => selectBrand(brand)}
                      className={cn(
                        "flex h-12 w-full items-center gap-3 rounded-[14px] px-2.5 text-left transition-colors",
                        isActive
                          ? "bg-brand text-white"
                          : "text-text-body hover:bg-surface-soft hover:text-brand",
                      )}
                      role="option"
                      aria-selected={isActive}
                    >
                      <BrandMark brand={brand} active={isActive} />
                      <span className="min-w-0 flex-1 truncate text-[13.5px] font-extrabold">
                        {brand === "전체" ? "전체 브랜드" : brand}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="-mx-1.5 flex gap-2 overflow-x-auto px-1.5 py-0.5 scrollbar-hide">
          {VEHICLE_CATEGORIES.map((category) => {
            const isActive = categoryFilter === category;
            return (
              <button
                key={category}
                type="button"
                onClick={() => onCategoryChange(category)}
                className={cn(
                  "inline-flex h-12 min-w-[76px] shrink-0 items-center justify-center gap-1.5 rounded-pill border px-3 text-[13px] font-extrabold transition-all duration-state sm:min-w-[88px] sm:gap-2 sm:px-4 sm:text-[14px]",
                  isActive
                    ? "border-transparent bg-brand text-white"
                    : "border-transparent bg-surface-soft text-text-body hover:border-brand/15 hover:bg-brand-soft hover:text-brand",
                )}
              >
                <span className={isActive ? "text-white/85" : "text-text-muted"}>
                  <CategoryIcon category={category} />
                </span>
                {category}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4 grid min-w-0 gap-3 lg:grid-cols-[1fr_minmax(320px,0.72fr)] lg:items-center">
        <div className="hidden lg:block" />
        <div className="flex min-w-0 items-center gap-2 max-[340px]:flex-col max-[340px]:items-stretch">
          <CarsSearchControl searchQuery={searchQuery} onSearchChange={onSearchChange} />
          <SortMenu
            currentSortLabel={currentSortLabel}
            sortBy={sortBy}
            sortOpen={sortOpen}
            onToggle={onSortToggle}
            onChange={onSortChange}
            fullWidthOnNarrow
          />
        </div>
      </div>
    </div>
  );
}
