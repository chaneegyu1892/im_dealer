"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Sparkles, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { CarCard } from "@/components/cars/CarCard";
import type { VehicleListItem } from "@/types/api";

const VEHICLE_CATEGORIES = ["전체", "세단", "SUV", "밴", "트럭"] as const;
const VEHICLE_BRANDS = ["전체", "현대", "기아", "제네시스"] as const;
type CategoryFilter = (typeof VEHICLE_CATEGORIES)[number];
type BrandFilter = (typeof VEHICLE_BRANDS)[number];

const SORT_OPTIONS = [
  { value: "popular", label: "인기순" },
  { value: "price-asc", label: "가격 낮은순" },
  { value: "price-desc", label: "가격 높은순" },
] as const;
type SortOption = (typeof SORT_OPTIONS)[number]["value"];

const BRAND_COLORS: Record<string, string> = {
  현대: "linear-gradient(135deg, #000666 0%, #1A1A6E 60%, #3333CC 100%)",
  기아: "linear-gradient(135deg, #111111 0%, #2A2A2A 100%)",
  제네시스: "linear-gradient(135deg, #1C1407 0%, #3D2E0F 100%)",
};

// ── 피처드 카드 ───────────────────────────────────────────
function FeaturedCard({ vehicle, size = "large" }: { vehicle: VehicleListItem; size?: "large" | "small" }) {
  const formattedMonthly = vehicle.monthlyFrom > 0
    ? Math.round(vehicle.monthlyFrom / 10000)
    : null;
  const brandColor = BRAND_COLORS[vehicle.brand] ?? BRAND_COLORS["현대"];
  const specs = vehicle.defaultTrim?.specs ?? {};

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="group relative overflow-hidden rounded-card cursor-pointer h-full"
      style={{ background: brandColor }}
    >
      <Link href={`/cars/${vehicle.slug}`} className="block h-full">
        <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full bg-white/5" />
        <div className="absolute -left-8 -bottom-8 w-40 h-40 rounded-full bg-white/5" />
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-black/15 to-transparent" />

        <div className={cn(
          "relative z-10 flex flex-col justify-between h-full",
          size === "large" ? "p-10 min-h-[340px]" : "p-8 min-h-[340px]"
        )}>
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-[11px] font-semibold bg-white/15 text-white/90 px-2.5 py-1 rounded-[4px] border border-white/20 uppercase tracking-wider">
                {vehicle.brand}
              </span>
              {vehicle.isPopular && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-white/20 text-white px-2.5 py-1 rounded-[4px]">
                  <Sparkles size={9} />
                  인기
                </span>
              )}
            </div>

            <h2 className={cn(
              "font-display font-light text-white leading-tight mb-2 tracking-tight",
              size === "large" ? "text-[40px]" : "text-[32px]"
            )}>
              {vehicle.name}
            </h2>
            <p className="text-white/50 text-[14px] leading-relaxed max-w-sm">
              {vehicle.description}
            </p>
          </div>

          <div>
            {size === "large" && Object.entries(specs).length > 0 && (
              <div className="flex gap-5 mb-6">
                {Object.entries(specs).slice(0, 3).map(([label, value]) => (
                  <div key={label}>
                    <div className="text-[10px] text-white/35 mb-0.5">{label}</div>
                    <div className="text-[13px] font-medium text-white/85">{value}</div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-end justify-between">
              <div>
                <span className="text-[10px] text-white/35 block mb-1">
                  월 납입금 (48개월·표준형)
                </span>
                <div className="flex items-baseline gap-1">
                  {formattedMonthly ? (
                    <>
                      <span className="font-display text-[34px] font-semibold text-white leading-none">
                        {formattedMonthly}
                      </span>
                      <span className="text-[14px] text-white/60 font-medium">만원~</span>
                    </>
                  ) : (
                    <span className="text-[14px] text-white/60">견적 준비중</span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 bg-white text-primary text-[13px] font-semibold
                              px-5 py-2.5 rounded-btn transition-all duration-200
                              group-hover:gap-3 group-hover:shadow-lg">
                견적 보기
                <ArrowRight size={14} strokeWidth={2.5} />
              </div>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

// ── 메인 페이지 ───────────────────────────────────────────
export function CarsClientPage({ vehicles }: { vehicles: VehicleListItem[] }) {
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("전체");
  const [brandFilter, setBrandFilter] = useState<BrandFilter>("전체");
  const [sortBy, setSortBy] = useState<SortOption>("popular");

  const featured = vehicles.filter((v) => v.isPopular).slice(0, 2);
  const featuredIds = new Set(featured.map((v) => v.id));

  const filteredVehicles = useMemo(() => {
    let result = vehicles.filter((v) => !featuredIds.has(v.id));
    if (categoryFilter !== "전체") result = result.filter((v) => v.category === categoryFilter);
    if (brandFilter !== "전체") result = result.filter((v) => v.brand === brandFilter);

    switch (sortBy) {
      case "price-asc":
        return [...result].sort((a, b) => a.monthlyFrom - b.monthlyFrom);
      case "price-desc":
        return [...result].sort((a, b) => b.monthlyFrom - a.monthlyFrom);
      default:
        return [...result].sort((a, b) => a.displayOrder - b.displayOrder);
    }
  }, [vehicles, categoryFilter, brandFilter, sortBy, featuredIds]);

  const totalCount = vehicles.length;
  const activeFilterCount =
    (categoryFilter !== "전체" ? 1 : 0) + (brandFilter !== "전체" ? 1 : 0);

  return (
    <div className="min-h-screen bg-neutral">
      {/* 페이지 헤더 */}
      <div className="page-container pt-12 pb-10">
        <div className="flex items-end justify-between">
          <div>
            <p className="section-label mb-2">
              차량 탐색 · 총 {totalCount}개 차종
            </p>
            <h1 className="font-display text-headline-sm text-ink leading-tight">
              진짜 견적으로 비교하세요
            </h1>
            <p className="text-[14px] text-ink-label mt-2">
              허위 없이, 실제 운영 가능한 조건으로만 안내합니다
            </p>
          </div>

          <Link
            href="/recommend"
            className="inline-flex items-center gap-2 bg-primary text-white text-[13px] font-medium
                       px-5 py-2.5 rounded-btn hover:opacity-90 transition-opacity duration-200 shrink-0"
          >
            <Sparkles size={14} />
            AI로 차량 추천받기
          </Link>
        </div>
      </div>

      {/* Sticky 필터 바 */}
      <div className="sticky top-[72px] z-40 bg-white/95 backdrop-blur-md border-b border-[#F0F0F0]">
        <div className="page-container py-3.5">
          <div className="flex items-center gap-6">
            {/* 카테고리 */}
            <div className="flex items-center gap-1">
              {VEHICLE_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={cn(
                    "px-3.5 py-1.5 text-[13px] font-medium rounded-btn transition-all duration-150",
                    categoryFilter === cat
                      ? "bg-primary text-white"
                      : "text-ink-label hover:text-ink hover:bg-neutral"
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="h-4 w-px bg-neutral-800" />

            {/* 브랜드 */}
            <div className="flex items-center gap-1">
              {VEHICLE_BRANDS.map((brand) => (
                <button
                  key={brand}
                  onClick={() => setBrandFilter(brand)}
                  className={cn(
                    "px-3.5 py-1.5 text-[13px] font-medium rounded-btn transition-all duration-150",
                    brandFilter === brand
                      ? "bg-primary-100 text-primary border border-primary-200"
                      : "text-ink-label hover:text-ink hover:bg-neutral border border-transparent"
                  )}
                >
                  {brand}
                </button>
              ))}
            </div>

            {/* 우측: 정렬 + 필터 초기화 */}
            <div className="flex items-center gap-3 ml-auto">
              {activeFilterCount > 0 && (
                <button
                  onClick={() => {
                    setCategoryFilter("전체");
                    setBrandFilter("전체");
                  }}
                  className="text-[12px] text-ink-caption hover:text-ink-label flex items-center gap-1"
                >
                  <SlidersHorizontal size={11} />
                  필터 초기화
                </button>
              )}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="text-[13px] text-ink-label bg-transparent border-none outline-none cursor-pointer
                           hover:text-ink transition-colors duration-150"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* 컨텐츠 영역 */}
      <div className="page-container py-10">
        {/* 피처드 섹션 */}
        {categoryFilter === "전체" && brandFilter === "전체" && featured.length > 0 && (
          <section className="mb-12">
            <p className="section-label mb-4">주목할 차량</p>
            <div className="grid grid-cols-3 gap-5">
              {featured[0] && (
                <div className="col-span-2">
                  <FeaturedCard vehicle={featured[0]} size="large" />
                </div>
              )}
              {featured[1] && (
                <div className="col-span-1">
                  <FeaturedCard vehicle={featured[1]} size="small" />
                </div>
              )}
            </div>
          </section>
        )}

        {/* 전체 차량 그리드 */}
        <section>
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <p className="section-label">
                {categoryFilter !== "전체" || brandFilter !== "전체" ? "검색 결과" : "전체 차량"}
              </p>
              <span className="text-[11px] text-ink-caption">{filteredVehicles.length}개</span>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {filteredVehicles.length > 0 ? (
              <motion.div
                key={`${categoryFilter}-${brandFilter}-${sortBy}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="grid grid-cols-4 gap-5"
              >
                {filteredVehicles.map((vehicle, idx) => (
                  <CarCard key={vehicle.id} vehicle={vehicle} index={idx} />
                ))}
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center py-24 text-center"
              >
                <div className="w-14 h-14 rounded-full bg-primary-100 flex items-center justify-center mb-4">
                  <SlidersHorizontal size={22} className="text-primary" />
                </div>
                <p className="text-[16px] font-display font-medium text-ink mb-1.5">
                  해당 조건의 차량이 없어요
                </p>
                <p className="text-[13px] text-ink-label mb-5">
                  조건을 조금 바꿔보면 더 많은 차량을 찾을 수 있어요
                </p>
                <button
                  onClick={() => {
                    setCategoryFilter("전체");
                    setBrandFilter("전체");
                  }}
                  className="text-[13px] font-medium text-primary hover:underline"
                >
                  전체 차량 보기
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* 하단 AI 추천 배너 */}
        <section
          className="mt-16 rounded-card overflow-hidden"
          style={{ background: "linear-gradient(135deg, #000666 0%, #1A1A6E 60%, #3333CC 100%)" }}
        >
          <div className="px-12 py-10 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={14} className="text-white/50" />
                <span className="text-[11px] font-semibold text-white/50 uppercase tracking-wider">
                  AI 추천
                </span>
              </div>
              <h3 className="font-display text-[22px] font-light text-white mb-1.5">
                어떤 차가 맞는지 모르겠다면?
              </h3>
              <p className="text-[13px] text-white/50">
                업종·예산·성향 4가지 질문으로 최적의 차량을 찾아드려요
              </p>
            </div>
            <Link
              href="/recommend"
              className="shrink-0 inline-flex items-center gap-2 bg-white text-primary
                         text-[13px] font-semibold px-7 py-3 rounded-btn
                         hover:shadow-lg transition-shadow duration-200"
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
