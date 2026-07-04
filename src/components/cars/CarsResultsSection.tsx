"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, CarFront, Search, Tags, X } from "lucide-react";
import { CarCard } from "@/components/cars/CarCard";
import { AiBadge } from "@/components/ui/AiBadge";
import type { CategoryFilter } from "@/components/cars/CarsFilterPanel";
import type { VehicleListItem } from "@/types/api";

interface CarsResultsSectionProps {
  isBrowsing: boolean;
  vehicles: VehicleListItem[];
  suggestedVehicles: VehicleListItem[];
  searchQuery: string;
  categoryFilter: CategoryFilter;
  brandFilter: string;
  sortBy: string;
  hasActiveFilters: boolean;
  quoteLoadFailed: boolean;
  onCategorySelect: (category: CategoryFilter) => void;
  onBrandReset: () => void;
  onCategoryReset: () => void;
  onClearAll: () => void;
  onScrollToFilters: () => void;
}

export function CarsResultsSection({
  isBrowsing,
  vehicles,
  suggestedVehicles,
  searchQuery,
  categoryFilter,
  brandFilter,
  sortBy,
  hasActiveFilters,
  quoteLoadFailed,
  onCategorySelect,
  onBrandReset,
  onCategoryReset,
  onClearAll,
  onScrollToFilters,
}: CarsResultsSectionProps) {
  if (!isBrowsing) {
    return (
      <section className="relative overflow-hidden rounded-[30px] bg-surface p-2 shadow-float ring-1 ring-border-subtle/80">
        <div className="relative rounded-[24px] bg-surface-soft/80 px-5 py-6 md:px-8 md:py-8">
          <div className="mb-6 max-w-xl">
            <p className="mb-2 inline-flex rounded-pill bg-brand-soft px-3 py-1.5 text-[12px] font-extrabold text-brand">
              탐색 시작
            </p>
            <h2 className="break-keep text-[24px] font-extrabold leading-tight tracking-[-0.03em] text-text-strong md:text-[32px]">
              브랜드나 용도를 고르면
              <br className="hidden sm:block" />
              맞는 차량만 추려드릴게요
            </h2>
            <p className="mt-3 break-keep text-[14px] font-medium leading-relaxed text-text-muted md:text-[15px]">
              첫 화면에서는 전체 차량을 길게 펼치지 않고, 조건을 선택한 뒤 필요한 결과만 보여줍니다.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <button
              type="button"
              onClick={onScrollToFilters}
              className="group flex min-h-[128px] flex-col items-start justify-between rounded-[22px] border border-border-subtle bg-surface p-4 text-left shadow-card transition-all duration-state hover:-translate-y-0.5 hover:border-brand/35 hover:shadow-float focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/30"
            >
              <span className="grid h-10 w-10 place-items-center rounded-[14px] bg-brand-soft text-brand">
                <Tags size={18} strokeWidth={2.2} />
              </span>
              <span>
                <span className="block text-[15px] font-extrabold text-text-strong">브랜드 선택</span>
                <span className="mt-1 block text-[12.5px] font-medium leading-relaxed text-text-muted">
                  로고 목록에서 원하는 제조사만 보기
                </span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => onCategorySelect("SUV")}
              className="group flex min-h-[128px] flex-col items-start justify-between rounded-[22px] border border-border-subtle bg-surface p-4 text-left shadow-card transition-all duration-state hover:-translate-y-0.5 hover:border-brand/35 hover:shadow-float focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/30"
            >
              <span className="grid h-10 w-10 place-items-center rounded-[14px] bg-brand-soft text-brand">
                <CarFront size={18} strokeWidth={2.2} />
              </span>
              <span>
                <span className="block text-[15px] font-extrabold text-text-strong">SUV부터 보기</span>
                <span className="mt-1 block text-[12.5px] font-medium leading-relaxed text-text-muted">
                  패밀리·업무용으로 많이 찾는 차종
                </span>
              </span>
            </button>

            <Link
              href="/recommend"
              className="group flex min-h-[128px] flex-col items-start justify-between rounded-[22px] border border-brand/20 bg-brand p-4 text-left shadow-float transition-all duration-state hover:-translate-y-0.5 hover:bg-brand-pressed focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/35"
            >
              <span className="inline-flex items-center gap-1.5">
                <AiBadge tone="onDark" />
                <span className="text-[12px] font-extrabold uppercase tracking-[0.06em] text-white/80">추천</span>
              </span>
              <span className="flex w-full items-end justify-between gap-3">
                <span>
                  <span className="block text-[15px] font-extrabold text-white">AI 추천 받기</span>
                  <span className="mt-1 block text-[12.5px] font-medium leading-relaxed text-white/70">
                    예산과 성향으로 바로 좁히기
                  </span>
                </span>
                <ArrowRight size={16} className="shrink-0 text-white/75 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <>
      <section>
        {quoteLoadFailed && (
          <div className="mb-4 rounded-[18px] border border-status-warning/20 bg-status-warning-soft px-4 py-3 text-[13px] font-bold text-status-warning">
            일부 월 납입금 정보를 불러오지 못했어요. 차량 상세에서 견적을 다시 확인할 수 있습니다.
          </div>
        )}

        <div className="mb-4 flex items-center justify-between gap-3 md:mb-5">
          <div className="flex items-baseline gap-2">
            <h2 className="text-[20px] font-extrabold text-text-strong">
              검색 결과
            </h2>
            <span className="num text-[15px] font-extrabold text-brand">
              {vehicles.length}
            </span>
            <span className="text-[12px] font-semibold text-text-muted">개</span>
          </div>
          {hasActiveFilters && (
            <div className="hidden items-center gap-1.5 sm:flex">
              {brandFilter !== "전체" && (
                <button
                  type="button"
                  onClick={onBrandReset}
                  className="inline-flex h-8 items-center gap-1 rounded-pill bg-brand-soft px-3 text-[12px] font-extrabold text-brand"
                >
                  {brandFilter}
                  <X size={10} />
                </button>
              )}
              {categoryFilter !== "전체" && (
                <button
                  type="button"
                  onClick={onCategoryReset}
                  className="inline-flex h-8 items-center gap-1 rounded-pill bg-brand-soft px-3 text-[12px] font-extrabold text-brand"
                >
                  {categoryFilter}
                  <X size={10} />
                </button>
              )}
            </div>
          )}
        </div>

        <AnimatePresence mode="wait">
          {vehicles.length > 0 ? (
            <motion.div
              key={`${categoryFilter}-${brandFilter}-${sortBy}-${searchQuery}`}
              initial={false}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3"
            >
              {vehicles.map((vehicle) => (
                <CarCard key={vehicle.id} vehicle={vehicle} />
              ))}
            </motion.div>
          ) : (
            <motion.div
              initial={false}
              className="rounded-[24px] bg-surface px-5 py-16 text-center shadow-card ring-1 ring-border-subtle/80"
            >
              <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-[18px] bg-brand-soft">
                <Search size={22} className="text-brand" />
              </div>
              <p className="mb-1.5 text-[18px] font-extrabold text-text-strong">
                해당 조건의 차량이 없어요
              </p>
              <p className="mb-5 text-[14px] leading-relaxed text-text-muted">
                조건을 조금 바꾸면 더 많은 차량을 볼 수 있어요.
              </p>
              <button
                type="button"
                onClick={onClearAll}
                className="inline-flex min-h-11 items-center rounded-pill bg-brand px-5 text-[13px] font-extrabold text-white transition-colors hover:bg-brand-pressed"
              >
                검색·필터 초기화
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {searchQuery && suggestedVehicles.length > 0 && (
        <section className="mt-10 md:mt-12">
          <h2 className="mb-1 text-[19px] font-extrabold text-text-strong">
            이런 차량은 어떠세요?
          </h2>
          <p className="mb-5 text-[14px] text-text-muted">
            같은 카테고리의 다른 차량들이에요.
          </p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {suggestedVehicles.map((vehicle) => (
              <CarCard key={vehicle.id} vehicle={vehicle} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
