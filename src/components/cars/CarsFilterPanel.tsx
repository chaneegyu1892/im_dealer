"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, LayoutGrid, Truck, X } from "lucide-react";
import { CarsSearchControl, SortMenu, type SortOption } from "@/components/cars/CarsFilterControls";
import { cn } from "@/lib/utils";

export const VEHICLE_CATEGORIES = ["전체", "세단", "SUV", "밴", "트럭"] as const;

export type CategoryFilter = (typeof VEHICLE_CATEGORIES)[number];

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

function CategoryIcon({ category }: { category: CategoryFilter }) {
  if (category === "전체") return <LayoutGrid size={16} strokeWidth={1.9} />;
  if (category === "트럭") return <Truck size={16} strokeWidth={1.9} />;

  return (
    <svg viewBox="0 0 32 14" className="h-[11px] w-[22px]" fill="currentColor">
      {category === "밴" ? (
        <>
          <rect x="1" y="3" width="19" height="9" rx="1.5" />
          <rect x="20" y="5.5" width="11" height="6.5" rx="1" />
        </>
      ) : (
        <>
          <path d="M2 9.5h28V11a.8.8 0 0 1-.8.8H2.8A.8.8 0 0 1 2 11V9.5z" />
          <path
            d={
              category === "SUV"
                ? "M3 9.5 4.5 3.5C5 2.6 6 2 7 2h18c1 0 2 .6 2.5 1.5L29 9.5"
                : "M3.5 10 6.5 5c.4-.8 1.3-1.4 2.1-1.4H23.4c.8 0 1.7.6 2.1 1.4L28.5 10"
            }
          />
        </>
      )}
      <circle cx="9.5" cy="12.5" r="1.8" />
      <circle cx="22.5" cy="12.5" r="1.8" />
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
    <div className="rounded-[28px] bg-surface p-4 shadow-float ring-1 ring-border-subtle/80 sm:p-5 lg:p-6">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[14px] font-extrabold text-text-strong">빠른 탐색</p>
          <p className="mt-0.5 text-[13px] font-semibold text-text-muted">
            총 {totalCount.toLocaleString("ko-KR")}개 모델
          </p>
        </div>
        {activeFilterCount > 0 && (
          <button
            type="button"
            onClick={onResetFilters}
            className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-pill bg-surface-soft px-3 text-[12px] font-extrabold text-text-body transition-colors hover:text-brand"
          >
            <X size={12} />
            초기화
          </button>
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
              className="absolute left-0 right-0 top-[calc(100%+8px)] z-30 overflow-hidden rounded-[20px] border border-border-subtle bg-surface shadow-float"
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
                  "inline-flex h-12 min-w-[88px] shrink-0 items-center justify-center gap-2 rounded-pill border px-4 text-[14px] font-extrabold transition-all duration-state",
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

      <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_minmax(320px,0.72fr)] lg:items-center">
        <div className="hidden lg:block" />
        <div className="flex items-center gap-2">
          <CarsSearchControl searchQuery={searchQuery} onSearchChange={onSearchChange} />
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
