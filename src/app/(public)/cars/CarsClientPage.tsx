"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight, Sparkles, Search, LayoutGrid, Truck, X,
  ChevronDown, SlidersHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CarCard } from "@/components/cars/CarCard";
import type { VehicleListItem } from "@/types/api";
import { BRAND_PRIORITY_ORDER, compareBrandNames } from "@/lib/brand-sort";

// ── 상수 ──────────────────────────────────────────────────
const VEHICLE_CATEGORIES = ["전체", "세단", "SUV", "밴", "트럭"] as const;
type CategoryFilter = (typeof VEHICLE_CATEGORIES)[number];
type BrandFilter = string;

const SORT_OPTIONS = [
  { value: "popular", label: "인기순" },
  { value: "price-asc", label: "가격 낮은순" },
  { value: "price-desc", label: "가격 높은순" },
] as const;
type SortOption = (typeof SORT_OPTIONS)[number]["value"];

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

// 어드민/공개 페이지 전반에 일관된 브랜드 우선순위 (현대/기아/제네시스/BMW/벤츠)는
// src/lib/brand-sort.ts 의 BRAND_PRIORITY_ORDER 를 사용한다.
const PRIORITY_BRANDS: readonly string[] = BRAND_PRIORITY_ORDER;
const CATEGORY_ROWS: CategoryFilter[][] = [["전체", "세단", "SUV"], ["밴", "트럭"]];

// ── 차종 아이콘 ────────────────────────────────────────────
function CategoryIcon({ category }: { category: string }) {
  if (category === "전체") return <LayoutGrid size={16} strokeWidth={1.8} />;
  if (category === "세단") {
    return (
      <svg viewBox="0 0 32 14" className="w-[22px] h-[11px]" fill="currentColor">
        <path d="M2 10h28v1.5a.8.8 0 0 1-.8.8H2.8a.8.8 0 0 1-.8-.8V10z" />
        <path d="M3.5 10 6.5 5c.4-.8 1.3-1.4 2.1-1.4H23.4c.8 0 1.7.6 2.1 1.4L28.5 10" />
        <circle cx="9.5" cy="12.5" r="1.8" />
        <circle cx="22.5" cy="12.5" r="1.8" />
      </svg>
    );
  }
  if (category === "SUV") {
    return (
      <svg viewBox="0 0 32 14" className="w-[22px] h-[11px]" fill="currentColor">
        <path d="M2 9.5h28V11a.8.8 0 0 1-.8.8H2.8A.8.8 0 0 1 2 11V9.5z" />
        <path d="M3 9.5 4.5 3.5C5 2.6 6 2 7 2h18c1 0 2 .6 2.5 1.5L29 9.5" />
        <circle cx="9.5" cy="12" r="1.8" />
        <circle cx="22.5" cy="12" r="1.8" />
      </svg>
    );
  }
  if (category === "밴") {
    return (
      <svg viewBox="0 0 32 14" className="w-[22px] h-[11px]" fill="currentColor">
        <rect x="1" y="3" width="19" height="9" rx="1.5" />
        <rect x="20" y="5.5" width="11" height="6.5" rx="1" />
        <circle cx="7" cy="13" r="1.8" />
        <circle cx="25" cy="13" r="1.8" />
      </svg>
    );
  }
  if (category === "트럭") return <Truck size={16} strokeWidth={1.8} />;
  return null;
}

// ── 피처드 카드 ────────────────────────────────────────────
function FeaturedCard({
  vehicle,
  size = "large",
}: {
  vehicle: VehicleListItem;
  size?: "large" | "small";
}) {
  const formattedMonthly =
    vehicle.monthlyFrom > 0 ? Math.round(vehicle.monthlyFrom / 10000) : null;
  const specs = vehicle.defaultTrim?.specs ?? {};

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="group relative overflow-hidden rounded-card cursor-pointer h-full bg-neutral-900"
    >
      <Link href={`/cars/${vehicle.slug}`} className="block h-full">
        {vehicle.thumbnailUrl && (
          <div
            className="absolute inset-0 bg-cover bg-center scale-105 group-hover:scale-110 transition-transform duration-700"
            style={{ backgroundImage: `url(${vehicle.thumbnailUrl})` }}
          />
        )}
        <div className="absolute inset-0 bg-black/55" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        <div
          className={cn(
            "relative z-10 flex flex-col justify-between h-full",
            size === "large"
              ? "p-5 md:p-10 min-h-[220px] md:min-h-[340px]"
              : "p-5 md:p-8 min-h-[220px] md:min-h-[340px]",
          )}
        >
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[11px] font-semibold bg-white/15 text-white/90 px-2.5 py-1 rounded-[4px] border border-white/20 uppercase tracking-wider">
                {vehicle.brand}
              </span>
              {vehicle.isPopular && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-white/20 text-white px-2.5 py-1 rounded-[4px]">
                  <Sparkles size={9} />
                  인기
                </span>
              )}
              {vehicle.hasAvailableInventory && (
                <span className="text-[11px] font-semibold bg-primary text-white px-2.5 py-1 rounded-[4px]">
                  즉시출고
                </span>
              )}
            </div>
            <h2
              className={cn(
                "font-display font-light text-white leading-tight mb-2 tracking-tight",
                size === "large"
                  ? "text-[22px] md:text-[40px]"
                  : "text-[20px] md:text-[32px]",
              )}
            >
              {vehicle.name}
            </h2>
            <p className="text-white/50 text-[13px] leading-relaxed max-w-sm line-clamp-2 md:line-clamp-none">
              {vehicle.description}
            </p>
          </div>
          <div>
            {size === "large" && Object.entries(specs).length > 0 && (
              <div className="hidden md:flex gap-5 mb-6">
                {Object.entries(specs)
                  .slice(0, 3)
                  .map(([label, value]) => (
                    <div key={label}>
                      <div className="text-[10px] text-white/35 mb-0.5">{label}</div>
                      <div className="text-[13px] font-medium text-white/85">{value}</div>
                    </div>
                  ))}
              </div>
            )}
            <div>
              <span className="text-[10px] text-white/35 block mb-1">
                월 납입금 (48개월·표준형)
              </span>
              <div className="flex items-baseline gap-1">
                {formattedMonthly ? (
                  <>
                    <span className="font-display text-[28px] md:text-[34px] font-semibold text-white leading-none">
                      {formattedMonthly}
                    </span>
                    <span className="text-[13px] text-white/60 font-medium">만원~</span>
                  </>
                ) : (
                  <span className="text-[14px] text-white/60">견적 준비중</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </Link>
      <Link
        href={`/quote?vehicle=${vehicle.slug}`}
        className={cn(
          "absolute z-20 flex items-center gap-1.5 bg-white text-primary text-[12px] md:text-[13px] font-semibold",
          "px-4 md:px-5 py-2 md:py-2.5 rounded-btn transition-all duration-200 group-hover:gap-2.5 group-hover:shadow-lg",
          size === "large"
            ? "bottom-5 right-5 md:bottom-10 md:right-10"
            : "bottom-5 right-5 md:bottom-8 md:right-8",
        )}
      >
        견적 보기
        <ArrowRight size={13} strokeWidth={2.5} />
      </Link>
    </motion.div>
  );
}

// ── 메인 페이지 ────────────────────────────────────────────
export function CarsClientPage({ vehicles }: { vehicles: VehicleListItem[] }) {
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("전체");
  const [brandFilter, setBrandFilter] = useState<BrandFilter>("전체");
  const [sortBy, setSortBy] = useState<SortOption>("popular");
  const [searchQuery, setSearchQuery] = useState("");
  const [showStickyBar, setShowStickyBar] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);

  const filterPanelRef = useRef<HTMLDivElement>(null);

  // 필터 패널이 뷰포트 위로 사라지면 컴팩트 sticky 바 표시
  useEffect(() => {
    const el = filterPanelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setShowStickyBar(!entry.isIntersecting),
      { threshold: 0, rootMargin: `-72px 0px 0px 0px` },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // 정렬 드롭다운 외부 클릭 닫기
  useEffect(() => {
    if (!sortOpen) return;
    const handler = () => setSortOpen(false);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [sortOpen]);

  const scrollToFilters = useCallback(() => {
    filterPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  // 어드민/공개 일관 정렬: 현대/기아/제네시스/BMW/벤츠 우선 + 가나다순
  const brands = useMemo(() => {
    return Array.from(new Set(vehicles.map((v) => v.brand))).sort(compareBrandNames);
  }, [vehicles]);

  const featured = useMemo(
    () => vehicles.filter((v) => v.isPopular).slice(0, 2),
    [vehicles],
  );

  const filteredVehicles = useMemo(() => {
    const featuredIds = new Set(featured.map((v) => v.id));
    const query = searchQuery.trim().toLowerCase();
    const matchesQuery = (v: VehicleListItem) =>
      [v.name, v.brand, v.category, v.description ?? "", ...v.highlights, ...v.tags]
        .map((f) => f.toLowerCase())
        .some((f) => f.includes(query));

    let result = query
      ? vehicles.filter(matchesQuery)
      : vehicles.filter((v) => !featuredIds.has(v.id));
    if (!query && categoryFilter !== "전체")
      result = result.filter((v) => v.category === categoryFilter);
    if (!query && brandFilter !== "전체")
      result = result.filter((v) => v.brand === brandFilter);

    switch (sortBy) {
      case "price-asc":
        return [...result].sort((a, b) => a.monthlyFrom - b.monthlyFrom);
      case "price-desc":
        return [...result].sort((a, b) => b.monthlyFrom - a.monthlyFrom);
      default:
        return [...result].sort((a, b) => {
          const diff =
            (PRIORITY_BRANDS.includes(a.brand) ? 0 : 1) -
            (PRIORITY_BRANDS.includes(b.brand) ? 0 : 1);
          return diff !== 0 ? diff : a.displayOrder - b.displayOrder;
        });
    }
  }, [vehicles, categoryFilter, brandFilter, sortBy, featured, searchQuery]);

  const suggestedVehicles = useMemo(() => {
    if (!searchQuery.trim() || filteredVehicles.length === 0) return [];
    const filteredIds = new Set(filteredVehicles.map((v) => v.id));
    const categories = new Set(filteredVehicles.map((v) => v.category));
    return vehicles
      .filter((v) => !filteredIds.has(v.id) && categories.has(v.category))
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .slice(0, 4);
  }, [searchQuery, filteredVehicles, vehicles]);

  const totalCount = vehicles.length;
  const hasActiveFilters = categoryFilter !== "전체" || brandFilter !== "전체";
  const activeFilterCount =
    (categoryFilter !== "전체" ? 1 : 0) + (brandFilter !== "전체" ? 1 : 0);
  const resetFilters = () => {
    setCategoryFilter("전체");
    setBrandFilter("전체");
  };
  const currentSortLabel =
    SORT_OPTIONS.find((o) => o.value === sortBy)?.label ?? "인기순";

  return (
    <div className="min-h-screen" style={{ background: "#F7F7F8" }}>

      {/* ── 컴팩트 sticky 바 (스크롤 후 등장) ── */}
      <AnimatePresence>
        {showStickyBar && (
          <motion.div
            initial={{ y: -52, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -52, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed top-[72px] left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-b border-[#E0E0E0] shadow-sm"
          >
            <div className="page-container py-2.5">
              <div className="flex items-center gap-2">

                {/* 활성 필터 칩 표시 */}
                {brandFilter !== "전체" && (
                  <span className="flex-shrink-0 flex items-center gap-1 h-8 px-3 rounded-full bg-primary/10 text-primary text-[12px] font-medium border border-primary/20">
                    {brandFilter}
                    <button onClick={() => setBrandFilter("전체")} className="ml-0.5">
                      <X size={10} />
                    </button>
                  </span>
                )}
                {categoryFilter !== "전체" && (
                  <span className="flex-shrink-0 flex items-center gap-1 h-8 px-3 rounded-full bg-primary/10 text-primary text-[12px] font-medium border border-primary/20">
                    {categoryFilter}
                    <button onClick={() => setCategoryFilter("전체")} className="ml-0.5">
                      <X size={10} />
                    </button>
                  </span>
                )}

                {/* 필터 열기 버튼 → 상단 패널로 스크롤 */}
                <button
                  onClick={scrollToFilters}
                  className={cn(
                    "flex-shrink-0 flex items-center gap-1.5 h-8 px-3.5 rounded-full border text-[12px] font-medium transition-all duration-150",
                    activeFilterCount > 0
                      ? "border-primary bg-primary text-white"
                      : "border-[#DEDEDE] bg-white text-[#555] hover:border-[#ABABAB]",
                  )}
                >
                  <SlidersHorizontal size={12} />
                  필터
                  {activeFilterCount > 0 && (
                    <span className="flex items-center justify-center w-4 h-4 rounded-full bg-white text-primary text-[10px] font-bold">
                      {activeFilterCount}
                    </span>
                  )}
                </button>

                <div className="flex-1" />

                {/* 검색 */}
                <div className="flex items-center gap-1.5 h-8 px-3 rounded-full border border-[#DEDEDE] bg-white focus-within:border-primary/50 transition-colors min-w-0">
                  <Search size={11} className="text-[#BBBBBB] flex-shrink-0" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="검색"
                    className="w-16 sm:w-24 text-[12px] text-ink bg-transparent outline-none placeholder:text-[#CCCCCC] min-w-0"
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery("")} className="flex-shrink-0">
                      <X size={10} className="text-[#CCCCCC]" />
                    </button>
                  )}
                </div>

                {/* 정렬 */}
                <div className="relative flex-shrink-0">
                  <button
                    onClick={(e) => { e.stopPropagation(); setSortOpen((v) => !v); }}
                    className="flex items-center gap-1 h-8 px-3 rounded-full border border-[#DEDEDE] bg-white text-[12px] text-[#555] hover:border-[#ABABAB] transition-colors whitespace-nowrap"
                  >
                    {currentSortLabel}
                    <ChevronDown
                      size={11}
                      className={cn("text-[#AAAAAA] transition-transform", sortOpen && "rotate-180")}
                    />
                  </button>
                  <AnimatePresence>
                    {sortOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 4, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 4, scale: 0.97 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 top-full mt-1.5 w-36 bg-white rounded-xl border border-[#E8E8E8] shadow-lg overflow-hidden z-50"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {SORT_OPTIONS.map((opt) => (
                          <button
                            key={opt.value}
                            onClick={() => { setSortBy(opt.value); setSortOpen(false); }}
                            className={cn(
                              "w-full text-left px-4 py-2.5 text-[13px] transition-colors",
                              sortBy === opt.value
                                ? "bg-primary/5 text-primary font-medium"
                                : "text-[#555] hover:bg-[#F7F7F8]",
                            )}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── 페이지 헤더 ── */}
      <div className="bg-white border-b border-[#EBEBEB]">
        <div className="page-container py-7 md:py-10">
          <p className="text-[11px] font-semibold text-ink-caption uppercase tracking-wider mb-2">
            차량 탐색 · 총 {totalCount}개 차종
          </p>
          <h1 className="font-display text-[24px] md:text-headline-sm text-ink leading-tight">
            진짜 견적으로 비교하세요
          </h1>
          <p className="text-[13px] md:text-[14px] text-ink-label mt-2">
            허위 없이, 실제 운영 가능한 조건으로만 안내합니다
          </p>
        </div>
      </div>

      {/* ── 메인 필터 패널 ── */}
      <div ref={filterPanelRef} className="bg-white border-b border-[#E0E0E0]">
        <div className="page-container py-5 md:py-6">

          {/* 브랜드 선택 */}
          <div className="mb-5">
            <p className="text-[10px] font-semibold text-[#BBBBBB] uppercase tracking-wider mb-3">
              브랜드 선택
            </p>

            {/* 모바일: 5열 그리드로 전체 브랜드 노출 / 데스크탑: 한 줄 flex */}
            <div className="grid grid-cols-5 gap-2 md:flex md:flex-wrap md:gap-2.5">

              {/* 전체 버튼 */}
              <button
                onClick={() => setBrandFilter("전체")}
                className={cn(
                  "flex flex-col items-center justify-center gap-1",
                  "w-full h-[64px] md:w-[86px] md:h-[72px] rounded-xl border-2 bg-white",
                  "text-[12px] md:text-[14px] font-semibold transition-all duration-200",
                  brandFilter === "전체"
                    ? "border-primary text-primary shadow-[0_0_0_3px_rgba(0,6,102,0.08)]"
                    : "border-[#E8E8E8] text-[#AAAAAA] hover:border-[#BBBBBB]",
                )}
              >
                <LayoutGrid
                  size={18}
                  strokeWidth={1.5}
                  className={cn("md:w-[22px] md:h-[22px]", brandFilter === "전체" ? "text-primary" : "text-[#CCCCCC]")}
                />
                전체
              </button>

              {/* 브랜드별 타일 */}
              {brands.map((brand) => {
                const logoSrc = BRAND_LOGO_MAP[brand];
                const isActive = brandFilter === brand;
                return (
                  <button
                    key={brand}
                    onClick={() => setBrandFilter(brand)}
                    className={cn(
                      "flex flex-col items-center justify-center gap-1.5",
                      "w-full h-[64px] md:w-[86px] md:h-[72px] rounded-xl border-2 bg-white",
                      "transition-all duration-200",
                      isActive
                        ? "border-primary shadow-[0_0_0_3px_rgba(0,6,102,0.08)]"
                        : "border-[#E8E8E8] hover:border-[#BBBBBB]",
                    )}
                  >
                    {logoSrc ? (
                      <Image
                        src={logoSrc}
                        alt={brand}
                        width={48}
                        height={30}
                        className={cn(
                          "object-contain transition-opacity duration-200",
                          "w-[36px] h-[22px] md:w-[48px] md:h-[30px]",
                          isActive ? "opacity-100" : "opacity-35",
                        )}
                        unoptimized
                      />
                    ) : (
                      <span className="text-[12px] md:text-[13px] font-semibold text-ink leading-none">{brand}</span>
                    )}
                    <span
                      className={cn(
                        "text-[11px] md:text-[13px] leading-none font-medium",
                        isActive ? "text-primary" : "text-[#BBBBBB]",
                      )}
                    >
                      {brand}
                    </span>
                  </button>
                );
              })}

            </div>
          </div>

          {/* 차종 선택 + 검색/정렬 — 모바일 세로, 데스크탑 가로 */}
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:gap-6">

            {/* 차종 필터 1줄 */}
            <div className="flex-1 overflow-hidden">
              <p className="text-[10px] font-semibold text-[#BBBBBB] uppercase tracking-wider mb-2.5">
                차종 선택
              </p>
              <div className="flex gap-2 overflow-x-auto pb-1 md:pb-0 scrollbar-hide">
                {VEHICLE_CATEGORIES.map((cat) => {
                  const isActive = categoryFilter === cat;
                  return (
                    <button
                      key={cat}
                      onClick={() => setCategoryFilter(cat)}
                      className={cn(
                        "flex items-center gap-2 h-10 px-4 md:px-5 rounded-full border shrink-0",
                        "text-[13px] md:text-[14px] font-medium transition-all duration-150 whitespace-nowrap",
                        isActive
                          ? "bg-ink text-white border-ink shadow-sm"
                          : "bg-white text-[#555] border-[#DEDEDE] hover:border-[#ABABAB]",
                      )}
                    >
                      <span className={isActive ? "text-white/80" : "text-[#AAAAAA]"}>
                        <CategoryIcon category={cat} />
                      </span>
                      {cat}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 검색 + 초기화 + 정렬 */}
            <div className="flex items-center gap-2 md:ml-auto">

              {hasActiveFilters && (
                <button
                  onClick={resetFilters}
                  className="flex-shrink-0 flex items-center gap-1 h-9 px-3 rounded-full border border-[#DEDEDE] bg-white text-[12px] text-[#888] hover:border-[#ABABAB] transition-colors"
                >
                  <X size={10} />
                  <span>초기화</span>
                </button>
              )}

              {/* 검색 — 모바일에서 flex-1로 가로 가득 채움 */}
              <div className="flex-1 md:flex-none flex items-center gap-1.5 h-9 px-3.5 rounded-full border border-[#DEDEDE] bg-white focus-within:border-primary/50 transition-colors min-w-0">
                <Search size={12} className="text-[#BBBBBB] flex-shrink-0" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="차량 검색"
                  className="w-full md:w-32 text-[13px] text-ink bg-transparent outline-none placeholder:text-[#CCCCCC] min-w-0"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery("")} className="flex-shrink-0">
                    <X size={11} className="text-[#CCCCCC]" />
                  </button>
                )}
              </div>

              {/* 정렬 */}
              <div className="relative flex-shrink-0">
                <button
                  onClick={(e) => { e.stopPropagation(); setSortOpen((v) => !v); }}
                  className="flex items-center gap-1.5 h-9 px-3.5 md:px-4 rounded-full border border-[#DEDEDE] bg-white text-[12px] md:text-[13px] text-[#555] hover:border-[#ABABAB] transition-colors whitespace-nowrap"
                >
                  {currentSortLabel}
                  <ChevronDown
                    size={12}
                    className={cn(
                      "text-[#AAAAAA] transition-transform duration-200",
                      sortOpen && "rotate-180",
                    )}
                  />
                </button>
                <AnimatePresence>
                  {sortOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 4, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 4, scale: 0.97 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 top-full mt-1.5 w-36 bg-white rounded-xl border border-[#E8E8E8] shadow-lg overflow-hidden z-50"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {SORT_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => { setSortBy(opt.value); setSortOpen(false); }}
                          className={cn(
                            "w-full text-left px-4 py-2.5 text-[13px] transition-colors",
                            sortBy === opt.value
                              ? "bg-primary/5 text-primary font-medium"
                              : "text-[#555] hover:bg-[#F7F7F8]",
                          )}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* ── 컨텐츠 영역 ── */}
      <div className="page-container py-6 md:py-10">

        {/* 피처드 섹션 */}
        {!searchQuery && categoryFilter === "전체" && brandFilter === "전체" && featured.length > 0 && (
          <section className="mb-8 md:mb-10">
            <p className="text-[10px] font-semibold text-ink-caption uppercase tracking-wider mb-4">
              주목할 차량
            </p>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-5">
              {featured[0] && (
                <div className="lg:col-span-2">
                  <FeaturedCard vehicle={featured[0]} size="large" />
                </div>
              )}
              {featured[1] && (
                <div className="lg:col-span-1">
                  <FeaturedCard vehicle={featured[1]} size="small" />
                </div>
              )}
            </div>
          </section>
        )}

        {/* 차량 그리드 */}
        <section>
          <div className="flex items-center justify-between mb-4 md:mb-5">
            <div className="flex items-center gap-2">
              <p className="text-[10px] md:text-[11px] font-semibold text-ink-caption uppercase tracking-wider">
                {hasActiveFilters || searchQuery ? "검색 결과" : "전체 차량"}
              </p>
              <span className="text-[11px] text-ink-caption">{filteredVehicles.length}개</span>
            </div>

            {/* 활성 필터 칩 */}
            {hasActiveFilters && (
              <div className="flex items-center gap-1.5">
                {brandFilter !== "전체" && (
                  <span className="flex items-center gap-1 h-6 px-2.5 rounded-full bg-primary/10 text-primary text-[11px] font-medium">
                    {brandFilter}
                    <button onClick={() => setBrandFilter("전체")}>
                      <X size={9} />
                    </button>
                  </span>
                )}
                {categoryFilter !== "전체" && (
                  <span className="flex items-center gap-1 h-6 px-2.5 rounded-full bg-primary/10 text-primary text-[11px] font-medium">
                    {categoryFilter}
                    <button onClick={() => setCategoryFilter("전체")}>
                      <X size={9} />
                    </button>
                  </span>
                )}
              </div>
            )}
          </div>

          <AnimatePresence mode="wait">
            {filteredVehicles.length > 0 ? (
              <motion.div
                key={`${categoryFilter}-${brandFilter}-${sortBy}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-5"
              >
                {filteredVehicles.map((vehicle, idx) => (
                  <CarCard key={vehicle.id} vehicle={vehicle} index={idx} />
                ))}
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center py-20 text-center"
              >
                <div className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-primary-100 flex items-center justify-center mb-4">
                  <Search size={20} className="text-primary" />
                </div>
                <p className="text-[15px] md:text-[16px] font-display font-medium text-ink mb-1.5">
                  해당 조건의 차량이 없어요
                </p>
                <p className="text-[12px] md:text-[13px] text-ink-label mb-5">
                  조건을 조금 바꿔보면 더 많은 차량을 찾을 수 있어요
                </p>
                <button
                  onClick={resetFilters}
                  className="text-[13px] font-medium text-primary hover:underline"
                >
                  전체 차량 보기
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* 이런 차량은 어떠세요? */}
        {searchQuery && suggestedVehicles.length > 0 && (
          <section className="mt-10 md:mt-12">
            <p className="text-[10px] md:text-[11px] font-semibold text-ink-caption uppercase tracking-wider mb-1">
              이런 차량은 어떠세요?
            </p>
            <p className="text-[13px] text-ink-label mb-5">같은 카테고리의 다른 차량들이에요</p>
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-5">
              {suggestedVehicles.map((vehicle, idx) => (
                <CarCard key={vehicle.id} vehicle={vehicle} index={idx} />
              ))}
            </div>
          </section>
        )}

        {/* AI 추천 배너 */}
        <section
          className="mt-12 md:mt-14 rounded-card overflow-hidden"
          style={{
            background: "linear-gradient(135deg, #000666 0%, #1A1A6E 60%, #3333CC 100%)",
          }}
        >
          <div className="px-5 md:px-12 py-7 md:py-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={13} className="text-white/50" />
                <span className="text-[11px] font-semibold text-white/50 uppercase tracking-wider">
                  AI 추천
                </span>
              </div>
              <h3 className="font-display text-[18px] md:text-[22px] font-light text-white mb-1.5">
                어떤 차가 맞는지 모르겠다면?
              </h3>
              <p className="text-[12px] md:text-[13px] text-white/50">
                업종·예산·성향 4가지 질문으로 최적의 차량을 찾아드려요
              </p>
            </div>
            <Link
              href="/recommend"
              className="w-full md:w-auto shrink-0 inline-flex items-center justify-center gap-2 bg-white text-primary
                         text-[13px] font-semibold px-6 md:px-7 py-3 rounded-btn hover:shadow-lg transition-shadow duration-200"
            >
              AI 추천 시작
              <ArrowRight size={14} strokeWidth={2.5} />
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
