"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight, Search, LayoutGrid, Truck, X,
  ChevronDown, SlidersHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AiBadge } from "@/components/ui/AiBadge";
import { CarCard } from "@/components/cars/CarCard";
import { FeaturedCarsSlider } from "@/components/cars/FeaturedCarsSlider";
import type { VehicleListItem } from "@/types/api";
import { makeBrandComparator, type BrandSignal } from "@/lib/brand-sort";

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

// FeaturedCard 는 @/components/cars/FeaturedCard 로 분리(슬라이더와 공용).

// ── 메인 페이지 ────────────────────────────────────────────
interface CarsClientPageProps {
  vehicles: VehicleListItem[];
  brandSignals: Record<string, BrandSignal>;
}

export function CarsClientPage({ vehicles, brandSignals }: CarsClientPageProps) {
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

  // 어드민/공개 일관 정렬: isFeatured 그룹 우선 → 차량 수 → 가나다 (SSOT)
  const brandComparator = useMemo(
    () => makeBrandComparator(new Map(Object.entries(brandSignals))),
    [brandSignals]
  );
  const brands = useMemo(() => {
    return Array.from(new Set(vehicles.map((v) => v.brand))).sort(brandComparator);
  }, [vehicles, brandComparator]);

  // 주목할 차량(어드민 isSpotlight 지정) — 탐색 페이지 상단 슬라이더. displayOrder 순.
  const featured = useMemo(
    () =>
      vehicles
        .filter((v) => v.isSpotlight)
        .sort((a, b) => a.displayOrder - b.displayOrder),
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

    // 견적 데이터가 없는("견적준비중", monthlyFrom<=0) 차량은 정렬 종류와 무관하게 항상 맨 뒤로.
    const hasQuote = (v: VehicleListItem) => (v.monthlyFrom ?? 0) > 0;
    const quoteLast =
      (secondary: (a: VehicleListItem, b: VehicleListItem) => number) =>
      (a: VehicleListItem, b: VehicleListItem) => {
        const qa = hasQuote(a);
        const qb = hasQuote(b);
        if (qa !== qb) return qa ? -1 : 1;
        return secondary(a, b);
      };

    switch (sortBy) {
      case "price-asc":
        return [...result].sort(quoteLast((a, b) => a.monthlyFrom - b.monthlyFrom));
      case "price-desc":
        return [...result].sort(quoteLast((a, b) => b.monthlyFrom - a.monthlyFrom));
      default:
        // 인기순(계층형): 브랜드 우선순위(SSOT 브랜드 비교자) → 같은 브랜드 내에서는
        // 운영자가 어드민에서 지정한 차량 노출 순서(displayOrder) 오름차순.
        return [...result].sort(
          quoteLast((a, b) => {
            if (a.brand !== b.brand) return brandComparator(a.brand, b.brand);
            return a.displayOrder - b.displayOrder;
          }),
        );
    }
  }, [vehicles, categoryFilter, brandFilter, sortBy, featured, searchQuery, brandComparator]);

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
  // 검색·필터가 활성일 때만 차량 목록을 노출(기본 화면은 주목 차량 슬라이더만, 전체 나열 X)
  const isBrowsing = searchQuery.trim().length > 0 || hasActiveFilters;
  const activeFilterCount =
    (categoryFilter !== "전체" ? 1 : 0) + (brandFilter !== "전체" ? 1 : 0);
  const resetFilters = () => {
    setCategoryFilter("전체");
    setBrandFilter("전체");
  };
  const currentSortLabel =
    SORT_OPTIONS.find((o) => o.value === sortBy)?.label ?? "인기순";

  return (
    <div className="public-app-page min-h-screen pb-24 md:pb-0">

      {/* ── 컴팩트 sticky 바 (스크롤 후 등장) ── */}
      <AnimatePresence>
        {showStickyBar && (
          <motion.div
            initial={{ y: -52, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -52, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed left-0 right-0 top-[50px] z-50 border-b border-line2 bg-white/95 shadow-soft backdrop-blur-md md:top-[72px]"
          >
            <div className="page-container py-2.5">
              <div className="flex items-center gap-2">

                {/* 활성 필터 칩 표시 */}
                {brandFilter !== "전체" && (
                  <span className="flex-shrink-0 flex items-center gap-1 h-8 px-3 rounded-pill bg-brand-soft text-brand text-[12px] font-bold">
                    {brandFilter}
                    <button onClick={() => setBrandFilter("전체")} className="ml-0.5">
                      <X size={10} />
                    </button>
                  </span>
                )}
                {categoryFilter !== "전체" && (
                  <span className="flex-shrink-0 flex items-center gap-1 h-8 px-3 rounded-pill bg-brand-soft text-brand text-[12px] font-bold">
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
                    "flex-shrink-0 flex items-center gap-1.5 h-8 px-3.5 rounded-pill border text-[12px] font-bold transition-all duration-150",
                    activeFilterCount > 0
                      ? "border-brand bg-brand text-white"
                      : "border-line2 bg-white text-g1 hover:border-g3",
                  )}
                >
                  <SlidersHorizontal size={12} />
                  필터
                  {activeFilterCount > 0 && (
                    <span className="flex items-center justify-center w-4 h-4 rounded-full bg-white text-brand text-[10px] font-bold">
                      {activeFilterCount}
                    </span>
                  )}
                </button>

                <div className="flex-1" />

                {/* 검색 */}
                <div className="flex items-center gap-1.5 h-8 px-3 rounded-pill border border-line2 bg-white focus-within:border-brand transition-colors min-w-0">
                  <Search size={11} className="text-g3 flex-shrink-0" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="검색"
                    className="w-16 sm:w-24 text-[12px] font-medium text-ink bg-transparent outline-none placeholder:text-g3 placeholder:font-normal min-w-0"
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery("")} className="flex-shrink-0">
                      <X size={10} className="text-g3" />
                    </button>
                  )}
                </div>

                {/* 정렬 */}
                <div className="relative flex-shrink-0">
                  <button
                    onClick={(e) => { e.stopPropagation(); setSortOpen((v) => !v); }}
                    className="flex items-center gap-1 h-8 px-3 rounded-pill border border-line2 bg-white text-[12px] font-bold text-g1 hover:border-g3 transition-colors whitespace-nowrap"
                  >
                    {currentSortLabel}
                    <ChevronDown
                      size={11}
                      className={cn("text-g3 transition-transform", sortOpen && "rotate-180")}
                    />
                  </button>
                  <AnimatePresence>
                    {sortOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 4, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 4, scale: 0.97 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 top-full mt-1.5 w-36 bg-white rounded-[14px] border border-line2 shadow-lift overflow-hidden z-50"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {SORT_OPTIONS.map((opt) => (
                          <button
                            key={opt.value}
                            onClick={() => { setSortBy(opt.value); setSortOpen(false); }}
                            className={cn(
                              "w-full text-left px-4 py-2.5 text-[13px] transition-colors",
                              sortBy === opt.value
                                ? "bg-brand-soft text-brand font-bold"
                                : "text-g1 hover:bg-sec",
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
      <div className="border-b border-line2 bg-white">
        <div className="page-container py-7 md:py-12">
          <div className="t-kick mb-2.5">
            차량 탐색 · 총 {totalCount}개 차종
          </div>
          <h1 className="text-[27px] font-extrabold leading-[1.2] tracking-[-0.04em] text-ink md:text-[38px]">
            진짜 견적으로 비교하세요
          </h1>
          <p className="mt-2.5 max-w-2xl text-[14px] leading-relaxed text-g1 md:text-[15px]">
            허위 없이, 실제 운영 가능한 조건과 월 납입금을 먼저 확인하세요.
          </p>
        </div>
      </div>

      {/* ── 메인 필터 패널 ── */}
      <div ref={filterPanelRef} className="border-b border-line2 bg-white md:border-b-0 md:bg-transparent">
        <div className="page-container py-5 md:py-0">
          <div className="md:-mt-6 md:rounded-[24px] md:border md:border-line2 md:bg-white md:p-6 md:shadow-soft">

          {/* 브랜드 선택 */}
          <div className="mb-5">
            <p className="mb-3 text-[12.5px] font-extrabold uppercase tracking-[0.06em] text-g2">
              브랜드 선택
            </p>

            {/* 모바일: 5열 그리드로 전체 브랜드 노출 / 데스크탑: 한 줄 flex */}
            <div className="grid grid-cols-5 gap-2 md:flex md:flex-wrap md:gap-2.5">

              {/* 전체 버튼 */}
              <button
                onClick={() => setBrandFilter("전체")}
                className={cn(
                  "flex flex-col items-center justify-center gap-1",
                  "w-full h-[62px] md:w-[92px] md:h-[76px] rounded-[16px] border bg-white",
                  "text-[12px] md:text-[14px] font-bold transition-all duration-200",
                  brandFilter === "전체"
                    ? "border-brand text-brand bg-brand-soft shadow-[0_0_0_3px_rgba(39,54,138,0.07)]"
                    : "border-line2 text-g2 hover:border-g3",
                )}
              >
                <LayoutGrid
                  size={18}
                  strokeWidth={1.5}
                  className={cn("md:w-[22px] md:h-[22px]", brandFilter === "전체" ? "text-brand" : "text-g3")}
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
                      "w-full h-[62px] md:w-[92px] md:h-[76px] rounded-[16px] border bg-white",
                      "transition-all duration-200",
                      isActive
                        ? "border-brand bg-brand-soft shadow-[0_0_0_3px_rgba(39,54,138,0.07)]"
                        : "border-line2 hover:border-g3",
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
                      <span className="text-[12px] md:text-[13px] font-bold text-ink leading-none">{brand}</span>
                    )}
                    <span
                      className={cn(
                        "text-[11px] md:text-[13px] leading-none font-bold",
                        isActive ? "text-brand" : "text-g3",
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
              <p className="mb-2.5 text-[12.5px] font-extrabold uppercase tracking-[0.06em] text-g2">
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
                        "chip gap-2 h-10 shrink-0 whitespace-nowrap",
                        isActive && "chip-on",
                      )}
                    >
                      <span className={isActive ? "text-white/80" : "text-g3"}>
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
                  className="flex h-10 flex-shrink-0 items-center gap-1 rounded-pill border border-line2 bg-white px-3 text-[12px] font-medium text-g2 transition-colors hover:border-brand/30"
                >
                  <X size={10} />
                  <span>초기화</span>
                </button>
              )}

              {/* 검색 — 모바일에서 flex-1로 가로 가득 채움 */}
              <div className="flex h-10 min-w-0 flex-1 items-center gap-1.5 rounded-btn border border-line2 bg-sec px-3.5 transition-colors focus-within:border-brand focus-within:bg-white md:flex-none md:bg-white">
                <Search size={13} className="text-g3 flex-shrink-0" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="차량 검색"
                  className="w-full md:w-32 text-[13.5px] font-medium text-ink bg-transparent outline-none placeholder:text-g3 placeholder:font-normal min-w-0"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery("")} className="flex-shrink-0">
                    <X size={11} className="text-g3" />
                  </button>
                )}
              </div>

              {/* 정렬 */}
              <div className="relative flex-shrink-0">
                <button
                  onClick={(e) => { e.stopPropagation(); setSortOpen((v) => !v); }}
                  className="flex h-10 items-center gap-1.5 whitespace-nowrap rounded-btn border border-line2 bg-white px-3.5 text-[12.5px] font-bold text-g1 transition-colors hover:border-brand/30 md:px-4 md:text-[13px]"
                >
                  {currentSortLabel}
                  <ChevronDown
                    size={12}
                    className={cn(
                      "text-g3 transition-transform duration-200",
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
                      className="absolute right-0 top-full mt-1.5 w-36 bg-white rounded-[14px] border border-line2 shadow-lift overflow-hidden z-50"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {SORT_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => { setSortBy(opt.value); setSortOpen(false); }}
                          className={cn(
                            "w-full text-left px-4 py-2.5 text-[13px] transition-colors",
                            sortBy === opt.value
                              ? "bg-brand-soft text-brand font-bold"
                              : "text-g1 hover:bg-sec",
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
      </div>

      {/* ── 컨텐츠 영역 ── */}
      <div className="page-container py-6 md:py-10">

        {/* 주목할 차량 슬라이더 (어드민 isSpotlight 지정) — 검색/필터와 무관하게 항상 노출 */}
        {featured.length > 0 && (
          <section className="mb-8 md:mb-10">
            <div className="mb-4 flex items-end justify-between gap-4">
              <div>
                <div className="t-kick mb-1.5">
                  주목할 차량
                </div>
                <h2 className="text-[20px] font-extrabold tracking-[-0.03em] text-ink md:text-[24px]">
                  지금 가장 많이 비교하는 모델
                </h2>
              </div>
            </div>
            <FeaturedCarsSlider vehicles={featured} />
          </section>
        )}

        {/* 차량 목록 — 검색/필터가 활성일 때만 노출 (기본 화면은 전체 나열하지 않음) */}
        {isBrowsing ? (
          <section>
            <div className="flex items-center justify-between mb-4 md:mb-5">
              <div className="flex items-baseline gap-2">
                <h2 className="text-[18px] font-extrabold tracking-[-0.03em] text-ink md:text-[20px]">
                  검색 결과
                </h2>
                <span className="num text-[14px] font-extrabold text-brand">{filteredVehicles.length}</span>
                <span className="text-[12px] font-medium text-g2">개</span>
              </div>

              {/* 활성 필터 칩 */}
              {hasActiveFilters && (
                <div className="flex items-center gap-1.5">
                  {brandFilter !== "전체" && (
                    <span className="flex items-center gap-1 h-7 px-3 rounded-pill bg-brand-soft text-brand text-[12px] font-bold">
                      {brandFilter}
                      <button onClick={() => setBrandFilter("전체")}>
                        <X size={10} />
                      </button>
                    </span>
                  )}
                  {categoryFilter !== "전체" && (
                    <span className="flex items-center gap-1 h-7 px-3 rounded-pill bg-brand-soft text-brand text-[12px] font-bold">
                      {categoryFilter}
                      <button onClick={() => setCategoryFilter("전체")}>
                        <X size={10} />
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
                    <div className="w-14 h-14 md:w-16 md:h-16 rounded-[18px] bg-brand-soft flex items-center justify-center mb-4">
                    <Search size={22} className="text-brand" />
                  </div>
                  <p className="text-[17px] md:text-[18px] font-extrabold tracking-[-0.02em] text-ink mb-1.5">
                    해당 조건의 차량이 없어요
                  </p>
                  <p className="text-[13px] md:text-[14px] text-g1 mb-5">
                    조건을 조금 바꿔보면 더 많은 차량을 찾을 수 있어요
                  </p>
                  <button
                    onClick={() => {
                      resetFilters();
                      setSearchQuery("");
                    }}
                    className="text-[13.5px] font-extrabold text-brand hover:underline"
                  >
                    검색·필터 초기화
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </section>
        ) : (
          /* 기본 화면 안내 — 검색·필터 사용 유도 */
          <section className="flex flex-col items-center justify-center rounded-[22px] border border-dashed border-line2 bg-white py-12 text-center md:py-16">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-[18px] bg-brand-soft md:h-16 md:w-16">
              <Search size={22} className="text-brand" />
            </div>
            <p className="text-[17px] md:text-[18px] font-extrabold tracking-[-0.02em] text-ink mb-1.5">
              찾으시는 차량이 있나요?
            </p>
            <p className="text-[13px] md:text-[14px] text-g1">
              위에서 브랜드·차종을 선택하거나 검색하면 차량을 보여드려요
            </p>
          </section>
        )}

        {/* 이런 차량은 어떠세요? */}
        {searchQuery && suggestedVehicles.length > 0 && (
          <section className="mt-10 md:mt-12">
            <h2 className="text-[18px] md:text-[20px] font-extrabold tracking-[-0.03em] text-ink mb-1">
              이런 차량은 어떠세요?
            </h2>
            <p className="text-[13px] text-g1 mb-5">같은 카테고리의 다른 차량들이에요</p>
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-5">
              {suggestedVehicles.map((vehicle, idx) => (
                <CarCard key={vehicle.id} vehicle={vehicle} index={idx} />
              ))}
            </div>
          </section>
        )}

        {/* AI 추천 배너 */}
        <section
          className="mt-12 overflow-hidden rounded-[18px] md:mt-14"
          style={{
            background: "linear-gradient(135deg, #27368A 0%, #1B2A66 55%, #5A3DB0 100%)",
          }}
        >
          <div className="px-5 md:px-12 py-7 md:py-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <AiBadge tone="onDark" />
                <span className="text-[12px] font-extrabold text-white/70 uppercase tracking-[0.08em]">
                  추천
                </span>
              </div>
              <h3 className="text-[20px] md:text-[24px] font-extrabold tracking-[-0.03em] text-white mb-1.5">
                어떤 차가 맞는지 모르겠다면?
              </h3>
              <p className="text-[13px] md:text-[14px] text-white/65">
                업종·예산·성향 4가지 질문으로 최적의 차량을 찾아드려요
              </p>
            </div>
            <Link
              href="/recommend"
              className="w-full md:w-auto shrink-0 inline-flex items-center justify-center gap-2 bg-white text-brand
                         text-[14px] font-extrabold px-6 md:px-7 py-3.5 rounded-btn hover:shadow-lg transition-shadow duration-200"
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
