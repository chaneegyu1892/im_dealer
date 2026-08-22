import {
  VEHICLE_CATEGORIES,
  type CategoryFilter,
} from "@/lib/vehicle-quick-filters";
import type { SortOption } from "@/components/cars/CarsFilterControls";

export const CARS_BROWSE_STORAGE_KEY = "im_dealer_cars_browse_url";

export interface CarsBrowseState {
  query: string;
  category: CategoryFilter;
  brand: string;
  sort: SortOption;
}

const SORT_VALUES: readonly SortOption[] = ["popular", "price-asc", "price-desc"];
const CATEGORY_SET = new Set<string>(VEHICLE_CATEGORIES);

export const DEFAULT_CARS_BROWSE_STATE: CarsBrowseState = {
  query: "",
  category: "전체",
  brand: "전체",
  sort: "popular",
};

function firstParam(
  value: string | string[] | undefined,
): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export function parseCarsBrowseState(
  searchParams: Record<string, string | string[] | undefined>,
): CarsBrowseState {
  const rawQuery = firstParam(searchParams.query).trim().slice(0, 80);
  const rawCategory = firstParam(searchParams.category).trim();
  const rawBrand = firstParam(searchParams.brand).trim().slice(0, 40);
  const rawSort = firstParam(searchParams.sort).trim();

  const category = CATEGORY_SET.has(rawCategory)
    ? (rawCategory as CategoryFilter)
    : "전체";
  const sort = (SORT_VALUES as readonly string[]).includes(rawSort)
    ? (rawSort as SortOption)
    : "popular";
  const brand = rawBrand.length > 0 ? rawBrand : "전체";

  return {
    query: rawQuery,
    category,
    brand,
    sort,
  };
}

/** 기본값과 같은 키는 쿼리에서 생략해 URL을 짧게 유지한다. */
export function serializeCarsBrowseState(state: CarsBrowseState): string {
  const params = new URLSearchParams();
  if (state.query.trim()) params.set("query", state.query.trim().slice(0, 80));
  if (state.category !== "전체") params.set("category", state.category);
  if (state.brand !== "전체") params.set("brand", state.brand);
  if (state.sort !== "popular") params.set("sort", state.sort);
  const qs = params.toString();
  return qs ? `/cars?${qs}` : "/cars";
}

export function rememberCarsBrowseUrl(url: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(CARS_BROWSE_STORAGE_KEY, url);
  } catch {
    // private mode 등 — 복원 실패해도 목록 진입은 가능
  }
}

export function readRememberedCarsBrowseUrl(): string {
  if (typeof window === "undefined") return "/cars";
  try {
    const raw = window.sessionStorage.getItem(CARS_BROWSE_STORAGE_KEY);
    if (!raw) return "/cars";
    // open redirect 방지: 같은 오리진의 /cars 경로만 허용
    if (!raw.startsWith("/cars")) return "/cars";
    if (raw.startsWith("//") || raw.includes("://")) return "/cars";
    return raw;
  } catch {
    return "/cars";
  }
}
