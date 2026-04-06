"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Sparkles, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { CarCard } from "@/components/cars/CarCard";
import type { VehicleListItem } from "@/types/api";
import type { EngineType } from "@/types/vehicle";

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
  현대: "linear-gradient(145deg, #000666 0%, #1A1A6E 60%, #3333CC 100%)",
  기아: "linear-gradient(145deg, #111111 0%, #2A2A2A 100%)",
  제네시스: "linear-gradient(145deg, #1C1407 0%, #3D2E0F 100%)",
};

// ── 피처드 카드 ───────────────────────────────────────────
function FeaturedCard({ vehicle }: { vehicle: VehicleListItem }) {
  const formattedMonthly = vehicle.monthlyFrom > 0
    ? Math.round(vehicle.monthlyFrom / 10000)
    : null;
  const brandColor = BRAND_COLORS[vehicle.brand] ?? BRAND_COLORS["현대"];
  const engineType = vehicle.defaultTrim?.engineType ?? "가솔린";
  const specs = vehicle.defaultTrim?.specs ?? {};

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="group relative overflow-hidden rounded-card cursor-pointer"
      style={{ background: brandColor }}
    >
      <Link href={`/cars/${vehicle.slug}`} className="block">
        <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full bg-white/5" />
        <div className="absolute -left-8 -bottom-8 w-40 h-40 rounded-full bg-white/5" />
        <div className="absolute right-0 top-0 bottom-0 w-1/2 bg-gradient-to-l from-black/20 to-transparent" />

        <div className="relative z-10 p-8 min-h-[300px] flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold
                               bg-white/15 text-white/90 px-2.5 py-1 rounded-[4px] border border-white/20
                               uppercase tracking-wider">
                {vehicle.brand}
              </span>
              {vehicle.isPopular && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold
                                 bg-white/20 text-white px-2.5 py-1 rounded-[4px]">
                  <Sparkles size={9} />
                  인기 차량
                </span>
              )}
            </div>

            <h2 className="text-[36px] font-light text-white leading-tight mb-2 tracking-tight">
              {vehicle.name}
            </h2>
            <p className="text-white/60 text-[14px] leading-relaxed max-w-xs">
              {vehicle.description}
            </p>
          </div>

          <div>
            {/* 핵심 스펙 */}
            <div className="flex gap-4 mb-6">
              {Object.entries(specs).slice(0, 3).map(([label, value]) => (
                <div key={label}>
                  <div className="text-[10px] text-white/40 mb-0.5">{label}</div>
                  <div className="text-[13px] font-medium text-white/90">{value}</div>
                </div>
              ))}
            </div>

            <div className="flex items-end justify-between">
              <div>
                <span className="text-[11px] text-white/40 block mb-1">
                  월 납입금 (48개월·표준형)
                </span>
                <div className="flex items-baseline gap-1">
                  {formattedMonthly ? (
                    <>
                      <span className="text-[32px] font-semibold text-white leading-none">
                        {formattedMonthly}
                      </span>
                      <span className="text-[15px] text-white/70 font-medium">만원~</span>
                    </>
                  ) : (
                    <span className="text-[15px] text-white/70">견적 준비중</span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 bg-white text-primary text-[13px] font-semibold
                              px-5 py-2.5 rounded-btn transition-all duration-200
                              group-hover:bg-primary-100 group-hover:gap-3">
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

  // 인기 + isPopular 상위 2개를 피처드로
  const featured = vehicles.filter((v) => v.isPopular).slice(0, 2);
  const featuredIds = new Set(featured.map((v) => v.id));

  const filteredVehicles = useMemo(() => {
    let result = vehicles.filter((v) => !featuredIds.has(v.id));

    if (categoryFilter !== "전체") {
      result = result.filter((v) => v.category === categoryFilter);
    }
    if (brandFilter !== "전체") {
      result = result.filter((v) => v.brand === brandFilter);
    }

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
      <div className="page-container pt-10 pb-8">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[11px] font-semibold text-ink-caption uppercase tracking-[0.15em]">
                차량 탐색
              </span>
              <span className="text-[11px] text-ink-caption">·</span>
              <span className="text-[11px] text-ink-caption">
                총 {totalCount}개 차종
              </span>
            </div>
            <h1 className="text-headline-sm font-light text-ink leading-tight">
              진짜 견적으로 비교하세요
            </h1>
            <p className="text-[14px] text-ink-label mt-1.5">
              허위 없이, 실제 운영 가능한 조건으로만 안내합니다
            </p>
          </div>

          <Link
            href="/recommend"
            className="inline-flex items-center gap-2 bg-primary text-white text-[13px] font-medium
                       px-5 py-2.5 rounded-btn hover:opacity-90 transition-opacity duration-200
                       self-start md:self-auto shrink-0"
          >
            <Sparkles size={14} />
            AI로 차량 추천받기
          </Link>
        </div>
      </div>

      {/* Sticky 필터 바 */}
      <div className="sticky top-16 z-40 bg-white/90 backdrop-blur-md border-b border-[#F0F0F0]">
        <div className="page-container py-3">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <div className="flex items-center gap-1">
              {VEHICLE_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={cn(
                    "px-3 py-1.5 text-[12px] font-medium rounded-btn transition-all duration-150",
                    categoryFilter === cat
                      ? "bg-primary text-white"
                      : "text-ink-label hover:text-ink hover:bg-neutral"
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="hidden md:block h-4 w-px bg-neutral-800" />

            <div className="flex items-center gap-1">
              {VEHICLE_BRANDS.map((brand) => (
                <button
                  key={brand}
                  onClick={() => setBrandFilter(brand)}
                  className={cn(
                    "px-3 py-1.5 text-[12px] font-medium rounded-btn transition-all duration-150",
                    brandFilter === brand
                      ? "bg-primary-100 text-primary border border-primary-200"
                      : "text-ink-label hover:text-ink hover:bg-neutral border border-transparent"
                  )}
                >
                  {brand}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 ml-auto">
              {activeFilterCount > 0 && (
                <button
                  onClick={() => {
                    setCategoryFilter("전체");
                    setBrandFilter("전체");
                  }}
                  className="text-[11px] text-ink-caption hover:text-ink-label flex items-center gap-1"
                >
                  <SlidersHorizontal size={11} />
                  필터 초기화
                </button>
              )}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="text-[12px] text-ink-label bg-transparent border-none outline-none cursor-pointer
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
      <div className="page-container py-8">
        {/* 피처드 섹션 */}
        {categoryFilter === "전체" && brandFilter === "전체" && (
          <section className="mb-10">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-[11px] font-semibold text-ink-caption uppercase tracking-[0.12em]">
                주목할 차량
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {featured[0] && (
                <div className="md:col-span-2">
                  <FeaturedCard vehicle={featured[0]} />
                </div>
              )}
              {featured[1] && (
                <div className="md:col-span-1">
                  <FeaturedCard vehicle={featured[1]} />
                </div>
              )}
            </div>
          </section>
        )}

        {/* 전체 차량 그리드 */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-ink-caption uppercase tracking-[0.12em]">
                {categoryFilter !== "전체" || brandFilter !== "전체"
                  ? "검색 결과"
                  : "전체 차량"}
              </span>
              <span className="text-[11px] text-ink-caption">
                {filteredVehicles.length}개
              </span>
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
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
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
                <div className="w-14 h-14 rounded-full bg-primary-100 flex items-center justify-center mb-4">
                  <SlidersHorizontal size={22} className="text-primary" />
                </div>
                <p className="text-[15px] font-medium text-ink mb-1">
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
        <section className="mt-12 rounded-card overflow-hidden"
                 style={{ background: "linear-gradient(135deg, #000666 0%, #1A1A6E 60%, #3333CC 100%)" }}>
          <div className="px-8 py-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={14} className="text-white/60" />
                <span className="text-[11px] font-semibold text-white/60 uppercase tracking-wider">
                  AI 추천
                </span>
              </div>
              <h3 className="text-[20px] font-light text-white mb-1">
                어떤 차가 맞는지 모르겠다면?
              </h3>
              <p className="text-[13px] text-white/60">
                업종·예산·성향 4가지 질문으로 최적의 차량을 찾아드려요
              </p>
            </div>
            <Link
              href="/recommend"
              className="shrink-0 inline-flex items-center gap-2 bg-white text-primary
                         text-[13px] font-semibold px-6 py-3 rounded-btn
                         hover:bg-primary-100 transition-colors duration-200"
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
