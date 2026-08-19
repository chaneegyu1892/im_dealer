"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CarsFilterPanel,
  type CategoryFilter,
} from "@/components/cars/CarsFilterPanel";
import { SORT_OPTIONS, type SortOption } from "@/components/cars/CarsFilterControls";
import { CarsResultsSection } from "@/components/cars/CarsResultsSection";
import { CarsStickyFilterBar } from "@/components/cars/CarsStickyFilterBar";
import { makeBrandComparator, type BrandSignal } from "@/lib/brand-sort";
import {
  DEFAULT_CARS_BROWSE_STATE,
  rememberCarsBrowseUrl,
  serializeCarsBrowseState,
  type CarsBrowseState,
} from "@/lib/cars-browse-state";
import {
  BODY_CATEGORY_MAP,
  vehicleLooksHybrid,
} from "@/lib/vehicle-quick-filters";
import type { VehicleListItem } from "@/types/api";
import { compareWithQuoteLast, type QuoteResponse, type QuoteSnapshot } from "./carsBrowseData";
import { CarsPageHero, FeaturedVehiclesSection } from "./CarsPageSections";

/** 서버 route(/api/vehicles/representative-quotes)의 MAX_IDS 와 동일. 초과분은 잘리므로 청크로 쪼개 보낸다. */
const QUOTE_IDS_PER_REQUEST = 80;
/** id 당 최초 1회 + 재시도 1회. 서버가 끝내 못 채우는 id 가 이펙트를 재점화하지 못하게 막는다. */
const MAX_QUOTE_ATTEMPTS = 2;

interface CarsClientPageProps {
  readonly vehicles: VehicleListItem[];
  readonly brandSignals: Record<string, BrandSignal>;
  readonly initialBrowseState?: CarsBrowseState;
}

export function CarsClientPage({
  vehicles,
  brandSignals,
  initialBrowseState = DEFAULT_CARS_BROWSE_STATE,
}: CarsClientPageProps) {
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>(
    initialBrowseState.category,
  );
  const [brandFilter, setBrandFilter] = useState(initialBrowseState.brand);
  const [sortBy, setSortBy] = useState<SortOption>(initialBrowseState.sort);
  const [searchQuery, setSearchQuery] = useState(initialBrowseState.query);
  const [showStickyBar, setShowStickyBar] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [quoteCache, setQuoteCache] = useState<Record<string, QuoteSnapshot>>({});
  const [quoteLoadFailed, setQuoteLoadFailed] = useState(false);
  const [quoteRetryTick, setQuoteRetryTick] = useState(0);
  const filterPanelRef = useRef<HTMLDivElement>(null);
  const searchSyncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 요청 시도 횟수 / 진행 중 id / 살아있는 요청을 ref 로 들고 있어야
  // quoteCache 갱신으로 이펙트가 다시 돌아도 같은 id 를 재발사하지 않는다.
  const quoteAttemptsRef = useRef<Map<string, number>>(new Map());
  const quoteInflightRef = useRef<Set<string>>(new Set());
  const quoteControllersRef = useRef<Set<AbortController>>(new Set());

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
      if (categoryFilter === "EV") {
        result = result.filter(
          (vehicle) =>
            vehicle.hasEv === true || vehicle.defaultTrim?.engineType === "EV",
        );
      } else if (categoryFilter === "HEV") {
        result = result.filter((vehicle) => vehicleLooksHybrid(vehicle));
      } else {
        const bodyCategory = BODY_CATEGORY_MAP[categoryFilter];
        if (bodyCategory) {
          result = result.filter((vehicle) => vehicle.category === bodyCategory);
        }
      }
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

  // 필터·검색 상태를 URL + sessionStorage 에 동기화해 상세 복귀 시 복원한다.
  // router.replace 는 App Router soft navigation + RSC 재요청을 유발해
  // 입력 중 검색창 포커스가 끊길 수 있으므로 history.replaceState 를 쓴다.
  useEffect(() => {
    const nextState: CarsBrowseState = {
      query: searchQuery,
      category: categoryFilter,
      brand: brandFilter,
      sort: sortBy,
    };
    const href = serializeCarsBrowseState(nextState);
    rememberCarsBrowseUrl(href);

    if (searchSyncTimer.current) clearTimeout(searchSyncTimer.current);
    searchSyncTimer.current = setTimeout(() => {
      const current =
        window.location.pathname +
        (window.location.search || "");
      if (current === href || (href === "/cars" && current === "/cars")) return;
      window.history.replaceState(window.history.state, "", href);
    }, 220);

    return () => {
      if (searchSyncTimer.current) clearTimeout(searchSyncTimer.current);
    };
  }, [searchQuery, categoryFilter, brandFilter, sortBy]);

  // 언마운트 때만 살아있는 요청을 끊는다.
  // 이펙트 재실행마다 abort 하면 청크 응답이 서로를 취소해 같은 id 를 반복 요청하게 된다.
  useEffect(() => {
    const controllers = quoteControllersRef.current;
    return () => {
      controllers.forEach((controller) => controller.abort());
      controllers.clear();
    };
  }, []);

  useEffect(() => {
    if (!isBrowsing) return;

    const attempts = quoteAttemptsRef.current;
    const inflight = quoteInflightRef.current;
    const controllers = quoteControllersRef.current;
    // 숨김 차량은 서버가 견적을 돌려주지 않으므로 애초에 요청하지 않는다.
    const pendingIds = filteredVehicles
      .filter((vehicle) => vehicle.isVisible !== false)
      .map((vehicle) => vehicle.id)
      .filter(
        (id) =>
          !quoteCache[id] &&
          !inflight.has(id) &&
          (attempts.get(id) ?? 0) < MAX_QUOTE_ATTEMPTS,
      );
    if (pendingIds.length === 0) return;

    pendingIds.forEach((id) => {
      inflight.add(id);
      attempts.set(id, (attempts.get(id) ?? 0) + 1);
    });

    const chunks: string[][] = [];
    for (let index = 0; index < pendingIds.length; index += QUOTE_IDS_PER_REQUEST) {
      chunks.push(pendingIds.slice(index, index + QUOTE_IDS_PER_REQUEST));
    }

    void Promise.all(
      chunks.map(async (chunkIds) => {
        const controller = new AbortController();
        controllers.add(controller);
        const params = new URLSearchParams({ ids: chunkIds.join(",") });
        try {
          const response = await fetch(
            `/api/vehicles/representative-quotes?${params.toString()}`,
            { signal: controller.signal },
          );
          if (!response.ok) return false;
          const payload = (await response.json()) as QuoteResponse;
          const data = payload.data;
          // 빈 응답에 setQuoteCache 를 호출하면 새 객체 identity 때문에 이펙트가 다시 돈다.
          if (!data || Object.keys(data).length === 0) return true;
          setQuoteLoadFailed(false);
          setQuoteCache((current) => ({ ...current, ...data }));
          return true;
        } catch (error: unknown) {
          if (error instanceof DOMException && error.name === "AbortError") return true;
          return false;
        } finally {
          controllers.delete(controller);
          chunkIds.forEach((id) => inflight.delete(id));
        }
      }),
    ).then((results) => {
      if (results.every(Boolean)) return;
      setQuoteLoadFailed(true);
      // 실패한 id 는 시도 상한(2회) 안에서만 한 번 더 간다.
      setQuoteRetryTick((tick) => tick + 1);
    });
  }, [filteredVehicles, isBrowsing, quoteCache, quoteRetryTick]);

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
