"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import {
  CarsFilterPanel,
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

export function CarsClientPage({
  vehicles,
  brandSignals,
  initialSearchQuery = "",
}: CarsClientPageProps) {
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("전체");
  const [brandFilter, setBrandFilter] = useState("전체");
  const [sortBy, setSortBy] = useState<SortOption>("popular");
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
    const monthlyFrom = (vehicle: VehicleListItem) =>
      quoteCache[vehicle.id]?.monthlyFrom ?? vehicle.monthlyFrom ?? 0;
    const matchesQuery = (vehicle: VehicleListItem) =>
      [vehicle.name, vehicle.brand, vehicle.category, vehicle.description ?? "", ...vehicle.highlights, ...vehicle.tags]
        .map((field) => field.toLowerCase())
        .some((field) => field.includes(query));

    let result = query
      ? vehicles.filter(matchesQuery)
      : vehicles.filter((vehicle) => !featuredIds.has(vehicle.id));

    if (!query && categoryFilter !== "전체") {
      result = result.filter((vehicle) => vehicle.category === categoryFilter);
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
        <FeaturedVehiclesSection vehicles={featured} />

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
