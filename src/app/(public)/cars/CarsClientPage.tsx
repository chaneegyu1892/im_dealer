"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CarsFilterPanel,
  VEHICLE_CATEGORIES,
  type CategoryFilter,
} from "@/components/cars/CarsFilterPanel";
import { SORT_OPTIONS, type SortOption } from "@/components/cars/CarsFilterControls";
import { CarsResultsSection } from "@/components/cars/CarsResultsSection";
import { CarsStickyFilterBar } from "@/components/cars/CarsStickyFilterBar";
import { makeBrandComparator, type BrandSignal } from "@/lib/brand-sort";
import type { VehicleListItem } from "@/types/api";
import { compareWithQuoteLast, type QuoteResponse, type QuoteSnapshot } from "./carsBrowseData";
import { CarsPageHero, FeaturedVehiclesSection } from "./CarsPageSections";

interface CarsClientPageProps {
  readonly vehicles: VehicleListItem[];
  readonly brandSignals: Record<string, BrandSignal>;
  readonly initialSearchQuery?: string;
}

export function isElectricEngine(engineType: string): boolean {
  return engineType === "EV" || engineType === "전기";
}

export function isElectricOnlyVehicle(vehicle: Pick<VehicleListItem, "publicTrims">): boolean {
  const trims = vehicle.publicTrims ?? [];
  return trims.length > 0 && trims.every((trim) => isElectricEngine(trim.engineType));
}

// 카테고리/브랜드/정렬 필터를 세션 동안 유지하기 위한 저장 키.
// 검색어(searchQuery)는 URL(?query=)이 단일 출처이므로 여기에 포함하지 않는다.
const FILTERS_STORAGE_KEY = "imdealer:cars-filters";
const SCROLL_STORAGE_KEY = "imdealer:cars-scroll";
const SORT_OPTION_VALUES: readonly SortOption[] = ["popular", "price-asc", "price-desc"];

interface StoredCarsFilters {
  readonly category: CategoryFilter;
  readonly brand: string;
  readonly sort: SortOption;
}

/** 프라이빗 모드 등에서 sessionStorage 접근이 던질 수 있다. 실패하면 저장된 값이 없는 것으로 취급한다. */
function readStoredFilters(): StoredCarsFilters | null {
  try {
    const raw = window.sessionStorage.getItem(FILTERS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredCarsFilters> | null;
    if (!parsed || typeof parsed !== "object") return null;
    const category = parsed.category;
    const brand = parsed.brand;
    const sort = parsed.sort;
    if (
      typeof category !== "string" ||
      !(VEHICLE_CATEGORIES as readonly string[]).includes(category)
    ) {
      return null;
    }
    if (typeof brand !== "string") return null;
    if (typeof sort !== "string" || !SORT_OPTION_VALUES.includes(sort as SortOption)) {
      return null;
    }
    return { category: category as CategoryFilter, brand, sort: sort as SortOption };
  } catch {
    return null;
  }
}

/** 저장 실패는 조용히 무시한다(복원 실패는 기본값으로 되돌아갈 뿐이다). */
function writeStoredFilters(filters: StoredCarsFilters): void {
  try {
    window.sessionStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(filters));
  } catch {
    // no-op: 저장 공간이 없거나 접근이 막혀 있어도 페이지 동작에는 영향 없음.
  }
}

function readStoredScrollY(): number | null {
  try {
    const raw = window.sessionStorage.getItem(SCROLL_STORAGE_KEY);
    if (!raw) return null;
    const value = Number(raw);
    return Number.isFinite(value) && value >= 0 ? value : null;
  } catch {
    return null;
  }
}

function writeStoredScrollY(value: number): void {
  try {
    window.sessionStorage.setItem(SCROLL_STORAGE_KEY, String(value));
  } catch {
    // no-op
  }
}

export function CarsClientPage({
  vehicles,
  brandSignals,
  initialSearchQuery = "",
}: CarsClientPageProps) {
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>(
    () => readStoredFilters()?.category ?? "전체",
  );
  const [brandFilter, setBrandFilter] = useState(() => readStoredFilters()?.brand ?? "전체");
  const [sortBy, setSortBy] = useState<SortOption>(() => readStoredFilters()?.sort ?? "popular");
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const [showStickyBar, setShowStickyBar] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [quoteCache, setQuoteCache] = useState<Record<string, QuoteSnapshot>>({});
  const [quoteLoadFailed, setQuoteLoadFailed] = useState(false);
  const filterPanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = filterPanelRef.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) => setShowStickyBar(!entry.isIntersecting),
      { threshold: 0, rootMargin: "-72px 0px 0px 0px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!sortOpen) return;
    const closeSort = () => setSortOpen(false);
    document.addEventListener("click", closeSort);
    return () => document.removeEventListener("click", closeSort);
  }, [sortOpen]);

  // 카테고리/브랜드/정렬은 뒤로가기로 이 페이지에 돌아왔을 때 그대로 유지되어야 한다.
  useEffect(() => {
    writeStoredFilters({ category: categoryFilter, brand: brandFilter, sort: sortBy });
  }, [categoryFilter, brandFilter, sortBy]);

  // 상세 페이지에서 뒤로가기로 돌아왔을 때 스크롤 위치를 복원한다.
  useEffect(() => {
    const storedScrollY = readStoredScrollY();
    if (storedScrollY === null) return;
    window.scrollTo(0, storedScrollY);
  }, []);

  useEffect(() => {
    let rafId: number | null = null;
    const persistScroll = () => {
      rafId = null;
      writeStoredScrollY(window.scrollY);
    };
    const scheduleScrollPersist = () => {
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(persistScroll);
    };
    window.addEventListener("scroll", scheduleScrollPersist, { passive: true });
    document.addEventListener("visibilitychange", persistScroll);
    window.addEventListener("beforeunload", persistScroll);
    return () => {
      if (rafId !== null) window.cancelAnimationFrame(rafId);
      window.removeEventListener("scroll", scheduleScrollPersist);
      document.removeEventListener("visibilitychange", persistScroll);
      window.removeEventListener("beforeunload", persistScroll);
    };
  }, []);

  const brandComparator = useMemo(
    () => makeBrandComparator(new Map(Object.entries(brandSignals))),
    [brandSignals],
  );
  const brands = useMemo(
    () => Array.from(new Set(vehicles.map((vehicle) => vehicle.brand))).sort(brandComparator),
    [vehicles, brandComparator],
  );
  const featured = useMemo(
    () => {
      const spotlightVehicles = vehicles
        .filter((vehicle) => vehicle.isSpotlight)
        .sort((a, b) => a.displayOrder - b.displayOrder);

      if (spotlightVehicles.length > 0) {
        return spotlightVehicles;
      }

      return [...vehicles]
        .sort((a, b) => {
          if (a.isPopular !== b.isPopular) return a.isPopular ? -1 : 1;
          const aMonthly = a.monthlyFrom ?? 0;
          const bMonthly = b.monthlyFrom ?? 0;
          if (aMonthly !== bMonthly) return aMonthly - bMonthly;
          return a.displayOrder - b.displayOrder;
        })
        .slice(0, 6);
    },
    [vehicles],
  );

  const filteredVehicles = useMemo(() => {
    const featuredIds = new Set(featured.map((vehicle) => vehicle.id));
    const query = searchQuery.trim().toLowerCase();
    const hasSelectedFilters = categoryFilter !== "전체" || brandFilter !== "전체";
    const monthlyFrom = (vehicle: VehicleListItem) =>
      quoteCache[vehicle.id]?.monthlyFrom ?? vehicle.monthlyFrom ?? 0;
    const matchesQuery = (vehicle: VehicleListItem) =>
      [vehicle.name, vehicle.brand, vehicle.category, vehicle.description ?? "", ...vehicle.highlights, ...vehicle.tags]
        .map((field) => field.toLowerCase())
        .some((field) => field.includes(query));

    let result = query
      ? vehicles.filter(matchesQuery)
      : hasSelectedFilters
        ? vehicles
        : vehicles.filter((vehicle) => !featuredIds.has(vehicle.id));

    if (!query && categoryFilter !== "전체") {
      result = result.filter((vehicle) =>
        categoryFilter === "전기차"
          ? isElectricOnlyVehicle(vehicle)
          : vehicle.category === categoryFilter,
      );
    }
    if (!query && brandFilter !== "전체") {
      result = result.filter((vehicle) => vehicle.brand === brandFilter);
    }

    switch (sortBy) {
      case "price-asc":
        return [...result].sort(
          compareWithQuoteLast((a, b) => monthlyFrom(a) - monthlyFrom(b), monthlyFrom),
        );
      case "price-desc":
        return [...result].sort(
          compareWithQuoteLast((a, b) => monthlyFrom(b) - monthlyFrom(a), monthlyFrom),
        );
      default:
        return [...result].sort(
          compareWithQuoteLast((a, b) => {
            if (a.brand !== b.brand) return brandComparator(a.brand, b.brand);
            return a.displayOrder - b.displayOrder;
          }, monthlyFrom),
        );
    }
  }, [vehicles, featured, searchQuery, categoryFilter, brandFilter, sortBy, brandComparator, quoteCache]);

  const suggestedVehicles = useMemo(() => {
    if (!searchQuery.trim() || filteredVehicles.length === 0) return [];
    const filteredIds = new Set(filteredVehicles.map((vehicle) => vehicle.id));
    const categories = new Set(filteredVehicles.map((vehicle) => vehicle.category));
    return vehicles
      .filter((vehicle) => !filteredIds.has(vehicle.id) && categories.has(vehicle.category))
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .slice(0, 4);
  }, [searchQuery, filteredVehicles, vehicles]);

  const hasActiveFilters = categoryFilter !== "전체" || brandFilter !== "전체";
  const activeFilterCount =
    (categoryFilter !== "전체" ? 1 : 0) + (brandFilter !== "전체" ? 1 : 0);
  const isBrowsing = searchQuery.trim().length > 0 || hasActiveFilters;
  const currentSortLabel = SORT_OPTIONS.find((option) => option.value === sortBy)?.label ?? "인기순";
  const displayVehicles = useMemo(
    () =>
      filteredVehicles.map((vehicle) => {
        const quote = quoteCache[vehicle.id];
        if (!quote) return vehicle;
        return {
          ...vehicle,
          monthlyFrom: quote.monthlyFrom,
          representativeQuotes: quote.representativeQuotes,
        };
      }),
    [filteredVehicles, quoteCache],
  );

  const resetFilters = useCallback(() => {
    setCategoryFilter("전체");
    setBrandFilter("전체");
  }, []);
  const clearAll = useCallback(() => {
    resetFilters();
    setSearchQuery("");
  }, [resetFilters]);
  const scrollToFilters = useCallback(() => {
    filterPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);
  const changeSort = useCallback((sort: SortOption) => {
    setSortBy(sort);
    setSortOpen(false);
  }, []);

  useEffect(() => {
    if (!isBrowsing) return;

    const missingIds = filteredVehicles
      .map((vehicle) => vehicle.id)
      .filter((id) => !quoteCache[id]);
    if (missingIds.length === 0) return;

    const controller = new AbortController();
    const params = new URLSearchParams({ ids: missingIds.join(",") });

    fetch(`/api/vehicles/representative-quotes?${params.toString()}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) return;
        const payload = (await response.json()) as QuoteResponse;
        if (!payload.data) return;
        setQuoteLoadFailed(false);
        setQuoteCache((current) => ({ ...current, ...payload.data }));
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setQuoteLoadFailed(true);
      });

    return () => controller.abort();
  }, [filteredVehicles, isBrowsing, quoteCache]);

  return (
    <div className="public-app-page min-h-screen overflow-x-hidden pb-28 lg:pb-0">
      <AnimatePresence>
        {showStickyBar && (
          <CarsStickyFilterBar
            brandFilter={brandFilter}
            categoryFilter={categoryFilter}
            activeFilterCount={activeFilterCount}
            currentSortLabel={currentSortLabel}
            searchQuery={searchQuery}
            sortBy={sortBy}
            sortOpen={sortOpen}
            onBrandChange={setBrandFilter}
            onCategoryChange={setCategoryFilter}
            onSearchChange={setSearchQuery}
            onSortChange={changeSort}
            onSortToggle={() => setSortOpen((value) => !value)}
            onScrollToFilters={scrollToFilters}
          />
        )}
      </AnimatePresence>

      <div className="bg-app-bg pb-6 md:pb-10 lg:pb-0">
        <CarsPageHero totalCount={vehicles.length} />

        <div ref={filterPanelRef} className="page-container pt-4 md:pt-6">
          <CarsFilterPanel
            brands={brands}
            categoryFilter={categoryFilter}
            brandFilter={brandFilter}
            sortBy={sortBy}
            searchQuery={searchQuery}
            sortOpen={sortOpen}
            activeFilterCount={activeFilterCount}
            currentSortLabel={currentSortLabel}
            totalCount={vehicles.length}
            onCategoryChange={setCategoryFilter}
            onBrandChange={setBrandFilter}
            onSortChange={changeSort}
            onSortToggle={() => setSortOpen((value) => !value)}
            onSearchChange={setSearchQuery}
            onResetFilters={resetFilters}
          />
        </div>
      </div>

      <div className="page-container py-7 md:py-10">
        <AnimatePresence initial={false}>
          {!isBrowsing && (
            <motion.div
              key="featured-vehicles"
              initial={{ height: 0, opacity: 0, y: -12 }}
              animate={{ height: "auto", opacity: 1, y: 0 }}
              exit={{ height: 0, opacity: 0, y: -12 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden"
            >
              <FeaturedVehiclesSection vehicles={featured} />
            </motion.div>
          )}
        </AnimatePresence>

        <CarsResultsSection
          isBrowsing={isBrowsing}
          vehicles={displayVehicles}
          suggestedVehicles={suggestedVehicles}
          searchQuery={searchQuery}
          categoryFilter={categoryFilter}
          brandFilter={brandFilter}
          sortBy={sortBy}
          hasActiveFilters={hasActiveFilters}
          quoteLoadFailed={quoteLoadFailed}
          onCategorySelect={setCategoryFilter}
          onBrandReset={() => setBrandFilter("전체")}
          onCategoryReset={() => setCategoryFilter("전체")}
          onClearAll={clearAll}
          onScrollToFilters={scrollToFilters}
        />

      </div>
    </div>
  );
}
