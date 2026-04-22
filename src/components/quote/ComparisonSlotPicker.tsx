"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { SelectRow, type SelectOption } from "./primitives";
import type { VehicleListItem } from "@/types/api";

export interface TrimOption {
  id: string;
  name: string;
  price: number;
  category: string | null;
  description: string | null;
  isAccessory: boolean;
  isDefault: boolean;
}

export interface TrimData {
  id: string;
  name: string;
  price: number;
  engineType: string;
  fuelEfficiency: number | null;
  isDefault: boolean;
  specs: Record<string, string> | null;
  options: TrimOption[];
}

export interface ComparisonSelection {
  slug: string;
  trimId: string;
  trimPrice: number;
}

interface ComparisonSlotPickerProps {
  allVehicles: VehicleListItem[];
  excludeSlug?: string;
  value: ComparisonSelection | null;
  onChange: (selection: ComparisonSelection | null) => void;
  onRemove: () => void;
}

export function ComparisonSlotPicker({
  allVehicles,
  excludeSlug,
  value,
  onChange,
  onRemove,
}: ComparisonSlotPickerProps) {
  const [selectedSlug, setSelectedSlug] = useState<string>(value?.slug ?? "");
  const [trims, setTrims] = useState<TrimData[]>([]);
  const [trimsLoading, setTrimsLoading] = useState(false);
  const [selectedLineup, setSelectedLineup] = useState<string | null>(null);
  const [selectedTrimName, setSelectedTrimName] = useState<string | null>(null);

  // 현재 차량 제외한 선택 가능 목록
  const vehicleOptions: SelectOption[] = useMemo(
    () =>
      allVehicles
        .filter((v) => v.slug !== excludeSlug)
        .map((v) => ({
          value: v.slug,
          label: `${v.brand} ${v.name}`,
        })),
    [allVehicles, excludeSlug],
  );

  // 차량 선택 시 트림 로드
  useEffect(() => {
    if (!selectedSlug) {
      setTrims([]);
      setSelectedLineup(null);
      setSelectedTrimName(null);
      return;
    }

    let aborted = false;
    setTrimsLoading(true);
    setTrims([]);
    setSelectedLineup(null);
    setSelectedTrimName(null);

    fetch(`/api/vehicles/${selectedSlug}/trims`)
      .then((r) => r.json())
      .then((json) => {
        if (aborted) return;
        if (!json.success || !Array.isArray(json.data)) return;
        setTrims(json.data as TrimData[]);
      })
      .catch(() => {})
      .finally(() => {
        if (!aborted) setTrimsLoading(false);
      });

    return () => {
      aborted = true;
    };
  }, [selectedSlug]);

  // 캐스케이딩 파생값 (QuoteClientPage와 동일 로직)
  const hasCascade = trims.some((t) => t.specs?.lineup);

  const availableLineups = useMemo(() => {
    if (!hasCascade) return [];
    const all = [
      ...new Set(trims.map((t) => t.specs?.lineup ?? "").filter(Boolean)),
    ];
    const getYear = (s: string) => parseInt(s.match(/\d{4}/)?.[0] ?? "0");
    const getGroup = (s: string) => s.replace(/^\d{4}년형\s*/, "");
    const groupOrder: string[] = [];
    for (const l of all) {
      const g = getGroup(l);
      if (!groupOrder.includes(g)) groupOrder.push(g);
    }
    return all.sort((a, b) => {
      const ga = getGroup(a);
      const gb = getGroup(b);
      const gi = groupOrder.indexOf(ga) - groupOrder.indexOf(gb);
      if (gi !== 0) return gi;
      return getYear(b) - getYear(a);
    });
  }, [trims, hasCascade]);

  const trimsForLineup = useMemo(
    () =>
      selectedLineup
        ? trims.filter((t) => t.specs?.lineup === selectedLineup)
        : [],
    [trims, selectedLineup],
  );

  const availableTrimNames = useMemo(
    () =>
      [
        ...new Map(
          trimsForLineup.map((t) => {
            const name = t.specs?.trimName ?? t.name;
            return [name, { name, price: t.price, id: t.id }];
          }),
        ).values(),
      ],
    [trimsForLineup],
  );

  const resolvedTrim = useMemo(() => {
    if (hasCascade) {
      if (!selectedTrimName) return null;
      return (
        trimsForLineup.find((t) => (t.specs?.trimName ?? t.name) === selectedTrimName) ?? null
      );
    }
    return trims.find((t) => t.id === selectedLineup) ?? null;
  }, [hasCascade, selectedTrimName, trimsForLineup, trims, selectedLineup]);

  // 트림 확정 시 부모에 통지
  useEffect(() => {
    if (resolvedTrim && selectedSlug) {
      onChange({
        slug: selectedSlug,
        trimId: resolvedTrim.id,
        trimPrice: resolvedTrim.price,
      });
    } else {
      onChange(null);
    }
  }, [resolvedTrim, selectedSlug]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="bg-white rounded-card border border-[#F0F0F0] p-4 md:p-5">
      <div className="flex items-start gap-2 mb-3">
        <span className="text-[12px] font-semibold text-primary bg-primary-100 px-2 py-0.5 rounded-[4px]">
          비교 차량
        </span>
        <button
          type="button"
          onClick={onRemove}
          aria-label="비교 차량 제거"
          className="ml-auto w-7 h-7 flex items-center justify-center rounded-full text-ink-caption hover:bg-neutral hover:text-ink transition-colors"
        >
          <X size={15} />
        </button>
      </div>

      <div className="space-y-3">
        <SelectRow
          label="차량"
          value={selectedSlug}
          placeholder="비교할 차량을 선택하세요"
          options={vehicleOptions}
          onChange={(v) => setSelectedSlug(v)}
        />

        {selectedSlug && trimsLoading && (
          <div className="flex items-center gap-2 text-[13px] text-ink-caption">
            <span className="w-3.5 h-3.5 border-2 border-neutral-700 border-t-primary rounded-full animate-spin" />
            트림 정보 불러오는 중...
          </div>
        )}

        {selectedSlug && !trimsLoading && trims.length > 0 && (
          <>
            {hasCascade ? (
              <>
                <SelectRow
                  label="라인업"
                  value={selectedLineup ?? ""}
                  placeholder="연식 / 엔진"
                  options={availableLineups.map((l) => ({ value: l, label: l }))}
                  onChange={(v) => {
                    setSelectedLineup(v || null);
                    setSelectedTrimName(null);
                  }}
                />
                {selectedLineup && (
                  <SelectRow
                    label="트림"
                    value={selectedTrimName ?? ""}
                    placeholder="트림을 선택하세요"
                    options={availableTrimNames.map((t) => ({
                      value: t.name,
                      label: `${t.name} — ${Math.round(t.price / 10000).toLocaleString()}만원`,
                    }))}
                    onChange={(v) => setSelectedTrimName(v || null)}
                  />
                )}
              </>
            ) : (
              <SelectRow
                label="트림"
                value={selectedLineup ?? ""}
                placeholder="트림을 선택하세요"
                options={trims.map((t) => ({
                  value: t.id,
                  label: `${t.name} — ${Math.round(t.price / 10000).toLocaleString()}만원`,
                }))}
                onChange={(v) => setSelectedLineup(v || null)}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
