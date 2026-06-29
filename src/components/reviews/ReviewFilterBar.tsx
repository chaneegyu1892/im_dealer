"use client";

import { ChevronDown, Image as ImageIcon, Star, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReviewSort } from "@/types/review";
import { VehicleCombobox } from "./VehicleCombobox";

export interface VehicleFilterOption {
  id: string;
  brand: string;
  name: string;
}

export interface ReviewFilterState {
  vehicleId: string;
  brand: string;
  ratings: number[];
  withImages: boolean;
  sort: ReviewSort;
}

interface ReviewFilterBarProps {
  vehicles: VehicleFilterOption[];
  brands: string[];
  state: ReviewFilterState;
  onChange: (next: ReviewFilterState) => void;
  resultCount?: number;
}

const SORT_OPTIONS: Array<{ value: ReviewSort; label: string }> = [
  { value: "recent", label: "최신순" },
  { value: "rating", label: "평점순" },
  { value: "popular", label: "인기순" },
];

const RATING_OPTIONS = [5, 4, 3, 2, 1] as const;

export function ReviewFilterBar({
  vehicles,
  brands,
  state,
  onChange,
  resultCount,
}: ReviewFilterBarProps) {
  const update = (patch: Partial<ReviewFilterState>) =>
    onChange({ ...state, ...patch });

  const hasActive =
    state.vehicleId !== "" ||
    state.brand !== "" ||
    state.ratings.length > 0 ||
    state.withImages;

  const toggleRating = (r: number) => {
    const set = new Set(state.ratings);
    if (set.has(r)) set.delete(r);
    else set.add(r);
    update({ ratings: Array.from(set).sort((a, b) => b - a) });
  };

  const handleBrandSelect = (b: string) => {
    if (state.brand === b) return;
    update({ brand: b, vehicleId: "" });
  };

  const handleVehicleChange = (vehicleId: string, brand: string) => {
    update({ vehicleId, brand: brand || state.brand });
  };

  return (
    <div className="t-card p-4 sm:p-5 space-y-5">
      {/* 정렬 + 결과 수 */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-extrabold text-g2">
            정렬
          </span>
          <div className="relative">
            <select
              value={state.sort}
              onChange={(e) => update({ sort: e.target.value as ReviewSort })}
              className="h-9 pl-3 pr-8 text-[13px] font-bold text-ink bg-sec border border-line2 rounded-[11px] appearance-none cursor-pointer focus:outline-none focus:border-brand"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <ChevronDown
              size={14}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-g2 pointer-events-none"
            />
          </div>
        </div>

        {typeof resultCount === "number" && (
          <span className="text-[12px] font-bold text-g2">
            총 <span className="num font-extrabold text-ink">{resultCount}</span>개 후기
          </span>
        )}
      </div>

      {/* 차량 (브랜드 → 차종) */}
      <div className="space-y-3 pt-1 border-t border-line2">
        <div className="flex flex-wrap items-center gap-2 pt-3">
          <span className="text-[12px] font-extrabold text-g2 mr-1 shrink-0">
            브랜드
          </span>
          <BrandChip
            label="전체"
            active={state.brand === ""}
            onClick={() => handleBrandSelect("")}
          />
          {brands.map((b) => (
            <BrandChip
              key={b}
              label={b}
              active={state.brand === b}
              onClick={() => handleBrandSelect(b)}
            />
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[12px] font-extrabold text-g2 w-12 shrink-0">
            차종
          </span>
          <div className="flex-1 min-w-0 max-w-[420px]">
            <VehicleCombobox
              vehicles={vehicles}
              brand={state.brand}
              value={state.vehicleId}
              onChange={handleVehicleChange}
              placeholder={
                state.brand
                  ? `${state.brand} 차종 검색`
                  : "브랜드 선택 또는 차종 검색"
              }
            />
          </div>
        </div>
      </div>

      {/* 평점 + 이미지 + 초기화 */}
      <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-line2">
        <span className="text-[12px] font-extrabold text-g2 mr-1 mt-3 shrink-0">
          평점
        </span>
        <div className="flex flex-wrap items-center gap-2 mt-3">
          {RATING_OPTIONS.map((r) => {
            const active = state.ratings.includes(r);
            return (
              <button
                key={r}
                type="button"
                onClick={() => toggleRating(r)}
                aria-pressed={active}
                className={cn("chip gap-1", active && "chip-on")}
              >
                <Star
                  size={12}
                  className={cn(
                    active ? "fill-white text-white" : "fill-brand text-brand"
                  )}
                />
                {r}점
              </button>
            );
          })}

          <span className="w-px h-5 bg-line2 mx-1" aria-hidden />

          <button
            type="button"
            onClick={() => update({ withImages: !state.withImages })}
            className={cn("chip gap-1", state.withImages && "chip-on")}
          >
            <ImageIcon size={12} />
            사진 있는 후기만
          </button>

          {hasActive && (
            <button
              type="button"
              onClick={() =>
                onChange({
                  vehicleId: "",
                  brand: "",
                  ratings: [],
                  withImages: false,
                  sort: state.sort,
                })
              }
              className="inline-flex items-center gap-1 h-9 px-3 rounded-pill text-[13px] font-bold text-g2 hover:text-ink"
            >
              <X size={13} />
              필터 초기화
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function BrandChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn("chip", active && "chip-on")}
    >
      {label}
    </button>
  );
}
